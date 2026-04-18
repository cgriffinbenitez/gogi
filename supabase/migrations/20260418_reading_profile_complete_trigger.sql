-- Trigger: mark_reading_profile_complete
-- Date: 2026-04-18
--
-- PROBLEM:
--   students.reading_profile_complete was being flipped client-side from
--   saveAndComplete() in src/app/profile/reading/page.tsx. This never
--   succeeded because students have no RLS UPDATE policy on the students
--   table (by design). The flag stayed false, so the dashboard kept showing
--   "Start Reading Profile" even after the profile was submitted.
--
-- FIX:
--   A SECURITY DEFINER trigger function runs AFTER INSERT on cognitive_profiles
--   and flips students.reading_profile_complete = true for that student_id.
--   SECURITY DEFINER lets the function run as its owner (bypassing RLS) while
--   the student themselves never gains UPDATE access to the students table.
--   SET search_path = public prevents search_path injection on SECURITY DEFINER
--   functions.
--
-- TABLES AFFECTED: cognitive_profiles (trigger), students (flag update only)
-- RLS POLICIES: none added or modified

-- ─── 1. Trigger function ──────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION mark_reading_profile_complete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE students
  SET reading_profile_complete = true
  WHERE id = NEW.student_id;
  RETURN NEW;
END;
$$;

-- ─── 2. Attach trigger ────────────────────────────────────────────────────────

DROP TRIGGER IF EXISTS trg_mark_reading_profile_complete ON cognitive_profiles;

CREATE TRIGGER trg_mark_reading_profile_complete
  AFTER INSERT ON cognitive_profiles
  FOR EACH ROW
  EXECUTE FUNCTION mark_reading_profile_complete();

-- ─── 3. Backfill existing data ────────────────────────────────────────────────
-- Any student who already has a cognitive_profiles row gets the flag set now.

UPDATE students
SET reading_profile_complete = true
WHERE id IN (SELECT DISTINCT student_id FROM cognitive_profiles);

-- ─── DOWN (run manually to revert — do not run automatically) ─────────────────
--
-- DROP TRIGGER IF EXISTS trg_mark_reading_profile_complete ON cognitive_profiles;
-- DROP FUNCTION IF EXISTS mark_reading_profile_complete();
-- (Backfilled flag values are not reversed — leave them as-is if rolling back.)
