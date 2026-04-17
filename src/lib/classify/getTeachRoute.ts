/**
 * getTeachRoute — maps a diagnostic classification string to the corresponding
 * teach route segment. Single source of truth used by bridge, practice,
 * reclassify, and dashboard.
 *
 * Default fallback: 'vocabulary' (safe catch-all — never produces a 404)
 */
export function getTeachRoute(classification: string): string {
  const routes: Record<string, string> = {
    // Layer 1 — Pre-reading
    schema_deficit:                      'schema',
    no_metacognitive_strategy:           'strategy',
    no_theme_schema:                     'schema',
    no_struct_schema:                    'schema',
    // Layer 2 — During reading
    vocabulary_gap:                      'vocabulary',
    morphology_gap:                      'morphology',
    syntax_barrier:                      'morphology',
    signal_word_blind:                   'morphology',
    // Layer 3 — After reading
    inferencing_deficit:                 'inferencing',
    abstract_reasoning_deficit:          'inferencing',
    theme_confusion:                     'inferencing',
    literal_misreading:                  'inferencing',
    concrete_thinking:                   'inferencing',
    evidence_retrieval_failure:          'evidence',
    theme_evidence_disconnection:        'evidence',
    comprehension_integration_failure:   'synthesis',
    purpose_failure:                     'synthesis',
    // Edge cases — should never reach routing but handled defensively
    CORRECT:                             'vocabulary',
  };
  return routes[classification] ?? 'vocabulary';
}
