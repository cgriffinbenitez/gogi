import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(process.cwd(), '.env.local') });
import { createClient } from '@supabase/supabase-js';

async function main() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Step 1: fetch passage IDs that were promoted for tone_misreading
  const { data: passages, error: fetchErr } = await supabase
    .from('intervention_passages')
    .select('id')
    .eq('classification', 'tone_misreading')
    .eq('question_generated', true);

  if (fetchErr) { console.error('Fetch passages failed:', fetchErr.message); process.exit(1); }
  console.log(`Passages to reset: ${passages?.length ?? 0}`);

  // Step 2: delete questions
  const { error: delErr, count } = await supabase
    .from('questions')
    .delete({ count: 'exact' })
    .eq('pipeline_source', 'v3_promoted')
    .eq('source_classification', 'tone_misreading');

  if (delErr) { console.error('Delete failed:', delErr.message); process.exit(1); }
  console.log(`Questions deleted: ${count}`);

  // Step 3: reset question_generated on passages
  const { error: resetErr, count: resetCount } = await supabase
    .from('intervention_passages')
    .update({ question_generated: false })
    .eq('classification', 'tone_misreading')
    .eq('question_generated', true);

  if (resetErr) { console.error('Reset failed:', resetErr.message); process.exit(1); }
  console.log(`Passages reset: ${resetCount}`);
}

main().catch(e => { console.error(e); process.exit(1); });
