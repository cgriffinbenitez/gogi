#!/usr/bin/env node
/**
 * v3 Insert Recovery Script
 *
 * Use this after applying supabase/migrations/20260422_pipeline_v3_columns.sql
 * to recover from a run where all Stage 5 writes failed due to missing schema columns.
 *
 * Reads a completed pipeline CSV, finds all rows with status='error', re-tags
 * each passage, and inserts into intervention_passages.
 *
 * Usage (capped — top N with source diversity):
 *   npx tsx scripts/recover_v3_inserts.ts \
 *     --csv docs/pipeline/runs/2026-04-22_tone_misreading_v3_run.csv \
 *     --classification tone_misreading \
 *     --max 25 \
 *     [--per-source-cap 5] \
 *     [--dry-run]
 *
 * Usage (write all — preserve full library, approval_status = pending_review):
 *   npx tsx scripts/recover_v3_inserts.ts \
 *     --csv docs/pipeline/runs/2026-04-22_tone_misreading_v3_run.csv \
 *     --classification tone_misreading \
 *     --write-all-passed \
 *     [--dry-run]
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config();

import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';
import type { CriteriaConfig } from '../src/pipeline/types';
import { tagParagraph } from '../src/pipeline/stages/tag';
import { isDuplicateV3, writePassageV3 } from '../src/pipeline/stages/write';

const PIPELINE_VERSION = 'v3';

// ─── Arg parsing ──────────────────────────────────────────────────────────────

function getArg(args: string[], flag: string): string | undefined {
  const idx = args.indexOf(flag);
  return idx !== -1 ? args[idx + 1] : undefined;
}

const args = process.argv.slice(2);
const csvPath        = getArg(args, '--csv');
const classification = getArg(args, '--classification');
const maxArg         = getArg(args, '--max');
const perSourceArg   = getArg(args, '--per-source-cap');
const dryRun         = args.includes('--dry-run');
const writeAllPassed = args.includes('--write-all-passed');

if (!csvPath || !classification) {
  console.error('Usage: npx tsx scripts/recover_v3_inserts.ts --csv <path> --classification <name> [--max <n>] [--per-source-cap <n>] [--write-all-passed] [--dry-run]');
  process.exit(1);
}

if (!fs.existsSync(csvPath)) {
  console.error(`CSV not found: ${csvPath}`);
  process.exit(1);
}

const max          = writeAllPassed ? Infinity            : (maxArg       ? parseInt(maxArg, 10)       : 25);
const perSourceCap = writeAllPassed ? Infinity            : (perSourceArg ? parseInt(perSourceArg, 10) : Math.ceil((maxArg ? parseInt(maxArg, 10) : 25) / 3));

// ─── Load criteria ────────────────────────────────────────────────────────────

const criteria = require(
  path.join(__dirname, '../src/pipeline/criteria', `${classification}.json`),
) as CriteriaConfig;

// ─── Parse CSV ────────────────────────────────────────────────────────────────

interface CSVRecord {
  classification:   string;
  gutenberg_id:     string;
  title:            string;
  author:           string;
  paragraph_text:   string;
  word_count:       string;
  paragraph_count:  string;
  suitable:         string;
  reasoning:        string;
  tier:             string;
  status:           string;
  pipeline_version: string;
}

const raw = fs.readFileSync(csvPath, 'utf8');
const records = parse(raw, { columns: true, skip_empty_lines: true }) as CSVRecord[];

// Only recover 'error' rows — these were tagged but failed to write
const errorRows = records.filter(r => r.status === 'error');

const modeLabel = writeAllPassed
  ? 'write-all-passed (approval_status=pending_review, no cap)'
  : `max: ${max}  |  per-source-cap: ${perSourceCap}`;

console.log(`\n═══════════════════════════════════════════════════════`);
console.log(`  v3 Insert Recovery  |  ${classification}`);
console.log(`  CSV: ${csvPath}`);
console.log(`  Error rows found: ${errorRows.length}`);
console.log(`  mode: ${modeLabel}  |  dry-run: ${dryRun}`);
console.log(`═══════════════════════════════════════════════════════\n`);

if (errorRows.length === 0) {
  console.log('No error rows found — nothing to recover.');
  process.exit(0);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('Error: ANTHROPIC_API_KEY is not set.');
    process.exit(1);
  }
  if (!dryRun && !process.env.NEXT_PUBLIC_SUPABASE_URL) {
    console.error('Error: NEXT_PUBLIC_SUPABASE_URL is not set.');
    process.exit(1);
  }

  let inserted       = 0;
  let tagFailed      = 0;
  let tagNotDetected = 0;
  let duplicates     = 0;
  let writeErrors    = 0;
  let skippedCap     = 0;

  const writtenPerSource: Record<string, number> = {};

  // Sort: prefer lower tier numbers first, then by source
  // In write-all-passed mode order doesn't affect what gets written, only logging order
  const sorted = [...errorRows].sort((a, b) => {
    const tierA = parseInt(a.tier || '4', 10);
    const tierB = parseInt(b.tier || '4', 10);
    if (tierA !== tierB) return tierA - tierB;
    return a.title.localeCompare(b.title);
  });

  for (const row of sorted) {
    if (inserted >= max) break;

    // Per-source cap (bypassed in --write-all-passed mode)
    const sourceCount = writtenPerSource[row.title] ?? 0;
    if (sourceCount >= perSourceCap) {
      skippedCap++;
      continue;
    }

    const para = {
      text:          row.paragraph_text,
      wordCount:     parseInt(row.word_count, 10),
      paragraphCount: parseInt(row.paragraph_count || '1', 10),
      sourceTitle:   row.title,
      sourceAuthor:  row.author,
      sourceYear:    null,
      gutenbergId:   parseInt(row.gutenberg_id, 10),
      hash:          require('crypto')
                       .createHash('sha256')
                       .update(row.paragraph_text)
                       .digest('hex')
                       .slice(0, 16),
    };

    // Duplicate check
    const tier = parseInt(row.tier || '1', 10);
    const dup = dryRun ? false : await isDuplicateV3(para.gutenbergId, para.hash, tier);
    if (dup) {
      console.log(`  [skip] duplicate: "${para.text.slice(0, 60)}…"`);
      duplicates++;
      continue;
    }

    // Re-tag (q5 patterns not in CSV — pass empty, model derives from passage)
    const tagResult = await tagParagraph(para, criteria, []);

    if (!tagResult) {
      console.warn(`  [tag] failed: "${para.text.slice(0, 60)}…"`);
      tagFailed++;
      continue;
    }
    if ('targetNotDetected' in tagResult) {
      console.log(`  [tag] TARGET_NOT_DETECTED: ${tagResult.reason.slice(0, 80)}`);
      tagNotDetected++;
      continue;
    }

    // approval_status: pending_review for all inserts
    // (migration backfills existing v2 rows to 'approved' separately)
    const dbRow = {
      classification,
      paragraph_text:           para.text,
      word_count:               para.wordCount,
      paragraph_count:          para.paragraphCount,
      source:                   'gutenberg' as const,
      source_title:             para.sourceTitle,
      source_author:            para.sourceAuthor,
      source_year:              para.sourceYear,
      source_gutenberg_id:      para.gutenbergId,
      approved:                 false,
      paragraph_hash:           para.hash,
      pipeline_version:         PIPELINE_VERSION as const,
      target_signal:            tagResult.target_signal,
      item_patterns_supported:  tagResult.item_patterns_supported,
      supporting_evidence:      tagResult.supporting_evidence,
      non_supporting_evidence:  tagResult.non_supporting_evidence,
      dominant_concept:         tagResult.dominant_concept ?? null,
      plausible_distractors:    tagResult.plausible_distractors ?? null,
      craft_features:           tagResult.craft_features ?? null,
      discrimination_item_type: tagResult.discrimination_item_type,
      intervention_tier:        tagResult.intervention_tier,
      tier_rationale:           tagResult.tier_rationale,
      q5_flag_5e_compatible:    false, // not preserved in CSV — safe default
      approval_status:          'pending_review',
    };

    const insertedLabel = max === Infinity ? String(inserted + 1) : `${inserted + 1}/${max}`;

    if (dryRun) {
      console.log(`  [dry-run] would insert T${tagResult.intervention_tier} approval=pending_review [${para.sourceTitle.slice(0, 35)}]: "${para.text.slice(0, 55)}…"`);
      inserted++;
      writtenPerSource[row.title] = sourceCount + 1;
      continue;
    }

    const writeResult = await writePassageV3(dbRow);

    if (writeResult.status === 'inserted') {
      inserted++;
      writtenPerSource[row.title] = sourceCount + 1;
      console.log(
        `  [inserted] ${insertedLabel} T${tagResult.intervention_tier} approval=pending_review` +
        ` [${para.sourceTitle.slice(0, 35)}]: "${para.text.slice(0, 55)}…"`,
      );
    } else if (writeResult.status === 'duplicate') {
      console.log(`  [skip] duplicate at write: "${para.text.slice(0, 60)}…"`);
      duplicates++;
    } else {
      console.error(`  [error] write failed: ${writeResult.error}`);
      writeErrors++;
    }
  }

  console.log(`
═══════════════════════════════════════════════════════
  Recovery complete — ${classification}
  Mode:              ${writeAllPassed ? 'write-all-passed' : 'capped'}
  Inserted:          ${inserted}  (approval_status = pending_review)
  Tag failed:        ${tagFailed}
  Target not found:  ${tagNotDetected}
  Duplicates:        ${duplicates}
  Write errors:      ${writeErrors}
  Skipped (cap):     ${skippedCap}
═══════════════════════════════════════════════════════
`);

  if (writeErrors > 0) {
    console.error('Write errors remain — verify the migration was applied:\n  supabase/migrations/20260422_pipeline_v3_columns.sql');
  }
}

main().catch(err => {
  console.error('[recover] fatal error:', err);
  process.exit(1);
});
