import type { SourceConfig } from './types';
import { getOfficialFastPipelineSeedsForStandard } from '../lib/reading-wins/officialFastSources';

function unique(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

export function applyOfficialFastSourcePriority(
  sources: SourceConfig,
  standardCode?: string,
  options: { expandBeyondOfficial?: boolean } = {}
): { sources: SourceConfig; logLines: string[] } {
  if (!standardCode) return { sources, logLines: [] };

  const seeds = getOfficialFastPipelineSeedsForStandard(standardCode);
  if (!seeds || (!seeds.priorityAuthors.length && !seeds.gutendexSearchTerms.length)) {
    return {
      sources,
      logLines: [`  [official-source] ${standardCode}: no official FAST/B.E.S.T. public-domain seeds configured yet.`],
    };
  }

  const priorityTitles = seeds.priorityModels.map((model) => model.title).join('; ');
  const referenceTitles = seeds.referenceModels.map((model) => model.title).join('; ');

  return {
    sources: {
      ...sources,
      officialGutenbergSeeds: [
        ...seeds.officialGutenbergSeeds,
        ...(options.expandBeyondOfficial ? (sources.officialGutenbergSeeds ?? []) : []),
      ],
      officialOnly: !options.expandBeyondOfficial,
      priorityAuthors: options.expandBeyondOfficial
        ? unique([...seeds.priorityAuthors, ...sources.priorityAuthors])
        : unique(seeds.priorityAuthors),
      gutendexSearchTerms: options.expandBeyondOfficial
        ? unique([...seeds.gutendexSearchTerms, ...sources.gutendexSearchTerms])
        : unique(seeds.gutendexSearchTerms),
    },
    logLines: [
      `  [official-source] ${standardCode}: prioritizing public-domain FAST/B.E.S.T. seeds: ${priorityTitles}`,
      referenceTitles
        ? `  [official-source] ${standardCode}: using rights-limited official texts as style references only: ${referenceTitles}`
        : '',
    ].filter(Boolean),
  };
}
