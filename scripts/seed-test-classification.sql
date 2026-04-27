-- =============================================================================
-- seed-test-classification.sql
-- Purpose: Insert a completed diagnostic session + 10 responses for
--          student1@gogi.pilot so you can test bridge routing and teach pages
--          without re-running the diagnostic.
-- =============================================================================
--
-- HOW TO RUN:
--   1. Open Supabase Dashboard → SQL Editor
--   2. Paste this entire file
--   3. Click "Run" — must be executed as postgres/service role so RLS is
--      bypassed on INSERT. The Supabase SQL Editor runs as service role by
--      default. Do NOT run via the anon/authenticated API.
--
-- HOW TO CHANGE THE TARGET CLASSIFICATION:
--   Edit the ONE line marked ★ CHANGE THIS LINE below.
--   Replace 'mood_misreading' with any canonical code from the list below.
--
-- CANONICAL CLASSIFICATION CODES:
--   Layer 1: no_metacognitive_strategy, schema_deficit
--   Layer 2: vocabulary_gap, morphology_gap, syntax_barrier,
--             figurative_language_failure
--   Layer 3: mood_misreading, tone_misreading, inferencing_literal,
--             inferencing_schema, inferencing_wm, topic_vs_theme_confusion,
--             evidence_retrieval_failure, structure_purpose_disconnect,
--             comprehension_integration_failure
--
-- WARNING — ADDITIVE, NOT IDEMPOTENT:
--   This script does NOT delete or overwrite previous sessions for student1.
--   It ADDS a new completed session. If the dashboard shows unexpected state,
--   the bridge page reads the most recent completed diagnostic session by
--   completed_at — the new row always wins. If you need a clean slate, delete
--   the rows manually from sessions / responses before re-running.
--
-- NOTE ON RLS:
--   Run this in the Supabase SQL Editor (service role). Do not call it from
--   the application — the anon key is subject to RLS and will be blocked.
-- =============================================================================

BEGIN;

DO $$
DECLARE
  -- ★ CHANGE THIS LINE to switch the target classification:
  v_classification  text := 'mood_misreading';

  -- Resolved at runtime — do not edit these
  v_student_id      uuid;
  v_standard_id     uuid;
  v_session_id      uuid;
  v_question_ids    uuid[];

BEGIN

  -- ── 1. Resolve student_id ──────────────────────────────────────────────────
  SELECT s.id
    INTO v_student_id
    FROM students s
    JOIN users u ON u.id = s.user_id
   WHERE u.email = 'student1@gogi.pilot'
   LIMIT 1;

  IF v_student_id IS NULL THEN
    RAISE EXCEPTION 'student1@gogi.pilot not found — verify users and students tables';
  END IF;

  -- ── 2. Resolve standard_id ─────────────────────────────────────────────────
  SELECT id
    INTO v_standard_id
    FROM standards
   WHERE code = 'ELA.9.R.1.1'
   LIMIT 1;

  IF v_standard_id IS NULL THEN
    RAISE EXCEPTION 'Standard ELA.9.R.1.1 not found — verify standards table';
  END IF;

  -- ── 3. Resolve 10 approved question IDs for this standard ─────────────────
  SELECT ARRAY(
    SELECT id
      FROM questions
     WHERE standard_id = v_standard_id
       AND approved = true
     LIMIT 10
  ) INTO v_question_ids;

  IF array_length(v_question_ids, 1) IS NULL OR array_length(v_question_ids, 1) = 0 THEN
    RAISE EXCEPTION 'No approved questions found for ELA.9.R.1.1 — seed the question bank first';
  END IF;

  -- ── 4. Insert completed diagnostic session ─────────────────────────────────
  INSERT INTO sessions (
    student_id,
    standard_id,
    phase,
    status,
    mastery_achieved,
    dominant_classification,
    gap_classifications,
    classification_confidence,
    started_at,
    completed_at,
    last_active_at,
    teach_phase_completed,
    diagnostic_question_ids
  ) VALUES (
    v_student_id,
    v_standard_id,
    'diagnostic',
    'completed',
    false,
    v_classification,
    ARRAY[v_classification],
    80,
    now() - interval '10 minutes',
    now(),
    now(),
    '{}',
    v_question_ids
  )
  RETURNING id INTO v_session_id;

  RAISE NOTICE 'Session inserted: %', v_session_id;

  -- ── 5. Insert 10 response rows linked to the session ──────────────────────
  INSERT INTO responses (
    session_id,
    question_id,
    student_id,
    standard_id,
    cognitive_skill_targeted,
    diagnostic_classification,
    student_response,
    mastery_achieved,
    attempt_number
  )
  SELECT
    v_session_id,
    q_id,
    v_student_id,
    v_standard_id,
    'inferencing_textual_evidence',
    v_classification,
    'A',
    false,
    1
  FROM unnest(v_question_ids) AS q_id;

  RAISE NOTICE 'Responses inserted: % rows', array_length(v_question_ids, 1);
  RAISE NOTICE 'Done. student_id=%, standard_id=%, classification=%',
    v_student_id, v_standard_id, v_classification;

END;
$$;

COMMIT;
