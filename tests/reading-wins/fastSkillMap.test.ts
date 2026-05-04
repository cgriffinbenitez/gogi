import { describe, expect, it } from 'vitest';
import {
  FAST_GRADE9_READING_DEMANDS,
  FAST_GRADE9_RELEASED_BENCHMARKS,
  getFastReadingDemandsForStandard,
} from '../../src/lib/reading-wins/fastSkillMap';
import {
  FAST_BENCHMARK_PATTERNS,
  ORIGINAL_ITEM_BENCHMARKS,
} from '../../src/lib/original-items/engine';

describe('FAST Grade 9 Reading Win skill map', () => {
  it('covers every benchmark observed in the 2025 Grade 9 FAST release', () => {
    for (const benchmark of FAST_GRADE9_RELEASED_BENCHMARKS) {
      expect(getFastReadingDemandsForStandard(benchmark), benchmark).not.toHaveLength(0);
    }
  });

  it('defines concrete student moves and proof of growth for every demand', () => {
    for (const demand of FAST_GRADE9_READING_DEMANDS) {
      expect(demand.studentTitle.length).toBeGreaterThan(10);
      expect(demand.fastDemand.length).toBeGreaterThan(40);
      expect(demand.commonMiss.length).toBeGreaterThan(40);
      expect(demand.studentMove.length).toBeGreaterThan(20);
      expect(demand.microDiagnostic.length).toBeGreaterThan(30);
      expect(demand.proofOfGrowth.length).toBeGreaterThan(30);
      expect(demand.itemShape.length).toBeGreaterThan(30);
      expect(demand.readingWinLoop.length).toBeGreaterThanOrEqual(4);
    }
  });

  it('treats two-passage argument comparison as its own teaching demand', () => {
    const [demand] = getFastReadingDemandsForStandard('ELA.9.R.2.4');

    expect(demand.studentMove).toContain('two-column claim map');
    expect(demand.itemShape).toContain('Multiple-select table');
  });

  it('keeps the original item engine aligned to the released FAST benchmark set', () => {
    expect(ORIGINAL_ITEM_BENCHMARKS).toEqual(
      expect.arrayContaining([...FAST_GRADE9_RELEASED_BENCHMARKS])
    );

    for (const benchmark of FAST_GRADE9_RELEASED_BENCHMARKS) {
      expect(FAST_BENCHMARK_PATTERNS[benchmark], benchmark).not.toHaveLength(0);
    }
  });
});
