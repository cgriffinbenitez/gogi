-- Pipeline v3 column additions to intervention_passages
-- Old v2 columns are preserved (canonical_answer, distractors, keyword_flags,
-- difficulty_tier remain for backward compatibility with existing rows).
-- New v3 rows are identified by pipeline_version = 'v3'.

ALTER TABLE intervention_passages
  ADD COLUMN IF NOT EXISTS target_signal              text,
  ADD COLUMN IF NOT EXISTS item_patterns_supported    text[],
  ADD COLUMN IF NOT EXISTS supporting_evidence        jsonb,
  ADD COLUMN IF NOT EXISTS non_supporting_evidence    jsonb,
  ADD COLUMN IF NOT EXISTS dominant_concept           text,
  ADD COLUMN IF NOT EXISTS plausible_distractors      text[],
  ADD COLUMN IF NOT EXISTS craft_features             jsonb,
  ADD COLUMN IF NOT EXISTS discrimination_item_type   text,
  ADD COLUMN IF NOT EXISTS intervention_tier          integer CHECK (intervention_tier BETWEEN 1 AND 4),
  ADD COLUMN IF NOT EXISTS tier_rationale             text,
  ADD COLUMN IF NOT EXISTS pipeline_version           text DEFAULT 'v2',
  ADD COLUMN IF NOT EXISTS q5_flag_5e_compatible      boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS paragraph_count            integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS approval_status            text DEFAULT 'pending_review'
                             CHECK (approval_status IN ('pending_review', 'approved', 'rejected'));

-- Fast teach-page lookup: passages by classification + tier (approved only)
CREATE INDEX IF NOT EXISTS idx_passages_tier_class
  ON intervention_passages (classification, intervention_tier, approved)
  WHERE approved = true;

-- Back-fill existing v2 rows so pipeline_version is explicit
UPDATE intervention_passages
  SET pipeline_version = 'v2'
  WHERE pipeline_version IS NULL;

-- Back-fill existing v2 rows as approved (already clinically reviewed under v2)
UPDATE intervention_passages
  SET approval_status = 'approved'
  WHERE approval_status IS NULL OR approval_status = 'pending_review';
