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

  return `You are evaluating whether a passage is suitable as a GOGI intervention passage for the target classification: ${criteria.classification}.

A GOGI intervention passage must teach the target cognitive skill to a Title I 9th grade student. The passage must be directly accessible — the student must be able to detect the target skill signal using ONLY content present in the passage itself, plus universal human and social understanding.

SOURCE CONTEXT:
- Source title: ${para.sourceTitle}
- Source author: ${para.sourceAuthor}
- Source year: ${sourceYear}
- Word count: ${para.wordCount}
- Paragraph count: ${para.paragraphCount}

TARGET SKILL DEFINITION:
${criteria.targetSkill || '(not yet specified — use best judgment)'}

CANONICAL VOCABULARY FOR THIS SKILL:
${vocab}

PASSAGE TO EVALUATE:
"""
${para.text}
"""

Evaluate against all five clinical questions. The passage must pass ALL FIVE to be accepted.

Q1 — PRESENCE: Is the target skill signal present in this passage? Can the target cognitive phenomenon be named using the canonical vocabulary above? If no, reject.

Q2 — DOMINANCE: Is the target skill the dominant signal in this passage? The target skill must be the primary cognitive work, not a secondary feature beneath plot action, character emotion, description, or symbolism. If subordinate to another primitive, reject.

Q3 — ACCESSIBILITY (primary architectural criterion): Can a Title I 9th grader detect the target skill signal using ONLY content present in this passage plus universal human/social understanding?

REJECT if the target skill detection requires any of the following external schema:

- Specific historical events the reader must already know UNLESS the event is named AND contextualized within the passage itself
- Named institutions requiring outside knowledge (Court of Chancery, Parliament, specific legal or political systems)
- Biblical, classical, or literary allusions UNLESS the allusion is explained within the passage
- Named landmarks or geographic references requiring outside knowledge
- Novel-level metaphors — symbols or motifs that only function if the reader has read the entire source work
- Cultural registers or codes requiring period-specific social knowledge
- Named historical figures the reader must already know and whose symbolic weight carries the target skill

ACCEPT period-specific content IF AND ONLY IF the passage itself gives the reader what they need to read the target skill.

CRITICAL DISTINCTION — period-flavored vs. schema-gated:

PERIOD-FLAVORED BUT SELF-CONTAINED (ACCEPT):
- Setting is period but irony/tone operates through words on the page
- Period vocabulary exists but is resolvable from sentence context
- Example: "Mr. Dashwood's disappointment was severe; but... he might reasonably hope to live many years... But the fortune, which had been so tardy in coming, was his only one twelvemonth." The "But" pivot and immediate death after hopeful planning carries the irony without knowing inheritance law.
- Example: "they had both been there; and Oliver naturally wondered how they could possibly have found time to be so very industrious." The word "industrious" applied to boys who spent the morning at an execution carries the irony from words on the page alone.

SCHEMA-GATED (REJECT):
- Target skill detection requires knowing specific institutions
- Ironic mechanism lives in allusions not explained in passage
- Example: "at the very heart of the fog, sits the Lord High Chancellor in his High Court of Chancery" — mocking tone REQUIRES knowing what Chancery is and does.

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

Q5 — ITEM CONSTRUCTABILITY: Does this passage support at least ONE standard assessment item pattern?

A passage must contain sufficient evidence DENSITY to construct a useful discrimination item. Evidence density requires:
- At least 2 pointable elements that SUPPORT the target skill signal (quotable from the passage)
- At least 2 pointable elements that DO NOT support the target skill signal (neutral, descriptive, or carry a different signal)

Without this density, a student has nowhere to point as evidence and no foil to discriminate against.

PATTERN ELIGIBILITY:

5a — EVIDENCE DISCRIMINATION (4-option MCQ)
Minimum 3-4 pointable elements: 1-2 target-supporting + 2-3 non-supporting.
A student can be asked: "Which piece of evidence best supports [target skill] in this passage?"
PASS EXAMPLE: Oliver Twist "industrious" — supporting: "Oliver naturally wondered how they could possibly have found time to be so very industrious"; non-supporting: "The Dodger said nothing", "the old gentleman changed the subject", "asking whether there had been much of a crowd at the execution"
PASS EXAMPLE: Douglass "sham" — supporting: "your celebration is a sham", "hollow mockery"; non-supporting: "your prayers and hymns", "your sermons and thanksgivings" (ironized through context but surface-level positive)
FAIL EXAMPLE: Wharton Ethan Frome gravestones — atmosphere and interior thought dominate; fewer than 3-4 discrete pointable evidence elements at distinct signal levels

5b — EVIDENCE MULTI-SELECT (choose-N from 5-8)
Minimum 5-6 pointable elements: 3-4 supporting + 3-4 non-supporting. Requires passage density — usually 2+ paragraphs.
PASS EXAMPLE: Jack London Hobo passage (2 paragraphs) — many discrete sensory/action details, 4+ supporting mood elements, 3+ neutral/contrasting elements
FAIL EXAMPLE: Single short paragraph with only 2-3 discrete elements total

5c — DISCRETE CONCEPT IDENTIFICATION
One dominant, nameable concept + 3 plausible misreading distractors. Student names what the author is doing.
PASS EXAMPLE: Any passage with a clean dominant tone signal where 3 vocabulary-adjacent distractors are genuinely tempting
FAIL EXAMPLE: Passage where the concept is equally plausible as 2-3 different terms (ambiguous dominant signal)

5d — STRUCTURAL/CRAFT ANALYSIS
Identifiable craft features at specific nameable locations (diction shift, structural pivot, syntactic pattern, rhetorical device).
PASS EXAMPLE: "It was the best of times, it was the worst of times" — parallel antithesis, anaphora, identifiable at sentence level
PASS EXAMPLE: Dr. Heidegger opening — ironic understatement in paragraph 1, atmospheric detail accumulation in paragraph 2
FAIL EXAMPLE: Lewis Babbitt mist/mansard — diffused register, no single identifiable craft pivot point

5e — CROSS-TEXT COMPARATIVE (FLAG ONLY — does not affect Q5 pass/fail)
Strong distinctive feature for cross-text pairing. Flag even if Q5 otherwise passes or fails.

Q5 AGGREGATE DECISION:
PASS if supports at least ONE of 5a, 5b, 5c, 5d.
FLAG q5_flag_5e_compatible separately.
FAIL if passes Q1-Q4 but supports none of 5a-5d.

Q5 FAIL EXAMPLES (for calibration):
- Wharton Babbitt mist/mansard: diffused register, no 3-4 discrete pointable elements → FAIL 5a; insufficient density for 5b; ambiguous dominant concept → FAIL 5c; no identifiable craft pivot → FAIL 5d → Q5 FAIL
- Wharton Ethan Frome gravestones: atmosphere + interior monologue dominate; fewer than 4 discrete evidence elements → Q5 FAIL
- Jane Eyre "chidings": single emotional move, only 1-2 discrete elements → Q5 FAIL

EVIDENCE PREVIEW (required in all responses, even Q5 fails — used for review and tag stage):
Identify 2-4 specific quoted phrases or sentences from this passage that would serve as target-supporting evidence elements, and 2-4 that would serve as non-supporting (neutral, contrasting, or different-signal) elements.

OUTPUT FORMAT (strict JSON only, no prose, no markdown):
{
  "decision": "YES",
  "q1_presence": "pass",
  "q2_dominance": "pass",
  "q3_accessibility": "pass",
  "q4_isolation": "pass",
  "q5_item_constructability": "pass",
  "q5_patterns_supported": ["5a", "5c"],
  "q5_flag_5e_compatible": false,
  "primary_rejection_reason": null,
  "schema_dependency_flags": [],
  "evidence_preview": {
    "pointable_target_supporting": ["<quoted phrase 1>", "<quoted phrase 2>"],
    "pointable_non_supporting": ["<quoted phrase 1>", "<quoted phrase 2>"]
  },
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
      max_tokens: 1536,
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
      q5_item_constructability: 'pass' | 'fail';
      q5_patterns_supported: string[];
      q5_flag_5e_compatible: boolean;
      primary_rejection_reason: string | null;
      schema_dependency_flags: string[];
      evidence_preview?: {
        pointable_target_supporting: string[];
        pointable_non_supporting: string[];
      };
      clinical_notes: string;
    };

    const suitable = parsed.decision === 'YES';
    const reasoning = suitable
      ? (parsed.clinical_notes ?? '')
      : (parsed.primary_rejection_reason ?? parsed.clinical_notes ?? '');

    // Log Q breakdown including Q5
    const qSummary = `Q1:${parsed.q1_presence} Q2:${parsed.q2_dominance} Q3:${parsed.q3_accessibility} Q4:${parsed.q4_isolation} Q5:${parsed.q5_item_constructability}`;
    if (!suitable) {
      console.log(`  [filter] NO  ${qSummary} — ${reasoning.slice(0, 100)}`);
    } else {
      const patterns = (parsed.q5_patterns_supported ?? []).join(',') || 'none';
      console.log(`  [filter] YES ${qSummary} — patterns:[${patterns}]${parsed.q5_flag_5e_compatible ? ' 5e-flagged' : ''}`);
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
      q5: parsed.q5_item_constructability,
      q5_patterns_supported: parsed.q5_patterns_supported ?? [],
      q5_flag_5e_compatible: parsed.q5_flag_5e_compatible ?? false,
      evidence_preview: parsed.evidence_preview
        ? {
            pointable_target_supporting: parsed.evidence_preview.pointable_target_supporting ?? [],
            pointable_non_supporting:    parsed.evidence_preview.pointable_non_supporting ?? [],
          }
        : undefined,
      schemaFlags: parsed.schema_dependency_flags ?? [],
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`  [filter] error (${msg.slice(0, 120)}) — marking not suitable`);
    return { suitable: false, reasoning: 'parse_error' };
  }
}
