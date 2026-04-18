-- IRB Pilot — Consent, assent, and cohort tracking
-- Run this in Supabase SQL editor
--
-- Adds six columns to `students` required before the Fall 2026-27 pilot launch.
-- Every student in the pilot must have consent_on_file = true and
-- assent_on_file = true before any platform interaction occurs.
-- Account creation for cohort 1 is done manually in Supabase.

-- ─── UP ───────────────────────────────────────────────────────────────────────

ALTER TABLE students
  ADD COLUMN IF NOT EXISTS consent_on_file     boolean  NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS consent_signed_date date     NULL,
  ADD COLUMN IF NOT EXISTS consent_signed_by   text     NULL,
  ADD COLUMN IF NOT EXISTS assent_on_file      boolean  NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS assent_signed_date  date     NULL,
  ADD COLUMN IF NOT EXISTS cohort_group        text     NULL
    CHECK (cohort_group IN ('A', 'B') OR cohort_group IS NULL);

-- ─── DOWN (run manually if migration needs to be reversed) ────────────────────
-- ALTER TABLE students
--   DROP COLUMN IF EXISTS consent_on_file,
--   DROP COLUMN IF EXISTS consent_signed_date,
--   DROP COLUMN IF EXISTS consent_signed_by,
--   DROP COLUMN IF EXISTS assent_on_file,
--   DROP COLUMN IF EXISTS assent_signed_date,
--   DROP COLUMN IF EXISTS cohort_group;
