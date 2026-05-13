import type { FastGrade9ReleasedBenchmark } from './fastSkillMap';

export type OfficialEla9Benchmark =
  | FastGrade9ReleasedBenchmark
  | 'ELA.9.R.1.4'
  | 'ELA.9.R.3.2';

export type OfficialFastTextAccess =
  | 'public_domain'
  | 'educational_purpose'
  | 'copyright_permission'
  | 'reference_only';

export type OfficialFastPipelineUse =
  | 'priority_seed'
  | 'style_model_only'
  | 'rights_limited_reference';

export type OfficialFastTextModel = {
  title: string;
  author?: string;
  sourceDocument: '2025 Grade 9 FAST ELA Reading Released Items' | 'Florida B.E.S.T. ELA Standards';
  sourceUrl: string;
  access: OfficialFastTextAccess;
  pipelineUse: OfficialFastPipelineUse;
  standards: OfficialEla9Benchmark[];
  itemNumbers?: number[];
  benchmarkCounts?: Partial<Record<FastGrade9ReleasedBenchmark, number>>;
  gutenbergIds?: number[];
  sectionStart?: string;
  sectionEnd?: string;
  priorityAuthors?: string[];
  gutendexSearchTerms?: string[];
  notes: string;
};

export type OfficialFastPipelineSeeds = {
  standardCode: OfficialEla9Benchmark;
  priorityModels: OfficialFastTextModel[];
  referenceModels: OfficialFastTextModel[];
  priorityAuthors: string[];
  gutendexSearchTerms: string[];
  officialGutenbergSeeds: Array<{
    gutenbergId: number;
    title: string;
    author: string;
  }>;
};

export const FLDOE_BEST_STANDARDS_URL =
  'https://www.fldoe.org/core/fileparse.php/7539/urlt/elabeststandardsfinal.pdf';

export const FLFAST_GRADE9_RELEASED_ITEMS_URL =
  'https://flfast.org/content/contentresources/en/2025%20Test%20Release%20Support%20Document%20Practice%20Test%20Reading%20Grade%209_508.pdf';

