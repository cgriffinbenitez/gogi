import fs from 'fs/promises';
import path from 'path';
import type { PullOutRow, PullOutSheet } from '@/lib/teacher/pullOutSheet';
import {
  hasScholarlyOrNonStudentFacingSignals,
  isGenreCompatibleForStandard,
  normalizedStandardCode,
  standardShortCode,
} from '@/lib/teacher/officialCorpusGuards';
import {
  getTeacherAssessmentWeight,
  getTeacherStandardGuidance,
  getTeacherStandardLabel,
} from '@/lib/teacher/pullOutSheet';

export type LessonPackageStatus = 'curated' | 'gold-card-fallback' | 'not-ready';

export type LessonVocabularyWord = {
  term: string;
  meaning: string;
  example: string;
};

export type LessonWorkedExample = {
  element: string;
  evidence: string;
  effect: string;
};

export type LessonPackage = {
  status: LessonPackageStatus;
  label: string;
  standard: {
    code: string;
    title: string;
    officialText: string;
    stateGuidance: string[];
    studentsNeedToKnow: string[];
    fastDemand: string;
    itemShape: string;
    strategy: string;
    assessmentWeight: {
      category: string;
      percentOfTest: string;
      priority: 'highest' | 'high' | 'supporting';
      note: string;
    };
  };
  text: {
    selection: string;
    location: string;
  } | null;
  textClean: string;
  vocabulary: LessonVocabularyWord[];
  workedExample: LessonWorkedExample | null;
  anchorQuestion: PullOutRow['anchorQuestion'] | null;
  sourceRows: PullOutRow[];
  warnings: string[];
  blockers: string[];
};

type ClaudeReadyChoice = { label: 'A' | 'B' | 'C' | 'D'; text: string; correct: boolean };
type ClaudeReadyCard = {
  id: string;
  textTitle: string;
  textAuthor: string | null;
  standardCode: string;
  standardTitle: string;
  subSkillId: string;
  subSkillLabel: string;
  location: string;
  excerpt: string;
  wordCount?: number;
  whyThisWorks: string;
  skillStrategy: string;
  evidencePoints: string[];
  question: string;
  choices: ClaudeReadyChoice[];
};
type ClaudeReadyCorpus = {
  texts?: Array<{
    title: string;
    author: string | null;
    cards: ClaudeReadyCard[];
  }>;
};

const CLAUDE_READY_PATH = path.join(
  process.cwd(),
  'data',
  'official-text-library',
  'claude-ready-gold-cards.json'
);

function cleanSentence(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}

