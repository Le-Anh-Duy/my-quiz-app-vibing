"""One-shot: public/bank/*.csv -> public/bank/<id>/quiz.json (+ images/ for later).

Run from anywhere: python scripts/migrate_csv_to_json.py
Safe to re-run: sets already migrated (manifest entry without "file") are skipped.
Each CSV is deleted only after its JSON has been read back and compared.
"""
import csv
import json
from pathlib import Path

BANK = Path(__file__).resolve().parent.parent / "public" / "bank"
MANIFEST = BANK / "manifest.json"
KEYS = "abcd"


def row_to_question(row):
    # Drop only trailing empty options, so an answer letter still equals its position.
    options = [(row.get(f"đáp án {k}") or "").strip() for k in KEYS]
    while options and not options[-1]:
        options.pop()

    question = {
        "text": row["câu hỏi"].strip(),
        "options": [{"text": t} for t in options],
        "answer": (row.get("đáp án đúng") or "").strip().lower() or None,
    }
    if row.get("__nguon"):
        question["source"] = row["__nguon"]
    return question


def migrate(entry):
    src = BANK / Path(entry["file"]).name
    with src.open(encoding="utf-8-sig", newline="") as f:
        rows = [r for r in csv.DictReader(f) if (r.get("câu hỏi") or "").strip()]
    questions = [row_to_question(r) for r in rows]

    # Validate before anything is deleted: a bad answer key must stop the run.
    for i, q in enumerate(questions, 1):
        if q["answer"] and KEYS.find(q["answer"]) not in range(len(q["options"])):
            raise SystemExit(f"{src.name} row {i}: answer {q['answer']!r} has no matching option")

    out = BANK / entry["id"] / "quiz.json"
    out.parent.mkdir(exist_ok=True)
    out.write_text(json.dumps({"questions": questions}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    if json.loads(out.read_text(encoding="utf-8"))["questions"] != questions:
        raise SystemExit(f"{out}: read-back mismatch, keeping {src.name}")
    src.unlink()
    print(f"{entry['id']}: {len(questions)} questions")
    return len(questions)


def main():
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    total = 0
    for entry in manifest:
        if "file" not in entry:
            continue
        total += migrate(entry)
        del entry["file"]  # path is now derived from the id
        # Saved after every set, so an interrupted run can simply be re-run.
        MANIFEST.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"total: {total} questions")


if __name__ == "__main__":
    main()
