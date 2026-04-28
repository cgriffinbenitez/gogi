-- ─── Sprint P3 — Passage rotation tracking ───────────────────────────────────
--
-- Adds seen_passage_titles to standard_progress so practice sessions rotate
-- through different passages instead of repeating the same text.
--
-- Run order: after 20260417_sprint_o_question_rebuild.sql

-- 1. Add seen_passage_titles column to standard_progress
ALTER TABLE standard_progress
  ADD COLUMN IF NOT EXISTS seen_passage_titles text[] DEFAULT '{}';

-- 2. array_append_unique — appends a value to an array, deduplicated
--    Used by practice page to record which passages a student has seen.
--    Example: array_append_unique('{"Gift of Magi"}', 'The Necklace')
--             → '{"Gift of Magi","The Necklace"}'
CREATE OR REPLACE FUNCTION array_append_unique(arr text[], val text)
RETURNS text[] AS $$
  SELECT array_agg(DISTINCT elem ORDER BY elem)
  FROM unnest(arr || ARRAY[val]) AS elem
$$ LANGUAGE sql IMMUTABLE;
