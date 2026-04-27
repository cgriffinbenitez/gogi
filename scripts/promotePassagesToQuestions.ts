/**
 * GOGI — Passage-to-Question Promotion Bridge
 *
 * Reads approved v3/v4 passages from intervention_passages and generates
 * OMC diagnostic questions for the questions table.
 *
 * This is the promotion bridge — it does NOT touch the existing
 * generateQuestions.ts workflow, which operates within questions directly.
 *
 * Pilot scope: ALL 13 primitives route to ELA.9.R.1.1 (Inferencing and
 * Textual Evidence). Post-pilot expansion to R.1.2/R.1.3/V.1/R.2 will
 * use a primitive_standard_mapping table rather than hardcoded IDs.
 *
 * Usage:
 *   npx tsx scripts/promotePassagesToQuestions.ts
 *   npx tsx scripts/promotePassagesToQuestions.ts --classification tone_misreading
 *   npx tsx scripts/promotePassagesToQuestions.ts --limit 20
 *   npx tsx scripts/promotePassagesToQuestions.ts --classification vocabulary_gap --limit 5 --dry-run
 *
 * Env (from .env.local):
 *   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ANTHROPIC_API_KEY
 */

import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(process.cwd(), '.env.local') });

import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';

// ─── CLI ──────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);

if (args.includes('--help')) {
  console.log(`
Usage: npx tsx scripts/promotePassagesToQuestions.ts [options]

Options:
  --classification <name>   Process only this primitive (e.g. tone_misreading)
  --limit <n>               Max passages to process in this run (default: 50)
  --dry-run                 Fetch and validate passages only — no API calls, no writes

Valid classifications:
  inferencing, evidence_retrieval_failure, topic_vs_theme_confusion,
  structure_purpose_disconnect, comprehension_integration_failure,
  figurative_language_failure, tone_misreading, mood_misreading,
  vocabulary_gap, morphology_gap, syntax_barrier,
  schema_strategy_missing, no_metacognitive_strategy
`);
  process.exit(0);
}

function getArg(flag: string): string | null {
  const idx = args.indexOf(flag);
  return idx !== -1 && args[idx + 1] ? args[idx + 1] : null;
}

const CLASSIFICATION_FILTER = getArg('--classification');
const LIMIT                 = parseInt(getArg('--limit') ?? '50', 10);
const DRY_RUN               = args.includes('--dry-run');

// ─── Constants ────────────────────────────────────────────────────────────────

const CALL_DELAY_MS = 1500;
const MAX_RETRIES   = 2;

// ─── Pilot standard — R.1.1 only ─────────────────────────────────────────────
//
// All 13 primitives route here for the pilot.
// Post-pilot: replace with primitive_standard_mapping table lookup.

const R1_1_STANDARD = {
  id:    '4f374bcc-9ca9-4b15-94cb-3bdd6afe477e',
  code:  'ELA.9.R.1.1',
  title: 'Inferencing and Textual Evidence',
} as const;

// ─── Primitive map ────────────────────────────────────────────────────────────

interface PrimitiveMapping {
  layer:       1 | 2 | 3;
  description: string;
}

const PRIMITIVE_MAP: Record<string, PrimitiveMapping> = {
  // Layer 3 — Core reading construction skills
  inferencing:                      { layer: 3, description: 'Student cannot construct implied meaning from textual clues' },
  evidence_retrieval_failure:        { layer: 3, description: 'Student cannot locate specific textual support for a claim' },
  tone_misreading:                   { layer: 3, description: "Student misreads the author's implied emotional register" },
  mood_misreading:                   { layer: 3, description: 'Student misreads the emotional atmosphere of a passage' },
  figurative_language_failure:       { layer: 3, description: 'Student reads figurative language literally' },
  comprehension_integration_failure: { layer: 3, description: 'Student cannot synthesize information across passage segments' },
  topic_vs_theme_confusion:          { layer: 3, description: 'Student confuses topic (subject) with thematic claim (meaning)' },
  structure_purpose_disconnect:      { layer: 3, description: "Student cannot identify structural pattern or author's purpose" },
  // Layer 2 — Language access prerequisites
  vocabulary_gap:                    { layer: 2, description: 'Student blocked by unfamiliar Tier 2 academic vocabulary' },
  morphology_gap:                    { layer: 2, description: 'Student cannot decode unfamiliar word via morphemic analysis' },
  syntax_barrier:                    { layer: 2, description: 'Student cannot parse a complex sentence structure' },
  // Layer 1 — Schema / metacognitive prerequisites
  schema_strategy_missing:           { layer: 1, description: 'Student lacks activatable background knowledge to approach the text' },
  no_metacognitive_strategy:         { layer: 1, description: 'Student has no comprehension-monitoring or repair strategy' },
};

