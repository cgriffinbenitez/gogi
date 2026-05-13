import fs from 'fs/promises';
import path from 'path';
import type { OfficialAutoGoldCardCorpus } from '@/lib/teacher/officialAutoGoldCards';
import type { OfficialTeachableCorpus } from '@/lib/teacher/officialTeachableCorpus';
import {
  hasScholarlyOrNonStudentFacingSignals,
  isGenreCompatibleForStandard,
} from '@/lib/teacher/officialCorpusGuards';

type AuditLayer = 'gold' | 'auto-ready' | 'claude-ready';
type Severity = 'blocker' | 'major' | 'minor';

type Choice = {
  label: string;
  text: string;
  correct: boolean;
};

type AuditableCard = {
  layer: AuditLayer;
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

export type OfficialCardQualityIssue = {
  severity: Severity;
  layer: AuditLayer;
  textTitle: string;
  textAuthor: string | null;
  standardCode: string;
  standardTitle: string;
  subSkillLabel: string;
  location: string;
  question: string;
  issue: string;
  excerptPreview: string;
};

export type OfficialCardQualityAudit = {
  generatedAt: string;
  summary: {
    cardsAudited: number;
    goldCardsAudited: number;
    autoReadyCardsAudited: number;
    claudeReadyCardsAudited: number;
    classroomReadyCards: number;
    cardsWithMajorRisk: number;
    cardsWithIssues: number;
    blockers: number;
    major: number;
    minor: number;
    textsAudited: number;
    standardsAudited: number;
  };
  byStandard: Array<{
    standardCode: string;
    standardTitle: string;
    cards: number;
    ready: number;
    blockers: number;
    major: number;
    minor: number;
  }>;
  byText: Array<{
    title: string;
    cards: number;
    ready: number;
    blockers: number;
    major: number;
    minor: number;
  }>;
  issues: OfficialCardQualityIssue[];
};

const ROOT = process.cwd();
const GOLD_PATH = path.join(ROOT, 'data', 'official-text-library', 'teachable-corpus.json');
const AUTO_PATH = path.join(ROOT, 'data', 'official-text-library', 'auto-ready-gold-cards.json');
const CLAUDE_READY_PATH = path.join(ROOT, 'data', 'official-text-library', 'claude-ready-gold-cards.json');

type OfficialClaudeReadyCardCorpus = {
  summary: {
    readyCards: number;
    textsWithCards: number;
    standardsRepresented: number;
  };
  texts: Array<{
    title: string;
    author: string | null;
    cards: Array<{
      standardCode: string;
      standardTitle: string;
      subSkillLabel: string;
      location: string;
      excerpt: string;
      question: string;
      choices: Choice[];
      evidencePoints: string[];
    }>;
  }>;
};

function compact(value: string, max = 260) {
  const cleaned = value.replace(/\s+/g, ' ').trim();
  if (cleaned.length <= max) return cleaned;
  return `${cleaned.slice(0, max).trim()}...`;
}

function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function wordCount(value: string) {
  return normalize(value).split(/\s+/).filter(Boolean).length;
}

function tokenSet(value: string) {
  return new Set(normalize(value).split(/\s+/).filter((token) => token.length >= 4));
}

function overlapCount(a: string, b: string) {
  const left = tokenSet(a);
  return [...tokenSet(b)].filter((token) => left.has(token)).length;
}

function quotedText(value: string) {
  return [...value.matchAll(/"([^"]{6,})"|“([^”]{6,})”/g)].map((match) => match[1] ?? match[2]);
}

function cardKey(card: AuditableCard) {
  return [
    card.layer,
    card.textTitle,
    card.textAuthor ?? '',
    card.standardCode,
    card.subSkillLabel,
    card.location,
    compact(card.excerpt, 80),
  ].join('::');
}

function addIssue(args: {
  issues: OfficialCardQualityIssue[];
  card: AuditableCard;
  severity: Severity;
  issue: string;
}) {
  args.issues.push({
    severity: args.severity,
    layer: args.card.layer,
    textTitle: args.card.textTitle,
    textAuthor: args.card.textAuthor,
    standardCode: args.card.standardCode,
    standardTitle: args.card.standardTitle,
    subSkillLabel: args.card.subSkillLabel,
    location: args.card.location,
    question: args.card.question,
    issue: args.issue,
    excerptPreview: compact(args.card.excerpt),
  });
}

function minWordsFor(card: AuditableCard) {
  if (card.standardCode === 'ELA.9.R.2.1' || card.standardCode === 'ELA.9.R.2.2' || card.standardCode === 'ELA.9.R.2.3') return 110;
  if (card.standardCode === 'ELA.9.R.2.4') return 90;
  if (card.standardCode === 'ELA.9.R.3.2') return 60;
  if (card.standardCode.startsWith('ELA.9.V.')) return 55;
  return 75;
}

function standardKeywords(card: AuditableCard) {
  const label = `${card.standardTitle} ${card.subSkillLabel}`.toLowerCase();
  if (card.standardCode === 'ELA.9.R.1.1') return ['setting', 'plot', 'conflict', 'character', 'viewpoint', 'tone', 'style', 'meaning'];
  if (card.standardCode === 'ELA.9.R.1.2') return ['theme', 'universal', 'message', 'develop', 'conflict', 'choice'];
  if (card.standardCode === 'ELA.9.R.1.3') return ['perspective', 'irony', 'satire', 'narrator', 'reader', 'contrast', 'understand', 'acknowledge'];
  if (card.standardCode === 'ELA.9.R.1.4') return ['epic', 'hero', 'journey', 'fate', 'divine', 'structure', 'theme'];
  if (card.standardCode === 'ELA.9.R.2.1') return ['structure', 'cause', 'effect', 'compare', 'contrast', 'purpose', 'organize'];
  if (card.standardCode === 'ELA.9.R.2.2') return ['central', 'idea', 'evidence', 'support', 'develop', 'claim'];
  if (card.standardCode === 'ELA.9.R.2.3') return ['purpose', 'appeal', 'ethos', 'pathos', 'logos', 'figurative', 'rhetorical'];
  if (card.standardCode === 'ELA.9.R.2.4') return ['claim', 'argument', 'evidence', 'valid', 'opposing', 'effective'];
  if (card.standardCode === 'ELA.9.R.3.1') return ['figurative', 'mood', 'language', 'feeling', 'tone', 'comparison', 'understatement'];
  if (card.standardCode === 'ELA.9.R.3.2') return ['paraphrase', 'restate', 'meaning', 'main', 'idea'];
  if (card.standardCode === 'ELA.9.R.3.3') return ['adapt', 'source', 'retelling', 'similar', 'different'];
  if (card.standardCode === 'ELA.9.R.3.4') return ['rhetoric', 'reader', 'appeal', 'device', 'effect', 'purpose'];
  if (card.standardCode.startsWith('ELA.9.V.')) return ['context', 'meaning', 'word', 'phrase', 'connotation', 'root', 'suffix', 'prefix'];
  return normalize(label).split(/\s+/).filter((token) => token.length >= 5);
}

function hasStandardLanguage(card: AuditableCard) {
  const combined = normalize(`${card.question} ${card.choices.map((choice) => choice.text).join(' ')}`);
  return standardKeywords(card).some((keyword) => combined.includes(keyword));
}

function questionUsesExcerpt(card: AuditableCard) {
  const evidenceOverlap = card.evidencePoints.some((point) => overlapCount(card.question, point) >= 2);
  const excerptOverlap = overlapCount(card.question, card.excerpt);
  const quotedAnchor = quotedText(card.question).length > 0;
  const answerChoiceAnchor = card.choices.some((choice) => overlapCount(choice.text, card.excerpt) >= 2 || quotedText(choice.text).length > 0);
  const namedSpecificAnchor = /\b(paragraph|line|claim|evidence|setting|speaker|narrator|character|author|word|phrase|structure|argument|appeal|image|detail|example|description|speech)\b/i.test(card.question);
  return evidenceOverlap || excerptOverlap >= 2 || quotedAnchor || answerChoiceAnchor || (namedSpecificAnchor && excerptOverlap >= 1);
}

function choicesArePlausible(card: AuditableCard) {
  const incorrect = card.choices.filter((choice) => !choice.correct);
  return incorrect.every((choice) => {
    const skillGrounded = standardKeywords(card).some((keyword) => normalize(choice.text).includes(keyword));
    return choice.text.split(/\s+/).length >= 7 && (overlapCount(choice.text, card.excerpt) >= 1 || skillGrounded);
  });
}

function choicesAreTooGeneric(card: AuditableCard) {
  return card.choices.every((choice) => {
    const specific = /[A-Z][a-z]{3,}/.test(choice.text) || quotedText(choice.text).length > 0;
    return overlapCount(choice.text, card.excerpt) === 0 && !specific && !standardKeywords(card).some((keyword) => normalize(choice.text).includes(keyword));
  });
}

function auditCard(card: AuditableCard) {
  const issues: OfficialCardQualityIssue[] = [];
  const words = wordCount(card.excerpt);
  const isPairedArgumentMiniCard = card.standardCode === 'ELA.9.R.2.4' && /Passage A:/i.test(card.excerpt) && /Passage B:/i.test(card.excerpt);
  const correct = card.choices.filter((choice) => choice.correct);
  const incorrect = card.choices.filter((choice) => !choice.correct);
  const correctText = correct[0]?.text ?? '';
  const longestWrong = Math.max(...incorrect.map((choice) => choice.text.length), 0);
  const shortestWrong = Math.min(...incorrect.map((choice) => choice.text.length), Number.POSITIVE_INFINITY);

  if (!isGenreCompatibleForStandard(card.textTitle, card.standardCode)) {
    addIssue({
      issues,
      card,
      severity: 'blocker',
      issue: 'Text genre does not match the standard lane. Literary texts cannot serve informational standards, and informational texts cannot serve literary standards unless explicitly allowed.',
    });
  }
  if (
    hasScholarlyOrNonStudentFacingSignals({
      excerpt: card.excerpt,
      question: card.question,
      textTitleOrSelection: card.textTitle,
    })
  ) {
    addIssue({
      issues,
      card,
      severity: 'blocker',
      issue: 'Excerpt contains scholarly, editorial, or non-student-facing material rather than teachable source text.',
    });
  }
  if (words < minWordsFor(card) && !isPairedArgumentMiniCard) {
    addIssue({ issues, card, severity: 'major', issue: `Excerpt may be too short for this standard (${words} words).` });
  }
  if (words > 430) {
    addIssue({ issues, card, severity: 'major', issue: `Excerpt may be too long for projected instruction (${words} words).` });
  }
  if (!/[.!?"'”’]\s*$/.test(card.excerpt.trim())) {
    addIssue({ issues, card, severity: 'blocker', issue: 'Excerpt appears cut off because it does not end cleanly.' });
  }
  if (/\[[^\]]*(?:\.\.\.|until|missing|illegible|fragment)[^\]]*\]/i.test(card.excerpt) || /\.{6,}/.test(card.excerpt)) {
    addIssue({ issues, card, severity: 'blocker', issue: 'Excerpt contains bracketed gaps or heavy ellipsis.' });
  }
  if (/[A-Za-z]¬\s+[A-Za-z]/.test(card.excerpt) || /\b[A-Za-z]+-\s+[a-z]/.test(card.excerpt)) {
    addIssue({ issues, card, severity: 'major', issue: 'Excerpt contains OCR or hyphenation artifacts.' });
  }
  if (
    /\btranslator|editor|preface|introduction|appendix|corrections to the text|original tale\b/i.test(card.excerpt) ||
    /\bLine\s+\d+\.|\bl\.\s*\d+|Tablet\s+[IVXLC\d]+|Yale tablet|Assyrian version|parallel passage|Langdon|ideograph|variant reading|misreading|erroneous reading|note\s+\d+\s+on page/i.test(card.excerpt) ||
    (/(?:^|\s)_[^_\s][^_]{1,40}_(?:\s|$)/.test(card.excerpt) && /\b(version|tablet|line|reading|text|note|passage)\b/i.test(card.excerpt)) ||
    /\b(born|died)\s+(?:about\s+)?\d{3,4}\b/i.test(card.excerpt)
  ) {
    addIssue({ issues, card, severity: 'blocker', issue: 'Excerpt looks like editorial or biographical material, not the teachable source text.' });
  }
  if (!card.question.trim().endsWith('?')) {
    addIssue({ issues, card, severity: 'blocker', issue: 'FAST-style question does not end as a question.' });
  }
  for (const quote of quotedText(card.question)) {
    const normalizedQuote = normalize(quote);
    if (normalizedQuote.length >= 10 && !normalize(card.excerpt).includes(normalizedQuote.slice(0, 30))) {
      addIssue({ issues, card, severity: 'blocker', issue: `Question quotes text that does not appear in the excerpt: "${compact(quote, 90)}"` });
    }
  }
  if (/help teach|standard skill|this excerpt help students/i.test(card.question)) {
    addIssue({ issues, card, severity: 'major', issue: 'Question stem is too teacher-facing/generic.' });
  }
  if (
    /\b(this excerpt|the excerpt|this passage|the passage)\b/i.test(card.question) &&
    !/"[^"]{8,}"/.test(card.question) &&
    !/\b(paragraph|line|claim|word|phrase|detail|evidence|setting|speaker|narrator|character|author)\b/i.test(card.question)
  ) {
    addIssue({
      issues,
      card,
      severity: 'major',
      issue: 'Question stem is too generic; it should name a specific detail, claim, structure, or language feature.',
    });
  }
  if (!questionUsesExcerpt(card)) {
    addIssue({ issues, card, severity: 'major', issue: 'Question does not clearly point students back into the excerpt.' });
  }
  if (!hasStandardLanguage(card)) {
    addIssue({ issues, card, severity: 'major', issue: 'Question/choices do not clearly use the standard language or skill demand.' });
  }
  if (card.evidencePoints.length < 2 && card.standardCode !== 'ELA.9.R.1.4') {
    addIssue({ issues, card, severity: 'major', issue: 'Evidence points are too thin for teacher trust.' });
  }
  if (card.choices.length !== 4 || correct.length !== 1) {
    addIssue({ issues, card, severity: 'blocker', issue: 'Multiple-choice set must have exactly four choices and one correct answer.' });
  }
  if (new Set(card.choices.map((choice) => normalize(choice.text))).size !== card.choices.length) {
    addIssue({ issues, card, severity: 'blocker', issue: 'Multiple-choice set has duplicate or nearly duplicate choices.' });
  }
  if (correctText.length > longestWrong + 55) {
    addIssue({ issues, card, severity: 'major', issue: 'Correct answer is much longer than the distractors.' });
  }
  if (Number.isFinite(shortestWrong) && shortestWrong < 35) {
    addIssue({ issues, card, severity: 'minor', issue: 'At least one distractor may be too short/easy.' });
  }
  if (/\b(correct answer|best answer)\b/i.test(correctText)) {
    addIssue({ issues, card, severity: 'major', issue: 'Correct answer contains test-meta language instead of content analysis.' });
  }
  if (
    /\b(It uses|It organizes|It lists|It treats|It gives a true detail|It makes a claim|It focuses on|in a way the excerpt does not develop|without using the excerpt’s exact evidence|only summarizes what happens)\b/i.test(
      card.choices.map((choice) => choice.text).join(' ')
    )
  ) {
    addIssue({
      issues,
      card,
      severity: 'major',
      issue: 'Multiple-choice options are generic item-frame language instead of passage-specific answer choices.',
    });
  }
  if (
    /\b(The passage points to a different effect|This does not explain the author’s move|This does not explain the author's move|The development of the passage points elsewhere|This misses the evidence in the excerpt)\b/i.test(
      card.choices.map((choice) => choice.text).join(' ')
    )
  ) {
    addIssue({
      issues,
      card,
      severity: 'major',
      issue: 'Multiple-choice options contain filler rejection language instead of passage-specific distractors.',
    });
  }
  if (
    card.standardCode === 'ELA.9.R.3.2' &&
    /\b(It restates|It changes the meaning|It copies words|It focuses on a smaller detail|without changing the author’s meaning)\b/i.test(
      card.choices.map((choice) => choice.text).join(' ')
    )
  ) {
    addIssue({
      issues,
      card,
      severity: 'major',
      issue: 'Paraphrase item choices are meta-language instead of actual paraphrases of the passage.',
    });
  }
  if (!choicesArePlausible(card)) {
    addIssue({ issues, card, severity: 'minor', issue: 'One or more distractors may not be text-grounded enough to make students work.' });
  }
  if (choicesAreTooGeneric(card)) {
    addIssue({ issues, card, severity: 'major', issue: 'Answer choices are too generic to feel tied to the excerpt.' });
  }

  return issues;
}

