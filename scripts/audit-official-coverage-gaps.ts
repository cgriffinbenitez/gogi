#!/usr/bin/env tsx
import fs from 'fs/promises';
import path from 'path';

type Choice = { label: string; text: string; correct: boolean };

type CorpusCard = {
  standardCode: string;
  standardTitle: string;
  skillLabel: string;
  location: string;
  excerpt: string;
  question: string;
  choices: Choice[];
};

type CorpusText = {
  title: string;
  author: string | null;
  status: string;
  wordCount: number;
  hasLocalText: boolean;
  standards: string[];
  cards: CorpusCard[];
};

type TeachableCorpus = {
  summary: {
    officialTexts: number;
    locallyStoredTexts: number;
  };
  texts: CorpusText[];
};

type ClaudeCard = {
  textTitle: string;
  textAuthor: string | null;
  standardCode: string;
  standardTitle: string;
  subSkillLabel: string;
  location: string;
  excerpt: string;
  question: string;
  choices: Choice[];
};

type ClaudeCorpus = {
  summary: {
    readyCards: number;
  };
  texts: Array<{
    title: string;
    author: string | null;
    cards: ClaudeCard[];
  }>;
};

type AuditReport = {
  summary: {
    classroomReadyCards: number;
    cardsWithMajorRisk: number;
  };
  issues: Array<{
    severity: 'blocker' | 'major' | 'minor';
    layer: 'gold' | 'auto-ready' | 'claude-ready';
    textTitle: string;
    textAuthor: string | null;
    standardCode: string;
    subSkillLabel: string;
    location: string;
  }>;
};

const ROOT = process.cwd();
const CORPUS_PATH = path.join(ROOT, 'data', 'official-text-library', 'teachable-corpus.json');
const CLAUDE_PATH = path.join(ROOT, 'data', 'official-text-library', 'claude-ready-gold-cards.json');
const AUDIT_PATH = path.join(ROOT, 'data', 'official-text-library', 'audits', 'latest-card-quality-audit.json');
const OUT_JSON = path.join(ROOT, 'data', 'official-text-library', 'audits', 'latest-coverage-gap-audit.json');
const OUT_MD = path.join(ROOT, 'data', 'official-text-library', 'audits', 'latest-coverage-gap-audit.md');

function key(args: {
  layer: 'gold' | 'claude-ready';
  title: string;
  author: string | null;
  standardCode: string;
  subSkillLabel: string;
  location: string;
}) {
  return [args.layer, args.title, args.author ?? '', args.standardCode, args.subSkillLabel, args.location].join('::');
}

function label(title: string, author: string | null) {
  return `${title}${author ? ` — ${author}` : ''}`;
}

function byCountDesc<T extends { readyCards: number; title?: string; standardCode?: string }>(a: T, b: T) {
  return b.readyCards - a.readyCards || (a.title ?? a.standardCode ?? '').localeCompare(b.title ?? b.standardCode ?? '');
}

async function loadJson<T>(filePath: string) {
  return JSON.parse(await fs.readFile(filePath, 'utf8')) as T;
}

