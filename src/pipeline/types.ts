// ─── Shared types for the intervention passage pipeline ───────────────────────

export interface CriteriaConfig {
  classification: string;
  targetSkill: string;
  mustHave: string[];
  mustNotHave: string[];
  tierSignals: {
    tier1: string;
    tier2: string;
    tier3: string;
  };
  /** Constrained vocabulary for canonical_answer. Empty = unconstrained. */
  canonicalVocabulary?: string[];
}

export interface SourceConfig {
  gutendexSearchTerms: string[];
  priorityAuthors: string[];
  /** Optional combined author caps — e.g. cap Austen+Dickens at 3 inserted total. */
  authorGroupCaps?: Array<{
    authors: string[];    // display-name format ("Jane Austen") — matched loosely
    maxInserted: number;
  }>;
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
  tier_rationale: string;
  q5_flag_5e_compatible: boolean;
  approval_status: 'pending_review' | 'approved' | 'rejected';
}

export type WriteStatus = 'inserted' | 'duplicate' | 'error';

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
  max: number;
  dryRun: boolean;
  perSourceCapOverride?: number;
}
