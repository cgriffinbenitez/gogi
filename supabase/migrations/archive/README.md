# supabase/migrations/archive

These migration files were applied incrementally to the production database between
2026-04-17 and 2026-04-27. Their combined final state is fully captured in:

    supabase/migrations/00000000_base_schema.sql

That file is the single source of truth for the current schema. It was generated
via `supabase db dump --schema-only` on 2026-04-28 against the production project
(ref: vmgzdtlwclwbunwznbzj).

## Files preserved here

| File | Purpose |
|------|---------|
| 20260417_sprint_k_reading_profile.sql | cognitive_profiles table, RLS |
| 20260417_sprint_k2_wm_contamination.sql | vocab_contamination_signal column |
| 20260417_sprint_l_vocab_check.sql | vocabulary_check_items table |
| 20260417_sprint_o_question_rebuild.sql | questions table rebuild |
| 20260418_fix_teacher_rls_cog_vocab.sql | Teacher RLS fix |
| 20260418_gap_tracking.sql | gaps_identified column |
| 20260418_irb_consent_cohort.sql | consent + cohort columns on students |
| 20260418_reading_profile_complete_trigger.sql | reading_profile_complete trigger |
| 20260418_seen_passages_tracking.sql | seen_passage_titles column |
| 20260418_state_persistence_foundation.sql | State persistence tables |
| 20260420_append_teach_phase.sql | teach phase in sessions |
| 20260421_intervention_passages.sql | intervention_passages table |
| 20260422_pipeline_v3_columns.sql | Pipeline v3 evidence columns |
| 20260423_passage_question_bridge.sql | Passage→question bridge columns |
| 20260423_questions_filter_columns.sql | Questions filter/source columns |
| 20260427_tagger_tier.sql | tagger_tier column + mood backfill |

## Going forward

New schema changes belong in `supabase/migrations/` as new dated `.sql` files,
e.g. `20260429_my_change.sql`. Do not add files to this archive directory.

Running `supabase db reset` locally will apply only `00000000_base_schema.sql`
(plus any new dated files you add), giving a clean reproducible local environment.
