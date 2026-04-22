import Anthropic from '@anthropic-ai/sdk';
import type { CriteriaConfig, Paragraph, TagNotDetected, TagResultV3 } from '../types';

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

function buildTagPrompt(
  para: Paragraph,
  criteria: CriteriaConfig,
  q5PatternsSupported: string[],
): string {
  const vocab = criteria.canonicalVocabulary?.length
    ? criteria.canonicalVocabulary.join(', ')
    : '(none specified — use best clinical judgment)';

  const patternsStr = q5PatternsSupported.length
    ? q5PatternsSupported.join(', ')
    : 'unknown — derive from passage';

  return `You are generating v3 evidence-discrimination tags for a GOGI intervention passage. Classification: ${criteria.classification}.

CANONICAL VOCABULARY (target_signal MUST come from this list):
${vocab}

PASSAGE METADATA:
- Word count: ${para.wordCount}
- Paragraph count: ${para.paragraphCount}
- Q5 patterns identified at filter stage: ${patternsStr}

PASSAGE:
"""
${para.text}
"""

YOUR TASKS:

1. TARGET SIGNAL: Identify the single most precise canonical term that names the target skill signal in this passage. Be precise — "detached" over "ironic" if the passage shows authorial distance; "mocking" over "critical" if the stance is ridicule rather than reasoned critique.

2. SUPPORTING EVIDENCE (2-4 items): Quote specific phrases or sentences from the passage that support the target skill signal. For each, explain why it supports (rationale). These become the correct-answer options in discrimination items.

3. NON-SUPPORTING EVIDENCE (2-4 items): Quote specific phrases or sentences from the passage that do NOT support the target skill, or that could mislead a student (surface-level description, character emotion, neutral action). For each, explain what it actually does (rationale). These become the distractor options in discrimination items.

4. DOMINANT CONCEPT + DISTRACTORS (if 5c is in q5_patterns_supported):
   - dominant_concept: the single nameable concept the author is deploying (same as target_signal for tone/mood)
   - plausible_distractors: 3 terms from canonical vocabulary that a careless reader might choose instead. Design for cognitive error types:
     * One distractor captures a surface/literal misreading
     * One captures a schema misactivation or over-projection
     * One captures an emotional/mood confound with author attitude

5. CRAFT FEATURES (if 5d is in q5_patterns_supported): Array of specific, nameable craft features at identifiable locations in the passage. Each needs:
   - type: name of the device (e.g., "ironic understatement", "parallel antithesis", "syntactic inversion", "structural pivot")
   - location: specific location in the passage (e.g., "final sentence", "opening clause", "second paragraph")
   - description: what the device does and why it matters for the target skill

6. DISCRIMINATION ITEM TYPE: At what level does this passage operate?
   - "phrase_level": target skill signal operates through individual word choice or short phrase
   - "sentence_level": target skill signal requires reading a complete sentence in context
   - "paragraph_level": target skill signal requires tracking across multiple sentences or paragraphs

7. INTERVENTION TIER: Assign a tier based on word count, paragraph count, and complexity:
   - Tier 1 (Foundation): 40-150 words, 1 paragraph, maximally accessible
   - Tier 2 (Guided Practice): 100-300 words, 1-2 paragraphs, requires sustained reading
   - Tier 3 (Independent Practice): 200-500 words, 2-3 paragraphs, more distributed signal
   - Tier 4 (Transfer/Assessment): 400-800 words, 3-5 paragraphs, full-passage complexity

   Word count is primary criterion. May adjust upward by one tier if syntax/vocabulary complexity is unusually high for the word count range. Provide tier_rationale.

CRITICAL — NULL ESCAPE HATCH:
If you cannot confidently construct 2+ supporting evidence elements AND 2+ non-supporting elements, return:
{"target_signal": "TARGET_NOT_DETECTED", "rejection_reason": "<why evidence sets cannot be constructed>"}

DO NOT fabricate evidence. If the passage lacks sufficient evidence density for a discrimination item, return TARGET_NOT_DETECTED. This is better than tagging a passage that cannot generate a valid assessment item.

OUTPUT FORMAT (strict JSON only, no prose, no markdown):
{
  "target_signal": "<canonical term or TARGET_NOT_DETECTED>",
  "item_patterns_supported": ["5a", "5c"],
  "supporting_evidence": [
    {"element": "<quoted text>", "rationale": "<why this supports target signal>"},
    {"element": "<quoted text>", "rationale": "<why this supports target signal>"}
  ],
  "non_supporting_evidence": [
    {"element": "<quoted text>", "rationale": "<what else this does>"},
    {"element": "<quoted text>", "rationale": "<what else this does>"}
  ],
  "dominant_concept": "<string, only if 5c supported — omit otherwise>",
  "plausible_distractors": ["<d1>", "<d2>", "<d3>"],
  "craft_features": [
    {"type": "<device name>", "location": "<where in passage>", "description": "<what it does>"}
  ],
  "discrimination_item_type": "sentence_level",
  "intervention_tier": 1,
  "tier_rationale": "<brief explanation of tier assignment>",
  "clinical_notes": "<brief overall reasoning>"
}

Note: Include "craft_features" only if 5d is in item_patterns_supported. Include "dominant_concept" and "plausible_distractors" only if 5c is in item_patterns_supported. Omit rejection_reason unless returning TARGET_NOT_DETECTED.`;
}

