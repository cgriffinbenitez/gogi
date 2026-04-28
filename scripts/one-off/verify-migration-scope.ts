import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(process.cwd(), '.env.local') });
import { createClient } from '@supabase/supabase-js';

async function main() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  // Query 1: classification x approval_status breakdown
  const { data: q1, error: e1 } = await supabase
    .from('intervention_passages')
    .select('classification, approval_status')
    .order('classification', { ascending: true });

  if (e1) { console.error('Q1 error:', e1.message); process.exit(1); }

  const agg: Record<string, Record<string, number>> = {};
  for (const row of q1 ?? []) {
    const c = row.classification as string;
    const s = row.approval_status as string;
    if (!agg[c]) agg[c] = {};
    agg[c][s] = (agg[c][s] ?? 0) + 1;
  }

  console.log('\nQuery 1: classification x approval_status');
  console.log('classification                    approval_status       count');
  console.log('─'.repeat(65));
  for (const cls of Object.keys(agg).sort()) {
    for (const status of Object.keys(agg[cls]).sort()) {
      console.log(`${cls.padEnd(33)} ${status.padEnd(21)} ${agg[cls][status]}`);
    }
  }
  const total = Object.values(agg).flatMap(v => Object.values(v)).reduce((a, b) => a + b, 0);
  console.log(`\nTotal rows in intervention_passages: ${total}`);

  // Query 2: mood_misreading rows where tagger_tier IS NULL
  const { data: q2, error: e2 } = await supabase
    .from('intervention_passages')
    .select('id')
    .eq('classification', 'mood_misreading')
    .is('tagger_tier', null);

  if (e2) { console.error('Q2 error:', e2.message); process.exit(1); }
  console.log(`\nQuery 2: mood_misreading WHERE tagger_tier IS NULL → ${(q2 ?? []).length} rows`);
  console.log(`Expected: 14`);
}

main().catch(e => { console.error(e); process.exit(1); });