// ─── Types ────────────────────────────────────────────────────────────────────

interface PassageRecord {
  id:                       string;
  classification:           string;
  paragraph_text:           string;
  word_count:               number;
  source_title:             string | null;
  source_author:            string | null;
  source_year:              number | null;
  intervention_tier:        number;
  target_signal:            string;
  supporting_evidence:      Array<{ element: string; rationale: string }>;
  non_supporting_evidence:  Array<{ element: string; rationale: string }>;
  dominant_concept:         string | null;
  plausible_distractors:    string[] | null;
  craft_features:           Array<{ type: string; location: string; description: string }> | null;
  discrimination_item_type: string;
  tier_rationale:           string;
}

interface OMCResponse {
  question_stem:            string;
  option_a:                 { text: string; classification: string };
  option_b:                 { text: string; classification: string };
  option_c:                 { text: string; classification: string };
  option_d:                 { text: string; classification: string };
  correct_option:           'A' | 'B' | 'C' | 'D';
  cognitive_skill_targeted: string;
  accessibility_concern:    boolean;
  vocabulary_pre_teach:     string[];
  schema_pre_activate:      string | null;
  rationale:                string;
}

// ─── Prompt builders ──────────────────────────────────────────────────────────

// Stable block — cached across all calls in a run.
// Must stay above 1024 tokens to qualify for Sonnet prompt caching.
function buildStableSystemPrompt(): string {
  return `\
You are a clinical literacy assessment designer for 9th-grade Title I ELA students.

## TWO-AXIS ARCHITECTURE

Every question operates on two independent axes that must NEVER be conflated:

**COGNITIVE TIER (1–4):** The analytical demand of the task. Scales with passage craft complexity and the synthesis required. Higher tiers ask students to hold more contradictions, integrate more craft elements, or detect subtler irony.

**LINGUISTIC ACCESSIBILITY:** Fixed at 9th-grade reading level across ALL tiers. This does NOT scale. A Tier 4 question must challenge analytically while remaining linguistically plain. The wall students hit at higher tiers must be a thinking wall, never a word wall.

---

## STUDENT-FACING SURFACE RULES

These rules govern the stem and every answer choice — what a student reads on screen.
The diagnostic backend (classifications, rationale) stays clinical and technical.

### STEM
- Plain, conversational phrasing — write how a good teacher talks, not how a test booklet reads
- Under 30 words
- NO abstract literary terms in the stem: do not write "ironic distance," "register," "rhetorical markers," "ventriloquism," "bathetic," "free indirect discourse," or any AP-prep vocabulary
- Ask about what the author IS DOING or how the passage MAKES YOU FEEL, not about abstract constructs
- Avoid the stock formula "most strongly suggest about the narrator's attitude toward" — it is overused and inaccessible
- Good stem patterns:
    "What does this passage show about how [person] feels about [X]?"
    "The author describes [X] using [plain description of device]. What is he really doing?"
    "How does the author make you feel [X] and [Y] at the same time?"
    "What kind of feeling does this passage give you about [X]?"

These patterns are examples of accessible framings, not a fixed template set. Vary stem construction across the questions you generate. Avoid producing multiple questions that open with identical phrasing. A library where every stem starts with "How does" is just as fatiguing as one where every stem starts with "most strongly suggest."

### ANSWER CHOICES
- One clear sentence each — no compound sentences chained with semicolons
- Under 20 words each, ideally
- 9th-grade vocabulary only: if a student needs to look up a word inside an answer choice, it is too hard
- No em-dashes, no nested subordinate clauses, no qualifying phrases like "neither X nor Y" or "simultaneously acknowledges X while treating Y as Z"
- Each choice must be readable aloud in one breath without stumbling
- Choices MAY and SHOULD quote specific words or phrases from the passage to anchor the reasoning

---

## COGNITIVE TIER DIFFERENTIATION

Use the passage's COGNITIVE_TIER (from the variable block below) to calibrate analytical demand.

**Tier 1 — Foundational**
Analytical task: identify a single, direct tone signal where the surface words point one way and the author clearly means something different.
Distractor design: one distractor captures a student who read too fast and took one word out of context; one captures a student who missed the signal entirely and named what a character feels; one captures a student who read an unfamiliar word wrong.
Stem pattern: "How does the narrator feel about [X]?" / "What does [short quote] tell you about how the author feels?"
Choice pattern: Short, direct statements. No hedging.

**Tier 2 — Developing**
Analytical task: hold two or three tone signals together to name a tone that no single sentence proves alone.
Distractor design: one distractor names a close-but-different tone (sad vs. bitter, amused vs. contemptuous); one distractor takes only the first signal and ignores the rest; one distractor misreads a key word.
Stem pattern: "What kind of attitude does the narrator have toward [X]?" / "What do [several details] together tell you about how the narrator sees [X]?"
Choice pattern: Still simple sentences, but choices are closer to each other — students must discriminate carefully.

**Tier 3 — Proficient**
Analytical task: recognize a split or doubled tone — irony, sarcasm, mock-praise, bittersweet praise — where the surface says one thing and the author means something more complex.
Distractor design: one distractor reads only the surface (misses the irony); one distractor over-corrects (reads everything as negative when the author holds both); one distractor assigns the wrong layer (reads craft as character feeling).
Stem pattern: "The author uses [plain-language description of the move]. What is he really doing?" / "Why does the author [describe action in plain terms]?"
Choice pattern: Choices may be slightly longer to describe the two-layer move, but still in plain language.

**Tier 4 — Advanced**
Analytical task: synthesize tone + at least one other craft element (structure, figurative language, imagery) to name an effect that emerges only from their combination.
Distractor design: one distractor gets one craft element right but misses the integration; one distractor names the tone correctly but misses the structural move; one distractor names the craft element but assigns it the wrong purpose.
Stem pattern: "How does the author make you feel [X] and [Y] at the same time?" / "What does the whole passage do together that no single line does alone?"
Choice pattern: Choices may run up to 22 words at T4. If a choice runs over 20 words, you are likely combining two distinct ideas. Split them into one clearer point or trim modifiers. Length is never an excuse for complexity.

---

## WORKED EXAMPLES — BEFORE/AFTER REWRITES

These show the cognitive demand staying identical while the linguistic demand drops. This is the two-axis principle in practice.

**Tier 1 example — Jack London, cessation of movement passage**

INACCESSIBLE STEM (do not write this):
"Based on this passage, what does the author's description of the Wild — including phrases like 'cessation of movement' — most strongly suggest about the author's attitude toward death and the natural world?"

ACCESSIBLE STEM (write this):
"How does the author feel about death and the wilderness in this passage?"

INACCESSIBLE CHOICE (do not write this):
"The author treats death and the Wild's power with grave, ceremonial seriousness — presenting both as weighty, inevitable forces rather than as causes for grief or outrage."

ACCESSIBLE CHOICE (write this):
"The author sees death as serious and powerful. He is not sad or angry — he is just stating it like a heavy fact."

**Tier 3 example — Melville, 'cheerfully consign ourselves to perdition' passage**

INACCESSIBLE STEM (do not write this):
"Based on this passage, what does the narrator's exclamation 'Ah! how cheerfully we consign ourselves to perdition!' most strongly suggest about his attitude toward people who love being paid?"

ACCESSIBLE STEM (write this):
"The narrator says people 'cheerfully' destroy themselves by loving money. What is he really doing?"

INACCESSIBLE CHOICE (do not write this):
"The narrator is being ironic — he celebrates the joy of being paid while simultaneously acknowledging that loving money leads, by his own stated beliefs, straight to damnation."

ACCESSIBLE CHOICE (write this):
"He is making fun of how people say money is bad but still love getting paid."

Notice: the cognitive demand is identical in both pairs. Recognizing the irony is just as hard. The linguistic demand drops from college-prep to 9th-grade. This is the target for every question you generate.

---

## PASSAGE ACCESSIBILITY GATE

Before writing the question, check the passage on three factors:

1. **Vocabulary density:** More than 3 words that a typical Title I 9th-grader is unlikely to know?
2. **Syntactic complexity:** Sentences longer than 25 words with 3+ embedded clauses?
3. **Required schema:** Does the correct answer require outside knowledge (religious context, historical event, classical allusion) that the passage itself does not supply?

If any factor applies:
- Set \`accessibility_concern: true\`
- \`vocabulary_pre_teach\`: list the 3–5 words a teacher should pre-teach before assigning this question (the hardest words FROM THE PASSAGE, not from your answer choices — your choices must already be accessible)
- \`schema_pre_activate\`: one sentence describing what background knowledge a teacher should activate (e.g. "Puritan beliefs about communal sin and public shame")
- Still generate the question — these fields are for teacher prep, not for blocking the question

If no factor applies: \`accessibility_concern: false\`, \`vocabulary_pre_teach: []\`, \`schema_pre_activate: null\`

---

## OMC STRUCTURE

Every question has exactly 4 options:
- 1 CORRECT option — requires the reading skill being tested
- 1 Layer 1 distractor — schema or metacognitive failure
- 1 Layer 2 distractor — language access failure (vocabulary, morphology, or syntax)
- 1 Layer 3 distractor — reading construction failure (inferencing, evidence, theme, structure, figurative language, tone, or mood)

**LAYER DIVERSITY IS REQUIRED.** Do not assign the same layer to more than one distractor. Three L3 distractors means three students with different breakdowns all get routed to the same intervention — the diagnostic is broken. Every question must have exactly one L1, one L2, one L3 distractor.

The correct answer placement is specified as CORRECT_OPTION_TARGET in the variable block. Place the correct answer at that position exactly — do not choose a different position.

---

## DISTRACTOR DESIGN SPEC — ALL 13 CLASSIFICATION CODES

### Layer 1 — Schema / Metacognitive Prerequisites

**schema_strategy_missing**
Student guesses from surface topic words without engaging the passage's actual context. Their answer reflects an assumption about the topic, not textual evidence.
Distractor: plausible surface-topic guess, unconnected to any specific line in the passage.

**no_metacognitive_strategy**
Student accepts first-pass meaning and never revises. They misread the opening and ignore corrective information that follows.
Distractor: early-passage reading that was never revised; accurate to the opening, wrong about the whole.

### Layer 2 — Language Access Prerequisites

**vocabulary_gap**
Student substitutes a familiar-sounding meaning for an unfamiliar Tier 2 word. Comprehension breaks at the word level.
Distractor: answer that would be correct IF the key vocabulary word meant what the student assumed.

**morphology_gap**
Student guesses meaning from partial recognition of one morpheme in a complex word.
Distractor: answer derived from that partial morpheme recognition.

**syntax_barrier**
Student cannot parse embedded clauses or inverted syntax and loses the grammatical subject-verb relationship.
Distractor: answer reflecting a misparse of the sentence structure.

### Layer 3 — Core Reading Construction Skills

**inferencing**
Student reads only the literal surface. The correct answer requires a conclusion the author intends but never states.
Distractor: a literally stated detail — correct as a fact, wrong as an inference.

**evidence_retrieval_failure**
Student substitutes a general impression for specific textual evidence.
Distractor: an accurate general statement about the passage that doesn't address the specific evidence target.

**comprehension_integration_failure**
Student reads segment by segment and cannot build a unified meaning.
Distractor: answer true of ONE part of the passage but wrong when the full passage is integrated.

**topic_vs_theme_confusion**
Student names the topic (one or two words) instead of the theme (a complete claim about human experience).
Distractor: a topic label presented as a theme.

**structure_purpose_disconnect**
Student identifies content but not structure or authorial purpose.
Distractor: a content summary or topic identification presented as a structural observation.

**figurative_language_failure**
Student reads figurative language literally, extracting the vehicle but missing the tenor.
Distractor: a literal reading that makes surface sense but misses the figure's meaning.

**tone_misreading**
Student misidentifies the author's attitude. Common errors: reads irony as sincerity, detachment as warmth, gentle criticism as praise.
Distractor: the tone label a student assigns from surface word choices without attending to authorial distance.

**mood_misreading**
Student reports what a character feels (plot emotion) rather than what the passage makes the reader feel (textual mood).
Distractor: a mood label derived from what a character explicitly expresses.

---

## QUALITY RULES
1. Stem must require the target skill — never ask for a fact literally stated in the passage
2. Correct answer must be directly defensible from the passage's own words
3. Each distractor must be plausible to a student with exactly that cognitive gap
4. No distractor should be obviously wrong to any reasonably engaged reader
5. Distractor classification must match the actual reasoning failure pattern above
6. Student-facing language (stem + all choices) stays at 9th-grade reading level — always, every tier
7. Cognitive demand scales with tier; linguistic demand does not

## OUTPUT FORMAT
Valid JSON only — no markdown, no explanation before or after:
{
  "question_stem": string,
  "option_a": { "text": string, "classification": string },
  "option_b": { "text": string, "classification": string },
  "option_c": { "text": string, "classification": string },
  "option_d": { "text": string, "classification": string },
  "correct_option": "B" | "C",
  "cognitive_skill_targeted": string,
  "accessibility_concern": boolean,
  "vocabulary_pre_teach": string[],
  "schema_pre_activate": string | null,
  "rationale": string
}

"correct_option" MUST exactly match CORRECT_OPTION_TARGET from the variable block.

"rationale": 2–3 sentences for teacher/designer review — (1) what the correct answer requires from the text, (2) the specific cognitive gap each distractor exploits, (3) how the v3 metadata shaped your choices. Rationale may use technical literary terms; it is never shown to students.`;
}