function extractVocabulary(row: PullOutRow | null): LessonVocabularyWord[] {
  const excerpt = row?.excerpt ?? '';
  const banned = new Set([
    'there',
    'their',
    'about',
    'which',
    'would',
    'could',
    'should',
    'because',
    'through',
    'before',
    'after',
    'evidence',
    'effect',
    'context',
    'analysis',
    'excerpt',
    'reader',
    'author',
  ]);

  const candidates = [...new Set(excerpt.match(/\b[A-Za-z][A-Za-z'-]{6,}\b/g) ?? [])]
    .map((word) => word.replace(/^['"]|['"]$/g, ''))
    .filter((word) => !banned.has(word.toLowerCase()))
    .slice(0, 5);

  return candidates.map((term) => {
    const sentence =
      excerpt
        .match(new RegExp(`[^.!?]*\\b${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b[^.!?]*[.!?]?`, 'i'))?.[0]
        ?.trim() || excerpt.split(/[.!?]/)[0]?.trim() || '';

    return {
      term,
      meaning: 'Use the sentence around this word to determine its precise meaning.',
      example: cleanSentence(sentence),
    };
  });
}

function buildWorkedExample(row: PullOutRow | null): LessonWorkedExample | null {
  if (!row) return null;
  const evidence = row.teacherTrust.evidencePoints.find((point) => point.length > 20) ?? row.teacherTrust.evidencePoints[0];
  if (!evidence) return null;

  return {
    element: row.skillFocus,
    evidence,
    effect: row.whyThisExcerpt,
  };
}

function rowsFromBestSingleText(rows: PullOutRow[]) {
  const byText = new Map<string, PullOutRow[]>();
  for (const row of rows) {
    byText.set(row.selection, [...(byText.get(row.selection) ?? []), row]);
  }

  return [...byText.values()].sort((a, b) => {
    if (b.length !== a.length) return b.length - a.length;
    const bWords = b.reduce((sum, row) => sum + row.teacherTrust.excerptWords, 0);
    const aWords = a.reduce((sum, row) => sum + row.teacherTrust.excerptWords, 0);
    return bWords - aWords;
  })[0] ?? [];
}

function wordCount(value: string) {
  return value.trim().split(/\s+/).filter(Boolean).length;
}

function cardToPullOutRow(card: ClaudeReadyCard, index: number): PullOutRow {
  const source = `${card.textTitle}${card.textAuthor ? ` — ${card.textAuthor}` : ''}`;

  return {
    number: index + 1,
    standard: standardShortCode(card.standardCode),
    subSkillId: card.subSkillId,
    skillFocus: card.subSkillLabel,
    selection: source,
    exactLinesOrParagraphs: card.location,
    excerpt: card.excerpt,
    whyThisExcerpt: card.whyThisWorks,
    moveStatementTemplate: card.skillStrategy,
    qualityGate: {
      status: 'gold',
      label: 'Claude-ready card',
      checks: [
        'Question points to this excerpt',
        'FAST-style answer choices included',
        'Evidence points are attached',
      ],
    },
    teacherTrust: {
      confidence: 'strong',
      officialTextMap: true,
      localSourceText: true,
      excerptWords: card.wordCount ?? wordCount(card.excerpt),
      evidencePoints: card.evidencePoints,
      useCase: `Teach ${card.standardCode}: ${card.subSkillLabel}`,
      whyTrustIt: card.whyThisWorks,
    },
    anchorQuestion: {
      stem: card.question,
      choices: card.choices,
    },
  };
}

function rowKey(row: PullOutRow) {
  return [
    row.selection,
    row.exactLinesOrParagraphs,
    row.subSkillId ?? '',
    row.anchorQuestion.stem,
    row.excerpt.slice(0, 140),
  ].join('::');
}

function dedupeRows(rows: PullOutRow[]) {
  const seen = new Set<string>();
  const uniqueRows: PullOutRow[] = [];

  for (const row of rows) {
    const key = rowKey(row);
    if (seen.has(key)) continue;
    seen.add(key);
    uniqueRows.push(row);
  }

  return uniqueRows.map((row, index) => ({ ...row, number: index + 1 }));
}

function sortLessonRows(rows: PullOutRow[]) {
  return [...rows].sort((a, b) => {
    const aStatus = a.qualityGate?.label === 'Claude-ready card' ? 1 : 0;
    const bStatus = b.qualityGate?.label === 'Claude-ready card' ? 1 : 0;
    if (bStatus !== aStatus) return bStatus - aStatus;
    const bPriority = textPriorityForLesson(b.selection, b.standard);
    const aPriority = textPriorityForLesson(a.selection, a.standard);
    if (bPriority !== aPriority) return bPriority - aPriority;
    if (b.teacherTrust.excerptWords !== a.teacherTrust.excerptWords) {
      return b.teacherTrust.excerptWords - a.teacherTrust.excerptWords;
    }
    return a.selection.localeCompare(b.selection);
  });
}

function textPriorityForLesson(selection: string, standard: string) {
  const normalizedStandard = normalizedStandardCode(standard);

  if (normalizedStandard.startsWith('R.2.') || normalizedStandard === 'R.3.4') {
    const priorities = [
      'I Have a Dream',
      'Letter from Birmingham Jail',
      'The Lincoln-Douglas Debates',
      'The Danger of a Single Story',
      'A Modest Proposal',
      'The Talented Tenth',
      'Industrial Education',
      'The Prince',
      'Democracy in America',
      'Letter to the Grand Duchess',
      'Nobel Prize Acceptance Speech',
      'Speech to the Troops at Tilbury',
    ];
    const index = priorities.findIndex((title) => selection.includes(title));
    if (index >= 0) return priorities.length - index;
  }

  return 0;
}

function selectSixLessonRows(rows: PullOutRow[]) {
  const uniqueRows = dedupeRows(sortLessonRows(rows.filter(isStudentFacingLessonRow)));
  const byText = new Map<string, PullOutRow[]>();

  for (const row of uniqueRows) {
    byText.set(row.selection, [...(byText.get(row.selection) ?? []), row]);
  }

  const bestFullTextSet = [...byText.values()]
    .filter((group) => group.length >= 6)
    .sort((a, b) => {
      const bClaude = b.filter((row) => row.qualityGate?.label === 'Claude-ready card').length;
      const aClaude = a.filter((row) => row.qualityGate?.label === 'Claude-ready card').length;
      if (bClaude !== aClaude) return bClaude - aClaude;
      const bWords = b.reduce((sum, row) => sum + row.teacherTrust.excerptWords, 0);
      const aWords = a.reduce((sum, row) => sum + row.teacherTrust.excerptWords, 0);
      return bWords - aWords;
    })[0];

  return (bestFullTextSet ?? uniqueRows).slice(0, 6).map((row, index) => ({ ...row, number: index + 1 }));
}

function isStudentFacingLessonRow(row: PullOutRow) {
  if (!isGenreCompatibleForStandard(row.selection, row.standard)) return false;
  if (
    hasScholarlyOrNonStudentFacingSignals({
      excerpt: row.excerpt,
      question: row.anchorQuestion.stem,
      textTitleOrSelection: row.selection,
    })
  ) {
    return false;
  }

  return true;
}

async function loadClaudeReadyCards(args: { standardCode: string; subSkillId?: string | null }) {
  let corpus: ClaudeReadyCorpus;
  try {
    corpus = JSON.parse(await fs.readFile(CLAUDE_READY_PATH, 'utf8')) as ClaudeReadyCorpus;
  } catch {
    return [];
  }

  const cards = (corpus.texts ?? []).flatMap((text) => text.cards ?? []);
  return cards.filter((card) => {
    if (card.standardCode !== args.standardCode) return false;
    if (args.subSkillId && card.subSkillId !== args.subSkillId) return false;
    if (!isStudentFacingSourceExcerpt(card)) return false;
    return true;
  });
}

function isStudentFacingSourceExcerpt(card: ClaudeReadyCard) {
  if (!isGenreCompatibleForStandard(card.textTitle, card.standardCode)) return false;
  if (
    hasScholarlyOrNonStudentFacingSignals({
      excerpt: card.excerpt,
      question: card.question,
      textTitleOrSelection: card.textTitle,
    })
  ) {
    return false;
  }

  return true;
}

export async function enrichLessonPackageWithReadyCards(
  lessonPackage: LessonPackage,
  args: { standardCode: string; subSkillId?: string | null }
): Promise<LessonPackage> {
  const readyCards = await loadClaudeReadyCards(args);
  if (!readyCards.length) {
    const sourceRows = selectSixLessonRows(lessonPackage.sourceRows);
    const anchor = sourceRows[0] ?? null;
    const vocabulary = extractVocabulary(anchor);
    const workedExample = buildWorkedExample(anchor);
    const { warnings, blockers } = packageWarnings({ anchor, sourceRows, vocabulary, workedExample });

    return {
      ...lessonPackage,
      text: anchor
        ? {
            selection: anchor.selection,
            location: anchor.exactLinesOrParagraphs,
          }
        : lessonPackage.text,
      textClean: anchor?.excerpt ?? lessonPackage.textClean,
      vocabulary,
      workedExample,
      anchorQuestion: anchor?.anchorQuestion ?? lessonPackage.anchorQuestion,
      sourceRows,
      warnings,
      blockers,
    };
  }

  const readyRows = readyCards.map(cardToPullOutRow);
  const sourceRows = selectSixLessonRows([...readyRows, ...lessonPackage.sourceRows]);
  const anchor = sourceRows[0] ?? null;
  const vocabulary = extractVocabulary(anchor);
  const workedExample = buildWorkedExample(anchor);
  const { warnings, blockers } = packageWarnings({ anchor, sourceRows, vocabulary, workedExample });
  const textCount = new Set(sourceRows.map((row) => row.selection)).size;

  const corpusWarnings = [...warnings];
  if (textCount > 1 && sourceRows.length >= 6) {
    corpusWarnings.push(
      'GOGI is using the six strongest approved reps across texts because no single anchor text has six approved cards for this exact lesson lane yet.'
    );
  }

  const status: LessonPackageStatus = blockers.length
    ? 'not-ready'
    : corpusWarnings.length
      ? 'gold-card-fallback'
      : 'curated';

  return {
    ...lessonPackage,
    status,
    label:
      status === 'curated'
        ? 'Curated lesson package'
        : status === 'gold-card-fallback'
          ? 'Approved corpus lesson package'
          : 'Not lesson-ready yet',
    text: anchor
      ? {
          selection: anchor.selection,
          location: anchor.exactLinesOrParagraphs,
        }
      : lessonPackage.text,
    textClean: anchor?.excerpt ?? lessonPackage.textClean,
    vocabulary,
    workedExample,
    anchorQuestion: anchor?.anchorQuestion ?? lessonPackage.anchorQuestion,
    sourceRows,
    warnings: corpusWarnings,
    blockers,
  };
}

function packageWarnings(args: {
  anchor: PullOutRow | null;
  sourceRows: PullOutRow[];
  vocabulary: LessonVocabularyWord[];
  workedExample: LessonWorkedExample | null;
}) {
  const warnings: string[] = [];
  const blockers: string[] = [];

  if (!args.anchor) {
    blockers.push('No strong teaching card exists for this standard yet.');
    return { warnings, blockers };
  }

  warnings.push(
    'This package was generated from audited gold cards, not from a dedicated excerpt file with curated vocab and worked examples yet.'
  );

  if (args.sourceRows.length < 6) {
    warnings.push(
      `GOGI has ${args.sourceRows.length} distinct approved card${args.sourceRows.length === 1 ? '' : 's'} ready for this lesson right now. This standard/text needs six distinct reps before it is fully lesson-ready.`
    );
  }

  if (args.vocabulary.length < 4) {
    blockers.push('Curated vocabulary is missing. The uploaded lesson generator requires 4-5 excerpt-specific vocabulary words.');
  } else {
    warnings.push('Vocabulary is inferred from the excerpt. It still needs teacher approval before this becomes a final deck.');
  }

  if (!args.workedExample || args.workedExample.effect.length < 40) {
    blockers.push('A real worked-example effect explanation is missing or too thin.');
  }

  return { warnings, blockers };
}

export function buildLessonPackageFromPullOutSheet(args: {
  standardCode: string;
  sheet: PullOutSheet;
  subSkillId?: string | null;
}): LessonPackage {
  const guidance = getTeacherStandardGuidance(args.standardCode);
  const strongRows = args.sheet.rows.filter((row) => row.teacherTrust.confidence === 'strong');
  const candidateRows = strongRows.length ? strongRows : args.sheet.rows;
  const laneRows =
    args.subSkillId && candidateRows.some((row) => row.subSkillId === args.subSkillId)
      ? candidateRows.filter((row) => row.subSkillId === args.subSkillId)
      : candidateRows;
  const bestSingleTextRows = rowsFromBestSingleText(laneRows);
  const anchor = bestSingleTextRows[0] ?? laneRows[0] ?? null;
  const sourceRows = bestSingleTextRows.length >= 3 ? bestSingleTextRows.slice(0, 6) : laneRows.slice(0, 6);

  const vocabulary = extractVocabulary(anchor);
  const workedExample = buildWorkedExample(anchor);
  const { warnings, blockers } = packageWarnings({ anchor, sourceRows, vocabulary, workedExample });
  const status: LessonPackageStatus = blockers.length
    ? 'not-ready'
    : warnings.length
      ? 'gold-card-fallback'
      : 'curated';

  return {
    status,
    label:
      status === 'curated'
        ? 'Curated lesson package'
        : status === 'gold-card-fallback'
          ? 'Gold-card fallback package'
          : 'Not lesson-ready yet',
    standard: {
      code: args.standardCode,
      title: getTeacherStandardLabel(args.standardCode),
      officialText: guidance.standardText,
      stateGuidance: guidance.stateGuidance,
      studentsNeedToKnow: guidance.studentsNeedToKnow,
      fastDemand: guidance.fastDemand,
      itemShape: guidance.itemShape,
      strategy: guidance.strategy,
      assessmentWeight: getTeacherAssessmentWeight(args.standardCode),
    },
    text: anchor
      ? {
          selection: anchor.selection,
          location: anchor.exactLinesOrParagraphs,
        }
      : null,
    textClean: anchor?.excerpt ?? '',
    vocabulary,
    workedExample,
    anchorQuestion: anchor?.anchorQuestion ?? null,
    sourceRows,
    warnings,
    blockers,
  };
}
