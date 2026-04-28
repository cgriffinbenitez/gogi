# Integration Testing

GOGI's integration tests run the pipeline's write/read/dedup logic against a real local
Supabase instance (Option D isolation strategy). Tests touch only the local DB — no
production data is read or written.

## Prerequisites

| Tool | Install |
|------|---------|
| Docker Desktop | https://www.docker.com/products/docker-desktop/ |
| Supabase CLI | `brew install supabase/tap/supabase` |

## One-time local setup

Run these once per machine (or after `supabase stop --no-backup`):

```bash
# 1. Start the local Supabase stack (pulls Docker images on first run — ~3 min)
supabase start

# 2. Apply the base schema to the local database
supabase db reset

# 3. Copy the credentials into .env.test
cp .env.test.example .env.test
# Edit .env.test: fill in "Project URL" → NEXT_PUBLIC_SUPABASE_URL
#                           "Secret"      → SUPABASE_SERVICE_ROLE_KEY
# Both values are printed by `supabase start` and `supabase status`
```

`.env.test` is gitignored. Never commit real keys.

### Why production variable names?

`.env.test` uses `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` — the same
names as `.env.local` — intentionally. The pipeline's `getSupabase()` in `write.ts` reads
those names directly, so no pipeline code changes are needed for tests to work.

Tests load `.env.test` with `override: true` before importing any pipeline modules.
This ensures the local URL and key win even if `.env.local` was already loaded by the
runtime environment:

```typescript
import { config } from 'dotenv';
// Must be FIRST — before any pipeline imports — and with override: true
// so local test values take precedence over any pre-loaded .env.local values.
config({ path: '.env.test', override: true });

import { writePassageV3, isDuplicateV3 } from '../../../src/pipeline/stages/write';
```

If `override: true` is omitted and `.env.local` was loaded first, `getSupabase()` would
silently connect to production instead of the local instance.

## Running integration tests

```bash
npm run test:integration
```

This runs `vitest run tests/integration/` against the local Supabase instance defined in
`.env.test`. Tests that insert rows clean up after themselves in `afterAll` blocks. If a
test crashes mid-run and leaves orphan rows, run `supabase db reset` to wipe and
re-apply the base schema.

## Adding new tests

Place test files in `tests/integration/pipeline/`. Each file should:

1. Load `.env.test` at the top:
   ```typescript
   import { config } from 'dotenv';
   config({ path: '.env.test' });
   ```
2. Create a Supabase client using `TEST_SUPABASE_URL` and `TEST_SUPABASE_SERVICE_ROLE_KEY`
3. Clean up any inserted rows in `afterAll` — filter by a sentinel value such as
   `paragraph_hash LIKE 'test_%'` to scope deletes safely

## Fixtures

Test fixture books live in `tests/fixtures/books/`. Each is plain text matching the
`FetchedBook.text` format the pipeline expects (paragraphs separated by double newlines,
optional `CHAPTER I` header).

Current fixtures:

| File | Paragraphs | Word counts | Tiers covered |
|------|------------|-------------|---------------|
| `tier-spanning-fixture.txt` | 5 | 159, 192, 223, 326, 273 | T1, T1, T2, T4, T3 |

## Local Supabase management

```bash
supabase status          # show running services and credentials
supabase stop            # stop containers, preserve data
supabase stop --no-backup  # stop and wipe data volume
supabase db reset        # drop + re-apply all migrations (wipes data)
```

## Adding new migrations

New schema changes go in `supabase/migrations/` as dated `.sql` files, e.g.:
```
supabase/migrations/20260429_my_change.sql
```

The archived migrations in `supabase/migrations/archive/` are historical reference —
do not add new files there. Run `supabase db reset` locally after adding a migration
to verify it applies cleanly on a fresh database.
