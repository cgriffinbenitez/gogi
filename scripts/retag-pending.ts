/**
 * GOGI — Re-tag existing passages with updated criteria
 *
 * Fetches existing passages (pending_review + approved) for a classification
 * and re-runs only the tag stage, updating tagger_tier and tier_rationale
 * with the improved criteria-aware judgments.
 *
 * Does NOT modify: paragraph_text, source fields, approval_status,
 * supporting_evidence, non_supporting_evidence, target_signal, or any
 * other fields — only tagger_tier and tier_rationale are updated.
 *
 * Usage:
 *   npx tsx scripts/retag-pending.ts --classification mood_misreading
 *   npx tsx scripts/retag-pending.ts --classification mood_misreading --dry-run
 *   npx tsx scripts/retag-pending.ts --classification mood_misreading --max 5
 *
 * Env (from .env.local):
 *   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ANTHROPIC_API_KEY
 */

import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(process.cwd(), '.env.local') });

import { createClient } from '@supabase/supabase-js';
import { loadCriteria } from '../src/pipeline/stages/loadCriteria';
import { tagParagraph } from '../src/pipeline/stages/tag';
import type { Paragraph } from '../src/pipeline/types';

// ─── CLI args ─────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);

function getArg(flag: string): string | null {
  const idx = args.indexOf(flag);
  return idx !== -1 && args[idx + 1] ? args[idx + 1] : null;
}

const CLASSIFICATION = getArg('--classification');
const DRY_RUN        = args.includes('--dry-run');
const MAX            = parseInt(getArg('--max') ?? '0', 10);

if (!CLASSIFICATION) {
  console.error('Error: --classification <name> is required');
  process.exit(1);
}

// ─── Supabase ─────────────────────────────────────────────────────────────────

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing Supabase credentials');
  return createClient(url, key);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const sb       = getSupabase();
  const criteria = loadCriteria(CLASSIFICATION!);

  console.log(`\nRetag — ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`);
  console.log(`Classification: ${CLASSIFICATION}`);
  console.log(`Tier signal type: ${typeof criteria.tierSignals?.tier1 === 'object' ? 'RICH (literary-difficulty-primary)' : 'SIMPLE (word-count-primary)'}`);

  // Fetch passages to retag
  let query = sb
    .from('intervention_passages')
    .select('id, paragraph_text, word_count, paragraph_count, item_patterns_supported, intervention_tier, tagger_tier, source_title')
    .eq('classification', CLASSIFICATION!)
    .in('approval_status', ['pending_review', 'approved'])
    .order('intervention_tier', { ascending: true });

  if (MAX > 0) query = query.limit(MAX);

  const { data, error } = await query;
  if (error) { console.error('Fetch failed:', error.message); process.exit(1); }
  if (!data || data.length === 0) { console.log('No passages found.'); return; }

  console.log(`Passages to retag: ${data.length}\n`);

  const results: Array<{
    id: string;
    oldTagger: number | null;
    newTagger: number | null;
    rationale: string;
  }> = [];

  for (let i = 0; i < data.length; i++) {
    const row = data[i];

    // Reconstruct the Paragraph shape tagParagraph expects
    const para: Paragraph = {
      text:           row.paragraph_text,
      wordCount:      row.word_count,
      paragraphCount: row.paragraph_count,
      sourceTitle:    row.source_title ?? '',
      sourceAuthor:   '',   // not used by tagger
      sourceYear:     null,
      gutenbergId:    0,
      hash:           '',
    };

    const q5Patterns: string[] = Array.isArray(row.item_patterns_supported)
      ? row.item_patterns_supported
      : [];

    process.stdout.write(`  [${i + 1}/${data.length}] ${row.id.slice(0, 8)}… T${row.intervention_tier} (was tagger_tier=${row.tagger_tier}) → `);

    const tagResult = await tagParagraph(para, criteria, q5Patterns);

    if (!tagResult || 'targetNotDetected' in tagResult) {
      console.log('TAG_NOT_DETECTED (skipping)');
      continue;
    }

    const newTaggerTier = tagResult.intervention_tier;
    console.log(`tagger_tier=${newTaggerTier} (${tagResult.tier_rationale.slice(0, 80)}…)`);

    results.push({
      id:         row.id,
      oldTagger:  row.tagger_tier,
      newTagger:  newTaggerTier,
      rationale:  tagResult.tier_rationale,
    });

    if (!DRY_RUN) {
      const { error: updateErr } = await sb
        .from('intervention_passages')
        .update({
          tagger_tier:    newTaggerTier,
          tier_rationale: tagResult.tier_rationale,
        })
        .eq('id', row.id);

      if (updateErr) {
        console.error(`  DB update failed for ${row.id}: ${updateErr.message}`);
      }
    }

    // Rate limit
    if (i < data.length - 1) {
      await new Promise(r => setTimeout(r, 500));
    }
  }

  // Summary
  console.log('\n' + '═'.repeat(60));
  console.log('RETAG SUMMARY');
  console.log('═'.repeat(60));

  const changed  = results.filter(r => r.oldTagger !== r.newTagger);
  const same     = results.filter(r => r.oldTagger === r.newTagger);

  console.log(`Total retagged:  ${results.length}`);
  console.log(`Changed:         ${changed.length}`);
  console.log(`Unchanged:       ${same.length}`);

  if (changed.length > 0) {
    console.log('\nChanged tier assignments:');
    for (const r of changed) {
      console.log(`  ${r.id.slice(0, 8)}… T${r.oldTagger} → T${r.newTagger}  |  ${r.rationale.slice(0, 100)}`);
    }
  }

  // New distribution
  const dist: Record<number, number> = {};
  for (const r of results) {
    const t = r.newTagger ?? 0;
    dist[t] = (dist[t] ?? 0) + 1;
  }
  console.log('\nNew tagger_tier distribution (retagged passages):');
  for (const [tier, count] of Object.entries(dist).sort()) {
    console.log(`  T${tier}: ${count}`);
  }

  if (DRY_RUN) console.log('\nDRY RUN — no DB writes made.');
  console.log('═'.repeat(60));
}

main().catch(err => { console.error('Unhandled:', err); process.exit(1); });
