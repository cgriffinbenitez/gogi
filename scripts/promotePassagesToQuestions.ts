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
  rationale:                string;
}

// ─── Prompt builders ──────────────────────────────────────────────────────────

// Stable block (~1600 tokens) — cached across all calls in a run.
// Contains the full OMC spec and Distractor Design Spec.
// Must stay above 1024 tokens to qualify for Sonnet prompt caching.
function buildStableSystemPrompt(): string {
  return `\
You are a clinical literacy assessment designer for 9th grade Title I ELA students.

## YOUR TASK
For each passage, generate a single Ordered Multiple Choice (OMC) diagnostic question where every wrong answer is pre-coded to a specific cognitive failure layer. The question identifies WHICH breakdown is blocking a student's reading comprehension — and routes them to the correct targeted intervention.

## OMC STRUCTURE
Every question has exactly 4 options:
- 1 CORRECT option — requires the reading skill being tested
- 1 Layer 1 distractor — schema or metacognitive failure
- 1 Layer 2 distractor — language access failure (vocabulary, morphology, or syntax)
- 1 Layer 3 distractor — reading construction failure (inferencing, evidence, theme, structure, figurative language, tone, or mood)

The correct option placement rule: correct_option must be B or C (never A or D — avoids primacy/recency bias).

## DISTRACTOR DESIGN SPEC — ALL 13 CLASSIFICATION CODES

### Layer 1 — Schema / Metacognitive Prerequisites

**schema_strategy_missing**
The student has no activatable schema for the text's world. They guess based on surface topic words without engaging the actual context. Their answer reflects what they assume the topic is about, not what the passage shows.
Distractor behavior: plausible surface-topic guess, unconnected to any specific textual evidence.

**no_metacognitive_strategy**
The student applies no monitoring strategy. They accept first-pass meaning without pausing to re-read, clarify confusion, or check whether their understanding is consistent with the full passage.
Distractor behavior: early-passage reading that was never revised; reflects misreading of the opening without accounting for corrective information that follows.

### Layer 2 — Language Access Prerequisites

**vocabulary_gap**
The student encounters an unfamiliar Tier 2 word and either skips it or substitutes a familiar-sounding meaning. Their comprehension breaks at the word level and they cannot recover from context.
Distractor behavior: answer that would be correct IF the key vocabulary word meant what the student assumed it meant.

**morphology_gap**
The student cannot decode a morphologically complex word (prefix + root + suffix) and guesses at its meaning based on partial recognition of one morpheme.
Distractor behavior: answer derived from partial morpheme recognition.

**syntax_barrier**
The student cannot parse the sentence structure — embedded clauses, inverted syntax, or long nominal phrases cause them to lose the grammatical subject-verb-object relationship.
Distractor behavior: answer that reflects a misparse of the sentence (wrong grammatical subject assigned, wrong relationship between clauses).

### Layer 3 — Core Reading Construction Skills

**inferencing**
The student reads only the literal surface. They cannot bridge from what the text says to what it means. The correct answer requires a conclusion the author intends but never states.
Distractor behavior: a literally stated detail from the passage — correct as a fact, wrong as an inference.

**evidence_retrieval_failure**
The student knows an answer should be supported by the text but cannot locate the specific evidence. They substitute a general impression for a pointed quotation.
Distractor behavior: an accurate general statement about the passage that does not specifically address the question's evidence target.

**comprehension_integration_failure**
The student processes the passage segment by segment without building a unified meaning. They cannot synthesize information distributed across sentences or paragraphs.
Distractor behavior: an answer that is true of ONE part of the passage but fails when the full passage is integrated.

**topic_vs_theme_confusion**
The student identifies the topic (what the story is about — one or two words) rather than the theme (what the story reveals about human experience — a complete claim).
Distractor behavior: a single-word or single-phrase topic label presented as a theme.

**structure_purpose_disconnect**
The student identifies WHAT the text is about (content) but not HOW the author organized it (structure) or WHY they chose that structure (purpose).
Distractor behavior: a content summary or topic identification presented as a structural observation.

**figurative_language_failure**
The student reads a metaphor, simile, personification, or symbol literally. They extract the concrete vehicle but miss the tenor — what the figure actually communicates.
Distractor behavior: a literal reading of the figurative element that makes surface sense but misses the intended comparison or meaning.

**tone_misreading**
The student misidentifies the author's attitude toward the subject. Common errors: reading irony as sincerity, detachment as warmth, gentle criticism as praise.
Distractor behavior: the tone label the student would assign if reading surface-level word choices without attending to authorial distance or rhetorical markers.

**mood_misreading**
The student misidentifies the emotional atmosphere the passage creates in the reader. They report the plot emotion (what a character feels) rather than the textual mood (what the passage makes the reader feel).
Distractor behavior: a mood label derived from what a character explicitly expresses, not from the cumulative effect of the author's craft choices.

## QUALITY RULES
1. Stem must require the target skill — never ask for a fact literally stated in the passage
2. Correct answer must be directly defensible from the passage's own words
3. Each distractor must be plausible to a student with exactly that cognitive gap
4. No distractor should be obviously wrong to any reasonably engaged reader
5. Distractor classification must match the actual wrong-answer reasoning pattern above

## STEM FORMAT
All questions target ELA.9.R.1.1 (Inferencing and Textual Evidence):
"Based on this passage, what does [specific detail] most strongly suggest about [character / situation / author's intent]?"

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
  "rationale": string
}

The "rationale" field: 2–3 sentences covering (1) what the correct answer requires from the text, (2) the specific cognitive gap each distractor exploits, and (3) how the v3 metadata (target_signal, supporting_evidence) shaped your choices.`;
}

// Variable block — per passage. NOT cached.
function buildVariableBlock(passage: PassageRecord, mapping: PrimitiveMapping): string {
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
Tier:   ${passage.intervention_tier} of 4 (1 = accessible, 4 = challenging)

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

QUESTION TYPE: INFERENCING
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

function validateOMC(r: OMCResponse): string | null {
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
  if (r.correct_option === 'A' || r.correct_option === 'D')
    return `correct_option must be B or C, got ${r.correct_option}`;
  if (!r.cognitive_skill_targeted) return 'missing cognitive_skill_targeted';
  if (!r.rationale)                return 'missing rationale';
  return null;
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
    .eq('approval_status', 'approved')
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

    const variableBlock = buildVariableBlock(p, mapping);
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

    const validErr = validateOMC(parsed);
    if (validErr) {
      console.log(`${prefix} ❌  Validation: ${validErr}`);
      failed++;
      continue;
    }

    // ── Build content field (matches existing questions table format) ──────────

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
      `COGNITIVE_SKILL: ${parsed.cognitive_skill_targeted}`;

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
