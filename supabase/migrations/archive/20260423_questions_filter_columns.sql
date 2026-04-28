-- Questions filter columns
-- Adds pipeline_source and source_classification to enable filter controls
-- and legacy question hiding on /admin/questions.
--
-- pipeline_source values:
--   'legacy'      — all existing rows (default); pre-v3 pipeline
--   'v3_promoted' — inserted by promotePassagesToQuestions.ts from intervention_passages
--
-- source_classification — stores the primitive code (e.g. 'tone_misreading') for
--   v3_promoted rows so the /admin/questions filter bar can filter by classification.

ALTER TABLE questions
  ADD COLUMN IF NOT EXISTS pipeline_source text DEFAULT 'legacy'
    CHECK (pipeline_source IN ('legacy', 'v3_promoted')),
  ADD COLUMN IF NOT EXISTS source_classification text;

-- Backfill: the 5 test-batch rows inserted on 2026-04-23 are all tone_misreading
UPDATE questions
  SET pipeline_source        = 'v3_promoted',
      source_classification  = 'tone_misreading'
  WHERE created_at::date = '2026-04-23';

-- Index for filter queries
CREATE INDEX IF NOT EXISTS idx_questions_source
  ON questions (pipeline_source, approved, flagged);

COMMENT ON COLUMN questions.pipeline_source IS
  'Provenance marker. ''legacy'' = pre-v3 pipeline. ''v3_promoted'' = inserted by '
  'promotePassagesToQuestions.ts from intervention_passages. Orthogonal to approved/flagged.';

COMMENT ON COLUMN questions.source_classification IS
  'For v3_promoted rows: the GOGI primitive classification code from the source passage '
  '(e.g. ''tone_misreading'', ''inferencing''). NULL for legacy rows.';
