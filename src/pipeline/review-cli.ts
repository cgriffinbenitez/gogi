#!/usr/bin/env node
/**
 * GOGI Passage Review CLI
 * Usage: npm run review-passages -- --classification mood_misreading
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config();

import readline from 'readline';
import { createClient } from '@supabase/supabase-js';

// ─── Types ────────────────────────────────────────────────────────────────────

interface PassageRow {
  id: string;
  classification: string;
  paragraph_text: string;
  word_count: number;
  source_title: string | null;
  source_author: string | null;
  source_year: number | null;
  canonical_answer: string | null;
  distractors: string[] | null;
  keyword_flags: string[] | null;
  difficulty_tier: number | null;
  approved: boolean;
}

// ─── Help ─────────────────────────────────────────────────────────────────────

function printHelp() {
  console.log(`
GOGI Passage Review CLI

Usage:
  npm run review-passages -- --classification <name> [options]

Options:
  --classification  Required.
  --limit           Max passages to review in this session (default: 50).
  --help            Show this help.

Actions during review:
  (a) approve    Mark approved=true
  (r) reject     Prompt for rejection reason, then update
  (e) edit-tags  Edit canonical_answer / distractors / keyword_flags, then approve
  (s) skip       Move on without changing the row
  (q) quit       Exit loop
`);
}

// ─── Arg parsing ──────────────────────────────────────────────────────────────

function parseArgs(argv: string[]): { classification: string; limit: number } | null {
  const args = argv.slice(2);
  if (args.includes('--help') || args.includes('-h')) { printHelp(); process.exit(0); }

  const classIdx = args.indexOf('--classification');
  if (classIdx === -1 || !args[classIdx + 1]) {
    console.error('Error: --classification is required.\n');
    printHelp();
    return null;
  }

  const limitIdx = args.indexOf('--limit');
  const limit = limitIdx !== -1 && args[limitIdx + 1]
    ? parseInt(args[limitIdx + 1], 10)
    : 50;

  return { classification: args[classIdx + 1], limit: isNaN(limit) ? 50 : limit };
}

// ─── Supabase ─────────────────────────────────────────────────────────────────

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('Missing Supabase env vars');
  return createClient(url, key);
}

// ─── Terminal helpers ─────────────────────────────────────────────────────────

function clearLine() {
  process.stdout.write('\r\x1b[K');
}

function singleKey(): Promise<string> {
  return new Promise(resolve => {
    const stdin = process.stdin;
    const wasRaw = stdin.isTTY;

    if (wasRaw) stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');

    const handler = (key: string) => {
      stdin.removeListener('data', handler);
      if (wasRaw) stdin.setRawMode(false);
      stdin.pause();
      clearLine();
      resolve(key);
    };
    stdin.on('data', handler);
  });
}

function prompt(question: string): Promise<string> {
  return new Promise(resolve => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: true,
    });
    rl.question(question, answer => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

// ─── Display ──────────────────────────────────────────────────────────────────

function displayPassage(row: PassageRow, index: number, total: number) {
  const tierLabel = row.difficulty_tier ? `tier ${row.difficulty_tier}` : 'tier ?';
  console.log('\n' + '─'.repeat(70));
  console.log(
    `[${index + 1} of ${total}]  ${row.source_title ?? '(no title)'}` +
    (row.source_author ? ` by ${row.source_author}` : '') +
    (row.source_year ? ` (${row.source_year})` : ''),
  );
  console.log(`[difficulty: ${tierLabel}]  [${row.word_count} words]`);
  console.log('─'.repeat(70));
  console.log(`\n${row.paragraph_text}\n`);
  console.log(`canonical_answer: ${JSON.stringify(row.canonical_answer ?? null)}`);
  console.log(`distractors:      ${JSON.stringify(row.distractors ?? [])}`);
  console.log(`keyword_flags:    ${JSON.stringify(row.keyword_flags ?? [])}`);
  console.log('\n  (a)pprove  (r)eject  (e)dit-tags  (s)kip  (q)uit\n');
}

// ─── Actions ──────────────────────────────────────────────────────────────────

async function doApprove(supabase: ReturnType<typeof getSupabase>, id: string) {
  const { error } = await supabase
    .from('intervention_passages')
    .update({ approved: true, reviewed_at: new Date().toISOString() })
    .eq('id', id);
  if (error) console.error('  DB error:', error.message);
  else console.log('  ✓ approved');
}

async function doReject(supabase: ReturnType<typeof getSupabase>, id: string) {
  const reason = await prompt('  Rejection reason: ');
  const { error } = await supabase
    .from('intervention_passages')
    .update({ rejection_reason: reason })
    .eq('id', id);
  if (error) console.error('  DB error:', error.message);
  else console.log('  ✓ rejected');
}

async function doEditTags(supabase: ReturnType<typeof getSupabase>, id: string, row: PassageRow) {
  const canonical = await prompt(`  canonical_answer [${row.canonical_answer ?? ''}]: `);
  const distractorsRaw = await prompt(
    `  distractors (comma-separated) [${(row.distractors ?? []).join(', ')}]: `,
  );
  const keywordsRaw = await prompt(
    `  keyword_flags (comma-separated) [${(row.keyword_flags ?? []).join(', ')}]: `,
  );

  const updates = {
    approved:        true,
    reviewed_at:     new Date().toISOString(),
    canonical_answer: canonical || row.canonical_answer,
    distractors:     distractorsRaw
      ? distractorsRaw.split(',').map((s: string) => s.trim()).filter(Boolean)
      : row.distractors,
    keyword_flags:   keywordsRaw
      ? keywordsRaw.split(',').map((s: string) => s.trim()).filter(Boolean)
      : row.keyword_flags,
  };

  const { error } = await supabase
    .from('intervention_passages')
    .update(updates)
    .eq('id', id);
  if (error) console.error('  DB error:', error.message);
  else console.log('  ✓ edited and approved');
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const opts = parseArgs(process.argv);
  if (!opts) { process.exit(1); }

  const supabase = getSupabase();
  const { classification, limit } = opts;

  const { data, error } = await supabase
    .from('intervention_passages')
    .select('id, classification, paragraph_text, word_count, source_title, source_author, source_year, canonical_answer, distractors, keyword_flags, difficulty_tier, approved')
    .eq('classification', classification)
    .eq('approved', false)
    .is('rejection_reason', null)
    .order('created_at', { ascending: true })
    .limit(limit);

  if (error) { console.error('DB error:', error.message); process.exit(1); }
  if (!data || data.length === 0) {
    console.log(`No unapproved passages found for "${classification}".`);
    return;
  }

  const rows = data as PassageRow[];
  console.log(`\nLoaded ${rows.length} unapproved passages for "${classification}".`);

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    displayPassage(row, i, rows.length);

    const key = (await singleKey()).toLowerCase();

    if (key === 'q' || key === '\u0003' /* Ctrl+C */) {
      console.log('\nQuitting.');
      break;
    }
    if (key === 's') { console.log('  skipped'); continue; }
    if (key === 'a') { await doApprove(supabase, row.id); continue; }
    if (key === 'r') { await doReject(supabase, row.id); continue; }
    if (key === 'e') { await doEditTags(supabase, row.id, row); continue; }

    console.log(`  unknown key "${key}" — skipping`);
  }

  console.log('\nReview session complete.\n');
}

main().catch(err => {
  console.error('[review-cli] fatal error:', err);
  process.exit(1);
});
