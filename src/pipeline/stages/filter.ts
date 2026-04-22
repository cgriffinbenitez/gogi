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
  const vocab = criteria.canonicalVocabulary?.length
    ? criteria.canonicalVocabulary.join(', ')
    : '(none specified for this classification)';
  const sourceYear = para.sourceYear ? String(para.sourceYear) : 'unknown';

  return `You are evaluating whether a paragraph is suitable as a GOGI intervention passage for the target classification: ${criteria.classification}.

A GOGI intervention passage must teach the target cognitive skill to a Title I 9th grade student. The passage must be directly accessible — the student must be able to detect the target skill signal using ONLY content present in the passage itself, plus universal human and social understanding.

SOURCE CONTEXT:
- Source title: ${para.sourceTitle}
- Source author: ${para.sourceAuthor}
- Source year: ${sourceYear}

TARGET SKILL DEFINITION:
${criteria.targetSkill || '(not yet specified — use best judgment)'}

CANONICAL VOCABULARY FOR THIS SKILL:
${vocab}

PARAGRAPH TO EVALUATE:
"""
${para.text}
"""

Evaluate against all four clinical questions. The passage must pass ALL FOUR to be accepted.

Q1 — PRESENCE: Is the target skill signal present in this passage? Can the target cognitive phenomenon be named using the canonical vocabulary above? If no, reject.

Q2 — DOMINANCE: Is the target skill the dominant signal in this passage? The target skill must be the primary cognitive work, not a secondary feature beneath plot action, character emotion, description, or symbolism. If subordinate to another primitive, reject.

Q3 — ACCESSIBILITY (primary architectural criterion): Can a Title I 9th grader detect the target skill signal using ONLY content present in this passage plus universal human/social understanding?

REJECT if the target skill detection requires any of the following external schema:

- Specific historical events the reader must already know (French Revolution, Civil War, specific wars, specific political movements) UNLESS the event is named AND contextualized within the passage itself
- Named institutions requiring outside knowledge (Court of Chancery, Parliament, specific legal or political systems, specific religious institutions)
- Biblical, classical, or literary allusions UNLESS the allusion is explained within the passage
- Named landmarks, monuments, or geographic references requiring outside knowledge (Temple Bar, Canterbury, specific historical sites)
- Novel-level metaphors — symbols or motifs that only function if the reader has read the entire source work (e.g., fog-as-legal-opacity in Bleak House, whiteness-as-obsession in Moby Dick)
- Cultural registers or codes requiring period-specific social knowledge (Victorian mourning conventions, Regency courtship rules, specific class markers)
- Named historical figures the reader must already know and whose symbolic weight carries the target skill

ACCEPT period-specific content IF AND ONLY IF the passage itself gives the reader what they need to read the target skill. Examples:

- ACCEPTABLE: period vocabulary (e.g., "needlework," "twelvemonth") where context makes the meaning and tonal function clear
- ACCEPTABLE: period social dynamics (e.g., flattery met with indifference, social pressure, familial obligation) where the dynamic itself is universal
- ACCEPTABLE: period setting that is inferable or irrelevant to target skill detection
- REJECT: period setting where the target skill detection DEPENDS on knowing how the period worked

THE ACID TEST: If you were to hand this passage to a Title I 9th grader cold, with no pre-teaching and no context, could they detect the target skill using only what is written in the passage? If detection requires outside knowledge the student almost certainly does not have, REJECT.

CRITICAL DISTINCTION — period-flavored vs. schema-gated:

Many great passages have period setting, period vocabulary, or period social context. This is NOT automatically a Q3 failure. The question is whether the target skill detection DEPENDS on outside schema, or whether the target skill mechanism fires from words on the page regardless of period context.

PERIOD-FLAVORED BUT SELF-CONTAINED (ACCEPT):
- Setting is period but irony/tone operates through words on the page
- Period vocabulary exists but is resolvable from sentence context
- Historical context enriches reading but ironic mechanism works without it
- Example: "Mr. Dashwood's disappointment was severe; but... he might reasonably hope to live many years... But the fortune, which had been so tardy in coming, was his only one twelvemonth." The "But" pivot and immediate death after hopeful planning carries the irony. "Twelvemonth" is period vocabulary but context-resolvable. Inheritance law enriches but is not required — a student reads "he hoped to live many years... he died shortly after" and feels the structural irony.
- Example: "they had both been there; and Oliver naturally wondered how they could possibly have found time to be so very industrious." The word "industrious" applied to boys who spent the morning at an execution carries the irony. Victorian child labor context enriches but is not required — a student reads "they went to the execution" + "wondered how they found time to be industrious" and feels the gap.

SCHEMA-GATED (REJECT):
- Target skill detection requires knowing specific institutions
- Ironic mechanism lives in allusions not explained in passage
- Tone carrier is a novel-level symbol requiring whole-book context
- Example: "at the very heart of the fog, sits the Lord High Chancellor in his High Court of Chancery" — mocking tone REQUIRES knowing what Chancery is and does. Without that schema, student reads only atmospheric description. The tonal mechanism does not fire from words on the page alone.
- Example: "the lords of the State preserves of loaves and fishes" — ironic stance REQUIRES recognizing Biblical allusion + institutional critique. Without that schema, student reads only period political language. The tonal mechanism does not fire without outside knowledge.

THE REFINED ACID TEST:
Ask: "If I removed all outside context — if the student knew nothing about the historical period, the institutions, the allusions — would the words on the page STILL carry the target skill signal?"

- If YES: period-flavored but self-contained. ACCEPT on Q3.
- If NO: schema-gated. REJECT on Q3.

When in doubt, REJECT. False negatives are recoverable. False positives contaminate training data.

Q4 — CLEAN ISOLATION: Does the passage isolate the target skill without heavy cognitive overload from other primitives (severe syntax barrier, dense unrelated figurative language, vocabulary density that would block access)? If the passage is cognitively overloaded, reject.

ADDITIONAL FORMAT EXCLUSIONS:
- REJECT play/drama dialogue format (paragraphs beginning with "CHARACTER NAME." or "CHARACTER NAME:" patterns)
- REJECT verse/poetry when prose is expected
- REJECT biographical, memoir, or first-person nonfiction unless explicitly permitted for this classification
- REJECT passages containing historically harmful racial, ethnic, or gender language that would cause student harm in a Title I cohort (regardless of historical context)

OUTPUT FORMAT (strict JSON only, no prose, no markdown):
{
  "decision": "YES",
  "q1_presence": "pass",
  "q2_dominance": "pass",
  "q3_accessibility": "pass",
  "q4_isolation": "pass",
  "primary_rejection_reason": null,
  "schema_dependency_flags": [],
  "clinical_notes": "brief reasoning"
}`;
}

