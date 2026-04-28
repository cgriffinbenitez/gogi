// ─── Primitive layer assignments ──────────────────────────────────────────────
//
// Layer assignments are clinically deliberate — not taxonomic labels.
//   Layer 1 (schema / metacognitive): student never engages the text
//   Layer 2 (language access): student is blocked at word or sentence level
//   Layer 3 (reading construction): student decodes but cannot build higher-order meaning
//
// Do NOT change a layer value without re-auditing questions for that
// classification and updating the corresponding prompt guidance.

export interface PrimitiveMapping {
  layer:       1 | 2 | 3;
  description: string;
}

export const PRIMITIVE_MAP: Record<string, PrimitiveMapping> = {
  // Layer 3 — Core reading construction skills
  inferencing:                      { layer: 3, description: 'Student cannot construct implied meaning from textual clues' },
  evidence_retrieval_failure:        { layer: 3, description: 'Student cannot locate specific textual support for a claim' },
  tone_misreading:                   { layer: 3, description: "Student misreads the author's implied emotional register" },
  mood_misreading:                   { layer: 3, description: 'Student misreads the emotional atmosphere of a passage' },
  figurative_language_failure:       { layer: 3, description: 'Student reads figurative language literally' },
  comprehension_integration_failure: { layer: 3, description: 'Student cannot synthesize information across passage segments' },
  topic_vs_theme_confusion:          { layer: 3, description: 'Student confuses topic (subject) with thematic claim (meaning)' },
  structure_purpose_disconnect:      { layer: 3, description: "Student cannot identify structural pattern or author's purpose" },
  // Layer 2 — Language access prerequisites
  vocabulary_gap:                    { layer: 2, description: 'Student blocked by unfamiliar Tier 2 academic vocabulary' },
  morphology_gap:                    { layer: 2, description: 'Student cannot decode unfamiliar word via morphemic analysis' },
  syntax_barrier:                    { layer: 2, description: 'Student cannot parse a complex sentence structure' },
  // Layer 1 — Schema / metacognitive prerequisites
  schema_strategy_missing:           { layer: 1, description: 'Student lacks activatable background knowledge to approach the text' },
  no_metacognitive_strategy:         { layer: 1, description: 'Student has no comprehension-monitoring or repair strategy' },
};

/**
 * Build a pre-shuffled correct-slot sequence guaranteeing exact A/B/C/D balance.
 *
 * For n passages: base = floor(n/4). Each slot gets `base` copies; the first
 * `remainder` slots (A, B, C, D in order) each get one extra. Example:
 *   n=4  → A=1, B=1, C=1, D=1 (shuffled)
 *   n=5  → A=2, B=1, C=1, D=1 (shuffled)
 *   n=50 → A=13, B=13, C=12, D=12 (shuffled)
 */
export function buildSlotSequence(n: number): Array<'A' | 'B' | 'C' | 'D'> {
  const base      = Math.floor(n / 4);
  const remainder = n % 4;
  const seq: Array<'A' | 'B' | 'C' | 'D'> = [];
  (['A', 'B', 'C', 'D'] as const).forEach((slot, idx) => {
    const count = base + (idx < remainder ? 1 : 0);
    for (let k = 0; k < count; k++) seq.push(slot);
  });
  // Fisher-Yates shuffle
  for (let j = seq.length - 1; j > 0; j--) {
    const k = Math.floor(Math.random() * (j + 1));
    [seq[j], seq[k]] = [seq[k], seq[j]];
  }
  return seq;
}

/**
 * Validate that each wrong-answer slot's classification maps to its pre-assigned layer.
 * Returns violation strings (empty = all good). Called by promotePassagesToQuestions.ts
 * before every insert; a non-empty result drops the question and logs to
 * .promotion-violations.log.
 *
 * @param options         Option objects from the OMC response (keys a/b/c/d lower-case)
 * @param correctOption   Which slot holds the correct answer (upper-case)
 * @param slotAssignments Map from slot letter (A/B/C/D) to expected layer (1|2|3)
 */
export function checkLayerViolations(
  options: Record<'a' | 'b' | 'c' | 'd', { text: string; classification: string }>,
  correctOption: 'A' | 'B' | 'C' | 'D',
  slotAssignments: Record<string, 1 | 2 | 3>,
): string[] {
  const violations: string[] = [];
  for (const opt of ['A', 'B', 'C', 'D'] as const) {
    if (opt === correctOption) continue;
    const cls      = options[opt.toLowerCase() as 'a' | 'b' | 'c' | 'd'].classification;
    const expected = slotAssignments[opt];
    const actual   = PRIMITIVE_MAP[cls]?.layer;
    if (actual !== expected) {
      violations.push(`option_${opt}: expected L${expected}, got "${cls}" (L${actual ?? '?'})`);
    }
  }
  return violations;
}
