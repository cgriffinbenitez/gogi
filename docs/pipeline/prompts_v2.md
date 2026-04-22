# GOGI Pipeline v2 — Accessibility-Hardened Prompts

**Status:** Locked April 22, 2026
**Supersedes:** v1 filter and tag prompts
**Reference:** /docs/pipeline/criteria_v2.md

Two prompt revisions that bake the v2 clinical criteria into the pipeline 
itself. Goal: schema-gated passages get rejected at filter stage, never 
reaching the clinical review queue.

## Filter Prompt (Stage 1 — accept/reject)

Called per candidate paragraph. Returns JSON with decision plus 
per-question diagnostic fields.

```
You are evaluating whether a paragraph is suitable as a GOGI intervention 
passage for the target classification: {CLASSIFICATION_CODE}.

A GOGI intervention passage must teach the target cognitive skill to a 
Title I 9th grade student. The passage must be directly accessible — the 
student must be able to detect the target skill signal using ONLY content 
present in the passage itself, plus universal human and social 
understanding.

SOURCE CONTEXT:
- Source title: {SOURCE_TITLE}
- Source author: {SOURCE_AUTHOR}
- Source year: {SOURCE_YEAR}

TARGET SKILL DEFINITION:
{CLASSIFICATION_DEFINITION}

CANONICAL VOCABULARY FOR THIS SKILL:
{CANONICAL_VOCABULARY}

PARAGRAPH TO EVALUATE:
"""
{PARAGRAPH_TEXT}
"""

Evaluate against all four clinical questions. The passage must pass ALL 
FOUR to be accepted.

Q1 — PRESENCE: Is the target skill signal present in this passage? Can 
the target cognitive phenomenon be named using the canonical vocabulary 
above? If no, reject.

Q2 — DOMINANCE: Is the target skill the dominant signal in this passage? 
The target skill must be the primary cognitive work, not a secondary 
feature beneath plot action, character emotion, description, or 
symbolism. If subordinate to another primitive, reject.

Q3 — ACCESSIBILITY (primary architectural criterion): Can a Title I 9th 
grader detect the target skill signal using ONLY content present in this 
passage plus universal human/social understanding?

REJECT if the target skill detection requires any of the following 
external schema:

- Specific historical events the reader must already know (French 
  Revolution, Civil War, specific wars, specific political movements) 
  UNLESS the event is named AND contextualized within the passage itself
- Named institutions requiring outside knowledge (Court of Chancery, 
  Parliament, specific legal or political systems, specific religious 
  institutions)
- Biblical, classical, or literary allusions UNLESS the allusion is 
  explained within the passage
- Named landmarks, monuments, or geographic references requiring outside 
  knowledge (Temple Bar, Canterbury, specific historical sites)
- Novel-level metaphors — symbols or motifs that only function if the 
  reader has read the entire source work (e.g., fog-as-legal-opacity in 
  Bleak House, whiteness-as-obsession in Moby Dick)
- Cultural registers or codes requiring period-specific social knowledge 
  (Victorian mourning conventions, Regency courtship rules, specific 
  class markers)
- Named historical figures the reader must already know and whose 
  symbolic weight carries the target skill

ACCEPT period-specific content IF AND ONLY IF the passage itself gives 
the reader what they need to read the target skill. Examples:

- ACCEPTABLE: period vocabulary (e.g., "needlework," "twelvemonth") 
  where context makes the meaning and tonal function clear
- ACCEPTABLE: period social dynamics (e.g., flattery met with 
  indifference, social pressure, familial obligation) where the dynamic 
  itself is universal
- ACCEPTABLE: period setting that is inferable or irrelevant to target 
  skill detection
- REJECT: period setting where the target skill detection DEPENDS on 
  knowing how the period worked

THE ACID TEST: If you were to hand this passage to a Title I 9th grader 
cold, with no pre-teaching and no context, could they detect the target 
skill using only what is written in the passage? If detection requires 
outside knowledge the student almost certainly does not have, REJECT.

When in doubt, REJECT. False negatives are recoverable. False positives 
contaminate training data.

Q4 — CLEAN ISOLATION: Does the passage isolate the target skill without 
heavy cognitive overload from other primitives (severe syntax barrier, 
dense unrelated figurative language, vocabulary density that would block 
access)? If the passage is cognitively overloaded, reject.

ADDITIONAL FORMAT EXCLUSIONS:
- REJECT play/drama dialogue format (paragraphs beginning with 
  "CHARACTER NAME." or "CHARACTER NAME:" patterns)
- REJECT verse/poetry when prose is expected
- REJECT biographical, memoir, or first-person nonfiction unless 
  explicitly permitted for this classification
- REJECT passages containing historically harmful racial, ethnic, or 
  gender language that would cause student harm in a Title I cohort 
  (regardless of historical context)

OUTPUT FORMAT (JSON):
{
  "decision": "YES" | "NO",
  "q1_presence": "pass" | "fail",
  "q2_dominance": "pass" | "fail",
  "q3_accessibility": "pass" | "fail",
  "q4_isolation": "pass" | "fail",
  "primary_rejection_reason": "<one-sentence reason if NO, else null>",
  "schema_dependency_flags": ["<list any external schema requirements 
    even if marginal>"],
  "clinical_notes": "<brief reasoning>"
}
```

