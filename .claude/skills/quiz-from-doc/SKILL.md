---
name: quiz-from-doc
description: Convert a DOCX or PDF file of multiple-choice questions into a quiz-bank folder (quiz.json + images) for this app and register it in public/bank/manifest.json. Use when the user gives a Word/PDF document (câu hỏi trắc nghiệm) and wants it added as a new quiz set. No external API, no new dependencies — Claude reads the file itself and a cheap subagent does the extraction.
---

# Quiz from DOCX/PDF

Turns a Word/PDF file of trắc nghiệm questions into a folder `public/bank/<id>/`
holding `quiz.json` and (if any) `images/`, and adds an entry to
`public/bank/manifest.json`. Nothing is added to the app itself — this is a Claude
Code–only workflow. No API keys, no new npm packages.

## Target format (must match exactly)

`public/bank/<id>/quiz.json`, UTF-8:

```json
{
  "questions": [
    {
      "text": "Câu hỏi...",
      "image": "images/hinh-1.png",
      "options": [{ "text": "Đáp án a" }, { "text": "", "image": "images/hinh-2.png" }],
      "answer": "b"
    }
  ]
}
```

- `image` is optional on a question and on an option; the path is relative to the set's folder.
- `answer` is the lowercase letter of the correct option by its position in `options`
  (do not reorder options), or `null` if the source does not mark one. The app hides
  `null` questions until they are filled in.
- Images embedded in a DOCX are in `word/media/`: copy the ones used into `images/`.

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
   - Output **only** a JSON array of questions in the target format, nothing else —
     no explanation, no code fences.
   - Keep original wording verbatim — no rephrasing, no translation, keep all
     Vietnamese diacritics.
   - Keep options in their original a/b/c/d order as they appear in the source.
   - `answer` must be the correct option's letter as it explicitly appears in
     the source (answer key, "Đáp án: X", bolded/marked choice, etc). If the
     correct answer isn't discoverable in the text, use `null` — never guess.
   - If the source text is truncated/garbled in places, skip that question rather
     than inventing content.

   If the document is very large (100+ questions), split the raw text into
   sequential chunks and run one subagent call per chunk, then concatenate the
   arrays.

4. **Write the file** to `public/bank/<id>/quiz.json` with the `Write` tool (UTF-8,
   no BOM), and copy any images into `public/bank/<id>/images/`.

5. **Validate** the written file: count questions, check for empty `text`, for
   `null` answers, for answers with no matching option, and that every `image` path
   exists. Report any such questions to the user by number so they can double check
   the source.

6. **Update `public/bank/manifest.json`**: append a new entry preserving the file's
   existing formatting style (the folder is derived from `id`):
   ```json
   {
     "id": "<id>",
     "name": "<display name>",
     "updatedAt": "<today's date, YYYY-MM-DD>"
   }
   ```

7. **Report a summary** to the user: question count, quiz id/name, path to the new
   folder, and any questions missing an answer that need manual review. Do not commit
   or push — leave that to the user (or wait until they explicitly ask you to commit).
