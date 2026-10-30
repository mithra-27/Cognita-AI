from datasets import load_dataset
import json
from pathlib import Path

print("Loading RACE dataset...")

ds = load_dataset(
    "ehovy/race",
    "all",
    split="train"
)

output_dir = Path("data/race")
output_dir.mkdir(parents=True, exist_ok=True)

records = []

# Use 5,000 examples for the initial RAG knowledge base
for i, row in enumerate(ds):
    if i >= 5000:
        break

    article = str(row.get("article", "")).strip()
    question = str(row.get("question", "")).strip()
    options = row.get("options", [])
    answer = str(row.get("answer", "")).strip()

    if not isinstance(options, list):
        options = list(options)

    options = [str(opt).strip() for opt in options]

    # Convert A/B/C/D into a numeric answer index
    answer_map = {
        "A": 0,
        "B": 1,
        "C": 2,
        "D": 3
    }

    answer_index = answer_map.get(answer.upper(), 0)

    document = (
        f"Reading Passage:\n{article}\n\n"
        f"Question: {question}\n"
        f"Options: {options}\n"
        f"Correct Answer: {answer}\n"
        f"Reasoning Skill: reading comprehension and verbal reasoning"
    )

    records.append({
        "id": f"race_{i}",
        "question": question,
        "options": options,
        "answer": answer_index,
        "correct_answer": answer,
        "difficulty": "intermediate",
        "reasoning_category": "shabda",
        "document": document,
        "dataset": "race"
    })

output_file = output_dir / "race_train.json"

with open(output_file, "w", encoding="utf-8") as f:
    json.dump(records, f, ensure_ascii=False, indent=2)

print(f"Saved {len(records)} records to {output_file}")