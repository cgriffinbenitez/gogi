/**
 * GOGI — Clinical Classification Tagger
 *
 * Assigns option_a_class through option_d_class and correct_option
 * to all questions that are missing these clinical tags.
 *
 * Steps:
 *   1. Count   — how many questions are missing classification tags
 *   2. Fetch   — load all untagged questions
 *   3. Classify — call Claude per question to assign tags
 *   4. Update  — write tags to DB
 *   5. Verify  — re-count missing tags
 *
 * Usage:
 *   npx tsx scripts/classifyQuestions.ts
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

const BATCH_SIZE     = 5;
const BATCH_DELAY_MS = 2000;
const CALL_TIMEOUT   = 30_000;

// ─── Clients ──────────────────────────────────────────────────────────────────

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const anthropicKey = process.env.ANTHROPIC_API_KEY!;

if (!supabaseUrl || !serviceKey || !anthropicKey) {
  console.error('Missing required env vars. Check .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey);
const client   = new Anthropic({ apiKey: anthropicKey, timeout: CALL_TIMEOUT });

// ─── Types ────────────────────────────────────────────────────────────────────

interface QuestionRow {
  id: string;
  content: string;
  standard_id: string;
  cognitive_skill_targeted: string | null;
  option_a_class: string | null;
  option_b_class: string | null;
  option_c_class: string | null;
  option_d_class: string | null;
  correct_option: string | null;
}

interface ClassificationResult {
  option_a_class: string;
  option_b_class: string;
  option_c_class: string;
  option_d_class: string;
  correct_option: string;
  cognitive_skill_targeted: string;
  standard_alignment: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function extractPassage(content: string): string {
  const qIdx = content.indexOf('\nQUESTION:');
  const raw = qIdx !== -1 ? content.slice(0, qIdx) : content;
  return raw
    .replace(/^PASSAGE:\s*/i, '')
    .replace(/^---\s*/m, '')
    .replace(/\s*---\s*$/m, '')
    .trim();
}

function extractStem(content: string): string {
  const qIdx = content.indexOf('QUESTION:');
  if (qIdx === -1) return '';
  const after = content.slice(qIdx + 'QUESTION:'.length);
  const lines = after.split('\n').map(l => l.trim()).filter(Boolean);
  const stem: string[] = [];
  for (const line of lines) {
    if (/^[A-D][.)]/i.test(line)) break;
    stem.push(line);
  }
  return stem.join(' ').trim();
}

function extractOptions(content: string): { A: string; B: string; C: string; D: string } {
  const options: Record<string, string> = { A: '', B: '', C: '', D: '' };
  const lines = content.split('\n');
  for (const line of lines) {
    const m = line.trimStart().match(/^([A-D])[.)]\s*(.+)/);
    if (m) {
      options[m[1]] = m[2].trim();
    }
  }
  return options as { A: string; B: string; C: string; D: string };
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

// ─── Classify System Prompt ───────────────────────────────────────────────────

const CLASSIFY_SYSTEM = `You are a clinical literacy diagnostic expert. Your job is to analyze an OMC (Ordered Multiple Choice) question and assign a clinical classification to each answer option.

The nine classification categories are:
- correct: This is the correct answer
- schema_deficit: Student lacks background knowledge to approach the text
- no_metacognitive_strategy: Student lacks reading strategy
- vocabulary_gap: Student misunderstands a key vocabulary word
- morphology_gap: Student misunderstands word structure/roots/affixes
- inferencing_deficit: Student cannot draw conclusions from implicit text
- evidence_retrieval_failure: Student cannot locate/use textual evidence
- literal_misreading: Student interprets figurative/implied meaning literally
- theme_confusion: Student confuses plot summary or character action with theme

Respond with valid JSON only — no markdown, no explanation:
{
  "option_a_class": string,
  "option_b_class": string,
  "option_c_class": string,
  "option_d_class": string,
  "correct_option": "A" | "B" | "C" | "D",
  "cognitive_skill_targeted": string,
  "standard_alignment": string
}`;

// ─── Claude call ──────────────────────────────────────────────────────────────

