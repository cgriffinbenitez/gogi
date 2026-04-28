-- Migration: add tagger_tier column to intervention_passages
--
-- Background:
--   intervention_tier (existing) = word-count-deterministic tier (T1<210, T2<260, T3<310, T4≥310).
--   This is the authoritative value driving library balance targets.
--
--   tagger_tier (new) = the intervention_tier integer returned by the AI tagger's JSON response.
--   This reflects the model's independent literary-difficulty judgment and is preserved for
--   downstream analysis (e.g. comparing AI difficulty perception vs. word-count proxy).
--   NULL is valid — rows written before this column existed have no recoverable tagger value.
--
-- Backfill rationale:
--   tone_misreading rows (~43): tagger_tier not logged in pipeline v3 CSVs → left NULL.
--   mood_misreading rows (14): tagger always returned 2 for this classification (diagnosed
--   2026-04-27; criteria JSON has no tier4 signal, model defaulted to 2) → backfill with 2.

-- ── 1. Add column ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE intervention_passages
  ADD COLUMN IF NOT EXISTS tagger_tier integer NULL;

-- ── 2. Backfill mood_misreading rows ─────────────────────────────────────────────────────────
-- All 14 mood_misreading passages were written by v4 pipeline before this fix.
-- The tagger returned intervention_tier=2 for every row (confirmed by DB query 2026-04-27).
UPDATE intervention_passages
SET tagger_tier = 2
WHERE classification = 'mood_misreading'
  AND tagger_tier IS NULL;

-- tone_misreading rows: tagger_tier stays NULL (not recoverable from v3 CSV logs).
