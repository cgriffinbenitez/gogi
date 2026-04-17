/**
 * GOGI — Clinical Question Bank Rebuild
 *
 * Three anchor passages (locked):
 *   ELA.9.R.1.1  → The Most Dangerous Game, Richard Connell
 *   ELA.9.R.1.2  → The Hill, Horace Annesley Vachell
 *   ELA.9.R.2.1  → The Autobiography of Benjamin Franklin (1791)
 *
 * Steps:
 *   1. Audit   — log current question bank state per standard
 *   2. Clean   — flag all non-anchor questions
 *   3. Seed    — insert bare Franklin passage rows for ELA.9.R.2.1
 *                insert bare anchor rows if ELA.9.R.1.1 / ELA.9.R.1.2 need top-up
 *   4. Generate — call Claude once per bare row → append question block
 *   5. Evaluate — auto-approve (score ≥ 7), auto-flag (score < 5)
 *   6. Verify  — print final count; expected 10 / 10 / 10
 *
 * Usage:
 *   npx tsx scripts/rebuildQuestionBank.ts
 *
 * Env (from .env.local):
 *   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ANTHROPIC_API_KEY
 */

import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(process.cwd(), '.env.local') });

import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';

// ─── Config ───────────────────────────────────────────────────────────────────

const TARGET_PER_STANDARD = 10;
const GEN_DELAY_MS        = 2500;
const EVAL_DELAY_MS       = 1500;

// ─── Anchor passages ──────────────────────────────────────────────────────────

const PILOT_STANDARDS = [
  {
    id:          '4f374bcc-9ca9-4b15-94cb-3bdd6afe477e',
    code:        'ELA.9.R.1.1',
    title:       'Inferencing and Textual Evidence',
    type:        'inferencing' as const,
    anchorTitle: 'The Most Dangerous Game',
    anchorAuthor:'Richard Connell',
    anchorYear:  '1924',
  },
  {
    id:          'e9bd1f36-5bab-4dbf-ac57-132c55dd139c',
    code:        'ELA.9.R.1.2',
    title:       'Universal Themes in Literary Texts',
    type:        'universal_theme' as const,
    anchorTitle: 'The Hill',
    anchorAuthor:'Horace Annesley Vachell',
    anchorYear:  '1905',
  },
  {
    id:          '595a9506-5cf6-4e5a-8e8d-74473fed3fe8',
    code:        'ELA.9.R.2.1',
    title:       'Analyzing Text Structure and Purpose',
    type:        'text_structure' as const,
    anchorTitle: 'The Autobiography of Benjamin Franklin',
    anchorAuthor:'Benjamin Franklin',
    anchorYear:  '1791',
  },
] as const;

type StandardType = 'inferencing' | 'universal_theme' | 'text_structure';

// ─── Franklin passage (embedded — avoids runtime fetch / content filter) ──────
//     Source: Project Gutenberg #20203, Part I
//     ~300 words | clear chronological + cause/effect structure

const FRANKLIN_PASSAGE = `My elder brothers were all put apprentices to different trades. I was put to the grammar-school at eight years of age, my father intending to devote me to the service of the Church. My early readiness in learning to read—which must have been very early, as I do not remember when I could not read—and the opinion of all his friends that I should certainly make a good scholar, encouraged him in this purpose. I continued at the grammar-school not quite one year, though in that time I had risen gradually from the middle of the class to be the head of it. But my father, from a view of the expense of a college education, which having so large a family he could not well afford, altered his first intention, took me from the grammar-school, and sent me to a school for writing and arithmetic. Under that teacher I acquired fair writing pretty soon, but I failed in the arithmetic and made no progress in it.

At ten years old I was taken home to assist my father in his business, which was that of a tallow-chandler and soap-boiler. Accordingly, I was employed in cutting wick for the candles, filling the dipping mould and the moulds for cast candles, attending the shop, and going on errands. I disliked the trade and had a strong inclination for the sea, but my father declared against it. However, living near the water, I was much in and about it, learned early to swim well, and to manage boats.

There was a salt-marsh that bounded part of the mill-pond, on the edge of which we used to stand to fish for minnows. By much trampling, we had made it a mere quagmire. My proposal was to build a wharf there fit for us to stand upon. Accordingly, in the evening when the workmen were gone, I assembled a number of my playmates, and working with them diligently, we brought the stones all away and built our little wharf. The next morning the workmen were surprised at missing the stones. Inquiry was made; we were discovered and complained of; several of us were corrected by our fathers. Though I pleaded the usefulness of the work, my father convinced me that nothing was useful which was not honest.`;

