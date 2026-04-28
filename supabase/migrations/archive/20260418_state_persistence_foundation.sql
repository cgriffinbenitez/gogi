-- State Persistence Foundation
-- Date: 2026-04-18
--
-- PURPOSE:
--   Creates the schema foundation for GOGI's student loop state model.
--   Four new columns across two tables, three SECURITY DEFINER triggers
--   that auto-sync students and standard_progress flags server-side.
--   Students have zero UPDATE access to the students table — all state
--   changes happen via triggers on the phase-data tables.
--
-- EXISTING TRIGGER (NOT MODIFIED):
--   trg_mark_reading_profile_complete on cognitive_profiles AFTER INSERT
--   sets students.reading_profile_complete = true.
--
-- NEW:
--   sessions.last_active_at          — bumped on every session UPDATE
--   sessions.teach_phase_completed   — tracks sub-phases for teach resume
--   students.exit_diagnostic_complete — set when exit_diagnostic session completes
--   trg_mark_exit_diagnostic_complete on sessions AFTER UPDATE OF completed_at
--   trg_mark_standard_mastered        on standard_progress BEFORE UPDATE OF gaps_addressed
--   trg_bump_session_last_active      on sessions BEFORE UPDATE OF phase, completed_at, ...
--
-- TABLES AFFECTED: sessions, students, standard_progress
-- RLS POLICIES: none added or modified

-- ─── PART A — Schema additions ────────────────────────────────────────────────

-- sessions: resume and time-analytics columns
ALTER TABLE sessions
  ADD COLUMN IF NOT EXISTS last_active_at       timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS teach_phase_completed text[]      DEFAULT '{}';

-- students: pilot completion flag
ALTER TABLE students
  ADD COLUMN IF NOT EXISTS exit_diagnostic_complete boolean NOT NULL DEFAULT false;

-- ─── PART B — Trigger #1: exit_diagnostic_complete sync ──────────────────────
--
-- Fires when sessions.completed_at transitions from NULL to a timestamp
-- and phase = 'exit_diagnostic'. Sets students.exit_diagnostic_complete = true.

CREATE OR REPLACE FUNCTION mark_exit_diagnostic_complete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.phase = 'exit_diagnostic' AND NEW.completed_at IS NOT NULL AND OLD.completed_at IS NULL THEN
    UPDATE students
    SET exit_diagnostic_complete = true
    WHERE id = NEW.student_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_mark_exit_diagnostic_complete ON sessions;

CREATE TRIGGER trg_mark_exit_diagnostic_complete
  AFTER UPDATE OF completed_at ON sessions
  FOR EACH ROW
  EXECUTE FUNCTION mark_exit_diagnostic_complete();

-- ─── PART C — Trigger #2: mastered_at auto-set ───────────────────────────────
--
-- BEFORE UPDATE trigger (not AFTER) so it can modify NEW.mastered_at in-place
-- before the row is written. Fires when gaps_addressed is updated and its
-- length now equals gaps_identified length and mastered_at is still null.
-- Idempotent: does nothing if mastered_at is already set.

CREATE OR REPLACE FUNCTION mark_standard_mastered()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF array_length(NEW.gaps_addressed, 1) IS NOT NULL
     AND array_length(NEW.gaps_identified, 1) IS NOT NULL
     AND array_length(NEW.gaps_addressed, 1) = array_length(NEW.gaps_identified, 1)
     AND NEW.mastered_at IS NULL THEN
    NEW.mastered_at := now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_mark_standard_mastered ON standard_progress;

CREATE TRIGGER trg_mark_standard_mastered
  BEFORE UPDATE OF gaps_addressed ON standard_progress
  FOR EACH ROW
  EXECUTE FUNCTION mark_standard_mastered();

-- ─── PART D — Trigger #3: last_active_at auto-update ─────────────────────────
--
-- BEFORE UPDATE trigger. Bumps last_active_at on any meaningful session write.
-- last_active_at is intentionally excluded from the UPDATE OF list to prevent
-- infinite recursion. Add new sessions columns to this list as they are created.

CREATE OR REPLACE FUNCTION bump_session_last_active()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.last_active_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bump_session_last_active ON sessions;

CREATE TRIGGER trg_bump_session_last_active
  BEFORE UPDATE OF phase, completed_at, mastery_achieved, time_spent_seconds, dominant_classification, teach_phase_completed ON sessions
  FOR EACH ROW
  EXECUTE FUNCTION bump_session_last_active();

-- ─── PART E — Backfill ────────────────────────────────────────────────────────

-- 1. last_active_at: use completed_at if set, otherwise started_at, otherwise now()
UPDATE sessions
SET last_active_at = COALESCE(completed_at, started_at, now())
WHERE last_active_at IS NULL;

-- 2. mastered_at: retroactively set for rows that already meet mastery criteria
UPDATE standard_progress
SET mastered_at = now()
WHERE mastered_at IS NULL
  AND array_length(gaps_addressed, 1) IS NOT NULL
  AND array_length(gaps_identified, 1) IS NOT NULL
  AND array_length(gaps_addressed, 1) = array_length(gaps_identified, 1);

-- 3. exit_diagnostic_complete: retroactively set for students with a completed
--    exit_diagnostic session
UPDATE students
SET exit_diagnostic_complete = true
WHERE id IN (
  SELECT DISTINCT student_id FROM sessions
  WHERE phase = 'exit_diagnostic' AND completed_at IS NOT NULL
);

-- ─── DOWN (run manually to revert — do not run automatically) ─────────────────
--
-- Note: backfilled column data cannot be cleanly reversed.
--
-- DROP TRIGGER IF EXISTS trg_bump_session_last_active      ON sessions;
-- DROP TRIGGER IF EXISTS trg_mark_exit_diagnostic_complete ON sessions;
-- DROP TRIGGER IF EXISTS trg_mark_standard_mastered        ON standard_progress;
--
-- DROP FUNCTION IF EXISTS bump_session_last_active();
-- DROP FUNCTION IF EXISTS mark_exit_diagnostic_complete();
-- DROP FUNCTION IF EXISTS mark_standard_mastered();
--
-- ALTER TABLE sessions        DROP COLUMN IF EXISTS last_active_at;
-- ALTER TABLE sessions        DROP COLUMN IF EXISTS teach_phase_completed;
-- ALTER TABLE students        DROP COLUMN IF EXISTS exit_diagnostic_complete;
