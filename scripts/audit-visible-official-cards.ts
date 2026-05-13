#!/usr/bin/env tsx
import fs from 'fs/promises';
import path from 'path';

type Choice = { label: string; text: string; correct: boolean };
type VisibleCard = {
  layer: 'gold' | 'claude-ready';
  textTitle: string;
  textAuthor: string | null;
  standardCode: string;
  subSkillLabel: string;
  location: string;
  excerpt: string;
  question: string;
  choices: Choice[];
  evidencePoints: string[];
};

const ROOT = process.cwd();
const CORPUS_PATH = path.join(ROOT, 'data', 'official-text-library', 'teachable-corpus.json');
const CLAUDE_PATH = path.join(ROOT, 'data', 'official-text-library', 'claude-ready-gold-cards.json');
const AUDIT_PATH = path.join(ROOT, 'data', 'official-text-library', 'audits', 'latest-card-quality-audit.json');
const OUT_JSON = path.join(ROOT, 'data', 'official-text-library', 'audits', 'latest-visible-card-audit.json');
const OUT_MD = path.join(ROOT, 'data', 'official-text-library', 'audits', 'latest-visible-card-audit.md');

function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function words(value: string) {
  return normalize(value).split(/\s+/).filter(Boolean);
}

function overlapCount(a: string, b: string) {
  const left = new Set(words(a).filter((token) => token.length >= 5));
  return words(b).filter((token) => token.length >= 5 && left.has(token)).length;
}

function quotedText(value: string) {
  return [...value.matchAll(/"([^"]{6,})"|“([^”]{6,})”/g)].map((match) => match[1] ?? match[2]);
}

function cardKey(card: {
  layer: string;
  textTitle: string;
  textAuthor: string | null;
  standardCode: string;
  subSkillLabel: string;
  location: string;
}) {
  return [card.layer, card.textTitle, card.textAuthor ?? '', card.standardCode, card.subSkillLabel, card.location].join('::');
}

