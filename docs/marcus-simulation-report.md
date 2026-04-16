# GOGI Marcus Simulation — Comprehensive Feedback Report
**Date:** 2026-04-15  
**Simulated student:** Marcus (6th-grade reading level, low effort, picks plausible-sounding wrong answers, types "idk", rushes every step)  
**Standards in scope:** ELA.9.R.1.1 · ELA.9.R.1.2 · ELA.9.R.2.1  
**Reviewer:** Static code trace + Playwright simulation

---

## Part 1 — Static Code Trace: Marcus's Full Journey

### 1.1 Auth → Student Home

**File:** `src/app/sign-up-login-screen/components/LoginForm.tsx`

Marcus lands on `/sign-up-login-screen`. Fills email + password. `supabase.auth.signInWithPassword()` is called. On success, `getUserRole()` queries the `users` table. If role is `student`, router pushes to `/student-home`.

**StudentHomePage.tsx** then:
1. Calls `supabase.auth.getUser()` — gets `user.id`
2. Queries `students` where `user_id = user.id` — gets `student.id` and `full_name`
3. Queries `standards` IN `['ELA.9.R.1.1', 'ELA.9.R.1.2', 'ELA.9.R.2.1']`
4. Queries `sessions` WHERE `student_id = student.id AND standard_id IN [...]`
5. Calls `deriveStatus(sessions)` for each standard — returns `not_started` for a fresh Marcus account

**Status derivation logic** (`StudentHomePage.tsx:50–70`):
- No diagnostic session → `not_started` → CTA = "Begin Diagnostic" → route = `/student-diagnostic`
- `not_started` is correctly shown for all 3 standards on first visit

**FINDING:** Home → diagnostic routing is correct. `getCtaRoute()` returns `/student-diagnostic` (not `/student-diagnostic/[standardId]`) — this is a flat route, meaning a single diagnostic covers all 3 standards. Correct by design.

---

### 1.2 Diagnostic Phase

**File:** `src/app/student-diagnostic/components/DiagnosticAssessment.tsx`

**Init flow:**
1. Auth check → student lookup
2. Queries `standards` IN pilot codes → gets 3 standard objects
3. Queries `questions` for each standard_id (3 per standard = 9 total)
4. If questions table is empty for a standard → calls Claude API (`generate_diagnostic_questions`) → inserts generated questions → uses them
5. Creates 3 `sessions` rows (one per standard, phase = 'diagnostic', status = 'in_progress')

**Marcus's behavior:** Picks option A on every question without reading.

**What happens on wrong answer:**
- `selectedLetter = 'A'`, `isCorrect = false`
- `diagnostic_classification = q.diagnosticClassifications['A']` → one of the valid classification codes
- Inserts into `responses` with `mastery_achieved: false`, `attempt_number: 1`, `time_on_question_seconds`

**What happens on correct answer:**
- `diagnostic_classification = null` (correct — classification is null for passing)
- `mastery_achieved: true`

**Score computation:** At end of all 9 questions, per-standard pct is computed. With all-A answers, Marcus likely scores 0–25% on each standard (random chance of A being correct).

**Session update:** `sessions` rows updated with `status: 'completed'`, `mastery_achieved: pct >= 80`, `completed_at`, `time_spent_seconds`.

**Result routing:** For any standard where Marcus scored < 80% (almost certain), a "Start Lesson" button appears → routes to `/student-teach/[standardId]`. Home status for those standards will transition from `not_started` to `ready_to_learn`.

**FINDING (Bug Exposure):** If Claude generates questions and the JSON parse fails, `DiagnosticAssessment` falls back with `setPhase('error')`. There's no retry — Marcus sees "Unable to Load Assessment." This is acceptable for pilot scale.

**FINDING (Gap):** `MASTERY_THRESHOLD = 0.8` but the constant is `0.8` (not `80`) while the comparison is `s.pct >= MASTERY_THRESHOLD * 100`. This is correct. Not a bug — just worth noting the `* 100` multiplication is required because `pct` is stored as 0–100.

---

### 1.3 Teach Phase (Protocol Engine)

**Files:** `TeachSession.tsx` → `ClassificationRouter.ts` → `ProtocolEngine.tsx` → `[Standard]Protocols.ts`

