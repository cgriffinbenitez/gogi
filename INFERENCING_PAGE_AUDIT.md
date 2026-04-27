# Inferencing Teach Page Audit

**File audited:** `src/app/standard/[standardId]/teach/inferencing/page.tsx`
**Date:** 2026-04-19
**Scope:** Read-only. No files were modified.

**Supporting files read:**
- `src/hooks/useTriggerQuestion.ts`
- `src/components/gogi/GogiAvatar.tsx`
- `src/components/gogi/GogiBubble.tsx`
- `src/lib/validation/validateResponse.ts`
- `src/lib/classify/getTeachRoute.ts`
- `src/lib/constants/design.ts` (via system context)

---

## Section 1 — Page Structure

Top to bottom, what the page renders:

1. **Nav bar** (`<TeachNav>`) — navy background, 52px tall. Left side shows `TEACH PHASE  |  INFERENCING SCAFFOLD` in small green-tinted uppercase, and below it the full standard title pulled from `STANDARDS[standardCode]` (e.g. "Inferencing and Textual Evidence"). Right side has a `← Dashboard` text button and a `GOGI` wordmark button, both navigating to `/dashboard/student` or `/dashboard/teacher` based on role.

2. **Two-column layout** — left panel (42% width) + right panel (flex 1), both scrollable independently. On mobile (≤768px) they stack vertically, left panel on top.

**LEFT PANEL:**

3. **"GOGI COACHING" section label** — 9px uppercase gray text.

4. **First Gogi bubble** — Avatar (green, `celebrate` state) + speech bubble with session-dependent text (see Section 5 for exact strings). This is the primary Gogi coaching line that changes based on how many times the student has attempted this standard.

5. **Second Gogi bubble** — Avatar (green, `celebrate` state) + fixed speech bubble: *"Use the 3 steps every time. Step 1 anchors you in the text. Step 2 is the leap. Step 3 is your proof."*

6. **"Passage reference" collapsible** — A toggle button labeled with the passage title (from trigger question) or `"Show passage"` if not loaded. When expanded, shows:
   - Passage title in navy bold
   - Author name in gray
   - Full passage text in Georgia serif, max 220px height, scrollable
   - If loading: shows `"Loading…"` until timeout (5s), then shows passage or fallback text `"Passage will appear here once the diagnostic is complete."`

7. **"I've got it — Practice →" CTA button** — navy, full width. Disabled (opacity 0.4, cursor not-allowed) until all 3 steps pass validation. When clicked, submits response and navigates to `/standard/[standardId]/practice`.

8. **"Complete all 3 steps to continue" hint** — 11px italic gray text, visible only when CTA is disabled.

**RIGHT PANEL:**

9. **"INFERENCING SCAFFOLD — 3 STEPS" section label** — 9px uppercase gray.

10. **Subtitle** — *"Text → Inference → Evidence. Always in that order."* in 11px gray italic.

11. **Visual model card** — Light gray background card showing the 3-box inference chain with green borders:
    - `TEXT SAYS` → `"Her hands trembled."`
    - `IMPLIES` → `She is afraid or nervous`
    - `PROOF` → `The trembling = physical reaction to fear`
    All three boxes are hardcoded. Arrows (`→`) between them.

12. **Step 1 — WHAT THE TEXT SAYS** (`InferenceStep` card, unlocked from the start). Green border, green-tinted background. Shows:
    - Instruction: *"Find the specific lines in the passage that relate to this question."*
    - No sentence starter
    - Textarea placeholder: *"Copy or paraphrase the relevant lines from the passage…"*
    - Once validated, collapses to show student's written response in italic text with a `✓` circle replacing the step number.

13. **Step 2 — WHAT IT IMPLIES** (`InferenceStep` card, locked until Step 1 passes validation). Shows:
    - Instruction: *"The author doesn't SAY this directly. What are they SUGGESTING?"*
    - Sentence starter: *"The author implies that…"*
    - Textarea placeholder: *"The author implies that…"*