const RELEASED_FAST_GRADE9_TEXT_MODELS: OfficialFastTextModel[] = [
  {
    title: 'A White Heron',
    author: 'Sarah Orne Jewett',
    sourceDocument: '2025 Grade 9 FAST ELA Reading Released Items',
    sourceUrl: FLFAST_GRADE9_RELEASED_ITEMS_URL,
    access: 'public_domain',
    pipelineUse: 'priority_seed',
    standards: ['ELA.9.R.1.1', 'ELA.9.R.1.2', 'ELA.9.R.1.3', 'ELA.9.R.3.1', 'ELA.9.R.3.4', 'ELA.9.V.1.3'],
    itemNumbers: [1, 2, 3, 4, 5, 6, 7, 8],
    benchmarkCounts: {
      'ELA.9.R.1.1': 1,
      'ELA.9.R.1.2': 2,
      'ELA.9.R.1.3': 1,
      'ELA.9.R.3.1': 2,
      'ELA.9.R.3.4': 1,
      'ELA.9.V.1.3': 1,
    },
    priorityAuthors: ['Sarah Orne Jewett'],
    gutenbergIds: [74980],
    sectionStart: 'A WHITE HERON.',
    sectionEnd: 'THE FLIGHT OF BETSEY LANE.',
    gutendexSearchTerms: ['A White Heron Sarah Orne Jewett', 'Sarah Orne Jewett short stories'],
    notes:
      'Official Grade 9 FAST released literary model. Use as a legal public-domain seed and as a benchmark for excerpt length, pointable evidence, and stem specificity.',
  },
  {
    title: 'Small Talk Is Overrated',
    sourceDocument: '2025 Grade 9 FAST ELA Reading Released Items',
    sourceUrl: FLFAST_GRADE9_RELEASED_ITEMS_URL,
    access: 'educational_purpose',
    pipelineUse: 'style_model_only',
    standards: ['ELA.9.R.2.1', 'ELA.9.R.3.1', 'ELA.9.R.3.4'],
    itemNumbers: [9, 10, 11, 12],
    benchmarkCounts: {
      'ELA.9.R.2.1': 1,
      'ELA.9.R.3.1': 1,
      'ELA.9.R.3.4': 2,
    },
    gutendexSearchTerms: ['short essay conversation purpose small talk rhetoric'],
    notes:
      'Official FAST informational style model. Use for structure, pairing, and stem logic; do not harvest as reusable source text.',
  },
  {
    title: 'Do People Need Small Talk to Be Happy?',
    author: 'Stephanie Hayes',
    sourceDocument: '2025 Grade 9 FAST ELA Reading Released Items',
    sourceUrl: FLFAST_GRADE9_RELEASED_ITEMS_URL,
    access: 'copyright_permission',
    pipelineUse: 'rights_limited_reference',
    standards: ['ELA.9.R.2.1', 'ELA.9.R.2.2', 'ELA.9.R.2.3', 'ELA.9.R.2.4', 'ELA.9.V.1.2', 'ELA.9.V.1.3'],
    itemNumbers: [13, 14, 15, 16, 17, 18, 19, 20],
    benchmarkCounts: {
      'ELA.9.R.2.1': 1,
      'ELA.9.R.2.2': 1,
      'ELA.9.R.2.3': 1,
      'ELA.9.R.2.4': 3,
      'ELA.9.V.1.2': 1,
      'ELA.9.V.1.3': 1,
    },
    notes:
      'Official FAST paired-informational reference. Use to model opposing-argument, central-idea, and vocabulary item design; rights limit reusable passage harvesting.',
  },
  {
    title: 'Icarus and Daedalus',
    author: 'Josephine Preston Peabody',
    sourceDocument: '2025 Grade 9 FAST ELA Reading Released Items',
    sourceUrl: FLFAST_GRADE9_RELEASED_ITEMS_URL,
    access: 'public_domain',
    pipelineUse: 'priority_seed',
    standards: ['ELA.9.R.1.1', 'ELA.9.R.1.2', 'ELA.9.R.1.3', 'ELA.9.R.3.1', 'ELA.9.R.3.3', 'ELA.9.V.1.3'],
    itemNumbers: [21, 22, 23, 24, 25, 26, 27, 28, 29, 30],
    benchmarkCounts: {
      'ELA.9.R.1.1': 2,
      'ELA.9.R.1.2': 2,
      'ELA.9.R.1.3': 2,
      'ELA.9.R.3.1': 1,
      'ELA.9.R.3.3': 2,
      'ELA.9.V.1.3': 1,
    },
    priorityAuthors: ['Josephine Preston Peabody'],
    gutenbergIds: [9313],
    sectionStart: 'ICARUS AND DAEDALUS.',
    sectionEnd: 'PHAETHON.',
    gutendexSearchTerms: [
      'Icarus and Daedalus Josephine Preston Peabody',
      'Old Greek Folk Stories Told Anew Josephine Preston Peabody',
    ],
    notes:
      'Official Grade 9 FAST myth/adaptation model. Strong priority seed for R.3.3 and literary-remediation passages when the source pattern is self-contained.',
  },
  {
    title: 'Icarus After the Fall',
    sourceDocument: '2025 Grade 9 FAST ELA Reading Released Items',
    sourceUrl: FLFAST_GRADE9_RELEASED_ITEMS_URL,
    access: 'educational_purpose',
    pipelineUse: 'style_model_only',
    standards: ['ELA.9.R.1.1', 'ELA.9.R.1.2', 'ELA.9.R.1.3', 'ELA.9.R.3.3'],
    itemNumbers: [24, 25, 26, 28, 29, 30],
    notes:
      'Official FAST adaptation-pair model. Use for question architecture and source/adaptation comparison; do not harvest as reusable source text.',
  },
  {
    title: 'The Face of Science',
    author: 'Sam Kean',
    sourceDocument: '2025 Grade 9 FAST ELA Reading Released Items',
    sourceUrl: FLFAST_GRADE9_RELEASED_ITEMS_URL,
    access: 'public_domain',
    pipelineUse: 'style_model_only',
    standards: ['ELA.9.R.2.1', 'ELA.9.R.2.2', 'ELA.9.R.3.4'],
    itemNumbers: [31, 32, 33, 34, 35, 36],
    benchmarkCounts: {
      'ELA.9.R.2.1': 2,
      'ELA.9.R.2.2': 2,
      'ELA.9.R.3.4': 2,
    },
    gutendexSearchTerms: ['public domain science essay author purpose central idea rhetoric'],
    notes:
      'Official FAST informational model. Use for central idea and rhetoric item shape; not a Gutenberg seed because the source is not a Gutenberg book.',
  },
];

