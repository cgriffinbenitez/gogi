/**
 * Seed script — Passage Library
 *
 * Populates the questions table with Gutenberg passages for all three pilot standards.
 * Requires the dev server to be running on port 4028.
 *
 * Usage:
 *   npx tsx scripts/seed-passages.ts
 *
 * Environment variables (loaded from .env.local if present):
 *   NEXT_PUBLIC_SUPABASE_URL
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY  (or SUPABASE_SERVICE_ROLE_KEY for bypass of RLS)
 */

import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(process.cwd(), '.env.local') });

import { createClient } from '@supabase/supabase-js';

// ─── Config ───────────────────────────────────────────────────────────────────

const PILOT_STANDARD_CODES = ['ELA.9.R.1.1', 'ELA.9.R.1.2', 'ELA.9.R.2.1'];
const API_BASE = process.env.SEED_API_BASE ?? 'http://localhost:4028';

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error(
      'Error: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY (or SUPABASE_SERVICE_ROLE_KEY) must be set.',
    );
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  // Look up standard IDs for the three pilot standards
  console.log('Looking up pilot standard IDs...');
  const { data: standards, error: standardsError } = await supabase
    .from('standards')
    .select('id, code, title')
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
  for (const s of standards) {
    console.log(`  ${s.code} — ${s.title} (id: ${s.id})`);
  }
  console.log('');

  // Seed each standard
  for (const standard of standards) {
    console.log(`${'─'.repeat(60)}`);
    console.log(`Seeding: ${standard.code} — ${standard.title}`);
    console.log(`${'─'.repeat(60)}`);

    const res = await fetch(`${API_BASE}/api/gutenberg`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'seed', standard_id: standard.id }),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error(`  HTTP ${res.status} — ${text}`);
      continue;
    }

    const result = await res.json();

    if (!result.success) {
      console.error(`  Seed failed: ${result.error}`);
      continue;
    }

    console.log(`  Books processed:   ${result.booksProcessed}`);
    console.log(`  Passages inserted: ${result.passagesInserted}`);
    console.log('  Log:');
    for (const entry of result.log as string[]) {
      console.log(`    ${entry}`);
    }
    console.log('');
  }

  console.log('Done.');
}

main().catch((err) => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
