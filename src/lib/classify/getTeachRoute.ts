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
  element_not_identified:            'characterization → layers of meaning',
  element_misidentified:             'characterization → layers of meaning',
  function_not_explained:            'characterization → layers of meaning',
  effect_confused_with_summary:      'author purpose → Layer 4',
  meaning_connection_missing:        'author purpose → Layer 4',
  style_connection_missing:          'author purpose → Layer 4',
  evidence_irrelevant:               'characterization → layers of meaning',
  evidence_too_general:              'characterization → layers of meaning',
  evidence_misread:                  'characterization → layers of meaning',
  quote_without_function:            'characterization → layers of meaning',
  analysis_too_vague:                'characterization → layers of meaning',
  literal_reading_only:              'author purpose → Layer 4',
  theme_element_confusion:           'author purpose → Layer 4',
  tone_mood_confusion:               'setting → mood',
  point_of_view_effect_missing:      'characterization → POV',
  figurative_language_effect_missing:'figurative language → meaning',
  structure_effect_missing:          'author purpose → Layer 4',
};

export function getTeachRoute(classification: string): string {
  const routes: Record<string, string> = {
    // ── Layer 1 — Pre-reading ──────────────────────────────────────────────
    no_metacognitive_strategy:           'strategy',
    schema_deficit:                      'schema',

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

    // ── ELA.9.R.1.1 Card 11 misconception taxonomy ────────────────────────
    element_not_identified:               'ela9r11',
    element_misidentified:                'ela9r11',
    function_not_explained:               'ela9r11',
    effect_confused_with_summary:         'ela9r11',
    meaning_connection_missing:           'ela9r11',
    style_connection_missing:             'ela9r11',
    evidence_irrelevant:                  'ela9r11',
    evidence_too_general:                 'ela9r11',
    evidence_misread:                     'ela9r11',
    quote_without_function:               'ela9r11',
    analysis_too_vague:                   'ela9r11',
    literal_reading_only:                 'ela9r11',
    theme_element_confusion:              'ela9r11',
    tone_mood_confusion:                  'ela9r11',
    point_of_view_effect_missing:         'ela9r11',
    figurative_language_effect_missing:   'ela9r11',
    structure_effect_missing:             'ela9r11',

    // ── Special — mastery shortcut ─────────────────────────────────────────
    CORRECT:                             'practice',
  };
  return routes[classification] ?? 'vocabulary';
}
