-- ─── Sprint 1+2 — Gap classification tracking ────────────────────────────────
--
-- Adds columns to persist every gap identified by classifySession() and track
-- which gaps the student has addressed through practice sessions.
--
-- sessions.gap_classifications  — all gaps from the diagnostic (2+ wrong each)
-- standard_progress.gaps_identified — copy of above, persisted at routing time
-- standard_progress.gaps_addressed  — gaps where student passed a practice session
-- standard_progress.current_gap     — the gap currently being targeted
--
-- Run order: after 20260418_seen_passages_tracking.sql

-- 1. sessions — store all gaps from this diagnostic session
ALTER TABLE sessions
  ADD COLUMN IF NOT EXISTS gap_classifications text[] DEFAULT '{}';

-- 2. standard_progress — gap lifecycle tracking
ALTER TABLE standard_progress
  ADD COLUMN IF NOT EXISTS gaps_identified text[] DEFAULT '{}';

ALTER TABLE standard_progress
  ADD COLUMN IF NOT EXISTS gaps_addressed text[] DEFAULT '{}';

ALTER TABLE standard_progress
  ADD COLUMN IF NOT EXISTS current_gap text;