function bestTextModel(args: {
  title: string;
  author?: string;
  access: OfficialFastTextAccess;
  pipelineUse?: OfficialFastPipelineUse;
  standards: OfficialEla9Benchmark[];
  gutenbergIds?: number[];
  sectionStart?: string;
  sectionEnd?: string;
  priorityAuthors?: string[];
  gutendexSearchTerms?: string[];
}) {
  return {
    title: args.title,
    author: args.author,
    sourceDocument: 'Florida B.E.S.T. ELA Standards' as const,
    sourceUrl: FLDOE_BEST_STANDARDS_URL,
    access: args.access,
    pipelineUse:
      args.pipelineUse ??
      (args.access === 'public_domain' ? 'priority_seed' : 'rights_limited_reference'),
    standards: args.standards,
    gutenbergIds: args.gutenbergIds,
    sectionStart: args.sectionStart,
    sectionEnd: args.sectionEnd,
    priorityAuthors: args.priorityAuthors ?? (args.access === 'public_domain' && args.author ? [args.author] : undefined),
    gutendexSearchTerms:
      args.gutendexSearchTerms ??
      (args.access === 'public_domain'
        ? [`${args.title} ${args.author ?? ''}`.trim()]
        : undefined),
    notes:
      args.access === 'public_domain'
        ? 'Official B.E.S.T. Grade 9 sample text. Use as a public-domain priority seed when the excerpt passes GOGI certification.'
        : 'Official B.E.S.T. Grade 9 sample text. Use as a teaching/model reference; rights status limits reusable passage harvesting.',
  };
}