// ─── Claude prompts ───────────────────────────────────────────────────────────

const EVAL_SYSTEM = `You are a clinical literacy assessment expert. Evaluate this OMC diagnostic question for 9th grade Title I students against these criteria:
1. Stem requires inferencing / theme analysis / structure analysis — NOT literal recall
2. Correct answer is genuinely defensible from passage text
3. Each distractor is plausible and maps logically to its cognitive layer
4. Wrong answers are NOT obviously wrong to a careful reader
5. Language is appropriate for 9th grade reading level

Respond with valid JSON only — no markdown. Keep "reason" under 40 words. Keep each "issues" item under 15 words:
{
  "score": number,
  "approve": boolean,
  "reason": string,
  "issues": string[]
}`;

const BASE_GEN_SYSTEM = `You are a clinical literacy assessment designer for 9th grade Title I ELA students in Miami. Write Ordered Multiple Choice (OMC) diagnostic questions where each wrong answer is pre-coded to a specific cognitive breakdown layer.

Layers:
- Layer 1 (schema_deficit or no_metacognitive_strategy): student lacks background knowledge or reading strategy
- Layer 2 (vocabulary_gap or morphology_gap): student is blocked by a specific word or structure
- Layer 3 (inferencing_deficit or evidence_retrieval_failure): student decodes but cannot draw conclusions

Write ONE question with EXACTLY 4 options: 1 correct + 1 Layer-1 distractor + 1 Layer-2 distractor + 1 Layer-3 distractor.

RULES:
- correct_option must be B or C (never A or D — avoids primacy/recency bias)
- Every distractor must be genuinely plausible — a smart student who missed the specific cognitive move would pick it
- Never make wrong answers obviously wrong
- rationale must explain why each distractor maps to its layer

Respond with valid JSON only — no markdown:
{
  "question_stem": string,
  "option_a": { "text": string, "classification": string },
  "option_b": { "text": string, "classification": string },
  "option_c": { "text": string, "classification": string },
  "option_d": { "text": string, "classification": string },
  "correct_option": "B" | "C",
  "cognitive_skill_targeted": string,
  "rationale": string,
  "difficulty_level": "scaffolded" | "standard" | "transfer"
}`;

const STANDARD_INSTRUCTION: Record<StandardType, string> = {
  inferencing: `Question type: INFERENCING
Stem must require reading between the lines — never ask for a fact directly stated.
Correct: genuine inference from implicit textual evidence.
Layer 1 distractor: schema-based guess using surface topic knowledge, not text evidence.
Layer 2 distractor: plausible misreading caused by misunderstanding a key vocabulary word.
Layer 3 distractor: literal reading that missed the implied meaning.
Stem format: "Based on this passage, what does [detail] most strongly suggest about [character/situation]?" or "What can the reader infer about [subject] from [specific detail]?"`,

  universal_theme: `Question type: UNIVERSAL THEME
Stem must ask what the text reveals about human nature or experience — beyond specific plot events.
Correct: universal theme that applies broadly to human experience, supported by textual evidence.
Layer 1 distractor: confuses a plot summary or character action with the theme (what happened, not what it means).
Layer 2 distractor: misreads a key thematic word or symbol, arriving at a plausible but wrong thematic claim.
Layer 3 distractor: identifies a topic (a single word like "loss") rather than a theme (a complete statement about human experience).
Stem format: "Based on this passage, what does [story element] most strongly suggest about [aspect of human experience]?"`,

  text_structure: `Question type: TEXT STRUCTURE AND PURPOSE
Stem must ask HOW the author organized the text OR WHY they structured it that way.
Correct: correctly identifies both the text structure AND the author's purpose for using it.
Layer 1 distractor: student has no schema for text structures (chronological, cause/effect, compare/contrast, problem/solution) and guesses based on content alone.
Layer 2 distractor: student misreads a structural signal word or transition, leading to wrong structure identification.
Layer 3 distractor: student identifies WHAT the text is about (content/topic) instead of HOW it is organized (structure/purpose).
Stem format: "How does the author organize this passage?" or "Why does the author [structural choice] in this passage?" or "Which text structure best describes how the author develops the central idea?"`,
};

