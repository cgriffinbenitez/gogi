#!/usr/bin/env tsx
import fs from 'fs/promises';
import path from 'path';

type Choice = { label: string; text: string; correct: boolean };
type VisibleCard = {
  layer: 'gold' | 'claude-ready';
  textTitle: string;
  textAuthor: string | null;
  standardCode: string;
  standardTitle: string;
  subSkillLabel: string;
  location: string;
  excerpt: string;
  question: string;
  choices: Choice[];
  evidencePoints: string[];
};

type Finding = {
  severity: 'blocker' | 'major' | 'watch';
  type: string;
  note: string;
  card: VisibleCard;
};

const ROOT = process.cwd();
const CORPUS_PATH = path.join(ROOT, 'data', 'official-text-library', 'teachable-corpus.json');
const CLAUDE_PATH = path.join(ROOT, 'data', 'official-text-library', 'claude-ready-gold-cards.json');
const QUALITY_AUDIT_PATH = path.join(ROOT, 'data', 'official-text-library', 'audits', 'latest-card-quality-audit.json');
const OUT_JSON = path.join(ROOT, 'data', 'official-text-library', 'audits', 'latest-question-answer-stem-audit.json');
const OUT_MD = path.join(ROOT, 'data', 'official-text-library', 'audits', 'latest-question-answer-stem-audit.md');

const STOPWORDS = new Set([
  'about',
  'after',
  'again',
  'against',
  'answer',
  'because',
  'before',
  'being',
  'between',
  'choice',
  'could',
  'does',
  'each',
  'excerpt',
  'from',
  'have',
  'help',
  'helps',
  'into',
  'more',
  'most',
  'only',
  'paragraph',
  'passage',
  'question',
  'read',
  'reveal',
  'reveals',
  'shows',
  'statement',
  'suggest',
  'suggests',
  'than',
  'that',
  'their',
  'there',
  'these',
  'this',
  'through',
  'what',
  'when',
  'where',
  'which',
  'while',
  'with',
  'would',
]);

function normalize(value: string) {
  return value.toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
}

function tokens(value: string) {
  return normalize(value)
    .split(/\s+/)
    .filter((token) => token.length >= 4 && !STOPWORDS.has(token));
}

function tokenSet(value: string) {
  return new Set(tokens(value));
}

function overlapCount(a: string, b: string) {
  const left = tokenSet(a);
  return tokens(b).filter((token) => left.has(token)).length;
}

