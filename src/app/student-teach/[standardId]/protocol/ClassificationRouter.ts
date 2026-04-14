// ClassificationRouter.ts
// Maps diagnostic_classification from responses table → protocol name
// This is the clinical routing spine of GOGI's Teach phase

export type ProtocolName =
  | 'ThemeConceptBuilding'
  | 'ThemeHuntingStrategy'
  | 'ConnotativeLanguage'
  | 'AbstractionLadder'
  | 'ThemeEvidenceMapping'
  | 'LiteraryAnalysisParagraph'
  | 'GenericTeach' // fallback for unclassified or non-theme standards

export type StandardCode =
  | 'ELA.9.R.1.2'
  | 'ELA.9.R.1.1'
  | 'ELA.9.R.2.1'

const THEME_ROUTING_MAP: Record<string, ProtocolName> = {
  // Layer 1 — Pre-reading failures
  schema_deficit:              'ThemeConceptBuilding',
  topic_only:                  'ThemeConceptBuilding',
  no_metacognitive_strategy:   'ThemeHuntingStrategy',

  // Layer 2 — During-reading failures
  vocabulary_gap_connotative:  'ConnotativeLanguage',
  vocabulary_gap:              'ConnotativeLanguage',

  // Layer 3 — After-reading failures
  abstract_reasoning_deficit:  'AbstractionLadder',
  inferencing_deficit:         'AbstractionLadder',
  no_evidence:                 'ThemeEvidenceMapping',
  evidence_retrieval_failure:  'ThemeEvidenceMapping',
  no_reasoning:                'LiteraryAnalysisParagraph',
  comprehension_integration_failure: 'LiteraryAnalysisParagraph',
  summary_instead_of_analysis: 'LiteraryAnalysisParagraph',
}

export function routeToProtocol(
  standardCode: StandardCode,
  diagnosticClassification: string | null | undefined
): ProtocolName {
  if (standardCode !== 'ELA.9.R.1.2') {
    // Other standards use GenericTeach until their protocols are built
    return 'GenericTeach'
  }

  if (!diagnosticClassification) {
    // No classification recorded — default to concept building
    // This is the most common root cause for theme failures
    return 'ThemeConceptBuilding'
  }

  const normalized = diagnosticClassification.toLowerCase().trim()
  return THEME_ROUTING_MAP[normalized] ?? 'ThemeConceptBuilding'
}

// Returns a human-readable label for logging and teacher dashboard
export function getProtocolLabel(protocol: ProtocolName): string {
  const labels: Record<ProtocolName, string> = {
    ThemeConceptBuilding:      'Theme Concept-Building',
    ThemeHuntingStrategy:      'Theme-Hunting Strategy',
    ConnotativeLanguage:       'Connotative Language',
    AbstractionLadder:         'Abstraction Ladder',
    ThemeEvidenceMapping:      'Theme-Evidence Mapping',
    LiteraryAnalysisParagraph: 'Literary Analysis Paragraph',
    GenericTeach:              'General Teach',
  }
  return labels[protocol]
}
