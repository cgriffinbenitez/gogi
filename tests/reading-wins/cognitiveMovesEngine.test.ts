import { describe, expect, it } from 'vitest';
import {
  COGNITIVE_MOVE_PROFILES,
  CROSS_BENCHMARK_PRIMITIVES,
  estimateCognitiveDifficulty,
  FORMAT_PROTOCOLS,
  getCognitiveMoveProfile,
} from '../../src/lib/reading-wins/cognitiveMovesEngine';
import { FAST_GRADE9_RELEASED_BENCHMARKS } from '../../src/lib/reading-wins/fastSkillMap';

describe('Cognitive moves intervention engine', () => {
  it('defines a cognitive move profile for every released Grade 9 FAST benchmark', () => {
    for (const benchmark of FAST_GRADE9_RELEASED_BENCHMARKS) {
      expect(getCognitiveMoveProfile(benchmark), benchmark).not.toBeNull();
    }
  });

  it('instruments chain, breakpoints, and teaching protocol for every profile', () => {
    for (const profile of Object.values(COGNITIVE_MOVE_PROFILES)) {
      expect(profile.honestSkillName.length).toBeGreaterThan(8);
      expect(profile.chain.length).toBeGreaterThanOrEqual(3);
      expect(profile.breakpoints.length).toBeGreaterThanOrEqual(2);
      expect(profile.teachingProtocol.length).toBeGreaterThanOrEqual(2);
      expect(profile.engineImplication.length).toBeGreaterThan(30);
    }
  });

  it('models the issue #21 format effect explicitly', () => {
    expect(FORMAT_PROTOCOLS.evidence_based_2_part.addedMoves).toBeGreaterThan(
      FORMAT_PROTOCOLS.single_stem.addedMoves
    );
    expect(FORMAT_PROTOCOLS.matrix.addedMoves).toBeGreaterThan(
      FORMAT_PROTOCOLS.multi_select.addedMoves
    );
  });

  it('uses move-count and move-weight to tier difficulty', () => {
    const figurativeMood = getCognitiveMoveProfile('ELA.9.R.3.1')!;
    const pairedArgument = getCognitiveMoveProfile('ELA.9.R.2.4')!;

    const moodDifficulty = estimateCognitiveDifficulty(figurativeMood, 'single_stem');
    const argumentDifficulty = estimateCognitiveDifficulty(pairedArgument, 'matrix');

    expect(argumentDifficulty.totalLoad).toBeGreaterThan(moodDifficulty.totalLoad);
    expect(argumentDifficulty.tier).toBe('T4');
  });

  it('captures content versus function as a cross-benchmark primitive', () => {
    const primitive = CROSS_BENCHMARK_PRIMITIVES.find((item) => item.id === 'content-vs-function');

    expect(primitive?.appliesTo).toEqual(
      expect.arrayContaining(['ELA.9.R.1.1', 'ELA.9.R.2.1', 'ELA.9.R.3.4'])
    );
  });
});
