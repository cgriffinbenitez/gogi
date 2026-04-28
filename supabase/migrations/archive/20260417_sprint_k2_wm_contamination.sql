-- Sprint K2 — Working Memory vocab contamination signal
-- Run this in Supabase SQL editor

-- ─── Add vocab_contamination_signal column ────────────────────────────────────

ALTER TABLE cognitive_profiles
  ADD COLUMN IF NOT EXISTS vocab_contamination_signal boolean;

-- Signal logic (computed at assessment time, stored here for teacher dashboard):
--   round1_rate = working_memory_r1 / 6
--   round2_rate = working_memory_r2 / 6
--   drop_rate   = round1_rate - round2_rate
--   vocab_contamination_signal = drop_rate > 0.3
--
-- Interpretation: a drop > 30% from common → academic words suggests the student
-- may have inflated their vocab self-assessment in Module 3 (Vocabulary Breadth).
-- Teachers can use this to flag borderline vocab scores for closer review.
