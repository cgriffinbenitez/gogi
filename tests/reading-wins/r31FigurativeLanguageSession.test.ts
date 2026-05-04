import { describe, expect, it } from 'vitest';
import { R31_FIGURATIVE_LANGUAGE_SESSION } from '../../src/lib/reading-wins/r31FigurativeLanguageSession';
import { FAST_BENCHMARK_PATTERNS } from '../../src/lib/original-items/engine';

describe('R.3.1 figurative language Reading Win session', () => {
  it('uses the pilot remediation loop shape: five scaffolded reps plus transfer', () => {
    expect(R31_FIGURATIVE_LANGUAGE_SESSION.items).toHaveLength(5);
    expect(R31_FIGURATIVE_LANGUAGE_SESSION.transferItem.transfer).toBe(true);

    for (const item of R31_FIGURATIVE_LANGUAGE_SESSION.items) {
      expect(item.benchmarkCode).toBe('ELA.9.R.3.1');
      expect(item.options).toHaveLength(4);
      expect(item.options).toContain(item.correctAnswer);
      expect(item.scaffold.length).toBeGreaterThan(40);
      expect(item.workedExample.length).toBeGreaterThan(40);
    }
  });

  it('progresses difficulty and teaches broader figurative-language effect, not mood only', () => {
    expect(R31_FIGURATIVE_LANGUAGE_SESSION.items.map((item) => item.difficulty)).toEqual([
      1, 2, 3, 4, 5,
    ]);

    const prompts = [
      ...R31_FIGURATIVE_LANGUAGE_SESSION.items.map((item) => item.prompt),
      R31_FIGURATIVE_LANGUAGE_SESSION.transferItem.prompt,
    ].join(' ');

    expect(prompts).toContain('reader’s understanding');
    expect(prompts).toContain('meaning');
    expect(prompts.match(/mood/g)?.length ?? 0).toBeLessThan(2);
  });

  it('keeps the original item generator aligned to the same R.3.1 blueprint', () => {
    const [pattern] = FAST_BENCHMARK_PATTERNS['ELA.9.R.3.1'];

    expect(pattern.id).toBe('r331-figurative-effect');
    expect(pattern.passageType).toBe('literary');
    expect(pattern.correctAnswerMoves.join(' ')).toContain('reader understanding');
    expect(pattern.stemFrames.join(' ')).toContain('context');
  });
});