14. **Step 3 — HOW YOU KNOW** (`InferenceStep` card, locked until Step 2 passes validation). Shows:
    - Instruction: *"Explain the connection. What in the text makes you believe your inference?"*
    - Sentence starter: *"I know this because the text shows…"*
    - Textarea placeholder: *"I know this because the text shows…"*

---

## Section 2 — Content Source

Every piece of student-facing content, annotated by source:

### Hardcoded Strings

| Content | Location in file |
|---|---|
| `"TEACH PHASE  \| INFERENCING SCAFFOLD"` | TeachNav, line 34 |
| `"← Dashboard"` | TeachNav, line 39 |
| `"GOGI"` (wordmark button) | TeachNav, line 41 |
| `"GOGI COACHING"` (section label) | Line 204 |
| `"Use the 3 steps every time. Step 1 anchors you in the text. Step 2 is the leap. Step 3 is your proof."` | Line 216 |
| `"Passage reference"` (section label) | Line 222 |
| `"Show passage"` (toggle default) | Line 229 |
| `"Hide the passage"` (toggle when open) | Line 229 |
| `"Loading…"` (passage placeholder during load) | Line 237 |
| `"Passage will appear here once the diagnostic is complete."` (passage fallback) | Line 239 |
| `"I've got it — Practice →"` (CTA) | Line 250 |
| `"Complete all 3 steps to continue"` (hint) | Lines 253–255 |
| `"INFERENCING SCAFFOLD — 3 STEPS"` (section label) | Line 262 |
| `"Text → Inference → Evidence. Always in that order."` (subtitle) | Lines 264–265 |
| `"THE MODEL"` (visual model label) | Line 271 |
| `"TEXT SAYS"` / `'"Her hands trembled."'` | Lines 275–276 |
| `"IMPLIES"` / `'She is afraid or nervous'` | Lines 275–276 |
| `"PROOF"` / `'The trembling = physical reaction to fear'` | Lines 275–276 |
| Step 1 label: `"WHAT THE TEXT SAYS"` | Line 291 |
| Step 1 instruction: `"Find the specific lines in the passage that relate to this question."` | Line 292 |
| Step 1 placeholder: `"Copy or paraphrase the relevant lines from the passage…"` | Line 294 |
| Step 2 label: `"WHAT IT IMPLIES"` | Line 300 |
| Step 2 instruction: `"The author doesn't SAY this directly. What are they SUGGESTING?"` | Line 301 |
| Step 2 starter: `"The author implies that…"` | Line 302 |
| Step 2 placeholder: `"The author implies that…"` | Line 303 |
| Step 3 label: `"HOW YOU KNOW"` | Line 309 |
| Step 3 instruction: `"Explain the connection. What in the text makes you believe your inference?"` | Line 310 |
| Step 3 starter: `"I know this because the text shows…"` | Line 311 |
| Step 3 placeholder: `"I know this because the text shows…"` | Line 312 |

### Session-dependent hardcoded strings (Gogi first bubble)

The `getSessionMsg(sessionNum)` function (lines 15–19) returns one of three hardcoded strings based on `sessions_attempted` from `standard_progress`:

| Condition | String |
|---|---|
| `sessions_attempted >= 3` | `"Last session. Let's confirm it's yours."` |
| `sessions_attempted >= 2` | `"You worked on this before. Let's go deeper."` |
| `sessions_attempted == 1` (default) | `"The author didn't say it. They showed it.\nThat gap between what's written and what's meant — that's where the inference lives."` |

`sessionNum` is set to `sessions_attempted + 1`, so on first attempt `sessionNum = 1` (< 2), returning the default message.

### Pulled from Trigger Question (database)

These values vary per student based on which diagnostic question triggered the `inferencing_deficit` classification:

| Content | Source |
|---|---|
| Passage title (shown in toggle button and expanded panel header) | `questions.title` field, fallback: `'Literary Passage'` |
| Passage author (shown in expanded panel subheader) | `questions.author` field, fallback: `'Public Domain'` |
| Full passage text (shown when toggle expanded) | Extracted from `questions.content` — everything before `QUESTION:` line, stripped of `PASSAGE:` prefix |
| Standard title in nav (e.g. "Inferencing and Textual Evidence") | `STANDARDS[standardCode].title` from `src/lib/constants/design.ts` |

### No AI-generated content at runtime

The inferencing page makes **zero API calls** beyond Supabase. No Anthropic API is called. No content is generated at runtime. The trigger question fetch is database-only.

---

## Section 3 — The Interaction

Every interactive element on the page:

### Buttons

| Button | Location | Behavior |
|---|---|---|
| `← Dashboard` | Nav, top right | `router.push('/dashboard/student')` or `'/dashboard/teacher'` based on role |
| `GOGI` (wordmark) | Nav, top right | Same as ← Dashboard |
| Passage toggle (passage title or "Show passage") | Left panel | Toggles `showPassage` state. When true: collapses button label to "Hide the passage", shows passage panel below. When false: hides passage panel. |
| `I've got it — Practice →` | Left panel, bottom | Disabled until `allValid = true`. On click: calls `handleCTA()` → POSTs to `/api/responses/create` → navigates to `/standard/[standardId]/practice`. |

### Input Fields (three textareas, inside `InferenceStep` components)

**Step 1 textarea**
- Always unlocked
- Accepts free text
- Validated by `validateResponse()`: requires ≥ 25 words, ≥ 2 sentence-ending punctuation marks, ≥ 10 characters, not a known bypass phrase
- Border turns green when valid
- When valid AND step 2 or 3 has content: card collapses into read-only italic display of what was written (step number circle changes to ✓)

**Step 2 textarea**
- Locked (opacity 0.5, `disabled` attribute) until Step 1 passes `validateResponse()`
- Same validation rules as Step 1
- When valid AND step 3 has content: collapses to read-only display

**Step 3 textarea**
- Locked until Step 2 passes `validateResponse()`
- Same validation rules
- When valid: collapses to read-only display

### What Gets Submitted

On `handleCTA()` (line 166–187), a single POST to `/api/responses/create` with this body:

```json
{
  "session_id": "<most recent session id for this student+standard>",
  "student_id": "<student uuid>",
  "standard_id": "<standard uuid>",
  "cognitive_skill_targeted": "inferencing",
  "intervention_type": "inferencing_scaffold",
  "student_response": "<step1> | <step2> | <step3>",
  "mastery_achieved": false
}
```

All three step responses are concatenated with ` | ` as separator. `mastery_achieved` is always `false` — intervention responses never claim mastery. That is reserved for the reassess phase.

---

## Section 4 — Classification-Specific Branching

The inferencing page is reached via three different classifications:
- `inferencing_literal`
- `inferencing_schema`
- `inferencing_wm`

All three map to the route segment `'inferencing'` in `getTeachRoute.ts` (lines 49–51):
```typescript
inferencing_literal:  'inferencing',
inferencing_schema:   'inferencing',
inferencing_wm:       'inferencing',
```

**No branching exists in the page itself.**

The `useTriggerQuestion` hook is called with the hardcoded string `'inferencing_deficit'` (line 121) — **not** the actual classification that routed the student here. This is the same regardless of whether the student came from `inferencing_literal`, `inferencing_schema`, or `inferencing_wm`.

This means:
- **Content is identical** for all three classifications
- **Interaction is identical** for all three
- **Gogi coaching script is identical** for all three
- **The trigger question lookup** queries `responses` for `diagnostic_classification = 'inferencing_deficit'` — a code that doesn't appear in the canonical classification list (the actual codes are `inferencing_literal`, `inferencing_schema`, `inferencing_wm`). This means the trigger question lookup **will always fall back** to the first question ID from `sessions.diagnostic_question_ids` — it will never find a matching response row, because no response is ever written with `diagnostic_classification = 'inferencing_deficit'`.

