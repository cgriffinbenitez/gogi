#!/usr/bin/env tsx
import dotenv from 'dotenv';
import fs from 'fs/promises';
import path from 'path';
import Anthropic from '@anthropic-ai/sdk';
import type { OfficialExcerptCandidate, OfficialExcerptInventory } from '../src/lib/teacher/officialExcerptInventory';
import {
  hasScholarlyOrNonStudentFacingSignals,
  isGenreCompatibleForStandard,
} from '../src/lib/teacher/officialCorpusGuards';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });
dotenv.config();

type ClaudeCard = {
  id: string;
  textTitle: string;
  textAuthor: string | null;
  standardCode: string;
  standardTitle: string;
  subSkillId: string;
  subSkillLabel: string;
  location: string;
  excerpt: string;
  wordCount: number;
  whyThisWorks: string;
  skillStrategy: string;
  evidencePoints: string[];
  question: string;
  choices: Array<{ label: 'A' | 'B' | 'C' | 'D'; text: string; correct: boolean }>;
  auditLabel: 'claude-ready';
};

type ClaudeReadyCorpus = {
  generatedAt: string;
  summary: {
    readyCards: number;
    textsWithCards: number;
    standardsRepresented: number;
  };
  texts: Array<{
    title: string;
    author: string | null;
    cards: ClaudeCard[];
    cardCount: number;
  }>;
};

type ClaudeResponse = {
  ready: boolean;
  rejection_reason?: string;
  why_this_works: string;
  skill_strategy: string;
  evidence_points: string[];
  question: string;
  choices: Array<{ label: 'A' | 'B' | 'C' | 'D'; text: string; correct: boolean }>;
};

const ROOT = process.cwd();
const INVENTORY_PATH = path.join(ROOT, 'data', 'official-text-library', 'teachable-excerpt-inventory.json');
const OUT_PATH = path.join(ROOT, 'data', 'official-text-library', 'claude-ready-gold-cards.json');
const REJECTED_PATH = path.join(ROOT, 'data', 'official-text-library', 'claude-ready-rejected-cards.json');
const COVERAGE_AUDIT_PATH = path.join(ROOT, 'data', 'official-text-library', 'audits', 'latest-coverage-gap-audit.json');

type CoverageGapAudit = {
  localTextsWithoutReadyCards?: Array<{
    title: string;
    missingStandards?: string[];
  }>;
  thinLocalTexts?: Array<{
    title: string;
    missingStandards?: string[];
    readyCards?: number;
  }>;
};

function argValue(name: string, fallback = '') {
  const flag = `--${name}`;
  const index = process.argv.indexOf(flag);
  if (index === -1) return fallback;
  return process.argv[index + 1] ?? fallback;
}

function hasFlag(name: string) {
  return process.argv.includes(`--${name}`);
}

function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function slug(value: string) {
  return normalize(value).replace(/\s+/g, '-').slice(0, 96);
}

function excerptFingerprint(value: string) {
  return normalize(value).split(/\s+/).slice(0, 45).join(' ');
}

function compact(value: string, max = 900) {
  const cleaned = value.replace(/\s+/g, ' ').trim();
  if (cleaned.length <= max) return cleaned;
  const clipped = cleaned.slice(0, max);
  const lastStop = Math.max(clipped.lastIndexOf('.'), clipped.lastIndexOf('!'), clipped.lastIndexOf('?'));
  return lastStop > 250 ? clipped.slice(0, lastStop + 1) : `${clipped.trim()}...`;
}

function parseJson(text: string): ClaudeResponse {
  const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
  try {
    return JSON.parse(cleaned) as ClaudeResponse;
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('Claude did not return JSON.');
    return JSON.parse(match[0]) as ClaudeResponse;
  }
}