const BEST_GRADE9_TEXT_MODELS: OfficialFastTextModel[] = [
  bestTextModel({
    title: 'A Modest Proposal',
    author: 'Jonathan Swift',
    access: 'public_domain',
    standards: ['ELA.9.R.1.2', 'ELA.9.R.1.3', 'ELA.9.R.2.1', 'ELA.9.R.2.2', 'ELA.9.R.2.3', 'ELA.9.R.2.4', 'ELA.9.R.3.2', 'ELA.9.R.3.4'],
  }),
  bestTextModel({
    title: 'A Very Old Man with Enormous Wings',
    author: 'Gabriel García Márquez',
    access: 'reference_only',
    standards: ['ELA.9.R.1.1', 'ELA.9.R.1.2', 'ELA.9.R.3.2'],
  }),
  bestTextModel({
    title: 'A White Heron',
    author: 'Sarah Orne Jewett',
    access: 'public_domain',
    standards: ['ELA.9.R.1.1', 'ELA.9.R.1.2', 'ELA.9.R.3.1', 'ELA.9.R.3.2'],
  }),
  bestTextModel({
    title: 'Bringing My Son to the Police Station to Be Fingerprinted',
    author: 'Shoshauna Shy',
    access: 'reference_only',
    standards: ['ELA.9.R.1.2', 'ELA.9.R.1.3', 'ELA.9.R.3.2'],
  }),
  bestTextModel({
    title: 'Choice: A Tribute to Dr. Martin Luther King, Jr.',
    author: 'Alice Walker',
    access: 'reference_only',
    standards: ['ELA.9.R.2.1', 'ELA.9.R.2.2', 'ELA.9.R.2.3', 'ELA.9.R.3.2', 'ELA.9.R.3.4'],
  }),
  bestTextModel({
    title: 'I Have a Dream',
    author: 'Martin Luther King, Jr.',
    access: 'reference_only',
    standards: ['ELA.9.R.2.3', 'ELA.9.R.3.1', 'ELA.9.R.3.2', 'ELA.9.R.3.4'],
  }),
  bestTextModel({
    title: 'Industrial Education for the Negro',
    author: 'Booker T. Washington',
    access: 'public_domain',
    standards: ['ELA.9.R.2.2', 'ELA.9.R.2.3', 'ELA.9.R.3.2'],
    gutenbergIds: [15041],
    sectionStart: 'Industrial Education for the Negro',
    sectionEnd: 'The Talented Tenth',
    gutendexSearchTerms: ['The Negro Problem Booker T Washington Industrial Education for the Negro'],
  }),
  bestTextModel({
    title: 'Letter from Birmingham Jail',
    author: 'Martin Luther King, Jr.',
    access: 'reference_only',
    standards: ['ELA.9.R.2.1', 'ELA.9.R.2.2', 'ELA.9.R.2.3', 'ELA.9.R.2.4', 'ELA.9.R.3.1', 'ELA.9.R.3.2', 'ELA.9.R.3.4'],
  }),
  bestTextModel({
    title: 'Letter to the Grand Duchess Christina of Tuscany',
    author: 'Galileo Galilei',
    access: 'public_domain',
    standards: ['ELA.9.R.2.1', 'ELA.9.R.2.2', 'ELA.9.R.2.3', 'ELA.9.R.3.2', 'ELA.9.R.3.4'],
    gutendexSearchTerms: ['Letter to the Grand Duchess Christina Galileo Galilei'],
  }),
  bestTextModel({
    title: 'Nobel Prize Acceptance Speech',
    author: 'William Faulkner',
    access: 'reference_only',
    standards: ['ELA.9.R.2.1', 'ELA.9.R.2.2', 'ELA.9.R.3.2'],
  }),
  bestTextModel({
    title: 'St. Crispin’s Day Speech',
    author: 'William Shakespeare',
    access: 'public_domain',
    standards: ['ELA.9.R.1.2', 'ELA.9.R.2.1', 'ELA.9.R.2.2', 'ELA.9.R.2.3', 'ELA.9.R.3.2', 'ELA.9.R.3.4'],
    gutenbergIds: [2253],
    sectionStart: 'West. O that we now had here',
    sectionEnd: 'Enter Salisbury.',
    gutendexSearchTerms: ['Henry V St Crispin day speech Shakespeare'],
  }),
  bestTextModel({
    title: 'Speech to the Troops at Tilbury',
    author: 'Queen Elizabeth I',
    access: 'public_domain',
    standards: ['ELA.9.R.2.1', 'ELA.9.R.2.2', 'ELA.9.R.3.2', 'ELA.9.R.3.4'],
  }),
  bestTextModel({
    title: 'The Danger of a Single Story',
    author: 'Chimamanda Ngozi Adichie',
    access: 'reference_only',
    standards: ['ELA.9.R.2.2', 'ELA.9.R.2.3', 'ELA.9.R.3.2', 'ELA.9.R.3.4'],
  }),
  bestTextModel({
    title: 'The Love Song of J. Alfred Prufrock',
    author: 'T.S. Eliot',
    access: 'public_domain',
    gutenbergIds: [72472],
    standards: ['ELA.9.R.1.2', 'ELA.9.R.2.1', 'ELA.9.R.2.2', 'ELA.9.R.2.3', 'ELA.9.R.3.1', 'ELA.9.R.3.2', 'ELA.9.R.3.4'],
    sectionStart: 'THE LOVE SONG OF J. ALFRED PRUFROCK',
    sectionEnd: 'PORTRAIT OF A LADY',
  }),
  bestTextModel({
    title: 'The Talented Tenth',
    author: 'W.E.B. Du Bois',
    access: 'public_domain',
    standards: ['ELA.9.R.2.1', 'ELA.9.R.2.2', 'ELA.9.R.2.4', 'ELA.9.R.3.2'],
    gutenbergIds: [15041],
    sectionStart: 'The Talented Tenth',
    sectionEnd: 'The Disfranchisement of the Negro',
    gutendexSearchTerms: ['The Negro Problem W.E.B. Du Bois The Talented Tenth'],
  }),
  bestTextModel({
    title: '1984',
    author: 'George Orwell',
    access: 'reference_only',
    standards: ['ELA.9.R.1.1', 'ELA.9.R.1.2', 'ELA.9.R.1.3', 'ELA.9.R.3.2'],
  }),
  bestTextModel({
    title: 'Animal Farm',
    author: 'George Orwell',
    access: 'reference_only',
    standards: ['ELA.9.R.1.1', 'ELA.9.R.1.2', 'ELA.9.R.2.1', 'ELA.9.R.2.2', 'ELA.9.R.2.3', 'ELA.9.R.3.1', 'ELA.9.R.3.2', 'ELA.9.R.3.4'],
  }),
  bestTextModel({
    title: 'Antigone',
    author: 'Jean Anouilh',
    access: 'reference_only',
    standards: ['ELA.9.R.1.1', 'ELA.9.R.1.2', 'ELA.9.R.2.3', 'ELA.9.R.3.2', 'ELA.9.R.3.4'],
  }),
  bestTextModel({
    title: 'Antigone',
    author: 'Sophocles',
    access: 'public_domain',
    standards: ['ELA.9.R.1.1', 'ELA.9.R.1.2', 'ELA.9.R.2.1', 'ELA.9.R.2.2', 'ELA.9.R.2.3', 'ELA.9.R.3.2', 'ELA.9.R.3.4'],
  }),
  bestTextModel({
    title: 'Beowulf',
    access: 'public_domain',
    priorityAuthors: [],
    standards: ['ELA.9.R.1.1', 'ELA.9.R.1.2', 'ELA.9.R.1.4', 'ELA.9.R.3.2'],
  }),
  bestTextModel({
    title: 'Democracy in America',
    author: 'Alexis de Tocqueville',
    access: 'public_domain',
    standards: ['ELA.9.R.3.2'],
  }),
  bestTextModel({
    title: 'Electra',
    author: 'Sophocles',
    access: 'public_domain',
    gutenbergIds: [14484],
    sectionStart: 'ELECTRA',
    sectionEnd: 'THE TRACHINIAN MAIDENS',
    gutendexSearchTerms: ['The Seven Plays in English Verse Sophocles Electra'],
    standards: ['ELA.9.R.1.1', 'ELA.9.R.1.2', 'ELA.9.R.2.1', 'ELA.9.R.2.2', 'ELA.9.R.2.3', 'ELA.9.R.3.2', 'ELA.9.R.3.4'],
  }),
  bestTextModel({
    title: 'Finding Mañana: A Memoir of a Cuban Exodus',
    author: 'Mirta Ojito',
    access: 'reference_only',
    standards: ['ELA.9.R.1.1', 'ELA.9.R.1.2', 'ELA.9.R.3.2'],
  }),
  bestTextModel({
    title: 'Medea',
    author: 'Euripides',
    access: 'public_domain',
    standards: ['ELA.9.R.1.1', 'ELA.9.R.2.1', 'ELA.9.R.2.2', 'ELA.9.R.3.2'],
  }),
  bestTextModel({
    title: 'Old Greek Stories',
    author: 'James Baldwin',
    access: 'public_domain',
    standards: ['ELA.9.R.1.1', 'ELA.9.R.1.2', 'ELA.9.R.2.1', 'ELA.9.R.2.2', 'ELA.9.R.2.3', 'ELA.9.R.3.2', 'ELA.9.R.3.3', 'ELA.9.R.3.4'],
  }),
  bestTextModel({
    title: 'Romeo and Juliet',
    author: 'William Shakespeare',
    access: 'public_domain',
    gutenbergIds: [1513],
    standards: ['ELA.9.R.1.1', 'ELA.9.R.1.2', 'ELA.9.R.3.1', 'ELA.9.R.3.2', 'ELA.9.R.3.4'],
  }),
  bestTextModel({
    title: 'The Aeneid',
    author: 'Virgil',
    access: 'public_domain',
    gutenbergIds: [228],
    standards: ['ELA.9.R.1.1', 'ELA.9.R.1.2', 'ELA.9.R.1.4', 'ELA.9.R.2.1', 'ELA.9.R.2.2', 'ELA.9.R.2.3', 'ELA.9.R.3.2', 'ELA.9.R.3.4'],
  }),
  bestTextModel({
    title: 'The Death of Ivan Ilyich',
    author: 'Leo Tolstoy',
    access: 'public_domain',
    gutendexSearchTerms: ['The Death of Ivan Ilyich Leo Tolstoy'],
    standards: ['ELA.9.R.1.1', 'ELA.9.R.1.2', 'ELA.9.R.1.3', 'ELA.9.R.3.1', 'ELA.9.R.3.2'],
  }),
  bestTextModel({
    title: 'The Epic of Gilgamesh',
    access: 'public_domain',
    priorityAuthors: [],
    standards: ['ELA.9.R.1.1', 'ELA.9.R.1.2', 'ELA.9.R.1.4', 'ELA.9.R.3.2'],
  }),
  bestTextModel({
    title: 'The Hero with a Thousand Faces',
    author: 'Joseph Campbell',
    access: 'reference_only',
    standards: ['ELA.9.R.1.2', 'ELA.9.R.2.3', 'ELA.9.R.3.2', 'ELA.9.R.3.3', 'ELA.9.R.3.4'],
  }),
  bestTextModel({
    title: 'The Iliad',
    author: 'Homer',
    access: 'public_domain',
    standards: ['ELA.9.R.1.1', 'ELA.9.R.1.2', 'ELA.9.R.1.4', 'ELA.9.R.2.3', 'ELA.9.R.3.2', 'ELA.9.R.3.4'],
  }),
  bestTextModel({
    title: 'The Lincoln-Douglas Debates',
    author: 'Stephen Douglas and Abraham Lincoln',
    access: 'public_domain',
    priorityAuthors: ['Abraham Lincoln', 'Stephen Douglas'],
    gutenbergIds: [2655, 2656],
    gutendexSearchTerms: ['Lincoln Douglas Debates first debate'],
    standards: ['ELA.9.R.1.2', 'ELA.9.R.2.4', 'ELA.9.R.3.2'],
  }),
  bestTextModel({
    title: 'The Odyssey',
    author: 'Homer',
    access: 'public_domain',
    standards: ['ELA.9.R.1.1', 'ELA.9.R.1.2', 'ELA.9.R.1.4', 'ELA.9.R.3.2'],
  }),
  bestTextModel({
    title: 'The Prince',
    author: 'Niccolò Machiavelli',
    access: 'public_domain',
    standards: ['ELA.9.R.1.2', 'ELA.9.R.1.3', 'ELA.9.R.2.2', 'ELA.9.R.2.3', 'ELA.9.R.3.2'],
  }),
  bestTextModel({
    title: 'Unbroken: An Olympian’s Journey from Airman to Castaway to Captive (Adapted for Young Adults)',
    author: 'Laura Hillenbrand',
    access: 'reference_only',
    standards: ['ELA.9.R.1.1', 'ELA.9.R.1.2', 'ELA.9.R.3.2'],
  }),
];

