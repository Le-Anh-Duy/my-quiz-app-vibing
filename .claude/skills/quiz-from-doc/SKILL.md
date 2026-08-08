---
name: quiz-from-doc
description: Convert a DOCX or PDF file of multiple-choice questions into a quiz-bank CSV for this app and register it in public/bank/manifest.json. Use when the user gives a Word/PDF document (câu hỏi trắc nghiệm) and wants it added as a new quiz set. No external API, no new dependencies — Claude reads the file itself and a cheap subagent does the extraction.
---

# Quiz from DOCX/PDF

Turns a Word/PDF file of trắc nghiệm questions into `public/bank/<id>.csv` (matching
the app's existing schema) and adds an entry to `public/bank/manifest.json`. Nothing
is added to the app itself — this is a Claude Code–only workflow. No API keys, no
new npm packages.

## Target CSV schema (must match exactly)

Header row, comma-separated, UTF-8, quote fields that contain commas/quotes:

```
câu hỏi,đáp án a,đáp án b,đáp án c,đáp án d,đáp án đúng
```

`đáp án đúng` is the lowercase letter (`a`/`b`/`c`/`d`) of the correct option, keyed
to the option's position in that row (do not reorder options).

## Steps

1. **Parse the request** for: source file path (required), a quiz `id` (kebab-case
   slug — derive from filename/title if not given), and a display `name` (Vietnamese,
   derive from the doc title/filename if not given). Confirm the file exists.

2. **Extract raw text from the source file** — no OCR/CV libraries, just get the text:
   - **PDF**: use the `Read` tool directly on the file path. It renders pages
     visually (multimodal), which also helps catch bold/underlined/circled answer
     markers. If the PDF has more than 20 pages, read it in chunks with the `pages`
     parameter (max 20 pages per call) and concatenate.
   - **DOCX**: a `.docx` is a zip archive. Extract the text content with Bash,
     without adding any dependency:
     ```
     unzip -p "<path>" word/document.xml
     ```
     Then strip XML tags to get plain text, e.g. pipe through:
     ```
     python -c "import sys,re; x=sys.stdin.read(); x=re.sub(r'</w:p>', '\n', x); x=re.sub(r'<[^>]+>', '', x); print(x)"
     ```
     (If `unzip` isn't available, fall back to PowerShell `Expand-Archive` on a copy
     renamed to `.zip`, then read `word/document.xml` the same way.)
     Note: this loses bold/italic-only formatting — if a doc marks the correct
     answer only via bold with no explicit "Đáp án: X", flag that to the user
     rather than guessing.

3. **Delegate extraction to a cheap subagent.** Spawn `Agent` (`subagent_type:
   general-purpose`, `model: haiku`) with the raw extracted text and these
   instructions:
   - Output **only** CSV text, nothing else — no explanation, no code fences.
   - First line must be exactly: `câu hỏi,đáp án a,đáp án b,đáp án c,đáp án d,đáp án đúng`
   - One row per question, quoting any field containing a comma or quote (double
     the internal quotes per CSV rules).
   - Keep original wording verbatim — no rephrasing, no translation, keep all
     Vietnamese diacritics.
   - Keep options in their original a/b/c/d order as they appear in the source.
   - `đáp án đúng` must be the correct option's letter as it explicitly appears in
     the source (answer key, "Đáp án: X", bolded/marked choice, etc). If the
     correct answer isn't discoverable in the text, leave that cell **empty** —
     never guess.
   - If the source text is truncated/garbled in places, skip that question rather
     than inventing content.

   If the document is very large (100+ questions), split the raw text into
   sequential chunks and run one subagent call per chunk, then concatenate the
   CSV bodies under a single header.

4. **Write the CSV** to `public/bank/<id>.csv` with the `Write` tool (UTF-8, no
   BOM, matching the encoding of existing files in that folder).

5. **Validate** the written file: count rows, check for empty `câu hỏi` cells and
   for rows with an empty `đáp án đúng`. Report any such rows to the user by
   question number so they can double check the source.

6. **Update `public/bank/manifest.json`**: append a new entry preserving the file's
   existing formatting style:
   ```json
   {
     "id": "<id>",
     "name": "<display name>",
     "file": "/bank/<id>.csv",
     "updatedAt": "<today's date, YYYY-MM-DD>"
   }
   ```

7. **Report a summary** to the user: question count, quiz id/name, path to the new
   CSV, and any rows missing an answer that need manual review. Do not commit or
   push — leave that to the user (or wait until they explicitly ask you to commit).
