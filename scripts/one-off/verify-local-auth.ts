// One-off: verify local Supabase sb_secret_* key works with @supabase/supabase-js
import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(process.cwd(), '.env.test') });
import { createClient } from '@supabase/supabase-js';

async function main() {
  const url = process.env.TEST_SUPABASE_URL;
  const key = process.env.TEST_SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    console.error('TEST_SUPABASE_URL or TEST_SUPABASE_SERVICE_ROLE_KEY not set');
    process.exit(1);
  }

  console.log(`URL:  ${url}`);
  console.log(`Key format: ${key.startsWith('sb_secret_') ? 'sb_secret_* (new format)' : key.startsWith('eyJ') ? 'JWT (old format)' : 'unknown'}`);

  const supabase = createClient(url, key);

  // Try a simple query against a known table
  const { data, error } = await supabase
    .from('intervention_passages')
    .select('id')
    .limit(1);

  if (error) {
    console.error('\nQUERY FAILED:', error.message);
    console.error('Code:', error.code);
    process.exit(1);
  }

  console.log('\nQuery succeeded. Rows returned:', (data ?? []).length);
  console.log('Auth: sb_secret_* key is accepted by @supabase/supabase-js');
}

main().catch(e => { console.error(e); process.exit(1); });
