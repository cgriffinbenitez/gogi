-- Gutenberg standard-first coverage metadata.
-- These columns let harvested passages retain the exact FAST standard strand
-- they were gathered for, instead of only storing broad internal classifications.

ALTER TABLE intervention_passages
  ADD COLUMN IF NOT EXISTS standard_code text,
  ADD COLUMN IF NOT EXISTS coverage_strand_id text,
  ADD COLUMN IF NOT EXISTS coverage_strand_label text,
  ADD COLUMN IF NOT EXISTS coverage_strand_signals text[];

CREATE INDEX IF NOT EXISTS idx_intervention_passages_standard_strand
  ON intervention_passages (standard_code, coverage_strand_id, approval_status);

