import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(process.cwd(), '.env.local') });
import { createClient } from '@supabase/supabase-js';

async function main() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const { data, error } = await supabase
    .from('intervention_passages')
    .select('id, word_count, intervention_tier')
    .eq('classification', 'mood_misreading')
    .eq('approval_status', 'pending_review')
    .order('word_count', { ascending: true });

  if (error) { console.error('ERROR:', error.message); process.exit(1); }

  console.log('\nid                                     word_count  current_tier  proposed_tier');
  console.log('─'.repeat(80));
  for (const row of data ?? []) {
    const wc = row.word_count as number;
    const proposed = wc < 210 ? 1 : wc < 260 ? 2 : wc < 310 ? 3 : 4;
    const changed = row.intervention_tier !== proposed ? ' ←' : '';
    console.log(
      `${row.id}  ${String(wc).padStart(10)}  ${String(row.intervention_tier).padStart(12)}  ${String(proposed).padStart(13)}${changed}`,
    );
  }
  console.log(`\nTotal rows: ${(data ?? []).length}`);
}

main().catch(e => { console.error(e); process.exit(1); });
