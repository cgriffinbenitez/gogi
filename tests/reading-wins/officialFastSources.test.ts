import { describe, expect, it } from 'vitest';
import {
  OFFICIAL_FAST_TEXT_MODELS,
  getOfficialFastCoverageSummary,
  getOfficialFastPipelineSeedsForStandard,
  getOfficialFastTextModelsForStandard,
  findOfficialFastTextModelsBySource,
} from '../../src/lib/reading-wins/officialFastSources';

describe('official FAST/B.E.S.T. source map', () => {
  it('prioritizes official public-domain models for ELA.9.R.3.1', () => {
    const seeds = getOfficialFastPipelineSeedsForStandard('ELA.9.R.3.1');

    expect(seeds?.priorityAuthors).toContain('Sarah Orne Jewett');
    expect(seeds?.priorityAuthors).toContain('William Shakespeare');
    expect(seeds?.priorityAuthors).toContain('Leo Tolstoy');
    expect(seeds?.officialGutenbergSeeds.map((seed) => seed.gutenbergId)).toEqual(
      expect.arrayContaining([74980, 9313, 1513, 72472])
    );
    expect(seeds?.officialGutenbergSeeds.find((seed) => seed.gutenbergId === 74980)).toMatchObject({
      sectionStart: 'A WHITE HERON.',
      sectionEnd: 'THE FLIGHT OF BETSEY LANE.',
    });
    expect(seeds?.gutendexSearchTerms.some((term) => term.includes('A White Heron'))).toBe(true);
  });

  it('keeps rights-limited official texts as references instead of harvest seeds', () => {
    const seeds = getOfficialFastPipelineSeedsForStandard('ELA.9.R.2.4');

    expect(seeds?.priorityAuthors).not.toContain('Stephanie Hayes');
    expect(seeds?.referenceModels.map((model) => model.title)).toContain(
      'Do People Need Small Talk to Be Happy?'
    );
  });

  it('maps official models back to the Grade 9 standards they support', () => {
    const models = getOfficialFastTextModelsForStandard('ELA.9.R.3.3');

    expect(models.map((model) => model.title)).toContain('Icarus and Daedalus');
    expect(models.map((model) => model.title)).toContain('Old Greek Stories');
  });

  it('summarizes coverage so gaps are visible before a harvest run', () => {
    const summary = getOfficialFastCoverageSummary();

    expect(summary.find((row) => row.standardCode === 'ELA.9.R.3.1')?.prioritySeeds).toBeGreaterThan(0);
    expect(summary.find((row) => row.standardCode === 'ELA.9.R.2.4')?.references).toBeGreaterThan(0);
  });

  it('contains the full official B.E.S.T. Grade 9 sample-text matrix', () => {
    const bestTexts = OFFICIAL_FAST_TEXT_MODELS.filter(
      (model) => model.sourceDocument === 'Florida B.E.S.T. ELA Standards'
    );

    expect(bestTexts).toHaveLength(35);
    expect(bestTexts.map((model) => model.title)).toContain('The Odyssey');
    expect(bestTexts.map((model) => model.title)).toContain('Unbroken: An Olympian’s Journey from Airman to Castaway to Captive (Adapted for Young Adults)');
    expect(getOfficialFastTextModelsForStandard('ELA.9.R.3.2').length).toBeGreaterThan(30);
  });

  it('matches a manually imported title back to its official standards', () => {
    const models = findOfficialFastTextModelsBySource({
      sourceTitle: 'Letter from Birmingham Jail',
      sourceAuthor: 'Martin Luther King, Jr.',
    });
    const standards = new Set(models.flatMap((model) => model.standards));

    expect(models.map((model) => model.title)).toContain('Letter from Birmingham Jail');
    expect([...standards]).toEqual(
      expect.arrayContaining(['ELA.9.R.2.1', 'ELA.9.R.2.4', 'ELA.9.R.3.4'])
    );
  });

  it('matches common MLK shorthand titles back to official texts', () => {
    const models = findOfficialFastTextModelsBySource({
      sourceTitle: "MLK's I Have a Dream",
      sourceAuthor: 'MLK',
    });
    const standards = new Set(models.flatMap((model) => model.standards));

    expect(models.map((model) => model.title)).toContain('I Have a Dream');
    expect([...standards]).toEqual(
      expect.arrayContaining(['ELA.9.R.2.3', 'ELA.9.R.3.1', 'ELA.9.R.3.4'])
    );
  });
});
