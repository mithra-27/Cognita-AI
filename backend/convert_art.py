from datasets import load_dataset
import json
from pathlib import Path

print("Loading ART dataset...")

ds = load_dataset(
    "allenai/art",
    split="train"
)

output_dir = Path("data/art")
output_dir.mkdir(parents=True, exist_ok=True)

records = []

for i, row in enumerate(ds):
    if len(records) >= 5000:
        break

    observation_1 = str(row.get("observation_1", "")).strip()
    observation_2 = str(row.get("observation_2", "")).strip()
    hypothesis_1 = str(row.get("hypothesis_1", "")).strip()
    hypothesis_2 = str(row.get("hypothesis_2", "")).strip()
    label = row.get("label", None)

    if not observation_1 or not observation_2:
        continue

    if not hypothesis_1 or not hypothesis_2 or label is None:
        continue

    try:
        label = int(label)
    except (ValueError, TypeError):
        continue

    options = [
        hypothesis_1,
        hypothesis_2
    ]

    document = (
        f"Observation 1: {observation_1}\n"
        f"Observation 2: {observation_2}\n\n"
        f"Hypothesis 1: {hypothesis_1}\n"
        f"Hypothesis 2: {hypothesis_2}\n"
        f"Correct Hypothesis: {label}\n"
        f"Reasoning Skill: abductive reasoning and postulation"
    )

    records.append({
        "id": f"art_{i}",
        "question": (
            f"Observation 1: {observation_1}\n"
            f"Observation 2: {observation_2}\n\n"
            f"Which hypothesis best explains the observations?"
        ),
        "options": options,
        "answer": label,
        "correct_answer": label,
        "difficulty": "intermediate",
        "reasoning_category": "arthapatti",
        "document": document,
        "dataset": "art"
    })

output_file = output_dir / "art_train.json"

with open(output_file, "w", encoding="utf-8") as f:
    json.dump(records, f, ensure_ascii=False, indent=2)

print(f"Saved {len(records)} records to {output_file}")