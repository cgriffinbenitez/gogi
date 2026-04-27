import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(process.cwd(), '.env.local') });
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

async function main() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data, error } = await supabase
    .from('questions')
    .select([
      'id', 'content',
      'option_a_text', 'option_a_class',
      'option_b_text', 'option_b_class',
      'option_c_text', 'option_c_class',
      'option_d_text', 'option_d_class',
      'correct_option', 'rationale',
      'author', 'title',
      'difficulty_level', 'source_classification', 'created_at',
    ].join(', '))
    .eq('pipeline_source', 'v3_promoted')
    .eq('source_classification', 'tone_misreading')
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) { console.error('ERROR:', error.message); process.exit(1); }
  fs.writeFileSync('/tmp/tone_questions_audit.json', JSON.stringify(data, null, 2), 'utf8');
  console.log('rows written:', data?.length);
}

main().catch(e => { console.error(e); process.exit(1); });
