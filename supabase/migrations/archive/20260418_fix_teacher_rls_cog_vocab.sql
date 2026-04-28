-- Fix broken teacher RLS policies on cognitive_profiles and vocab_readiness
-- Date: 2026-04-18
--
-- ROOT CAUSE:
--   The original "teachers read all X" policies used:
--     EXISTS (SELECT 1 FROM auth.users WHERE id = auth.uid() AND raw_user_meta_data->>'role' = 'teacher')
--   auth.users is not readable by the authenticated role inside RLS policy context,
--   so the subquery always returns no rows → 403 for every teacher SELECT.
--
-- FIX:
--   Scope teacher access via students.teacher_id = auth.uid().
--   This reads only from the public.students table (already RLS-accessible) and
--   correctly restricts each teacher to rows belonging to their own students.
--
-- TABLES AFFECTED: cognitive_profiles, vocab_readiness
-- TABLES NOT AFFECTED: all others (no changes to any other policies or schemas)

-- ─── cognitive_profiles ───────────────────────────────────────────────────────

DROP POLICY IF EXISTS "teachers read all profiles" ON cognitive_profiles;

CREATE POLICY "teachers read own students profiles"
  ON cognitive_profiles FOR SELECT
  USING (
    student_id IN (
      SELECT id FROM students WHERE teacher_id = auth.uid()
    )
  );

-- ─── vocab_readiness ──────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "teachers read all vocab readiness" ON vocab_readiness;

CREATE POLICY "teachers read own students vocab readiness"
  ON vocab_readiness FOR SELECT
  USING (
    student_id IN (
      SELECT id FROM students WHERE teacher_id = auth.uid()
    )
  );

-- ─── DOWN (run manually to revert — do not run automatically) ─────────────────
--
-- DROP POLICY IF EXISTS "teachers read own students profiles"      ON cognitive_profiles;
-- DROP POLICY IF EXISTS "teachers read own students vocab readiness" ON vocab_readiness;
--
-- CREATE POLICY "teachers read all profiles"
--   ON cognitive_profiles FOR SELECT
--   USING (
--     EXISTS (
--       SELECT 1 FROM auth.users
--       WHERE id = auth.uid()
--       AND raw_user_meta_data->>'role' = 'teacher'
--     )
--   );
--
-- CREATE POLICY "teachers read all vocab readiness"
--   ON vocab_readiness FOR SELECT
--   USING (
--     EXISTS (
--       SELECT 1 FROM auth.users
--       WHERE id = auth.uid()
--       AND raw_user_meta_data->>'role' = 'teacher'
--     )
--   );