function isCleanExcerpt(candidate: OfficialExcerptCandidate) {
  const text = candidate.excerpt;
  if (!isGenreCompatibleForStandard(candidate.textTitle, candidate.standardCode)) return false;
  if (candidate.standardCode === 'ELA.9.R.3.3') return false;
  if (
    hasScholarlyOrNonStudentFacingSignals({
      excerpt: candidate.excerpt,
      question: candidate.suggestedQuestionStem,
      textTitleOrSelection: candidate.textTitle,
    })
  ) {
    return false;
  }
  if (!/[.!?"'”’]\s*$/.test(text.trim())) return false;
  if (/\[[^\]]*(?:\.\.\.|until|missing|illegible|fragment)[^\]]*\]/i.test(text) || /\.{6,}/.test(text)) return false;
  if (/[A-Za-z]¬\s+[A-Za-z]/.test(text) || /\b[A-Za-z]+-\s+[a-z]/.test(text)) return false;
  if (/\btranslator|editor|preface|introduction|appendix|corrections to the text|original tale\b/i.test(text)) return false;
  if (/\bLine\s+\d+\.|\bl\.\s*\d+|Tablet\s+[IVXLC\d]+|Yale tablet|Assyrian version|parallel passage|Langdon|ideograph|variant reading|misreading|erroneous reading|note\s+\d+\s+on page/i.test(text)) return false;
  return true;
}

function validateCard(candidate: OfficialExcerptCandidate, response: ClaudeResponse) {
  if (!response.ready) return response.rejection_reason ?? 'Claude rejected the excerpt.';
  if (!response.question?.trim().endsWith('?')) return 'Question must be a real question.';
  if (candidate.standardCode === 'ELA.9.R.3.2' && !/\b(paraphrase|restate|meaning|means|main idea)\b/i.test(response.question)) {
    return 'R.3.2 question must ask students to paraphrase, restate, or preserve meaning.';
  }
  if (response.choices?.length !== 4) return 'Card must have exactly four choices.';
  if (response.choices.filter((choice) => choice.correct).length !== 1) return 'Card must have exactly one correct answer.';
  if ((response.evidence_points ?? []).length < 2) return 'Card must include at least two evidence points.';
  const joinedChoices = response.choices.map((choice) => choice.text).join(' ');
  if (
    /\b(It uses|It organizes|It lists|It treats|It gives a true detail|It makes a claim|It focuses on|without using the excerpt|only summarizes|correct answer|best answer)\b/i.test(
      joinedChoices
    )
  ) {
    return 'Choices sound like item-frame/meta language instead of passage-specific answer choices.';
  }
  const excerptTokens = new Set(normalize(candidate.excerpt).split(/\s+/).filter((token) => token.length >= 5));
  const questionOverlap = normalize(response.question)
    .split(/\s+/)
    .filter((token) => excerptTokens.has(token)).length;
  if (!/"[^"]{8,}"/.test(response.question) && questionOverlap < 2) {
    return 'Question does not clearly point back to the excerpt.';
  }
  return null;
}

function buildPrompt(candidate: OfficialExcerptCandidate) {
  const standardSpecificRule =
    candidate.standardCode === 'ELA.9.R.3.2'
      ? '\nR.3.2 rule: Ask students to paraphrase or accurately restate a specific complete sentence, claim, or short passage chunk from the excerpt. The correct answer must preserve the original meaning; distractors should distort, overstate, understate, or miss part of that meaning.'
      : '';
  return `You are writing one classroom-ready Grade 9 Florida FAST-style ELA multiple-choice card.

Non-negotiable:
- Use ONLY the supplied excerpt.
- The question must be tied to the specific standard and subskill.
- The question must point to exact words, a claim, a structure, a language feature, or a clear passage moment.
- Answer choices must be actual passage interpretations, not meta-test language.
- Distractors must be plausible student misunderstandings from the excerpt.
- No choice may say "It uses", "It lists", "It treats", "It gives a true detail", "only summarizes", "correct answer", or "best answer".
- Correct answer cannot be obviously longer than every distractor.
- If this excerpt cannot support a rigorous FAST-style item, return ready: false.
${standardSpecificRule}

Standard: ${candidate.standardCode} — ${candidate.standardTitle}
Subskill: ${candidate.subSkillLabel}
Student can do: ${candidate.studentCanDo}
Source: ${candidate.textTitle}${candidate.textAuthor ? ` — ${candidate.textAuthor}` : ''}
Location: ${candidate.location}

Excerpt:
"""
${candidate.excerpt}
"""

Return strict JSON only:
{
  "ready": true,
  "rejection_reason": "",
  "why_this_works": "one teacher-facing sentence explaining why this excerpt teaches the subskill",
  "skill_strategy": "one student-friendly strategy sentence",
  "evidence_points": ["exact quote 1", "exact quote 2"],
  "question": "FAST-style question",
  "choices": [
    {"label": "A", "text": "passage-specific answer choice", "correct": false},
    {"label": "B", "text": "passage-specific answer choice", "correct": true},
    {"label": "C", "text": "passage-specific answer choice", "correct": false},
    {"label": "D", "text": "passage-specific answer choice", "correct": false}
  ]
}`;
}

