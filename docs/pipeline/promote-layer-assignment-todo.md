# TODO: Pre-Assigned L1/L2/L3 Distractor Slots

**File:** `scripts/promotePassagesToQuestions.ts`
**Priority:** High — blocks full diagnostic triage accuracy
**Status:** Open (identified 2026-04-27 after tone_misreading regen)

---

## Problem

The current prompt says "LAYER DIVERSITY IS REQUIRED — exactly one L1, one L2,
one L3 distractor per question" but Claude ignores this constraint 100% of the
time on tone_misreading passages.

Audit result (50 questions, 2026-04-27):
- Full L1+L2+L3 coverage: **0/50 (0%)**
- Dominant pattern: all three wrong answers are L3 (tone_misreading,
  mood_misreading, inferencing, figurative_language_failure)

Root cause: Claude treats tone questions as exclusively L3 territory because
tone IS a L3 skill. When asked to *choose* which layer each distractor
represents, it consistently chooses L3 for all three. The prompt cannot
override this judgment.

---

## Fix: Pre-Assign Layer Slots Structurally

Before each API call, randomly assign which wrong-answer slots (the three
options that are NOT `correctOptionTarget`) map to L1, L2, and L3.
Pass the assignment to Claude in the variable block. Remove Claude's choice
entirely — it fills content, not layer.

### Implementation sketch

In `main()`, after generating `correctOptionTarget`:

```typescript
const opts = ['A', 'B', 'C', 'D'] as const;
const wrongOpts = opts.filter(o => o !== correctOptionTarget);
// Shuffle wrongOpts to randomize which slot gets which layer
const shuffled = wrongOpts.sort(() => Math.random() - 0.5);
const layerAssignment: Record<string, 1 | 2 | 3> = {
  [shuffled[0]]: 1,
  [shuffled[1]]: 2,
  [shuffled[2]]: 3,
};
```

In `buildVariableBlock()`, add a `layerAssignment` parameter and inject:

```
DISTRACTOR SLOT ASSIGNMENT (required — do not change these):
  Option A: Layer ${layerAssignment['A']} distractor
  Option B: Layer ${layerAssignment['B']} distractor  (or "CORRECT")
  Option C: Layer ${layerAssignment['C']} distractor  (or "CORRECT")
  Option D: Layer ${layerAssignment['D']} distractor

Layer 1 = schema or metacognitive failure
Layer 2 = language access failure (vocabulary, morphology, or syntax)
Layer 3 = reading construction failure (inferencing, evidence, tone, mood, etc.)
```

In `validateOMC()`, add layer-assignment verification:
- Extract the layer for each wrong option from `layerAssignment`
- Check that the distractor classification matches the assigned layer
- Hard error (not warning) if mismatched

In `warnDuplicateDistractors()`, this will become unnecessary once slot
assignment is enforced — keep as a secondary check but it should never fire.

### Output format change

No change needed — `option_a.classification` etc. remain the same fields.
The enforcement is on the *input* side (what Claude is told to produce)
and the *validation* side (checking what it returned).

---

## Expected outcome

- Full L1+L2+L3 coverage: 50/50 (100%) — structurally guaranteed
- Duplicate distractor class: 0/50 — structurally impossible
- No prompt iteration required — the constraint is mechanical, not instructional

---

## Context

- Prompt improvements from 2026-04-27 session that ARE working:
  - B/C correct option distribution: 28/22 (was 49/1) ✅
  - All-same distractor class eliminated: 0/50 (was 0/50, already 0) ✅
  - Duplicate distractor class reduced: 3/50 (was 9/50) ✅
  - Student-facing language accessibility: stems <30w, choices <20w ✅
  - Accessibility gate (vocabulary_pre_teach, schema_pre_activate): working ✅
- Layer coverage is the one remaining structural gap

## Related files

- `scripts/promotePassagesToQuestions.ts` — promotion bridge
- `src/pipeline/types.ts` — OMCResponse interface (no change needed here)