async function loadJson<T>(filePath: string) {
  return JSON.parse(await fs.readFile(filePath, 'utf8')) as T;
}

async function loadJsonIfExists<T>(filePath: string, fallback: T) {
  try {
    return await loadJson<T>(filePath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return fallback;
    throw error;
  }
}

function loadGoldCards(corpus: OfficialTeachableCorpus): AuditableCard[] {
  return corpus.texts.flatMap((text) =>
    text.cards.map((card) => ({
      layer: 'gold' as const,
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
    }))
  );
}

function loadAutoCards(corpus: OfficialAutoGoldCardCorpus): AuditableCard[] {
  return corpus.texts.flatMap((text) =>
    text.cards.map((card) => ({
      layer: 'auto-ready' as const,
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
    }))
  );
}

function loadClaudeReadyCards(corpus: OfficialClaudeReadyCardCorpus): AuditableCard[] {
  return corpus.texts.flatMap((text) =>
    text.cards.map((card) => ({
      layer: 'claude-ready' as const,
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
    }))
  );
}

function summarizeByStandard(cards: AuditableCard[], issues: OfficialCardQualityIssue[]) {
  const issueMap = new Map<string, OfficialCardQualityIssue[]>();
  for (const issue of issues) {
    const key = [
      issue.layer,
      issue.textTitle,
      issue.textAuthor ?? '',
      issue.standardCode,
      issue.subSkillLabel,
      issue.location,
    ].join('::');
    issueMap.set(key, [...(issueMap.get(key) ?? []), issue]);
  }

  const groups = new Map<string, { standardCode: string; standardTitle: string; cards: AuditableCard[] }>();
  for (const card of cards) {
    const existing = groups.get(card.standardCode);
    if (existing) existing.cards.push(card);
    else groups.set(card.standardCode, { standardCode: card.standardCode, standardTitle: card.standardTitle, cards: [card] });
  }

  return [...groups.values()]
    .map((group) => {
      const groupIssues = issues.filter((issue) => issue.standardCode === group.standardCode);
      const majorRisk = new Set(
        groupIssues
          .filter((issue) => issue.severity === 'blocker' || issue.severity === 'major')
          .map((issue) => [issue.layer, issue.textTitle, issue.textAuthor ?? '', issue.standardCode, issue.subSkillLabel, issue.location].join('::'))
      );
      return {
        standardCode: group.standardCode,
        standardTitle: group.standardTitle,
        cards: group.cards.length,
        ready: Math.max(0, group.cards.length - majorRisk.size),
        blockers: groupIssues.filter((issue) => issue.severity === 'blocker').length,
        major: groupIssues.filter((issue) => issue.severity === 'major').length,
        minor: groupIssues.filter((issue) => issue.severity === 'minor').length,
      };
    })
    .sort((a, b) => a.standardCode.localeCompare(b.standardCode));
}

function summarizeByText(cards: AuditableCard[], issues: OfficialCardQualityIssue[]) {
  const groups = new Map<string, { title: string; cards: AuditableCard[] }>();
  for (const card of cards) {
    const title = `${card.textTitle}${card.textAuthor ? ` — ${card.textAuthor}` : ''}`;
    const existing = groups.get(title);
    if (existing) existing.cards.push(card);
    else groups.set(title, { title, cards: [card] });
  }

  return [...groups.values()]
    .map((group) => {
      const groupIssues = issues.filter((issue) => `${issue.textTitle}${issue.textAuthor ? ` — ${issue.textAuthor}` : ''}` === group.title);
      const majorRisk = new Set(
        groupIssues
          .filter((issue) => issue.severity === 'blocker' || issue.severity === 'major')
          .map((issue) => [issue.layer, issue.textTitle, issue.textAuthor ?? '', issue.standardCode, issue.subSkillLabel, issue.location].join('::'))
      );
      return {
        title: group.title,
        cards: group.cards.length,
        ready: Math.max(0, group.cards.length - majorRisk.size),
        blockers: groupIssues.filter((issue) => issue.severity === 'blocker').length,
        major: groupIssues.filter((issue) => issue.severity === 'major').length,
        minor: groupIssues.filter((issue) => issue.severity === 'minor').length,
      };
    })
    .sort((a, b) => b.blockers - a.blockers || b.major - a.major || b.cards - a.cards);
}

export async function buildOfficialCardQualityAudit(): Promise<OfficialCardQualityAudit> {
  const goldCorpus = await loadJson<OfficialTeachableCorpus>(GOLD_PATH);
  const autoCorpus = await loadJson<OfficialAutoGoldCardCorpus>(AUTO_PATH);
  const claudeCorpus = await loadJsonIfExists<OfficialClaudeReadyCardCorpus>(CLAUDE_READY_PATH, {
    summary: { readyCards: 0, textsWithCards: 0, standardsRepresented: 0 },
    texts: [],
  });
  const cards = [...loadGoldCards(goldCorpus), ...loadAutoCards(autoCorpus), ...loadClaudeReadyCards(claudeCorpus)];
  const issues = cards.flatMap((card) => auditCard(card));
  const exactQuestionGroups = new Map<string, AuditableCard[]>();
  for (const card of cards) {
    const normalizedQuestion = normalize(card.question);
    exactQuestionGroups.set(normalizedQuestion, [...(exactQuestionGroups.get(normalizedQuestion) ?? []), card]);
  }
  for (const group of exactQuestionGroups.values()) {
    if (group.length < 3) continue;
    for (const card of group) {
      addIssue({
        issues,
        card,
        severity: 'major',
        issue: `Question stem is repeated across ${group.length} cards; it needs passage-specific wording.`,
      });
    }
  }
  const cardsWithIssues = new Set(issues.map((issue) => cardKey({
    layer: issue.layer,
    textTitle: issue.textTitle,
    textAuthor: issue.textAuthor,
    standardCode: issue.standardCode,
    standardTitle: issue.standardTitle,
    subSkillLabel: issue.subSkillLabel,
    location: issue.location,
    excerpt: issue.excerptPreview,
    question: issue.question,
    choices: [],
    evidencePoints: [],
  }))).size;
  const majorRiskCards = new Set(
    issues
      .filter((issue) => issue.severity === 'blocker' || issue.severity === 'major')
      .map((issue) => [issue.layer, issue.textTitle, issue.textAuthor ?? '', issue.standardCode, issue.subSkillLabel, issue.location].join('::'))
  );

  return {
    generatedAt: new Date().toISOString(),
    summary: {
      cardsAudited: cards.length,
      goldCardsAudited: cards.filter((card) => card.layer === 'gold').length,
      autoReadyCardsAudited: cards.filter((card) => card.layer === 'auto-ready').length,
      claudeReadyCardsAudited: cards.filter((card) => card.layer === 'claude-ready').length,
      classroomReadyCards: Math.max(0, cards.length - majorRiskCards.size),
      cardsWithMajorRisk: majorRiskCards.size,
      cardsWithIssues,
      blockers: issues.filter((issue) => issue.severity === 'blocker').length,
      major: issues.filter((issue) => issue.severity === 'major').length,
      minor: issues.filter((issue) => issue.severity === 'minor').length,
      textsAudited: new Set(cards.map((card) => `${card.textTitle}::${card.textAuthor ?? ''}`)).size,
      standardsAudited: new Set(cards.map((card) => card.standardCode)).size,
    },
    byStandard: summarizeByStandard(cards, issues),
    byText: summarizeByText(cards, issues),
    issues,
  };
}

export function officialCardQualityAuditMarkdown(report: OfficialCardQualityAudit) {
  const lines = [
    '# GOGI Official Card Quality Audit',
    '',
    `Generated: ${report.generatedAt}`,
    `Cards audited: ${report.summary.cardsAudited}`,
    `Gold cards audited: ${report.summary.goldCardsAudited}`,
    `Auto-ready cards audited: ${report.summary.autoReadyCardsAudited}`,
    `Claude-ready cards audited: ${report.summary.claudeReadyCardsAudited}`,
    `Classroom-ready by rule check: ${report.summary.classroomReadyCards}`,
    `Cards with major/blocker risk: ${report.summary.cardsWithMajorRisk}`,
    `Cards with issues: ${report.summary.cardsWithIssues}`,
    `Blockers: ${report.summary.blockers}`,
    `Major issues: ${report.summary.major}`,
    `Minor issues: ${report.summary.minor}`,
    `Texts audited: ${report.summary.textsAudited}`,
    `Standards audited: ${report.summary.standardsAudited}`,
    '',
    '## By Standard',
    '',
    '| Standard | Cards | Ready | Blockers | Major | Minor |',
    '| --- | ---: | ---: | ---: | ---: | ---: |',
  ];

  for (const standard of report.byStandard) {
    lines.push(`| ${standard.standardCode} — ${standard.standardTitle} | ${standard.cards} | ${standard.ready} | ${standard.blockers} | ${standard.major} | ${standard.minor} |`);
  }

  lines.push('');
  lines.push('## By Text');
  lines.push('');
  lines.push('| Text | Cards | Ready | Blockers | Major | Minor |');
  lines.push('| --- | ---: | ---: | ---: | ---: | ---: |');
  for (const text of report.byText) {
    lines.push(`| ${text.title} | ${text.cards} | ${text.ready} | ${text.blockers} | ${text.major} | ${text.minor} |`);
  }

  lines.push('');
  lines.push('## Issues');
  lines.push('');
  for (const issue of report.issues.slice(0, 1500)) {
    lines.push(`- **${issue.severity.toUpperCase()}** [${issue.layer}] ${issue.textTitle}${issue.textAuthor ? ` — ${issue.textAuthor}` : ''} / ${issue.standardCode} / ${issue.subSkillLabel} / ${issue.location}: ${issue.issue}`);
    lines.push(`  - Question: ${issue.question}`);
    lines.push(`  - Excerpt: ${issue.excerptPreview}`);
  }
  if (report.issues.length > 1500) lines.push(`- ...${report.issues.length - 1500} more issues in JSON report.`);

  return `${lines.join('\n')}\n`;
}