function buildGenSystem(type: StandardType): string {
  return BASE_GEN_SYSTEM + '\n\n' + STANDARD_INSTRUCTION[type];
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface QuestionRow {
  id: string;
  standard_id: string;
  content: string;
  title: string | null;
  author: string | null;
  pub_year: string | null;
  approved: boolean | null;
  flagged: boolean | null;
  option_a_text: string | null;
  option_b_text: string | null;
  option_c_text: string | null;
  option_d_text: string | null;
  option_a_class: string | null;
  option_b_class: string | null;
  option_c_class: string | null;
  option_d_class: string | null;
  correct_option: string | null;
  rationale: string | null;
}

interface GenResponse {
  question_stem: string;
  option_a: { text: string; classification: string };
  option_b: { text: string; classification: string };
  option_c: { text: string; classification: string };
  option_d: { text: string; classification: string };
  correct_option: 'B' | 'C';
  cognitive_skill_targeted: string;
  rationale: string;
  difficulty_level: 'scaffolded' | 'standard' | 'transfer';
}

interface EvalResult {
  score: number;
  approve: boolean;
  reason: string;
  issues: string[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function parseJson<T>(raw: string): T {
  return JSON.parse(raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')) as T;
}

function extractPassage(content: string): string {
  const qIdx = content.search(/\nQUESTION:/i);
  return (qIdx > 0 ? content.slice(0, qIdx) : content)
    .replace(/^PASSAGE:\s*/i, '')
    .replace(/^-{2,}\s*$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function parseField(content: string, prefix: string): string {
  const line = content.split('\n').find((l) => l.trimStart().startsWith(prefix));
  return line ? line.slice(line.indexOf(prefix) + prefix.length).trim() : '';
}

function parseOptions(content: string): Record<string, string> {
  const opts: Record<string, string> = {};
  for (const line of content.split('\n')) {
    const m = line.trimStart().match(/^([A-D])[.)]\s*(.+)/);
    if (m) opts[m[1]] = m[2].trim();
  }
  return opts;
}

function buildQuestionBlock(r: GenResponse): string {
  return (
    '\n\n---\n\n' +
    `QUESTION: ${r.question_stem}\n\n` +
    `A. ${r.option_a.text}\n` +
    `B. ${r.option_b.text}\n` +
    `C. ${r.option_c.text}\n` +
    `D. ${r.option_d.text}\n\n` +
    `CORRECT: ${r.correct_option}\n` +
    `DIAGNOSTIC_CLASSIFICATION_A: ${r.option_a.classification}\n` +
    `DIAGNOSTIC_CLASSIFICATION_B: ${r.option_b.classification}\n` +
    `DIAGNOSTIC_CLASSIFICATION_C: ${r.option_c.classification}\n` +
    `DIAGNOSTIC_CLASSIFICATION_D: ${r.option_d.classification}\n` +
    `COGNITIVE_SKILL: ${r.cognitive_skill_targeted}`
  );
}

// Difficulty label for generation request (scaffolded Q1-3, standard Q4-7, transfer Q8-10)
function difficultyFor(index: number): string {
  if (index < 3)  return 'scaffolded';
  if (index < 7)  return 'standard';
  return 'transfer';
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const supabaseUrl  = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey  = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('❌  NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env.local');
    process.exit(1);
  }
  if (!anthropicKey) {
    console.error('❌  ANTHROPIC_API_KEY must be set in .env.local');
    process.exit(1);
  }

  const supabase  = createClient(supabaseUrl, supabaseKey);
  const anthropic = new Anthropic({ apiKey: anthropicKey, timeout: 60_000 });

  // ══════════════════════════════════════════════════════════════════════════
  // STEP 1 — AUDIT
  // ══════════════════════════════════════════════════════════════════════════

  console.log('\n' + '═'.repeat(64));
  console.log('STEP 1 — AUDIT: Current question bank state');
  console.log('═'.repeat(64));

  for (const std of PILOT_STANDARDS) {
    const { data: rows, error } = await supabase
      .from('questions')
      .select('id, title, author, approved, flagged, content')
      .eq('standard_id', std.id)
      .order('approved', { ascending: false });

    if (error) { console.error(`  ❌  [${std.code}] audit error:`, error.message); continue; }

    console.log(`\n  ${std.code} — ${rows?.length ?? 0} rows`);
    for (const row of (rows ?? []) as QuestionRow[]) {
      const hasQ   = row.content?.includes('QUESTION:') ? 'Q' : ' ';
      const status = row.approved ? '✅ approved' : row.flagged ? '🚩 flagged ' : '⚠  pending ';
      const preview = row.content?.slice(0, 60).replace(/\n/g, ' ') ?? '';
      console.log(`    [${hasQ}] ${status}  title="${row.title ?? '—'}"  ${preview}…`);
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // STEP 2 — CLEAN: flag non-anchor questions
  // ══════════════════════════════════════════════════════════════════════════

  console.log('\n' + '═'.repeat(64));
  console.log('STEP 2 — CLEAN: Flag non-anchor questions');
  console.log('═'.repeat(64));

  for (const std of PILOT_STANDARDS) {
    const isR21 = std.code === 'ELA.9.R.2.1';

    if (isR21) {
      // Flag ALL existing ELA.9.R.2.1 questions — replacing with Franklin
      const { error } = await supabase
        .from('questions')
        .update({ flagged: true, approved: false })
        .eq('standard_id', std.id);

      if (error) console.error(`  ❌  [${std.code}] flag-all error:`, error.message);
      else console.log(`  [${std.code}] flagged all existing rows — replacing with Franklin passage`);
    } else {
      // Flag rows whose title doesn't match the anchor
      const { error } = await supabase
        .from('questions')
        .update({ flagged: true, approved: false })
        .eq('standard_id', std.id)
        .neq('title', std.anchorTitle);

      if (error) console.error(`  ❌  [${std.code}] flag error:`, error.message);
      else console.log(`  [${std.code}] flagged non-anchor rows (kept title="${std.anchorTitle}")`);
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // STEP 3 — SEED: insert bare passage rows where needed
  // ══════════════════════════════════════════════════════════════════════════

  console.log('\n' + '═'.repeat(64));
  console.log('STEP 3 — SEED: Insert bare passage rows for generation');
  console.log('═'.repeat(64));

  for (const std of PILOT_STANDARDS) {
    const isR21 = std.code === 'ELA.9.R.2.1';

    // Count currently approved questions for this anchor
    const { count: approvedCount } = await supabase
      .from('questions')
      .select('id', { count: 'exact', head: true })
      .eq('standard_id', std.id)
      .eq('approved', true);

    const approved = approvedCount ?? 0;
    const needed   = Math.max(0, TARGET_PER_STANDARD - approved);

    if (needed === 0) {
      console.log(`  [${std.code}] already has ${approved} approved — no seed needed`);
      continue;
    }

    console.log(`  [${std.code}] ${approved} approved, need ${needed} more — seeding ${needed} bare rows`);

    let passageText: string;

    if (isR21) {
      passageText = FRANKLIN_PASSAGE;
    } else {
      // Pull passage text from an existing non-flagged anchor row
      const { data: anchorRows } = await supabase
        .from('questions')
        .select('content')
        .eq('standard_id', std.id)
        .eq('title', std.anchorTitle)
        .eq('flagged', false)
        .limit(1);

      const anchorRow = anchorRows?.[0] as { content: string } | undefined;
      if (!anchorRow) {
        console.error(`  ❌  [${std.code}] no unflagged anchor row found — cannot seed`);
        continue;
      }
      passageText = extractPassage(anchorRow.content);
    }

    // Insert `needed` bare rows (passage text only, no question block yet)
    let seeded = 0;
    for (let i = 0; i < needed; i++) {
      const { error } = await supabase.from('questions').insert({
        standard_id:              std.id,
        content:                  passageText,
        title:                    std.anchorTitle,
        author:                   std.anchorAuthor,
        pub_year:                 std.anchorYear,
        cognitive_skill_targeted: std.type,
        difficulty_level:         0,
        approved:                 false,
        flagged:                  false,
      });
      if (error) console.error(`    ❌  insert error (row ${i + 1}):`, error.message);
      else seeded++;
    }
    console.log(`  [${std.code}] inserted ${seeded}/${needed} bare passage rows`);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // STEP 4 — GENERATE: one question per bare row
  // ══════════════════════════════════════════════════════════════════════════

  console.log('\n' + '═'.repeat(64));
  console.log('STEP 4 — GENERATE: Writing OMC questions for bare passage rows');
  console.log('═'.repeat(64));

  let genSuccess = 0;
  let genFail    = 0;

  for (const std of PILOT_STANDARDS) {
    // Fetch bare rows (no QUESTION: block, not flagged) for this standard
    const { data: bareRows, error: bareErr } = await supabase
      .from('questions')
      .select('id, content, title, author')
      .eq('standard_id', std.id)
      .eq('flagged', false)
      .eq('approved', false);

    if (bareErr) { console.error(`  ❌  [${std.code}] fetch bare rows error:`, bareErr.message); continue; }

    const toGenerate = ((bareRows ?? []) as QuestionRow[]).filter(
      (r) => !r.content?.includes('QUESTION:'),
    );

    if (toGenerate.length === 0) {
      console.log(`\n  [${std.code}] no bare rows — skipping generation`);
      continue;
    }

    console.log(`\n  [${std.code}] generating ${toGenerate.length} question(s)`);
    const systemPrompt = buildGenSystem(std.type);

    for (let i = 0; i < toGenerate.length; i++) {
      const row = toGenerate[i];
      const difficulty = difficultyFor(i);

      if (genSuccess + genFail > 0) await sleep(GEN_DELAY_MS);

      process.stdout.write(`  [${std.code}] [${i + 1}/${toGenerate.length}] ${difficulty} — `);

      const userMsg =
        `Standard: ${std.code} — ${std.title}\n` +
        `Passage title: ${row.title ?? 'Untitled'}\n` +
        `Author: ${row.author ?? 'Unknown'}\n` +
        `Difficulty target: ${difficulty} (${i + 1} of ${toGenerate.length})\n\n` +
        `PASSAGE:\n${row.content}`;

      let parsed: GenResponse;
      try {
        const msg = await anthropic.messages.create({
          model:      'claude-sonnet-4-6',
          max_tokens: 1024,
          system:     systemPrompt,
          messages:   [{ role: 'user', content: userMsg }],
        });
        parsed = parseJson<GenResponse>((msg.content[0] as { type: string; text: string }).text);
      } catch (err) {
        console.log(`❌  Claude error: ${(err as Error).message}`);
        genFail++;
        continue;
      }

      if (!parsed.question_stem || !parsed.option_a?.text || !parsed.correct_option) {
        console.log('❌  Missing required fields in response');
        genFail++;
        continue;
      }

      const { error: updateErr } = await supabase
        .from('questions')
        .update({
          content:                  row.content + buildQuestionBlock(parsed),
          option_a_text:            parsed.option_a.text,
          option_b_text:            parsed.option_b.text,
          option_c_text:            parsed.option_c.text,
          option_d_text:            parsed.option_d.text,
          option_a_class:           parsed.option_a.classification,
          option_b_class:           parsed.option_b.classification,
          option_c_class:           parsed.option_c.classification,
          option_d_class:           parsed.option_d.classification,
          correct_option:           parsed.correct_option,
          cognitive_skill_targeted: parsed.cognitive_skill_targeted,
          rationale:                parsed.rationale,
          approved:                 false,
        })
        .eq('id', row.id);

      if (updateErr) {
        console.log(`❌  DB update error: ${updateErr.message}`);
        genFail++;
      } else {
        console.log(`✅  ${parsed.correct_option}  ${parsed.question_stem.slice(0, 70)}…`);
        genSuccess++;
      }
    }
  }

  console.log(`\n  Generation: ✅ ${genSuccess} succeeded  ❌ ${genFail} failed`);

  // ══════════════════════════════════════════════════════════════════════════
  // STEP 5 — EVALUATE: auto-approve (≥7) / auto-flag (<5) / manual (5-6)
  // ══════════════════════════════════════════════════════════════════════════

  console.log('\n' + '═'.repeat(64));
  console.log('STEP 5 — EVALUATE: Auto-approve ≥7 / auto-flag <5 / manual 5-6');
  console.log('═'.repeat(64));

  // Re-fetch all un-approved, un-flagged rows that have a question block
  const { data: evalRows, error: evalErr } = await supabase
    .from('questions')
    .select(
      'id, standard_id, content, title, approved, flagged, ' +
      'option_a_text, option_b_text, option_c_text, option_d_text, ' +
      'option_a_class, option_b_class, option_c_class, option_d_class, ' +
      'correct_option, rationale',
    )
    .eq('approved', false)
    .eq('flagged', false);

  if (evalErr) { console.error('❌  Eval fetch failed:', evalErr.message); process.exit(1); }

  const toEval = ((evalRows ?? []) as unknown as QuestionRow[]).filter(
    (r) => r.content?.includes('QUESTION:'),
  );

  console.log(`\n  Evaluating ${toEval.length} question(s)…`);

  let evalApproved = 0;
  let evalFlagged  = 0;
  let evalManual   = 0;
  let evalErrors   = 0;

  for (let i = 0; i < toEval.length; i++) {
    const row    = toEval[i];
    const std    = PILOT_STANDARDS.find((s) => s.id === row.standard_id);
    const code   = std?.code ?? '?';
    const title  = (row.title ?? 'Untitled').slice(0, 28);

    await sleep(EVAL_DELAY_MS);
    process.stdout.write(`  [${i + 1}/${toEval.length}] [${code}] "${title}" — `);

    const passageText = extractPassage(row.content);
    const stem        = parseField(row.content, 'QUESTION:');
    const optMap      = parseOptions(row.content);
    const opts = {
      A: row.option_a_text ?? optMap['A'] ?? '',
      B: row.option_b_text ?? optMap['B'] ?? '',
      C: row.option_c_text ?? optMap['C'] ?? '',
      D: row.option_d_text ?? optMap['D'] ?? '',
    };
    const classes = {
      A: row.option_a_class ?? parseField(row.content, 'DIAGNOSTIC_CLASSIFICATION_A:'),
      B: row.option_b_class ?? parseField(row.content, 'DIAGNOSTIC_CLASSIFICATION_B:'),
      C: row.option_c_class ?? parseField(row.content, 'DIAGNOSTIC_CLASSIFICATION_C:'),
      D: row.option_d_class ?? parseField(row.content, 'DIAGNOSTIC_CLASSIFICATION_D:'),
    };
    const correct = row.correct_option ?? parseField(row.content, 'CORRECT:').replace(/[^A-D]/g, '');

    if (!stem || !opts.A || !correct) {
      console.log('⚠  Could not parse — skipping');
      evalErrors++;
      continue;
    }

    const evalMsg =
      `Standard: ${code} — ${std?.title ?? ''}\n\n` +
      `PASSAGE (first 800 chars):\n${passageText.slice(0, 800)}\n\n` +
      `QUESTION:\n${stem}\n\n` +
      `A. ${opts.A} [${classes.A || 'none'}]\n` +
      `B. ${opts.B} [${classes.B || 'none'}]\n` +
      `C. ${opts.C} [${classes.C || 'none'}]\n` +
      `D. ${opts.D} [${classes.D || 'none'}]\n\n` +
      `CORRECT: ${correct}\n\nRATIONALE:\n${row.rationale ?? '(none)'}`;

    let result: EvalResult;
    try {
      const msg = await anthropic.messages.create({
        model:      'claude-sonnet-4-6',
        max_tokens: 300,
        system:     EVAL_SYSTEM,
        messages:   [{ role: 'user', content: evalMsg }],
      });
      result = parseJson<EvalResult>((msg.content[0] as { type: string; text: string }).text);
    } catch (err) {
      console.log(`❌  Eval API error: ${(err as Error).message}`);
      evalErrors++;
      continue;
    }

    const score  = result.score ?? 0;
    const issues = (result.issues ?? []).join('; ');

    if (score >= 7) {
      const { error } = await supabase
        .from('questions')
        .update({ approved: true, flagged: false })
        .eq('id', row.id);
      if (error) { console.log(`❌  approve DB error: ${error.message}`); evalErrors++; }
      else { console.log(`✅  score=${score} APPROVED — ${result.reason}`); evalApproved++; }
    } else if (score < 5) {
      const { error } = await supabase
        .from('questions')
        .update({ flagged: true, approved: false })
        .eq('id', row.id);
      if (error) { console.log(`❌  flag DB error: ${error.message}`); evalErrors++; }
      else { console.log(`🚩  score=${score} FLAGGED — ${result.reason}${issues ? ' | ' + issues : ''}`); evalFlagged++; }
    } else {
      console.log(`⚠   score=${score} MANUAL REVIEW — ${result.reason}`);
      evalManual++;
    }
  }

  console.log(
    `\n  Evaluation: ✅ ${evalApproved} approved  🚩 ${evalFlagged} flagged  ` +
    `⚠ ${evalManual} manual  ❌ ${evalErrors} errors`,
  );

  // ══════════════════════════════════════════════════════════════════════════
  // STEP 6 — VERIFY: final count per standard
  // ══════════════════════════════════════════════════════════════════════════

  console.log('\n' + '═'.repeat(64));
  console.log('STEP 6 — VERIFY: Final approved question count');
  console.log('═'.repeat(64));

  const { data: finalRows, error: finalErr } = await supabase
    .from('questions')
    .select('standard_id, title, approved')
    .eq('approved', true);

  if (finalErr) { console.error('❌  Final count query failed:', finalErr.message); return; }

  const counts: Record<string, { count: number; title: string }> = {};
  for (const std of PILOT_STANDARDS) counts[std.code] = { count: 0, title: std.anchorTitle };

  for (const row of (finalRows ?? []) as { standard_id: string; title: string | null; approved: boolean }[]) {
    const std = PILOT_STANDARDS.find((s) => s.id === row.standard_id);
    if (std) counts[std.code].count++;
  }

  console.log('');
  let allGood = true;
  for (const [code, { count, title }] of Object.entries(counts)) {
    if (count >= TARGET_PER_STANDARD) {
      console.log(`  ✅  ${code} — ${count} questions, ${title}`);
    } else {
      console.log(`  ⚠   ${code} — only ${count}/${TARGET_PER_STANDARD} approved — needs ${TARGET_PER_STANDARD - count} more`);
      allGood = false;
    }
  }

  console.log('');
  if (allGood) {
    console.log('  ✅ ELA.9.R.1.1 — 10 questions, The Most Dangerous Game');
    console.log('  ✅ ELA.9.R.1.2 — 10 questions, The Hill');
    console.log('  ✅ ELA.9.R.2.1 — 10 questions, The Autobiography of Benjamin Franklin');
    console.log('  Question bank rebuild complete. Pilot ready.');
  } else {
    console.log('  ⚠  Run the script again to generate additional questions for any standard below 10.');
    console.log('  ⚠  Questions scoring 5-6 are in manual review — approve them at /admin/questions.');
  }

  console.log('\n' + '═'.repeat(64) + '\n');
}

main().catch((err) => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
