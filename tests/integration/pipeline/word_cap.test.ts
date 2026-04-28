// extractPassageUnits is purely in-memory — no Supabase interaction in this file.
// No .env.test loading required.

import { describe, it, expect } from 'vitest';
import {
  extractPassageUnits,
  MIN_WORDS,
  MAX_WORDS,
  TIER_BOUNDS,
} from '../../../src/pipeline/stages/extract';
import type { FetchedBook, TierKey } from '../../../src/pipeline/types';

// ─── Fixture helpers ──────────────────────────────────────────────────────────

/**
 * Generate a well-formed prose paragraph of exactly n words.
 * Starts with "The" (satisfies isCompleteParagraph capital-letter check).
 * Ends with a period (satisfies terminal-punctuation check).
 * No quotes, parens, headers, or editorial markers — passes all other checks.
 */
function makeChunk(n: number): string {
  const tokens = Array<string>(n).fill('word');
  tokens[0] = 'The';
  return tokens.join(' ') + '.';
}

function makeBook(chunks: string[], gutenbergId = 99996): FetchedBook {
  return {
    title:       'test__word_cap_fixture',
    author:      'Test Author',
    year:        null,
    gutenbergId,
    text:        chunks.join('\n\n'),
  };
}

const TIER_KEYS: TierKey[] = ['T1', 'T2', 'T3', 'T4'];

function allUnits(result: Record<TierKey, { wordCount: number }[]>): { wordCount: number }[] {
  return TIER_KEYS.flatMap(t => result[t]);
}