// Variable block — per passage. NOT cached.
function buildVariableBlock(
  passage: PassageRecord,
  mapping: PrimitiveMapping,
  correctOptionTarget: 'B' | 'C',
): string {
  const evidence = (passage.supporting_evidence ?? [])
    .map((e) => `  • "${e.element}" — ${e.rationale}`)
    .join('\n') || '  (none tagged)';

  const nonEvidence = (passage.non_supporting_evidence ?? [])
    .map((e) => `  • "${e.element}" — ${e.rationale}`)
    .join('\n') || '  (none tagged)';

  const craftStr = passage.craft_features?.length
    ? passage.craft_features.map((c) => `  • [${c.type}] at ${c.location}: ${c.description}`).join('\n')
    : '  (none tagged)';

  const distractorStr = passage.plausible_distractors?.length
    ? passage.plausible_distractors.map((d) => `  • ${d}`).join('\n')
    : '  (none tagged)';

  return `\
PASSAGE SOURCE
Title:  ${passage.source_title ?? 'Unknown'}
Author: ${passage.source_author ?? 'Unknown'}
Year:   ${passage.source_year ?? 'Unknown'}

COGNITIVE_TIER: ${passage.intervention_tier} of 4
  (1 = foundational one-signal, 2 = multi-signal, 3 = irony/split-tone, 4 = multi-craft synthesis)

CORRECT_OPTION_TARGET: ${correctOptionTarget}
  Place the correct answer at option ${correctOptionTarget} exactly.

CLASSIFICATION
Primitive:             ${passage.classification}
Layer:                 ${mapping.layer} — ${mapping.description}
Discrimination level:  ${passage.discrimination_item_type}

V3 METADATA — use this to ground question and distractor construction

TARGET SIGNAL (what the correct answer must demonstrate):
  ${passage.target_signal}

SUPPORTING EVIDENCE (textual points that prove the correct answer):
${evidence}

NON-SUPPORTING EVIDENCE (plausible-looking but wrong details — use for distractors):
${nonEvidence}

DOMINANT CONCEPT:
  ${passage.dominant_concept ?? '(none tagged)'}

PLAUSIBLE DISTRACTORS (pipeline suggestions — treat as candidates, not requirements):
${distractorStr}

CRAFT FEATURES:
${craftStr}

TIER RATIONALE:
  ${passage.tier_rationale}

STANDARD: ${R1_1_STANDARD.code} — ${R1_1_STANDARD.title}`;
}

