import type { FastCategoryCode, ParsedFastCategoryPerformance } from './constants';

export type FastAldCategoryBlueprint = {
  category_code: FastCategoryCode;
  category_name: string;
  standards: string[];
  source_language: {
    what_results_mean: string[];
    next_steps: string[];
  };
  blueprint: string[];
  next_steps: string[];
  content_questions: Array<{
    standards: string[];
    question: string;
    content_use: string;
  }>;
};

export type FastAldCategoryInsight = FastAldCategoryBlueprint & {
  achievement_level: ParsedFastCategoryPerformance['achievement_level'];
  achievement_level_description: string;
  student_can_do: string[];
  instructional_next_steps: string[];
  priority_standards: string[];
};

export const FAST_GRADE9_ALD_CATEGORY_BLUEPRINTS: Record<
  FastCategoryCode,
  FastAldCategoryBlueprint
> = {
  RP: {
    category_code: 'RP',
    category_name: 'Reading Prose and Poetry',
    standards: ['ELA.9.R.1.1', 'ELA.9.R.1.2', 'ELA.9.R.1.3', 'ELA.9.R.1.4'],
    source_language: {
      what_results_mean: [
        'Explain how simple key elements enhance or add meaning and/or style in a literary text focusing on tone, mood, and purpose.',
        'Analyze simple universal themes and their development throughout a text.',
        'Analyze a narrator’s basic perspective.',
        'Explain how an author creates basic irony or satire in a literary text.',
        'Explain the characters, structure, and stated themes in an epic poem.',
      ],
      next_steps: [
        'Key elements and how they enhance meaning.',
        'What is the mood of the text? Does it change? Where and how do you know?',
        'What is the tone of the text? Does it change? Where and how do you know?',
        'What is the author’s purpose for writing this text? Find evidence to support that purpose.',
        'What is a universal theme in the text? Find evidence that supports the theme from multiple points in the text.',
        'Who is the narrator of the text, and what is their perspective?',
        'A text that contains clear irony or satire. Ask your learner to describe how the author created irony or satire.',
        'A song and read the lyrics together. Compare the literal message to the figurative message.',
      ],
    },
    blueprint: [
      'Explain how simple key elements enhance or add meaning and/or style in a literary text focusing on tone, mood, and purpose.',
      'Analyze simple universal themes and their development throughout a text.',
      'Analyze a narrator’s basic perspective.',
      'Explain how an author creates basic irony or satire in a literary text.',
      'Explain the characters, structure, and stated themes in an epic poem.',
    ],
    next_steps: [
      'Ask how key elements enhance meaning.',
      'Ask what the mood is, whether it changes, where it changes, and how the student knows.',
      'Ask what the tone is, whether it changes, where it changes, and how the student knows.',
      'Ask the author’s purpose and require evidence to support that purpose.',
      'Ask for a universal theme and evidence from multiple points in the text.',
      'Ask who the narrator is and what perspective the narrator has.',
      'Use clear irony or satire and ask how the author created it.',
      'Compare literal message to figurative message.',
    ],
    content_questions: [
      {
        standards: ['ELA.9.R.1.1'],
        question: 'How do key elements enhance meaning?',
        content_use:
          'Generate items that ask how setting, plot, conflict, character, point of view, or style adds a layer of meaning.',
      },
      {
        standards: ['ELA.9.R.1.1', 'ELA.9.R.3.1'],
        question: 'What is the mood of the text? Does it change? Where and how do you know?',
        content_use:
          'Generate items that require students to prove mood or mood shift with exact words, setting details, imagery, or figurative language.',
      },
      {
        standards: ['ELA.9.R.1.1', 'ELA.9.R.1.3'],
        question: 'What is the tone of the text? Does it change? Where and how do you know?',
        content_use:
          'Generate items that connect diction, narrator attitude, or contrast to tone and require evidence for a tone shift.',
      },
      {
        standards: ['ELA.9.R.1.1', 'ELA.9.R.2.3', 'ELA.9.R.3.4'],
        question: 'What is the author’s purpose for writing this text? Find evidence to support that purpose.',
        content_use:
          'Generate items that ask students to connect an author move to purpose and choose the evidence that proves it.',
      },
      {
        standards: ['ELA.9.R.1.2'],
        question:
          'What is a universal theme in the text? Find evidence that supports the theme from multiple points in the text.',
        content_use:
          'Generate theme items that require a universal statement and more than one supporting moment.',
      },
      {
        standards: ['ELA.9.R.1.3'],
        question: 'Who is the narrator of the text, and what is their perspective?',
        content_use:
          'Generate items that ask how narrator perspective shapes what the reader understands.',
      },
      {
        standards: ['ELA.9.R.1.3'],
        question:
          'Describe how the author created irony or satire in a text that contains clear irony or satire.',
        content_use:
          'Generate items that require students to explain contrast, reversal, exaggeration, or ridicule, not just label irony.',
      },
      {
        standards: ['ELA.9.R.3.1'],
        question: 'Compare the literal message to the figurative message.',
        content_use:
          'Generate items that force students to separate literal meaning from figurative meaning and explain the effect.',
      },
      {
        standards: ['ELA.9.R.1.4'],
        question: 'Explain the characters, structure, and stated themes in an epic poem.',
        content_use:
          'Generate epic items around character, structure, theme, in medias res, divine intervention, heroic values, and elevated style.',
      },
    ],
  },
  RI: {
    category_code: 'RI',
    category_name: 'Reading Informational Text',
    standards: ['ELA.9.R.2.1', 'ELA.9.R.2.2', 'ELA.9.R.2.3', 'ELA.9.R.2.4'],
    source_language: {
      what_results_mean: [
        'Analyze how basic text structures and/or text features convey purpose and meaning in informational texts.',
        'Analyze the support an author is using to develop a central idea.',
        'Explain how an author achieves a straightforward purpose through rhetorical appeals (ethos, pathos, logos) or figurative language.',
        'Explain the development of opposing arguments and describe the effectiveness and validity of simple claims.',
      ],
      next_steps: [
        'How text structures, text features, rhetorical appeals (ethos, pathos, logos), and figurative language are used for different purposes in the text.',
        'How the central idea(s) is developed in articles, advertisements, pictures, movies, or television shows.',
        'Two opposing arguments on the same topic. This can be done by creating a table comparing both arguments.',
        'Record the claims being made in each text.',
        'Identify which claims are supported with evidence and which are not supported.',
      ],
    },
    blueprint: [
      'Analyze how basic text structures and/or text features convey purpose and meaning in informational texts.',
      'Analyze the support an author is using to develop a central idea.',
      'Explain how an author achieves a straightforward purpose through rhetorical appeals (ethos, pathos, logos) or figurative language.',
      'Explain the development of opposing arguments and describe the effectiveness and validity of simple claims.',
    ],
    next_steps: [
      'Ask how text structures, text features, rhetorical appeals, and figurative language are used for different purposes.',
      'Ask how the central idea is developed.',
      'Use two opposing arguments on the same topic and compare both arguments in a table.',
      'Record the claims being made in each text.',
      'Identify which claims are supported with evidence and which are not supported.',
    ],
    content_questions: [
      {
        standards: ['ELA.9.R.2.1'],
        question:
          'How are text structures and text features used for different purposes in the text?',
        content_use:
          'Generate items that ask the job of a paragraph, structure, feature, shift, contrast, example, or sequence.',
      },
      {
        standards: ['ELA.9.R.2.2'],
        question: 'How is the central idea developed?',
        content_use:
          'Generate items that ask students to name the central idea and choose the evidence that develops it.',
      },
      {
        standards: ['ELA.9.R.2.3'],
        question:
          'How are rhetorical appeals, ethos, pathos, logos, and figurative language used for different purposes?',
        content_use:
          'Generate items that ask students to connect appeal, figurative language, or rhetoric to author purpose.',
      },
      {
        standards: ['ELA.9.R.2.4'],
        question: 'What claims are being made in each text?',
        content_use:
          'Generate paired-passage or two-column items that keep opposing claims separated.',
      },
      {
        standards: ['ELA.9.R.2.4'],
        question: 'Which claims are supported with evidence and which are not supported?',
        content_use:
          'Generate items that evaluate effectiveness, validity, evidence strength, and unsupported claims.',
      },
    ],
  },
  RGV: {
    category_code: 'RGV',
    category_name: 'Reading Across Genres & Vocabulary',
    standards: [
      'ELA.9.R.3.1',
      'ELA.9.R.3.2',
      'ELA.9.R.3.3',
      'ELA.9.R.3.4',
      'ELA.9.V.1.1',
      'ELA.9.V.1.2',
      'ELA.9.V.1.3',
    ],
    source_language: {
      what_results_mean: [
        'Explain how simplistic uses of figurative language are related to mood in a text.',
        'Compare and contrast ways authors have adapted mythical, classical, or religious texts.',
        'Explain an author’s use of simple rhetoric, including appeals, devices, and figurative language.',
        'Determine the meaning of words and phrases by applying knowledge of context clues, figurative language, word relationships, reference materials, background knowledge, etymology, and/or derivations.',
      ],
      next_steps: [
        'Read a literary or informational text. Look for examples and explain the importance of figurative language, rhetorical devices, and rhetorical appeals that contribute to mood.',
        'Rhetorical devices and rhetorical appeals.',
        'Common word roots.',
        'Watch a movie that has been adapted from a literary text. Discuss the impact of the similarities and differences between the adaptation and the original text.',
        'Review song lyrics from various genres to identify and describe the mood created through the author’s word choices.',
        'Choose an informational text and identify the rhetoric by using a different color to highlight each type of rhetorical appeal. Discuss which rhetorical appeal is used more often and why it is appropriate for the audience.',
        'Identify and define unknown words using context clues.',
      ],
    },
    blueprint: [
      'Explain how simplistic uses of figurative language are related to mood in a text.',
      'Compare and contrast ways authors have adapted mythical, classical, or religious texts.',
      'Explain an author’s use of simple rhetoric, including appeals, devices, and figurative language.',
      'Determine the meaning of words and phrases by applying knowledge of context clues, figurative language, word relationships, reference materials, background knowledge, etymology, and/or derivations.',
    ],
    next_steps: [
      'Ask students to explain the importance of figurative language, rhetorical devices, and rhetorical appeals that contribute to mood.',
      'Practice rhetorical devices and rhetorical appeals.',
      'Practice common word roots.',
      'Compare an adaptation to the original text and discuss the impact of similarities and differences.',
      'Use lyrics or short texts to identify and describe mood created through word choice.',
      'Highlight rhetorical appeals by type and discuss which appeal is used more often and why it fits the audience.',
      'Identify and define unknown words using context clues.',
    ],
    content_questions: [
      {
        standards: ['ELA.9.R.3.1'],
        question:
          'How do figurative language, rhetorical devices, and rhetorical appeals contribute to mood?',
        content_use:
          'Generate items that ask students to connect figurative language to a specific mood and prove it with the phrase.',
      },
      {
        standards: ['ELA.9.R.3.3'],
        question:
          'What is the impact of similarities and differences between an adaptation and the original text?',
        content_use:
          'Generate comparison items that ask what stayed the same, what changed, and how the meaning changed.',
      },
      {
        standards: ['ELA.9.R.3.4', 'ELA.9.R.2.3'],
        question: 'Which rhetorical appeal is used more often and why is it appropriate for the audience?',
        content_use:
          'Generate items that ask students to identify rhetoric and explain audience or purpose fit.',
      },
      {
        standards: ['ELA.9.V.1.2'],
        question: 'What common word roots help determine meaning?',
        content_use:
          'Generate word-part items that ask students to use roots, derivations, and etymology in passage context.',
      },
      {
        standards: ['ELA.9.V.1.3'],
        question: 'How can unknown words be defined using context clues?',
        content_use:
          'Generate vocabulary-in-context items requiring nearby clue evidence and connotation/denotation fit.',
      },
      {
        standards: ['ELA.9.R.3.2'],
        question: 'How can this grade-level sentence or passage be restated without changing its meaning?',
        content_use:
          'Generate paraphrase items that test whether a student preserves the author’s original meaning.',
      },
    ],
  },
};

