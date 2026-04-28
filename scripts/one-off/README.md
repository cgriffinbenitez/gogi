# scripts/one-off

Historical scripts that were run exactly once to correct data or verify a migration.
These are **not part of regular pipeline operation** — they are preserved as audit artifacts
so the work they did can be reconstructed if needed.

---

## tier-preview.ts
**Purpose:** Pre-flight query to preview proposed tier corrections before applying them.
Fetched all `mood_misreading` passages with `approval_status = 'pending_review'` and displayed
current `intervention_tier` alongside proposed tier (derived from word-count thresholds).
**Run:** 2026-04-27
**Modified:** nothing — read-only.

## tier-correct.ts
**Purpose:** Applied the tier correction to `intervention_passages` for all `mood_misreading`
passages where `intervention_tier` was wrong (tagger had defaulted to 2 for all rows).
Ran three targeted UPDATE statements using word-count thresholds:
`< 210 → T1`, `< 260 → T2 (already correct)`, `< 310 → T3`, `≥ 310 → T4`.
Then ran a verification query to confirm the distribution.
**Run:** 2026-04-27
**Modified:** 14 rows in `intervention_passages` (12 corrected, 2 already correct).
**Result:** T1:10, T2:2, T3:1, T4:1

## verify-local-auth.ts
**Purpose:** Verified that the `sb_secret_*` key format produced by Supabase CLI v2.95.4
is accepted by `@supabase/supabase-js` v2.103.0. Confirmed the local instance at
`http://127.0.0.1:54321` could be queried successfully using the new key format, unblocking
the integration test credential swap design.
**Run:** 2026-04-28
**Modified:** nothing — read-only.

## verify-migration-scope.ts
**Purpose:** Verified the scope of the `tagger_tier` column migration
(`20260427_tagger_tier.sql`) before and after it was applied via the Supabase SQL editor.
Confirmed row counts by `classification × approval_status` and verified that
`tagger_tier IS NULL` for exactly 14 mood rows (pre-migration) and 0 (post-migration).
**Run:** 2026-04-27
**Modified:** nothing — read-only.
