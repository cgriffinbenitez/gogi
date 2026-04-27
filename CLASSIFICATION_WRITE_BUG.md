# CLASSIFICATION WRITE BUG AUDIT
Date: 2026-04-19
Scope: Read-only investigation — no files modified

---

## Summary

`diagnostic_classification` is always null because the diagnostic page looks for classification data
inside the question's `content` text string (via `DIAGNOSTIC_CLASSIFICATION_A:` markers), but the
questions currently in the database — seeded by `scripts/seed-sprint-o.ts` — do not include those
markers in their content strings. The classification data for those questions lives in separate
`option_a_class` / `option_b_class` / `option_c_class` / `option_d_class` columns, which the
diagnostic page never selects.

---

## Finding 1 — Where the classification lookup happens

**File**: `src/app/standard/[standardId]/diagnostic/page.tsx`, `parseQuestionContent` function (line 39)

```typescript
function parseQuestionContent(raw: string, id: string): Omit<ParsedQuestion, 'passageText' | 'title' | 'author' | 'pub_year'> {
  const lines = raw.split('\n');
  const get = (prefix: string) => {
    const line = lines.find((l) => l.trimStart().startsWith(prefix));
    return line ? line.slice(line.indexOf(prefix) + prefix.length).trim() : '';
  };

  // ...

  const classifications: Record<string, string> = {};
  for (const letter of ['A', 'B', 'C', 'D']) {
    const val = get(`DIAGNOSTIC_CLASSIFICATION_${letter}:`);   // ← looks for this exact prefix in content
    if (val) classifications[letter] = val;
  }

  return { id, stem, choices, correctLetter, cognitiveSkill, classifications };
}
```

The lookup IS happening. It scans the question's `content` text string line-by-line, looking for
lines that start with `DIAGNOSTIC_CLASSIFICATION_A:`, `DIAGNOSTIC_CLASSIFICATION_B:`, etc.

If those markers are absent from the content string, `classifications` is `{}` (empty object).

---

## Finding 2 — How the classification is passed into the POST body

**File**: `src/app/standard/[standardId]/diagnostic/page.tsx`, `handleSelect` function (line 377)

```typescript
async function handleSelect(letter: string) {
  // ...
  const q = questions[currentQ];

  setTimeout(async () => {
    if (sessionId && studentId && standardUuid) {
      try {
        await fetch('/api/responses/create', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            session_id:                sessionId,
            question_id:               q.id.startsWith('placeholder') ? null : q.id,
            student_id:                studentId,
            standard_id:               standardUuid,
            cognitive_skill_targeted:  q.cognitiveSkill,
            diagnostic_classification: q.classifications[letter] ?? null,   // ← this
            student_response:          letter,
            mastery_achieved:          letter === q.correctLetter,
            attempt_number:            1,
          }),
        });
      }
    }
  }, 1500);
}
```

**Variable holding the value**: `q.classifications[letter]` — where `q` is the `ParsedQuestion` for
the current question and `letter` is the student's selected answer (e.g. `'A'`).

**Field name in POST body**: `diagnostic_classification`

If `q.classifications` is an empty object (because the markers were never in the content string),
then `q.classifications[letter]` is `undefined`, and `?? null` makes it `null`.

---

## Finding 3 — Whether the API route includes diagnostic_classification in the INSERT

**File**: `src/app/api/responses/create/route.ts`

```typescript
const { data, error } = await supabase
  .from('responses')
  .insert({
    session_id,
    question_id: question_id ?? null,
    student_id,
    standard_id,
    cognitive_skill_targeted: cognitive_skill_targeted ?? null,
    diagnostic_classification: diagnostic_classification ?? null,   // ← yes, included
    intervention_type: intervention_type ?? null,
    intervention_content: intervention_content ?? null,
    student_response,
    mastery_achieved,
    attempt_number,
  })
```

Yes. `diagnostic_classification` is destructured from the request body (line 13) and included in the
INSERT. The API route is not the bug. It faithfully writes whatever the client sends — and the client
is sending `null` every time.

---

## Finding 4 — Root cause: `seed-sprint-o.ts` does NOT write classification markers into content

**File**: `scripts/seed-sprint-o.ts`, lines 431–444 (content builder)

```typescript
const content = [
  `PASSAGE:\n\n${passage}`,
  `---`,
  `QUESTION: ${generated.question_stem}`,
  ``,
  `A. ${generated.option_a.text}`,
  `B. ${generated.option_b.text}`,
  `C. ${generated.option_c.text}`,
  `D. ${generated.option_d.text}`,
  ``,
  `CORRECT: ${generated.correct_option}`,
].join('\n');
```

