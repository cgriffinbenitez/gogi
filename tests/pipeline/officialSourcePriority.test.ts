import { describe, expect, it } from 'vitest';
import { applyOfficialFastSourcePriority } from '../../src/pipeline/officialSourcePriority';
import type { SourceConfig } from '../../src/pipeline/types';

const baseSources: SourceConfig = {
  priorityAuthors: ['Kate Chopin'],
  gutendexSearchTerms: ['regional realism'],
};

describe('official FAST source priority overlay', () => {
  it('prepends official source authors and terms without losing existing config', () => {
    const { sources, logLines } = applyOfficialFastSourcePriority(baseSources, 'ELA.9.R.3.1');

    expect(sources.priorityAuthors.slice(0, 2)).toEqual([
      'Sarah Orne Jewett',
      'Josephine Preston Peabody',
    ]);
    expect(sources.priorityAuthors).toContain('William Shakespeare');
    expect(sources.priorityAuthors).toContain('Leo Tolstoy');
    expect(sources.priorityAuthors).toContain('Kate Chopin');
    expect(sources.officialGutenbergSeeds?.map((seed) => seed.gutenbergId)).toEqual(
      expect.arrayContaining([74980, 9313, 1513, 72472])
    );
    expect(sources.gutendexSearchTerms.some((term) => term.includes('A White Heron'))).toBe(true);
    expect(sources.gutendexSearchTerms).toContain('regional realism');
    expect(logLines.join('\n')).toContain('style references only');
  });

  it('leaves legacy classification-only harvests unchanged', () => {
    const { sources, logLines } = applyOfficialFastSourcePriority(baseSources);

    expect(sources).toEqual(baseSources);
    expect(logLines).toEqual([]);
  });
});
