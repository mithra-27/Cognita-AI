from datasets import load_dataset
import json
from pathlib import Path

print("Loading LogiQA 2.0...")

ds = load_dataset(
    "datatune/LogiQA2.0",
    split="train"
)

output_dir = Path("data/logiqa")
output_dir.mkdir(parents=True, exist_ok=True)

records = []

for i, row in enumerate(ds):
    if len(records) >= 5000:
        break

    try:
        item = json.loads(row["text"])
    except (json.JSONDecodeError, TypeError, KeyError):
        continue

    context = str(item.get("text", "")).strip()
    question = str(item.get("question", "")).strip()
    options = item.get("options", [])
    answer = item.get("answer", None)

    if not context or not question or not options or answer is None:
        continue

    if not isinstance(options, list):
        options = list(options)

    options = [str(opt).strip() for opt in options]

    try:
        answer = int(answer)
    except (ValueError, TypeError):
        continue

    document = (
        f"Context:\n{context}\n\n"
        f"Question: {question}\n"
        f"Options: {options}\n"
        f"Correct Answer: {answer}\n"
        f"Reasoning Skill: inference and logical reasoning"
    )

    records.append({
        "id": f"logiqa_{i}",
        "question": question,
        "options": options,
        "answer": answer,
        "correct_answer": answer,
        "difficulty": "intermediate",
        "reasoning_category": "anumana",
        "document": document,
        "dataset": "logiqa2"
    })

output_file = output_dir / "logiqa_train.json"

with open(output_file, "w", encoding="utf-8") as f:
    json.dump(records, f, ensure_ascii=False, indent=2)

print(f"Saved {len(records)} records to {output_file}")