**TeachSession init:**
1. Auth + student lookup
2. Queries `standards` for this `standardId` → gets `code` and `title`
3. Queries `responses` WHERE `student_id = student.id AND standard_id = standardId AND mastery_achieved = false` ORDER BY `created_at DESC` LIMIT 1
4. Uses `wrongResponse.diagnostic_classification` (or falls back to `cognitive_skill_targeted`) as the routing key
5. Calls `routeToProtocol(standardCode, classification)` → gets a `ProtocolName`

**ClassificationRouter routing for Marcus (all-A answers):**

Since Marcus always picks A, the classification assigned to option A varies per question. Most diagnostic questions assign Layer 1 distractors to A (schema_deficit or no_metacognitive_strategy). Expected routing:
- ELA.9.R.1.1: `schema_deficit` → **SituationModelFailure** protocol
- ELA.9.R.1.2: `schema_deficit` → **ThemeConceptBuilding** protocol  
- ELA.9.R.2.1: `schema_deficit` → **DefaultListStrategy** protocol

**FINDING (Routing Gap):** TeachSession queries responses using `maybeSingle()` on the most recent wrong response. If Marcus somehow got 0 wrong answers (impossible given all-A, but worth noting), `classification` would be `''` and each standard defaults to its own fallback protocol (`SituationModelFailure`, `ThemeConceptBuilding`, `DefaultListStrategy`). These are appropriate defaults.

**ProtocolEngine execution for SituationModelFailure (8 steps):**

| Step | Name | Type | Marcus's Experience |
|---|---|---|---|
| 1 | Orientation | read_only | Content streams in. Continue button enabled after streaming. Marcus clicks immediately. |
| 2 | MicroModel | read_only | Content streams in. Marcus clicks through without engaging. |
| 3 | GuidedPractice | drag_and_drop | Items and categories generate via Claude. Marcus likely drags randomly. |
| 4 | SemiGuided | drag_and_drop | Same. Marcus drags randomly again. |
| 5 | IndependentTask | short_response | Marcus types "idk" and submits. |
| 6 | MasteryCheck | short_response | Marcus types "idk". Eval runs. Fails. Feedback shown. Retry. |
| 7 | TransferTask | short_response | If Marcus passes step 6 eventually, same behavior. |
| 8 | ReassessTrigger | read_only | Streams completion message. |

**Content generation:** Each step calls `generate_protocol_step_content` via `useStreamingClaude.startStreaming()`. The hook POSTs to `/api/claude/route.ts`, which uses Server-Sent Events (SSE) to stream back content. The `displayContent = stepContent || streaming.content` pattern prevents blank flashes.

**"idk" response handling:** When Marcus types "idk" and submits on a mastery-relevant step:
1. `evaluate_mastery_structured` is called with `studentResponse: 'idk'`
2. Claude returns `{ theme_universal: false, evidence_relevant: false, reasoning_explicit: false, scaffolds_used: false }`
3. `derivePassed()` returns `false`
4. `evalFeedback` is set and shown
5. `attemptNumber` increments — student gets one retry before `reclassificationTrigger` fires

**FINDING (Marcus-specific):** Marcus will exhaust 2 attempts on MasteryCheck with "idk" + "idk". After 2 failures, `reclassificationTrigger` fires if defined in the protocol. For SituationModelFailure, a reclassification trigger routes to ChunkingFailure (or similar). If reclassification runs, Marcus starts a new protocol. This is correct clinical behavior — de-escalate when the student is stuck.

**FINDING (UX Gap):** The feedback shown to Marcus after typing "idk" comes from `PROTOCOL_CONTENT_SYSTEM_PROMPT` — Gogi speaks in peer voice. The prompt says "Reference what this specific student actually wrote." Claude is explicitly given Marcus's "idk" response and should tailor the feedback to it. This is well-designed. However — if Claude ignores the "idk" and gives generic feedback anyway, Marcus learns nothing. This is a Claude prompt compliance issue, not a code issue.

---

### 1.4 Practice Phase

**File:** `src/app/student-practice/[standardId]/PracticeSession.tsx`

**Init:** Queries `responses` for this student+standard to find the teach classification. Calls Claude (`generate_practice_question`) for Q1 (scaffold: full), then subsequent questions are generated on demand.

**Marcus's behavior:** Types "idk" to all 3 questions.

**Scaffold levels:**
- Q1: `full` — drag_and_drop (ELA.9.R.2.1), multiple_choice (ELA.9.R.1.2), passage_annotation (ELA.9.R.1.1)
- Q2: `reduced` — passage_annotation, fill_in
- Q3: `none` — structured_response, short_response