export async function filterParagraph(
  para: Paragraph,
  criteria: CriteriaConfig,
): Promise<FilterResult> {
  await sleep(ANTHROPIC_DELAY_MS);

  try {
    const msg = await getClient().messages.create({
      model: MODEL,
      max_tokens: 512,
      system: 'You are a 9th grade literacy intervention specialist applying clinical passage evaluation criteria.',
      messages: [{ role: 'user', content: buildFilterPrompt(para, criteria) }],
    });

    const rawText = (msg.content[0] as { type: string; text: string }).text.trim();
    const raw = rawText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '');
    const parsed = JSON.parse(raw) as {
      decision: 'YES' | 'NO';
      q1_presence: 'pass' | 'fail';
      q2_dominance: 'pass' | 'fail';
      q3_accessibility: 'pass' | 'fail';
      q4_isolation: 'pass' | 'fail';
      primary_rejection_reason: string | null;
      schema_dependency_flags: string[];
      clinical_notes: string;
    };

    const suitable = parsed.decision === 'YES';
    const reasoning = suitable
      ? (parsed.clinical_notes ?? '')
      : (parsed.primary_rejection_reason ?? parsed.clinical_notes ?? '');

    // Log Q breakdown and schema flags
    const qSummary = `Q1:${parsed.q1_presence} Q2:${parsed.q2_dominance} Q3:${parsed.q3_accessibility} Q4:${parsed.q4_isolation}`;
    if (!suitable) {
      console.log(`  [filter] NO  ${qSummary} — ${reasoning.slice(0, 100)}`);
    }
    if (parsed.schema_dependency_flags?.length) {
      console.log(`  [filter] schema-flags: ${parsed.schema_dependency_flags.join('; ')}`);
    }

    return {
      suitable,
      reasoning,
      q1: parsed.q1_presence,
      q2: parsed.q2_dominance,
      q3: parsed.q3_accessibility,
      q4: parsed.q4_isolation,
      schemaFlags: parsed.schema_dependency_flags ?? [],
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`  [filter] error (${msg.slice(0, 120)}) — marking not suitable`);
    return { suitable: false, reasoning: 'parse_error' };
  }
}
