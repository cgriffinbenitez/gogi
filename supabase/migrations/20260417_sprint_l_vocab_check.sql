-- Sprint L — Vocabulary Check Screen
-- Run this in Supabase SQL editor

-- ─── vocab_readiness table ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS vocab_readiness (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id     uuid        REFERENCES students(id),
  standard_id    uuid        REFERENCES standards(id),
  coverage_score numeric,
  words_known    int,
  words_maybe    int,
  words_unknown  int,
  word_results   jsonb,
  completed_at   timestamptz DEFAULT now(),
  created_at     timestamptz DEFAULT now(),
  UNIQUE(student_id, standard_id)
);

ALTER TABLE vocab_readiness ENABLE ROW LEVEL SECURITY;

CREATE POLICY "students manage own vocab readiness"
  ON vocab_readiness FOR ALL
  USING (
    student_id IN (
      SELECT id FROM students WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "teachers read all vocab readiness"
  ON vocab_readiness FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE id = auth.uid()
      AND raw_user_meta_data->>'role' = 'teacher'
    )
  );
