#!/usr/bin/env tsx
import dotenv from 'dotenv';
import fs from 'fs/promises';
import path from 'path';
import Anthropic from '@anthropic-ai/sdk';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });
dotenv.config();

type Choice = { label: 'A' | 'B' | 'C' | 'D'; text: string; correct: boolean };

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
  choices: Choice[];
  auditLabel: 'claude-ready';
};

type ClaudeCorpus = {
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

type AuditIssue = {
  severity: 'blocker' | 'major' | 'minor';
  layer: 'gold' | 'auto-ready' | 'claude-ready';
  textTitle: string;
  textAuthor: string | null;
  standardCode: string;
  subSkillLabel: string;
  location: string;
  question: string;
  issue: string;
};

type AuditReport = {
  issues: AuditIssue[];
};

type ClaudeRepairResponse = {
  ready: boolean;
  rejection_reason?: string;
  why_this_works: string;
  skill_strategy: string;
  evidence_points: string[];
  question: string;
  choices: Choice[];
};

const ROOT = process.cwd();
const CLAUDE_PATH = path.join(ROOT, 'data', 'official-text-library', 'claude-ready-gold-cards.json');
const AUDIT_PATH = path.join(ROOT, 'data', 'official-text-library', 'audits', 'latest-card-quality-audit.json');
const REJECTED_PATH = path.join(ROOT, 'data', 'official-text-library', 'claude-ready-rejected-cards.json');
const QUARANTINE_PATH = path.join(ROOT, 'data', 'official-text-library', 'claude-ready-quarantined-cards.json');

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

function cardKey(args: {
  textTitle: string;
  textAuthor: string | null;
  standardCode: string;
  subSkillLabel: string;
  location: string;
}) {
  return [args.textTitle, args.textAuthor ?? '', args.standardCode, args.subSkillLabel, args.location].join('::');
}

function parseJson(text: string): ClaudeRepairResponse {
  const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
  try {
    return JSON.parse(cleaned) as ClaudeRepairResponse;
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('Claude did not return JSON.');
    return JSON.parse(match[0]) as ClaudeRepairResponse;
  }
}

function tokenSet(value: string) {
  return new Set(normalize(value).split(/\s+/).filter((token) => token.length >= 5));
}

function overlapCount(a: string, b: string) {
  const left = tokenSet(a);
  return [...tokenSet(b)].filter((token) => left.has(token)).length;
}

function isUnfixable(issues: AuditIssue[]) {
  return issues.some((issue) =>
    /editorial|biographical|cut off|OCR|hyphenation|bracketed gaps|heavy ellipsis|too short/i.test(issue.issue)
  );
}

function validateRepair(card: ClaudeCard, response: ClaudeRepairResponse) {
  if (!response.ready) return response.rejection_reason ?? 'Claude rejected the card.';
  if (!response.question?.trim().endsWith('?')) return 'Question must be a real question.';
  if (response.choices?.length !== 4) return 'Card must have exactly four choices.';
  if (response.choices.filter((choice) => choice.correct).length !== 1) return 'Card must have exactly one correct answer.';
  if ((response.evidence_points ?? []).length < 2) return 'Card must include at least two evidence points.';
  if (!/"[^"]{8,}"/.test(response.question) && overlapCount(response.question, card.excerpt) < 2) {
    return 'Question does not clearly point back to the excerpt.';
  }
  const joinedChoices = response.choices.map((choice) => choice.text).join(' ');
  if (
    /\b(It uses|It organizes|It lists|It treats|It gives a true detail|It makes a claim|It focuses on|without using the excerpt|only summarizes|correct answer|best answer)\b/i.test(
      joinedChoices
    )
  ) {
    return 'Choices sound like item-frame/meta language instead of passage-specific answer choices.';
  }
  const correct = response.choices.find((choice) => choice.correct)?.text ?? '';
  const wrongLengths = response.choices.filter((choice) => !choice.correct).map((choice) => choice.text.length);
  if (wrongLengths.length && correct.length > Math.max(...wrongLengths) + 55) {
    return 'Correct answer is much longer than the distractors.';
  }
  return null;
}

