import json
import os
import time
import shutil
from pathlib import Path

from remotezip import RemoteZip

GQA_URL = "https://downloads.cs.stanford.edu/nlp/data/gqa/images.zip"

BASE_DIR = Path(__file__).resolve().parent
JSON_FILE = BASE_DIR / "data" / "visreason" / "visreason_train.json"
OUTPUT_DIR = BASE_DIR / "data" / "visreason" / "images"

MAX_RETRIES = 5
RETRY_DELAY = 5


def load_required_images():
    with open(JSON_FILE, "r", encoding="utf-8") as f:
        data = json.load(f)

    return sorted(
        set(
            Path(item["image"]).name
            for item in data
            if item.get("image")
        )
    )


def is_valid_image(path):
    """Basic JPEG validation."""
    try:
        if not path.exists() or path.stat().st_size < 100:
            return False

        with open(path, "rb") as f:
            header = f.read(3)

        return header == b"\xff\xd8\xff"

    except Exception:
        return False


def open_zip():
    print("\nConnecting to GQA image archive...")
    z = RemoteZip(GQA_URL)
    print("ZIP connection successful.")
    return z


def main():

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    wanted = load_required_images()

    print("=" * 60)
    print("VISREASON IMAGE DOWNLOADER")
    print("=" * 60)
    print(f"Required images : {len(wanted)}")
    print(f"Output folder   : {OUTPUT_DIR}")
    print("=" * 60)

    # Find existing valid images
    existing = set()

    for filename in wanted:
        path = OUTPUT_DIR / filename

        if is_valid_image(path):
            existing.add(filename)
        elif path.exists():
            print(f"[INVALID] Removing incomplete file: {filename}")
            try:
                path.unlink()
            except Exception:
                pass

    missing = [x for x in wanted if x not in existing]

    print(f"\nAlready valid   : {len(existing)}")
    print(f"Still missing   : {len(missing)}")

    if not missing:
        print("\nAll images are already downloaded.")
        return

    # Connect to ZIP
    z = None

    try:
        z = open_zip()

        # Build ZIP filename lookup
        print("Reading ZIP file list...")
        members = z.namelist()

        member_map = {
            Path(member).name: member
            for member in members
        }

        print(f"ZIP files found : {len(members)}")

        successful = 0
        failed = []

        for index, filename in enumerate(missing, start=1):

            output_file = OUTPUT_DIR / filename
            part_file = OUTPUT_DIR / (filename + ".part")

            member = member_map.get(filename)

            if not member:
                print(f"[NOT FOUND IN ZIP] {filename}")
                failed.append(filename)
                continue

            downloaded = False

            for attempt in range(1, MAX_RETRIES + 1):

                try:

                    # Remove old partial file
                    if part_file.exists():
                        part_file.unlink()

                    print(
                        f"[{index}/{len(missing)}] "
                        f"Downloading {filename} "
                        f"(attempt {attempt}/{MAX_RETRIES})"
                    )

                    with z.open(member) as source:
                        with open(part_file, "wb") as destination:
                            shutil.copyfileobj(source, destination)

                    # Validate before marking complete
                    if not is_valid_image(part_file):
                        raise RuntimeError(
                            "Downloaded file failed JPEG validation."
                        )

                    # Atomic rename
                    os.replace(part_file, output_file)

                    print(f"    SUCCESS: {filename}")

                    successful += 1
                    downloaded = True
                    break

                except Exception as e:

                    print(
                        f"    ERROR: {filename} -> {e}"
                    )

                    if part_file.exists():
                        try:
                            part_file.unlink()
                        except Exception:
                            pass

                    if attempt < MAX_RETRIES:

                        wait = RETRY_DELAY * attempt

                        print(
                            f"    Waiting {wait} seconds before retry..."
                        )

                        time.sleep(wait)

                        # Reconnect to the remote ZIP
                        try:
                            z.close()
                        except Exception:
                            pass

                        try:
                            z = open_zip()
                        except Exception as reconnect_error:
                            print(
                                f"    Reconnect failed: "
                                f"{reconnect_error}"
                            )

                    else:
                        print(
                            f"    FAILED after "
                            f"{MAX_RETRIES} attempts."
                        )

            if not downloaded:
                failed.append(filename)

        # Final verification
        print("\n" + "=" * 60)
        print("FINAL VERIFICATION")
        print("=" * 60)

        final_missing = []

        for filename in wanted:

            path = OUTPUT_DIR / filename

            if not is_valid_image(path):
                final_missing.append(filename)

        print(f"Required images : {len(wanted)}")
        print(f"Valid images    : {len(wanted) - len(final_missing)}")
        print(f"Missing images  : {len(final_missing)}")

        if final_missing:

            missing_file = BASE_DIR / "missing_visreason_images.txt"

            with open(missing_file, "w", encoding="utf-8") as f:
                f.write("\n".join(final_missing))

            print(f"\nMissing list saved to:")
            print(missing_file)

            print("\nFirst missing files:")

            for filename in final_missing[:20]:
                print("  ", filename)

        else:

            print("\nALL 2474 IMAGES ARE PRESENT AND VALID!")

        print("=" * 60)

    finally:

        if z is not None:
            try:
                z.close()
            except Exception:
                pass


if __name__ == "__main__":
    main()