export const OFFICIAL_FAST_TEXT_MODELS: OfficialFastTextModel[] = [
  ...RELEASED_FAST_GRADE9_TEXT_MODELS,
  ...BEST_GRADE9_TEXT_MODELS,
];

function unique(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function sortModels(models: OfficialFastTextModel[]) {
  return [...models].sort((a, b) => {
    if (a.pipelineUse !== b.pipelineUse) return a.pipelineUse === 'priority_seed' ? -1 : 1;
    if (a.sourceDocument !== b.sourceDocument) {
      return a.sourceDocument === '2025 Grade 9 FAST ELA Reading Released Items' ? -1 : 1;
    }
    return a.title.localeCompare(b.title);
  });
}

export function getOfficialFastTextModelsForStandard(standardCode: string) {
  return sortModels(OFFICIAL_FAST_TEXT_MODELS.filter((model) => model.standards.includes(standardCode as OfficialEla9Benchmark)));
}

export function getOfficialFastPipelineSeedsForStandard(
  standardCode: string
): OfficialFastPipelineSeeds | null {
  const models = getOfficialFastTextModelsForStandard(standardCode);
  if (!models.length) return null;

  const priorityModels = models.filter((model) => model.pipelineUse === 'priority_seed');
  const referenceModels = models.filter((model) => model.pipelineUse !== 'priority_seed');

  return {
    standardCode: standardCode as OfficialEla9Benchmark,
    priorityModels,
    referenceModels,
    priorityAuthors: unique(priorityModels.flatMap((model) => model.priorityAuthors ?? [])),
    gutendexSearchTerms: unique(priorityModels.flatMap((model) => model.gutendexSearchTerms ?? [])),
    officialGutenbergSeeds: priorityModels.flatMap((model) =>
      (model.gutenbergIds ?? []).map((gutenbergId) => ({
          gutenbergId,
          title: model.title,
          author: model.author ?? 'Unknown',
          sectionStart: model.sectionStart,
          sectionEnd: model.sectionEnd,
        }))
    ),
  };
}

export function getOfficialFastCoverageSummary() {
  const byStandard = OFFICIAL_FAST_TEXT_MODELS.reduce<Record<string, { prioritySeeds: number; references: number }>>(
    (map, model) => {
      for (const standard of model.standards) {
        const current = map[standard] ?? { prioritySeeds: 0, references: 0 };
        if (model.pipelineUse === 'priority_seed') current.prioritySeeds += 1;
        else current.references += 1;
        map[standard] = current;
      }
      return map;
    },
    {}
  );

  return Object.entries(byStandard)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([standardCode, counts]) => ({ standardCode, ...counts }));
}

