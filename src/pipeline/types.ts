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
  sourceTitle: string;
  sourceAuthor: string;
  sourceYear: number | null;
  gutenbergId: number;
  hash: string;
}

export interface FilterResult {
  suitable: boolean;
  reasoning: string;
}

export interface TagResult {
  canonical_answer: string;
  distractors: string[];
  keyword_flags: string[];
  difficulty_tier: 1 | 2 | 3;
}

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
  suitable: boolean;
  reasoning: string;
  canonical_answer: string;
  distractors: string;
  keyword_flags: string;
  difficulty_tier: number | '';
  status: string;
}

export interface PipelineOptions {
  classification: string;
  max: number;
  dryRun: boolean;
}
