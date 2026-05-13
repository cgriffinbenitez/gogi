import fs from 'fs/promises';
import path from 'path';
import { buildTeachingReadinessBoard, type PullOutRow } from '@/lib/teacher/pullOutSheet';
import {
  hasScholarlyOrNonStudentFacingSignals,
  isGenreCompatibleForStandard,
} from '@/lib/teacher/officialCorpusGuards';

type ManifestEntry = {
  title: string;
  author: string | null;
  standards: string[];
  status: string;
  text_path: string | null;
  word_count: number;
};

type Manifest = {
  entries: ManifestEntry[];
};

type ManualUploadEntry = {
  title: string;
  author?: string | null;
  word_count?: number;
  path?: string | null;
};

type ManualUploadManifest = {
  entries?: ManualUploadEntry[];
};

export type OfficialTeachableCard = {
  standardCode: string;
  standardTitle: string;
  subSkillId: string;
  skillLabel: string;
  selection: string;
  location: string;
  excerpt: string;
  question: string;
  choices: Array<{ label: string; text: string; correct: boolean }>;
  evidencePoints: string[];
  quality: string;
  confidence: string;
};

export type OfficialTeachableText = {
  title: string;
  author: string | null;
  status: string;
  wordCount: number;
  hasLocalText: boolean;
  standards: string[];
  cards: OfficialTeachableCard[];
  cardCount: number;
  standardsWithCards: string[];
  standardsWithoutCards: string[];
};

export type OfficialTeachableCorpus = {
  generatedAt: string;
  summary: {
    officialTexts: number;
    locallyStoredTexts: number;
    textsWithGoldCards: number;
    totalGoldCards: number;
    standardsRepresented: number;
    locallyStoredWithoutGoldCards: number;
    officialTextsWithoutLocalSource: number;
  };
  texts: OfficialTeachableText[];
};

const ROOT = process.cwd();
const MANIFEST_PATH = path.join(ROOT, 'data', 'official-text-library', 'manifest.json');
const MANUAL_UPLOAD_MANIFEST_PATH = path.join(
  ROOT,
  'data',
  'official-text-library',
  'manual-uploads',
  'manifest.json'
);

