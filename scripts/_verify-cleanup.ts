import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(process.cwd(), '.env.local') });
import { createClient } from '@supabase/supabase-js';

async function main() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { count: qCount } = await supabase
    .from('questions')
    .select('*', { count: 'exact', head: true })
    .eq('pipeline_source', 'v3_promoted')
    .eq('source_classification', 'tone_misreading');

  const { count: pGenTrue } = await supabase
    .from('intervention_passages')
    .select('*', { count: 'exact', head: true })
    .eq('classification', 'tone_misreading')
    .eq('question_generated', true);

  const { count: pQueue } = await supabase
    .from('intervention_passages')
    .select('*', { count: 'exact', head: true })
    .eq('classification', 'tone_misreading')
    .in('approval_status', ['approved', 'pending_review'])
    .in('pipeline_version', ['v3', 'v4'])
    .or('question_generated.is.null,question_generated.eq.false');

  console.log(`Remaining tone questions in DB: ${qCount}`);
  console.log(`Passages still marked question_generated=true: ${pGenTrue}`);
  console.log(`Passages in promotion queue: ${pQueue}`);
}

main().catch(e => { console.error(e); process.exit(1); });