function normalizeOfficialSourceText(value: string | null | undefined) {
  return (value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function officialTitleAliases(model: OfficialFastTextModel) {
  const aliases = [model.title];
  if (model.title === 'I Have a Dream') {
    aliases.push('MLK I Have a Dream', "MLK's I Have a Dream", 'Martin Luther King I Have a Dream');
  }
  if (model.title === 'Letter from Birmingham Jail') {
    aliases.push(
      'MLK Letter from Birmingham Jail',
      "MLK's Letter from Birmingham Jail",
      'Martin Luther King Letter from Birmingham Jail'
    );
  }
  return aliases.map(normalizeOfficialSourceText).filter(Boolean);
}

function officialAuthorAliases(model: OfficialFastTextModel) {
  const aliases = model.author ? [model.author] : [];
  if (model.author === 'Martin Luther King, Jr.') {
    aliases.push('MLK', 'Martin Luther King');
  }
  return aliases.map(normalizeOfficialSourceText).filter(Boolean);
}

export function findOfficialFastTextModelsBySource(args: {
  sourceTitle: string | null | undefined;
  sourceAuthor?: string | null | undefined;
}) {
  const title = normalizeOfficialSourceText(args.sourceTitle);
  const author = normalizeOfficialSourceText(args.sourceAuthor);
  if (!title) return [];

  return sortModels(
    OFFICIAL_FAST_TEXT_MODELS.filter((model) => {
      const modelTitles = officialTitleAliases(model);
      const modelAuthors = officialAuthorAliases(model);
      const titleMatches = Boolean(
        modelTitles.some(
          (modelTitle) =>
            title === modelTitle || title.includes(modelTitle) || modelTitle.includes(title)
        )
      );
      const authorMatches =
        !author ||
        !modelAuthors.length ||
        modelAuthors.some(
          (modelAuthor) => author.includes(modelAuthor) || modelAuthor.includes(author)
        );

      return titleMatches && authorMatches;
    })
  );
}

export function isOfficialFastAlignedSource(args: {
  standardCode: string | null | undefined;
  sourceTitle: string | null | undefined;
  sourceAuthor?: string | null | undefined;
  sourceGutenbergId?: number | null | undefined;
}) {
  if (!args.standardCode) return false;

  const models = getOfficialFastTextModelsForStandard(args.standardCode);
  const title = normalizeOfficialSourceText(args.sourceTitle);
  const author = normalizeOfficialSourceText(args.sourceAuthor);
  const gutenbergId = args.sourceGutenbergId ?? null;

  return models.some((model) => {
    const idMatches = Boolean(gutenbergId && model.gutenbergIds?.includes(gutenbergId));

    return (
      idMatches ||
      findOfficialFastTextModelsBySource({
        sourceTitle: title,
        sourceAuthor: author,
      }).some((matched) => matched.title === model.title && matched.author === model.author)
    );
  });
}
