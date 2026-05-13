// ─── Shared types for the intervention passage pipeline ───────────────────────

/** Simple (legacy) tier signal — a single description string. */
export type TierSignalSimple = string;

/** Rich tier signal — structured object with identifying features and thresholds. */
export interface TierSignalRich {
  name: string;
  description: string;
  identifyingFeatures: string[];
  thresholds: {
    signalDistribution: string;
    syntaxComplexity: string;
    vocabularyAccessibility: string;
    cognitiveDemand: string;
  };
  exampleDescription?: string;
  distinctFromT1?: string;
  distinctFromT2?: string;
  distinctFromT3?: string;
  distinctFromT4?: string;
  useCase?: string;
}

export interface CriteriaConfig {
  classification: string;
  targetSkill: string;
  mustHave: string[];
  mustNotHave: string[];
  /**
   * tierSignals can be either:
   * - Simple strings (legacy format, word-count-primary tier assignment)
   * - Rich objects (structured format, literary-difficulty-primary assignment)
   * Use hasRichTierSignals() in tag.ts to distinguish.
   */
  tierSignals: {
    tier1: TierSignalSimple | TierSignalRich;
    tier2: TierSignalSimple | TierSignalRich;
    tier3: TierSignalSimple | TierSignalRich;
    tier4?: TierSignalSimple | TierSignalRich;
  };
  /** Constrained vocabulary for canonical_answer. Empty = unconstrained. */
  canonicalVocabulary?: string[];
}

export interface SourceConfig {
  gutendexSearchTerms: string[];
  priorityAuthors: string[];
  officialOnly?: boolean;
  officialGutenbergSeeds?: Array<{
    gutenbergId: number;
    title: string;
    author: string;
    year?: number | null;
    sectionStart?: string;
    sectionEnd?: string;
  }>;
  maxFilterCallsPerBook?: number; // Phase 1 budget cap: max Claude filter calls per book (default 250, hard ceiling 1000)
  stopLossMinFilterCalls?: number; // minimum filter calls before no-yield stop-loss can fire
  stopLossMaxZeroSuitableCalls?: number; // stop filtering a book after this many calls with zero suitable passages
  stopLossMinYieldPct?: number; // after min calls, stop a book if suitable/calls falls below this percentage
  maxApprovedPerAuthor?: number; // diversity cap: max pending_review+approved rows per author per classification
  maxApprovedPerBook?: number; // diversity cap: max pending_review+approved rows per Gutenberg book per classification
  maxApprovedPerRun?: number; // diversity cap: max inserts in a single pipeline run
  /** Optional combined author caps — e.g. cap Austen+Dickens at 3 inserted total. */
  authorGroupCaps?: Array<{
    authors: string[]; // display-name format ("Jane Austen") — matched loosely
    maxInserted: number;
  }>;
  /**
   * Cumulative per-tier harvest targets (across all runs).
   * Pipeline rejects candidates for a tier once its target is reached.
   * Defaults: T1=30, T2=35, T3=30, T4=20 if omitted.
   */
  tierTargets?: { T1?: number; T2?: number; T3?: number; T4?: number };
}

export interface GutendexAuthor {
  name: string;
  birth_year: number | null;
  death_year: number | null;
}

export interface GutendexBook {
  id: number;
  title: string;
  authors: GutendexAuthor[];
  subjects: string[];
  formats: Record<string, string>;
  download_count: number;
}

export interface GutendexResponse {
  count: number;
  next: string | null;
  results: GutendexBook[];
}

export interface FetchedBook {
  gutenbergId: number;
  title: string;
  author: string;
  year: number | null;
  text: string;
}

export interface Paragraph {
  text: string;
  wordCount: number;
  /** Number of source paragraphs in this unit (1 for T1, 2-3 for T2/T3, 3-5 for T4). */
  paragraphCount: number;
  sourceTitle: string;
  sourceAuthor: string;
  sourceYear: number | null;
  gutenbergId: number;
  hash: string;
}

/** Tier keys used during pool-build phase. */
export type TierKey = 'T1' | 'T2' | 'T3' | 'T4';

