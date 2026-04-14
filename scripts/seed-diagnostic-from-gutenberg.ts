/**
 * Seed script — Diagnostic Question Generator
 *
 * Pulls real passages from the existing Gutenberg library in the questions table
 * and uses Claude to generate 5 properly designed diagnostic questions per standard.
 * These become the official GOGI diagnostic assessment (difficulty_level = 0).
 *
 * Requires the dev server to be running on port 4028.
 *
 * Usage:
 *   npx tsx scripts/seed-diagnostic-from-gutenberg.ts
 *
 * Environment variables (loaded from .env.local):
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */

import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(process.cwd(), '.env.local') });

import { createClient } from '@supabase/supabase-js';

// ─── Config ───────────────────────────────────────────────────────────────────

const PILOT_STANDARD_CODES = ['ELA.9.R.1.1', 'ELA.9.R.1.2', 'ELA.9.R.2.1'];
const API_BASE = process.env.SEED_API_BASE ?? 'http://localhost:4028';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Standard {
  id: string;
  code: string;
  title: string;
  cognitive_domain: string;
}

interface Passage {
  id: string;
  content: string;
  difficulty_level: number;
}

interface DiagnosticQuestion {
  content: string;
  cognitive_skill_targeted: string;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('Error: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  // ── Step 1: Look up pilot standard IDs ──────────────────────────────────────

  console.log('Looking up pilot standard IDs...');
  const { data: standards, error: standardsError } = await supabase
    .from('standards')
    .select('id, code, title, cognitive_domain')
    .in('code', PILOT_STANDARD_CODES);

  if (standardsError) {
    console.error('Error fetching standards:', standardsError.message);
    process.exit(1);
  }

  if (!standards || standards.length === 0) {
    console.error('No pilot standards found in the database. Have you run the standards seed?');
    process.exit(1);
  }

  console.log(`Found ${standards.length} standard(s):\n`);
  for (const s of standards as Standard[]) {
    console.log(`  ${s.code} — ${s.title} (id: ${s.id})`);
  }
  console.log('');

  // ── Process each standard ───────────────────────────────────────────────────

  for (const standard of standards as Standard[]) {
    console.log(`${'─'.repeat(60)}`);
    console.log(`Processing: ${standard.code} — ${standard.title}`);
    console.log(`${'─'.repeat(60)}`);

    // ── Step 1: Pull passages from the Gutenberg library ────────────────────

    const { data: passages, error: passagesError } = await supabase
      .from('questions')
      .select('id, content, difficulty_level')
      .eq('standard_id', standard.id)
      .gt('difficulty_level', 0)
      .order('difficulty_level', { ascending: true });

    if (passagesError) {
      console.error(`  Error fetching passages: ${passagesError.message}`);
      continue;
    }

    if (!passages || passages.length === 0) {
      console.error(`  No passages found for ${standard.code}. Skipping.`);
      continue;
    }

    const level1Passage = (passages as Passage[]).find((p) => p.difficulty_level === 1);
    const level2Passage = (passages as Passage[]).find((p) => p.difficulty_level === 2);

    if (!level1Passage || !level2Passage) {
      console.error(
        `  Missing passage(s) for ${standard.code} — need one at level 1 and one at level 2. Skipping.`,
      );
      console.error(
        `  Found difficulty levels: ${[...new Set((passages as Passage[]).map((p) => p.difficulty_level))].join(', ')}`,
      );
      continue;
    }

    console.log(`  Passage 1 (difficulty 1): id=${level1Passage.id}`);
    console.log(`  Passage 2 (difficulty 2): id=${level2Passage.id}`);

    // ── Step 2: Generate diagnostic questions via Claude ─────────────────────

    console.log(`  Calling Claude to generate 5 diagnostic questions...`);

    const res = await fetch(`${API_BASE}/api/claude`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'generate_diagnostic_questions',
        standardCode: standard.code,
        standardTitle: standard.title,
        cognitiveDomain: standard.cognitive_domain ?? '',
        passage1Text: level1Passage.content,
        passage2Text: level2Passage.content,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error(`  HTTP ${res.status} — ${text}`);
      continue;
    }

    const result = await res.json();

    if (!result.text) {
      console.error(`  Claude returned no text. Skipping.`);
      continue;
    }

    // ── Step 3: Parse Claude's JSON response ─────────────────────────────────

    let questions: DiagnosticQuestion[];
    try {
      // Strip markdown code fences if Claude wrapped the JSON
      const raw = result.text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
      questions = JSON.parse(raw);
    } catch (parseErr) {
      console.error(`  Failed to parse Claude response as JSON:`, parseErr);
      console.error(`  Raw response:\n${result.text}`);
      continue;
    }

    if (!Array.isArray(questions) || questions.length === 0) {
      console.error(`  Claude returned an empty or non-array response. Skipping.`);
      continue;
    }

    console.log(`  Parsed ${questions.length} question(s) from Claude.`);

    // ── Step 3: Insert diagnostic questions into the questions table ─────────

    let insertedCount = 0;
    for (const q of questions) {
      if (!q.content || !q.cognitive_skill_targeted) {
        console.warn(`  Skipping malformed question (missing content or cognitive_skill_targeted)`);
        continue;
      }

      const { error: insertError } = await supabase.from('questions').insert({
        standard_id: standard.id,
        content: q.content,
        cognitive_skill_targeted: q.cognitive_skill_targeted,
        difficulty_level: 0,
        created_at: new Date().toISOString(),
      });

      if (insertError) {
        console.error(`  Insert error: ${insertError.message}`);
      } else {
        insertedCount++;
      }
    }

    console.log(`  Questions inserted: ${insertedCount} / ${questions.length}`);
    console.log('');
  }

  console.log('Done.');
}

main().catch((err) => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
