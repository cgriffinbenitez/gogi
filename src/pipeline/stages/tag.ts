import Anthropic from '@anthropic-ai/sdk';
import type { CriteriaConfig, Paragraph, TagNotDetected, TagResult } from '../types';

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

function buildTagPrompt(para: Paragraph, criteria: CriteriaConfig): string {
  const vocab = criteria.canonicalVocabulary?.length
    ? criteria.canonicalVocabulary.join(', ')
    : '(none specified — use best clinical judgment)';

  return `You are generating diagnostic assessment tags for a GOGI intervention passage that has passed filter. The passage teaches the target classification: ${criteria.classification}.

CANONICAL VOCABULARY FOR THIS SKILL (you MUST select the canonical_answer from this list):
${vocab}

PARAGRAPH:
"""
${para.text}
"""

Your task:

1. Select the canonical answer — the single most precise term from the canonical vocabulary that names the target skill signal in this passage.

2. Generate three plausible distractors — terms representing specific cognitive errors a student might make when reading this passage.

3. Identify 3-5 keyword flags — specific phrases from the passage that carry the target skill signal.

4. Assign difficulty_tier: 1 (easiest), 2, or 3 (hardest).

CRITICAL — NULL ESCAPE HATCH:

If after reading this passage you cannot confidently identify a clear, dominant target skill signal that maps to a specific canonical vocabulary term, return:

{"canonical_answer": "TARGET_NOT_DETECTED", "rejection_reason": "<why the passage does not actually carry the target skill>"}

DO NOT INVENT OR STRETCH to fit a canonical vocabulary term when the passage is primarily descriptive, mood-dominant, characterization-dominant, or symbolically loaded without the target skill being present.

Passages that are rich in atmosphere or description but lack the target skill signal should return TARGET_NOT_DETECTED. This is better than fabricating a tag that the clinical reviewer will have to reject.

PRECISION REQUIREMENT:

When the target skill IS present, select the MOST PRECISE canonical vocabulary term, not the safest or most common. For example in a tone_misreading context:

- "detached" is more precise than "amused" for a passage showing disengagement
- "wry" is more precise than "ironic" for gentle self-deprecation
- "mocking" is more precise than "critical" for overt ridicule

Use the canonical vocabulary at its full granularity. Do not default to the most common term when a more specific term fits.

DISTRACTOR DESIGN:

Each of the three distractors must represent a specific cognitive error:

- One distractor should capture a surface/literal misreading
- One distractor should capture a schema misactivation or over-projection
- One distractor should capture an emotional/mood confound

Each distractor must be from the canonical vocabulary or be a clinically adjacent term. Distractors should be plausible — a student reading carelessly should find them tempting.

OUTPUT FORMAT (strict JSON only, no prose, no markdown):
{
  "canonical_answer": "<term from canonical vocabulary or TARGET_NOT_DETECTED>",
  "distractors": ["<term>", "<term>", "<term>"],
  "keyword_flags": ["<phrase>", "<phrase>", "<phrase>"],
  "difficulty_tier": 1,
  "rejection_reason": "<only if TARGET_NOT_DETECTED, else omit>",
  "clinical_notes": "<brief reasoning>"
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

function parseTagResponse(raw: string): TagResult | TagNotDetected | null {
  const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '');
  const parsed = JSON.parse(cleaned) as {
    canonical_answer: string;
    distractors?: string[];
    keyword_flags?: string[];
    difficulty_tier?: number;
    rejection_reason?: string;
  };

  if (parsed.canonical_answer === 'TARGET_NOT_DETECTED') {
    return {
      targetNotDetected: true,
      reason: parsed.rejection_reason ?? 'target skill not detected',
    };
  }

  return {
    canonical_answer: String(parsed.canonical_answer ?? ''),
    distractors:      Array.isArray(parsed.distractors) ? parsed.distractors.map(String) : [],
    keyword_flags:    Array.isArray(parsed.keyword_flags) ? parsed.keyword_flags.map(String) : [],
    difficulty_tier:  ([1, 2, 3].includes(Number(parsed.difficulty_tier))
      ? Number(parsed.difficulty_tier)
      : 2) as 1 | 2 | 3,
  };
}

export async function tagParagraph(
  para: Paragraph,
  criteria: CriteriaConfig,
): Promise<TagResult | TagNotDetected | null> {
  const prompt = buildTagPrompt(para, criteria);

  try {
    const raw = await callClaude(prompt);
    return parseTagResponse(raw);
  } catch {
    // One retry
    try {
      console.warn('  [tag] first attempt invalid JSON — retrying');
      const raw = await callClaude(RETRY_PREFIX + prompt);
      return parseTagResponse(raw);
    } catch {
      console.warn('  [tag] second attempt also failed — marking tagging_failed');
      return null;
    }
  }
}