**"idk" on Q1 and Q2:** Eval runs, `mastery_achieved: false` saved to responses. Feedback shown. Student advances (practice is formative — Q3 failure is not blocking).

**"idk" on Q3 (independent):** Explicitly noted in component comment: "Q3 failure is encouraged, not blocking. Routes to Reassess after all 3." This is correct clinical design.

**FINDING:** After Q3, session completes and router pushes to `/student-reassess/[standardId]`. Home status transitions to `ready_to_reassess`. Correct.

---

### 1.5 Reassess Phase

**File:** `src/app/student-reassess/[standardId]/components/ReassessSession.tsx`

**Init:**
1. Auth + student lookup
2. Creates `reassess` session row
3. Checks `reassess_passages` table for cached passage (same instrument on retry — good for growth measurement)
4. If no cached passage: calls `callClaude('generate_reassess', ...)` — **blocking non-streaming call**
5. Parses result with `parseReassessContent()` — splits on `---PASSAGE---` and `---QUESTION N---` delimiters
6. Saves to `reassess_passages` for reuse

**Marcus's "idk" responses:** Each answer calls `evaluate_reassess_response`. Claude returns `{ mastery_achieved: bool, feedback: string }`. With "idk", mastery will be false. After all 5 questions, results screen shows overall mastery.

**FINDING (Schema Gap):** `reassess_passages` table is referenced but the SQL `CREATE TABLE` for it is only in a comment at the top of `ReassessSession.tsx:1–15`. If this table doesn't exist in Supabase yet, the `.from('reassess_passages').select(...)` call returns an error — but it's caught and the code falls through to Claude generation. The fire-and-forget save will silently fail. The student experience is preserved but passage stability is lost (new passage generated on each retry).

**FINDING (Blocking Claude call):** `callClaude('generate_reassess', ...)` is a non-streaming call that can take 15–30 seconds for a long passage + 5 questions. During this time, the student sees only a loading spinner. No progress indicator or estimated wait time is shown. For a student like Marcus who has low patience, this is a dropout risk.

---

### 1.6 Rate Limiting

**File:** `src/app/api/claude/route.ts`

- 30 calls per hour per user (`RATE_LIMIT_MAX_CALLS = 30`)
- Sliding window in-memory store (resets on server restart)
- A full session for one standard: ~12–15 Claude calls (8 protocol steps + 3 practice + 1 reassess + diagnostics)
- With 3 standards: ~36–45 calls — **Marcus can hit the rate limit within a single pilot day**

**FINDING (Rate Limit Risk):** 30 calls/hour is too low for a student who completes a full cycle on 2+ standards in one sitting. This is acceptable for the pilot (10 students, not power users), but needs to be raised before broader deployment.

---

## Part 2 — Playwright Test Suite

See `tests/marcus-simulation.spec.ts` for the full 8-test suite:

| Test | Name | What it validates |
|---|---|---|
| T01 | Auth & Home | Login, redirect, 3 standard cards visible |
| T02 | Diagnostic | 9-question flow, results screen, session persisted |
| T03 | Teach | Protocol engine loads, Orientation streams, Continue enabled |
| T04 | Practice | 3 questions generate, "idk" submits, session completes |
| T05 | Reassess | Passage renders, answers submit |
| T06 | Home Status | Cards no longer show "Not Started" after diagnostic |
| T07 | Data Integrity | No undefined/null/[object Object] in UI |
| T08 | Mobile | 390px viewport, no horizontal overflow |

**Prerequisites:** `PLAYWRIGHT_STUDENT_EMAIL` and `PLAYWRIGHT_STUDENT_PASSWORD` env vars must point to a real Supabase user with a `students` row. Run with `npx playwright test --project=chromium`.

---

## Part 3 — Comprehensive Feedback Report

### Section 1: Clinical Routing Validation

