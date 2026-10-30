"""Dataset ingestion for Cognita AI.

Loads the six reasoning datasets from backend/data/ into a persistent
ChromaDB collection.

Expected folders:
    logiqa/       -> anumana
    art/          -> arthapatti
    analogbench/ -> upamana
    visreason/   -> pratyaksha
    race/        -> shabda
    nli/          -> anupalabdhi

Supported files:
    .json
    .jsonl
    .csv

Clean rebuild:
    python ingest.py --reset

Normal ingestion:
    python ingest.py
"""

import csv
import json
import logging
import sys
from pathlib import Path

logging.basicConfig(
    level=logging.INFO,
    format="%(levelname)s: %(message)s",
)

logger = logging.getLogger("cognita.ingest")

BASE_DIR = Path(__file__).parent
DATA_DIR = BASE_DIR / "data"
CHROMA_PATH = BASE_DIR / "chroma_db"

DATASET_MAP = {
    "logiqa": "anumana",
    "art": "arthapatti",
    "analogbench": "upamana",
    "visreason": "pratyaksha",
    "race": "shabda",
    "nli": "anupalabdhi",
}

COLLECTION_NAME = "reasoning_knowledge"
EMBEDDING_MODEL = "all-MiniLM-L6-v2"

# ChromaDB reported a maximum batch size of 5461.
# 5000 leaves a safe margin.
CHROMA_BATCH_SIZE = 5000

# SentenceTransformer embedding batch size.
EMBEDDING_BATCH_SIZE = 128


def _read_json(path: Path) -> list[dict]:
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)

    if isinstance(data, list):
        return data

    if isinstance(data, dict) and "data" in data:
        return data["data"]

    return [data]


def _read_jsonl(path: Path) -> list[dict]:
    records = []

    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()

            if line:
                records.append(json.loads(line))

    return records


def _read_csv(path: Path) -> list[dict]:
    with open(
        path,
        "r",
        encoding="utf-8",
        newline="",
    ) as f:
        return list(csv.DictReader(f))


def _load_file(path: Path) -> list[dict]:
    suffix = path.suffix.lower()

    if suffix == ".json":
        return _read_json(path)

    if suffix == ".jsonl":
        return _read_jsonl(path)

    if suffix == ".csv":
        return _read_csv(path)

    return []


def _normalize(
    raw: dict,
    skill: str,
    dataset: str,
) -> dict | None:
    """Normalize one source record into a standard question record."""

    if not isinstance(raw, dict):
        return None

    question = (
        raw.get("question")
        or raw.get("query")
        or raw.get("passage")
        or raw.get("text")
    )

    if question is None:
        return None

    question = str(question).strip()

    if not question:
        return None

    options = (
        raw.get("options")
        or raw.get("choices")
        or raw.get("answers")
        or []
    )

    if isinstance(options, str):
        options = [
            item.strip()
            for item in options.split("||")
            if item.strip()
        ]

    if not isinstance(options, list):
        options = []

    options = [
        str(item).strip()
        for item in options
        if str(item).strip()
    ]

    if raw.get("correct_answer") is not None:
        correct = raw.get("correct_answer")
    elif raw.get("answer") is not None:
        correct = raw.get("answer")
    elif raw.get("label") is not None:
        correct = raw.get("label")
    else:
        correct = raw.get("gold")

    # Convert numeric answer index to option text.
    if isinstance(correct, int) and options:
        if 0 <= correct < len(options):
            correct = options[correct]

    difficulty = str(
        raw.get("difficulty", "intermediate")
    ).strip()

    question_id = (
        raw.get("id")
        or raw.get("question_id")
        or f"{dataset}_{abs(hash(question))}"
    )

    question_id = str(question_id)

    # IMPORTANT:
    # Our converters created richer documents containing
    # context, question, reasoning information, etc.
    document = raw.get("document")

    if document:
        document = str(document).strip()
    else:
        document = question

    return {
        "question_id": question_id,
        "question": question,
        "options": options,
        "correct_answer": (
            str(correct).strip()
            if correct is not None
            else ""
        ),
        "reasoning_category": skill,
        "difficulty": difficulty,
        "dataset": dataset,
        "document": document,
        "source": "dataset",
    }


def _collect_records() -> list[dict]:
    """Read and normalize all available dataset files."""

    all_records = []

    for folder, skill in DATASET_MAP.items():

        directory = DATA_DIR / folder

        if not directory.exists():
            logger.warning(
                "Dataset folder not found: data/%s/ — skipping.",
                folder,
            )
            continue

        files = (
            sorted(directory.glob("*.json"))
            + sorted(directory.glob("*.jsonl"))
            + sorted(directory.glob("*.csv"))
        )

        if not files:
            logger.warning(
                "No supported files in data/%s/ — skipping.",
                folder,
            )
            continue

        folder_count = 0

        for file_path in files:

            try:
                raw_records = _load_file(file_path)

            except Exception as exc:  # noqa: BLE001
                logger.error(
                    "Failed to read %s: %s",
                    file_path.name,
                    exc,
                )
                continue

            for raw in raw_records:

                normalized = _normalize(
                    raw,
                    skill,
                    folder,
                )

                if normalized is None:
                    continue

                all_records.append(normalized)
                folder_count += 1

        logger.info(
            "Prepared %d records from data/%s/ → %s.",
            folder_count,
            folder,
            skill,
        )

    return all_records


