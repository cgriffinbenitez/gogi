#!/usr/bin/env node
/**
 * GOGI Intervention Passage Pipeline — version controlled by PIPELINE_VERSION
 * Usage: npm run pipeline -- --classification mood_misreading [--max 15] [--dry-run] [--per-source-cap 3]
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config(); // fallback

import fs from 'fs';
import path from 'path';
import type {
  CriteriaConfig,
  FilterResult,
  Paragraph,
  PipelineOptions,
  SourceConfig,
  TierKey,
} from './types';
import { fetchBooksForClassification } from './stages/fetch';
import { extractPassageUnits, stripBookFrontMatter } from './stages/extract';
import { filterParagraph, getFilterCacheStats, resetFilterCacheStats } from './stages/filter';
import { tagParagraph, getTagCacheStats } from './stages/tag';
import { appendCSV, initCSV, isDuplicateV3, writePassageV3 } from './stages/write';

const PIPELINE_VERSION: 'v4' = 'v4';

// ─── Help ─────────────────────────────────────────────────────────────────────

const VALID_CLASSIFICATIONS = [
  'mood_misreading', 'tone_misreading', 'figurative_language_failure',
  'syntax_barrier', 'vocabulary_gap', 'morphology_gap', 'inferencing',
  'evidence_retrieval_failure', 'comprehension_integration_failure',
  'topic_vs_theme_confusion', 'structure_purpose_disconnect',
  'no_metacognitive_strategy', 'schema_strategy_missing',
  'central_idea_confusion', 'theme_misreading',
];

function printHelp() {
  console.log(`
GOGI Intervention Passage Pipeline ${PIPELINE_VERSION}

Usage:
  npm run pipeline -- --classification <name> [options]

Options:
  --classification   Required. Classification to run.
  --max              Max passages to insert (default: 15).
  --per-source-cap   Max insertions per source title (default: ceil(max/3)).
  --write-all-passed Write every filter-passed passage as pending_review.
                     Bypasses --max and --per-source-cap. Dedup still enforced.
  --dry-run          Run stages 1-3 (no DB write, no tagging).
  --help             Show this help.

Valid classifications:
  ${VALID_CLASSIFICATIONS.join('\n  ')}
`);
}

// ─── Arg parsing ──────────────────────────────────────────────────────────────

function parseArgs(argv: string[]): PipelineOptions | null {
  const args = argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    printHelp();
    process.exit(0);
  }

  const classIdx = args.indexOf('--classification');
  if (classIdx === -1 || !args[classIdx + 1]) {
    console.error('Error: --classification is required.\n');
    printHelp();
    return null;
  }

  const classification = args[classIdx + 1];
  if (!VALID_CLASSIFICATIONS.includes(classification)) {
    console.error(`Error: unknown classification "${classification}".\n`);
    console.error(`Valid: ${VALID_CLASSIFICATIONS.join(', ')}`);
    return null;
  }

  const maxIdx = args.indexOf('--max');
  const max = maxIdx !== -1 && args[maxIdx + 1]
    ? parseInt(args[maxIdx + 1], 10)
    : 15;

  const perSourceCapIdx = args.indexOf('--per-source-cap');
  const perSourceCapOverride = perSourceCapIdx !== -1 && args[perSourceCapIdx + 1]
    ? parseInt(args[perSourceCapIdx + 1], 10)
    : undefined;

  const dryRun        = args.includes('--dry-run');
  const writeAllPassed = args.includes('--write-all-passed');

  return {
    classification,
    max: isNaN(max) ? 15 : max,
    dryRun,
    writeAllPassed,
    perSourceCapOverride: perSourceCapOverride !== undefined && !isNaN(perSourceCapOverride)
      ? perSourceCapOverride
      : undefined,
  };
}

// ─── Config loader ────────────────────────────────────────────────────────────

function loadCriteria(classification: string): CriteriaConfig {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require(path.join(__dirname, 'criteria', `${classification}.json`)) as CriteriaConfig;
}

function loadSources(classification: string): SourceConfig {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require(path.join(__dirname, 'sources', `${classification}.json`)) as SourceConfig;
}

// ─── Author-group cap helpers ─────────────────────────────────────────────────

function authorMatchesDisplayName(gutendexAuthor: string, displayName: string): boolean {
  const norm = gutendexAuthor.toLowerCase();
  return displayName.toLowerCase().split(/\s+/).every(tok => norm.includes(tok));
}

function authorGroupIndex(
  sourceAuthor: string,
  groupCaps: NonNullable<SourceConfig['authorGroupCaps']>,
): number {
  for (let i = 0; i < groupCaps.length; i++) {
    if (groupCaps[i].authors.some(a => authorMatchesDisplayName(sourceAuthor, a))) return i;
  }
  return -1;
}

// ─── Types ────────────────────────────────────────────────────────────────────

type SuitableParagraph = Paragraph & {
  filterReasoning: string;
  filterResult: FilterResult;
  tierKey: TierKey;
};

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const opts = parseArgs(process.argv);
  if (!opts) { process.exit(1); }

  const { classification, max, dryRun, writeAllPassed, perSourceCapOverride } = opts;

  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('Error: ANTHROPIC_API_KEY is not set.');
    process.exit(1);
  }
  if (!dryRun && !process.env.NEXT_PUBLIC_SUPABASE_URL) {
    console.error('Error: NEXT_PUBLIC_SUPABASE_URL is not set.');
    process.exit(1);
  }

  console.log(`\n═══════════════════════════════════════════════════════`);
  console.log(`  GOGI Pipeline ${PIPELINE_VERSION}  |  ${classification}`);
  console.log(`  max: ${writeAllPassed ? '∞ (write-all-passed)' : max}  |  dry-run: ${dryRun}`);
  console.log(`═══════════════════════════════════════════════════════`);
  console.log(`  [mode] write-all-passed: ${writeAllPassed ? 'ON' : 'OFF (default cap)'}`);
  console.log(`═══════════════════════════════════════════════════════\n`);

  const criteria = loadCriteria(classification);
  const sources  = loadSources(classification);

  // CSV output
  const ts      = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const csvPath = `/tmp/pipeline-summary-${classification}-${ts}.csv`;
  initCSV(csvPath);
  console.log(`[CSV] writing to ${csvPath}\n`);

  // Per-source cap (write phase) and per-tier-per-book cap (pool build)
  const perSourceCap         = perSourceCapOverride ?? Math.ceil(max / 3);
  // Pool build: stop per tier per book after this many suitables
  const poolCapPerBookPerTier = Math.max(2, Math.ceil(max / 8));

  // Counters
  let fetched              = 0;
  let filtered             = 0;
  let tagged               = 0;
  let tagRejected          = 0;
  let inserted             = 0;
  let duplicates           = 0;
  let skipped              = 0;
  let frontMatterTotal     = 0;

  const tierCounts: Record<TierKey, number> = { T1: 0, T2: 0, T3: 0, T4: 0 };
  const frontMatterPerBook: Array<{ title: string; chars: number }> = [];

  // ── Stage 1: Fetch ───────────────────────────────────────────────────────────
  const books = await fetchBooksForClassification(sources, 20);
  fetched = books.length;
  console.log();

  // ── Phase 1: Extract + Filter all books → build suitable pool ────────────────
  const suitablePool: SuitableParagraph[] = [];
  const poolPerSourceTier: Record<string, number> = {};

  const TIER_KEYS: TierKey[] = ['T1', 'T2', 'T3', 'T4'];

  let bookIndex = 0;

  for (const book of books) {
    bookIndex++;
    resetFilterCacheStats();

    const { strippedBook, charsSkipped } = stripBookFrontMatter(book);
    frontMatterTotal += charsSkipped;
    frontMatterPerBook.push({ title: book.title, chars: charsSkipped });

    const tierUnits = extractPassageUnits(strippedBook);
    let bookSuitable = 0;

    for (const tierKey of TIER_KEYS) {
      const units = tierUnits[tierKey];
      let tierSuitable = 0;

      for (const unit of units) {
        if (!writeAllPassed && tierSuitable >= poolCapPerBookPerTier) break;

        const filterResult = await filterParagraph(unit, criteria);
        filtered++;

        const csvBase = {
          classification,
          gutenberg_id:     unit.gutenbergId,
          title:            unit.sourceTitle,
          author:           unit.sourceAuthor,
          paragraph_text:   unit.text,
          word_count:       unit.wordCount,
          paragraph_count:  unit.paragraphCount,
          suitable:         filterResult.suitable,
          reasoning:        filterResult.reasoning,
          canonical_answer: '',
          distractors:      '',
          keyword_flags:    '',
          difficulty_tier:  '' as const,
          tier:             '' as const,
          pipeline_version: PIPELINE_VERSION,
        };

        if (filterResult.suitable) {
          suitablePool.push({
            ...unit,
            filterReasoning: filterResult.reasoning,
            filterResult,
            tierKey,
          });
          const key = `${unit.sourceTitle}:${tierKey}`;
          poolPerSourceTier[key] = (poolPerSourceTier[key] ?? 0) + 1;
          tierSuitable++;
          bookSuitable++;

          if (dryRun) {
            appendCSV(csvPath, { ...csvBase, status: 'dry_run_suitable' });
          }
        } else {
          skipped++;
          appendCSV(csvPath, { ...csvBase, status: 'rejected_by_filter' });
        }
      }
    }

    console.log(
      `[Stage 2-3] "${book.title.slice(0, 50)}"` +
      `  front-matter: ${charsSkipped.toLocaleString()} chars stripped` +
      `  suitable: ${bookSuitable}` +
      `  (T1:${tierUnits.T1.length} T2:${tierUnits.T2.length} T3:${tierUnits.T3.length} T4:${tierUnits.T4.length} candidate units)`,
    );

    // Per-book cache hit rate (filter stage)
    const fs = getFilterCacheStats();
    const totalFilterInput = fs.input + fs.cacheRead + fs.cacheCreation;
    const hitRate = totalFilterInput > 0
      ? ((fs.cacheRead / totalFilterInput) * 100).toFixed(1)
      : '0.0';
    console.log(
      `  [cache] Book ${bookIndex} filter hit rate: ${hitRate}%` +
      ` (${fs.cacheRead.toLocaleString()} cached / ${totalFilterInput.toLocaleString()} total input tokens)`,
    );
  }

  // ── Dry-run: report pool and exit ────────────────────────────────────────────
  if (dryRun) {
    const poolBySource = Object.entries(poolPerSourceTier)
      .sort((a, b) => b[1] - a[1])
      .map(([key, n]) => `    ${n.toString().padStart(4)}  ${key.slice(0, 65)}`)
      .join('\n');

    const frontMatterLines = frontMatterPerBook
      .filter(b => b.chars > 0)
      .map(b => `    ${b.chars.toLocaleString().padStart(8)}  ${b.title.slice(0, 55)}`)
      .join('\n');

    console.log(`
═══════════════════════════════════════════════════════
  Pipeline ${PIPELINE_VERSION} complete (dry-run) — ${classification}
  Books fetched:           ${fetched}
  Claude filter calls:     ${filtered}
  Claude YES rate:         ${suitablePool.length} / ${filtered} (${filtered > 0 ? (suitablePool.length / filtered * 100).toFixed(1) : 0}%)
  Suitable pool size:      ${suitablePool.length}
  Per-source cap (write):  ${perSourceCap}
  Pool cap/book/tier:      ${poolCapPerBookPerTier}

  Suitable pool by source:tier:
${poolBySource || '    (none)'}

  Front-matter stripped per book:
${frontMatterLines || '    (none stripped)'}

  CSV: ${csvPath}
═══════════════════════════════════════════════════════
`);
    return;
  }

  // ── Phase 2: Tag + write from pool ───────────────────────────────────────────
  const writtenPerSource:     Record<string, number> = {};
  const writtenPerAuthorGroup: number[] = (sources.authorGroupCaps ?? []).map(() => 0);

  while (suitablePool.length > 0) {
    let para: SuitableParagraph;

    if (writeAllPassed) {
      // write-all-passed: drain pool in order, no cap gates
      para = suitablePool.shift()!;
    } else {
      // default: enforce --max and --per-source-cap via round-robin
      if (inserted >= max) break;

      const eligible = suitablePool.filter(p => {
        if ((writtenPerSource[p.sourceTitle] ?? 0) >= perSourceCap) return false;
        const groupIdx = authorGroupIndex(p.sourceAuthor, sources.authorGroupCaps ?? []);
        if (groupIdx !== -1) {
          const groupCap = sources.authorGroupCaps![groupIdx].maxInserted;
          if (writtenPerAuthorGroup[groupIdx] >= groupCap) return false;
        }
        return true;
      });
      if (eligible.length === 0) break;

      // Round-robin: prefer source with fewest written, then prefer lower tiers first
      eligible.sort((a, b) => {
        const sourceDiff = (writtenPerSource[a.sourceTitle] ?? 0) - (writtenPerSource[b.sourceTitle] ?? 0);
        if (sourceDiff !== 0) return sourceDiff;
        // T1 < T2 < T3 < T4 within same source count
        return TIER_KEYS.indexOf(a.tierKey) - TIER_KEYS.indexOf(b.tierKey);
      });
      para = eligible[0];
      suitablePool.splice(suitablePool.indexOf(para), 1);
    }

    const csvBase = {
      classification,
      gutenberg_id:     para.gutenbergId,
      title:            para.sourceTitle,
      author:           para.sourceAuthor,
      paragraph_text:   para.text,
      word_count:       para.wordCount,
      paragraph_count:  para.paragraphCount,
      suitable:         true,
      reasoning:        para.filterReasoning,
      canonical_answer: '',
      distractors:      '',
      keyword_flags:    '',
      difficulty_tier:  '' as const,
      pipeline_version: PIPELINE_VERSION,
    };

    // Duplicate check (tier-aware)
    const dup = await isDuplicateV3(para.gutenbergId, para.hash, 0); // tier from tag
    if (dup) {
      appendCSV(csvPath, { ...csvBase, status: 'duplicate' });
      duplicates++;
      continue;
    }

    // Tag (pass Q5 patterns so prompt has context)
    const q5Patterns = para.filterResult.q5_patterns_supported ?? [];
    const tagResult = await tagParagraph(para, criteria, q5Patterns);

    if (!tagResult) {
      appendCSV(csvPath, { ...csvBase, status: 'tagging_failed' });
      skipped++;
      continue;
    }
    if ('targetNotDetected' in tagResult) {
      console.log(`  [Stage 4] TARGET_NOT_DETECTED: ${tagResult.reason}`);
      appendCSV(csvPath, { ...csvBase, status: 'tag_not_detected' });
      tagRejected++;
      continue;
    }
    tagged++;

    // Write v3 row
    const row = {
      classification,
      paragraph_text:           para.text,
      word_count:               para.wordCount,
      paragraph_count:          para.paragraphCount,
      source:                   'gutenberg',
      source_title:             para.sourceTitle,
      source_author:            para.sourceAuthor,
      source_year:              para.sourceYear,
      source_gutenberg_id:      para.gutenbergId,
      approved:                 false,
      paragraph_hash:           para.hash,
      pipeline_version:         PIPELINE_VERSION,
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
      q5_flag_5e_compatible:    para.filterResult.q5_flag_5e_compatible ?? false,
      approval_status:          'pending_review' as const,
    };

    const writeResult = await writePassageV3(row);
    appendCSV(csvPath, {
      ...csvBase,
      tier:             tagResult.intervention_tier,
      status:           writeResult.status,
    });

    if (writeResult.status === 'inserted') {
      inserted++;
      writtenPerSource[para.sourceTitle] = (writtenPerSource[para.sourceTitle] ?? 0) + 1;
      const gIdx = authorGroupIndex(para.sourceAuthor, sources.authorGroupCaps ?? []);
      if (gIdx !== -1) writtenPerAuthorGroup[gIdx]++;
      tierCounts[para.tierKey]++;

      const insertedLabel = writeAllPassed ? String(inserted) : `${inserted}/${max}`;
      console.log(
        `  [Stage 5] inserted ${insertedLabel} [T${tagResult.intervention_tier}]` +
        ` [${para.sourceTitle.slice(0, 35)}]: "${para.text.slice(0, 55)}…"`,
      );
    } else if (writeResult.status === 'duplicate') {
      duplicates++;
    } else {
      console.warn(`  [Stage 5] write error: ${writeResult.error}`);
      skipped++;
    }
  }

  // ── Summary ──────────────────────────────────────────────────────────────────
  const writtenBySource = Object.entries(writtenPerSource)
    .sort((a, b) => b[1] - a[1])
    .map(([title, n]) => `    ${n.toString().padStart(4)}  ${title.slice(0, 60)}`)
    .join('\n');

  const authorGroupLines = (sources.authorGroupCaps ?? [])
    .map((g, i) => `    ${writtenPerAuthorGroup[i]}/${g.maxInserted}  [${g.authors.join(' + ')}]`)
    .join('\n');

  const frontMatterLines = frontMatterPerBook
    .filter(b => b.chars > 0)
    .map(b => `    ${b.chars.toLocaleString().padStart(8)}  ${b.title.slice(0, 55)}`)
    .join('\n');

  console.log(`
═══════════════════════════════════════════════════════
  Pipeline ${PIPELINE_VERSION} complete — ${classification}
  Mode:                    ${writeAllPassed ? 'write-all-passed (no cap)' : 'default (capped)'}
  Books fetched:           ${fetched}
  Claude filter calls:     ${filtered}
  Claude YES rate:         ${inserted} / ${filtered} (${filtered > 0 ? (inserted / filtered * 100).toFixed(1) : 0}%)
  Claude tag calls:        ${tagged}
  Tag-stage rejected:      ${tagRejected}
  Inserted:                ${inserted}${writeAllPassed ? ' (all pending_review)' : ''}
  Per-source cap applied:  ${writeAllPassed ? 'N/A (write-all-passed)' : perSourceCap}
  Pool cap/book/tier:      ${writeAllPassed ? 'N/A (write-all-passed)' : poolCapPerBookPerTier}
  Duplicates skipped:      ${duplicates}
  Other skipped:           ${skipped}

  Tier distribution of inserted:
    T1 (Foundation):       ${tierCounts.T1}
    T2 (Guided Practice):  ${tierCounts.T2}
    T3 (Independent):      ${tierCounts.T3}
    T4 (Transfer):         ${tierCounts.T4}

  Inserted by source:
${writtenBySource || '    (none)'}

  Author-group cap tracking:
${authorGroupLines || '    (no groups configured)'}

  Front-matter stripped per book:
${frontMatterLines || '    (none stripped)'}

  CSV: ${csvPath}
═══════════════════════════════════════════════════════
`);

  // ── Run-end cache report ─────────────────────────────────────────────────────
  const tagStats = getTagCacheStats();
  const filterStats = getFilterCacheStats(); // cumulative from last book (Phase 1 complete)
  // Re-accumulate filter totals across all books using tag snapshot as reference
  // (filter stats were reset per-book; tag stats cover the full Phase 2 run)
  // For the run-end report, compute combined totals from the tag stage only
  // (filter per-book totals were already logged above; here we report tag + guidance).
  const totalCacheRead = tagStats.cacheRead;
  const totalCacheCreation = tagStats.cacheCreation;
  const totalInput = tagStats.input;
  // Savings: cache reads cost $0.30/MTok vs $3.00/MTok standard → $2.70 saved per MTok cached
  const savingsUsd = (totalCacheRead / 1_000_000) * 2.70;
  console.log(
    `  [cache] Tag stage — Total cache hits: ${totalCacheRead.toLocaleString()} tokens` +
    ` | Cache created: ${totalCacheCreation.toLocaleString()} tokens` +
    ` | Total input: ${totalInput.toLocaleString()} tokens` +
    ` | Estimated savings vs. uncached: $${savingsUsd.toFixed(4)}`,
  );

  // Persist CSV to repo for v4 calibration analysis
  const runDate = csvPath.match(/(\d{4}-\d{2}-\d{2}T[\d-]+)/)?.[1]?.slice(0, 10) ?? new Date().toISOString().slice(0, 10);
  const archivePath = path.join(__dirname, '../../docs/pipeline/runs', `${runDate}_${classification}_${PIPELINE_VERSION}_run.csv`);
  fs.mkdirSync(path.dirname(archivePath), { recursive: true });
  fs.copyFileSync(csvPath, archivePath);
  console.log(`[pipeline] CSV archived → ${archivePath}`);
}

main().catch(err => {
  console.error('[pipeline] fatal error:', err);
  process.exit(1);
});
