/**
 * One-off data migration — clean rogue diagnostic_classification values.
 *
 * FIX 1: abstract_reasoning_deficit → inferencing_deficit
 * FIX 2: 'key' (accidental literal) → null
 *
 * Usage: npx tsx scripts/fixClassifications.ts
 */

import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(process.cwd(), '.env.local') });

import { createClient } from '@supabase/supabase-js';

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('❌  Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  // ── FIX 1: abstract_reasoning_deficit → inferencing_deficit ─────────────────

  const { data: fix1Data, error: fix1Err } = await supabase
    .from('responses')
    .update({ diagnostic_classification: 'inferencing_deficit' })
    .eq('diagnostic_classification', 'abstract_reasoning_deficit')
    .select('id');

  if (fix1Err) {
    console.error('❌  FIX 1 failed:', fix1Err.message);
  } else {
    console.log(`✅  FIX 1: ${fix1Data?.length ?? 0} row(s) updated  abstract_reasoning_deficit → inferencing_deficit`);
  }

  // ── FIX 2: 'key' → null ─────────────────────────────────────────────────────

  const { data: fix2Data, error: fix2Err } = await supabase
    .from('responses')
    .update({ diagnostic_classification: null })
    .eq('diagnostic_classification', 'key')
    .select('id');

  if (fix2Err) {
    console.error('❌  FIX 2 failed:', fix2Err.message);
  } else {
    console.log(`✅  FIX 2: ${fix2Data?.length ?? 0} row(s) updated  'key' → null`);
  }

  // ── Verify: list any remaining non-standard classifications ─────────────────

  const VALID = new Set([
    'schema_deficit', 'no_metacognitive_strategy', 'no_theme_schema', 'no_struct_schema',
    'vocabulary_gap', 'morphology_gap', 'syntax_barrier', 'signal_word_blind',
    'inferencing_deficit', 'evidence_retrieval_failure', 'comprehension_integration_failure',
    'theme_evidence_disconnection', 'purpose_failure', 'concrete_thinking',
    'abstract_reasoning_deficit', 'theme_confusion', 'literal_misreading',
  ]);

  const { data: remaining } = await supabase
    .from('responses')
    .select('diagnostic_classification')
    .not('diagnostic_classification', 'is', null);

  const rogue = [...new Set(
    ((remaining ?? []) as { diagnostic_classification: string }[])
      .map((r) => r.diagnostic_classification)
      .filter((c) => !VALID.has(c)),
  )];

  if (rogue.length > 0) {
    console.log(`\n⚠   Non-standard classification values still present: ${rogue.join(', ')}`);
  } else {
    console.log('\n✅  All classification values are clean.');
  }
}

main().catch((err) => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