function buildRepairPrompt(card: ClaudeCard, issues: AuditIssue[]) {
  return `You are repairing one Grade 9 Florida FAST-style ELA multiple-choice card.

Use ONLY the supplied excerpt. Do not change the excerpt, source, standard, subskill, or location.

The card failed GOGI's audit for these reasons:
${issues.map((issue) => `- ${issue.issue}`).join('\n')}

Repair requirements:
- Rewrite the question so it points directly to exact words, a named claim, a named structure, or a clear passage moment from the excerpt.
- Make the item clearly match the standard/subskill.
- Make answer choices passage-specific, not meta-language.
- Make distractors plausible student misunderstandings from the excerpt.
- Keep the correct answer similar in length to the distractors.
- Include at least two exact evidence points from the excerpt.
- If the excerpt itself cannot support a strong item, return ready: false.

Standard: ${card.standardCode} — ${card.standardTitle}
Subskill: ${card.subSkillLabel}
Source: ${card.textTitle}${card.textAuthor ? ` — ${card.textAuthor}` : ''}
Location: ${card.location}

Excerpt:
"""
${card.excerpt}
"""

Current question:
${card.question}

Current choices:
${card.choices.map((choice) => `${choice.label}. ${choice.text}${choice.correct ? ' [correct]' : ''}`).join('\n')}

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

function toCorpus(cards: ClaudeCard[]): ClaudeCorpus {
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

async function loadJson<T>(filePath: string, fallback: T) {
  try {
    return JSON.parse(await fs.readFile(filePath, 'utf8')) as T;
  } catch {
    return fallback;
  }
}

async function main() {
  const limit = Number(argValue('limit', '25'));
  const standard = argValue('standard');
  const textFilter = normalize(argValue('text'));
  const dryRun = hasFlag('dry-run');
  const quarantineOnly = hasFlag('quarantine-only');

  const corpus = await loadJson<ClaudeCorpus>(CLAUDE_PATH, {
    generatedAt: new Date().toISOString(),
    summary: { readyCards: 0, textsWithCards: 0, standardsRepresented: 0 },
    texts: [],
  });
  const audit = await loadJson<AuditReport>(AUDIT_PATH, { issues: [] });
  const rejected = await loadJson<Record<string, { reason: string; rejectedAt: string }>>(REJECTED_PATH, {});
  const quarantined = await loadJson<Record<string, { reason: string; quarantinedAt: string; card: ClaudeCard }>>(QUARANTINE_PATH, {});

  const issueGroups = new Map<string, AuditIssue[]>();
  for (const issue of audit.issues) {
    if (issue.layer !== 'claude-ready') continue;
    if (issue.severity !== 'blocker' && issue.severity !== 'major') continue;
    if (standard && issue.standardCode !== standard) continue;
    if (textFilter && !normalize(issue.textTitle).includes(textFilter)) continue;
    const key = cardKey(issue);
    issueGroups.set(key, [...(issueGroups.get(key) ?? []), issue]);
  }

  const cards = corpus.texts.flatMap((text) => text.cards.map((card) => ({ ...card, textTitle: text.title, textAuthor: text.author })));
  const repairTargets = cards
    .map((card) => ({ card, issues: issueGroups.get(cardKey(card)) ?? [] }))
    .filter((target) => target.issues.length > 0)
    .slice(0, Math.max(1, limit));

  console.log(`Preparing ${repairTargets.length} held Claude card(s) for repair.`);
  if (dryRun) {
    for (const target of repairTargets) {
      console.log(`- ${target.card.textTitle} / ${target.card.standardCode} / ${target.card.location}: ${target.issues.map((issue) => issue.issue).join(' | ')}`);
    }
    return;
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey && !quarantineOnly) throw new Error('ANTHROPIC_API_KEY is not set.');
  const client = apiKey ? new Anthropic({ apiKey, timeout: 90_000 }) : null;
  const model = process.env.ANTHROPIC_CARD_MODEL ?? process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-6';
  const repairedCards = new Map(cards.map((card) => [cardKey(card), card]));
  let repaired = 0;
  let removed = 0;
  let stillHeld = 0;

  async function checkpoint() {
    await fs.writeFile(CLAUDE_PATH, JSON.stringify(toCorpus([...repairedCards.values()]), null, 2));
    await fs.writeFile(REJECTED_PATH, JSON.stringify(rejected, null, 2));
    await fs.writeFile(QUARANTINE_PATH, JSON.stringify(quarantined, null, 2));
  }

  for (const target of repairTargets) {
    const key = cardKey(target.card);
    if (isUnfixable(target.issues) || quarantineOnly) {
      const reason = target.issues.map((issue) => issue.issue).join(' | ');
      quarantined[key] = { reason, quarantinedAt: new Date().toISOString(), card: target.card };
      rejected[key] = { reason, rejectedAt: new Date().toISOString() };
      repairedCards.delete(key);
      removed += 1;
      await checkpoint();
      console.log(`quarantined ${target.card.textTitle} / ${target.card.standardCode} / ${target.card.location}: ${reason}`);
      continue;
    }

    try {
      const message = await client!.messages.create({
        model,
        max_tokens: 2300,
        temperature: 0.12,
        system: 'You are a precise Florida FAST Grade 9 ELA item editor. Return strict JSON only.',
        messages: [{ role: 'user', content: buildRepairPrompt(target.card, target.issues) }],
      });
      const raw = message.content.map((part) => (part.type === 'text' ? part.text : '')).join('').trim();
      const parsed = parseJson(raw);
      const failure = validateRepair(target.card, parsed);
      if (failure) {
        stillHeld += 1;
        rejected[key] = { reason: failure, rejectedAt: new Date().toISOString() };
        console.log(`still held ${target.card.textTitle} / ${target.card.standardCode} / ${target.card.location}: ${failure}`);
        continue;
      }
      repairedCards.set(key, {
        ...target.card,
        whyThisWorks: parsed.why_this_works,
        skillStrategy: parsed.skill_strategy,
        evidencePoints: parsed.evidence_points.slice(0, 4),
        question: parsed.question,
        choices: parsed.choices,
      });
      repaired += 1;
      await checkpoint();
      console.log(`repaired ${target.card.textTitle} / ${target.card.standardCode} / ${target.card.location}`);
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'Repair failed.';
      stillHeld += 1;
      if (!/connection error|timeout|network|fetch failed/i.test(reason)) {
        rejected[key] = { reason, rejectedAt: new Date().toISOString() };
      }
      await checkpoint();
      console.log(`still held ${target.card.textTitle} / ${target.card.standardCode} / ${target.card.location}: ${reason}`);
    }
  }

  await checkpoint();
  console.log(`Done. Repaired: ${repaired}. Quarantined: ${removed}. Still held: ${stillHeld}.`);
}

main().catch((error) => {
  console.error('[repair-claude-ready-cards] failed:', error);
  process.exit(1);
});
