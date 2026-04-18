/**
 * getTeachRoute — maps a diagnostic classification string to the corresponding
 * teach route segment. Single source of truth used by bridge, practice,
 * reclassify, and dashboard.
 *
 * Sprint O — 13 canonical codes, 12 teach screens.
 * Default fallback: 'vocabulary' (safe catch-all — never produces a 404)
 */

/**
 * CLASSIFICATION_TO_SKILL — maps a diagnostic classification to the
 * cognitive_skill_targeted value stored in the questions table.
 * Used by practice/page.tsx to pull questions matched to the student's
 * specific breakdown, not random questions from the standard.
 *
 * Default fallback: 'characterization → layers of meaning'
 */
export const CLASSIFICATION_TO_SKILL: Record<string, string> = {
  vocabulary_gap:                    'diction → style',
  morphology_gap:                    'diction → style',
  syntax_barrier:                    'diction → style',
  figurative_language_failure:       'figurative language → meaning',
  mood_misreading:                   'setting → mood',
  tone_misreading:                   'tone → author attitude',
  inferencing_literal:               'author purpose → Layer 4',
  inferencing_schema:                'author purpose → Layer 4',
  inferencing_wm:                    'characterization → layers of meaning',
  evidence_retrieval_failure:        'characterization → layers of meaning',
  comprehension_integration_failure: 'author purpose → Layer 4',
  no_metacognitive_strategy:         'characterization → POV',
  topic_vs_theme_confusion:          'author purpose → Layer 4',
  structure_purpose_disconnect:      'author purpose → Layer 4',
};

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