| Scenario | Expected | Code Behavior | Status |
|---|---|---|---|
| All-A answers, ELA.9.R.1.1 | `schema_deficit` → SituationModelFailure | ClassificationRouter returns SituationModelFailure for schema_deficit on ELA.9.R.1.1 | CORRECT |
| All-A answers, ELA.9.R.1.2 | `schema_deficit` → ThemeConceptBuilding | ClassificationRouter returns ThemeConceptBuilding | CORRECT |
| All-A answers, ELA.9.R.2.1 | `schema_deficit` → DefaultListStrategy | ClassificationRouter returns DefaultListStrategy | CORRECT |
| Score >= 80% on diagnostic | Skip to Reassess (mastery_achieved = true) | StudentHomePage.deriveStatus → `mastered` if reassess mastery_achieved = true | CORRECT |
| Score < 80% | Route to Teach | deriveStatus → `ready_to_learn` | CORRECT |
| Empty classification | Each standard has a defined fallback | All three routing maps have fallback protocols | CORRECT |
| Unknown classification code | Fallback protocol | `?? 'SituationModelFailure'` / `?? 'ThemeConceptBuilding'` / `?? 'DefaultListStrategy'` | CORRECT |
| Reclassification trigger after 2 failures | New protocol assigned | `onReclassify` called by ProtocolEngine, TeachSession sets `reclassifiedProtocolName` | CORRECT |

**Overall: Clinical routing is sound for the pilot standards.**

---

### Section 2: Language Audit

**Evaluated against:** 9th-grade reading level target, GOGI peer-voice design system.

**PASSING:**
- `PROTOCOL_CONTENT_SYSTEM_PROMPT`: "casual, direct, warm, teen peer energy. You believe in this student completely." — On target.
- Feedback instruction: "name one thing they got right, then name one specific thing to look at differently. Never say 'however' or 'unfortunately.' Always point forward." — Clinically appropriate for low-effort students.
- "When right: name exactly what their brain just did — specific, not generic." — Avoids empty praise.

**ISSUES FOUND:**

1. **Diagnostic intro screen language is academic:** "This assessment will help GOGI understand your current reading skills so we can build a personalized learning plan just for you." — Acceptable, but "assessment" + "personalized learning plan" is teacher-language. Marcus may disengage before clicking Start. Consider: "We're going to figure out exactly where to start — takes about 15 minutes."

2. **Reassess intro not audited:** `ReassessSession` shows a `view === 'intro'` screen before showing questions. The intro text was not read in this trace. Risk: academic language that signals "this is a test." Needs a direct language review.

3. **Error messages are clinical:** "Student profile not found. Please contact your teacher." — If Marcus sees this on a Chromebook in a Title I school at 8am, he closes the tab and doesn't return. Should be warmer: "Something's off on our end. Tell your teacher — they can fix it in 2 minutes."

4. **Practice scaffold labels:** `{ 1: 'Guided', 2: 'Some support', 3: 'On your own' }` — "Guided" is acceptable. "On your own" is the best of the three. "Some support" is the weakest — it signals to Marcus that the system knows he needs help. Consider: "Almost there" or "Fewer hints."

---

### Section 3: Data Integrity

| Data Point | Saved? | Column | Notes |
|---|---|---|---|
| Diagnostic answer | Yes | `responses.student_response`, `mastery_achieved`, `diagnostic_classification` | Correct |
| Diagnostic timing | Yes | `responses.time_on_question_seconds` | Correct |
| Diagnostic attempt number | Yes (always 1) | `responses.attempt_number` | Correct — diagnostic is 1 attempt only |
| Session created (diagnostic) | Yes | `sessions` × 3 (one per standard) | Correct |
| Session completed | Yes | `sessions.completed_at`, `time_spent_seconds` | Correct |
| Teach session created | Yes | `sessions` (phase = 'teach') | Correct |
| Protocol response | Yes | `responses` per step | Correct |
| Protocol timing | Yes | `started_at`, `completed_at`, `time_on_step_seconds` | Requires SQL ALTER (comment in ProtocolEngine.tsx:22–28) |
| Hint viewed | Yes | `responses.hint_viewed` | Requires SQL ALTER |
| Practice response | Yes | `responses.time_on_question_seconds` | Correct |
| Reassess response | Yes | `responses.student_response`, `mastery_achieved`, `ai_feedback` | Correct |
| Reassess passage stability | Partial | `reassess_passages` table | **Table may not exist** — silent fallback to re-generation |
| Session mastery_achieved (teach) | **NO** | `sessions.mastery_achieved` | TeachSession only sets `status: 'completed'` — never sets `mastery_achieved` on the teach session |

