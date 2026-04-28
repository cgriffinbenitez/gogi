-- Migration: word_count_tier column
-- Adds word_count_tier to intervention_passages to preserve the word-count-derived
-- tier value separately from intervention_tier (now tagger-authoritative) and
-- tagger_tier (raw AI judgment).
--
-- ARCHITECTURE NOTE (2026-04-28):
-- intervention_tier is now derived from applyTierGuardrail(tagger_tier, word_count_tier):
--   - If diff < 2: tagger wins (literary judgment preferred)
--   - If diff >= 2: word-count wins (guardrail against extreme mismatch)
--
-- word_count_tier thresholds: T1 < 175 words, T2 < 225, T3 < 275, T4 >= 275
-- These midpoints of the extract-stage TIER_BOUNDS (T1:{150,210}, T2:{175,260},
-- T3:{225,310}, T4:{275,350}) are used for backfill approximation.
-- New rows written by v4+ pipeline will have exact values from extractTier.

-- ── 1. Add column ─────────────────────────────────────────────────────────────

ALTER TABLE "public"."intervention_passages"
  ADD COLUMN IF NOT EXISTS "word_count_tier" integer NULL;

-- ── 2. Backfill from existing word_count values ───────────────────────────────
-- Uses midpoint thresholds of TIER_BOUNDS as a reasonable approximation for
-- historical rows. Exact values will differ by ≤1 tier for edge-case rows.

UPDATE "public"."intervention_passages"
SET "word_count_tier" = CASE
  WHEN word_count < 175 THEN 1
  WHEN word_count < 225 THEN 2
  WHEN word_count < 275 THEN 3
  ELSE 4
END
WHERE "word_count_tier" IS NULL;

-- ── 3. Index for tier distribution queries ────────────────────────────────────

CREATE INDEX IF NOT EXISTS "idx_passages_word_count_tier"
  ON "public"."intervention_passages" ("classification", "word_count_tier");
