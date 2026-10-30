from datasets import load_dataset
import json
from pathlib import Path

print("Loading VisReason GQA...")

ds = load_dataset(
    "json",
    data_files="https://huggingface.co/datasets/Y-Research-Group/VisReason/resolve/main/train/gqa/dataset.json",
    split="train"
)

output_dir = Path("data/visreason")
output_dir.mkdir(parents=True, exist_ok=True)

records = []

# Use 5,000 examples for the initial RAG knowledge base
for i, row in enumerate(ds):
    if i >= 5000:
        break

    question = str(row.get("question", "")).strip()
    answer = str(row.get("answer", "")).strip()
    full_answer = str(row.get("full_answer", "")).strip()
    thought = str(row.get("thought", "")).strip()
    image = str(row.get("image", "")).strip()

    # Convert detected objects into readable text
    objects = row.get("objects", {})
    object_names = []

    if isinstance(objects, dict):
        for obj in objects.values():
            if isinstance(obj, dict) and "name" in obj:
                object_names.append(str(obj["name"]))

    visual_objects = ", ".join(sorted(set(object_names)))

    # Build text that can be embedded into ChromaDB
    document = (
        f"Visual Question: {question}\n"
        f"Correct Answer: {answer}\n"
        f"Answer Explanation: {full_answer}\n"
        f"Reasoning: {thought}\n"
        f"Visible Objects: {visual_objects}\n"
        f"Image: {image}"
    )

    records.append({
        "id": f"visreason_{i}",
        "question": question,
        "options": [],
        "answer": answer,
        "correct_answer": answer,
        "difficulty": "intermediate",
        "reasoning_category": "pratyaksha",
        "document": document,
        "image": image,
        "dataset": "visreason_gqa"
    })

output_file = output_dir / "visreason_train.json"

with open(output_file, "w", encoding="utf-8") as f:
    json.dump(records, f, ensure_ascii=False, indent=2)

print(f"Saved {len(records)} records to {output_file}")