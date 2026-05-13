import { describe, expect, it } from 'vitest';
import { certifyPassageForPipeline } from '../../src/pipeline/stages/certify';
import type { FilterResult, Paragraph, PipelineOptions, TagResultV3 } from '../../src/pipeline/types';

const baseParagraph: Paragraph = {
  text:
    'Clara stood by the window as the fog pressed close to the glass. The street lamps blurred into pale circles, and the unopened letter waited on the table as if it were something that might wake. She reached for it, stopped, and listened to the wheels outside fade into silence. Nothing in the room moved, yet the quiet seemed to gather around the letter, making the ordinary paper feel important and dangerous.',
  wordCount: 86,
  paragraphCount: 1,
  sourceTitle: 'The Letter at Dusk',
  sourceAuthor: 'GOGI Public Domain Test',
  sourceYear: 1899,
  gutenbergId: 71000,
  hash: 'clean-passage-001',
};

const baseFilter: FilterResult = {
  suitable: true,
  reasoning: 'self-contained figurative language with pointable evidence',
  q1: 'pass',
  q2: 'pass',
  q3: 'pass',
  q4: 'pass',
  q5: 'pass',
  q5_patterns_supported: ['5a'],
};

const baseOpts: PipelineOptions = {
  classification: 'figurative_language_failure',
  standardCode: 'ELA.9.R.3.1',
  coverageStrandId: 'metaphor-simile',
  coverageStrandLabel: 'Metaphor and simile',
  coverageSignals: ['metaphor', 'simile', 'comparison without literal intent'],
  max: 1,
  maxBooks: 1,
  dryRun: false,
  writeAllPassed: false,
};

const baseTag: TagResultV3 = {
  target_signal: 'simile',
  item_patterns_supported: ['5a'],
  supporting_evidence: [
    {
      element: 'as if it were something that might wake',
      rationale: 'makes the letter seem threatening or alive instead of ordinary',
    },
  ],
  non_supporting_evidence: [
    {
      element: 'Clara stood by the window',
      rationale: 'names where Clara is but does not explain the comparison',
    },
    {
      element: 'the street lamps blurred into pale circles',
      rationale: 'describes the setting but does not explain the simile',
    },
  ],
  discrimination_item_type: 'sentence_level',
  intervention_tier: 2,
  tier_rationale: 'T2 because the target comparison is clear but needs context.',
};

describe('pipeline certification gate', () => {
  it('certifies a passage only when it can produce a clean FAST-style item', () => {
    const result = certifyPassageForPipeline({
      paragraph: baseParagraph,
      filterResult: baseFilter,
      tagResult: baseTag,
      opts: baseOpts,
    });

    expect(result.certified).toBe(true);
    expect(result.confidence).toBe('strong signal');
  });

  it('rejects high-friction teacher-analysis passages before write', () => {
    const result = certifyPassageForPipeline({
      paragraph: {
        ...baseParagraph,
        text:
          'Clare arose in the light of a dawn that was ashy and furtive, as though associated with crime. The fireplace confronted him with its extinct embers; the spread supper-table, whereon stood the two full glasses of untasted wine, now flat and filmy; her vacated seat and his own; the other articles of furniture, with their eternal look of not being able to help it, their intolerable inquiry what was to be done? From above there was no sound; but in a few minutes there came a knock at the door. He remembered that it would be the neighbouring cottager’s wife, whereon he opened the window.',
        wordCount: 105,
      },
      filterResult: baseFilter,
      tagResult: {
        ...baseTag,
        supporting_evidence: [
          {
            element:
              'the other articles of furniture, with their eternal look of not being able to help it',
            rationale:
              'The personification of furniture enacts oppression as a physical, unavoidable weight.',
          },
        ],
      },
      opts: baseOpts,
    });

    expect(result.certified).toBe(false);
    expect(result.reasons.join(' ')).toMatch(/teacher-analysis|high-friction/i);
  });
});
