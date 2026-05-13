import { describe, expect, it } from 'vitest';
import {
  buildSkillMoveScaffold,
  getReadingSkillMove,
  getReadingSkillMovesForStandard,
  getSkillMoveCoverageSummary,
} from '../../src/lib/reading-wins/skillMoveMap';

describe('ELA 9 skill move map', () => {
  it('maps a standard and strand to a specific teachable reading move', () => {
    const move = getReadingSkillMove({
      standardCode: 'ELA.9.R.3.1',
      strandId: 'metaphor-simile',
    });

    expect(move?.label).toBe('Metaphor and simile');
    expect(move?.passageMustHave.join(' ')).toContain('pointable comparison');
    expect(move?.fastStemFocus.join(' ')).toContain('effect');
  });

  it('covers the Grade 9 FAST standards with at least one pilot skill move each', () => {
    const standards = getSkillMoveCoverageSummary().map((item) => item.standardCode);

    expect(standards).toEqual(
      expect.arrayContaining([
        'ELA.9.R.1.1',
        'ELA.9.R.1.2',
        'ELA.9.R.1.3',
        'ELA.9.R.2.1',
        'ELA.9.R.2.2',
        'ELA.9.R.2.3',
        'ELA.9.R.2.4',
        'ELA.9.R.3.1',
        'ELA.9.R.3.3',
        'ELA.9.R.3.4',
        'ELA.9.V.1.2',
        'ELA.9.V.1.3',
      ])
    );
    expect(getReadingSkillMovesForStandard('ELA.9.R.3.1').length).toBeGreaterThanOrEqual(2);
  });

  it('builds a student-facing scaffold from the mapped skill move', () => {
    const scaffold = buildSkillMoveScaffold({
      standardCode: 'ELA.9.R.3.1',
      targetSkill: 'Metaphor and simile',
      fallbackMove: 'Explain the effect of figurative language.',
    });

    expect(scaffold).toContain("Today's skill: Metaphor and simile.");
    expect(scaffold).toContain('Mastery means:');
    expect(scaffold).toContain('what two things are being connected');
  });
});
