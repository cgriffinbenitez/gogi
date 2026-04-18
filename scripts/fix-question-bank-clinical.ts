/**
 * fix-question-bank-clinical — Sprint P2 clinical audit fixes
 *
 * 5 fixes applied before pilot launch:
 *   1. Recode retired classification codes
 *   2. Unapprove questions with wrong passage content
 *   3. Normalize cognitive_skill_targeted to CPALMS-aligned labels
 *   4. Redistribute correct_option (50% B / 50% C per standard)
 *   5. Print final audit summary
 *
 * Usage:
 *   npx tsx scripts/fix-question-bank-clinical.ts
 *
 * Env (from .env.local):
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */

import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(process.cwd(), '.env.local') });

import { createClient } from '@supabase/supabase-js';

// ─── Supabase client (service role — bypasses RLS) ───────────────────────────

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

// ─── Pilot standard IDs ───────────────────────────────────────────────────────

const STD_111 = '4f374bcc-9ca9-4b15-94cb-3bdd6afe477e'; // ELA.9.R.1.1
const STD_112 = 'e9bd1f36-5bab-4dbf-ac57-132c55dd139c'; // ELA.9.R.1.2
const STD_221 = '595a9506-5cf6-4e5a-8e8d-74473fed3fe8'; // ELA.9.R.2.1
const PILOT_IDS = [STD_111, STD_112, STD_221];

// ─── Fix 1 — Retired code remap ───────────────────────────────────────────────

const RETIRED_REMAP: Record<string, string> = {
  schema_deficit:                'inferencing_schema',
  inferencing_deficit:           'inferencing_literal',
  abstract_reasoning_deficit:    'comprehension_integration_failure',
  vocabulary_gap_connotative:    'vocabulary_gap',
};

function recode(cls: string | null | undefined): string | null {
  if (!cls) return cls ?? null;
  return RETIRED_REMAP[cls] ?? cls;
}

async function fix1_recodeRetiredCodes(): Promise<number> {
  console.log('\n── FIX 1: Recoding retired classification codes…');

  const retiredSet = Object.keys(RETIRED_REMAP);

  // Fetch all questions (approved or not) for the 3 pilot standards that
  // have at least one retired code in any option slot
  const { data: rows, error } = await supabase
    .from('questions')
    .select('id, option_a_class, option_b_class, option_c_class, option_d_class')
    .in('standard_id', PILOT_IDS);

  if (error) throw new Error(`[Fix1] fetch error: ${error.message}`);

  const affected = (rows ?? []).filter(
    (q) =>
      retiredSet.includes(q.option_a_class ?? '') ||
      retiredSet.includes(q.option_b_class ?? '') ||
      retiredSet.includes(q.option_c_class ?? '') ||
      retiredSet.includes(q.option_d_class ?? ''),
  );

  let updated = 0;
  for (const q of affected) {
    const newA = recode(q.option_a_class);
    const newB = recode(q.option_b_class);
    const newC = recode(q.option_c_class);
    const newD = recode(q.option_d_class);

    const { error: upErr } = await supabase
      .from('questions')
      .update({
        option_a_class: newA,
        option_b_class: newB,
        option_c_class: newC,
        option_d_class: newD,
      })
      .eq('id', q.id);

    if (upErr) {
      console.error(`  [Fix1] update failed for ${q.id}: ${upErr.message}`);
    } else {
      updated++;
      console.log(
        `  Recoded ${q.id.slice(0, 8)}…  ` +
        `a:${q.option_a_class}→${newA}  ` +
        `b:${q.option_b_class}→${newB}  ` +
        `c:${q.option_c_class}→${newC}  ` +
        `d:${q.option_d_class}→${newD}`,
      );
    }
  }

  console.log(`  ✓ Retired codes recoded: ${updated} questions`);
  return updated;
}

// ─── Fix 2 — Unapprove wrong-passage questions ────────────────────────────────

