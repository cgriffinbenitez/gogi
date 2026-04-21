# GOGI Intervention Passage Pipeline

Fetches paragraphs from Project Gutenberg, filters them with Claude against
per-classification criteria, auto-tags approved paragraphs, and writes to the
`intervention_passages` table for human review.

---

## Quick Start

```bash
# 1. Ensure env vars are set in .env.local
# ANTHROPIC_API_KEY=...
# NEXT_PUBLIC_SUPABASE_URL=...
# SUPABASE_SERVICE_ROLE_KEY=...

# 2. Install deps (first time only)
npm install

# 3. Run the pipeline for a classification
npm run pipeline -- --classification mood_misreading

# 4. Review passages interactively
npm run review-passages -- --classification mood_misreading
```

---

## Pipeline Stages

| Stage | File | What it does |
|-------|------|--------------|
| 1 — Fetch | `stages/fetch.ts` | Queries Gutendex API, downloads book text, caches to `/tmp/gogi-pipeline-cache/` |
| 2 — Extract | `stages/extract.ts` | Splits text into paragraphs; filters 40–120 words; skips dialogue-heavy blocks |
| 3 — Filter | `stages/filter.ts` | Claude YES/NO against classification criteria |
| 4 — Tag | `stages/tag.ts` | Claude generates `canonical_answer`, `distractors[3]`, `keyword_flags`, `difficulty_tier` |
| 5 — Write | `stages/write.ts` | Inserts row with `approved=false`; appends to CSV; skips duplicates |

---

## CLI Flags

### `npm run pipeline`

```
--classification  Required. See list below.
--max             Max passages to insert (default: 15).
--dry-run         Run stages 1–3 only. No DB write, no tagging.
--help            Print usage.
```

### `npm run review-passages`

```
--classification  Required.
--limit           Max passages per review session (default: 50).
--help            Print usage.
```

During review, single-keypress actions:

| Key | Action |
|-----|--------|
| `a` | Approve (sets `approved=true`) |
| `r` | Reject (prompts for reason) |
| `e` | Edit tags then approve |
| `s` | Skip without changing row |
| `q` | Quit |

---

## Adding a Classification

1. **Create criteria file** — `src/pipeline/criteria/<classification>.json`
   ```json
   {
     "classification": "your_classification",
     "targetSkill": "What the student is learning to do",
     "mustHave": ["requirement 1", "requirement 2"],
     "mustNotHave": ["thing that disqualifies the passage"],
     "tierSignals": {
       "tier1": "Simple vocabulary, direct syntax",
       "tier2": "Some complex vocabulary or subordinate clauses",
       "tier3": "Dense syntax, low-frequency vocabulary"
     }
   }
   ```

2. **Create sources file** — `src/pipeline/sources/<classification>.json`
   ```json
   {
     "gutendexSearchTerms": ["short stories"],
     "priorityAuthors": ["O. Henry", "Kate Chopin"]
   }
   ```

3. **Run the pipeline** — `npm run pipeline -- --classification your_classification`

---

## Tuning Prompts

- **Filter prompt** — `src/pipeline/stages/filter.ts` → `buildFilterPrompt()`
  Change the system prompt or user template to adjust sensitivity.

- **Tagging prompt** — `src/pipeline/stages/tag.ts` → `buildTagPrompt()`
  Add classification-specific canonical_answer instructions by checking
  `criteria.classification`.

---

## Environment Variables

| Variable | Required | Notes |
|----------|----------|-------|
| `ANTHROPIC_API_KEY` | Yes | Claude API access |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Recommended | Bypasses RLS; falls back to anon key |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Fallback | Used if service role key not set |

---

## Book Cache

Fetched book texts are cached to `/tmp/gogi-pipeline-cache/{id}.txt`. Delete
this directory to force re-fetches. The cache persists across pipeline runs
within the same machine session.

---

## Output

Each run writes a CSV summary to `/tmp/pipeline-summary-{classification}-{timestamp}.csv`
with columns: `classification`, `gutenberg_id`, `title`, `author`, `paragraph_text`,
`word_count`, `suitable`, `reasoning`, `canonical_answer`, `distractors`,
`keyword_flags`, `difficulty_tier`, `status`.

Status values: `inserted`, `duplicate`, `rejected_by_filter`, `tagging_failed`, `dry_run_suitable`.

---

## Valid Classifications

```
mood_misreading
tone_misreading
figurative_language_failure
syntax_barrier
vocabulary_gap
morphology_gap
inferencing
evidence_retrieval_failure
comprehension_integration_failure
topic_vs_theme_confusion
structure_purpose_disconnect
no_metacognitive_strategy
schema_strategy_missing
```
