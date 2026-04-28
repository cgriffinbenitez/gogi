// MUST be first — sets NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to local
// instance before getSupabase() in write.ts is ever called.
import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(process.cwd(), '.env.test'), override: true });

import { describe, it, expect, afterAll } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import crypto from 'crypto';
import { writePassageV3 } from '../../../src/pipeline/stages/write';
import type { PassageRowV3 } from '../../../src/pipeline/types';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const SENTINEL_SOURCE = 'test__tier_persistence';
const FAKE_GUTENBERG_ID = 99998;

function wordCount(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

function extractTier(wc: number): 1 | 2 | 3 | 4 {
  if (wc < 210) return 1;
  if (wc < 260) return 2;
  if (wc < 310) return 3;
  return 4;
}

function sentinelHash(text: string, idx: number): string {
  // Prefix with 'test__' so cleanup sentinel is unambiguous
  return 'test__' + crypto.createHash('sha256').update(text + idx).digest('hex').slice(0, 16);
}

function getTestClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

// ─── Fixture setup ───────────────────────────────────────────────────────────

const fixtureText = readFileSync(
  resolve(process.cwd(), 'tests/fixtures/books/tier-spanning-fixture.txt'),
  'utf-8',
);

const paragraphs = fixtureText
  .split('\n\n')
  .map(p => p.trim())
  .filter(p => p.length > 0 && !p.startsWith('CHAPTER'));

// Each fixture paragraph has an expected word-count tier and a simulated tagger tier.
// tagger_tier is hardcoded to 2 to simulate the pre-fix bug where the AI tagger
// always returned tier=2 for mood_misreading regardless of word count.
const fixtures = paragraphs.map((text, i) => {
  const wc = wordCount(text);
  return {
    text,
    wc,
    expectedTier: extractTier(wc),
    simulatedTaggerTier: 2 as const,
    hash: sentinelHash(text, i),
  };
});

// ─── Cleanup ─────────────────────────────────────────────────────────────────

afterAll(async () => {
  const supabase = getTestClient();
  await supabase
    .from('intervention_passages')
    .delete()
    .eq('source_title', SENTINEL_SOURCE);
});

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('tier_persistence — regression test for intervention_tier / tagger_tier split', () => {

  it('fixture covers all four tier ranges', () => {
    const tiers = new Set(fixtures.map(f => f.expectedTier));
    expect(tiers.has(1)).toBe(true);
    expect(tiers.has(2)).toBe(true);
    expect(tiers.has(3)).toBe(true);
    expect(tiers.has(4)).toBe(true);
  });

  it('inserts all fixture paragraphs via writePassageV3', async () => {
    for (const fx of fixtures) {
      const row: PassageRowV3 = {
        classification:           'mood_misreading',
        paragraph_text:           fx.text,
        word_count:               fx.wc,
        paragraph_count:          1,
        source:                   'test',
        source_title:             SENTINEL_SOURCE,
        source_author:            'Test Author',
        source_year:              null,
        source_gutenberg_id:      FAKE_GUTENBERG_ID,
        approved:                 false,
        paragraph_hash:           fx.hash,
        pipeline_version:         'v4',
        target_signal:            'test signal',
        item_patterns_supported:  [],
        supporting_evidence:      [],
        non_supporting_evidence:  [],
        dominant_concept:         null,
        plausible_distractors:    null,
        craft_features:           null,
        discrimination_item_type: 'sentence_level',
        intervention_tier:        fx.expectedTier,
        tagger_tier:              fx.simulatedTaggerTier,
        tier_rationale:           'test',
        q5_flag_5e_compatible:    false,
        approval_status:          'pending_review',
      };
      const result = await writePassageV3(row);
      expect(result.status, `insert failed for para wc=${fx.wc}: ${result.error}`).toBe('inserted');
    }
  });

  it('intervention_tier in DB matches word-count-derived tier for every row', async () => {
    const supabase = getTestClient();
    const { data, error } = await supabase
      .from('intervention_passages')
      .select('word_count, intervention_tier, tagger_tier')
      .eq('source_title', SENTINEL_SOURCE)
      .order('word_count', { ascending: true });

    expect(error).toBeNull();
    expect(data!.length).toBe(fixtures.length);

    for (const row of data!) {
      const expected = extractTier(row.word_count as number);
      expect(
        row.intervention_tier,
        `word_count=${row.word_count}: expected intervention_tier=${expected}, got ${row.intervention_tier}`,
      ).toBe(expected);
    }
  });

  it('tagger_tier is preserved in DB independently of intervention_tier', async () => {
    const supabase = getTestClient();
    const { data, error } = await supabase
      .from('intervention_passages')
      .select('word_count, intervention_tier, tagger_tier')
      .eq('source_title', SENTINEL_SOURCE);

    expect(error).toBeNull();

    for (const row of data!) {
      // tagger_tier must be a valid integer or null — never undefined
      expect(row.tagger_tier === null || typeof row.tagger_tier === 'number').toBe(true);
      // tagger_tier was written as 2 for every row
      expect(row.tagger_tier).toBe(2);
    }

    // At least one row must have intervention_tier !== tagger_tier (the whole point of the fix)
    const divergent = data!.filter(r => r.intervention_tier !== r.tagger_tier);
    expect(
      divergent.length,
      'No rows with intervention_tier !== tagger_tier — the split is not working',
    ).toBeGreaterThan(0);
  });

  it('DB tier distribution matches expected counts derived from fixture word counts', async () => {
    const supabase = getTestClient();
    const { data, error } = await supabase
      .from('intervention_passages')
      .select('intervention_tier')
      .eq('source_title', SENTINEL_SOURCE);

    expect(error).toBeNull();

    // Count from DB
    const dbCounts: Record<number, number> = {};
    for (const row of data!) {
      const t = row.intervention_tier as number;
      dbCounts[t] = (dbCounts[t] ?? 0) + 1;
    }

    // Count expected from fixture
    const expectedCounts: Record<number, number> = {};
    for (const fx of fixtures) {
      expectedCounts[fx.expectedTier] = (expectedCounts[fx.expectedTier] ?? 0) + 1;
    }

    expect(dbCounts).toEqual(expectedCounts);
  });
});