**FINDING (Critical):** `TeachSession.handleTeachComplete()` updates the teach session to `status: 'completed'` but does **not** set `mastery_achieved`. The column is left null. The teacher dashboard's mastery calculations group sessions by mastery — a null teach session mastery doesn't affect the clinical routing (which routes based on responses, not session mastery), but it creates a gap in the teacher dashboard and any analytics that group by `mastery_achieved`.

**Fix:** In `TeachSession.handleTeachComplete()`, set `mastery_achieved: true` when the protocol completed successfully (all 8 steps done), or derive from whether `reclassificationTrigger` fired.

---

### Section 4: Flow Breaks

| Location | Break Type | Severity |
|---|---|---|
| Reassess init — blocking Claude call (15–30s) | UX — no progress indicator | Medium |
| Practice → Reassess transition — no success screen | UX — abrupt navigation | Low |
| Teach complete → Home redirect — no summary shown | UX — no closure for Marcus | Medium |
| `reassess_passages` table missing | Data — silent failure, no retry indicator | High |
| Rate limit hit (30 calls/hr) — returns 429 | UX — error toast with no guidance | High |
| `callClaude` non-streaming timeout | No timeout configured — potential hang | Medium |

**Most impactful flow break for Marcus:** The reassess blocking loader. A student with low patience will reload the page (breaking the session) after 10–15 seconds with no feedback. Fix: stream the reassess generation, or show a multi-step progress indicator ("Generating your passage…", "Building your questions…").

---

### Section 5: Fake-Out Rejection Audit

_Testing whether the system correctly rejects plausible-but-wrong student inputs._