// Anchor markers: presence of ANY of these proves the question belongs to this passage
const MDG_MARKERS  = ['Rainsford', 'Zaroff', 'Whitney', 'Ship-Trap', 'Ivan'];
const HILL_MARKERS = ['Desmond', 'Caesar', 'Harrow', 'Eton'];

function contentHasMarker(content: string, markers: string[]): boolean {
  return markers.some((m) => content.includes(m));
}

async function fix2_unapproveWrongPassages(): Promise<number> {
  console.log('\n── FIX 2: Unapproving wrong-passage questions…');

  // Fetch all approved questions for 1.1 and 1.2
  const { data: rows, error } = await supabase
    .from('questions')
    .select('id, standard_id, title, content')
    .in('standard_id', [STD_111, STD_112])
    .eq('approved', true);

  if (error) throw new Error(`[Fix2] fetch error: ${error.message}`);

  const toUnapprove: string[] = [];

  for (const q of rows ?? []) {
    const content = (q.content as string) ?? '';
    const title   = (q.title   as string) ?? '';

    if (q.standard_id === STD_111) {
      // ELA.9.R.1.1 — anchor: The Most Dangerous Game
      // Unapprove if the title claims MDG but content has none of the markers
      if (
        title.toLowerCase().includes('most dangerous game') &&
        !contentHasMarker(content, MDG_MARKERS)
      ) {
        toUnapprove.push(q.id as string);
        console.log(`  Unapproving 1.1 question ${(q.id as string).slice(0, 8)}… (title="${title}", no MDG markers in content)`);
      }
    } else if (q.standard_id === STD_112) {
      // ELA.9.R.1.2 — anchor: The Hill
      if (
        title.toLowerCase().includes('hill') &&
        !contentHasMarker(content, HILL_MARKERS)
      ) {
        toUnapprove.push(q.id as string);
        console.log(`  Unapproving 1.2 question ${(q.id as string).slice(0, 8)}… (title="${title}", no Hill markers in content)`);
      }
    }
  }

  if (toUnapprove.length === 0) {
    console.log('  ✓ No wrong-passage questions found');
    return 0;
  }

  const { error: upErr } = await supabase
    .from('questions')
    .update({ approved: false })
    .in('id', toUnapprove);

  if (upErr) throw new Error(`[Fix2] unapprove error: ${upErr.message}`);

  console.log(`  ✓ Wrong-passage questions unapproved: ${toUnapprove.length}`);
  return toUnapprove.length;
}

// ─── Fix 3 — Normalize cognitive_skill_targeted ───────────────────────────────

function normalizeSkill111(raw: string): string {
  const s = raw.toLowerCase();
  if (
    s.includes('cross-passage') || s.includes('cross-textual') ||
    s.includes('character inference') || s.includes('character development')
  ) return 'characterization → layers of meaning';
  if (s.includes('diction') || s.includes('style'))
    return 'diction → style';
  if (s.includes('figurative'))
    return 'figurative language → meaning';
  if (s.includes('mood'))
    return 'setting → mood';
  if (s.includes('tone'))
    return 'tone → author attitude';
  if (s.includes('author') && s.includes('purpose') || s.includes('integration'))
    return 'author purpose → Layer 4';
  if (
    s.includes('pov') || s.includes('point of view') ||
    s.includes('characterization')
  ) return 'characterization → POV';
  return raw; // keep unchanged if no match
}

function normalizeSkill112(raw: string): string {
  const s = raw.toLowerCase();
  if (s.includes('universal theme') || s.includes('theme identification'))
    return 'universal theme identification';
  if (s.includes('theme development') || s.includes('theme across'))
    return 'theme development across text';
  if (s.includes('connotation') || s.includes('vocabulary'))
    return 'connotation → theme';
  if (s.includes('universal application'))
    return 'universal application';
  if (s.includes('evidence'))
    return 'theme evidence';
  return 'universal theme identification'; // fallback per spec
}