function buildRevisionPrompt(candidate: OfficialExcerptCandidate, previous: ClaudeResponse, failure: string) {
  return `${buildPrompt(candidate)}

Your previous card failed GOGI's quality gate.

Failure reason:
${failure}

Previous question:
${previous.question}

Previous choices:
${previous.choices.map((choice) => `${choice.label}. ${choice.text}`).join('\n')}

Rewrite the card so the question points directly to exact words, a named claim, a named structure, or a clear passage moment from the excerpt. Return strict JSON only using the same schema.`;
}

function isTransientClaudeError(reason: string) {
  return /\b(connection error|timeout|network|fetch failed|socket|econnreset|etimedout|rate limit|overloaded)\b/i.test(reason);
}

async function loadExisting() {
  try {
    return JSON.parse(await fs.readFile(OUT_PATH, 'utf8')) as ClaudeReadyCorpus;
  } catch {
    return {
      generatedAt: new Date().toISOString(),
      summary: { readyCards: 0, textsWithCards: 0, standardsRepresented: 0 },
      texts: [],
    } satisfies ClaudeReadyCorpus;
  }
}

function flattenExisting(corpus: ClaudeReadyCorpus) {
  return new Map(
    corpus.texts.flatMap((text) =>
      text.cards.map((card) => [
        `${card.textTitle}::${card.textAuthor ?? ''}::${card.standardCode}::${card.subSkillLabel}::${card.location}`,
        card,
      ])
    )
  );
}

function existingExcerptStandardKeys(corpus: ClaudeReadyCorpus) {
  return new Set(
    corpus.texts.flatMap((text) =>
      text.cards.map((card) => `${card.textTitle}::${card.textAuthor ?? ''}::${card.standardCode}::${card.subSkillId}::${excerptFingerprint(card.excerpt)}`)
    )
  );
}

async function loadRejected() {
  try {
    return JSON.parse(await fs.readFile(REJECTED_PATH, 'utf8')) as Record<string, { reason: string; rejectedAt: string }>;
  } catch {
    return {};
  }
}

function candidateKey(candidate: OfficialExcerptCandidate) {
  return `${candidate.textTitle}::${candidate.textAuthor ?? ''}::${candidate.standardCode}::${candidate.subSkillLabel}::${candidate.location}`;
}

function balancedCandidates(candidates: OfficialExcerptCandidate[], limit: number) {
  const groups = new Map<string, OfficialExcerptCandidate[]>();
  for (const candidate of candidates) {
    const key = `${candidate.standardCode}::${candidate.textTitle}`;
    groups.set(key, [...(groups.get(key) ?? []), candidate]);
  }
  const queues = [...groups.values()].sort((a, b) => a[0].standardCode.localeCompare(b[0].standardCode) || a[0].textTitle.localeCompare(b[0].textTitle));
  const selected: OfficialExcerptCandidate[] = [];
  while (selected.length < limit && queues.some((queue) => queue.length > 0)) {
    for (const queue of queues) {
      const next = queue.shift();
      if (!next) continue;
      selected.push(next);
      if (selected.length >= limit) break;
    }
  }
  return selected;
}