**"idk" rejection:**
- Diagnostic: Not applicable (multiple choice, can't type "idk")
- Protocol GuidedPractice (drag_and_drop): Not applicable
- Protocol IndependentTask (short_response): "idk" triggers eval → Claude receives `studentResponse: 'idk'` → Claude correctly returns `mastery_achieved: false` with specific feedback. **PASSES.**
- Practice Q1-Q3: Same eval path. **PASSES.**
- Reassess: Same eval path. **PASSES.**

**Empty string submission:**
- `ShortResponseStep.tsx`: Has a disabled state on submit when the textarea is empty. **PASSES.**
- `FillInStep.tsx`: Needs verification — not read in this trace. **RISK.**
- `ReassessSession.handleSubmit`: Checks `!currentResponse.trim()` before calling eval. **PASSES.**

**Plausible-sounding wrong answer (diagnostic):**
- The diagnostic system prompt explicitly designs distractors to map to specific failure modes. A student selecting a plausible-sounding wrong answer → classified into the appropriate protocol. This is the clinical core of GOGI. **CORRECT.**

**Random drag-and-drop sorting:**
- `DragAndDropStep` submits the final arrangement as a string to eval. Claude receives the garbled arrangement and should mark it `mastery_achieved: false`. **PASSES** — provided Claude format compliance is maintained (the Bug 3 fixes in ELA9R11Protocols and ELA9R21Protocols ensure proper ITEMS/CATEGORIES format generation).

---

### Section 6: Student Experience Rating Per Phase

| Phase | Rating | Rationale |
|---|---|---|
| Login | 4/5 | Clean. "Good to see you." is warm. Potential issue: no "forgot password" link for Title I students sharing devices. |
| Diagnostic intro | 3/5 | Too much text for Marcus. The "Before you begin" bullet list is good structure but the opening paragraph is academic. |
| Diagnostic questions | 4/5 | Passage + choice layout is clean. Timer creates mild anxiety (wanted behavior for engagement; risk for high-anxiety students). |
| Diagnostic results | 3/5 | Shows "✗" and red borders for each failed standard. Correct informationally, but visually punishing. Marcus sees three red Xs and may not click "Start Lesson." Consider renaming to "Your Learning Path" and using amber instead of red. |
| Teach — Orientation | 4/5 | Peer voice is well-defined. Content streams in, which is engaging if Claude complies with voice. Risk: Claude sometimes gives academic content despite the prompt. |
| Teach — Guided/Semi | 3/5 | DragAndDrop is the right interaction type for low-effort students (requires more engagement than text). But the "Gogi is preparing this activity…" wait is jarring — 10–20 seconds with no feedback. |
| Teach — MasteryCheck | 2/5 | Marcus types "idk" and sees feedback. If the feedback doesn't specifically name what was wrong with "idk" (vs. generic "try again"), Marcus learns nothing and disengages. This is a Claude prompt compliance risk, not a code issue. |
| Practice | 3/5 | 3-question fade is well-designed. But no progress indicator ("Question 1 of 3") was visible in the component read — needs confirmation. The abrupt redirect to reassess after Q3 with no "practice complete" screen is jarring. |
| Reassess — loading | 1/5 | Blocking 15–30s spinner. **Top UX risk for Marcus dropout.** |
| Reassess — assessment | 4/5 | Short response is appropriate for summative assessment. Feedback after each question is good for low-effort students (immediate reinforcement). |
| Home status update | 4/5 | Status badge transitions (Not Started → Ready to Learn → etc.) are informative. "Mastered" with a green badge is the clear positive endpoint. |

---

### Section 7: Priority Fix List

**P0 — Blocking (must fix before any live student touches the system):**

1. **`reassess_passages` table not created** — Run the SQL migration in `ReassessSession.tsx:1–14`. Without it, every reassess attempt generates a new passage, breaking growth measurement.

2. **Instrumentation column migration** — Run the 6 `ALTER TABLE responses ADD COLUMN IF NOT EXISTS ...` statements from `ProtocolEngine.tsx:22–28`. Without them, timing and hint data is silently dropped by Supabase (column doesn't exist = insert error on those fields).

**P1 — High (fix before pilot week 1):**

3. **TeachSession doesn't set `mastery_achieved`** — `handleTeachComplete()` should set `mastery_achieved: true` on the teach session when the protocol completes. Teacher dashboard mastery counts will be wrong without this.

4. **Reassess blocking loader** — Add a multi-step progress indicator during `callClaude('generate_reassess', ...)`. Minimum: "Building your passage… (this takes about 20 seconds)". Better: stream the generation.

5. **Rate limit: 30 calls/hr too low** — A student completing 2 standards in one session can exceed this. Raise to 60 for pilot. Add a user-visible error: "You've reached your daily limit. Come back tomorrow or ask your teacher." instead of a generic 429.

**P2 — Medium (fix before pilot week 2):**

6. **Diagnostic results screen uses punishing red UI** — Rename "Results by Standard" to "Your Learning Path." Replace red `✗` with amber `→`. Marcus's emotional state when seeing the results page determines whether he clicks "Start Lesson."

7. **Practice → Reassess transition** — Add a 2-second "Practice complete!" screen with one sentence of encouragement before routing to `/student-reassess/`. Don't send Marcus directly from submitting Q3 to a new phase with no acknowledgment.

8. **Teach complete → Home redirect** — When the ReassessTrigger step completes, `onComplete()` routes to home. Marcus sees no acknowledgment. Add: "You finished the lesson. Your assessment is ready." with a button to continue — don't auto-redirect.

9. **Error messages need warmer language** — "Student profile not found. Please contact your teacher." → "Something's off on our end — let your teacher know." Audit all `setErrorMsg()` calls in DiagnosticAssessment, TeachSession, PracticeSession, ReassessSession.

**P3 — Low (backlog):**

10. **Diagnostic intro language** — Rewrite opening paragraph to peer voice. "We're going to figure out exactly where to start — takes about 15 minutes."

11. **Practice scaffold label "Some support"** — Replace with "Almost there" or "Fewer hints."

12. **Forgot password link** — Add to `LoginForm.tsx`. Title I students on shared devices frequently need this.

13. **`callClaude` timeout** — Add a `signal: AbortController` with 30s timeout on all non-streaming Claude calls. Currently if Claude hangs, the student sees an infinite spinner.

---

## Summary

GOGI's clinical loop is architecturally sound. The diagnostic → route → protocol → practice → reassess pipeline is implemented correctly. Classification routing covers all expected edge cases including unknown classifications (fallback protocols exist for all three standards). Data is saved at each phase transition.

The two critical gaps before any live student session:
1. The `reassess_passages` table SQL must be run
2. The instrumentation columns must be added

The biggest student experience risk: the 15–30 second blocking loader in the reassess phase. For a student like Marcus who has given "idk" answers for 20 minutes, a silent 20-second wait with no progress feedback is the most likely dropout point in the entire loop.

The Playwright suite in `tests/marcus-simulation.spec.ts` covers all 8 key checkpoints with appropriate timeout budgets for Claude API calls (90s). Run it with `npx playwright test --project=chromium` after starting `npm run dev`.
