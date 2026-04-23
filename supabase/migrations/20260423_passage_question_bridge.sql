-- Passage-to-Question Promotion Bridge
-- Adds question_generated tracking to intervention_passages so that
-- promotePassagesToQuestions.ts can mark a passage as processed and
-- avoid regenerating questions from the same source passage on re-runs.

ALTER TABLE intervention_passages
  ADD COLUMN IF NOT EXISTS question_generated boolean DEFAULT false;

-- Composite index for the promotion queue query:
-- approval_status = 'approved' AND pipeline_version IN ('v3','v4')
-- AND question_generated IS NOT TRUE, ordered oldest-first.
CREATE INDEX IF NOT EXISTS idx_passages_promotion_queue
  ON intervention_passages (created_at ASC)
  WHERE approval_status = 'approved'
    AND pipeline_version IN ('v3', 'v4')
    AND question_generated IS NOT TRUE;

COMMENT ON COLUMN intervention_passages.question_generated IS
  'Set to TRUE by promotePassagesToQuestions.ts after a row is successfully '
  'inserted into the questions table from this passage. Prevents re-promotion '
  'on subsequent runs. Non-fatal write: if the update fails after a successful '
  'question insert, the script logs a warning — the question exists and a manual '
  're-run will find the passage already has a corresponding question.';