async function main() {
  const corpus = await loadJson<TeachableCorpus>(CORPUS_PATH);
  const claude = await loadJson<ClaudeCorpus>(CLAUDE_PATH);
  const audit = await loadJson<AuditReport>(AUDIT_PATH);

  const riskyIssues = audit.issues.filter(
    (issue): issue is typeof issue & { layer: 'gold' | 'claude-ready' } =>
      (issue.severity === 'blocker' || issue.severity === 'major') && (issue.layer === 'gold' || issue.layer === 'claude-ready')
  );
  const risk = new Set(
    riskyIssues.map((issue) =>
        key({
          layer: issue.layer,
          title: issue.textTitle,
          author: issue.textAuthor,
          standardCode: issue.standardCode,
          subSkillLabel: issue.subSkillLabel,
          location: issue.location,
        })
      )
  );

  const readyCards = [
    ...corpus.texts.flatMap((text) =>
      text.cards.map((card) => ({
        layer: 'gold' as const,
        title: text.title,
        author: text.author,
        standardCode: card.standardCode,
        standardTitle: card.standardTitle,
        subSkillLabel: card.skillLabel,
        location: card.location,
      }))
    ),
    ...claude.texts.flatMap((text) =>
      text.cards.map((card) => ({
        layer: 'claude-ready' as const,
        title: text.title,
        author: text.author,
        standardCode: card.standardCode,
        standardTitle: card.standardTitle,
        subSkillLabel: card.subSkillLabel,
        location: card.location,
      }))
    ),
  ].filter((card) =>
    !risk.has(
      key({
        layer: card.layer,
        title: card.title,
        author: card.author,
        standardCode: card.standardCode,
        subSkillLabel: card.subSkillLabel,
        location: card.location,
      })
    )
  );

  const byText = corpus.texts.map((text) => {
    const cards = readyCards.filter((card) => card.title === text.title && (card.author ?? '') === (text.author ?? ''));
    const standardsCovered = new Set(cards.map((card) => card.standardCode));
    const missingStandards = text.standards.filter((standard) => !standardsCovered.has(standard));
    return {
      title: label(text.title, text.author),
      status: text.status,
      hasLocalText: text.hasLocalText,
      mappedStandards: text.standards.length,
      standardsCovered: standardsCovered.size,
      missingStandards,
      readyCards: cards.length,
    };
  });

  const localTexts = byText.filter((text) => text.hasLocalText);
  const localNoCards = localTexts.filter((text) => text.readyCards === 0);
  const thinTexts = localTexts.filter((text) => text.readyCards > 0 && text.readyCards < 10);
  const strongTexts = localTexts.filter((text) => text.readyCards >= 25).sort(byCountDesc);

  const allStandards = [...new Set(corpus.texts.flatMap((text) => text.standards))].sort();
  const byStandard = allStandards
    .map((standardCode) => {
      const mappedTexts = corpus.texts.filter((text) => text.standards.includes(standardCode));
      const localMappedTexts = mappedTexts.filter((text) => text.hasLocalText);
      const cards = readyCards.filter((card) => card.standardCode === standardCode);
      const textsCovered = new Set(cards.map((card) => label(card.title, card.author)));
      const localTextsWithoutCards = localMappedTexts
        .filter((text) => !textsCovered.has(text.title))
        .map((text) => label(text.title, null));
      return {
        standardCode,
        readyCards: cards.length,
        localMappedTexts: localMappedTexts.length,
        textsCovered: textsCovered.size,
        localTextsWithoutCards,
      };
    })
    .sort((a, b) => a.readyCards - b.readyCards || a.standardCode.localeCompare(b.standardCode));

  const report = {
    generatedAt: new Date().toISOString(),
    summary: {
      officialTexts: corpus.summary.officialTexts,
      localSources: corpus.summary.locallyStoredTexts,
      claudeSavedCards: claude.summary.readyCards,
      classroomReadyCards: readyCards.length,
      localTextsWithReadyCards: localTexts.filter((text) => text.readyCards > 0).length,
      localTextsWithoutReadyCards: localNoCards.length,
      thinLocalTexts: thinTexts.length,
      standardsRepresented: byStandard.filter((standard) => standard.readyCards > 0).length,
      standardsWithoutReadyCards: byStandard.filter((standard) => standard.readyCards === 0).length,
    },
    localTextsWithoutReadyCards: localNoCards,
    thinLocalTexts: thinTexts.sort((a, b) => a.readyCards - b.readyCards || a.title.localeCompare(b.title)),
    strongestTexts: strongTexts,
    standardsByNeed: byStandard,
  };

  const lines = [
    '# GOGI Official Coverage Gap Audit',
    '',
    `Generated: ${report.generatedAt}`,
    '',
    '## Summary',
    '',
    `- Official texts: ${report.summary.officialTexts}`,
    `- Local sources: ${report.summary.localSources}`,
    `- Claude-saved cards: ${report.summary.claudeSavedCards}`,
    `- Classroom-ready cards: ${report.summary.classroomReadyCards}`,
    `- Local texts with ready cards: ${report.summary.localTextsWithReadyCards}`,
    `- Local texts without ready cards: ${report.summary.localTextsWithoutReadyCards}`,
    `- Thin local texts (<10 ready cards): ${report.summary.thinLocalTexts}`,
    `- Standards represented: ${report.summary.standardsRepresented}`,
    `- Standards without ready cards: ${report.summary.standardsWithoutReadyCards}`,
    '',
    '## Local Texts Without Ready Cards',
    '',
    '| Text | Status | Mapped Standards | Missing Standards |',
    '| --- | --- | ---: | --- |',
    ...localNoCards.map((text) => `| ${text.title} | ${text.status} | ${text.mappedStandards} | ${text.missingStandards.join(', ') || 'none'} |`),
    '',
    '## Thin Local Texts',
    '',
    '| Text | Ready Cards | Standards Covered | Missing Standards |',
    '| --- | ---: | ---: | --- |',
    ...report.thinLocalTexts.map((text) => `| ${text.title} | ${text.readyCards} | ${text.standardsCovered}/${text.mappedStandards} | ${text.missingStandards.join(', ') || 'none'} |`),
    '',
    '## Standards By Need',
    '',
    '| Standard | Ready Cards | Texts Covered | Local Mapped Texts |',
    '| --- | ---: | ---: | ---: |',
    ...byStandard.map((standard) => `| ${standard.standardCode} | ${standard.readyCards} | ${standard.textsCovered} | ${standard.localMappedTexts} |`),
  ];

  await fs.mkdir(path.dirname(OUT_JSON), { recursive: true });
  await fs.writeFile(OUT_JSON, JSON.stringify(report, null, 2));
  await fs.writeFile(OUT_MD, `${lines.join('\n')}\n`);

  console.log('\n═══════════════════════════════════════════════════════');
  console.log('  GOGI Official Coverage Gap Audit Complete');
  console.log(`  Classroom-ready cards:       ${report.summary.classroomReadyCards}`);
  console.log(`  Local texts with cards:      ${report.summary.localTextsWithReadyCards}/${report.summary.localSources}`);
  console.log(`  Local texts without cards:   ${report.summary.localTextsWithoutReadyCards}`);
  console.log(`  Thin local texts:            ${report.summary.thinLocalTexts}`);
  console.log(`  Standards represented:       ${report.summary.standardsRepresented}`);
  console.log(`  Standards without cards:     ${report.summary.standardsWithoutReadyCards}`);
  console.log(`  JSON:                        ${path.relative(ROOT, OUT_JSON)}`);
  console.log(`  Summary:                     ${path.relative(ROOT, OUT_MD)}`);
  console.log('═══════════════════════════════════════════════════════\n');
}

main().catch((error) => {
  console.error('[audit-official-coverage-gaps] failed:', error);
  process.exit(1);
});
