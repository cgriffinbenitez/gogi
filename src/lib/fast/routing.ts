const SIGNAL_TO_STANDARD: Record<string, string> = {
  figurative_language_failure: 'ELA.9.R.3.1',
  mood_misreading: 'ELA.9.R.3.1',
  tone_misreading: 'ELA.9.R.1.1',
  inferencing_literal: 'ELA.9.R.1.1',
  inferencing_schema: 'ELA.9.R.1.1',
  topic_vs_theme_confusion: 'ELA.9.R.1.2',
  evidence_retrieval_failure: 'ELA.9.R.2.2',
  comprehension_integration_failure: 'ELA.9.R.2.2',
  vocabulary_gap: 'ELA.9.V.1.3',
  morphology_gap: 'ELA.9.V.1.2',
  structure_purpose_disconnect: 'ELA.9.R.2.1',
  no_metacognitive_strategy: 'ELA.9.R.2.1',
  syntax_barrier: 'ELA.9.R.2.1',
};

export function getFastRecommendedStandardCode(primarySignalCode: string | null | undefined) {
  return SIGNAL_TO_STANDARD[primarySignalCode ?? ''] ?? 'ELA.9.R.1.1';
}

export function standardCodeToRouteId(standardCode: string) {
  return standardCode.replace(/\./g, '-');
}