function totalUnitCount(result: Record<TierKey, unknown[]>): number {
  return TIER_KEYS.reduce((sum, t) => sum + result[t].length, 0);
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('word_cap — TIER_BOUNDS single-source invariant', () => {

  it('MIN_WORDS and MAX_WORDS have expected absolute values', () => {
    expect(MIN_WORDS).toBe(150);
    expect(MAX_WORDS).toBe(350);
  });

  it('TIER_BOUNDS has entries for all four tiers', () => {
    for (const tier of TIER_KEYS) {
      expect(TIER_BOUNDS[tier], `TIER_BOUNDS missing ${tier}`).toBeDefined();
      expect(typeof TIER_BOUNDS[tier].min).toBe('number');
      expect(typeof TIER_BOUNDS[tier].max).toBe('number');
    }
  });

  it('all TIER_BOUNDS min values are >= MIN_WORDS (no tier can produce sub-cap passages)', () => {
    for (const tier of TIER_KEYS) {
      expect(
        TIER_BOUNDS[tier].min,
        `${tier}.min=${TIER_BOUNDS[tier].min} is below MIN_WORDS=${MIN_WORDS}`,
      ).toBeGreaterThanOrEqual(MIN_WORDS);
    }
  });

  it('all TIER_BOUNDS max values are <= MAX_WORDS (no tier can produce over-cap passages)', () => {
    for (const tier of TIER_KEYS) {
      expect(
        TIER_BOUNDS[tier].max,
        `${tier}.max=${TIER_BOUNDS[tier].max} exceeds MAX_WORDS=${MAX_WORDS}`,
      ).toBeLessThanOrEqual(MAX_WORDS);
    }
  });

  it('TIER_BOUNDS values match expected constants exactly — any change here is deliberate', () => {
    expect(TIER_BOUNDS.T1).toEqual({ min: 150, max: 210 });
    expect(TIER_BOUNDS.T2).toEqual({ min: 175, max: 260 });
    expect(TIER_BOUNDS.T3).toEqual({ min: 225, max: 310 });
    expect(TIER_BOUNDS.T4).toEqual({ min: 275, max: 350 });
  });

  it('tier max values are strictly increasing — cognitive differentiation preserved', () => {
    expect(TIER_BOUNDS.T1.max).toBeLessThan(TIER_BOUNDS.T2.max);
    expect(TIER_BOUNDS.T2.max).toBeLessThan(TIER_BOUNDS.T3.max);
    expect(TIER_BOUNDS.T3.max).toBeLessThan(TIER_BOUNDS.T4.max);
  });
});

describe('word_cap — oversized chunk (600 words) rejected at extract layer', () => {

  it('produces zero passage units across all four tiers', () => {
    const book   = makeBook([makeChunk(600)]);
    const result = extractPassageUnits(book);
    expect(totalUnitCount(result)).toBe(0);
  });

  it('600-word block rejected before reaching tier assignment or tag stage', () => {
    // If extractPassageUnits returns nothing, nothing can reach filterParagraph
    // or tagParagraph — the word cap is enforced entirely within the extract layer.
    const book   = makeBook([makeChunk(600)]);
    const result = extractPassageUnits(book);
    for (const tier of TIER_KEYS) {
      expect(result[tier], `${tier} should be empty for 600-word block`).toHaveLength(0);
    }
  });
});

describe('word_cap — undersized chunk (100 words) rejected at extract layer', () => {

  it('produces zero passage units across all four tiers', () => {
    const book   = makeBook([makeChunk(100)]);
    const result = extractPassageUnits(book);
    expect(totalUnitCount(result)).toBe(0);
  });

  it('100-word block rejected before tier assignment — no tier window starts below MIN_WORDS', () => {
    const book   = makeBook([makeChunk(100)]);
    const result = extractPassageUnits(book);
    for (const tier of TIER_KEYS) {
      expect(result[tier], `${tier} should be empty for 100-word block`).toHaveLength(0);
    }
  });
});

describe('word_cap — mixed fixture with both out-of-range chunks', () => {

  it('600-word + 100-word book yields zero passage units', () => {
    // Verifies the two out-of-range chunks don't combine to form valid spans
    const book   = makeBook([makeChunk(600), makeChunk(100)]);
    const result = extractPassageUnits(book);
    expect(totalUnitCount(result)).toBe(0);
  });
});

describe('word_cap — valid chunk (200 words) is accepted in correct tiers', () => {

  it('200-word chunk produces at least one unit — accepted within T1 and/or T2 window', () => {
    // T1: 150–210 ✓  T2: 175–260 ✓  T3: 225–310 ✗  T4: 275–350 ✗
    const book   = makeBook([makeChunk(200)]);
    const result = extractPassageUnits(book);
    expect(totalUnitCount(result)).toBeGreaterThan(0);
  });

  it('200-word chunk does not appear in T3 or T4 (below their min)', () => {
    // 200 < T3.min(225) and 200 < T4.min(275) — must not appear in those tiers
    const book   = makeBook([makeChunk(200)]);
    const result = extractPassageUnits(book);
    expect(result.T3).toHaveLength(0);
    expect(result.T4).toHaveLength(0);
  });

  it('all extracted units have wordCount in [MIN_WORDS, MAX_WORDS]', () => {
    // Tests the invariant: nothing outside the absolute cap ever escapes extract stage
    const book   = makeBook([makeChunk(200), makeChunk(175), makeChunk(280)]);
    const result = extractPassageUnits(book);
    const units  = allUnits(result);

    expect(units.length).toBeGreaterThan(0);

    for (const unit of units) {
      expect(
        unit.wordCount,
        `unit wordCount=${unit.wordCount} is below MIN_WORDS=${MIN_WORDS}`,
      ).toBeGreaterThanOrEqual(MIN_WORDS);
      expect(
        unit.wordCount,
        `unit wordCount=${unit.wordCount} exceeds MAX_WORDS=${MAX_WORDS}`,
      ).toBeLessThanOrEqual(MAX_WORDS);
    }
  });
});

describe('word_cap — multi-paragraph spans respect the cap', () => {

  it('two 280-word blocks produce zero units — too large individually, combined span too large', () => {
    // T4 requires 3+ paragraph spans — two blocks are never attempted.
    // Single-para: 280 > T1.max(210) and T2.max(260), and T3 only tries 2+para spans.
    // 2-para T2: 560 > 260 → rejected; 2-para T3: 560 > 310 → rejected.
    // No 3-para spans available with only 2 blocks.
    const book   = makeBook([makeChunk(280), makeChunk(280)]);
    const result = extractPassageUnits(book);
    expect(totalUnitCount(result)).toBe(0);
  });

  it('three 120-word blocks produce multi-para units all within [MIN_WORDS, MAX_WORDS]', () => {
    // Individual blocks: 120 < T1.min(150) and T2.min(175) — rejected as single-para units.
    // 2-para span (0+1): 240 words → T2(175-260) ✓ — accepted.
    // 2-para span (1+2): same text as 0+1 → content dup → rejected.
    // 3-para span: 360 > T3.max(310) and T4.max(350) → rejected.
    // Net result: one 2-para unit of 240 words, well within [150, 350].
    const book   = makeBook([makeChunk(120), makeChunk(120), makeChunk(120)]);
    const result = extractPassageUnits(book);

    // At least one multi-para unit must be accepted
    expect(totalUnitCount(result)).toBeGreaterThan(0);

    // ALL units — regardless of span length — must be within the absolute cap
    for (const unit of allUnits(result)) {
      expect(
        unit.wordCount,
        `multi-para unit wordCount=${unit.wordCount} below MIN_WORDS`,
      ).toBeGreaterThanOrEqual(MIN_WORDS);
      expect(
        unit.wordCount,
        `multi-para unit wordCount=${unit.wordCount} exceeds MAX_WORDS`,
      ).toBeLessThanOrEqual(MAX_WORDS);
    }
  });

  it('3-para span of 360 words is rejected — above MAX_WORDS, not extracted', () => {
    // 3 × 120 = 360 > MAX_WORDS(350). The 3-para span is tried by T3 and T4
    // but rejected at the per-tier word-count check. The safety guard also fires.
    const book  = makeBook([makeChunk(120), makeChunk(120), makeChunk(120)]);
    const result = extractPassageUnits(book);

    // No unit should have wordCount > MAX_WORDS
    for (const unit of allUnits(result)) {
      expect(unit.wordCount).toBeLessThanOrEqual(MAX_WORDS);
    }
  });
});