## Tag Prompt (Stage 2 — generate canonical answer + distractors)

Only runs on passages that passed filter. Key change: null-escape hatch 
kills tag fabrication.

```
You are generating diagnostic assessment tags for a GOGI intervention 
passage that has passed filter. The passage teaches the target 
classification: {CLASSIFICATION_CODE}.

CANONICAL VOCABULARY FOR THIS SKILL (you MUST select the canonical_answer
from this list):
{CANONICAL_VOCABULARY}

PARAGRAPH:
"""
{PARAGRAPH_TEXT}
"""

Your task:

1. Select the canonical answer — the single most precise term from the 
   canonical vocabulary that names the target skill signal in this 
   passage.

2. Generate three plausible distractors — terms representing specific 
   cognitive errors a student might make when reading this passage.

3. Identify 3-5 keyword flags — specific phrases from the passage that 
   carry the target skill signal.

CRITICAL — NULL ESCAPE HATCH:

If after reading this passage you cannot confidently identify a clear, 
dominant target skill signal that maps to a specific canonical vocabulary 
term, return:

{
  "canonical_answer": "TARGET_NOT_DETECTED",
  "rejection_reason": "<why the passage does not actually carry the 
    target skill>"
}

DO NOT INVENT OR STRETCH to fit a canonical vocabulary term when the 
passage is primarily descriptive, mood-dominant, characterization-
dominant, or symbolically loaded without the target skill being present.

Passages that are rich in atmosphere or description but lack the target 
skill signal should return TARGET_NOT_DETECTED. This is better than 
fabricating a tag that the clinical reviewer will have to reject.

PRECISION REQUIREMENT:

When the target skill IS present, select the MOST PRECISE canonical 
vocabulary term, not the safest or most common. For example in a 
tone_misreading context:

- "detached" is more precise than "amused" for a passage showing 
  disengagement
- "wry" is more precise than "ironic" for gentle self-deprecation
- "mocking" is more precise than "critical" for overt ridicule

Use the canonical vocabulary at its full granularity. Do not default to 
the most common term when a more specific term fits.

DISTRACTOR DESIGN:

Each of the three distractors must represent a specific cognitive error:

- One distractor should capture a surface/literal misreading
- One distractor should capture a schema misactivation or over-projection
- One distractor should capture an emotional/mood confound

Each distractor must be from the canonical vocabulary or be a clinically 
adjacent term. Distractors should be plausible — a student reading 
carelessly should find them tempting.

OUTPUT FORMAT (JSON):
{
  "canonical_answer": "<term from canonical vocabulary>" | 
                      "TARGET_NOT_DETECTED",
  "distractors": ["<term>", "<term>", "<term>"],
  "keyword_flags": ["<phrase>", "<phrase>", "<phrase>"],
  "rejection_reason": "<only if TARGET_NOT_DETECTED>",
  "clinical_notes": "<brief reasoning>"
}
```

## Implementation Changes Required

1. **Filter prompt file update.** Locate current filter prompt file 
   (likely pipeline/filter.ts or similar). Replace prompt with v2 version 
   above. Inject SOURCE_TITLE, SOURCE_AUTHOR, SOURCE_YEAR from paragraph 
   metadata (already done for tone post-fix). Update response handling to 
   parse and log all four Q fields, schema_dependency_flags, 
   primary_rejection_reason, and clinical_notes.

2. **Tag prompt file update + escape hatch.** Tag prompt replaces current 
   version. Pipeline must handle canonical_answer === "TARGET_NOT_DETECTED":
   - Do NOT insert row into intervention_passages
   - Log rejection with rejection_reason to pipeline output
   - Increment rejected-at-tag-stage counter

3. **Dry-run validator.** New command that runs filter-only against 20 
   candidate paragraphs, reports YES rate, per-Q failure breakdown, 
   distribution of rejection reasons, does NOT write to DB. Sanity check 
   before real runs.

## Expected Yield Impact

- Filter YES rate: drop from ~19-20% (tone v1) to 8-15% (v2)
- Review-stage approval rate: rise from ~66% (tone v1) to 80-85% target
- Candidate paragraph volume per classification: rise from ~75-100 to 
  ~150-200
- Net: slightly higher API cost per pipeline run, fully offset by 
  reduced clinical review time

Lower YES rate with higher signal outperforms higher YES rate with more 
schema-gated noise.

## Change Log

- **v1** — April 20, 2026. Initial filter + tag prompts. Tuned 
  iteratively during mood (7 fixes: round-robin sampling, front-matter 
  stripping, biography filter, clinical exclusions, canonical vocab 
  constraint, biography mustNotHave, source context injection).
- **v2** — April 22, 2026. Accessibility criterion as primary filter 
  gate. Null-tone escape hatch at tag stage. Format exclusions expanded 
  (play dialogue, verse, deployment-harmful language). Dry-run validator 
  added.
