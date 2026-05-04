import type { FastGrade9ReadingDemand } from './fastSkillMap';
import type { ReadingWinLoopItem, ReadingWinSession } from './r31FigurativeLanguageSession';

export type PromotedReadingWinQuestion = {
  id: string;
  content: string;
  cognitive_skill_targeted: string | null;
  difficulty_level: number | null;
  title: string | null;
  option_a_text: string | null;
  option_b_text: string | null;
  option_c_text: string | null;
  option_d_text: string | null;
  correct_option: string | null;
  rationale: string | null;
  source: string | null;
  is_released_item: boolean | null;
};

export type ReadingWinCoverageAnalysis = {
  standardCode: string;
  approvedRows: number;
  viableRows: number;
  distinctPassages: number;
  estimatedFreshSessions: number;
  pilotDepthTarget: number;
  depthStatus: 'empty' | 'one_session' | 'pilot_sequence' | 'pilot_depth';
  releasedRows: number;
  originalRows: number;
  gutenbergRows: number;
  ready: boolean;
  status: 'ready' | 'thin' | 'blocked';
  issues: string[];
  session: ReadingWinSession | null;
};

type ParsedQuestion = {
  id: string;
  title: string;
  passage: string;
  passageSignature: string;
  prompt: string;
  options: string[];
  correctAnswer: string;
  rationale: string | null;
  difficulty: 1 | 2 | 3 | 4 | 5;
  source: string;
  qualityScore: number;
};

function section(content: string, label: string) {
  const pattern = new RegExp(`${label}:\\n([\\s\\S]*?)(?=\\n\\n[A-Z ]+:\\n|$)`, 'i');
  return content.match(pattern)?.[1]?.trim() ?? '';
}

function clampDifficulty(value: number | null | undefined): 1 | 2 | 3 | 4 | 5 {
  const next = Math.max(1, Math.min(5, Number(value ?? 2)));
  return next as 1 | 2 | 3 | 4 | 5;
}

function optionByLetter(row: PromotedReadingWinQuestion, letter: string) {
  const key = `option_${letter.toLowerCase()}_text` as
    | 'option_a_text'
    | 'option_b_text'
    | 'option_c_text'
    | 'option_d_text';
  return row[key]?.trim() ?? null;
}

function parseContentOptions(content: string) {
  const optionsBlock = section(content, 'OPTIONS');
  if (!optionsBlock) return [];
  return optionsBlock
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.replace(/^[A-D]\.\s*/i, '').trim())
    .filter(Boolean);
}

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function wordCount(value: string) {
  return normalizeText(value).split(' ').filter(Boolean).length;
}

function hasGenericAiTexture(title: string, passage: string) {
  const text = `${title} ${passage}`.toLowerCase();
  const genericTerms = [
    'student-led neighborhood project',
    'community project',
    'visible first step',
    'careful planning',
    'what still needed work',
    'project became easier to discuss',
    'scenario',
  ];

  return genericTerms.filter((term) => text.includes(term)).length >= 2;
}

