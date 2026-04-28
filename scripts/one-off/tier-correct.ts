import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(process.cwd(), '.env.local') });
import { createClient } from '@supabase/supabase-js';

async function main() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  // ── UPDATE ───────────────────────────────────────────────────────────────────
  // Supabase JS doesn't support CASE in update, so we run three targeted updates.
  // T1: word_count < 210
  const { error: e1, count: c1 } = await supabase
    .from('intervention_passages')
    .update({ intervention_tier: 1 })
    .eq('classification', 'mood_misreading')
    .eq('approval_status', 'pending_review')
    .lt('word_count', 210);
  if (e1) { console.error('T1 update failed:', e1.message); process.exit(1); }
  console.log(`T1 update: ${c1 ?? '?'} rows`);

  // T3: word_count >= 260 and < 310
  const { error: e3, count: c3 } = await supabase
    .from('intervention_passages')
    .update({ intervention_tier: 3 })
    .eq('classification', 'mood_misreading')
    .eq('approval_status', 'pending_review')
    .gte('word_count', 260)
    .lt('word_count', 310);
  if (e3) { console.error('T3 update failed:', e3.message); process.exit(1); }
  console.log(`T3 update: ${c3 ?? '?'} rows`);

  // T4: word_count >= 310
  const { error: e4, count: c4 } = await supabase
    .from('intervention_passages')
    .update({ intervention_tier: 4 })
    .eq('classification', 'mood_misreading')
    .eq('approval_status', 'pending_review')
    .gte('word_count', 310);
  if (e4) { console.error('T4 update failed:', e4.message); process.exit(1); }
  console.log(`T4 update: ${c4 ?? '?'} rows`);

  // T2 is already correct (intervention_tier=2 for word_count 210-259) — no update needed.
  console.log('T2: no change needed (already correct)');

  // ── VERIFICATION ─────────────────────────────────────────────────────────────
  const { data, error: ve } = await supabase
    .from('intervention_passages')
    .select('intervention_tier, word_count')
    .eq('classification', 'mood_misreading')
    .eq('approval_status', 'pending_review')
    .order('intervention_tier', { ascending: true });

  if (ve) { console.error('Verification query failed:', ve.message); process.exit(1); }

  // Aggregate in JS
  const summary: Record<number, { count: number; min: number; max: number }> = {};
  for (const row of data ?? []) {
    const t = row.intervention_tier as number;
    const w = row.word_count as number;
    if (!summary[t]) summary[t] = { count: 0, min: w, max: w };
    summary[t].count++;
    if (w < summary[t].min) summary[t].min = w;
    if (w > summary[t].max) summary[t].max = w;
  }

  console.log('\nintervention_tier  count  min_word_count  max_word_count');
  console.log('─'.repeat(56));
  for (const tier of Object.keys(summary).sort()) {
    const s = summary[Number(tier)];
    console.log(
      `${String(tier).padStart(17)}  ${String(s.count).padStart(5)}  ${String(s.min).padStart(14)}  ${String(s.max).padStart(14)}`,
    );
  }
  console.log(`\nTotal: ${(data ?? []).length} rows`);
}

main().catch(e => { console.error(e); process.exit(1); });