export interface FilterResult {
  suitable: boolean;
  reasoning: string;
  // v2 diagnostic fields
  q1?: 'pass' | 'fail';
  q2?: 'pass' | 'fail';
  q3?: 'pass' | 'fail';
  q4?: 'pass' | 'fail';
  schemaFlags?: string[];
  // v3 Q5 fields
  q5?: 'pass' | 'fail';
  q5_patterns_supported?: string[];
  q5_flag_5e_compatible?: boolean;
  evidence_preview?: {
    pointable_target_supporting: string[];
    pointable_non_supporting: string[];
  };
}

/**
 * @deprecated Use TagResultV3 for new pipeline runs. This interface is kept
 * for backwards compatibility with v2 rows and review CLI display.
 */
export interface TagResult {
  canonical_answer: string;
  distractors: string[];
  keyword_flags: string[];
  difficulty_tier: 1 | 2 | 3;
}

/** v3 tag output — richer evidence structure + tier assignment. */
export interface TagResultV3 {
  target_signal: string;
  item_patterns_supported: string[];
  supporting_evidence: Array<{ element: string; rationale: string }>;
  non_supporting_evidence: Array<{ element: string; rationale: string }>;
  dominant_concept?: string;
  plausible_distractors?: string[];
  craft_features?: Array<{ type: string; location: string; description: string }>;
  discrimination_item_type: 'phrase_level' | 'sentence_level' | 'paragraph_level';
  intervention_tier: 1 | 2 | 3 | 4;
  tier_rationale: string;
}

/** Returned by tagParagraph when the model signals the target skill is not present. */
export interface TagNotDetected {
  targetNotDetected: true;
  reason: string;
}

/** v2 passage row — written by v2 pipeline. Old columns kept. */
export interface PassageRow {
  classification: string;
  paragraph_text: string;
  word_count: number;
  source: string;
  source_title: string | null;
  source_author: string | null;
  source_year: number | null;
  source_gutenberg_id: number;
  canonical_answer: string;
  distractors: string[];
  keyword_flags: string[];
  difficulty_tier: number;
  approved: boolean;
  paragraph_hash: string;
}

/** v3 passage row — written by v3 pipeline. Old v2 columns left null in DB. */
export interface PassageRowV3 {
  classification: string;
  standard_code?: string | null;
  coverage_strand_id?: string | null;
  coverage_strand_label?: string | null;
  coverage_strand_signals?: string[] | null;
  paragraph_text: string;
  word_count: number;
  paragraph_count: number;
  source: string;
  source_title: string | null;
  source_author: string | null;
  source_year: number | null;
  source_gutenberg_id: number;
  approved: boolean;
  paragraph_hash: string;
  pipeline_version: 'v3' | 'v4';
  // v3 evidence fields
  target_signal: string;
  item_patterns_supported: string[];
  supporting_evidence: Array<{ element: string; rationale: string }>;
  non_supporting_evidence: Array<{ element: string; rationale: string }>;
  dominant_concept: string | null;
  plausible_distractors: string[] | null;
  craft_features: Array<{ type: string; location: string; description: string }> | null;
  discrimination_item_type: 'phrase_level' | 'sentence_level' | 'paragraph_level';
  intervention_tier: number;
  tagger_tier: number | null;
  word_count_tier: number | null;
  tier_rationale: string;
  q5_flag_5e_compatible: boolean;
  approval_status: 'pending_review' | 'approved' | 'rejected';
}

export type WriteStatus = 'inserted' | 'duplicate' | 'updated_existing' | 'error';

export interface WriteResult {
  status: WriteStatus;
  error?: string;
}

export interface CSVRow {
  classification: string;
  gutenberg_id: number;
  title: string;
  author: string;
  paragraph_text: string;
  word_count: number;
  paragraph_count?: number;
  suitable: boolean;
  reasoning: string;
  canonical_answer: string;
  distractors: string;
  keyword_flags: string;
  difficulty_tier: number | '';
  tier?: number | '';
  pipeline_version?: string;
  status: string;
}

export interface PipelineOptions {
  classification: string;
  standardCode?: string;
  coverageStrandId?: string;
  coverageStrandLabel?: string;
  coverageSignals?: string[];
  max: number;
  maxBooks: number;
  dryRun: boolean;
  writeAllPassed: boolean;
  expandBeyondOfficial?: boolean;
  perSourceCapOverride?: number;
}
