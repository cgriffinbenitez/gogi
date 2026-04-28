/**
 * GOGI — Complete Question Bank Build
 *
 * Steps:
 *   1. Audit   — print current state per standard
 *   2. Generate — write OMC questions for passages missing them (all 3 standards)
 *   3. Evaluate — auto-approve (score ≥7), auto-flag (score <5), leave 5–6 for manual review
 *   4. Count    — verify each standard has ≥5 approved questions
 *   5. Summary  — print approved stems for sanity check
 *
 * Usage:
 *   npx tsx scripts/generateQuestions.ts
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

const MAX_PER_STANDARD = 10; // up to 30 total across 3 standards
const GEN_DELAY_MS     = 2000;
const EVAL_DELAY_MS    = 1500;

const PILOT_STANDARDS = [
  {
    id:    '4f374bcc-9ca9-4b15-94cb-3bdd6afe477e',
    code:  'ELA.9.R.1.1',
    title: 'Explain how key elements enhance or add layers of meaning and/or style in a literary text.',
    type:  'inferencing' as const,
  },
  {
    id:    'e9bd1f36-5bab-4dbf-ac57-132c55dd139c',
    code:  'ELA.9.R.1.2',
    title: 'Analyze universal themes and their development throughout a literary text.',
    type:  'universal_theme' as const,
  },
  {
    id:    '595a9506-5cf6-4e5a-8e8d-74473fed3fe8',
    code:  'ELA.9.R.2.1',
    title: 'Analyze how multiple text structures and/or features convey a purpose and/or meaning in texts.',
    type:  'text_structure' as const,
  },
] as const;

type StandardType = 'inferencing' | 'universal_theme' | 'text_structure';

// ─── Prompts ──────────────────────────────────────────────────────────────────

const EVAL_SYSTEM_PROMPT = `You are a clinical literacy assessment expert. Evaluate this OMC diagnostic question for 9th grade Title I students against these criteria:
1. Stem requires inferencing/theme analysis/structure analysis (not literal recall)
2. Correct answer is genuinely defensible from passage text
3. Each distractor is plausible and maps logically to its cognitive layer
4. Wrong answers are NOT obviously wrong
5. Language is appropriate for 9th grade reading level
6. Passage is appropriate for 9th grade Title I students

Respond with valid JSON only — no markdown, no explanation:
{
  "approve": boolean,
  "score": number,
  "reason": string,
  "issues": string[]
}`;

const BASE_GEN_SYSTEM = `You are a clinical literacy assessment designer for 9th grade Title I ELA students. Your job is to write Ordered Multiple Choice (OMC) diagnostic questions where each wrong answer option is pre-coded to a specific cognitive breakdown layer.

The three layers are:
- Layer 1 (schema_deficit or no_metacognitive_strategy): Student lacks background knowledge or reading strategy to approach the text
- Layer 2 (vocabulary_gap or morphology_gap): Student is blocked by a specific word or language structure
- Layer 3 (inferencing_deficit or evidence_retrieval_failure): Student can decode but cannot draw conclusions from the text

You must write ONE question with EXACTLY 4 options:
- 1 CORRECT option
- 1 Layer 1 distractor
- 1 Layer 2 distractor
- 1 Layer 3 distractor

Respond with valid JSON only — no markdown, no explanation:
{
  "question_stem": string,
  "option_a": { "text": string, "classification": string },
  "option_b": { "text": string, "classification": string },
  "option_c": { "text": string, "classification": string },
  "option_d": { "text": string, "classification": string },
  "correct_option": "A" | "B" | "C" | "D",
  "cognitive_skill_targeted": string,
  "rationale": string
}

Rules:
- correct_option must be B or C (never A or D — avoids primacy/recency bias)
- Each distractor must be genuinely plausible — a smart student who missed the specific cognitive move would pick it
- Never make wrong answers obviously wrong
- rationale must explain why each distractor maps to its specific layer`;

const STANDARD_INSTRUCTION: Record<StandardType, string> = {
  inferencing: `Question type: INFERENCING
Write an inferencing question. The stem must require reading between the lines — never ask for a fact directly stated in the passage.
Correct answer: requires genuine inference from implicit textual evidence.
Layer 1 distractor: a schema-based guess using surface topic knowledge, not text evidence.
Layer 2 distractor: a plausible misreading caused by misunderstanding a key vocabulary word in the passage.
Layer 3 distractor: a literal reading that missed the implied meaning.
Stem format: "Based on this passage, what does [detail] most strongly suggest about [character/situation]?"`,

  universal_theme: `Question type: UNIVERSAL THEME
Write a universal theme question. The stem must ask what the text reveals about human nature or experience beyond the specific plot events.
Correct answer: identifies the universal theme that applies to all people, supported by textual evidence.
Layer 1 distractor: confuses a plot summary or character action with the theme (what happened, not what it means).
Layer 2 distractor: misreads a key thematic word or symbol, arriving at a plausible but wrong thematic claim.
Layer 3 distractor: identifies a topic (a single word or phrase like "loss" or "ambition") rather than a theme (a complete statement about the human experience).
Stem format: "Based on this passage, what does [story element] most strongly suggest about [aspect of human experience]?"`,

  text_structure: `Question type: TEXT STRUCTURE AND PURPOSE
Write a text structure/purpose question. The stem must ask HOW the author organized the text OR WHY they structured it that particular way.
Correct answer: correctly identifies both the text structure AND the author's purpose for using it.
Layer 1 distractor: student has no schema for text structures (cause/effect, compare/contrast, problem/solution, etc.) and guesses based on content alone.
Layer 2 distractor: student misreads a structural signal word or transition, leading to the wrong structure identification.
Layer 3 distractor: student identifies WHAT the text is about (content/topic) instead of HOW it is organized (structure/purpose).
Stem format: "How does the author's organizational choice in this passage most strongly suggest [purpose/effect on reader]?"`,
};

function buildGenSystemPrompt(type: StandardType): string {
  return BASE_GEN_SYSTEM + '\n\n' + STANDARD_INSTRUCTION[type];
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface PassageRow {
  id: string;
  content: string;
  title: string | null;
  author: string | null;
  pub_year: string | null;
}

interface QuestionRow {
  id: string;
  standard_id: string;
  content: string;
  title: string | null;
  author: string | null;
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

interface ClaudeGenResponse {
  question_stem: string;
  option_a: { text: string; classification: string };
  option_b: { text: string; classification: string };
  option_c: { text: string; classification: string };
  option_d: { text: string; classification: string };
  correct_option: 'A' | 'B' | 'C' | 'D';
  cognitive_skill_targeted: string;
  rationale: string;
}

interface EvalResult {
  approve: boolean;
  score: number;
  reason: string;
  issues: string[];
}

// ─── Content helpers ──────────────────────────────────────────────────────────

function extractPassage(content: string): string {
  const qIdx = content.search(/\nQUESTION:/i);
  const raw = qIdx > 0 ? content.slice(0, qIdx) : content;
  return raw
    .replace(/^PASSAGE:\s*/i, '')
    .replace(/^-{2,}\s*$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function parseField(content: string, prefix: string): string {
  const lines = content.split('\n');
  const line = lines.find((l) => l.trimStart().startsWith(prefix));
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

function buildQuestionBlock(r: ClaudeGenResponse): string {
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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function callJson<T>(raw: string): T {
  const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  return JSON.parse(cleaned) as T;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('❌  NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env.local');
    process.exit(1);
  }
  if (!anthropicKey) {
    console.error('❌  ANTHROPIC_API_KEY must be set in .env.local');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);
  const anthropic = new Anthropic({ apiKey: anthropicKey, timeout: 60000 });

  // ════════════════════════════════════════════════════════════════════════════
  // STEP 1 — AUDIT
  // ════════════════════════════════════════════════════════════════════════════

  console.log('\n' + '═'.repeat(64));
  console.log('STEP 1 — AUDIT: Current question bank state');
  console.log('═'.repeat(64));

  const { data: allRows, error: auditErr } = await supabase
    .from('questions')
    .select('id, standard_id, title, author, approved, flagged, correct_option, content')
    .order('standard_id');

  if (auditErr) { console.error('❌  Audit query failed:', auditErr.message); process.exit(1); }

  const auditStats: Record<string, { total: number; hasQ: number; approved: number; flagged: number; needsGeneration: number }> = {};
  for (const std of PILOT_STANDARDS) auditStats[std.code] = { total: 0, hasQ: 0, approved: 0, flagged: 0, needsGeneration: 0 };

  for (const row of (allRows ?? []) as QuestionRow[]) {
    const std = PILOT_STANDARDS.find((s) => s.id === row.standard_id);
    if (!std) continue;
    const s = auditStats[std.code];
    s.total++;
    if (row.content?.includes('QUESTION:')) s.hasQ++;
    else s.needsGeneration++;
    if (row.approved) s.approved++;
    if (row.flagged) s.flagged++;
  }

  for (const [code, s] of Object.entries(auditStats)) {
    console.log(`\n  ${code}`);
    console.log(`    Total rows:       ${s.total}`);
    console.log(`    Has question:     ${s.hasQ}`);
    console.log(`    Needs generation: ${s.needsGeneration}`);
    console.log(`    Approved:         ${s.approved}`);
    console.log(`    Flagged:          ${s.flagged}`);
    console.log(`    Needs review:     ${s.total - s.approved - s.flagged}`);
  }

  // ════════════════════════════════════════════════════════════════════════════
  // STEP 2 — GENERATE
  // ════════════════════════════════════════════════════════════════════════════

  console.log('\n' + '═'.repeat(64));
  console.log('STEP 2 — GENERATE: Writing OMC questions for passages missing them');
  console.log('═'.repeat(64));

  let genTotal = 0;
  let genSuccess = 0;
  let genFail = 0;

  for (const std of PILOT_STANDARDS) {
    const { data: passageRows, error: pErr } = await supabase
      .from('questions')
      .select('id, content, title, author, pub_year')
      .eq('standard_id', std.id);

    if (pErr) { console.error(`  ❌  [${std.code}] fetch error:`, pErr.message); continue; }

    const passages = ((passageRows ?? []) as PassageRow[])
      .filter((row) => !row.content?.includes('QUESTION:'))
      .slice(0, MAX_PER_STANDARD);

    if (passages.length === 0) {
      console.log(`\n  [${std.code}] No passages need generation — skipping`);
      continue;
    }

    console.log(`\n  [${std.code}] ${passages.length} passage(s) to generate`);
    const systemPrompt = buildGenSystemPrompt(std.type);

    for (let i = 0; i < passages.length; i++) {
      const row = passages[i];
      const title = row.title ?? 'Untitled';
      const author = row.author ?? 'Unknown';

      if (genTotal > 0) await sleep(GEN_DELAY_MS);
      genTotal++;

      process.stdout.write(`  [${std.code}] [${i + 1}/${passages.length}] ${title.slice(0, 40)} — `);

      const userMessage =
        `Standard: ${std.code} — ${std.title}\n` +
        `Passage: ${row.content}\n` +
        `Title: ${title}\n` +
        `Author: ${author}`;

      let parsed: ClaudeGenResponse;
      try {
        const msg = await anthropic.messages.create({
          model: 'claude-sonnet-4-6',
          max_tokens: 2048,
          system: systemPrompt,
          messages: [{ role: 'user', content: userMessage }],
        });
        parsed = callJson<ClaudeGenResponse>(
          (msg.content[0] as { type: string; text: string }).text,
        );
      } catch (err) {
        console.log('❌  Claude call failed:', (err as Error).message);
        genFail++;
        continue;
      }

      if (
        !parsed.question_stem ||
        !parsed.option_a?.text || !parsed.option_b?.text ||
        !parsed.option_c?.text || !parsed.option_d?.text ||
        !parsed.correct_option || !parsed.cognitive_skill_targeted
      ) {
        console.log('❌  Response missing required fields');
        genFail++;
        continue;
      }

      const { error: updateErr } = await supabase
        .from('questions')
        .update({
          content: row.content + buildQuestionBlock(parsed),
          option_a_text: parsed.option_a.text,
          option_b_text: parsed.option_b.text,
          option_c_text: parsed.option_c.text,
          option_d_text: parsed.option_d.text,
          option_a_class: parsed.option_a.classification,
          option_b_class: parsed.option_b.classification,
          option_c_class: parsed.option_c.classification,
          option_d_class: parsed.option_d.classification,
          correct_option: parsed.correct_option,
          cognitive_skill_targeted: parsed.cognitive_skill_targeted,
          rationale: parsed.rationale,
          approved: false,
        })
        .eq('id', row.id);

      if (updateErr) {
        console.log('❌  DB update failed:', updateErr.message);
        genFail++;
      } else {
        console.log(`✅  correct=${parsed.correct_option} | ${parsed.question_stem.slice(0, 60)}…`);
        genSuccess++;
      }
    }
  }

  console.log(`\n  Generation complete — success: ${genSuccess}  failed: ${genFail}  total attempted: ${genTotal}`);

  // ════════════════════════════════════════════════════════════════════════════
  // STEP 3 — EVALUATE
  // ════════════════════════════════════════════════════════════════════════════

  console.log('\n' + '═'.repeat(64));
  console.log('STEP 3 — EVALUATE: Auto-approve (≥7) / auto-flag (<5) / manual (5–6)');
  console.log('═'.repeat(64));

  // Re-fetch all questions after generation to get updated content
  const { data: evalRows, error: evalFetchErr } = await supabase
    .from('questions')
    .select(
      'id, standard_id, content, title, author, approved, flagged, ' +
      'option_a_text, option_b_text, option_c_text, option_d_text, ' +
      'option_a_class, option_b_class, option_c_class, option_d_class, ' +
      'correct_option, rationale',
    );

  if (evalFetchErr) { console.error('❌  Eval fetch failed:', evalFetchErr.message); process.exit(1); }

  // Only evaluate questions that have a question block and aren't already approved
  const toEval = ((evalRows ?? []) as unknown as QuestionRow[]).filter(
    (r) => r.content?.includes('QUESTION:') && r.approved !== true,
  );

  console.log(`\n  Evaluating ${toEval.length} question(s)…`);

  let evalApproved = 0;
  let evalFlagged  = 0;
  let evalManual   = 0;
  let evalError    = 0;

  for (let i = 0; i < toEval.length; i++) {
    const row = toEval[i];
    const std = PILOT_STANDARDS.find((s) => s.id === row.standard_id);
    const stdCode = std?.code ?? '?';
    const title = (row.title ?? 'Untitled').slice(0, 30);

    await sleep(EVAL_DELAY_MS);
    process.stdout.write(`  [${i + 1}/${toEval.length}] [${stdCode}] ${title} — `);

    // Build structured option data — prefer columns, fall back to content parsing
    const passageText = extractPassage(row.content);
    const stem = parseField(row.content, 'QUESTION:');
    const optMap = parseOptions(row.content);
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

    if (!stem || !opts.A || !opts.B || !opts.C || !opts.D || !correct) {
      console.log('⚠  Could not parse question fields — skipping evaluation');
      evalError++;
      continue;
    }

    const evalUserMsg =
      `Standard: ${stdCode} — ${std?.title ?? ''}\n\n` +
      `PASSAGE:\n${passageText.slice(0, 800)}\n\n` +
      `QUESTION STEM:\n${stem}\n\n` +
      `A. ${opts.A} [${classes.A || 'no classification'}]\n` +
      `B. ${opts.B} [${classes.B || 'no classification'}]\n` +
      `C. ${opts.C} [${classes.C || 'no classification'}]\n` +
      `D. ${opts.D} [${classes.D || 'no classification'}]\n\n` +
      `CORRECT ANSWER: ${correct}\n\n` +
      `RATIONALE:\n${row.rationale ?? '(none provided)'}`;

    let evalResult: EvalResult;
    try {
      const msg = await anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 512,
        system: EVAL_SYSTEM_PROMPT,
        messages: [{ role: 'user', content: evalUserMsg }],
      });
      evalResult = callJson<EvalResult>(
        (msg.content[0] as { type: string; text: string }).text,
      );
    } catch (err) {
      console.log('❌  Eval call failed:', (err as Error).message);
      evalError++;
      continue;
    }

    const score  = evalResult.score ?? 0;
    const issues = evalResult.issues?.join('; ') ?? '';

    if (score >= 7) {
      const { error } = await supabase
        .from('questions')
        .update({ approved: true, flagged: false })
        .eq('id', row.id);
      if (error) { console.log(`❌  DB approve failed: ${error.message}`); evalError++; }
      else { console.log(`✅  score=${score} APPROVED | ${evalResult.reason}`); evalApproved++; }
    } else if (score < 5) {
      const { error } = await supabase
        .from('questions')
        .update({ flagged: true, approved: false })
        .eq('id', row.id);
      if (error) { console.log(`❌  DB flag failed: ${error.message}`); evalError++; }
      else { console.log(`🚩  score=${score} FLAGGED | ${evalResult.reason}${issues ? ' | ' + issues : ''}`); evalFlagged++; }
    } else {
      console.log(`⚠   score=${score} MANUAL REVIEW | ${evalResult.reason}`);
      evalManual++;
    }
  }

  console.log(`\n  Evaluation complete — approved: ${evalApproved}  flagged: ${evalFlagged}  manual review: ${evalManual}  errors: ${evalError}`);

  // ════════════════════════════════════════════════════════════════════════════
  // STEP 4 — COUNT CHECK
  // ════════════════════════════════════════════════════════════════════════════

  console.log('\n' + '═'.repeat(64));
  console.log('STEP 4 — COUNT CHECK: Minimum 5 approved per standard');
  console.log('═'.repeat(64));

  const { data: countRows, error: countErr } = await supabase
    .from('questions')
    .select('standard_id, approved')
    .eq('approved', true);

  if (countErr) { console.error('❌  Count query failed:', countErr.message); }
  else {
    const counts: Record<string, number> = {};
    for (const std of PILOT_STANDARDS) counts[std.code] = 0;
    for (const row of (countRows ?? []) as { standard_id: string; approved: boolean }[]) {
      const std = PILOT_STANDARDS.find((s) => s.id === row.standard_id);
      if (std) counts[std.code]++;
    }

    console.log('');
    for (const [code, count] of Object.entries(counts)) {
      if (count >= 5) {
        console.log(`  ✅  ${code}: ${count} approved questions — ready for pilot`);
      } else {
        const need = 5 - count;
        console.log(`  ⚠   ${code}: only ${count} approved — need ${need} more before pilot`);
      }
    }
  }

  // ════════════════════════════════════════════════════════════════════════════
  // STEP 5 — SUMMARY
  // ════════════════════════════════════════════════════════════════════════════

  console.log('\n' + '═'.repeat(64));
  console.log('STEP 5 — SUMMARY: Approved questions for sanity check');
  console.log('═'.repeat(64));

  const { data: summaryRows, error: summaryErr } = await supabase
    .from('questions')
    .select('standard_id, content, title, approved, flagged, option_a_text')
    .order('standard_id');

  if (summaryErr) { console.error('❌  Summary query failed:', summaryErr.message); return; }

  const finalStats: Record<string, {
    generated: number; approved: number; flagged: number; manual: number; stems: string[];
  }> = {};

  for (const std of PILOT_STANDARDS) {
    finalStats[std.code] = { generated: 0, approved: 0, flagged: 0, manual: 0, stems: [] };
  }

  for (const row of (summaryRows ?? []) as QuestionRow[]) {
    const std = PILOT_STANDARDS.find((s) => s.id === row.standard_id);
    if (!std) continue;
    const s = finalStats[std.code];
    if (row.content?.includes('QUESTION:')) s.generated++;
    if (row.approved) {
      s.approved++;
      const stem = parseField(row.content ?? '', 'QUESTION:');
      if (stem) s.stems.push(stem.slice(0, 90) + (stem.length > 90 ? '…' : ''));
    }
    if (row.flagged) s.flagged++;
    if (!row.approved && !row.flagged && row.content?.includes('QUESTION:')) s.manual++;
  }

  console.log('');
  for (const [code, s] of Object.entries(finalStats)) {
    const std = PILOT_STANDARDS.find((st) => st.code === code)!;
    console.log(`\n  ${code} — ${std.title}`);
    console.log(`  ${'─'.repeat(56)}`);
    console.log(`  Generated: ${s.generated}  |  Approved: ${s.approved}  |  Flagged: ${s.flagged}  |  Manual review: ${s.manual}`);

    if (s.stems.length > 0) {
      console.log(`\n  Approved question stems:`);
      s.stems.forEach((stem, idx) => console.log(`    ${idx + 1}. ${stem}`));
    } else {
      console.log(`\n  ⚠  No approved questions yet — run manual review at /admin/questions`);
    }
  }

  console.log('\n' + '═'.repeat(64));
  console.log('Done. Review manual-queue questions at http://localhost:4028/admin/questions');
  console.log('═'.repeat(64) + '\n');
}

main().catch((err) => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
