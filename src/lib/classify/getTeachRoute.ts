/**
 * getTeachRoute — maps a diagnostic classification string to the corresponding
 * teach route segment. Single source of truth used by bridge, practice,
 * reclassify, and dashboard.
 *
 * Sprint O — 13 canonical codes, 12 teach screens.
 * Default fallback: 'vocabulary' (safe catch-all — never produces a 404)
 */
export function getTeachRoute(classification: string): string {
  const routes: Record<string, string> = {
    // ── Layer 1 — Pre-reading ──────────────────────────────────────────────
    no_metacognitive_strategy:           'strategy',

    // ── Layer 2 — During reading ───────────────────────────────────────────
    vocabulary_gap:                      'vocabulary',
    morphology_gap:                      'morphology',
    syntax_barrier:                      'morphology',
    figurative_language_failure:         'figurative',

    // ── Layer 3 — After reading ────────────────────────────────────────────
    mood_misreading:                     'mood',
    tone_misreading:                     'tone',
    inferencing_literal:                 'inferencing',
    inferencing_schema:                  'inferencing',
    inferencing_wm:                      'inferencing',
    topic_vs_theme_confusion:            'theme-builder',
    evidence_retrieval_failure:          'evidence',
    structure_purpose_disconnect:        'structure-purpose',
    comprehension_integration_failure:   'synthesis',

    // ── Special — mastery shortcut ─────────────────────────────────────────
    CORRECT:                             'practice',
  };
  return routes[classification] ?? 'vocabulary';
}