function buildUserMessage(passage: PassageRecord): string {
  return `PASSAGE:\n${passage.paragraph_text}\n\nGenerate the OMC diagnostic question for this passage.`;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((res) => setTimeout(res, ms));
}

function parseJson<T>(raw: string): T {
  const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  return JSON.parse(cleaned) as T;
}

function validateOMC(r: OMCResponse, correctOptionTarget: 'B' | 'C'): string | null {
  if (!r.question_stem)            return 'missing question_stem';
  if (!r.option_a?.text)           return 'missing option_a.text';
  if (!r.option_b?.text)           return 'missing option_b.text';
  if (!r.option_c?.text)           return 'missing option_c.text';
  if (!r.option_d?.text)           return 'missing option_d.text';
  if (!r.option_a?.classification) return 'missing option_a.classification';
  if (!r.option_b?.classification) return 'missing option_b.classification';
  if (!r.option_c?.classification) return 'missing option_c.classification';
  if (!r.option_d?.classification) return 'missing option_d.classification';
  if (!['A', 'B', 'C', 'D'].includes(r.correct_option))
    return `invalid correct_option: ${r.correct_option}`;
  if (r.correct_option !== correctOptionTarget)
    return `correct_option mismatch: expected ${correctOptionTarget}, got ${r.correct_option}`;
  if (!r.cognitive_skill_targeted) return 'missing cognitive_skill_targeted';
  if (!r.rationale)                return 'missing rationale';
  return null;
}

