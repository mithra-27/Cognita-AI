from datasets import load_dataset
import json
from pathlib import Path
import re

print("Loading AnaloBench...")

ds = load_dataset(
    "jhu-clsp/AnaloBench",
    "T1S1-Full",
    split="train"
)

output_dir = Path("data/analogbench")
output_dir.mkdir(parents=True, exist_ok=True)

records = []

for i, row in enumerate(ds):

    sentence = str(row.get("Sentence", "")).strip()
    options_raw = row.get("Options", [])
    label = row.get("Label", None)

    if not sentence or label is None:
        continue

    # Convert options into a list
    if isinstance(options_raw, list):
        options = [str(x).strip() for x in options_raw]
    else:
        options = re.findall(
            r"(?:A|B|C|D)[\.\)]\s*(.*?)(?=(?:\s+[B-D][\.\)])|$)",
            str(options_raw)
        )

    options = [x.strip() for x in options if x.strip()]

    if not options:
        continue

    # Convert label to integer when possible
    try:
        label_int = int(label)
    except (ValueError, TypeError):
        label_str = str(label).strip().upper()
        label_map = {"A": 0, "B": 1, "C": 2, "D": 3}
        if label_str not in label_map:
            continue
        label_int = label_map[label_str]

    document = (
        f"Analogy / Reasoning Problem:\n{sentence}\n\n"
        f"Options: {options}\n"
        f"Correct Answer: {label_int}\n"
        f"Reasoning Skill: analogical reasoning and comparison"
    )

    records.append({
        "id": f"analogbench_{i}",
        "question": sentence,
        "options": options,
        "answer": label_int,
        "correct_answer": label_int,
        "difficulty": "intermediate",
        "reasoning_category": "upamana",
        "document": document,
        "dataset": "analogbench"
    })

output_file = output_dir / "analogbench_train.json"

with open(output_file, "w", encoding="utf-8") as f:
    json.dump(records, f, ensure_ascii=False, indent=2)

print(f"Saved {len(records)} records to {output_file}")