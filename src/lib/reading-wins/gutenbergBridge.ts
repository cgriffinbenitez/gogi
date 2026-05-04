import { FAST_GRADE9_READING_DEMANDS } from './fastSkillMap';

export type GutenbergPassageForReadingWin = {
  id: string;
  classification: string;
  standard_code?: string | null;
  coverage_strand_id?: string | null;
  coverage_strand_label?: string | null;
  coverage_strand_signals?: string[] | null;
  paragraph_text: string;
  word_count: number;
  source_title: string | null;
  source_author: string | null;
  source_year: number | null;
  source_gutenberg_id: number | null;
  intervention_tier: number | null;
  target_signal: string | null;
  supporting_evidence: Array<{ element: string; rationale: string }> | null;
  non_supporting_evidence: Array<{ element: string; rationale: string }> | null;
  plausible_distractors: string[] | null;
  tier_rationale: string | null;
};

const CLASSIFICATION_TO_FAST_STANDARD: Record<string, string> = {
  inferencing: 'ELA.9.R.1.1',
  evidence_retrieval_failure: 'ELA.9.R.2.2',
  tone_misreading: 'ELA.9.R.1.3',
  mood_misreading: 'ELA.9.R.3.1',
  figurative_language_failure: 'ELA.9.R.3.1',
  comprehension_integration_failure: 'ELA.9.R.2.4',
  topic_vs_theme_confusion: 'ELA.9.R.1.2',
  structure_purpose_disconnect: 'ELA.9.R.2.1',
  vocabulary_gap: 'ELA.9.V.1.3',
  morphology_gap: 'ELA.9.V.1.2',
  syntax_barrier: 'ELA.9.R.2.1',
  schema_strategy_missing: 'ELA.9.R.1.1',
  no_metacognitive_strategy: 'ELA.9.R.1.1',
};

const LETTERS = ['A', 'B', 'C', 'D'] as const;

function normalizeEvidence(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}

function hashId(value: string) {
  return value.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
}

function sourceLabel(passage: GutenbergPassageForReadingWin) {
  const title = passage.source_title?.trim() || 'Public domain passage';
  const author = passage.source_author?.trim();
  return author ? `${title} — ${author}` : title;
}

function questionStem(standardCode: string, classification: string, variantIndex = 0) {
  if (standardCode === 'ELA.9.R.3.1') {
    const stems =
      classification === 'mood_misreading'
        ? [
            'How does the image or language in this passage affect the mood?',
            'Which detail best creates the mood in this passage?',
            'How does the author make the scene feel uneasy or intense?',
            'Which answer best explains the effect of the passage’s imagery?',
            'What does the quoted language make the reader feel?',
          ]
        : [
            'How does the figurative language affect the passage?',
            'Which answer best explains the effect of the image in context?',
            'What does the figurative phrase help the reader understand?',
            'How does the author use nonliteral language to shape meaning?',
            'Which choice best explains what the figurative language does?',
          ];
    return stems[variantIndex % stems.length];
  }

  if (standardCode === 'ELA.9.R.1.3') {
    const stems = [
      'What does the author’s wording show about the speaker’s attitude?',
      'Which answer best explains the speaker’s perspective in this passage?',
      'How does the wording shape what the reader understands about the narrator?',
      'What gap does the passage create between what is said and what is meant?',
      'Which answer best explains the author’s attitude in context?',
    ];
    return stems[variantIndex % stems.length];
  }

  if (standardCode === 'ELA.9.R.1.2') {
    const stems = [
      'Which answer best explains the theme developed by this passage?',
      'Which detail best supports the passage’s theme?',
      'What lesson about people or choices does the passage develop?',
      'Which answer turns the topic into the strongest theme?',
      'How does the passage develop its message?',
    ];
    return stems[variantIndex % stems.length];
  }

  if (standardCode === 'ELA.9.R.2.1') {
    const stems = [
      'How does this part of the passage help the author build meaning?',
      'Why does the author include this detail or section?',
      'What job does this part of the passage do?',
      'How does the structure help the reader understand the author’s purpose?',
      'Which answer best explains why this part appears here?',
    ];
    return stems[variantIndex % stems.length];
  }

  if (standardCode === 'ELA.9.R.2.2') {
    const stems = [
      'Which answer best matches the passage’s idea to its strongest proof?',
      'Which detail best supports the central idea?',
      'How does the evidence develop the passage’s main idea?',
      'Which answer explains why the selected detail matters?',
      'Which proof is strongest for the passage’s central idea?',
    ];
    return stems[variantIndex % stems.length];
  }

  if (standardCode === 'ELA.9.V.1.2' || standardCode === 'ELA.9.V.1.3') {
    const stems = [
      'Which answer best uses the surrounding words to understand the passage?',
      'Which meaning fits best in this context?',
      'How do the nearby words help explain the meaning?',
      'Which answer best matches the word or phrase in context?',
      'What does the passage help the reader understand about this wording?',
    ];
    return stems[variantIndex % stems.length];
  }

  return 'Which answer best explains what the passage shows?';
}

function buildCorrectAnswer(
  passage: GutenbergPassageForReadingWin,
  standardCode: string,
  variantIndex = 0
) {
  const signal = passage.target_signal?.trim();
  const supporting = passage.supporting_evidence ?? [];
  const evidence = normalizeEvidence(
    supporting[(hashId(passage.id) + variantIndex) % Math.max(1, supporting.length)]?.element ?? ''
  );
  const article = signal && /^[aeiou]/i.test(signal) ? 'an' : 'a';

  if (standardCode === 'ELA.9.R.3.1') {
    return signal
      ? `It creates ${article} ${signal} effect through “${evidence}.”`
      : `It creates the strongest effect through “${evidence}.”`;
  }

  if (standardCode === 'ELA.9.R.1.3') {
    return signal
      ? `The wording shows ${article} ${signal} attitude through “${evidence}.”`
      : `The wording reveals the speaker’s attitude through “${evidence}.”`;
  }

  if (standardCode === 'ELA.9.R.1.2') {
    return signal
      ? `The passage develops ${signal} through “${evidence}.”`
      : `The passage develops its theme through “${evidence}.”`;
  }

  return `The best proof is “${evidence}” because it supports the passage’s main reading move.`;
}