async function classifyQuestion(row: QuestionRow): Promise<ClassificationResult | null> {
  const passage = extractPassage(row.content);
  const stem    = extractStem(row.content);
  const opts    = extractOptions(row.content);

  if (!stem || !opts.A || !opts.B || !opts.C || !opts.D) {
    console.warn(`  [SKIP] ${row.id} — could not parse stem or options`);
    return null;
  }

  const userMsg = [
    `Standard ID: ${row.standard_id}`,
    ``,
    `Passage:`,
    passage,
    ``,
    `Question: ${stem}`,
    ``,
    `A. ${opts.A}`,
    `B. ${opts.B}`,
    `C. ${opts.C}`,
    `D. ${opts.D}`,
  ].join('\n');

  try {
    const res = await client.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 512,
      system: CLASSIFY_SYSTEM,
      messages: [{ role: 'user', content: userMsg }],
    });

    const raw = res.content[0].type === 'text' ? res.content[0].text.trim() : '';
    const jsonStart = raw.indexOf('{');
    const jsonEnd   = raw.lastIndexOf('}');
    if (jsonStart === -1 || jsonEnd === -1) {
      console.warn(`  [PARSE ERROR] ${row.id} — no JSON found in response`);
      return null;
    }

    const parsed = JSON.parse(raw.slice(jsonStart, jsonEnd + 1)) as ClassificationResult;

    // Validate required fields
    const required = ['option_a_class','option_b_class','option_c_class','option_d_class','correct_option'];
    for (const f of required) {
      if (!parsed[f as keyof ClassificationResult]) {
        console.warn(`  [INCOMPLETE] ${row.id} — missing field: ${f}`);
        return null;
      }
    }

    return parsed;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`  [API ERROR] ${row.id} — ${msg}`);
    return null;
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n══════════════════════════════════════════════════════════════');
  console.log('  GOGI — Clinical Classification Tagger');
  console.log('══════════════════════════════════════════════════════════════\n');

  // STEP 1 — Count missing
  console.log('STEP 1 — Counting questions missing classification tags...\n');

  const { data: allRows, error: countErr } = await supabase
    .from('questions')
    .select('id, content, standard_id, cognitive_skill_targeted, option_a_class, option_b_class, option_c_class, option_d_class, correct_option')
    .ilike('content', '%QUESTION:%');

  if (countErr) {
    console.error('DB error:', countErr.message);
    process.exit(1);
  }

  const rows = (allRows ?? []) as unknown as QuestionRow[];
  const untagged = rows.filter(r => !r.option_a_class || !r.correct_option);

  console.log(`  Total questions with QUESTION: block: ${rows.length}`);
  console.log(`  Missing classification tags:          ${untagged.length}`);
  console.log(`  Already tagged:                       ${rows.length - untagged.length}\n`);

  if (untagged.length === 0) {
    console.log('All questions already tagged. Nothing to do.\n');
    process.exit(0);
  }

  // STEP 2–4 — Process in batches
  console.log(`STEP 2 — Classifying ${untagged.length} questions in batches of ${BATCH_SIZE}...\n`);

  let tagged   = 0;
  let failed   = 0;
  const total  = untagged.length;

  for (let i = 0; i < untagged.length; i += BATCH_SIZE) {
    const batch     = untagged.slice(i, i + BATCH_SIZE);
    const batchNum  = Math.floor(i / BATCH_SIZE) + 1;
    const batchTotal = Math.ceil(untagged.length / BATCH_SIZE);

    if (i > 0) {
      process.stdout.write(`\n  Waiting ${BATCH_DELAY_MS}ms before next batch...\n\n`);
      await sleep(BATCH_DELAY_MS);
    }

    console.log(`  Batch ${batchNum}/${batchTotal} (questions ${i + 1}–${Math.min(i + BATCH_SIZE, total)} of ${total})`);

    const results = await Promise.all(
      batch.map(async (row) => {
        const stem = extractStem(row.content);
        const label = stem.slice(0, 60) + (stem.length > 60 ? '…' : '');

        const result = await classifyQuestion(row);

        if (!result) {
          console.log(`  [${String(i + batch.indexOf(row) + 1).padStart(2)}/${total}] ${label} — ❌ failed`);
          return { row, result: null };
        }

        console.log(`  [${String(i + batch.indexOf(row) + 1).padStart(2)}/${total}] ${label} — ✅ tagged`);
        return { row, result };
      })
    );

    // Write to DB sequentially to avoid rate issues
    for (const { row, result } of results) {
      if (!result) {
        failed++;
        continue;
      }

      const { error: updateErr } = await supabase
        .from('questions')
        .update({
          option_a_class:           result.option_a_class,
          option_b_class:           result.option_b_class,
          option_c_class:           result.option_c_class,
          option_d_class:           result.option_d_class,
          correct_option:           result.correct_option,
          cognitive_skill_targeted: result.cognitive_skill_targeted ?? row.cognitive_skill_targeted,
        })
        .eq('id', row.id);

      if (updateErr) {
        console.warn(`  [DB ERROR] ${row.id} — ${updateErr.message}`);
        failed++;
      } else {
        tagged++;
      }
    }
  }

  // STEP 5 — Verify
  console.log('\n══════════════════════════════════════════════════════════════');
  console.log('  STEP 5 — Verification');
  console.log('══════════════════════════════════════════════════════════════\n');

  const { data: verifyRows } = await supabase
    .from('questions')
    .select('id, option_a_class, correct_option')
    .ilike('content', '%QUESTION:%');

  const verifyAll    = (verifyRows ?? []) as unknown as QuestionRow[];
  const stillMissing = verifyAll.filter(r => !r.option_a_class || !r.correct_option);

  console.log(`  Total questions with QUESTION: block: ${verifyAll.length}`);
  console.log(`  Successfully tagged this run:          ${tagged}`);
  console.log(`  Failed this run:                       ${failed}`);
  console.log(`  Still missing classification tags:     ${stillMissing.length}`);

  if (stillMissing.length === 0) {
    console.log('\n  ✅ All questions fully classified. Diagnostic engine ready.\n');
  } else {
    console.log(`\n  ⚠️  ${stillMissing.length} question(s) still need manual review.\n`);
    console.log('  Missing IDs:');
    for (const r of stillMissing) {
      console.log(`    ${r.id}`);
    }
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