**No `DIAGNOSTIC_CLASSIFICATION_X:` lines are included in this content string.**

The classification data for these questions IS captured — but it goes into separate database columns:

```typescript
await supabase
  .from('questions')
  .insert({
    content,                                         // ← no classification markers here
    option_a_class: generated.option_a.classification,  // ← classification lives here
    option_b_class: generated.option_b.classification,
    option_c_class: generated.option_c.classification,
    option_d_class: generated.option_d.classification,
    // ...
  })
```

The data is in the DB. It is just in `option_a_class` / `option_b_class` / `option_c_class` /
`option_d_class` columns — never in the `content` text field.

---

## Finding 5 — The diagnostic page never selects those columns

**File**: `src/app/standard/[standardId]/diagnostic/page.tsx`, lines 255–261

```typescript
const { data: qRows, error: qErr } = await supabase
  .from('questions')
  .select('id, content, cognitive_skill_targeted, title, author, pub_year, keyword_flags')
  .eq('standard_id', standard.id)
  .order('created_at', { ascending: false })
  .limit(10);
```

`option_a_class`, `option_b_class`, `option_c_class`, `option_d_class` are **not in the select list**.

They are never fetched. `parseQuestionContent` runs on the raw `content` string, finds no
`DIAGNOSTIC_CLASSIFICATION_X:` markers (because seed-sprint-o.ts never wrote them), and returns
`classifications: {}`.

---

## Finding 6 — The split: which scripts write markers into content vs. columns

Three other scripts DO embed classification markers inside the content string:

**`scripts/buildPassageLibrary.ts`** (lines 495–498):
```typescript
`DIAGNOSTIC_CLASSIFICATION_A: ${r.option_a.classification}\n` +
`DIAGNOSTIC_CLASSIFICATION_B: ${r.option_b.classification}\n` +
`DIAGNOSTIC_CLASSIFICATION_C: ${r.option_c.classification}\n` +
`DIAGNOSTIC_CLASSIFICATION_D: ${r.option_d.classification}\n` +
```

**`scripts/generateQuestions.ts`** (lines 217–220): same pattern

**`scripts/rebuildQuestionBank.ts`** (lines 241–244): same pattern

Questions seeded by those three scripts would parse correctly in `parseQuestionContent`. Questions
seeded by `seed-sprint-o.ts` (30 anchor questions — 10 per standard × 3 pilot standards) would
always produce `classifications: {}`.

`scripts/rebuildQuestionBank.ts` additionally shows the dual-lookup pattern that proves awareness of
the split (lines 557–560):
```typescript
A: row.option_a_class ?? parseField(row.content, 'DIAGNOSTIC_CLASSIFICATION_A:'),
B: row.option_b_class ?? parseField(row.content, 'DIAGNOSTIC_CLASSIFICATION_B:'),
C: row.option_c_class ?? parseField(row.content, 'DIAGNOSTIC_CLASSIFICATION_C:'),
D: row.option_d_class ?? parseField(row.content, 'DIAGNOSTIC_CLASSIFICATION_D:'),
```
This script checks the column first, then falls back to parsing the content string — exactly the
dual-source awareness the diagnostic page is missing.

---

## Exact Failure Path (end-to-end)

```
1. Diagnostic page fetches questions
   → .select('id, content, ...') — no option_a_class etc.

2. parseQuestionContent(row.content, row.id)
   → scans content for "DIAGNOSTIC_CLASSIFICATION_A:" — NOT FOUND (seed-sprint-o.ts never wrote it)
   → classifications = {}

3. Student clicks answer letter (e.g. "B")
   → q.classifications['B'] → undefined
   → undefined ?? null → null
   → body: { diagnostic_classification: null }

4. POST /api/responses/create
   → receives diagnostic_classification: null
   → inserts null into responses.diagnostic_classification

5. classifySession reads back responses
   → diagnostic_classification = null on every row
   → counts = {} (null values are skipped: "if (row.mastery_achieved !== true && row.diagnostic_classification)")
   → dominant falls to hardcoded default: 'no_metacognitive_strategy'
   → every student routed to same teach path
```

---

## What Is NOT the bug

- The API route correctly includes `diagnostic_classification` in the INSERT.
- The `parseQuestionContent` function correctly parses content strings that DO contain the markers.
- The classification data exists in the database — it is in `option_a_class` etc. on the `questions` table.
- The Supabase client auth is correct.

The entire bug is a data-sourcing mismatch:  
**The data is in columns. The page reads from a text string. The content string never had the data.**