function hasReadingWinPassageTexture(
  passage: string,
  standardCode: string,
  source?: string | null
) {
  const paragraphs = passage
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
  const words = wordCount(passage);
  const isTrustedPublicDomain = source === 'gutenberg_public_domain';

  if (standardCode === 'ELA.9.R.3.1') {
    if (isTrustedPublicDomain) {
      return words >= 80 && paragraphs.length >= 1;
    }

    return (
      words >= 120 &&
      paragraphs.length >= 2 &&
      /["“”]|\blike\b|\bas if\b|\bseemed\b|\bwhile\b/i.test(passage) &&
      /\b(wind|fog|dock|field|bowl|window|rain|water|scoreboard|lighthouse|kitchen|truck|grass|marsh|door)\b/i.test(
        passage
      )
    );
  }

  return words >= 90 && paragraphs.length >= 2;
}

function uniqueOptions(options: string[]) {
  const seen = new Set<string>();
  return options.filter((option) => {
    const signature = normalizeText(option);
    if (!signature || seen.has(signature)) return false;
    seen.add(signature);
    return true;
  });
}

function promptFitsStandard(prompt: string, standardCode: string) {
  const text = normalizeText(prompt);
  const hasAny = (terms: string[]) => terms.some((term) => text.includes(term));

  if (standardCode === 'ELA.9.R.3.1') {
    return (
      hasAny(['figurative', 'phrase', 'image', 'simile', 'metaphor', 'personification']) &&
      hasAny(['affect', 'effect', 'understanding', 'mood', 'tone', 'meaning'])
    );
  }

  if (standardCode === 'ELA.9.R.1.1') {
    return hasAny([
      'detail',
      'element',
      'description',
      'setting',
      'contribute',
      'enhance',
      'meaning',
    ]);
  }

  if (standardCode === 'ELA.9.R.1.2') {
    return hasAny(['theme', 'develop', 'lesson', 'message']);
  }

  if (standardCode === 'ELA.9.R.2.1') {
    return hasAny(['structure', 'paragraph', 'feature', 'purpose', 'organize']);
  }

  if (standardCode === 'ELA.9.R.2.2') {
    return hasAny(['central idea', 'support', 'evidence', 'develop']);
  }

  if (standardCode === 'ELA.9.V.1.2' || standardCode === 'ELA.9.V.1.3') {
    return hasAny(['word', 'phrase', 'meaning', 'context', 'clue', 'connotation']);
  }

  return hasAny(['best', 'how', 'why', 'effect', 'meaning', 'purpose', 'develop', 'support']);
}

function scoreQuestionQuality(args: {
  row: PromotedReadingWinQuestion;
  passage: string;
  prompt: string;
  options: string[];
  correctAnswer: string;
  demand: FastGrade9ReadingDemand;
}) {
  let score = 0;
  const passageWords = wordCount(args.passage);
  const promptWords = wordCount(args.prompt);
  const correctInOptions = args.options.includes(args.correctAnswer);
  const target = args.row.cognitive_skill_targeted?.trim();

  if (target === args.demand.standardCode) score += 3;
  if (passageWords >= 45) score += 2;
  if (passageWords >= 90) score += 1;
  if (promptWords >= 7) score += 1;
  if (args.options.length >= 4) score += 2;
  if (correctInOptions) score += 2;
  if (promptFitsStandard(args.prompt, args.demand.standardCode)) score += 3;
  if ((args.row.rationale?.trim().length ?? 0) >= 24 || args.row.is_released_item) score += 1;
  if (args.options.every((option) => wordCount(option) >= 4)) score += 1;

  return score;
}

function parseQuestion(
  row: PromotedReadingWinQuestion,
  demand: FastGrade9ReadingDemand
): ParsedQuestion | null {
  const passage = section(row.content, 'PASSAGE');
  const prompt = section(row.content, 'QUESTION');
  const options = ['A', 'B', 'C', 'D']
    .map((letter) => optionByLetter(row, letter))
    .filter((option): option is string => Boolean(option));
  const finalOptions = uniqueOptions(
    options.length >= 2 ? options : parseContentOptions(row.content)
  );

  if (!passage || !prompt || finalOptions.length < 3) return null;
  if (hasGenericAiTexture(row.title ?? '', passage)) return null;
  if (!hasReadingWinPassageTexture(passage, demand.standardCode, row.source)) return null;

  const correctLetter = row.correct_option?.trim().toUpperCase() ?? '';
  const correctAnswer =
    /^[A-D]$/.test(correctLetter) && optionByLetter(row, correctLetter)
      ? optionByLetter(row, correctLetter)!
      : (finalOptions.find((option) => option.trim() === row.correct_option?.trim()) ??
        finalOptions[0]);
  const qualityScore = scoreQuestionQuality({
    row,
    passage,
    prompt,
    options: finalOptions,
    correctAnswer,
    demand,
  });

  if (qualityScore < 8) return null;

  return {
    id: row.id,
    title: row.title?.trim() || 'GOGI Reading Win Passage',
    passage,
    passageSignature: normalizeText(passage).slice(0, 220),
    prompt,
    options: finalOptions.slice(0, 4),
    correctAnswer,
    rationale: row.rationale,
    difficulty: clampDifficulty(row.difficulty_level),
    source: row.source ?? (row.is_released_item ? 'released_fast' : 'gogi_question_bank'),
    qualityScore,
  };
}

function anchorFromPrompt(prompt: string) {
  const quoted = prompt.match(/[“"]([^”"]{3,80})[”"]/);
  return quoted?.[1] ?? '';
}

function itemFromParsed(args: {
  parsed: ParsedQuestion;
  demand: FastGrade9ReadingDemand;
  index: number;
  transfer?: boolean;
}): ReadingWinLoopItem {
  const move =
    args.demand.readingWinLoop[Math.min(args.index, args.demand.readingWinLoop.length - 1)] ??
    args.demand.id;
  return {
    id: args.parsed.id,
    benchmarkCode: args.demand.standardCode,
    cognitiveMoveId: move,
    difficulty: args.parsed.difficulty,
    sourcePattern: `Promoted ${args.parsed.source} question bank item for ${args.demand.standardCode}`,
    context: args.transfer ? args.parsed.passage : args.parsed.prompt,
    anchor: anchorFromPrompt(args.parsed.prompt),
    prompt: args.transfer ? `New passage. ${args.parsed.prompt}` : args.parsed.prompt,
    options: args.parsed.options,
    correctAnswer: args.parsed.correctAnswer,
    scaffold: `Use today's move: ${args.demand.studentMove} Choose the answer that proves the standard in this passage.`,
    successCold: `Yes. That is ${args.demand.studentTitle.toLowerCase()} without extra support.`,
    successScaffold: `Good. You used the scaffold to apply the ${args.demand.standardCode} move.`,
    workedExample:
      args.parsed.rationale ??
      `The right answer must match the passage evidence and the skill: ${args.demand.proofOfGrowth}`,
    transfer: args.transfer,
  };
}

export function buildReadingWinSessionFromQuestions(args: {
  demand: FastGrade9ReadingDemand;
  questions: PromotedReadingWinQuestion[];
}): ReadingWinSession | null {
  const parsed = args.questions
    .map((question) => parseQuestion(question, args.demand))
    .filter((item): item is ParsedQuestion => Boolean(item));
  if (parsed.length < 2) return null;

  const deduped = parsed
    .sort((a, b) => b.qualityScore - a.qualityScore || a.difficulty - b.difficulty)
    .filter((item, index, list) => {
      const signature = `${normalizeText(item.prompt)}::${item.options.map(normalizeText).join('|')}`;
      return (
        list.findIndex(
          (candidate) =>
            `${normalizeText(candidate.prompt)}::${candidate.options
              .map(normalizeText)
              .join('|')}` === signature
        ) === index
      );
    });

  if (deduped.length < 2) return null;

  const byTitle = deduped.reduce<Record<string, ParsedQuestion[]>>((map, item) => {
    map[item.title] = [...(map[item.title] ?? []), item];
    return map;
  }, {});
  const primaryGroup =
    Object.values(byTitle).sort((a, b) => b.length - a.length)[0] ?? deduped.slice(0, 1);
  const primary = primaryGroup[0];
  const transfer =
    deduped.find((item) => item.passageSignature !== primary.passageSignature) ?? null;
  if (!transfer) return null;

  const practice = primaryGroup
    .filter((item) => item.id !== transfer.id)
    .concat(
      deduped.filter(
        (item) => item.passageSignature !== primary.passageSignature && item.id !== transfer.id
      )
    )
    .slice(0, 5);

  if (practice.length < 5) return null;

  return {
    benchmarkCode: args.demand.standardCode,
    studentTitle: args.demand.studentTitle,
    teacherTitle: args.demand.teacherTitle,
    sourcePattern: `Promoted GOGI question bank for ${args.demand.standardCode}`,
    passageTitle: primary.title,
    passage: primary.passage,
    items: practice.map((item, index) =>
      itemFromParsed({ parsed: item, demand: args.demand, index })
    ),
    transferPassageTitle: transfer.title,
    transferPassage: transfer.passage,
    transferItem: itemFromParsed({
      parsed: transfer,
      demand: args.demand,
      index: practice.length,
      transfer: true,
    }),
  };
}

export function analyzeReadingWinCoverage(args: {
  demand: FastGrade9ReadingDemand;
  questions: PromotedReadingWinQuestion[];
}): ReadingWinCoverageAnalysis {
  const parsed = args.questions
    .map((question) => parseQuestion(question, args.demand))
    .filter((item): item is ParsedQuestion => Boolean(item));
  const distinctPassages = new Set(parsed.map((item) => item.passageSignature)).size;
  const estimatedFreshSessions = Math.max(
    0,
    Math.min(Math.floor(parsed.length / 6), Math.max(0, distinctPassages - 1))
  );
  const pilotDepthTarget = 4;
  const depthStatus: ReadingWinCoverageAnalysis['depthStatus'] =
    estimatedFreshSessions >= pilotDepthTarget
      ? 'pilot_depth'
      : estimatedFreshSessions >= 2
        ? 'pilot_sequence'
        : estimatedFreshSessions >= 1
          ? 'one_session'
          : 'empty';
  const session = buildReadingWinSessionFromQuestions(args);
  const issues: string[] = [];

  if (args.questions.length === 0) {
    issues.push('No approved question-bank rows found.');
  }
  if (parsed.length < 6) {
    issues.push('Needs at least five quality reps plus one transfer item.');
  }
  if (distinctPassages < 2) {
    issues.push('Needs a second passage for transfer.');
  }
  if (!session) {
    issues.push('Current rows do not pass the Reading Win quality gate.');
  }

  const ready = Boolean(session);
  const status = ready ? 'ready' : parsed.length > 0 ? 'thin' : 'blocked';

  return {
    standardCode: args.demand.standardCode,
    approvedRows: args.questions.length,
    viableRows: parsed.length,
    distinctPassages,
    estimatedFreshSessions,
    pilotDepthTarget,
    depthStatus,
    releasedRows: args.questions.filter((question) => question.is_released_item).length,
    originalRows: args.questions.filter(
      (question) => question.source === 'gogi_original_fast_aligned'
    ).length,
    gutenbergRows: args.questions.filter(
      (question) => question.source === 'gutenberg_public_domain'
    ).length,
    ready,
    status,
    issues,
    session,
  };
}
