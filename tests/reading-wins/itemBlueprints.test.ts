import { describe, expect, it } from 'vitest';
import { GUTENBERG_STANDARD_BLUEPRINTS } from '../../src/pipeline/standardBlueprints';
import {
  buildFastItemStem,
  getFastItemBlueprint,
  getFastItemBlueprintCoverageSummary,
  stemFitsFastItemBlueprint,
} from '../../src/lib/reading-wins/itemBlueprints';

describe('FAST item blueprints', () => {
  it('covers every Gutenberg standard and coverage strand with an item blueprint', () => {
    const summary = getFastItemBlueprintCoverageSummary();
    const byStandard = new Map(summary.map((item) => [item.standardCode, item]));

    for (const pipelineBlueprint of GUTENBERG_STANDARD_BLUEPRINTS) {
      const itemBlueprint = getFastItemBlueprint(pipelineBlueprint.standardCode);
      expect(itemBlueprint, `${pipelineBlueprint.standardCode} is missing`).toBeTruthy();
      expect(byStandard.get(pipelineBlueprint.standardCode)?.complete).toBe(true);
      expect(byStandard.get(pipelineBlueprint.standardCode)?.itemStrands).toBeGreaterThanOrEqual(
        pipelineBlueprint.coverageStrands?.length ?? 0
      );
    }
  });

  it('builds specific strand stems instead of generic standard stems', () => {
    const r31Stem = buildFastItemStem({
      standardCode: 'ELA.9.R.3.1',
      strandId: 'metaphor-simile',
      evidenceText: 'a dawn that was ashy and furtive, as though associated with crime',
    });
    expect(r31Stem).toContain('comparison');
    expect(r31Stem).not.toContain('purpose of the figurative language');
    expect(r31Stem).not.toMatch(/what does .*suggest in context/i);

    const r22Stem = buildFastItemStem({
      standardCode: 'ELA.9.R.2.2',
      strandId: 'strong-vs-weak-evidence',
      evidenceText: 'the city had spent twice as much on repairs',
    });
    expect(r22Stem).toMatch(/evidence|central idea/i);
  });

  it('rejects stems that do not fit the selected strand', () => {
    expect(
      stemFitsFastItemBlueprint({
        standardCode: 'ELA.9.R.3.1',
        strandId: 'metaphor-simile',
        stem: 'Which choice best explains the purpose of the figurative language in the passage?',
      })
    ).toBe(false);

    expect(
      stemFitsFastItemBlueprint({
        standardCode: 'ELA.9.R.3.1',
        strandId: 'metaphor-simile',
        stem: 'Read this comparison from the passage: “the road was a ribbon of dust.” What does it suggest in context?',
      })
    ).toBe(false);

    expect(
      stemFitsFastItemBlueprint({
        standardCode: 'ELA.9.R.3.1',
        strandId: 'metaphor-simile',
        stem: 'How does the comparison in “the road was a ribbon of dust” help develop the meaning of the passage?',
      })
    ).toBe(true);
  });
});
