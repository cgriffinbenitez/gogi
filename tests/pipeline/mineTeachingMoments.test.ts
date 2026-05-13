import { describe, expect, it } from 'vitest';
import { mineTeachingMoment } from '../../src/pipeline/stages/mineTeachingMoments';
import type { Paragraph, PipelineOptions } from '../../src/pipeline/types';

const opts: PipelineOptions = {
  classification: 'figurative_language_failure',
  standardCode: 'ELA.9.R.3.1',
  coverageStrandId: 'metaphor-simile',
  coverageStrandLabel: 'Metaphor and simile',
  coverageSignals: ['metaphor', 'simile', 'comparison without literal intent'],
  max: 4,
  maxBooks: 1,
  dryRun: true,
  writeAllPassed: false,
};

function paragraph(text: string): Paragraph {
  return {
    text,
    wordCount: text.split(/\s+/).filter(Boolean).length,
    paragraphCount: 1,
    sourceTitle: 'A White Heron',
    sourceAuthor: 'Sarah Orne Jewett',
    sourceYear: 1886,
    gutenbergId: 74980,
    hash: 'test-hash',
  };
}

describe('teaching moment miner', () => {
  it('accepts an exact figurative-language teaching moment before the expensive filter', () => {
    const text =
      'Mara paused at the edge of the porch while the storm moved over the field. The clouds gathered above the house as if they were a closed fist, and the road disappeared under the rain. She did not run inside at once. She watched the fence posts fade one by one until the whole yard looked uncertain. The comparison made the weather feel less like background and more like pressure around her choice. When the lamp in the kitchen finally appeared behind the glass, it looked small but steady. Her brother called from the doorway, but she kept looking toward the road because the storm made the empty distance seem almost personal. The scene gives a student enough context to connect the comparison to pressure, danger, and hesitation.';

    const result = mineTeachingMoment(paragraph(text), opts);

    expect(result.accepted).toBe(true);
    expect(result.targetEvidence).toMatch(/as if they were a closed fist/i);
    expect(result.suggestedFastStem).toMatch(/Read this phrase from the passage/i);
  });

  it('keeps official-aligned content even when the exact strand is not labeled yet', () => {
    const text =
      'Sylvia crossed the pasture after dinner and stopped beside the low stone wall. She could hear a wagon somewhere beyond the trees, and she waited until the sound faded before walking on. The path bent toward the orchard, then toward the old gate near the hill. Nothing unusual happened, but she remembered the way her grandmother had warned her not to stay out too late. By the time she reached the house, the lamp had been lit and supper dishes were already stacked by the sink. Her grandmother asked where she had been, and Sylvia answered quietly. The scene has plot movement, setting, and character action, but it does not contain a clean comparison that could support a metaphor or simile question.';

    const result = mineTeachingMoment(paragraph(text), opts);

    expect(result.accepted).toBe(true);
    expect(result.qualitySignal).toBe('emerging_signal');
    expect(result.reasons.join(' ')).toMatch(/kept; no exact/i);
    expect(result.targetEvidence).toBeUndefined();
  });

  it('keeps high-friction official content but warns before question generation', () => {
    const text =
      'Clare arose in the light of a dawn that was ashy and furtive, as though associated with crime. The fireplace confronted him with its extinct embers; the spread supper-table, whereon stood the two full glasses of untasted wine, now flat and filmy; her vacated seat and his own; the other articles of furniture had an intolerable inquiry what was to be done. Perchance the cottager would come thither before he could decide. Wherefore he stood still, facile in preparations but unable to move toward the door.';

    const result = mineTeachingMoment(paragraph(text), opts);

    expect(result.accepted).toBe(true);
    expect(result.warnings?.join(' ')).toMatch(/decoding friction|short/i);
  });
});