const RETRY_PREFIX =
  'IMPORTANT: Your previous response was not valid JSON. Return valid JSON only, no markdown, no explanation.\n\n';

async function callClaude(prompt: string): Promise<string> {
  await sleep(ANTHROPIC_DELAY_MS);
  const msg = await getClient().messages.create({
    model: MODEL,
    max_tokens: 1024,
    system: 'You are tagging a passage for a literacy intervention teach page.',
    messages: [{ role: 'user', content: prompt }],
  });
  return (msg.content[0] as { type: string; text: string }).text.trim();
}

function parseTagResponse(raw: string): TagResultV3 | TagNotDetected | null {
  const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '');
  const parsed = JSON.parse(cleaned) as {
    target_signal: string;
    rejection_reason?: string;
    item_patterns_supported?: string[];
    supporting_evidence?: Array<{ element: string; rationale: string }>;
    non_supporting_evidence?: Array<{ element: string; rationale: string }>;
    dominant_concept?: string;
    plausible_distractors?: string[];
    craft_features?: Array<{ type: string; location: string; description: string }>;
    discrimination_item_type?: string;
    intervention_tier?: number;
    tier_rationale?: string;
  };

  if (parsed.target_signal === 'TARGET_NOT_DETECTED') {
    return {
      targetNotDetected: true,
      reason: parsed.rejection_reason ?? 'evidence sets could not be constructed',
    };
  }

  const tier = [1, 2, 3, 4].includes(Number(parsed.intervention_tier))
    ? (Number(parsed.intervention_tier) as 1 | 2 | 3 | 4)
    : 1;

  return {
    target_signal:            String(parsed.target_signal ?? ''),
    item_patterns_supported:  Array.isArray(parsed.item_patterns_supported) ? parsed.item_patterns_supported.map(String) : [],
    supporting_evidence:      Array.isArray(parsed.supporting_evidence) ? parsed.supporting_evidence : [],
    non_supporting_evidence:  Array.isArray(parsed.non_supporting_evidence) ? parsed.non_supporting_evidence : [],
    dominant_concept:         parsed.dominant_concept ? String(parsed.dominant_concept) : undefined,
    plausible_distractors:    Array.isArray(parsed.plausible_distractors) ? parsed.plausible_distractors.map(String) : undefined,
    craft_features:           Array.isArray(parsed.craft_features) ? parsed.craft_features : undefined,
    discrimination_item_type: (['phrase_level', 'sentence_level', 'paragraph_level'].includes(parsed.discrimination_item_type ?? '')
      ? parsed.discrimination_item_type
      : 'sentence_level') as 'phrase_level' | 'sentence_level' | 'paragraph_level',
    intervention_tier: tier,
    tier_rationale:    String(parsed.tier_rationale ?? ''),
  };
}

export async function tagParagraph(
  para: Paragraph,
  criteria: CriteriaConfig,
  q5PatternsSupported: string[] = [],
): Promise<TagResultV3 | TagNotDetected | null> {
  const prompt = buildTagPrompt(para, criteria, q5PatternsSupported);

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