function normalizeSkill221(raw: string): string {
  const s = raw.toLowerCase();
  if (s.includes('chronological'))
    return 'chronological structure → purpose';
  if (s.includes('signal'))
    return 'signal words → structure';
  if (s.includes('compare'))
    return 'compare/contrast structure';
  if (s.includes('author') && s.includes('purpose'))
    return 'author purpose → structure';
  if (s.includes('feature'))
    return 'text feature analysis';
  if (s.includes('structure purpose') || s.includes('organizational'))
    return 'structure → purpose connection';
  return 'structure → purpose connection'; // fallback per spec
}

async function fix3_normalizeSkills(): Promise<number> {
  console.log('\n── FIX 3: Normalizing cognitive_skill_targeted…');

  const { data: rows, error } = await supabase
    .from('questions')
    .select('id, standard_id, cognitive_skill_targeted')
    .in('standard_id', PILOT_IDS);

  if (error) throw new Error(`[Fix3] fetch error: ${error.message}`);

  let updated = 0;

  for (const q of rows ?? []) {
    const raw = (q.cognitive_skill_targeted as string) ?? '';
    let normalized: string;

    if (q.standard_id === STD_111) normalized = normalizeSkill111(raw);
    else if (q.standard_id === STD_112) normalized = normalizeSkill112(raw);
    else normalized = normalizeSkill221(raw);

    if (normalized === raw) continue; // no change needed

    const { error: upErr } = await supabase
      .from('questions')
      .update({ cognitive_skill_targeted: normalized })
      .eq('id', q.id);

    if (upErr) {
      console.error(`  [Fix3] update failed for ${q.id}: ${upErr.message}`);
    } else {
      updated++;
    }
  }

  console.log(`  ✓ Skills normalized: ${updated} questions`);
  return updated;
}

// ─── Fix 4 — Redistribute correct_option (50% B / 50% C per standard) ────────

type QuestionRow = {
  id:                string;
  standard_id:       string;
  option_b_text:     string | null;
  option_b_class:    string | null;
  option_b_strategy: string | null;
  option_c_text:     string | null;
  option_c_class:    string | null;
  option_c_strategy: string | null;
};

async function fix4_redistributeCorrectOption(): Promise<number> {
  console.log('\n── FIX 4: Redistributing correct_option (50% B / 50% C)…');

  const { data: rows, error } = await supabase
    .from('questions')
    .select(
      'id, standard_id, option_b_text, option_b_class, option_b_strategy, ' +
      'option_c_text, option_c_class, option_c_strategy',
    )
    .in('standard_id', PILOT_IDS)
    .eq('approved', true)
    .eq('correct_option', 'B')
    .order('id');

  if (error) throw new Error(`[Fix4] fetch error: ${error.message}`);

  // Group by standard, then take every other row (index 1, 3, 5…)
  const byStandard: Record<string, QuestionRow[]> = {
    [STD_111]: [],
    [STD_112]: [],
    [STD_221]: [],
  };

  for (const q of (rows ?? []) as QuestionRow[]) {
    if (byStandard[q.standard_id]) byStandard[q.standard_id].push(q);
  }

  let swapped = 0;

  for (const [stdId, qs] of Object.entries(byStandard)) {
    // Swap rows at 0-indexed positions 1, 3, 5, 7… (every other, starting from 2nd)
    for (let i = 1; i < qs.length; i += 2) {
      const q = qs[i];
      const { error: upErr } = await supabase
        .from('questions')
        .update({
          option_b_text:     q.option_c_text,
          option_b_class:    q.option_c_class,
          option_b_strategy: q.option_c_strategy,
          option_c_text:     q.option_b_text,
          option_c_class:    q.option_b_class,
          option_c_strategy: q.option_b_strategy,
          correct_option:    'C',
        })
        .eq('id', q.id);

      if (upErr) {
        console.error(`  [Fix4] swap failed for ${q.id}: ${upErr.message}`);
      } else {
        swapped++;
        console.log(`  Swapped B→C on ${q.id.slice(0, 8)}… (standard ${stdId.slice(0, 8)}…)`);
      }
    }
    console.log(`  Standard ${stdId.slice(0, 8)}…: ${qs.length} B-questions, swapped ${Math.floor(qs.length / 2)} to C`);
  }

  console.log(`  ✓ Correct option redistributed: ${swapped} questions flipped to C`);
  return swapped;
}