def _reset_collection(client):
    """Delete the existing collection and create a fresh one."""

    try:
        client.delete_collection(
            name=COLLECTION_NAME
        )

        logger.info(
            "Deleted existing ChromaDB collection."
        )

    except Exception:
        logger.info(
            "No existing collection to delete."
        )

    collection = client.get_or_create_collection(
        name=COLLECTION_NAME,
        metadata={
            "hnsw:space": "cosine"
        },
    )

    logger.info(
        "Created clean ChromaDB collection: %s",
        COLLECTION_NAME,
    )

    return collection


def _store_in_batches(
    collection,
    ids,
    embeddings,
    documents,
    metadatas,
):
    """Store records in batches below ChromaDB's batch limit."""

    total = len(ids)

    for start in range(
        0,
        total,
        CHROMA_BATCH_SIZE,
    ):
        end = min(
            start + CHROMA_BATCH_SIZE,
            total,
        )

        collection.upsert(
            ids=ids[start:end],
            embeddings=embeddings[start:end],
            documents=documents[start:end],
            metadatas=metadatas[start:end],
        )

        logger.info(
            "Stored records %d-%d of %d.",
            start + 1,
            end,
            total,
        )


def ingest(reset: bool = False) -> int:
    """Build the persistent ChromaDB knowledge base."""

    try:
        import chromadb
        from sentence_transformers import SentenceTransformer

    except ImportError as exc:
        logger.error(
            "Required RAG package is missing: %s",
            exc,
        )
        return 0

    logger.info(
        "Loading embedding model: %s",
        EMBEDDING_MODEL,
    )

    embed_model = SentenceTransformer(
        EMBEDDING_MODEL
    )

    client = chromadb.PersistentClient(
        path=str(CHROMA_PATH)
    )

    if reset:
        collection = _reset_collection(
            client
        )
    else:
        collection = client.get_or_create_collection(
            name=COLLECTION_NAME,
            metadata={
                "hnsw:space": "cosine"
            },
        )

    records = _collect_records()

    if not records:
        logger.warning(
            "No valid dataset records found."
        )
        return 0

    # Prevent duplicate IDs in the current data files.
    unique_records = {}

    for record in records:
        unique_records[
            record["question_id"]
        ] = record

    records = list(
        unique_records.values()
    )

    logger.info(
        "Preparing %d unique records for ChromaDB.",
        len(records),
    )

    ids = []
    embeddings = []
    documents = []
    metadatas = []

    # Generate embeddings in small CPU-friendly batches.
    for start in range(
        0,
        len(records),
        EMBEDDING_BATCH_SIZE,
    ):
        end = min(
            start + EMBEDDING_BATCH_SIZE,
            len(records),
        )

        batch = records[start:end]

        questions = [
            record["question"]
            for record in batch
        ]

        batch_embeddings = embed_model.encode(
            questions,
            batch_size=EMBEDDING_BATCH_SIZE,
            show_progress_bar=False,
            normalize_embeddings=True,
        )

        for record, embedding in zip(
            batch,
            batch_embeddings,
        ):
            ids.append(
                record["question_id"]
            )

            # Store the FULL converted document,
            # not just the question.
            documents.append(
                record["document"]
            )

            embeddings.append(
                embedding.tolist()
            )

            metadatas.append(
                {
                    "skill": record[
                        "reasoning_category"
                    ],
                    "dataset": record[
                        "dataset"
                    ],
                    "difficulty": record[
                        "difficulty"
                    ],
                    "type": "question",
                    "options": "||".join(
                        record["options"]
                    ),
                    "correct_answer": record[
                        "correct_answer"
                    ],
                }
            )

        logger.info(
            "Generated embeddings for records %d-%d of %d.",
            start + 1,
            end,
            len(records),
        )

    # Store in batches because ChromaDB has a maximum
    # batch size lower than the full dataset size.
    _store_in_batches(
        collection=collection,
        ids=ids,
        embeddings=embeddings,
        documents=documents,
        metadatas=metadatas,
    )

    final_count = collection.count()

    logger.info(
        "Ingestion complete. %d total records stored in ChromaDB.",
        final_count,
    )

    return final_count


if __name__ == "__main__":

    reset_requested = (
        "--reset" in sys.argv
    )

    result = ingest(
        reset=reset_requested
    )

    sys.exit(
        0 if result >= 0 else 1
    )