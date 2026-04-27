# Teach Pages Comparative Audit

**Files audited:** `src/app/standard/[standardId]/teach/*/page.tsx` (13 pages)
**Date:** 2026-04-19
**Scope:** Read-only. No files modified.

**Reference file read:** `src/hooks/useTriggerQuestion.ts` — queries `responses` for `diagnostic_classification` match, falls back to `sessions.diagnostic_question_ids[0]`. Passes classification code directly as a WHERE filter, so an invalid code causes the query to return null and always triggers the fallback.

**Canonical classification codes (from `getTeachRoute.ts`):**
```
no_metacognitive_strategy         → strategy
vocabulary_gap                    → vocabulary
morphology_gap                    → morphology
syntax_barrier                    → morphology
figurative_language_failure       → figurative
mood_misreading                   → mood
tone_misreading                   → tone
inferencing_literal               → inferencing
inferencing_schema                → inferencing
inferencing_wm                    → inferencing
topic_vs_theme_confusion          → theme-builder
evidence_retrieval_failure        → evidence
structure_purpose_disconnect      → structure-purpose
comprehension_integration_failure → synthesis
```

Note: `schema_deficit` and `inferencing_deficit` are NOT in `getTeachRoute.ts`. They are phantom codes.

---

## Page 1 — strategy/page.tsx

| Check | Answer |
|---|---|
| 1. Classification code(s) this page handles | `no_metacognitive_strategy` |
| 2. `useTriggerQuestion` — valid canonical code? | **YES** — passes `'no_metacognitive_strategy'` (line 144) |
| 3. Branches content by specific classification? | **NO** — single code maps here; no branching |
| 4. Unique passages student can see | **Unlimited** — pulled from DB via trigger question |
| 5. Name the Move → Model → Guided Try structure? | **PARTIAL** — 4-step SOAPSTone card sequence (PREVIEW → PURPOSE → ANNOTATE → PAUSE AND CHECK). Steps are sequential with unlock. No Gogi modeling of the strategy applied to a specific passage moment. |
| 6. Named move with strategy pill/heading? | **YES** — "4-STEP TEXT ATTACK STRATEGY \| SOAPSTone Model" heading |
| 7. Worked example where Gogi models the move? | **NO** — no completed example shown; student encounters the strategy framework with no anchor |
| 8. Student interaction type | **Free-text** — 2 short text inputs (Step 1) + 1 textarea (Step 2) + 3 text inputs (Step 3) + 1 textarea (Step 4) |
| 9. Unique Gogi coaching lines | **4** — 3 session-dependent variants (via `getSessionMsg`) + 1 fixed bubble |
| 10. Writes to Supabase on completion? | **YES** — `responses` table via `/api/responses/create`; `cognitive_skill_targeted: 'metacognitive_strategy'`, `intervention_type: 'strategy_card'` |
| 11. `session_id` silently dropped if init fails? | **YES** — `if (sessionId && studentId && standardUuid)` guard; silent skip if any are empty |
| 12. `console.log` logging student IDs / response data? | **YES** — 5 statements: `authLoading`, `user.id`, `resolvedStudentId`, `triggerQ`, `passageLoading/loadTimeout` |

---

## Page 2 — schema/page.tsx

| Check | Answer |
|---|---|
| 1. Classification code(s) this page handles | **NONE via getTeachRoute** — `schema_deficit` is not a canonical code and `schema/` does not appear in the routing table. This page is unreachable from `getTeachRoute()`. |
| 2. `useTriggerQuestion` — valid canonical code? | **NO** — passes `'schema_deficit'` (line 150); this code does not exist in `getTeachRoute.ts` or in the diagnostic classifier. Query always returns null; hook always falls back to `diagnostic_question_ids[0]`. |
| 3. Branches content by specific classification? | **NO** |
| 4. Unique passages student can see | **1 (always fallback)** — wrong classification code means trigger response query always fails; passage is always first question from the diagnostic |
| 5. Name the Move → Model → Guided Try structure? | **NO** — 3 free-text prompts (Prior Knowledge → World Connection → Bridge to Text). No named strategy move, no Gogi modeling. This is a schema-activation exercise, not a skill teach. |
| 6. Named move with strategy pill/heading? | **NO** — "SCHEMA BUILDING — 3 PROMPTS" heading only; no named cognitive move |
| 7. Worked example where Gogi models the move? | **NO** |
| 8. Student interaction type | **Free-text** — 3 textareas, each requiring ≥25 words and ≥2 sentences (local `validatePromptResponse`) |
| 9. Unique Gogi coaching lines | **4** — 3 session-dependent variants + 1 fixed bubble |
| 10. Writes to Supabase on completion? | **YES** — `responses` table; `cognitive_skill_targeted: 'schema_building'`, `intervention_type: 'schema_prompts'` |
| 11. `session_id` silently dropped if init fails? | **YES** |
| 12. `console.log` logging student IDs / response data? | **YES** — 5 statements |