function fallbackDistractor(index: number, passage: GutenbergPassageForReadingWin) {
  const signal = passage.target_signal?.trim() || 'the passage';
  return [
    `It focuses on a true detail but does not explain ${signal}.`,
    'It repeats surface information without explaining the author’s effect.',
    'It makes a broad claim that is not proven by the quoted words.',
  ][index];
}

function buildDistractors(passage: GutenbergPassageForReadingWin, variantIndex = 0) {
  const nonSupporting = passage.non_supporting_evidence ?? [];
  const startIndex =
    (hashId(`${passage.id}:distractors`) + variantIndex) % Math.max(1, nonSupporting.length);
  const rotated = [...nonSupporting.slice(startIndex), ...nonSupporting.slice(0, startIndex)];
  return [0, 1, 2].map((index) => {
    const evidence = normalizeEvidence(rotated[index]?.element ?? '');
    const rationale = rotated[index]?.rationale?.trim();
    if (evidence && rationale) {
      return `“${evidence}” is tempting, but it ${rationale.replace(/\.$/, '')}.`;
    }
    if (evidence) {
      return `“${evidence}” is a detail, but it does not prove the target reading move.`;
    }
    return fallbackDistractor(index, passage);
  });
}

function optionText(optionsByLetter: Record<string, string>, letter: string) {
  return optionsByLetter[letter] ?? null;
}

export function mapGutenbergClassificationToFastStandard(classification: string) {
  return CLASSIFICATION_TO_FAST_STANDARD[classification] ?? null;
}

export function buildGutenbergReadingWinQuestionInsert(
  passage: GutenbergPassageForReadingWin,
  options: { standardId: string | null; variantIndex?: number }
) {
  const standardCode = mapGutenbergClassificationToFastStandard(passage.classification);
  if (!standardCode) return null;

  const demand = FAST_GRADE9_READING_DEMANDS.find((item) => item.standardCode === standardCode);
  if (!demand) return null;

  const supporting = passage.supporting_evidence ?? [];
  const nonSupporting = passage.non_supporting_evidence ?? [];
  if (!supporting[0]?.element || nonSupporting.length < 2) return null;

  const variantIndex = options.variantIndex ?? 0;
  const correctLetter = LETTERS[(hashId(passage.id) + variantIndex) % LETTERS.length];
  const correctAnswer = buildCorrectAnswer(passage, standardCode, variantIndex);
  const distractors = buildDistractors(passage, variantIndex);
  let distractorIndex = 0;
  const optionsByLetter = LETTERS.reduce<Record<string, string>>((map, letter) => {
    if (letter === correctLetter) {
      map[letter] = correctAnswer;
      return map;
    }

    map[letter] = distractors[distractorIndex] ?? fallbackDistractor(distractorIndex, passage);
    distractorIndex += 1;
    return map;
  }, {});
  const prompt = questionStem(standardCode, passage.classification, variantIndex);
  const formattedOptions = LETTERS.map((letter) => `${letter}. ${optionsByLetter[letter]}`).join(
    '\n'
  );
  const title = sourceLabel(passage);

  return {
    standard_id: options.standardId,
    content: [
      `PASSAGE:\n${passage.paragraph_text.trim()}`,
      `QUESTION:\n${prompt}`,
      `OPTIONS:\n${formattedOptions}`,
      `ANSWER:\n${correctLetter}`,
      `SOURCE:\nProject Gutenberg passage ${passage.id}\nReading Win rep ${variantIndex + 1}`,
    ].join('\n\n'),
    cognitive_skill_targeted: standardCode,
    difficulty_level: Math.max(1, Math.min(5, passage.intervention_tier ?? 2)),
    title,
    author: passage.source_author,
    pub_year: passage.source_year,
    option_a_text: optionText(optionsByLetter, 'A'),
    option_b_text: optionText(optionsByLetter, 'B'),
    option_c_text: optionText(optionsByLetter, 'C'),
    option_d_text: optionText(optionsByLetter, 'D'),
    correct_option: correctLetter,
    approved: true,
    flagged: false,
    rationale: [
      `${correctLetter} is correct because it uses approved Gutenberg evidence for ${standardCode}.`,
      `Classification: ${passage.classification}.`,
      passage.tier_rationale ? `Tier rationale: ${passage.tier_rationale}` : null,
      `Reading Win move: ${demand.studentMove}`,
    ]
      .filter(Boolean)
      .join(' '),
    pipeline_source: 'v3_promoted',
    source_classification: standardCode,
    source: 'gutenberg_public_domain',
    is_released_item: false,
  };
}

export function buildGutenbergReadingWinQuestionInserts(
  passage: GutenbergPassageForReadingWin,
  options: { standardId: string | null; count?: number }
) {
  const count = Math.max(1, Math.min(6, options.count ?? 5));
  return Array.from({ length: count })
    .map((_, variantIndex) =>
      buildGutenbergReadingWinQuestionInsert(passage, {
        standardId: options.standardId,
        variantIndex,
      })
    )
    .filter((insert): insert is NonNullable<typeof insert> => Boolean(insert));
}