function compact(value: string, max = 170) {
  const clean = value.replace(/\s+/g, ' ').trim();
  return clean.length <= max ? clean : `${clean.slice(0, max).trim()}...`;
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

function quotedText(value: string) {
  return [...value.matchAll(/"([^"]{6,})"|“([^”]{6,})”/g)].map((match) => match[1] ?? match[2]);
}

function standardStemWords(card: VisibleCard) {
  if (card.standardCode === 'ELA.9.R.1.1') return ['setting', 'plot', 'conflict', 'character', 'viewpoint', 'tone', 'style', 'meaning'];
  if (card.standardCode === 'ELA.9.R.1.2') return ['theme', 'message', 'develop', 'conflict', 'choice', 'consequence'];
  if (card.standardCode === 'ELA.9.R.1.3') return ['perspective', 'irony', 'satire', 'narrator', 'viewpoint', 'contrast', 'reader', 'understand', 'acknowledge'];
  if (card.standardCode === 'ELA.9.R.1.4') return ['epic', 'hero', 'journey', 'fate', 'divine', 'middle', 'structure'];
  if (card.standardCode === 'ELA.9.R.2.1') return ['structure', 'organize', 'cause', 'effect', 'compare', 'contrast', 'chronological', 'purpose'];
  if (card.standardCode === 'ELA.9.R.2.2') return ['central', 'idea', 'evidence', 'support', 'develop', 'claim'];
  if (card.standardCode === 'ELA.9.R.2.3') return ['appeal', 'ethos', 'pathos', 'logos', 'rhetorical', 'purpose', 'persuade'];
  if (card.standardCode === 'ELA.9.R.2.4') return ['argument', 'claim', 'opposing', 'evidence', 'valid', 'counterclaim'];
  if (card.standardCode === 'ELA.9.R.3.1') return ['figurative', 'image', 'metaphor', 'simile', 'language', 'mood', 'tone', 'comparison', 'understatement'];
  if (card.standardCode === 'ELA.9.R.3.2') return ['paraphrase', 'restate', 'meaning'];
  if (card.standardCode === 'ELA.9.R.3.3') return ['adapt', 'source', 'retelling', 'version'];
  if (card.standardCode === 'ELA.9.R.3.4') return ['rhetoric', 'device', 'appeal', 'reader', 'effect', 'purpose'];
  if (card.standardCode.startsWith('ELA.9.V.')) return ['word', 'phrase', 'context', 'meaning', 'connotation', 'root', 'suffix', 'prefix'];
  return [];
}

function hasNamedTextAnchor(card: VisibleCard) {
  const question = card.question;
  if (quotedText(question).some((quote) => normalize(card.excerpt).includes(normalize(quote).slice(0, 30)))) return true;
  if (overlapCount(question, card.excerpt) >= 3) return true;
  if (card.evidencePoints.some((point) => overlapCount(question, point) >= 2)) return true;
  return false;
}

function answerSetUsesTheExcerpt(card: VisibleCard) {
  return card.choices.some((choice) => overlapCount(choice.text, card.excerpt) >= 2 || quotedText(choice.text).length > 0);
}

function hasSkillLanguage(card: VisibleCard, value: string) {
  const normalized = normalize(value);
  return standardStemWords(card).some((word) => normalized.includes(word));
}

function isLazyGenericQuestion(card: VisibleCard) {
  const q = normalize(card.question);
  if (hasNamedTextAnchor(card) || answerSetUsesTheExcerpt(card)) return false;
  return (
    /^how does (the|this) (event|conflict|setting|description|structure|appeal|claim|evidence|excerpt|passage|word choice|authors word choice)/.test(q) ||
    /^what does (the|this) (character evidence|detail|phrase|excerpt|passage)/.test(q) ||
    /^which statement best (explains|describes|paraphrases|identifies)/.test(q)
  );
}

function isMetaChoice(text: string) {
  return (
    /\b(correct answer|best answer|without using|only summarizes|gives a true detail|can be chosen|item-frame)\b/i.test(text) ||
    /\b(The passage points to a different effect|This does not explain the author’s move|This does not explain the author's move|The development of the passage points elsewhere|This misses the evidence in the excerpt)\b/i.test(text) ||
    /\b(broader idea about power, fear, courage, duty, or choice|only a setting detail|resolves every conflict|contradicts the evidence|larger idea that applies beyond this one story|only summarizes what one character does|states the lesson directly)\b/i.test(text)
  );
}

function allChoicesSoundGeneric(card: VisibleCard) {
  return card.choices.every((choice) => {
    const overlap = overlapCount(choice.text, card.excerpt);
    const specific = /[A-Z][a-z]{3,}/.test(choice.text) || quotedText(choice.text).length > 0;
    return overlap === 0 && !specific && !hasSkillLanguage(card, choice.text);
  });
}

function auditCard(card: VisibleCard): Finding[] {
  const findings: Finding[] = [];
  const question = card.question.trim();
  const correct = card.choices.filter((choice) => choice.correct);
  const wrong = card.choices.filter((choice) => !choice.correct);
  const correctText = correct[0]?.text ?? '';
  const choiceTexts = card.choices.map((choice) => choice.text);
  const choiceWordCounts = choiceTexts.map((choice) => choice.trim().split(/\s+/).length);
  const wrongAverageLength = wrong.length ? wrong.reduce((sum, choice) => sum + choice.text.length, 0) / wrong.length : 0;
  const correctOverlap = overlapCount(correctText, card.excerpt);
  const wrongOverlapAverage = wrong.length ? wrong.reduce((sum, choice) => sum + overlapCount(choice.text, card.excerpt), 0) / wrong.length : 0;

  if (!question.endsWith('?')) {
    findings.push({ severity: 'blocker', type: 'stem-format', note: 'Question stem does not end as a question.', card });
  }

  for (const quote of quotedText(question)) {
    if (normalize(quote).length >= 10 && !normalize(card.excerpt).includes(normalize(quote).slice(0, 30))) {
      findings.push({ severity: 'blocker', type: 'missing-quoted-anchor', note: `Question quotes text that does not appear in the excerpt: "${compact(quote, 80)}"`, card });
    }
  }

  if (isLazyGenericQuestion(card)) {
    findings.push({ severity: 'major', type: 'generic-stem', note: 'Question stem is too reusable; it should name a specific passage detail or exact text feature.', card });
  }

  if (!hasNamedTextAnchor(card) && !answerSetUsesTheExcerpt(card)) {
    findings.push({ severity: isLazyGenericQuestion(card) ? 'major' : 'watch', type: 'weak-text-anchor', note: 'Question does not force students back to a specific part of the excerpt.', card });
  }

  if (!hasSkillLanguage(card, `${question} ${choiceTexts.join(' ')}`)) {
    findings.push({ severity: 'major', type: 'standard-mismatch', note: 'Question and answer set do not clearly use the standard skill demand.', card });
  }

  if (card.choices.length !== 4 || correct.length !== 1) {
    findings.push({ severity: 'blocker', type: 'choice-format', note: 'Item must have exactly four answer choices and exactly one correct answer.', card });
  }

  if (new Set(choiceTexts.map(normalize)).size !== choiceTexts.length) {
    findings.push({ severity: 'blocker', type: 'duplicate-answer', note: 'Answer choices are duplicate or nearly duplicate.', card });
  }

  if (choiceTexts.some(isMetaChoice)) {
    findings.push({ severity: 'major', type: 'meta-answer-language', note: 'One or more answer choices use test-mechanics language instead of passage-specific analysis.', card });
  }

  if (allChoicesSoundGeneric(card)) {
    findings.push({
      severity: card.standardCode === 'ELA.9.R.1.2' ? 'major' : 'watch',
      type: 'generic-answer-set',
      note: 'Answer choices may be too generic to feel tied to this excerpt.',
      card,
    });
  }

  if (correctText.length > Math.max(...wrong.map((choice) => choice.text.length), 0) + 60 && correctText.length > wrongAverageLength * 1.35) {
    findings.push({ severity: 'major', type: 'correct-answer-giveaway', note: 'Correct answer is noticeably longer than the distractors.', card });
  } else if (correctText.length > wrongAverageLength + 65 && correctText.length > wrongAverageLength * 1.35) {
    findings.push({ severity: 'watch', type: 'correct-answer-giveaway', note: 'Correct answer is longer than the average distractor; check for visual giveaways.', card });
  }

  if (Math.max(...choiceWordCounts) - Math.min(...choiceWordCounts) > 28) {
    findings.push({ severity: 'watch', type: 'uneven-choice-length', note: 'Answer choices have a large length spread; check for visual giveaways.', card });
  }

  if (correctOverlap === 0 && wrongOverlapAverage > 0.5) {
    findings.push({ severity: 'watch', type: 'correct-answer-low-grounding', note: 'Correct answer has less explicit excerpt grounding than the distractors.', card });
  }

  if (correctText.split(/\s+/).length < 8) {
    findings.push({ severity: 'watch', type: 'thin-correct-answer', note: 'Correct answer may be too short to explain the intended skill.', card });
  }

  return findings;
}

async function loadVisibleCards() {
  const corpus = JSON.parse(await fs.readFile(CORPUS_PATH, 'utf8'));
  const claude = JSON.parse(await fs.readFile(CLAUDE_PATH, 'utf8'));
  const qualityAudit = JSON.parse(await fs.readFile(QUALITY_AUDIT_PATH, 'utf8'));
  const majorRisk = new Set(
    qualityAudit.issues
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
        standardTitle: card.standardTitle,
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
        standardTitle: card.standardTitle,
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
  return visible;
}

async function main() {
  const visible = await loadVisibleCards();
  const findings = visible.flatMap(auditCard);
  const exactQuestions = new Map<string, VisibleCard[]>();
  for (const card of visible) {
    const key = normalize(card.question);
    exactQuestions.set(key, [...(exactQuestions.get(key) ?? []), card]);
  }
  for (const cards of exactQuestions.values()) {
    if (cards.length < 3) continue;
    for (const card of cards) {
      findings.push({
        severity: 'major',
        type: 'repeated-question',
        note: `Exact question stem repeats across ${cards.length} visible cards.`,
        card,
      });
    }
  }

  const byType = new Map<string, number>();
  const byStandard = new Map<string, number>();
  const byText = new Map<string, number>();
  for (const finding of findings) {
    byType.set(finding.type, (byType.get(finding.type) ?? 0) + 1);
    byStandard.set(finding.card.standardCode, (byStandard.get(finding.card.standardCode) ?? 0) + 1);
    const textKey = `${finding.card.textTitle}${finding.card.textAuthor ? ` — ${finding.card.textAuthor}` : ''}`;
    byText.set(textKey, (byText.get(textKey) ?? 0) + 1);
  }

  const report = {
    generatedAt: new Date().toISOString(),
    summary: {
      visibleCardsAudited: visible.length,
      findings: findings.length,
      blockers: findings.filter((finding) => finding.severity === 'blocker').length,
      major: findings.filter((finding) => finding.severity === 'major').length,
      watch: findings.filter((finding) => finding.severity === 'watch').length,
      cardsWithBlockerOrMajor: new Set(
        findings
          .filter((finding) => finding.severity === 'blocker' || finding.severity === 'major')
          .map((finding) => cardKey(finding.card))
      ).size,
    },
    byType: [...byType.entries()].map(([type, count]) => ({ type, count })).sort((a, b) => b.count - a.count),
    byStandard: [...byStandard.entries()].map(([standardCode, count]) => ({ standardCode, count })).sort((a, b) => b.count - a.count),
    byText: [...byText.entries()].map(([text, count]) => ({ text, count })).sort((a, b) => b.count - a.count),
    findings: findings.map((finding) => ({
      severity: finding.severity,
      type: finding.type,
      note: finding.note,
      layer: finding.card.layer,
      textTitle: finding.card.textTitle,
      textAuthor: finding.card.textAuthor,
      standardCode: finding.card.standardCode,
      standardTitle: finding.card.standardTitle,
      subSkillLabel: finding.card.subSkillLabel,
      location: finding.card.location,
      question: finding.card.question,
      choices: finding.card.choices,
      excerptPreview: compact(finding.card.excerpt, 260),
    })),
  };

  const lines = [
    '# GOGI Question and Answer Stem Audit',
    '',
    `Generated: ${report.generatedAt}`,
    '',
    '## Summary',
    '',
    `- Visible cards audited: ${report.summary.visibleCardsAudited}`,
    `- Cards with blocker/major question risk: ${report.summary.cardsWithBlockerOrMajor}`,
    `- Blockers: ${report.summary.blockers}`,
    `- Major findings: ${report.summary.major}`,
    `- Watch items: ${report.summary.watch}`,
    '',
    '## Finding Types',
    '',
    '| Type | Count |',
    '| --- | ---: |',
    ...report.byType.map((row) => `| ${row.type} | ${row.count} |`),
    '',
    '## Findings',
    '',
    '| Severity | Type | Text | Standard | Location | Question |',
    '| --- | --- | --- | --- | --- | --- |',
    ...report.findings
      .slice(0, 1500)
      .map(
        (finding) =>
          `| ${finding.severity} | ${finding.type} | ${finding.textTitle}${finding.textAuthor ? ` — ${finding.textAuthor}` : ''} | ${finding.standardCode} | ${finding.location} | ${finding.question.replace(/\|/g, '\\|')} |`
      ),
  ];
  if (report.findings.length > 1500) lines.push(`\n${report.findings.length - 1500} more findings in JSON.`);

  await fs.mkdir(path.dirname(OUT_JSON), { recursive: true });
  await fs.writeFile(OUT_JSON, JSON.stringify(report, null, 2));
  await fs.writeFile(OUT_MD, `${lines.join('\n')}\n`);

  console.log('\n═══════════════════════════════════════════════════════');
  console.log('  GOGI Question/Answer Stem Audit Complete');
  console.log(`  Visible cards audited:            ${report.summary.visibleCardsAudited}`);
  console.log(`  Cards with blocker/major risk:    ${report.summary.cardsWithBlockerOrMajor}`);
  console.log(`  Blockers:                         ${report.summary.blockers}`);
  console.log(`  Major findings:                   ${report.summary.major}`);
  console.log(`  Watch items:                      ${report.summary.watch}`);
  console.log(`  JSON:                             ${path.relative(ROOT, OUT_JSON)}`);
  console.log(`  Summary:                          ${path.relative(ROOT, OUT_MD)}`);
  console.log('═══════════════════════════════════════════════════════\n');
}

main().catch((error) => {
  console.error('[audit-official-question-answer-stems] failed:', error);
  process.exit(1);
});