async function coveragePushCandidates(candidates: OfficialExcerptCandidate[], limit: number) {
  const audit = JSON.parse(await fs.readFile(COVERAGE_AUDIT_PATH, 'utf8')) as CoverageGapAudit;
  const groups: Array<{ title: string; rank: number; missingStandards: Set<string> }> = [
    ...(audit.localTextsWithoutReadyCards ?? []).map((text, index) => ({
      title: text.title,
      rank: index,
      missingStandards: new Set(text.missingStandards ?? []),
    })),
    ...(audit.thinLocalTexts ?? []).map((text, index) => ({
      title: text.title,
      rank: 1000 + (text.readyCards ?? 0) * 100 + index,
      missingStandards: new Set(text.missingStandards ?? []),
    })),
  ];
  const titleRank = new Map<string, { rank: number; missingStandards: Set<string> }>();
  for (const group of groups) {
    titleRank.set(normalize(group.title), { rank: group.rank, missingStandards: group.missingStandards });
  }
  const targeted = candidates
    .map((candidate) => {
      const fullTitle = `${candidate.textTitle}${candidate.textAuthor ? ` — ${candidate.textAuthor}` : ''}`;
      const target = titleRank.get(normalize(fullTitle));
      return { candidate, target };
    })
    .filter((entry): entry is { candidate: OfficialExcerptCandidate; target: { rank: number; missingStandards: Set<string> } } => {
      if (!entry.target) return false;
      if (entry.candidate.standardCode === 'ELA.9.R.3.3') return false;
      if (entry.target.missingStandards.size === 0) return false;
      return entry.target.missingStandards.has(entry.candidate.standardCode);
    })
    .sort(
      (a, b) =>
        a.target.rank - b.target.rank ||
        a.candidate.standardCode.localeCompare(b.candidate.standardCode) ||
        b.candidate.score - a.candidate.score
    )
    .map((entry) => entry.candidate);
  return balancedCandidates(targeted, limit);
}

function toCorpus(cards: ClaudeCard[]): ClaudeReadyCorpus {
  const groups = new Map<string, { title: string; author: string | null; cards: ClaudeCard[] }>();
  for (const card of cards) {
    const key = `${card.textTitle}::${card.textAuthor ?? ''}`;
    const existing = groups.get(key);
    if (existing) existing.cards.push(card);
    else groups.set(key, { title: card.textTitle, author: card.textAuthor, cards: [card] });
  }
  const texts = [...groups.values()]
    .map((text) => ({ ...text, cardCount: text.cards.length }))
    .sort((a, b) => b.cardCount - a.cardCount || a.title.localeCompare(b.title));
  return {
    generatedAt: new Date().toISOString(),
    summary: {
      readyCards: cards.length,
      textsWithCards: texts.filter((text) => text.cardCount > 0).length,
      standardsRepresented: new Set(cards.map((card) => card.standardCode)).size,
    },
    texts,
  };
}