**This is a bug.** The hook should be called with the actual dominant classification (e.g. `'inferencing_literal'`), or with a list of inferencing codes. As written, the passage shown is always the first question from the diagnostic — not the specific question where inferencing broke down.

---

## Section 5 — Session-to-Session Variability

### What `sessionNum` means

`sessionNum = sessions_attempted + 1` where `sessions_attempted` comes from `standard_progress`. It increments each time the full learning loop (diagnostic → teach → practice → reassess) is attempted.

### Day 1 (first attempt, `sessionNum = 1`)

- **Gogi bubble 1:** `"The author didn't say it. They showed it.\nThat gap between what's written and what's meant — that's where the inference lives."`
- **Passage:** Whichever question the fallback path finds (first question ID in `sessions.diagnostic_question_ids` from most recent diagnostic) — see Section 4 bug note.
- **Steps 1–3:** Empty textareas, same instructions, same model card.

### Day 3 (second attempt, `sessionNum = 2`)

- **Gogi bubble 1:** `"You worked on this before. Let's go deeper."`
- **Passage:** Same fallback logic — same first diagnostic question. **No passage rotation mechanism exists.**
- **Steps 1–3:** Empty again (state is not persisted between sessions). Same instructions.

### Day 5, 7, 10 (third and subsequent attempts, `sessionNum >= 3`)

- **Gogi bubble 1:** `"Last session. Let's confirm it's yours."`
- **Passage:** Same as above — no rotation.
- **Steps 1–3:** Same as above.

**Summary: No variability after the Gogi opening line branches into 3 states.** A student who hits this page 6 times sees:
- The same passage every time (same diagnostic question, no rotation)
- The same model card
- The same step instructions, starters, and placeholders
- The same second Gogi bubble
- Gogi bubble 1 cycles through 3 messages and then repeats `"Last session. Let's confirm it's yours."` for all subsequent attempts

**There is no randomization, passage rotation, or content variation mechanism.**

---

## Section 6 — Mastery / Completion Logic

### How a student finishes this page

There is no mastery check on this page. There is no correct-answer evaluation. There is no minimum time threshold.

**The only gate is:** all three textarea fields must pass `validateResponse()`.

### `validateResponse()` rules (from `src/lib/validation/validateResponse.ts`)

A response is valid if ALL of the following are true:
1. Text is ≥ 10 characters after trimming
2. Word count ≥ 25 words
3. At least 2 sentence-ending punctuation marks (`.`, `!`, or `?`)
4. Not a single character repeated (`iiiii`, `kkkkk`, etc.)
5. Not a known bypass phrase: `idk`, `i dont know`, `n/a`, `na`, `ok`, `okay`, `yes`, `no`, `none`, `same`, `good`, `fine`

Once all three steps pass, the CTA button becomes active. The student clicks it.

### What `handleCTA()` does

1. Sets `submitting = true` (disables button, prevents double-submit)
2. POSTs to `/api/responses/create` with the payload described in Section 3
3. **Does not await success before navigating** — errors are caught and logged but the student is routed forward regardless
4. `router.push(`/standard/${standardId}/practice`)` — routes to practice

### What is written to the database

One row in `responses`:

| Column | Value |
|---|---|
| `session_id` | Most recent session ID for this student+standard |
| `student_id` | Student UUID |
| `standard_id` | Standard UUID |
| `cognitive_skill_targeted` | `'inferencing'` (hardcoded) |
| `intervention_type` | `'inferencing_scaffold'` (hardcoded) |
| `student_response` | `"<step1 text> | <step2 text> | <step3 text>"` |
| `mastery_achieved` | `false` (always) |
| `question_id` | **Not set** — this field is null in the response row |
| `diagnostic_classification` | **Not set** — null |
| `attempt_number` | **Not set** — null |