> **Critical issue:** This page is unreachable via `getTeachRoute()`. No canonical classification code routes to `'schema'`. The `reclassify/page.tsx` PLAIN_NAMES map includes `schema_deficit` but `getTeachRoute` has no such entry, so clicking "Continue" from reclassify with `toCls=schema_deficit` produces `getTeachRoute('schema_deficit') → 'vocabulary'` (default fallback), not `'schema'`.

---

## Page 3 — vocabulary/page.tsx

| Check | Answer |
|---|---|
| 1. Classification code(s) this page handles | `vocabulary_gap`, `morphology_gap`, `syntax_barrier` (all route here) |
| 2. `useTriggerQuestion` — valid canonical code? | **YES (dynamic)** — passes `classification` state (line 106), initialized to `'vocabulary_gap'`, updated from `session.dominant_classification`. All three codes that route here are canonical. |
| 3. Branches content by specific classification? | **PARTIAL** — reads `dominant_classification` from the session and passes it to `useTriggerQuestion`, so the blocking word and passage context will differ per classification. But the Frayer model UI structure is identical regardless. Gogi bubble 1 includes the blocking word dynamically. |
| 4. Unique passages student can see | **Unlimited** — derived from DB trigger question for the specific classification |
| 5. Name the Move → Model → Guided Try structure? | **PARTIAL** — Frayer model: Definition (given) → In This Passage (context sentence) → Real-World Example (given) → In Your Own Words (student writes). This approximates a model → try structure but lacks an explicit "Name the Move" instructional step. |
| 6. Named move with strategy pill/heading? | **YES** — "VOCABULARY INTERVENTION — FRAYER MODEL"; the target word is displayed as a large styled heading; "FRAYER MODEL" is a named framework |
| 7. Worked example where Gogi models the move? | **PARTIAL** — the definition, passage sentence, and real-world example are AI-generated (via `getDefinition()`), not human-authored. They serve as a model but are derived from the specific blocking word, not a Gogi-narrated worked example. |
| 8. Student interaction type | **Free-text** — single textarea ("In Your Own Words", ≥5 words) |
| 9. Unique Gogi coaching lines | **2** — 1 dynamic (names the blocking word if available) + 1 fixed |
| 10. Writes to Supabase on completion? | **YES** — `responses` table; `cognitive_skill_targeted: 'vocabulary'`, `intervention_type: 'vocabulary_frayer'` |
| 11. `session_id` silently dropped if init fails? | **YES** |
| 12. `console.log` logging student IDs / response data? | **YES** — 5 statements |

---

## Page 4 — morphology/page.tsx