async function main() {
  const corpus = JSON.parse(await fs.readFile(CORPUS_PATH, 'utf8'));
  const claude = JSON.parse(await fs.readFile(CLAUDE_PATH, 'utf8'));
  const audit = JSON.parse(await fs.readFile(AUDIT_PATH, 'utf8'));
  const majorRisk = new Set(
    audit.issues
      .filter((issue: any) => issue.severity === 'major' || issue.severity === 'blocker')
      .map((issue: any) => cardKey(issue))
  );

  const visible: VisibleCard[] = [];
  for (const text of corpus.texts) {
    for (const card of text.cards) {
      const visibleCard: VisibleCard = {
        layer: 'gold',
        textTitle: text.title,
        textAuthor: text.author,
        standardCode: card.standardCode,
        subSkillLabel: card.skillLabel,
        location: card.location,
        excerpt: card.excerpt,
        question: card.question,
        choices: card.choices,
        evidencePoints: card.evidencePoints,
      };
      if (!majorRisk.has(cardKey(visibleCard))) visible.push(visibleCard);
    }
  }
  for (const text of claude.texts) {
    for (const card of text.cards) {
      const visibleCard: VisibleCard = {
        layer: 'claude-ready',
        textTitle: text.title,
        textAuthor: text.author,
        standardCode: card.standardCode,
        subSkillLabel: card.subSkillLabel,
        location: card.location,
        excerpt: card.excerpt,
        question: card.question,
        choices: card.choices,
        evidencePoints: card.evidencePoints,
      };
      if (!majorRisk.has(cardKey(visibleCard))) visible.push(visibleCard);
    }
  }

  const findings: Array<{ severity: 'blocker' | 'major' | 'watch'; type: string; card: VisibleCard; note: string }> = [];
  for (const card of visible) {
    const correct = card.choices.filter((choice) => choice.correct);
    const wrong = card.choices.filter((choice) => !choice.correct);
    const question = card.question ?? '';
    const quotedAnchor = quotedText(question).length > 0;
    const specificAnchor = /\b(paragraph|line|claim|evidence|setting|speaker|narrator|character|author|word|phrase|structure|argument|appeal|image|detail|example|description|speech)\b/i.test(question);
    const overlap = overlapCount(card.excerpt, question);
    const answerChoiceAnchor = card.choices.some((choice) => overlapCount(choice.text, card.excerpt) >= 2 || quotedText(choice.text).length > 0);
    const correctText = correct[0]?.text ?? '';
    const longestWrong = Math.max(0, ...wrong.map((choice) => choice.text.length));

    if (!question.endsWith('?')) {
      findings.push({ severity: 'blocker', type: 'question-format', card, note: 'Question does not end with a question mark.' });
    }
    if (card.choices.length !== 4 || correct.length !== 1) {
      findings.push({ severity: 'blocker', type: 'choice-format', card, note: 'Card does not have exactly four choices and one correct answer.' });
    }
    if (!quotedAnchor && overlap < 2 && !specificAnchor && !answerChoiceAnchor) {
      findings.push({ severity: 'watch', type: 'question-anchor', card, note: 'Question may not point students clearly enough back into the excerpt.' });
    }
    if (correctText.length > longestWrong + 70) {
      findings.push({ severity: 'major', type: 'answer-length', card, note: 'Correct answer is much longer than the distractors.' });
    }
    if (new Set(card.choices.map((choice) => normalize(choice.text))).size !== card.choices.length) {
      findings.push({ severity: 'blocker', type: 'duplicate-choices', card, note: 'Choices are duplicate or nearly duplicate.' });
    }
    if (/\b(It uses|It organizes|It lists|It treats|It gives a true detail|It makes a claim|It focuses on|correct answer|best answer|only summarizes)\b/i.test(card.choices.map((choice) => choice.text).join(' '))) {
      findings.push({ severity: 'major', type: 'meta-choice-language', card, note: 'Choices use item-frame language instead of passage-specific analysis.' });
    }
    if ((card.evidencePoints ?? []).length < 2) {
      findings.push({ severity: 'watch', type: 'thin-evidence', card, note: 'Evidence points are thin; teacher may want one more anchor quote.' });
    }
  }

  const byType = new Map<string, number>();
  const byLayer = new Map<string, number>();
  for (const finding of findings) {
    byType.set(finding.type, (byType.get(finding.type) ?? 0) + 1);
    byLayer.set(finding.card.layer, (byLayer.get(finding.card.layer) ?? 0) + 1);
  }

  const report = {
    generatedAt: new Date().toISOString(),
    summary: {
      visibleCards: visible.length,
      findings: findings.length,
      blockers: findings.filter((finding) => finding.severity === 'blocker').length,
      major: findings.filter((finding) => finding.severity === 'major').length,
      watch: findings.filter((finding) => finding.severity === 'watch').length,
      claudeVisibleCards: visible.filter((card) => card.layer === 'claude-ready').length,
      goldVisibleCards: visible.filter((card) => card.layer === 'gold').length,
    },
    byType: [...byType.entries()].map(([type, count]) => ({ type, count })).sort((a, b) => b.count - a.count),
    byLayer: [...byLayer.entries()].map(([layer, count]) => ({ layer, count })).sort((a, b) => b.count - a.count),
    findings: findings.map((finding) => ({
      severity: finding.severity,
      type: finding.type,
      note: finding.note,
      layer: finding.card.layer,
      textTitle: finding.card.textTitle,
      textAuthor: finding.card.textAuthor,
      standardCode: finding.card.standardCode,
      subSkillLabel: finding.card.subSkillLabel,
      location: finding.card.location,
      question: finding.card.question,
    })),
  };

  const lines = [
    '# GOGI Visible Card Audit',
    '',
    `Generated: ${report.generatedAt}`,
    '',
    '## Summary',
    '',
    `- Visible finished cards: ${report.summary.visibleCards}`,
    `- Claude-ready visible cards: ${report.summary.claudeVisibleCards}`,
    `- Reviewed-gold visible cards: ${report.summary.goldVisibleCards}`,
    `- Blockers: ${report.summary.blockers}`,
    `- Major findings: ${report.summary.major}`,
    `- Watch items: ${report.summary.watch}`,
    '',
    '## Findings',
    '',
    '| Severity | Type | Text | Standard | Location | Question |',
    '| --- | --- | --- | --- | --- | --- |',
    ...report.findings.map((finding) =>
      `| ${finding.severity} | ${finding.type} | ${finding.textTitle}${finding.textAuthor ? ` — ${finding.textAuthor}` : ''} | ${finding.standardCode} | ${finding.location} | ${finding.question.replace(/\|/g, '\\|')} |`
    ),
  ];

  await fs.mkdir(path.dirname(OUT_JSON), { recursive: true });
  await fs.writeFile(OUT_JSON, JSON.stringify(report, null, 2));
  await fs.writeFile(OUT_MD, `${lines.join('\n')}\n`);

  console.log('\n═══════════════════════════════════════════════════════');
  console.log('  GOGI Visible Card Audit Complete');
  console.log(`  Visible finished cards:  ${report.summary.visibleCards}`);
  console.log(`  Claude-ready visible:    ${report.summary.claudeVisibleCards}`);
  console.log(`  Reviewed-gold visible:   ${report.summary.goldVisibleCards}`);
  console.log(`  Blockers:                ${report.summary.blockers}`);
  console.log(`  Major findings:          ${report.summary.major}`);
  console.log(`  Watch items:             ${report.summary.watch}`);
  console.log(`  JSON:                    ${path.relative(ROOT, OUT_JSON)}`);
  console.log(`  Summary:                 ${path.relative(ROOT, OUT_MD)}`);
  console.log('═══════════════════════════════════════════════════════\n');
}

main().catch((error) => {
  console.error('[audit-visible-official-cards] failed:', error);
  process.exit(1);
});