function normalize(value: string | null | undefined) {
  return (value ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function selectionMatchesTitle(selection: string, title: string) {
  const normalizedSelection = normalize(selection);
  const normalizedTitle = normalize(title);
  if (!normalizedSelection || !normalizedTitle) return false;
  return (
    normalizedSelection === normalizedTitle ||
    normalizedSelection.startsWith(`${normalizedTitle} `) ||
    normalizedSelection.includes(` ${normalizedTitle} `) ||
    normalizedSelection.includes(normalizedTitle)
  );
}

async function readJsonIfExists<T>(filePath: string): Promise<T | null> {
  try {
    return JSON.parse(await fs.readFile(filePath, 'utf8')) as T;
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') return null;
    throw error;
  }
}

async function loadManifestWithManualUploads(): Promise<Manifest> {
  const manifest = JSON.parse(await fs.readFile(MANIFEST_PATH, 'utf8')) as Manifest;
  const manualManifest = await readJsonIfExists<ManualUploadManifest>(MANUAL_UPLOAD_MANIFEST_PATH);
  const manualByTitle = new Map(
    (manualManifest?.entries ?? []).map((entry) => [normalize(entry.title), entry])
  );

  return {
    entries: manifest.entries.map((entry) => {
      const manual = manualByTitle.get(normalize(entry.title));
      if (!manual || entry.status === 'stored') return entry;
      return {
        ...entry,
        author: manual.author ?? entry.author,
        status: 'manual_upload',
        text_path: manual.path ?? entry.text_path,
        word_count: manual.word_count ?? entry.word_count,
      };
    }),
  };
}

function cardFromRow(args: {
  row: PullOutRow;
  standardCode: string;
  standardTitle: string;
  subSkillId: string;
  skillLabel: string;
}): OfficialTeachableCard {
  return {
    standardCode: args.standardCode,
    standardTitle: args.standardTitle,
    subSkillId: args.subSkillId,
    skillLabel: args.skillLabel,
    selection: args.row.selection,
    location: args.row.exactLinesOrParagraphs,
    excerpt: args.row.excerpt,
    question: args.row.anchorQuestion.stem,
    choices: args.row.anchorQuestion.choices,
    evidencePoints: args.row.teacherTrust.evidencePoints,
    quality: args.row.qualityGate?.label ?? 'No quality gate',
    confidence: args.row.teacherTrust.confidence,
  };
}

export async function buildOfficialTeachableCorpus(): Promise<OfficialTeachableCorpus> {
  const manifest = await loadManifestWithManualUploads();
  const board = await buildTeachingReadinessBoard({ targetPerSkill: 5, maxStandards: 20 });
  const texts: OfficialTeachableText[] = manifest.entries.map((entry) => ({
    title: entry.title,
    author: entry.author,
    status: entry.status,
    wordCount: entry.word_count,
    hasLocalText: Boolean(entry.text_path) && (entry.status === 'stored' || entry.status === 'manual_upload'),
    standards: entry.standards.filter((standard) => isGenreCompatibleForStandard(entry.title, standard)),
    cards: [],
    cardCount: 0,
    standardsWithCards: [],
    standardsWithoutCards: [],
  }));

  for (const standard of board.standards) {
    for (const skill of standard.skills) {
      for (const row of skill.pullOuts) {
        if (row.teacherTrust.confidence !== 'strong') continue;
        if (!isGenreCompatibleForStandard(row.selection, standard.code)) continue;
        if (
          hasScholarlyOrNonStudentFacingSignals({
            excerpt: row.excerpt,
            question: row.anchorQuestion.stem,
            textTitleOrSelection: row.selection,
          })
        ) {
          continue;
        }
        const matchedTexts = texts.filter((text) => selectionMatchesTitle(row.selection, text.title));
        for (const text of matchedTexts) {
          text.cards.push(
            cardFromRow({
              row,
              standardCode: standard.code,
              standardTitle: standard.title,
              subSkillId: skill.strandId,
              skillLabel: skill.label,
            })
          );
        }
      }
    }
  }

  for (const text of texts) {
    text.cardCount = text.cards.length;
    text.standardsWithCards = [...new Set(text.cards.map((card) => card.standardCode))].sort();
    text.standardsWithoutCards = text.standards
      .filter((standard) => !text.standardsWithCards.includes(standard))
      .sort();
    text.cards.sort(
      (a, b) =>
        a.standardCode.localeCompare(b.standardCode) ||
        a.subSkillId.localeCompare(b.subSkillId) ||
        a.location.localeCompare(b.location)
    );
  }

  const totalGoldCards = texts.reduce((sum, text) => sum + text.cardCount, 0);
  const standardsRepresented = new Set(texts.flatMap((text) => text.standardsWithCards)).size;
  const locallyStoredWithoutGoldCards = texts.filter((text) => text.hasLocalText && text.cardCount === 0).length;
  const officialTextsWithoutLocalSource = texts.filter((text) => !text.hasLocalText).length;

  return {
    generatedAt: new Date().toISOString(),
    summary: {
      officialTexts: texts.length,
      locallyStoredTexts: texts.filter((text) => text.hasLocalText).length,
      textsWithGoldCards: texts.filter((text) => text.cardCount > 0).length,
      totalGoldCards,
      standardsRepresented,
      locallyStoredWithoutGoldCards,
      officialTextsWithoutLocalSource,
    },
    texts: texts.sort((a, b) => b.cardCount - a.cardCount || a.title.localeCompare(b.title)),
  };
}

function groupedCardsByStandard(cards: OfficialTeachableCard[]) {
  const groups = new Map<string, { standardCode: string; standardTitle: string; cards: OfficialTeachableCard[] }>();
  for (const card of cards) {
    const existing = groups.get(card.standardCode);
    if (existing) {
      existing.cards.push(card);
    } else {
      groups.set(card.standardCode, {
        standardCode: card.standardCode,
        standardTitle: card.standardTitle,
        cards: [card],
      });
    }
  }
  return [...groups.values()].sort((a, b) => a.standardCode.localeCompare(b.standardCode));
}

function formatChoices(choices: OfficialTeachableCard['choices']) {
  return choices.map((choice) => `${choice.correct ? '**' : ''}${choice.label}. ${choice.text}${choice.correct ? '**' : ''}`);
}

export function officialTeachableCorpusMarkdown(corpus: OfficialTeachableCorpus) {
  const lines = [
    '# GOGI Official Teachable Corpus',
    '',
    `Generated: ${corpus.generatedAt}`,
    `Official texts: ${corpus.summary.officialTexts}`,
    `Locally stored/manual texts: ${corpus.summary.locallyStoredTexts}`,
    `Texts with gold-card coverage: ${corpus.summary.textsWithGoldCards}`,
    `Gold-card text links: ${corpus.summary.totalGoldCards}`,
    `Standards represented: ${corpus.summary.standardsRepresented}`,
    `Stored texts with no gold cards yet: ${corpus.summary.locallyStoredWithoutGoldCards}`,
    `Official texts without a local source yet: ${corpus.summary.officialTextsWithoutLocalSource}`,
    '',
    '## Text Coverage',
    '',
    '| Text | Status | Source | Standards | Gold Cards | Standards With Cards | Gaps |',
    '| --- | --- | --- | ---: | ---: | --- | --- |',
  ];

  for (const text of corpus.texts) {
    lines.push(
      `| ${text.title}${text.author ? ` — ${text.author}` : ''} | ${text.status} | ${text.hasLocalText ? 'local' : 'missing'} | ${text.standards.length} | ${text.cardCount} | ${text.standardsWithCards.join(', ') || 'none yet'} | ${text.standardsWithoutCards.join(', ') || 'none'} |`
    );
  }

  lines.push('');
  lines.push('## Classroom-Ready Texts');
  lines.push('');

  for (const text of corpus.texts.filter((item) => item.cardCount > 0)) {
    lines.push(`### ${text.title}${text.author ? ` — ${text.author}` : ''}`);
    lines.push(`Gold cards: ${text.cardCount}`);
    for (const card of text.cards) {
      lines.push(`- ${card.standardCode} / ${card.skillLabel}: ${card.location} — ${card.question}`);
    }
    lines.push('');
  }

  return `${lines.join('\n')}\n`;
}

export function officialTeachableCorpusClaudeMarkdown(corpus: OfficialTeachableCorpus) {
  const lines = [
    '# GOGI Official Teachable Corpus — Claude Packet',
    '',
    'Purpose: This packet shows the official Grade 9 text map as GOGI currently understands it, with each classroom-ready excerpt tied to the exact standard and subskill it can teach.',
    '',
    'Use rules:',
    '- Use only the excerpts and questions shown here unless Carlos explicitly asks you to generate new material.',
    '- Treat “Gold card” entries as classroom-ready seeds for lessons, workbook pages, and FAST-style practice.',
    '- If a text has no cards or a standard gap, say the corpus needs more curation instead of pretending it is covered.',
    '- Preserve the standard/subskill lane when building lessons: do not use a setting card as a POV card, a theme card as a rhetoric card, etc.',
    '',
    '## Summary',
    '',
    `- Generated: ${corpus.generatedAt}`,
    `- Official texts in map: ${corpus.summary.officialTexts}`,
    `- Local source texts available: ${corpus.summary.locallyStoredTexts}`,
    `- Texts with gold-card coverage: ${corpus.summary.textsWithGoldCards}`,
    `- Gold-card text links: ${corpus.summary.totalGoldCards}`,
    `- Standards represented: ${corpus.summary.standardsRepresented}`,
    `- Stored texts with no gold cards yet: ${corpus.summary.locallyStoredWithoutGoldCards}`,
    `- Official texts without local source yet: ${corpus.summary.officialTextsWithoutLocalSource}`,
    '',
    '## Coverage Table',
    '',
    '| Text | Status | Source | Mapped Standards | Gold Cards | Standards Covered | Gaps |',
    '| --- | --- | --- | --- | ---: | --- | --- |',
  ];

  for (const text of corpus.texts) {
    lines.push(
      `| ${text.title}${text.author ? ` — ${text.author}` : ''} | ${text.status} | ${text.hasLocalText ? 'local' : 'missing'} | ${text.standards.join(', ') || 'none'} | ${text.cardCount} | ${text.standardsWithCards.join(', ') || 'none yet'} | ${text.standardsWithoutCards.join(', ') || 'none'} |`
    );
  }

  lines.push('');
  lines.push('## Text-by-Text Teachable Excerpts');
  lines.push('');

  for (const text of corpus.texts) {
    lines.push(`## ${text.title}${text.author ? ` — ${text.author}` : ''}`);
    lines.push(`- Source status: ${text.status}`);
    lines.push(`- Local source available: ${text.hasLocalText ? 'yes' : 'no'}`);
    lines.push(`- Word count: ${text.wordCount.toLocaleString()}`);
    lines.push(`- Official mapped standards: ${text.standards.join(', ') || 'none listed'}`);
    lines.push(`- Standards with gold cards: ${text.standardsWithCards.join(', ') || 'none yet'}`);
    lines.push(`- Standards still needing cards: ${text.standardsWithoutCards.join(', ') || 'none'}`);
    lines.push('');

    if (text.cards.length === 0) {
      lines.push('No gold-card teachable excerpts are curated for this text yet.');
      lines.push('');
      continue;
    }

    for (const group of groupedCardsByStandard(text.cards)) {
      lines.push(`### ${group.standardCode} — ${group.standardTitle}`);
      for (const [index, card] of group.cards.entries()) {
        lines.push('');
        lines.push(`#### Card ${index + 1}: ${card.skillLabel}`);
        lines.push(`- Location: ${card.location}`);
        lines.push(`- Quality: ${card.quality}`);
        lines.push(`- Confidence: ${card.confidence}`);
        lines.push('');
        lines.push('Excerpt:');
        lines.push('');
        lines.push(`> ${card.excerpt.replace(/\n+/g, '\n> ')}`);
        lines.push('');
        lines.push(`FAST-style question: ${card.question}`);
        lines.push('');
        lines.push(...formatChoices(card.choices));
        lines.push('');
        lines.push(`Evidence points: ${card.evidencePoints.join(' | ') || 'none listed'}`);
      }
      lines.push('');
    }
  }

  return `${lines.join('\n')}\n`;
}
