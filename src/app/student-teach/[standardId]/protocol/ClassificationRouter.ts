// ClassificationRouter.ts
// Maps diagnostic_classification from responses table → protocol name
// This is the clinical routing spine of GOGI's Teach phase

export type ProtocolName =
  // ELA.9.R.1.2 — Universal Themes
  | 'ThemeConceptBuilding'
  | 'ThemeHuntingStrategy'
  | 'ConnotativeLanguage'
  | 'AbstractionLadder'
  | 'ThemeEvidenceMapping'
  | 'LiteraryAnalysisParagraph'
  // ELA.9.R.1.1 — Inferencing and Textual Evidence
  | 'WorkingMemoryOverload'
  | 'ReadingStrategyFailure'
  | 'SituationModelFailure'
  | 'VocabularyGap'
  // ELA.9.R.2.1 — Text Structure and Purpose
  | 'DefaultListStrategy'
  | 'ChunkingFailure'
  | 'MainIdeaExtractionFailure'
  | 'TextTypeDiscriminationFailure'
  | 'SyntaxComprehensionFailure'
  | 'GenericTeach' // fallback for unclassified or non-targeted standards

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

const INFERENCING_ROUTING_MAP: Record<string, ProtocolName> = {
  // Layer 1 — Pre-reading / strategy failures
  no_metacognitive_strategy:           'ReadingStrategyFailure',

  // Layer 2 — During-reading / vocabulary failures
  vocabulary_gap:                      'VocabularyGap',
  vocabulary_gap_connotative:          'VocabularyGap',
  morphology_gap:                      'VocabularyGap',
  syntax_barrier:                      'VocabularyGap',

  // Layer 3 — After-reading / integration failures
  comprehension_integration_failure:   'WorkingMemoryOverload',
  evidence_retrieval_failure:          'WorkingMemoryOverload',
  inferencing_deficit:                 'SituationModelFailure',
  abstract_reasoning_deficit:          'SituationModelFailure',
  schema_deficit:                      'SituationModelFailure',
}

const TEXT_STRUCTURE_ROUTING_MAP: Record<string, ProtocolName> = {
  // Layer 1 — Pre-reading / schema and strategy failures
  schema_deficit:                      'DefaultListStrategy',
  no_metacognitive_strategy:           'DefaultListStrategy',

  // Layer 2 — During-reading / syntax and vocabulary failures
  syntax_barrier:                      'SyntaxComprehensionFailure',
  morphology_gap:                      'SyntaxComprehensionFailure',
  vocabulary_gap:                      'SyntaxComprehensionFailure',
  vocabulary_gap_connotative:          'TextTypeDiscriminationFailure',

  // Layer 3 — After-reading / integration and abstraction failures
  comprehension_integration_failure:   'ChunkingFailure',
  evidence_retrieval_failure:          'TextTypeDiscriminationFailure',
  inferencing_deficit:                 'MainIdeaExtractionFailure',
  abstract_reasoning_deficit:          'MainIdeaExtractionFailure',
}

export function routeToProtocol(
  standardCode: StandardCode,
  diagnosticClassification: string | null | undefined
): ProtocolName {
  const normalized = diagnosticClassification?.toLowerCase().trim() ?? ''

  if (standardCode === 'ELA.9.R.1.2') {
    if (!normalized) return 'ThemeConceptBuilding'
    return THEME_ROUTING_MAP[normalized] ?? 'ThemeConceptBuilding'
  }

  if (standardCode === 'ELA.9.R.1.1') {
    if (!normalized) return 'SituationModelFailure'
    return INFERENCING_ROUTING_MAP[normalized] ?? 'SituationModelFailure'
  }

  if (standardCode === 'ELA.9.R.2.1') {
    if (!normalized) return 'DefaultListStrategy'
    return TEXT_STRUCTURE_ROUTING_MAP[normalized] ?? 'DefaultListStrategy'
  }

  return 'GenericTeach'
}

// Returns a human-readable label for logging and teacher dashboard
export function getProtocolLabel(protocol: ProtocolName): string {
  const labels: Record<ProtocolName, string> = {
    // ELA.9.R.1.2
    ThemeConceptBuilding:      'Theme Concept-Building',
    ThemeHuntingStrategy:      'Theme-Hunting Strategy',
    ConnotativeLanguage:       'Connotative Language',
    AbstractionLadder:         'Abstraction Ladder',
    ThemeEvidenceMapping:      'Theme-Evidence Mapping',
    LiteraryAnalysisParagraph: 'Literary Analysis Paragraph',
    // ELA.9.R.1.1
    WorkingMemoryOverload:          'Working Memory Overload',
    ReadingStrategyFailure:         'Reading Strategy Failure',
    SituationModelFailure:          'Situation Model Failure',
    VocabularyGap:                  'Vocabulary Gap',
    // ELA.9.R.2.1
    DefaultListStrategy:            'Default List Strategy',
    ChunkingFailure:                'Chunking Failure',
    MainIdeaExtractionFailure:      'Main Idea Extraction Failure',
    TextTypeDiscriminationFailure:  'Text Type Discrimination Failure',
    SyntaxComprehensionFailure:     'Syntax Comprehension Failure',
    // Fallback
    GenericTeach:                   'General Teach',
  }
  return labels[protocol]
}