// Warn if any two wrong-answer distractors share a classification code.
// This breaks triage: a student who picks any wrong answer routes to the same intervention.
function warnDuplicateDistractors(
  r: OMCResponse,
  prefix: string,
): void {
  const wrongClasses = (['a', 'b', 'c', 'd'] as const)
    .filter((opt) => opt !== r.correct_option.toLowerCase())
    .map((opt) => r[`option_${opt}`].classification);
  const seen = new Set<string>();
  const dupes = wrongClasses.filter((c) => {
    if (seen.has(c)) return true;
    seen.add(c);
    return false;
  });
  if (dupes.length > 0) {
    console.warn(
      `${prefix} ⚠  duplicate distractor class(es): [${wrongClasses.join(', ')}] ` +
      `— all three wrong answers may route to the same intervention`,
    );
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('❌  Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }
  if (!anthropicKey) {
    console.error('❌  Missing ANTHROPIC_API_KEY');
    process.exit(1);
  }

  const supabase  = createClient(supabaseUrl, supabaseKey);
  const anthropic = new Anthropic({ apiKey: anthropicKey, timeout: 90_000 });

  // ── Banner ──────────────────────────────────────────────────────────────────

  console.log('\n' + '═'.repeat(68));
  console.log('  GOGI — Passage → Question Promotion Bridge');
  console.log('═'.repeat(68));
  console.log(`  classification: ${CLASSIFICATION_FILTER ?? 'ALL'}`);
  console.log(`  limit:          ${LIMIT}`);
  console.log(`  dry-run:        ${DRY_RUN}`);
  console.log(`  standard:       ${R1_1_STANDARD.code} (pilot scope — all primitives)`);
  console.log('═'.repeat(68) + '\n');

  // ── Fetch promotion queue ───────────────────────────────────────────────────

  let query = supabase
    .from('intervention_passages')
    .select([
      'id', 'classification', 'paragraph_text', 'word_count',
      'source_title', 'source_author', 'source_year',
      'intervention_tier', 'target_signal',
      'supporting_evidence', 'non_supporting_evidence',
      'dominant_concept', 'plausible_distractors', 'craft_features',
      'discrimination_item_type', 'tier_rationale',
    ].join(', '))
    .in('approval_status', ['approved', 'pending_review'])
    .in('pipeline_version', ['v3', 'v4'])
    .or('question_generated.is.null,question_generated.eq.false')
    .order('created_at', { ascending: true })
    .limit(LIMIT);

  if (CLASSIFICATION_FILTER) {
    query = query.eq('classification', CLASSIFICATION_FILTER);
  }

  const { data, error: fetchErr } = await query;
  if (fetchErr) {
    console.error('❌  Fetch failed:', fetchErr.message);
    process.exit(1);
  }

  const passages = (data ?? []) as PassageRecord[];

  if (passages.length === 0) {
    console.log('Promotion queue is empty — nothing to do.\n');
    return;
  }

  console.log(`Found ${passages.length} passage(s) in promotion queue.\n`);

  // ── Build stable system prompt once (cached across all calls) ───────────────

  const stableSystem = buildStableSystemPrompt();

  // ── Stats ───────────────────────────────────────────────────────────────────

  let promoted       = 0;
  let failed         = 0;
  let skipped        = 0;
  let totalCalls     = 0;
  let cacheReadTotal = 0;
  let inputTotal     = 0;

  // ── Process ─────────────────────────────────────────────────────────────────

  for (let i = 0; i < passages.length; i++) {
    const p       = passages[i];
    const mapping = PRIMITIVE_MAP[p.classification];
    const prefix  = `  [${i + 1}/${passages.length}]`;

    if (!mapping) {
      console.log(`${prefix} ⚠  Unknown classification "${p.classification}" — skipping`);
      skipped++;
      continue;
    }

    if (DRY_RUN) {
      console.log(`${prefix} DRY RUN — ${p.classification} tier ${p.intervention_tier} | passage ${p.id}`);
      skipped++;
      continue;
    }

    if (i > 0) await sleep(CALL_DELAY_MS);

    // Randomize correct option placement 50/50 B or C to eliminate position bias.
    const correctOptionTarget: 'B' | 'C' = Math.random() < 0.5 ? 'B' : 'C';

    const variableBlock = buildVariableBlock(p, mapping, correctOptionTarget);
    const userMessage   = buildUserMessage(p);
    let parsed: OMCResponse | null = null;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        totalCalls++;
        const msg = await anthropic.messages.create({
          model:      'claude-sonnet-4-6',
          max_tokens: 2048,
          system: [
            { type: 'text', text: stableSystem, cache_control: { type: 'ephemeral' } },
            { type: 'text', text: variableBlock },
          ],
          messages: [{ role: 'user', content: userMessage }],
        });

        const usage = msg.usage as {
          input_tokens: number; output_tokens: number;
          cache_read_input_tokens?: number; cache_creation_input_tokens?: number;
        };
        cacheReadTotal += usage.cache_read_input_tokens ?? 0;
        inputTotal     += usage.input_tokens
                        + (usage.cache_read_input_tokens  ?? 0)
                        + (usage.cache_creation_input_tokens ?? 0);

        parsed = parseJson<OMCResponse>(
          (msg.content[0] as { type: string; text: string }).text,
        );
        break;
      } catch (err) {
        if (attempt === MAX_RETRIES) {
          console.log(`${prefix} ❌  Claude call failed: ${(err as Error).message}`);
          failed++;
        }
      }
    }

    if (!parsed) continue;

    const validErr = validateOMC(parsed, correctOptionTarget);
    if (validErr) {
      console.log(`${prefix} ❌  Validation: ${validErr}`);
      failed++;
      continue;
    }

    warnDuplicateDistractors(parsed, prefix);

    if (parsed.accessibility_concern) {
      const preTeach = parsed.vocabulary_pre_teach.join(', ') || '(none listed)';
      console.log(`${prefix} 📚  accessibility_concern — pre-teach: [${preTeach}]`);
      if (parsed.schema_pre_activate) {
        console.log(`${prefix}     schema: ${parsed.schema_pre_activate}`);
      }
    }

    // ── Build content field (matches existing questions table format) ──────────

    const accessibilityLines = parsed.accessibility_concern
      ? `\nACCESSIBILITY_CONCERN: true` +
        (parsed.vocabulary_pre_teach.length
          ? `\nVOCABULARY_PRE_TEACH: ${parsed.vocabulary_pre_teach.join(', ')}`
          : '') +
        (parsed.schema_pre_activate
          ? `\nSCHEMA_PRE_ACTIVATE: ${parsed.schema_pre_activate}`
          : '')
      : '';

    const questionBlock =
      '\n\n---\n\n' +
      `QUESTION: ${parsed.question_stem}\n\n` +
      `A. ${parsed.option_a.text}\n` +
      `B. ${parsed.option_b.text}\n` +
      `C. ${parsed.option_c.text}\n` +
      `D. ${parsed.option_d.text}\n\n` +
      `CORRECT: ${parsed.correct_option}\n` +
      `DIAGNOSTIC_CLASSIFICATION_A: ${parsed.option_a.classification}\n` +
      `DIAGNOSTIC_CLASSIFICATION_B: ${parsed.option_b.classification}\n` +
      `DIAGNOSTIC_CLASSIFICATION_C: ${parsed.option_c.classification}\n` +
      `DIAGNOSTIC_CLASSIFICATION_D: ${parsed.option_d.classification}\n` +
      `COGNITIVE_SKILL: ${parsed.cognitive_skill_targeted}` +
      accessibilityLines;

    // ── Insert into questions ──────────────────────────────────────────────────

    const { data: inserted, error: insertErr } = await supabase
      .from('questions')
      .insert([{
        standard_id:              R1_1_STANDARD.id,
        content:                  p.paragraph_text + questionBlock,
        title:                    p.source_title,
        author:                   p.source_author,
        pub_year:                 p.source_year?.toString() ?? null,
        cognitive_skill_targeted: parsed.cognitive_skill_targeted,
        difficulty_level:         p.intervention_tier,
        option_a_text:            parsed.option_a.text,
        option_b_text:            parsed.option_b.text,
        option_c_text:            parsed.option_c.text,
        option_d_text:            parsed.option_d.text,
        option_a_class:           parsed.option_a.classification,
        option_b_class:           parsed.option_b.classification,
        option_c_class:           parsed.option_c.classification,
        option_d_class:           parsed.option_d.classification,
        correct_option:           parsed.correct_option,
        rationale:                parsed.rationale,
        approved:                 false,
        flagged:                  false,
        pipeline_source:          'v3_promoted',
        source_classification:    p.classification,
      }])
      .select('id')
      .single();

    if (insertErr) {
      console.log(`${prefix} ❌  DB insert failed: ${insertErr.message}`);
      failed++;
      continue;
    }

    // ── Mark source passage as promoted ───────────────────────────────────────

    const { error: markErr } = await supabase
      .from('intervention_passages')
      .update({ question_generated: true })
      .eq('id', p.id);

    if (markErr) {
      // Non-fatal: the question exists. A follow-up run will not re-promote
      // because the questions row already exists — but question_generated won't
      // be set so the passage will appear in the queue again. Log clearly.
      console.warn(`${prefix} ⚠   question written but passage mark failed: ${markErr.message}`);
    }

    console.log(
      `${prefix} ✅  Generated question for passage ${p.id} ` +
      `(${p.classification}, tier ${p.intervention_tier}) → question ${inserted.id}`,
    );
    console.log(
      `         ${R1_1_STANDARD.code} | correct=${parsed.correct_option} | ` +
      `${parsed.question_stem.slice(0, 70)}${parsed.question_stem.length > 70 ? '…' : ''}`,
    );
    promoted++;
  }

  // ── Summary ─────────────────────────────────────────────────────────────────

  const hitRate = totalCalls > 0
    ? ((cacheReadTotal / inputTotal) * 100).toFixed(1)
    : '—';

  console.log('\n' + '═'.repeat(68));
  console.log(`  Promoted:         ${promoted}`);
  console.log(`  Failed:           ${failed}`);
  console.log(`  Skipped:          ${skipped}`);
  console.log(`  API calls:        ${totalCalls}`);
  console.log(`  Cache hit rate:   ${hitRate}%`);
  console.log(`  Total input tokens (approx): ${inputTotal.toLocaleString()}`);
  if (DRY_RUN) console.log('\n  [DRY RUN — no writes performed]');
  console.log('═'.repeat(68) + '\n');

  if (promoted > 0 && !DRY_RUN) {
    console.log(`Review at /admin/questions — ${promoted} new question(s) pending approval.\n`);
  }
}

main().catch((err) => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