async function main() {
  const limit = Number(argValue('limit', '25'));
  const standard = argValue('standard');
  const textFilter = normalize(argValue('text'));
  const balanced = hasFlag('balanced');
  const coveragePush = hasFlag('coverage-push');
  const retryRejected = hasFlag('retry-rejected');
  const dryRun = hasFlag('dry-run');
  const inventory = JSON.parse(await fs.readFile(INVENTORY_PATH, 'utf8')) as OfficialExcerptInventory;
  const existing = await loadExisting();
  const existingCards = flattenExisting(existing);
  const existingExcerptKeys = existingExcerptStandardKeys(existing);
  const rejectedCards = await loadRejected();

  const candidatePool = inventory.texts
    .flatMap((text) => text.candidates)
    .filter((candidate) => isCleanExcerpt(candidate))
    .filter((candidate) => !standard || candidate.standardCode === standard)
    .filter((candidate) => !textFilter || normalize(candidate.textTitle).includes(textFilter))
    .filter((candidate) => !existingCards.has(candidateKey(candidate)))
    .filter((candidate) => !existingExcerptKeys.has(`${candidate.textTitle}::${candidate.textAuthor ?? ''}::${candidate.standardCode}::${candidate.subSkillId}::${excerptFingerprint(candidate.excerpt)}`))
    .filter((candidate) => retryRejected || !rejectedCards[candidateKey(candidate)]);
  const candidates = coveragePush
    ? await coveragePushCandidates(candidatePool, Math.max(1, limit))
    : (balanced ? balancedCandidates(candidatePool, Math.max(1, limit)) : candidatePool.slice(0, Math.max(1, limit)));

  console.log(
    `Preparing ${candidates.length} Claude-authored card(s)${coveragePush ? ' in coverage-push mode' : balanced ? ' in balanced mode' : ''}.`
  );
  if (dryRun) {
    for (const candidate of candidates.slice(0, 10)) {
      console.log(`- ${candidate.textTitle}${candidate.textAuthor ? ` — ${candidate.textAuthor}` : ''} / ${candidate.standardCode} / ${candidate.subSkillLabel} / ${candidate.location}`);
    }
    return;
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not set. Add it locally, restart the shell, and rerun.');

  const client = new Anthropic({ apiKey, timeout: 90_000 });
  const readyCards = [...existingCards.values()];
  let generated = 0;
  let rejected = 0;

  async function checkpoint() {
    const corpus = toCorpus(readyCards);
    await fs.writeFile(OUT_PATH, JSON.stringify(corpus, null, 2));
    await fs.writeFile(REJECTED_PATH, JSON.stringify(rejectedCards, null, 2));
  }

  for (const candidate of candidates) {
    try {
      const model = process.env.ANTHROPIC_CARD_MODEL ?? process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-6';
      const createCard = async (prompt: string) => {
        const message = await client.messages.create({
          model,
          max_tokens: 2200,
          temperature: 0.15,
          system: 'You are a precise Florida FAST Grade 9 ELA item writer. Return strict JSON only.',
          messages: [{ role: 'user', content: prompt }],
        });
        const raw = message.content.map((part) => (part.type === 'text' ? part.text : '')).join('').trim();
        return parseJson(raw);
      };
      let parsed = await createCard(buildPrompt(candidate));
      let failure = validateCard(candidate, parsed);
      if (failure && !parsed.rejection_reason) {
        const revised = await createCard(buildRevisionPrompt(candidate, parsed, failure));
        const revisedFailure = validateCard(candidate, revised);
        if (!revisedFailure) {
          parsed = revised;
          failure = null;
          console.log(`revised ${candidate.textTitle} / ${candidate.standardCode} / ${candidate.location}`);
        } else {
          failure = revisedFailure;
        }
      }
      if (failure) {
        rejected += 1;
        rejectedCards[candidateKey(candidate)] = { reason: failure, rejectedAt: new Date().toISOString() };
        await checkpoint();
        console.log(`rejected ${candidate.textTitle} / ${candidate.standardCode} / ${candidate.location}: ${failure}`);
        continue;
      }
      readyCards.push({
        id: slug(`${candidate.textTitle}-${candidate.standardCode}-${candidate.subSkillId}-${candidate.location}`),
        textTitle: candidate.textTitle,
        textAuthor: candidate.textAuthor,
        standardCode: candidate.standardCode,
        standardTitle: candidate.standardTitle,
        subSkillId: candidate.subSkillId,
        subSkillLabel: candidate.subSkillLabel,
        location: candidate.location,
        excerpt: candidate.excerpt,
        wordCount: candidate.wordCount,
        whyThisWorks: parsed.why_this_works,
        skillStrategy: parsed.skill_strategy,
        evidencePoints: parsed.evidence_points.slice(0, 4),
        question: parsed.question,
        choices: parsed.choices,
        auditLabel: 'claude-ready',
      });
      generated += 1;
      await checkpoint();
      console.log(`ready ${candidate.textTitle} / ${candidate.standardCode} / ${candidate.location}`);
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'Claude generation failed.';
      rejected += 1;
      if (!isTransientClaudeError(reason)) {
        rejectedCards[candidateKey(candidate)] = { reason, rejectedAt: new Date().toISOString() };
      }
      await checkpoint();
      console.log(`rejected ${candidate.textTitle} / ${candidate.standardCode} / ${candidate.location}: ${reason}`);
    }
  }

  const corpus = toCorpus(readyCards);
  await fs.writeFile(OUT_PATH, JSON.stringify(corpus, null, 2));
  await fs.writeFile(REJECTED_PATH, JSON.stringify(rejectedCards, null, 2));
  console.log(`Done. Ready cards: ${corpus.summary.readyCards}. New: ${generated}. Rejected: ${rejected}.`);
  console.log('JSON: data/official-text-library/claude-ready-gold-cards.json');
}

main().catch((error) => {
  console.error('[generate-official-ready-cards-with-claude] failed:', error);
  process.exit(1);
});
