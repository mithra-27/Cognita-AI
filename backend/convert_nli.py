from datasets import load_dataset
import json
from pathlib import Path

print("Loading SNLI dataset...")

ds = load_dataset(
    "stanfordnlp/snli",
    split="train"
)

output_dir = Path("data/nli")
output_dir.mkdir(parents=True, exist_ok=True)

records = []

label_map = {
    0: "entailment",
    1: "neutral",
    2: "contradiction"
}

# Use 5,000 valid examples for the initial RAG knowledge base
for i, row in enumerate(ds):
    if len(records) >= 5000:
        break

    premise = str(row.get("premise", "")).strip()
    hypothesis = str(row.get("hypothesis", "")).strip()
    label = row.get("label")

    # Skip examples with invalid labels or empty text
    if not premise or not hypothesis or label not in label_map:
        continue

    label_name = label_map[label]

    document = (
        f"Evidence (Premise): {premise}\n"
        f"Claim (Hypothesis): {hypothesis}\n"
        f"Relationship: {label_name}\n"
        f"Reasoning Skill: determining whether a claim is supported, "
        f"contradicted, or not established by the available evidence"
    )

    records.append({
        "id": f"nli_{i}",
        "question": hypothesis,
        "options": [
            "Entailment",
            "Neutral",
            "Contradiction"
        ],
        "answer": label,
        "correct_answer": label_name,
        "difficulty": "intermediate",
        "reasoning_category": "anupalabdhi",
        "document": document,
        "premise": premise,
        "hypothesis": hypothesis,
        "dataset": "snli"
    })

output_file = output_dir / "nli_train.json"

with open(output_file, "w", encoding="utf-8") as f:
    json.dump(records, f, ensure_ascii=False, indent=2)

print(f"Saved {len(records)} records to {output_file}")