The session row is **not updated** by this page. `sessions.status` and `sessions.completed_at` remain unchanged after the student leaves this page.

---

## Section 7 — Content Inventory

Exact counts of unique student-facing content in this file:

### Hardcoded passages: **0**

No passages are embedded in this file. Passage content comes entirely from the database (`questions.content`).

### Hardcoded questions: **0**

No diagnostic or practice questions are embedded. The only "question" reference is the visual model example (`"Her hands trembled."`), which is an illustrative example, not a real question.

### Hardcoded Gogi coaching lines: **4**

Unique coaching strings the student can see:

1. `"The author didn't say it. They showed it.\nThat gap between what's written and what's meant — that's where the inference lives."` (session 1)
2. `"You worked on this before. Let's go deeper."` (session 2)
3. `"Last session. Let's confirm it's yours."` (session 3+)
4. `"Use the 3 steps every time. Step 1 anchors you in the text. Step 2 is the leap. Step 3 is your proof."` (always shown, second bubble)

### Hardcoded feedback responses: **0**

There are no feedback responses on this page. `validateResponse()` determines whether a field is valid or not, but no feedback message is shown to the student. The textarea border turns green when valid; nothing is said when it's invalid. `getValidationMessage()` is imported in the validation file but is **not called** by this page.

### Hardcoded instructional text blocks: **8**

(Step labels, instructions, starters, model card — not counted above as they are structural, not coaching)

1. Visual model example: `"Her hands trembled." → She is afraid or nervous → The trembling = physical reaction to fear`
2. Step 1 instruction: `"Find the specific lines in the passage that relate to this question."`
3. Step 2 instruction: `"The author doesn't SAY this directly. What are they SUGGESTING?"`
4. Step 2 starter: `"The author implies that…"`
5. Step 3 instruction: `"Explain the connection. What in the text makes you believe your inference?"`
6. Step 3 starter: `"I know this because the text shows…"`
7. Page subtitle: `"Text → Inference → Evidence. Always in that order."`
8. CTA hint: `"Complete all 3 steps to continue"`

---

## Bugs and Issues Noted (Read-Only Observations)

**Bug 1 — Wrong classification code passed to `useTriggerQuestion`**
Line 121: `useTriggerQuestion(studentId || null, standardCode, 'inferencing_deficit')`

`'inferencing_deficit'` is not a canonical classification code. The actual codes are `'inferencing_literal'`, `'inferencing_schema'`, and `'inferencing_wm'`. The hook searches `responses` for a row where `diagnostic_classification = 'inferencing_deficit'` — this will never match any real response, so the hook always falls back to the first question ID in `sessions.diagnostic_question_ids`. The student always sees the same first diagnostic question regardless of which specific inferencing failure they showed.

**Bug 2 — No passage rotation**
`useTriggerQuestion` always returns the same question (via fallback: first entry of `diagnostic_question_ids`). There is no mechanism to show a different passage on repeat visits. A student who fails and returns sees identical content every session.

**Bug 3 — No per-classification differentiation**
All three inferencing classifications route here and see identical content. A student whose failure was `inferencing_wm` (working memory integration) receives the same scaffold as `inferencing_literal` (reads too literally). The intervention is not targeted to the specific breakdown type.

**Bug 4 — `session_id` may be empty if init fails**
If the `init()` function fails to find a session (line 152), `sessionId` stays `''`. The `handleCTA()` guard on line 170 is `if (sessionId && studentId && standardUuid)` — so the response write is silently skipped. The student is still routed to practice, but nothing is recorded.

**Bug 5 — `console.log` logs user ID and session data**
Lines 190–194 log `user?.id`, `studentId`, `triggerQ` (which contains full passage text) to the browser console. These are production code paths. FERPA concern.
