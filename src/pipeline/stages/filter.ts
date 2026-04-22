import Anthropic from '@anthropic-ai/sdk';
import type { CriteriaConfig, FilterResult, Paragraph } from '../types';

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

function buildFilterPrompt(para: Paragraph, criteria: CriteriaConfig): string {
  const mustHave    = criteria.mustHave.length    ? criteria.mustHave.join('; ')    : '(none specified)';
  const mustNotHave = criteria.mustNotHave.length ? criteria.mustNotHave.join('; ') : '(none specified)';

  return `Evaluate whether the following paragraph is suitable for teaching the skill: ${criteria.classification}.

SOURCE CONTEXT (use this to evaluate nonfiction/memoir/biography exclusions — the paragraph itself may not reveal the source type):
Title: ${para.sourceTitle}
Author: ${para.sourceAuthor}

UNIVERSAL EXCLUSION RULES (apply regardless of classification):

Reject any paragraph that:
- Depicts or describes a character experiencing dissociation, psychosis, mania, or another clinical mental-health episode
- Depicts self-harm, suicide ideation, suicide attempt, or related content
- Depicts substance impairment in a clinical or medical frame
- Uses clinical or psychiatric terminology as the dominant mode of description
- Depicts real people's deaths, illnesses, or tragedies in a documentary or biographical frame
- Is nonfiction biographical prose about a real person's life — biographies, autobiographies, eulogies, obituaries, or critical essays about real authors, artists, or historical figures; even if the prose has strong authorial voice, the subject matter is documentary, not fiction
- Is memoir or personal essay describing real lived experiences, real places, or real events in a first-person or third-person documentary frame

These exclusions apply even if the paragraph otherwise matches the classification's criteria. Return suitable: false with reasoning that names the specific exclusion triggered (e.g., "nonfiction biography", "memoir").

CRITERIA:
Target skill: ${criteria.targetSkill || '(not yet specified — use best judgment)'}
Must have: ${mustHave}
Must NOT have: ${mustNotHave}

PARAGRAPH:
${para.text}

Respond in strict JSON only, no prose:
{ "suitable": true|false, "reasoning": "1-2 sentences" }`;
}

export async function filterParagraph(
  para: Paragraph,
  criteria: CriteriaConfig,
): Promise<FilterResult> {
  await sleep(ANTHROPIC_DELAY_MS);

  try {
    const msg = await getClient().messages.create({
      model: MODEL,
      max_tokens: 256,
      system: 'You are a 9th grade literacy intervention specialist.',
      messages: [{ role: 'user', content: buildFilterPrompt(para, criteria) }],
    });

    const rawText = (msg.content[0] as { type: string; text: string }).text.trim();
    // Strip markdown code fences if present (```json ... ``` or ``` ... ```)
    const raw = rawText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '');
    const parsed = JSON.parse(raw) as { suitable: boolean; reasoning: string };
    return { suitable: Boolean(parsed.suitable), reasoning: parsed.reasoning ?? '' };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`  [filter] error (${msg.slice(0, 120)}) — marking not suitable`);
    return { suitable: false, reasoning: 'parse_error' };
  }
}