| Check | Answer |
|---|---|
| 1. Classification code(s) this page handles | `morphology_gap`, `syntax_barrier` (both route here) |
| 2. `useTriggerQuestion` — valid canonical code? | **NO (partial)** — passes `'morphology_gap'` (line 159) only. Does not differentiate `syntax_barrier`. A student routed here via `syntax_barrier` will have the query look for `diagnostic_classification = 'morphology_gap'` responses, which won't exist — falling back to `diagnostic_question_ids[0]`. |
| 3. Branches content by specific classification? | **NO** — `syntax_barrier` and `morphology_gap` see identical content |
| 4. Unique passages student can see | **Unlimited for `morphology_gap`; 1 (fallback) for `syntax_barrier`** |
| 5. Name the Move → Model → Guided Try structure? | **YES** — "THE WORD IN THE PASSAGE" (Name the Move — here's the blocking word and its definition) → 3 morpheme boxes + reconstructed meaning (student does the analysis) → "PRACTICE — Break these words the same way" (Guided Try on 2 additional words from `keyword_flags`). Clear three-part scaffold. |
| 6. Named move with strategy pill/heading? | **YES** — "MORPHEME BREAKDOWN" heading; "THE WORD IN THE PASSAGE" named section; PREFIX + ROOT + SUFFIX boxes labeled |
| 7. Worked example where Gogi models the move? | **PARTIAL** — the target word analysis is student-guided (student fills in the morpheme boxes themselves), not a pre-completed worked example. The definition is AI-fetched. No completed example row shown before the student tries. |
| 8. Student interaction type | **Mixed** — morpheme boxes are structured text inputs (PREFIX/ROOT/SUFFIX), meaning fields are textareas. Neither pure chip-tap nor pure free-text. |
| 9. Unique Gogi coaching lines | **4** — 3 session-dependent variants + 1 fixed bubble |
| 10. Writes to Supabase on completion? | **YES** — `responses` table; `cognitive_skill_targeted: 'morphological_awareness'`, `intervention_type: 'morphology_breakdown'` |
| 11. `session_id` silently dropped if init fails? | **YES** |
| 12. `console.log` logging student IDs / response data? | **YES** — 5 statements |

---

## Page 5 — figurative/page.tsx

| Check | Answer |
|---|---|
| 1. Classification code(s) this page handles | `figurative_language_failure` |
| 2. `useTriggerQuestion` — valid canonical code? | **YES** — passes `'figurative_language_failure'` (line 82) |
| 3. Branches content by specific classification? | **NO** — single code; but `detectFigureType(passageText)` dynamically identifies simile/metaphor/personification from the actual passage text |
| 4. Unique passages student can see | **Unlimited** — passage from DB; figure type and quote derived dynamically |
| 5. Name the Move → Model → Guided Try structure? | **YES** — Step 1: THE FIGURE (identify and name the figure type with pill badge, show the quote, explain figurative ≠ literal) = Name the Move; Step 2: DECODE THE FIGURE (cloze: "This [type] compares ___ to ___ in order to suggest that: [textarea]") = Guided Try; Step 3: WHY DID THE AUTHOR USE THIS FIGURE? (MC) = Verification |
| 6. Named move with strategy pill/heading? | **YES** — `figureType` displayed as a blue pill badge (dynamically detected from passage: simile, metaphor, personification, etc.) |
| 7. Worked example where Gogi models the move? | **NO** — no completed example before student attempts decode. Gogi explains the concept ("figurative language says one thing but means something deeper") but never models the decode on a separate example. |
| 8. Student interaction type | **Mixed** — 2 inline text inputs (cloze: "from the passage…") with passage-verification on blur + 1 free-text textarea + MC chip tap |
| 9. Unique Gogi coaching lines | **2** — 1 fixed opening + 1 that appears after `step2Done` |
| 10. Writes to Supabase on completion? | **YES** — `responses` table; `cognitive_skill_targeted: 'figurative_language'`, `intervention_type: 'figurative_3step'` |
| 11. `session_id` silently dropped if init fails? | **YES** |
| 12. `console.log` logging student IDs / response data? | **NO** — only `console.error` in catch blocks |

---

## Page 6 — mood/page.tsx

| Check | Answer |
|---|---|
| 1. Classification code(s) this page handles | `mood_misreading` |
| 2. `useTriggerQuestion` — valid canonical code? | **YES** — passes `'mood_misreading'` (line 45) |
| 3. Branches content by specific classification? | **NO** — single code |
| 4. Unique passages student can see | **Unlimited** — passage from DB with highlighted ranges via `findHighlightRanges(passageText, 'mood')` |
| 5. Name the Move → Model → Guided Try structure? | **YES** — Step 1: MOOD vs CHARACTER EMOTION (2-panel contrast card: NOT MOOD ✗ / MOOD ✓ with hardcoded examples, button "I see the difference") = Name the Move; Step 2: WHAT MOOD DOES THIS PASSAGE CREATE? (chip select 12-word bank + cloze frame quoting from passage + textarea) = Guided Try; Step 3: MC VERIFY (dynamic options embed selected mood word) = Verification |
| 6. Named move with strategy pill/heading? | **YES** — hardcoded contrast card labels "NOT MOOD ✗" / "MOOD ✓"; 12-chip mood word bank |
| 7. Worked example where Gogi models the move? | **PARTIAL** — Step 1 shows hardcoded examples ("Rainsford felt terrified" = NOT MOOD; "The author's word choices create a feeling of dread" = MOOD). These are concept examples, not a worked example applied to the DB-pulled passage. |
| 8. Student interaction type | **Mixed** — chip tap (12 mood words), inline text inputs (quote from passage, passage-verified on blur), textarea (reasoning), MC tap |
| 9. Unique Gogi coaching lines | **2** — 1 fixed opening + 1 after `step2Done` |
| 10. Writes to Supabase on completion? | **YES** — `responses` table; `cognitive_skill_targeted: 'mood_identification'`, `intervention_type: 'mood_chip_evidence'` |
| 11. `session_id` silently dropped if init fails? | **YES** |
| 12. `console.log` logging student IDs / response data? | **NO** — only `console.error` in catch block |

---

## Page 7 — tone/page.tsx

| Check | Answer |
|---|---|
| 1. Classification code(s) this page handles | `tone_misreading` |
| 2. `useTriggerQuestion` — valid canonical code? | **YES** — passes `'tone_misreading'` (line 54) |
| 3. Branches content by specific classification? | **NO** — single code |
| 4. Unique passages student can see | **Unlimited** — passage from DB with highlighted ranges via `findHighlightRanges(passageText, 'tone')` |
| 5. Name the Move → Model → Guided Try structure? | **YES — strongest implementation** — Step 1: TONE vs MOOD vs CHARACTER EMOTION 3-column distinction table with hardcoded examples, button "I understand the difference" = Name the Move; Step 2: WHAT IS THE AUTHOR'S ATTITUDE? (chip select 12-word bank with inline definitions + cloze frame quoting passage + textarea) = Guided Try; Step 3: MC VERIFY (dynamic options embed selected tone word and student's own written text) = Verification |
| 6. Named move with strategy pill/heading? | **YES** — 3-row table (character emotion / mood / tone ✓) clearly differentiates the concept; 12-chip tone word bank, each chip shows definition on hover/select |
| 7. Worked example where Gogi models the move? | **PARTIAL** — Step 1 table has hardcoded passage examples ("Rainsford felt terrified" = character emotion; "The passage feels ominous" = mood; "The author treats Zaroff with contempt" = tone ✓). Concept examples, not a worked example on the DB-pulled passage. |
| 8. Student interaction type | **Mixed** — chip tap (12 tone words with definitions), inline text inputs (passage quotes, passage-verified on blur), textarea (author's belief), MC tap |
| 9. Unique Gogi coaching lines | **2** — 1 fixed opening + 1 after `step2Done` |
| 10. Writes to Supabase on completion? | **YES** — `responses` table; `cognitive_skill_targeted: 'tone_identification'`, `intervention_type: 'tone_distinction'` |
| 11. `session_id` silently dropped if init fails? | **YES** |
| 12. `console.log` logging student IDs / response data? | **NO** — only `console.error` in catch block |

---

## Page 8 — inferencing/page.tsx

| Check | Answer |
|---|---|
| 1. Classification code(s) this page handles | `inferencing_literal`, `inferencing_schema`, `inferencing_wm` (all three route here) |
| 2. `useTriggerQuestion` — valid canonical code? | **NO** — passes `'inferencing_deficit'` (line 122); this code does not exist in `getTeachRoute.ts` or the diagnostic classifier. The trigger query always returns null; the hook always falls back to `diagnostic_question_ids[0]`. |
| 3. Branches content by specific classification? | **NO** — all three inferencing codes receive identical content. No branching on literal vs. schema vs. working-memory failure. |
| 4. Unique passages student can see | **1 (always fallback)** — wrong classification code means trigger response query always fails |
| 5. Name the Move → Model → Guided Try structure? | **PARTIAL** — 3-step scaffold (WHAT THE TEXT SAYS → WHAT IT IMPLIES → HOW YOU KNOW) with a visual "THE MODEL" box. Implies a Name → Model → Try structure but no explicit Gogi narration of the model applied to the specific passage. The model box shows a hardcoded generic example. |
| 6. Named move with strategy pill/heading? | **PARTIAL** — "INFERENCING SCAFFOLD — 3 STEPS" heading; "Text → Inference → Evidence. Always in that order." tagline; no pill/badge per se |
| 7. Worked example where Gogi models the move? | **PARTIAL** — a "THE MODEL" box shows: TEXT SAYS: "Her hands trembled." → IMPLIES: She is afraid or nervous → PROOF: The trembling = physical reaction to fear. This IS a worked example but it is hardcoded and not anchored to the actual DB-pulled passage. |
| 8. Student interaction type | **Free-text** — 3 sequential textareas, each requiring ≥25 words + ≥2 sentence-ending punctuation marks (via `validateResponse`). No chips, no MC, no tap interaction. |
| 9. Unique Gogi coaching lines | **4** — 3 session-dependent variants + 1 fixed bubble |
| 10. Writes to Supabase on completion? | **YES** — `responses` table; `cognitive_skill_targeted: 'inferencing'`, `intervention_type: 'inferencing_scaffold'`; silent skip if `sessionId` is empty |
| 11. `session_id` silently dropped if init fails? | **YES** |
| 12. `console.log` logging student IDs / response data? | **YES** — 5 statements |

---

## Page 9 — theme-builder/page.tsx

| Check | Answer |
|---|---|
| 1. Classification code(s) this page handles | `topic_vs_theme_confusion` |
| 2. `useTriggerQuestion` — valid canonical code? | **YES** — passes `'topic_vs_theme_confusion'` (line 51) |
| 3. Branches content by specific classification? | **NO** — single code |
| 4. Unique passages student can see | **Unlimited** — passage from DB with highlighted ranges via `findHighlightRanges(passageText, 'theme')` |
| 5. Name the Move → Model → Guided Try structure? | **YES** — Step 1: TOPIC vs THEME distinction cards with 3 worked theme examples (Name the Move); Step 2: BUILD YOUR THEME STATEMENT — 3-field progressive cloze (topic → author's claim → universal blank ×3) with character-name validator (Guided Try); Step 3: MC VERIFY (options use student's actual topic string dynamically) = Verification |
| 6. Named move with strategy pill/heading? | **YES** — "TOPIC ✗" / "THEME ✓" contrast labels; cloze frame "[TOPIC] [BLANK 1] because [BLANK 2], which means that all people [BLANK 3]" makes the theme formula explicit; character name warning fires to enforce universality |
| 7. Worked example where Gogi models the move? | **YES** — Step 1 THEME ✓ card contains 3 complete theme statement examples: "Loyalty requires sacrifice from those who practice it." / "True friendship survives loss and the passage of time." / "Power corrupts those who believe they are above ordinary people." These are fully worked examples of the output format the student must produce. |
| 8. Student interaction type | **Mixed** — 1 short text input (topic), 4 textareas (claim + 3 blanks), MC chip tap; character name validator with inline advisory message; composed theme shown live after step2Done |
| 9. Unique Gogi coaching lines | **2** — 1 fixed opening + 1 after `step2Done` |
| 10. Writes to Supabase on completion? | **YES** — `responses` table; `cognitive_skill_targeted: 'theme_identification'`, `intervention_type: 'theme_builder'`; saves composed theme statement as `student_response` |
| 11. `session_id` silently dropped if init fails? | **YES** |
| 12. `console.log` logging student IDs / response data? | **NO** — only `console.error` in catch block |

---

## Page 10 — evidence/page.tsx

| Check | Answer |
|---|---|
| 1. Classification code(s) this page handles | `evidence_retrieval_failure` |
| 2. `useTriggerQuestion` — valid canonical code? | **YES** — passes `'evidence_retrieval_failure'` (line 87) |
| 3. Branches content by specific classification? | **NO** — single code |
| 4. Unique passages student can see | **Unlimited** — passage from DB (collapsible reference panel, not full-column display) |
| 5. Name the Move → Model → Guided Try structure? | **NO** — organizer table is shown directly; no explicit instruction on what evidence retrieval is or why it matters. The move is never named or taught. The table provides structure but not instruction. |
| 6. Named move with strategy pill/heading? | **NO** — "THEME-EVIDENCE MAPPING ORGANIZER" is a tool name, not a named cognitive move. Evidence retrieval as a skill is never defined. |
| 7. Worked example where Gogi models the move? | **YES** — "READ THIS EXAMPLE FIRST" row: "Sacrifice for love is the central theme." + "pennies saved one and two at a time…until one's cheeks burned" + "Della's public shame proves her love for Jim overrides her pride." This is a fully completed example row directly above the student's blank row. |
| 8. Student interaction type | **Free-text** — 3 textareas (claim, evidence quote, connection), each requiring `validateResponse` (≥25 words, ≥2 sentence punctuation). Note: the instruction says "Fill 2 rows minimum" but only 1 student row is rendered. |
| 9. Unique Gogi coaching lines | **4** — 3 session-dependent variants + 1 fixed bubble ("Column 3 is the most important. Don't skip it.") |
| 10. Writes to Supabase on completion? | **YES** — `responses` table; `cognitive_skill_targeted: 'evidence_retrieval'`, `intervention_type: 'evidence_organizer'` |
| 11. `session_id` silently dropped if init fails? | **YES** |
| 12. `console.log` logging student IDs / response data? | **YES** — 5 statements |

> **Secondary issue:** Gogi tells the student "Fill 2 rows minimum" but the UI only renders 1 student row. The `allValid` gate checks only the 3 fields for that one row.

---

## Page 11 — structure-purpose/page.tsx

| Check | Answer |
|---|---|
| 1. Classification code(s) this page handles | `structure_purpose_disconnect` |
| 2. `useTriggerQuestion` — valid canonical code? | **YES** — passes `'structure_purpose_disconnect'` (line 59) |
| 3. Branches content by specific classification? | **NO** — single code |
| 4. Unique passages student can see | **Unlimited** — passage from DB with highlighted ranges via `findHighlightRanges(passageText, 'structure')` |
| 5. Name the Move → Model → Guided Try structure? | **YES** — Step 1: SELECT THE STRUCTURE (6-chip bank with definitions + dynamic "WHAT THIS STRUCTURE DOES" explanation for selected chip) = Name the Move; Step 2: CONNECT STRUCTURE TO PURPOSE (2 cloze textareas: "helps reader understand:" / "…which supports the author's purpose of:") = Guided Try; Step 3: MC VERIFY (options embed student's structure choice and their actual written text) = Verification |
| 6. Named move with strategy pill/heading? | **YES** — 6 structure chips (Description / Problem-Solution / Chronological / Compare-Contrast / Cause-Effect / Sequence) each with a definition; "WHAT THIS STRUCTURE DOES" dynamic callout box appears after chip selection |
| 7. Worked example where Gogi models the move? | **NO** — the `STRUCTURE_EFFECT` map explains the selected structure type, but no completed structure-to-purpose analysis is shown as a worked example on a specific passage. |
| 8. Student interaction type | **Mixed** — chip tap (6 structure options with definitions), 2 free-text textareas, MC tap |
| 9. Unique Gogi coaching lines | **2** — 1 fixed opening + 1 after `step2Done` |
| 10. Writes to Supabase on completion? | **YES** — `responses` table; `cognitive_skill_targeted: 'structure_analysis'`, `intervention_type: 'structure_purpose'` |
| 11. `session_id` silently dropped if init fails? | **YES** |
| 12. `console.log` logging student IDs / response data? | **NO** — only `console.error` in catch block |

---

## Page 12 — synthesis/page.tsx

| Check | Answer |
|---|---|
| 1. Classification code(s) this page handles | `comprehension_integration_failure` |
| 2. `useTriggerQuestion` — valid canonical code? | **YES** — passes `'comprehension_integration_failure'` (line 141) |
| 3. Branches content by specific classification? | **NO** — single code |
| 4. Unique passages student can see | **Unlimited** — passage from DB (collapsible reference panel) |
| 5. Name the Move → Model → Guided Try structure? | **PARTIAL** — 5 sequentially-unlocked boxes with sentence starters (Universal theme → Literary element → Evidence → Analysis [KEY BOX] → Real-world connection). Box 4 (Analysis) is AI-graded on blur via `/api/vocab/define` endpoint with up to 3 attempts. The scaffold is ambitious but there is no explicit "Name the Move" instructional step; the student is dropped directly into the scaffold without explanation of what synthesis is. |
| 6. Named move with strategy pill/heading? | **PARTIAL** — "LITERARY ANALYSIS PARAGRAPH — 5 BOXES" heading; Box 4 labeled "KEY BOX". The 5-box structure is implicitly the named move but synthesis as a skill is never explicitly defined or contrasted against lesser approaches. |
| 7. Worked example where Gogi models the move? | **NO** — no completed 5-box paragraph is shown as a reference before the student writes |
| 8. Student interaction type | **Free-text** — 5 textareas with sentence starters, sequential unlock. Box 4 uniquely has AI grading on blur (up to 3 attempts, then passes through). |
| 9. Unique Gogi coaching lines | **4** — 3 session-dependent variants + 1 fixed ("Each box has a sentence starter. Use it.") |
| 10. Writes to Supabase on completion? | **YES** — `responses` table; `cognitive_skill_targeted: 'comprehension_integration'`, `intervention_type: 'synthesis_scaffold'` |
| 11. `session_id` silently dropped if init fails? | **YES** |
| 12. `console.log` logging student IDs / response data? | **YES** — 5 statements |

---

## Page 13 — reclassify/page.tsx

| Check | Answer |
|---|---|
| 1. Classification code(s) this page handles | **N/A** — bridge/transition screen. Reads `from` and `to` URL params, renders the reclassification story, then routes to `getTeachRoute(toCls)`. |
| 2. `useTriggerQuestion` — valid canonical code? | **N/A** — does not call `useTriggerQuestion` |
| 3. Branches content by specific classification? | **YES** — two distinct modes: `flagged=true` (teacher notification screen) vs. normal reclassification (turn log + new direction). Content in normal mode uses `from` and `to` params to show `plainName()` labels. |
| 4. Unique passages student can see | **N/A** — no passage. Transition screen only. |
| 5. Name the Move → Model → Guided Try structure? | **N/A** |
| 6. Named move with strategy pill/heading? | **N/A** |
| 7. Worked example? | **N/A** |
| 8. Student interaction type | **N/A** — single "Continue →" button that appears after a 2-second delay |
| 9. Unique Gogi coaching lines | **0** — `GogiAvatar` is displayed but no `GogiBubble` speech. No Gogi coaching text on this screen. |
| 10. Writes to Supabase on completion? | **NO** — read-only transition screen |
| 11. `session_id` silently dropped if init fails? | **N/A** |
| 12. `console.log` logging student IDs / response data? | **NO** |

> **Note:** `reclassify/page.tsx` contains a `PLAIN_NAMES` and `LAYER_NUM` map that includes `schema_deficit` and `inferencing_deficit` — neither of which exists in `getTeachRoute.ts`. If a reclassification with `toCls=schema_deficit` is triggered, `getTeachRoute('schema_deficit')` returns `'vocabulary'` (the default fallback), silently routing the student to the wrong teach page.

---

## Overall Pedagogical Ranking

Ranked from **most complete** to **furthest from target** based on: (1) Name the Move → Model → Guided Try three-part structure, (2) named move with strategy pill/heading, (3) worked example where Gogi models on a specific passage moment, (4) interactive tap/chip practice (cognitive sovereignty).

| Rank | Page | 3-Part Structure | Named Move | Worked Example | Chip/Tap Interaction | Notes |
|---|---|---|---|---|---|---|
| **1** | **theme-builder** | YES | YES | **YES** — 3 complete theme statement examples | Mixed | Strongest overall. Named move, 3 worked examples, cloze formula with character-name validator, MC with student's topic embedded. |
| **2** | **tone** | YES | YES | PARTIAL | Mixed | Strongest 3-way distinction table (character emotion / mood / tone). Chip bank with definitions, dynamic MC options. Best conceptual scaffolding. |
| **3** | **mood** | YES | YES | PARTIAL | Mixed | Structurally identical to tone. 2-way (not 3-way) distinction. Chip bank without definitions. Both mood and tone tie for second-best. |
| **4** | **morphology** | YES | YES | PARTIAL | Mixed | Clear 3-part scaffold (name word → break it down → apply to 2 practice words). DB-driven blocking word. Weakened by: no pre-completed worked example; morpheme boxes are still text inputs, not chips. |
| **5** | **figurative** | YES | YES — figure type pill | NO | Mixed | Figure type detected dynamically and displayed as pill. Cloze decode with passage-verification. No worked example shown before student attempts. |
| **6** | **structure-purpose** | YES | YES — 6 chips with definitions | NO | Mixed | Dynamic "WHAT THIS STRUCTURE DOES" callout for each selection. MC options embed student's own written responses. Weakened by: no worked example. |
| **7** | **vocabulary** | PARTIAL | YES — Frayer Model | PARTIAL — AI-generated | Free-text only | Dynamic blocking word drives content. AI definition + passage sentence serve as a model. Single textarea student output (≥5 words, weaker bar than other pages). |
| **8** | **inferencing** | PARTIAL | PARTIAL | PARTIAL — hardcoded, not on DB passage | Free-text only | Hardcoded "Her hands trembled" model box is the best worked example on the page but is not anchored to the DB-pulled passage. **Critical bug: wrong classification code `'inferencing_deficit'` means passage is always the fallback.** No chips, no MC. |
| **9** | **strategy** | PARTIAL | YES — SOAPSTone | NO | Free-text only | Named framework (SOAPSTone), 4-step sequential unlock. But the strategy is abstract — no anchor to a specific passage moment, no modeling, no verification step. |
| **10** | **synthesis** | PARTIAL | PARTIAL | NO | Free-text only | Most sophisticated grading mechanism (AI analysis check on Box 4, up to 3 attempts). But no worked example of a completed 5-box paragraph, no chips, synthesis as a skill never defined. |
| **11** | **evidence** | NO | NO | **YES** — Della/Jim example row | Free-text only | Paradox: only page with a fully worked example row ("READ THIS EXAMPLE FIRST") but no instruction on what evidence retrieval is or why it matters. Gogi says "Fill 2 rows minimum" but UI only renders 1 student row. |
| **12** | **schema** | NO | NO | NO | Free-text only | **Dead page — unreachable via `getTeachRoute()`**. `schema_deficit` is not a canonical classification code. No named move, no worked example, no chip interaction. 3 generic prior-knowledge prompts. |
| **13** | **reclassify** | N/A | N/A | N/A | N/A — button only | Not a teach page. Bridge/transition screen. Listed for completeness. Has a data integrity bug: its `PLAIN_NAMES` map includes `schema_deficit` and `inferencing_deficit`, both phantom codes that `getTeachRoute` doesn't know about. |

---

## Cross-Cutting Issues

### 1. Classification code bugs
Two pages call `useTriggerQuestion` with non-canonical codes:
- **`inferencing/page.tsx`** passes `'inferencing_deficit'` — not in `getTeachRoute.ts`. All three inferencing codes (`inferencing_literal`, `inferencing_schema`, `inferencing_wm`) see the same hardcoded generic passage.
- **`schema/page.tsx`** passes `'schema_deficit'` — not in `getTeachRoute.ts`. The schema page is also unreachable via the router. Both bugs cause the trigger query to always return null and fall back to `diagnostic_question_ids[0]`.

### 2. Silent session_id drop
**All 12 active teach pages** skip the Supabase write silently if `sessionId`, `studentId`, or `standardUuid` is empty. There is no error surface to the user and no retry logic. Student work during the teach phase is permanently lost if init fails.

### 3. console.log in production path
**7 pages** have 5-statement diagnostic traces logging `user.id` and `resolvedStudentId`:
strategy, schema, vocabulary, morphology, inferencing, evidence, synthesis.

Pages that do NOT log (cleaner): figurative, mood, tone, theme-builder, structure-purpose, reclassify.

### 4. Passage visibility
**5 pages** (strategy, schema, inferencing, evidence, synthesis) use a collapsible "Passage reference" panel in the left column — the passage is hidden by default. The student must click to reveal it. This is a cognitive load issue: the student must complete the right-panel scaffold without the passage in view by default.

**6 pages** (figurative, mood, tone, theme-builder, structure-purpose + morphology) use a dedicated left column (3-column layout) with the passage always visible and highlighted. This is pedagogically superior.

### 5. No MC verification on 6 pages
The following pages have **no MC verification step** — completion is gated only on free-text word count:
strategy, schema, vocabulary, morphology, inferencing, evidence, synthesis.

The following pages **do** have MC verification:
figurative, mood, tone, theme-builder, structure-purpose.

MC verification is a significant quality signal — it forces the student to confirm the concept before routing to practice, and the wrong-answer feedback scaffolds re-teaching inline.

### 6. Passage not always highlighted
Pages using `findHighlightRanges()` with a 3-column layout actively mark the relevant passage text:
figurative (`amber`), mood (`blue`), tone (`green`), theme-builder (`green`), structure-purpose (`amber`).

Pages without highlighting: strategy, schema, vocabulary, morphology, inferencing, evidence, synthesis. On these pages the student has no visual anchor in the passage to connect the teach content to the specific diagnostic failure moment.
