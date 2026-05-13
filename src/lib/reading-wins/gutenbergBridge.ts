import { FAST_GRADE9_READING_DEMANDS } from './fastSkillMap';
import { buildFastItemStem, stemFitsFastItemBlueprint } from './itemBlueprints';
import { getReadingSkillMove } from './skillMoveMap';

export type GutenbergPassageForReadingWin = {
  id: string;
  classification: string;
  source?: string | null;
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

function compactText(value: string, maxLength = 180) {
  const normalized = normalizeEvidence(value);
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength).replace(/\s+\S*$/, '')}...`;
}

function articleFor(value: string | null | undefined) {
  const word = value?.trim();
  if (!word) return 'a';
  return /^[aeiou]/i.test(word) ? 'an' : 'a';
}

function normalizeForMatch(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

function hashId(value: string) {
  return value.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
}

function evidenceFitScore(
  passage: GutenbergPassageForReadingWin,
  evidence: { element: string; rationale: string }
) {
  const strand = normalizeForMatch(
    `${passage.coverage_strand_id ?? ''} ${passage.coverage_strand_label ?? ''} ${
      passage.coverage_strand_signals?.join(' ') ?? ''
    } ${passage.target_signal ?? ''}`
  );
  const text = normalizeForMatch(`${evidence.element} ${evidence.rationale}`);
  let score = 0;

  if (/metaphor|simile|comparison/.test(strand)) {
    if (/\bas if\b|\bas though\b|\blike\b|\bas\b/.test(text)) score += 12;
    if (/comparison|compares|metaphor|simile/.test(text)) score += 8;
    if (/personification|human|furniture|object/.test(text)) score -= 6;
  }
  if (/personification/.test(strand)) {
    if (/personification|human|as if.*alive|seemed.*watching|object|furniture/.test(text)) {
      score += 10;
    }
  }
  if (/imagery|sensory/.test(strand)) {
    if (/image|imagery|sound|color|light|dark|cold|warm|touch|smell|taste/.test(text)) score += 8;
  }
  if (/mood|atmosphere|feeling/.test(strand)) {
    if (/mood|feeling|atmosphere|uneasy|tense|threatening|peaceful|dark/.test(text)) score += 6;
  }
  if (passage.target_signal && text.includes(normalizeForMatch(passage.target_signal))) score += 5;

  return score;
}

function sourceLabel(passage: GutenbergPassageForReadingWin) {
  const title = passage.source_title?.trim() || 'Public domain passage';
  const author = passage.source_author?.trim();
  return author ? `${title} — ${author}` : title;
}

function promotedQuestionSource(passage: GutenbergPassageForReadingWin) {
  return passage.source === 'manual_rights' ? 'rights_managed_literature' : 'gutenberg_public_domain';
}

function promotedPassageSourceLine(passage: GutenbergPassageForReadingWin, variantIndex: number) {
  const passageLabel =
    passage.source === 'manual_rights'
      ? `GOGI rights-managed passage ${passage.id}`
      : `Project Gutenberg passage ${passage.id}`;
  return `SOURCE:\n${passageLabel}\nReading Win rep ${variantIndex + 1}`;
}

function selectedSupportingEvidence(
  passage: GutenbergPassageForReadingWin,
  variantIndex = 0
) {
  const supporting = [...(passage.supporting_evidence ?? [])].sort(
    (a, b) => evidenceFitScore(passage, b) - evidenceFitScore(passage, a)
  );
  const evidence = supporting[variantIndex % Math.max(1, supporting.length)] ?? supporting[0];

  if (!evidence?.element) return null;

  return {
    element: compactText(evidence.element, 160),
    rationale: compactText(evidence.rationale ?? '', 190),
  };
}

const TEACHER_ANALYSIS_LANGUAGE = [
  /enacts/i,
  /oppression/i,
  /accusers?/i,
  /inanimate/i,
  /tonally/i,
  /surface-level/i,
  /expository/i,
  /mislead/i,
  /symbolic register/i,
  /schema/i,
  /liminal/i,
  /juxtaposition/i,
  /foregrounds/i,
  /motif/i,
  /semantic/i,
  /syntax/i,
  /unavoidable weight/i,
];

function hasTeacherAnalysisLanguage(value: string) {
  return TEACHER_ANALYSIS_LANGUAGE.some((pattern) => pattern.test(value));
}

function hasHighFrictionStudentLanguage(value: string) {
  const normalized = normalizeForMatch(value);
  const archaicHits = [
    'whereon',
    'thereof',
    'hastened',
    'vacated',
    'furtive',
    'facile',
    'larder',
    'rendered',
    'cottager',
  ].filter((word) => normalized.includes(word)).length;
  const veryLongSentences = value
    .split(/[.!?]/)
    .map((sentence) => sentence.trim().split(/\s+/).filter(Boolean).length)
    .filter((count) => count >= 55).length;

  return archaicHits >= 4 || veryLongSentences >= 2;
}

function studentFacingExplanation(
  evidence: { element: string; rationale: string } | null,
  fallback: string
) {
  const rationale = evidence?.rationale?.trim() ?? '';
  if (!rationale || hasTeacherAnalysisLanguage(rationale)) return fallback;

  const cleaned = rationale
    .replace(/^(it|this|the detail|the phrase|the comparison)\s+/i, '')
    .replace(/^(creates|makes|shows|suggests|signals|reveals)\s+/i, '')
    .replace(/\s+/g, ' ')
    .replace(/\.$/, '');

  if (!cleaned || cleaned.length > 120 || hasTeacherAnalysisLanguage(cleaned)) return fallback;
  if (!/\b(is|are|shows?|suggests?|creates?|makes?|explains?|describes?|names?|gives?|points?|proves?)\b/i.test(cleaned)) {
    return fallback;
  }
  return cleaned.charAt(0).toLowerCase() + cleaned.slice(1);
}

function studentFacingCorrectSentence(
  evidence: { element: string; rationale: string } | null,
  fallback: string
) {
  const rationale = evidence?.rationale?.trim() ?? '';
  if (!rationale || hasTeacherAnalysisLanguage(rationale) || rationale.length > 130) {
    return `It shows that ${fallback}.`;
  }

  const cleaned = rationale.replace(/\s+/g, ' ').replace(/\.$/, '');
  if (/^(creates|makes|shows|suggests|reveals)\b/i.test(cleaned)) {
    return `It ${cleaned.charAt(0).toLowerCase()}${cleaned.slice(1)}.`;
  }

  return `It shows that ${studentFacingExplanation(evidence, fallback)}.`;
}

function cleanOptionSentence(value: string) {
  const cleaned = value.replace(/\s+/g, ' ').replace(/\.$/, '').trim();
  if (!cleaned) return '';
  return `${cleaned.charAt(0).toUpperCase()}${cleaned.slice(1)}.`;
}

const GIVEAWAY_OPTION_PATTERNS = [
  /does not explain/i,
  /not explain/i,
  /target language/i,
  /^it points to/i,
  /literal detail/i,
  /literal definition/i,
  /has no effect/i,
  /broad claim/i,
  /without connecting/i,
  /not supported/i,
  /rather than the/i,
];

const GENERIC_CORRECT_ANSWER_PATTERNS = [
  /uses (a )?(comparison|figurative language) to help the reader understand (the )?(mood|meaning|scene)/i,
  /uses figurative language to clarify the scene/i,
  /creates the passage’s strongest effect/i,
  /creates (a|an) .{0,30} (simile|metaphor|figurative language) effect/i,
  /helps create the passage’s mood by connecting/i,
  /shows that the language creates/i,
];

function hasGiveawayOptionLanguage(value: string) {
  return GIVEAWAY_OPTION_PATTERNS.some((pattern) => pattern.test(value));
}

function hasSpecificEffectLanguage(value: string) {
  const normalized = normalizeForMatch(value);
  return (
    /\b(quick|closely|graceful|tense|uneasy|threatening|oppressive|inescapable|trapped|vivid|sensory|active|intensifies|uncertain|confident|critical|mocking|serious|calm|protected|ordinary|comfortable|playful|harsh|gentle|urgent|slow|careful|safe|dangerous|worried|peaceful|excited|fearful|important|unimportant|harmless|literal|visual|alive|still|winning|lost|setting|action|focus|movement|reader|scene)\b/.test(
      normalized
    ) ||
    /\b(less serious|shifts? attention|shifts? the focus|one racer|the runners|the characters|the setting|the conflict|the passage)\b/.test(
      normalized
    ) ||
    /\b(theme|claim|reasoning|purpose|tone|attitude|perspective|irony|satire|central idea)\b/.test(normalized)
  );
}

function isGenericCorrectAnswer(value: string) {
  return GENERIC_CORRECT_ANSWER_PATTERNS.some((pattern) => pattern.test(value));
}

function optionsAreDistinct(options: string[]) {
  const normalized = options.map(normalizeForMatch).filter(Boolean);
  return new Set(normalized).size === normalized.length;
}

function r31SignalEffect(signal: string | null | undefined, strandLabel: string | null | undefined) {
  const normalized = normalizeForMatch(`${signal ?? ''} ${strandLabel ?? ''}`);

  if (/oppressive|suffocat|inescapable|pressure|burden/.test(normalized)) {
    return 'creates an oppressive mood by making the force in the scene feel inescapable';
  }
  if (/uneasy|unsettled|anxious|tense|threat/.test(normalized)) {
    return 'creates an uneasy mood by making an ordinary moment feel tense or threatening';
  }
  if (/personification/.test(normalized)) {
    return 'gives something nonhuman human qualities to make the scene feel more intense';
  }
  if (/imagery|sensory|image/.test(normalized)) {
    return 'uses sensory detail to help the reader feel the mood of the scene';
  }
  if (/metaphor|simile|comparison/.test(normalized)) {
    return 'uses a comparison to help the reader understand the mood or meaning of the scene';
  }
  if (/symbol|allusion|idiom/.test(normalized)) {
    return 'uses a figurative reference to point to a larger meaning in the passage';
  }

  return 'helps create the passage’s mood by connecting the quoted language to meaning';
}

function r31CorrectOption(
  passage: GutenbergPassageForReadingWin,
  evidence: { element: string; rationale: string } | null
) {
  const rationale = evidence?.rationale?.trim() ?? '';
  if (rationale && !hasTeacherAnalysisLanguage(rationale) && rationale.length <= 145) {
    return studentFacingCorrectSentence(evidence, r31SignalEffect(passage.target_signal, passage.coverage_strand_label));
  }

  const text = normalizeForMatch(`${evidence?.element ?? ''} ${passage.target_signal ?? ''}`);
  if (/\bdragon\s*flies?\b|sped|racer|race|swift|dart|flutter|side by side/.test(text)) {
    return 'It emphasizes how quickly and closely the two racers move.';
  }
  if (/oppressive|cold|weight|pressure|inescapable|suffocat|trapped/.test(text)) {
    return 'It creates an oppressive mood by making the force in the scene feel inescapable.';
  }
  if (/uneasy|tense|threat|fear|anxious|secret/.test(text)) {
    return 'It creates tension by making the moment feel uncertain or threatening.';
  }
  if (/personification|human|alive|watch|accus|seemed/.test(text)) {
    return 'It makes something nonhuman seem active, which intensifies the scene.';
  }
  if (/image|imagery|bright|dark|sound|color|light|cold/.test(text)) {
    return 'It uses sensory detail to make the scene more vivid for the reader.';
  }
  return 'It uses figurative language to clarify the scene’s meaning or mood.';
}

function r31PlausibleDistractors(
  passage: GutenbergPassageForReadingWin,
  correctAnswer: string,
  evidence: { element: string; rationale: string } | null
) {
  const text = normalizeForMatch(`${evidence?.element ?? ''} ${passage.paragraph_text.slice(0, 500)}`);
  const isRace = /\bdragon\s*flies?\b|sped|racer|race|atalanta|hippomenes|goal/.test(text);
  const isMood = /oppressive|uneasy|tense|cold|storm|dark|fear|threat/.test(text);
  const isPersonification = /personification|human|alive|watch|accus|seemed/.test(text);

  const options = isRace
    ? [
        'It shows that the race has become slow and careful.',
        'It suggests that one racer has already lost interest in winning.',
        'It shifts attention away from the race to describe the setting.',
        'It makes the runners seem graceful but nearly still.',
      ]
    : isMood
      ? [
          'It makes the scene feel calm and protected.',
          'It suggests that the setting is ordinary and comfortable.',
          'It shifts the focus away from the characters’ situation.',
          'It makes the conflict seem less serious than it is.',
        ]
      : isPersonification
        ? [
            'It makes the object seem harmless and unimportant.',
            'It shows that the narrator is giving a literal description.',
            'It shifts the focus away from the pressure in the scene.',
            'It makes the scene feel playful instead of serious.',
          ]
        : [
            'It makes the scene feel calm and ordinary.',
            'It shifts attention away from the characters and toward the setting.',
            'It makes the passage feel less serious than the surrounding events suggest.',
            'It makes the image seem literal rather than meaningful.',
          ];

  return options.filter((option) => normalizeForMatch(option) !== normalizeForMatch(correctAnswer)).slice(0, 3);
}

function questionStem(
  standardCode: string,
  passage: GutenbergPassageForReadingWin,
  evidence: { element: string; rationale: string } | null,
  variantIndex = 0
) {
  return buildFastItemStem({
    standardCode,
    strandId: passage.coverage_strand_id,
    strandLabel: passage.coverage_strand_label,
    targetSignal: passage.target_signal,
    evidenceText: evidence?.element,
    variantIndex,
  });
}

function stemMatchesTargetSkill(input: {
  standardCode: string;
  stem: string;
  passage: GutenbergPassageForReadingWin;
  evidence: { element: string; rationale: string } | null;
}) {
  return stemFitsFastItemBlueprint({
    standardCode: input.standardCode,
    strandId: input.passage.coverage_strand_id,
    strandLabel: input.passage.coverage_strand_label,
    targetSignal: input.passage.target_signal,
    evidenceText: input.evidence?.element,
    stem: input.stem,
  });
}

function buildCorrectAnswer(
  passage: GutenbergPassageForReadingWin,
  standardCode: string,
  evidence: { element: string; rationale: string } | null,
  variantIndex = 0
) {
  const signal = passage.target_signal?.trim();
  const evidenceText = evidence?.element ?? '';
  const rationale = evidence?.rationale;
  const article = articleFor(signal);

  if (standardCode === 'ELA.9.R.3.1') {
    if (rationale) return r31CorrectOption(passage, evidence);
    return signal
      ? `It uses “${evidenceText}” to create ${article} ${signal} effect.`
      : `It uses “${evidenceText}” to create the passage’s strongest effect.`;
  }

  if (standardCode === 'ELA.9.R.1.3') {
    return signal
      ? `The wording shows ${article} ${signal} attitude through “${evidenceText}.”`
      : `The wording reveals the speaker’s attitude through “${evidenceText}.”`;
  }

  if (standardCode === 'ELA.9.R.1.2') {
    return signal
      ? `The passage develops ${signal} through “${evidenceText}.”`
      : `The passage develops its theme through “${evidenceText}.”`;
  }

  return `The best proof is “${evidenceText}” because it supports the passage’s main reading move.`;
}

function fallbackDistractor(index: number, passage: GutenbergPassageForReadingWin) {
  const signal = passage.target_signal?.trim() || 'the passage';
  return [
    `It focuses on a literal detail, but it does not explain how the quoted language creates ${articleFor(
      signal
    )} ${signal} effect.`,
    'It retells what happens without explaining how the quoted language affects meaning or mood.',
    'It makes a broad claim that is not supported by the quoted words.',
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
    if (evidence && rationale && !hasTeacherAnalysisLanguage(rationale)) {
      const explanation = studentFacingExplanation(
        { element: evidence, rationale },
        'does not explain the effect of the quoted language'
      );
      return `It points to “${compactText(evidence, 55)},” but that detail ${explanation}.`;
    }
    if (evidence) {
      return `It points to “${compactText(evidence, 55)},” but it does not explain the effect of the quoted language.`;
    }
    return fallbackDistractor(index, passage);
  });
}

function buildFastStyleDistractors(
  passage: GutenbergPassageForReadingWin,
  standardCode: string,
  evidence: { element: string; rationale: string } | null,
  variantIndex = 0
) {
  const generated = buildDistractors(passage, variantIndex).map((value) => compactText(value, 210));

  if (standardCode !== 'ELA.9.R.3.1') {
    return generated;
  }

  const signal = passage.target_signal?.trim() || 'figurative language';
  const evidenceText = evidence?.element || 'the quoted phrase';
  const passageDetail = compactText((passage.non_supporting_evidence ?? [])[0]?.element ?? '', 70);
  const correctAnswer = buildCorrectAnswer(passage, standardCode, evidence, variantIndex);
  const plausible = r31PlausibleDistractors(passage, correctAnswer, evidence);
  const fastDistractors = [
    plausible[0] ?? `It identifies ${signal}, but it does not explain how the quoted language shapes meaning or mood.`,
    passageDetail
      ? (plausible[1] ?? `It focuses on “${passageDetail},” a literal detail that does not explain the effect of “${evidenceText}.”`)
      : 'It focuses on a literal detail but does not explain the effect of the figurative language.',
    plausible[2] ?? 'It makes the scene feel calm and ordinary.',
  ];

  return [0, 1, 2].map((index) => {
    const generatedOption = generated[index] ?? '';
    if (
      /does not explain|target language|it points to|literal detail|broad claim|not supported/i.test(
        generatedOption
      ) ||
      generatedOption.length > 155
    ) {
      return cleanOptionSentence(fastDistractors[index]);
    }
    return cleanOptionSentence(generatedOption);
  });
}

export type FastItemQualityGate = {
  passed: boolean;
  confidence: 'strong signal' | 'emerging signal' | 'not enough data';
  score: number;
  checks: Array<{ label: string; passed: boolean }>;
  note: string;
};

function evaluateFastItemQuality(input: {
  standardCode: string;
  stem: string;
  correctAnswer: string;
  distractors: string[];
  passage: GutenbergPassageForReadingWin;
  evidence: { element: string; rationale: string } | null;
}): FastItemQualityGate {
  const supporting = input.passage.supporting_evidence ?? [];
  const nonSupporting = input.passage.non_supporting_evidence ?? [];
  const checks = [
    {
      label: 'question uses quoted passage evidence',
      passed: Boolean(input.evidence?.element && input.stem.includes(input.evidence.element)),
    },
    {
      label: 'asks meaning/effect, not device identification only',
      passed: stemFitsFastItemBlueprint({
        standardCode: input.standardCode,
        strandId: input.passage.coverage_strand_id,
        strandLabel: input.passage.coverage_strand_label,
        targetSignal: input.passage.target_signal,
        evidenceText: input.evidence?.element,
        stem: input.stem,
      }),
    },
    {
      label: 'answer is grounded in tagged evidence',
      passed: Boolean(
        input.evidence?.rationale &&
          input.correctAnswer.length >= 35 &&
          !/creates a\/an|simile effect|metaphor effect/i.test(input.correctAnswer)
      ),
    },
    {
      label: 'has plausible distractor anchors',
      passed: nonSupporting.length >= 2 && input.distractors.length >= 3,
    },
    {
      label: 'passage length supports a short FAST-style rep',
      passed:
        input.passage.word_count >= 80 &&
        input.passage.word_count <= 340 &&
        !hasHighFrictionStudentLanguage(input.passage.paragraph_text),
    },
    {
      label: 'standard and target skill are explicit',
      passed: Boolean(input.standardCode && input.passage.target_signal?.trim()),
    },
    {
      label: 'stem matches the selected strand',
      passed: stemMatchesTargetSkill(input),
    },
    {
      label: 'student-facing answer language',
      passed: [input.correctAnswer, ...input.distractors].every(
        (value) =>
          value.length <= 190 &&
          !hasTeacherAnalysisLanguage(value) &&
          !/\bit This\b|\bit this\b/.test(value)
      ),
    },
    {
      label: 'answer choices are plausible, not giveaway templates',
      passed:
        optionsAreDistinct([input.correctAnswer, ...input.distractors]) &&
        input.distractors.length >= 3 &&
        input.distractors.every(
          (value) =>
            value.length >= 24 &&
            value.length <= 170 &&
            !hasGiveawayOptionLanguage(value) &&
            hasSpecificEffectLanguage(value)
        ),
    },
    {
      label: 'correct answer names a specific reading effect',
      passed:
        input.correctAnswer.length >= 35 &&
        !isGenericCorrectAnswer(input.correctAnswer) &&
        !hasGiveawayOptionLanguage(input.correctAnswer) &&
        hasSpecificEffectLanguage(input.correctAnswer),
    },
  ];
  const score = checks.filter((check) => check.passed).length;
  const criticalChecksPassed = checks
    .filter((check) =>
      [
        'question uses quoted passage evidence',
        'asks meaning/effect, not device identification only',
        'answer is grounded in tagged evidence',
        'passage length supports a short FAST-style rep',
        'stem matches the selected strand',
        'student-facing answer language',
        'answer choices are plausible, not giveaway templates',
        'correct answer names a specific reading effect',
      ].includes(check.label)
    )
    .every((check) => check.passed);
  const confidence =
    score >= 8 && criticalChecksPassed
      ? 'strong signal'
      : score >= 7 && criticalChecksPassed
        ? 'emerging signal'
        : 'not enough data';

  return {
    passed: score >= 7 && criticalChecksPassed && supporting.length >= 1,
    confidence,
    score,
    checks,
    note:
      score >= 5
        ? 'Ready for teacher skim: the item asks students to interpret evidence and explain effect.'
        : score >= 4
          ? 'Usable with teacher review: one quality check still needs attention.'
          : 'Do not promote yet: the passage needs stronger evidence, distractors, or a tighter FAST-style stem.',
  };
}

function optionText(optionsByLetter: Record<string, string>, letter: string) {
  return optionsByLetter[letter] ?? null;
}

export function mapGutenbergClassificationToFastStandard(classification: string) {
  return CLASSIFICATION_TO_FAST_STANDARD[classification] ?? null;
}

export function buildGutenbergReadingWinQuestionInsert(
  passage: GutenbergPassageForReadingWin,
  options: {
    standardId: string | null;
    variantIndex?: number;
    allowLegacyClassificationFallback?: boolean;
  }
) {
  const standardCode =
    passage.standard_code ??
    (options.allowLegacyClassificationFallback
      ? mapGutenbergClassificationToFastStandard(passage.classification)
      : null);
  if (!standardCode) return null;

  const demand = FAST_GRADE9_READING_DEMANDS.find((item) => item.standardCode === standardCode);
  if (!demand) return null;

  const supporting = passage.supporting_evidence ?? [];
  const nonSupporting = passage.non_supporting_evidence ?? [];
  if (!supporting[0]?.element || nonSupporting.length < 2) return null;

  const variantIndex = options.variantIndex ?? 0;
  const evidence = selectedSupportingEvidence(passage, variantIndex);
  if (!evidence) return null;

  const correctLetter = LETTERS[(hashId(passage.id) + variantIndex) % LETTERS.length];
  const correctAnswer = buildCorrectAnswer(passage, standardCode, evidence, variantIndex);
  const distractors = buildFastStyleDistractors(passage, standardCode, evidence, variantIndex);
  const prompt = questionStem(
    standardCode,
    passage,
    evidence,
    variantIndex
  );
  const qualityGate = evaluateFastItemQuality({
    standardCode,
    stem: prompt,
    correctAnswer,
    distractors,
    passage,
    evidence,
  });
  if (!qualityGate.passed) {
    if (process.env.GOGI_DEBUG_QUALITY_GATE === '1') {
      console.error('[quality-gate]', passage.id, qualityGate);
      console.error('[quality-gate-options]', { prompt, correctAnswer, distractors });
    }
    return null;
  }

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
  const formattedOptions = LETTERS.map((letter) => `${letter}. ${optionsByLetter[letter]}`).join(
    '\n'
  );
  const title = sourceLabel(passage);
  const qualityChecks = qualityGate.checks
    .map((check) => `${check.passed ? 'pass' : 'check'}: ${check.label}`)
    .join('; ');
  const targetSkill =
    passage.coverage_strand_label?.trim() ||
    passage.target_signal?.trim() ||
    demand.teacherTitle ||
    passage.classification;
  const skillMove = getReadingSkillMove({
    standardCode,
    strandId: passage.coverage_strand_id,
    strandLabel: passage.coverage_strand_label,
    targetSkill,
  });

  return {
    standard_id: options.standardId,
    content: [
      `PASSAGE:\n${passage.paragraph_text.trim()}`,
      `QUESTION:\n${prompt}`,
      `OPTIONS:\n${formattedOptions}`,
      `ANSWER:\n${correctLetter}`,
      `TARGET_STANDARD:\n${standardCode}`,
      `TARGET_SKILL:\n${targetSkill}`,
      skillMove ? `GOGI_SKILL_MOVE:\n${skillMove.studentMove}` : null,
      skillMove ? `MASTERY_SIGNAL:\n${skillMove.masterySignal}` : null,
      `FAST_ITEM_QUALITY:\n${qualityGate.confidence} (${qualityGate.score}/${qualityGate.checks.length})`,
      `TEACHER_TRUST_NOTE:\n${qualityGate.note}`,
      promotedPassageSourceLine(passage, variantIndex),
    ]
      .filter(Boolean)
      .join('\n\n'),
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
      `${correctLetter} is correct because it explains how “${evidence.element}” functions in context for ${standardCode}.`,
      `Target skill: ${targetSkill}.`,
      skillMove ? `Skill move: ${skillMove.studentMove}` : null,
      skillMove ? `Mastery signal: ${skillMove.masterySignal}` : null,
      `FAST item quality: ${qualityGate.confidence} (${qualityGate.score}/${qualityGate.checks.length}).`,
      `Teacher trust: ${qualityGate.note}`,
      `Quality checks: ${qualityChecks}.`,
      `Classification: ${passage.classification}.`,
      passage.tier_rationale ? `Tier rationale: ${passage.tier_rationale}` : null,
      `Reading Win move: ${demand.studentMove}`,
    ]
      .filter(Boolean)
      .join(' '),
    pipeline_source: 'v3_promoted',
    source_classification: standardCode,
    source: promotedQuestionSource(passage),
    is_released_item: false,
  };
}

export function buildGutenbergReadingWinQuestionInserts(
  passage: GutenbergPassageForReadingWin,
  options: {
    standardId: string | null;
    count?: number;
    allowLegacyClassificationFallback?: boolean;
  }
) {
  const count = Math.max(1, Math.min(6, options.count ?? 5));
  return Array.from({ length: count })
    .map((_, variantIndex) =>
      buildGutenbergReadingWinQuestionInsert(passage, {
        standardId: options.standardId,
        variantIndex,
        allowLegacyClassificationFallback: options.allowLegacyClassificationFallback,
      })
    )
    .filter((insert): insert is NonNullable<typeof insert> => Boolean(insert));
}
