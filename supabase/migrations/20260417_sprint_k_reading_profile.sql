-- Sprint K — Reading Profile Screen
-- Run this in Supabase SQL editor

-- ─── 1. cognitive_profiles table ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS cognitive_profiles (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id            uuid        REFERENCES students(id),
  administered_at       timestamptz DEFAULT now(),
  administered_by       text        DEFAULT 'self',
  working_memory_r1     int,
  working_memory_r2     int,
  working_memory_r3     int,
  working_memory_score  numeric,
  inferencing_score     numeric,
  vocab_breadth_score   numeric,
  syntax_score          numeric,
  overall_risk          text,
  raw_responses         jsonb,
  created_at            timestamptz DEFAULT now()
);

ALTER TABLE cognitive_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "students manage own profile"
  ON cognitive_profiles FOR ALL
  USING (
    student_id IN (
      SELECT id FROM students WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "teachers read all profiles"
  ON cognitive_profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE id = auth.uid()
      AND raw_user_meta_data->>'role' = 'teacher'
    )
  );

-- ─── 2. students.reading_profile_complete column ──────────────────────────────

ALTER TABLE students
  ADD COLUMN IF NOT EXISTS reading_profile_complete boolean DEFAULT false;

-- ─── 3. Sprint J columns (if not already applied) ────────────────────────────

ALTER TABLE students
  ADD COLUMN IF NOT EXISTS fast_pm1    numeric,
  ADD COLUMN IF NOT EXISTS fast_pm2    numeric,
  ADD COLUMN IF NOT EXISTS fast_target numeric,
  ADD COLUMN IF NOT EXISTS teacher_notes text;
