// MUST be first — sets NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to local
// instance before getSupabase() in write.ts is ever called.
import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(process.cwd(), '.env.test'), override: true });

import { describe, it, expect, afterAll } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import { readFileSync, unlinkSync } from 'fs';
import { writePassageV3, isDuplicateV3, appendCSV, initCSV } from '../../../src/pipeline/stages/write';
import type { PassageRowV3 } from '../../../src/pipeline/types';

// ─── Sentinels ────────────────────────────────────────────────────────────────

const SENTINEL_SOURCE  = 'test__dedup';
const FAKE_GUTENBERG_ID = 99997;
// Prefix 'test__' makes cleanup sentinel unambiguous
const FAKE_HASH        = 'test__dedup_hash_abc123def456789';

function getTestClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

// ─── Seed row (intervention_tier=2, T2 word count) ───────────────────────────

const seedRow: PassageRowV3 = {
  classification:           'mood_misreading',
  paragraph_text:           'Dedup test passage — tier 2 seed.',
  word_count:               220,   // places it in T2 range (210–259)
  paragraph_count:          1,
  source:                   'test',
  source_title:             SENTINEL_SOURCE,
  source_author:            'Test Author',
  source_year:              null,
  source_gutenberg_id:      FAKE_GUTENBERG_ID,
  approved:                 false,
  paragraph_hash:           FAKE_HASH,
  pipeline_version:         'v4',
  target_signal:            'test signal',
  item_patterns_supported:  [],
  supporting_evidence:      [],
  non_supporting_evidence:  [],
  dominant_concept:         null,
  plausible_distractors:    null,
  craft_features:           null,
  discrimination_item_type: 'sentence_level',
  intervention_tier:        2,
  tagger_tier:              2,
  word_count_tier:          2,
  tier_rationale:           'test',
  q5_flag_5e_compatible:    false,
  approval_status:          'pending_review',
};

// ─── Cleanup ─────────────────────────────────────────────────────────────────

afterAll(async () => {
  const supabase = getTestClient();
  await supabase
    .from('intervention_passages')
    .delete()
    .eq('source_title', SENTINEL_SOURCE);
});

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('dedup — tier-aware duplicate detection', () => {

  // Must run first — subsequent tests rely on this row existing in the DB.
  it('inserts seed row (intervention_tier=2)', async () => {
    const result = await writePassageV3(seedRow);
    expect(result.status, `seed insert failed: ${result.error}`).toBe('inserted');
  });

  it('isDuplicateV3 returns true when gutenbergId + hash + tier all match', async () => {
    const dup = await isDuplicateV3(FAKE_GUTENBERG_ID, FAKE_HASH, 2);
    expect(dup).toBe(true);
  });

  it('isDuplicateV3 returns false with tier=0 — simulates pre-fix bug where app-level check missed dup', async () => {
    // Pre-fix, run.ts called isDuplicateV3(id, hash, 0).
    // No row has intervention_tier=0, so this always returned false —
    // allowing the pipeline to proceed to the expensive tag stage before
    // the DB unique constraint caught it at insert time.
    // This test documents why the fix (474b86a) was necessary.
    const dup = await isDuplicateV3(FAKE_GUTENBERG_ID, FAKE_HASH, 0);
    expect(dup).toBe(false);
  });

  it('isDuplicateV3 returns false for a different valid tier — correctly allows a T3 passage from same book', async () => {
    // Same gutenbergId + hash but tier=3 is a distinct passage slot — not a duplicate.
    const dup = await isDuplicateV3(FAKE_GUTENBERG_ID, FAKE_HASH, 3);
    expect(dup).toBe(false);
  });

  it('writePassageV3 returns duplicate on second insert — DB unique constraint fires as safety net', async () => {
    // Even if the application-level isDuplicateV3 check were bypassed (as in the old bug),
    // the DB unique index on (source_gutenberg_id, paragraph_hash) catches the re-insert.
    // run.ts maps error code 23505 → { status: 'duplicate' }.
    const result = await writePassageV3(seedRow);
    expect(result.status).toBe('duplicate');
  });

  it('appendCSV writes a row with status=duplicate — format used by run.ts pipeline', () => {
    const csvPath = `/tmp/test-dedup-${Date.now()}.csv`;
    initCSV(csvPath);

    appendCSV(csvPath, {
      classification:   'mood_misreading',
      gutenberg_id:     FAKE_GUTENBERG_ID,
      title:            SENTINEL_SOURCE,
      author:           'Test Author',
      paragraph_text:   seedRow.paragraph_text,
      word_count:       seedRow.word_count,
      suitable:         true,
      reasoning:        '',
      canonical_answer: '',
      distractors:      '',
      keyword_flags:    '',
      difficulty_tier:  '',
      tier:             2,
      pipeline_version: 'v4',
      status:           'duplicate',
    });

    const lines = readFileSync(csvPath, 'utf-8').split('\n').filter(Boolean);
    // line 0 = header written by initCSV, line 1 = data row written by appendCSV
    expect(lines).toHaveLength(2);
    const dataLine = lines[1];
    expect(dataLine).toContain('duplicate');
    expect(dataLine).toContain(String(FAKE_GUTENBERG_ID));

    // cleanup temp CSV
    unlinkSync(csvPath);
  });
});