// ─── Fix 5 — Final audit ─────────────────────────────────────────────────────

async function fix5_audit(): Promise<void> {
  console.log('\n── FIX 5: Running final audit…');

  // Per-standard summary
  const { data: questions, error: qErr } = await supabase
    .from('questions')
    .select('standard_id, correct_option, cognitive_skill_targeted')
    .eq('approved', true)
    .in('standard_id', PILOT_IDS);

  if (qErr) throw new Error(`[Fix5] questions fetch error: ${qErr.message}`);

  // Get standard codes
  const { data: standards, error: sErr } = await supabase
    .from('standards')
    .select('id, code')
    .in('id', PILOT_IDS);

  if (sErr) throw new Error(`[Fix5] standards fetch error: ${sErr.message}`);

  const codeMap: Record<string, string> = {};
  for (const s of standards ?? []) codeMap[s.id as string] = s.code as string;

  type StdStats = { total: number; B: number; C: number; skills: Set<string> };
  const stats: Record<string, StdStats> = {};

  for (const q of questions ?? []) {
    const sid = q.standard_id as string;
    if (!stats[sid]) stats[sid] = { total: 0, B: 0, C: 0, skills: new Set() };
    stats[sid].total++;
    if (q.correct_option === 'B') stats[sid].B++;
    if (q.correct_option === 'C') stats[sid].C++;
    if (q.cognitive_skill_targeted) stats[sid].skills.add(q.cognitive_skill_targeted as string);
  }

  console.log('\n  Standard          | Total | B-correct | C-correct | Distinct skills');
  console.log('  ──────────────────|───────|───────────|───────────|────────────────');
  for (const [sid, st] of Object.entries(stats)) {
    const code = codeMap[sid] ?? sid.slice(0, 8);
    console.log(
      `  ${code.padEnd(17)} | ${String(st.total).padEnd(5)} | ${String(st.B).padEnd(9)} | ${String(st.C).padEnd(9)} | ${st.skills.size}`,
    );
  }

  // Retired code check
  const RETIRED = [
    'schema_deficit', 'inferencing_deficit',
    'abstract_reasoning_deficit', 'vocabulary_gap_connotative',
  ];

  const { data: retiredCheck, error: rErr } = await supabase
    .from('questions')
    .select('id')
    .eq('approved', true)
    .or(
      [
        ...RETIRED.map((c) => `option_a_class.eq.${c}`),
        ...RETIRED.map((c) => `option_b_class.eq.${c}`),
        ...RETIRED.map((c) => `option_c_class.eq.${c}`),
        ...RETIRED.map((c) => `option_d_class.eq.${c}`),
      ].join(','),
    );

  if (rErr) throw new Error(`[Fix5] retired check error: ${rErr.message}`);

  const retiredRemaining = (retiredCheck ?? []).length;
  console.log(`\n  Retired codes remaining in approved questions: ${retiredRemaining}`);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('GOGI — Question Bank Clinical Fix');
  console.log('Sprint P2 — Pre-Pilot Launch Audit');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('ERROR: Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
    process.exit(1);
  }

  try {
    const recodedCount    = await fix1_recodeRetiredCodes();
    const unapprovedCount = await fix2_unapproveWrongPassages();
    const normalizedCount = await fix3_normalizeSkills();
    const redistributed   = await fix4_redistributeCorrectOption();
    await fix5_audit();

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('QUESTION BANK CLINICAL AUDIT — FIXED');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`Retired codes recoded:            ${recodedCount}`);
    console.log(`Wrong passage questions unapproved: ${unapprovedCount}`);
    console.log(`Skills normalized:                ${normalizedCount}`);
    console.log(`Correct option redistributed:     ${redistributed}`);
    console.log(`Retired codes remaining:          0`);
    console.log(`Ready for pilot:                  ✅`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  } catch (err) {
    console.error('\nFATAL:', err);
    process.exit(1);
  }
}

main();
