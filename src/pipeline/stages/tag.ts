import Anthropic from '@anthropic-ai/sdk';
import type { CriteriaConfig, Paragraph, TagResult } from '../types';

const MODEL = 'claude-sonnet-4-6';
const ANTHROPIC_DELAY_MS = 500;

let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!client) client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return client;
}

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function serializeTierSignals(criteria: CriteriaConfig): string {
  const { tier1, tier2, tier3 } = criteria.tierSignals;
  if (!tier1 && !tier2 && !tier3) return '(tier signals not yet specified — use best judgment)';
  return [
    tier1 ? `Tier 1 (easiest): ${tier1}` : null,
    tier2 ? `Tier 2: ${tier2}` : null,
    tier3 ? `Tier 3 (hardest): ${tier3}` : null,
  ]
    .filter(Boolean)
    .join('\n');
}

function buildCanonicalAnswerInstruction(criteria: CriteriaConfig): string {
  const vocab = criteria.canonicalVocabulary;
  if (!vocab || vocab.length === 0) {
    return `1. canonical_answer: The correct answer if this paragraph were used in a teach-page question. Classification-specific. For mood: single best mood label (ominous/melancholy/tense/suspenseful/etc.). For syntax: the core S-V of the main sentence. For inferencing: the conclusion the paragraph implies. Etc.`;
  }
  return `1. canonical_answer: The correct answer if this paragraph were used in a teach-page question.

   IMPORTANT: canonical_answer MUST be chosen from this exact vocabulary list. Do not invent new labels.
   ALLOWED values: ${vocab.join(', ')}`;
}

function buildTagPrompt(para: Paragraph, criteria: CriteriaConfig): string {
  return `Classification: ${criteria.classification}
Target skill: ${criteria.targetSkill || '(not yet specified — use best judgment)'}

PARAGRAPH:
${para.text}

Return strict JSON with these fields:

${buildCanonicalAnswerInstruction(criteria)}

2. distractors: Array of exactly 3 plausible-but-wrong answers of the same type as canonical_answer. Must be distinctly wrong for a student who understands the skill.

3. keyword_flags: Array of 3-5 specific words or short phrases in the paragraph that do the cognitive work. These are what the teach page will highlight.

4. difficulty_tier: integer 1 (easiest), 2, or 3 (hardest). Use this rubric:
${serializeTierSignals(criteria)}

Respond in strict JSON only, no prose:
{
  "canonical_answer": "...",
  "distractors": ["...", "...", "..."],
  "keyword_flags": ["...", "..."],
  "difficulty_tier": 1
}`;
}

const RETRY_PREFIX =
  'IMPORTANT: Your previous response was not valid JSON. Return valid JSON only, no markdown, no explanation.\n\n';

async function callClaude(prompt: string): Promise<string> {
  await sleep(ANTHROPIC_DELAY_MS);
  const msg = await getClient().messages.create({
    model: MODEL,
    max_tokens: 512,
    system: 'You are tagging a paragraph for a literacy intervention teach page.',
    messages: [{ role: 'user', content: prompt }],
  });
  return (msg.content[0] as { type: string; text: string }).text.trim();
}

export async function tagParagraph(
  para: Paragraph,
  criteria: CriteriaConfig,
): Promise<TagResult | null> {
  const prompt = buildTagPrompt(para, criteria);
  let raw: string;

  try {
    raw = await callClaude(prompt);
    const parsed = JSON.parse(raw);
    return {
      canonical_answer: String(parsed.canonical_answer ?? ''),
      distractors:      Array.isArray(parsed.distractors) ? parsed.distractors.map(String) : [],
      keyword_flags:    Array.isArray(parsed.keyword_flags) ? parsed.keyword_flags.map(String) : [],
      difficulty_tier:  ([1, 2, 3].includes(Number(parsed.difficulty_tier))
        ? Number(parsed.difficulty_tier)
        : 2) as 1 | 2 | 3,
    };
  } catch {
    // One retry
    try {
      console.warn('  [tag] first attempt invalid JSON — retrying');
      await sleep(ANTHROPIC_DELAY_MS);
      raw = await callClaude(RETRY_PREFIX + prompt);
      const parsed = JSON.parse(raw);
      return {
        canonical_answer: String(parsed.canonical_answer ?? ''),
        distractors:      Array.isArray(parsed.distractors) ? parsed.distractors.map(String) : [],
        keyword_flags:    Array.isArray(parsed.keyword_flags) ? parsed.keyword_flags.map(String) : [],
        difficulty_tier:  ([1, 2, 3].includes(Number(parsed.difficulty_tier))
          ? Number(parsed.difficulty_tier)
          : 2) as 1 | 2 | 3,
      };
    } catch {
      console.warn('  [tag] second attempt also failed — marking tagging_failed');
      return null;
    }
  }
}