export function getFastAldGuidanceForStandard(standardCode: string) {
  return Object.values(FAST_GRADE9_ALD_CATEGORY_BLUEPRINTS)
    .flatMap((category) =>
      category.content_questions
        .filter((item) => item.standards.includes(standardCode))
        .map((item) => ({
          category_code: category.category_code,
          category_name: category.category_name,
          question: item.question,
          content_use: item.content_use,
        }))
    );
}

function splitGuidanceText(value?: string | null) {
  return String(value ?? '')
    .split(/(?<=[.!?])\s+(?=[A-Z])/)
    .map((part) => part.trim())
    .filter(Boolean);
}

export function buildFastAldCategoryInsights(args: {
  categories: ParsedFastCategoryPerformance[];
  weakBenchmarkCodes?: string[];
}) {
  const weakSet = new Set(args.weakBenchmarkCodes ?? []);

  return args.categories.map((category): FastAldCategoryInsight => {
    const blueprint = FAST_GRADE9_ALD_CATEGORY_BLUEPRINTS[category.category_code] ?? {
      category_code: category.category_code,
      category_name: category.category_name,
      standards: [],
      source_language: { what_results_mean: [], next_steps: [] },
      blueprint: [],
      next_steps: [],
      content_questions: [],
    };
    const studentCanDo = splitGuidanceText(category.achievement_level_description);
    const nextSteps = splitGuidanceText(category.next_steps);
    const priorityStandards = blueprint.standards.filter((standard) => weakSet.has(standard));

    return {
      ...blueprint,
      category_name: category.category_name || blueprint.category_name,
      achievement_level: category.achievement_level,
      achievement_level_description:
        category.achievement_level_description ??
        `${category.achievement_level} performance on ${category.category_name || blueprint.category_name}.`,
      student_can_do: studentCanDo.length ? studentCanDo : blueprint.blueprint,
      instructional_next_steps: nextSteps.length ? nextSteps : blueprint.next_steps,
      priority_standards: priorityStandards.length ? priorityStandards : blueprint.standards,
    };
  });
}
