#!/usr/bin/env node
/**
 * GOGI Intervention Passage Pipeline
 * Usage: npm run pipeline -- --classification mood_misreading [--max 15] [--dry-run]
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config(); // fallback

import path from 'path';
import type { CriteriaConfig, Paragraph, PipelineOptions, SourceConfig } from './types';
import { fetchBooksForClassification } from './stages/fetch';
import { extractParagraphs, stripBookFrontMatter } from './stages/extract';
import { filterParagraph } from './stages/filter';
import { tagParagraph } from './stages/tag';
import { appendCSV, initCSV, isDuplicate, writePassage } from './stages/write';

// ─── Help ─────────────────────────────────────────────────────────────────────

const VALID_CLASSIFICATIONS = [
  'mood_misreading', 'tone_misreading', 'figurative_language_failure',
  'syntax_barrier', 'vocabulary_gap', 'morphology_gap', 'inferencing',
  'evidence_retrieval_failure', 'comprehension_integration_failure',
  'topic_vs_theme_confusion', 'structure_purpose_disconnect',
  'no_metacognitive_strategy', 'schema_strategy_missing',
];

function printHelp() {
  console.log(`
GOGI Intervention Passage Pipeline

Usage:
  npm run pipeline -- --classification <name> [options]

Options:
  --classification  Required. Classification to run.
  --max             Max passages to insert (default: 15).
  --dry-run         Run stages 1–3 (no DB write, no tagging).
  --help            Show this help.

Valid classifications:
  ${VALID_CLASSIFICATIONS.join('\n  ')}

Examples:
  npm run pipeline -- --classification mood_misreading
  npm run pipeline -- --classification mood_misreading --max 5 --dry-run

Environment variables required:
  ANTHROPIC_API_KEY
  NEXT_PUBLIC_SUPABASE_URL
  SUPABASE_SERVICE_ROLE_KEY  (or NEXT_PUBLIC_SUPABASE_ANON_KEY as fallback)
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

  const dryRun = args.includes('--dry-run');

  return { classification, max: isNaN(max) ? 15 : max, dryRun };
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

// ─── Types ────────────────────────────────────────────────────────────────────

type SuitableParagraph = Paragraph & { filterReasoning: string };

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const opts = parseArgs(process.argv);
  if (!opts) { process.exit(1); }

  const { classification, max, dryRun } = opts;

  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('Error: ANTHROPIC_API_KEY is not set.');
    process.exit(1);
  }
  if (!dryRun && !process.env.NEXT_PUBLIC_SUPABASE_URL) {
    console.error('Error: NEXT_PUBLIC_SUPABASE_URL is not set.');
    process.exit(1);
  }

  console.log(`\n═══════════════════════════════════════════════════════`);
  console.log(`  GOGI Pipeline  |  ${classification}`);
  console.log(`  max: ${max}  |  dry-run: ${dryRun}`);
  console.log(`═══════════════════════════════════════════════════════\n`);

  const criteria = loadCriteria(classification);
  const sources  = loadSources(classification);

  // CSV output
  const ts      = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const csvPath = `/tmp/pipeline-summary-${classification}-${ts}.csv`;
  initCSV(csvPath);
  console.log(`[CSV] writing to ${csvPath}\n`);

  // Per-source cap: no single book contributes more than ceil(max/3) passages
  const perSourceCap = Math.ceil(max / 3);
  // How many suitable paragraphs to collect per book (buffer above the cap)
  const poolCapPerBook = perSourceCap + 3;

  // Counters
  let fetched              = 0;
  let extracted            = 0;
  let completenessSkipped  = 0;
  let dialogueSkipped      = 0;
  let frontMatterTotal     = 0;
  let filtered             = 0;
  let tagged               = 0;
  let inserted             = 0;
  let duplicates           = 0;
  let skipped              = 0;
  const completenessReasons: Record<string, number> = {};
  const frontMatterPerBook: Array<{ title: string; chars: number }> = [];

  // ── Stage 1: Fetch ───────────────────────────────────────────────────────────
  const books = await fetchBooksForClassification(sources, 20);
  fetched = books.length;
  console.log();

  // ── Phase 1: Extract + Filter all books → build suitable pool ────────────────
  const suitablePool: SuitableParagraph[] = [];
  const poolPerSource: Record<string, number> = {};

  for (const book of books) {
    // Strip front matter (biographical essays, TOC, prefaces)
    const { strippedBook, charsSkipped } = stripBookFrontMatter(book);
    frontMatterTotal += charsSkipped;
    frontMatterPerBook.push({ title: book.title, chars: charsSkipped });

    // Extract paragraphs
    const allParagraphs = extractParagraphs(strippedBook);
    const paragraphs    = allParagraphs.filter(p => !p.skippedReason);
    const skippedParas  = allParagraphs.filter(p => p.skippedReason);

    extracted += paragraphs.length;

    for (const sp of skippedParas) {
      if (sp.skippedReason === 'dialogue_heavy') {
        dialogueSkipped++;
      } else {
        completenessSkipped++;
        const reason = sp.skippedReason ?? 'unknown';
        completenessReasons[reason] = (completenessReasons[reason] ?? 0) + 1;
      }
      appendCSV(csvPath, {
        classification,
        gutenberg_id:    sp.gutenbergId,
        title:           sp.sourceTitle,
        author:          sp.sourceAuthor,
        paragraph_text:  sp.text,
        word_count:      sp.wordCount,
        suitable:        false,
        reasoning:       sp.skippedReason ?? 'unknown',
        canonical_answer: '',
        distractors:     '',
        keyword_flags:   '',
        difficulty_tier: '' as const,
        status:          sp.skippedReason === 'dialogue_heavy'
                           ? 'skipped_dialogue'
                           : 'skipped_completeness',
      });
    }

    // Filter paragraphs from this book; stop when we have poolCapPerBook suitable
    let bookSuitable = 0;

    for (const para of paragraphs) {
      if (bookSuitable >= poolCapPerBook) break;

      const filterResult = await filterParagraph(para, criteria);
      filtered++;

      const csvBase = {
        classification,
        gutenberg_id:     para.gutenbergId,
        title:            para.sourceTitle,
        author:           para.sourceAuthor,
        paragraph_text:   para.text,
        word_count:       para.wordCount,
        suitable:         filterResult.suitable,
        reasoning:        filterResult.reasoning,
        canonical_answer: '',
        distractors:      '',
        keyword_flags:    '',
        difficulty_tier:  '' as const,
      };

      if (filterResult.suitable) {
        suitablePool.push({ ...para, filterReasoning: filterResult.reasoning });
        poolPerSource[para.sourceTitle] = (poolPerSource[para.sourceTitle] ?? 0) + 1;
        bookSuitable++;

        if (dryRun) {
          appendCSV(csvPath, { ...csvBase, status: 'dry_run_suitable' });
        }
      } else {
        skipped++;
        appendCSV(csvPath, { ...csvBase, status: 'rejected_by_filter' });
      }
    }

    console.log(
      `[Stage 2-3] "${book.title.slice(0, 50)}"` +
      `  front-matter: ${charsSkipped.toLocaleString()} chars stripped` +
      `  complete: ${paragraphs.length}` +
      `  suitable: ${bookSuitable}` +
      `  (completeness-skipped: ${skippedParas.filter(p => p.skippedReason !== 'dialogue_heavy').length}` +
      `, dialogue: ${skippedParas.filter(p => p.skippedReason === 'dialogue_heavy').length})`,
    );
  }

  // ── Dry-run: report pool and exit ────────────────────────────────────────────
  if (dryRun) {
    const topReasons = Object.entries(completenessReasons)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([r, n]) => `    ${n.toString().padStart(4)}  ${r}`)
      .join('\n');

    const poolBySource = Object.entries(poolPerSource)
      .sort((a, b) => b[1] - a[1])
      .map(([title, n]) => `    ${n.toString().padStart(4)}  ${title.slice(0, 60)}`)
      .join('\n');

    const frontMatterLines = frontMatterPerBook
      .filter(b => b.chars > 0)
      .map(b => `    ${b.chars.toLocaleString().padStart(8)}  ${b.title.slice(0, 55)}`)
      .join('\n');

    console.log(`
═══════════════════════════════════════════════════════
  Pipeline complete (dry-run) — ${classification}
  Books fetched:           ${fetched}
  Paragraphs (complete):   ${extracted}
  Skipped completeness:    ${completenessSkipped}
  Skipped dialogue:        ${dialogueSkipped}
  Front-matter stripped:   ${frontMatterTotal.toLocaleString()} chars total
  Claude filter calls:     ${filtered}
  Claude YES rate:         ${suitablePool.length} / ${filtered} (${filtered > 0 ? (suitablePool.length / filtered * 100).toFixed(1) : 0}%)
  Suitable pool size:      ${suitablePool.length}
  Per-source cap (write):  ${perSourceCap}

  Suitable pool by source:
${poolBySource || '    (none)'}

  Front-matter stripped per book:
${frontMatterLines || '    (none stripped)'}

  Top completeness skip reasons:
${topReasons || '    (none)'}

  CSV: ${csvPath}
═══════════════════════════════════════════════════════
`);
    return;
  }

  // ── Phase 2: Round-robin tag + write from pool ───────────────────────────────
  const writtenPerSource: Record<string, number> = {};

  while (inserted < max && suitablePool.length > 0) {
    // Filter out paragraphs from sources that have hit the per-source cap
    const eligible = suitablePool.filter(
      p => (writtenPerSource[p.sourceTitle] ?? 0) < perSourceCap,
    );
    if (eligible.length === 0) break;

    // Prefer source with fewest written passages so far (round-robin effect)
    eligible.sort(
      (a, b) =>
        (writtenPerSource[a.sourceTitle] ?? 0) -
        (writtenPerSource[b.sourceTitle] ?? 0),
    );
    const para = eligible[0];
    suitablePool.splice(suitablePool.indexOf(para), 1);

    const csvBase = {
      classification,
      gutenberg_id:     para.gutenbergId,
      title:            para.sourceTitle,
      author:           para.sourceAuthor,
      paragraph_text:   para.text,
      word_count:       para.wordCount,
      suitable:         true,
      reasoning:        (para as SuitableParagraph).filterReasoning,
      canonical_answer: '',
      distractors:      '',
      keyword_flags:    '',
      difficulty_tier:  '' as const,
    };

    // Duplicate check (save tag API cost)
    const dup = await isDuplicate(para.gutenbergId, para.hash);
    if (dup) {
      appendCSV(csvPath, { ...csvBase, status: 'duplicate' });
      duplicates++;
      continue;
    }

    // Tag
    const tagResult = await tagParagraph(para, criteria);
    if (!tagResult) {
      appendCSV(csvPath, { ...csvBase, status: 'tagging_failed' });
      skipped++;
      continue;
    }
    tagged++;

    // Write
    const row = {
      classification,
      paragraph_text:      para.text,
      word_count:          para.wordCount,
      source:              'gutenberg',
      source_title:        para.sourceTitle,
      source_author:       para.sourceAuthor,
      source_year:         para.sourceYear,
      source_gutenberg_id: para.gutenbergId,
      canonical_answer:    tagResult.canonical_answer,
      distractors:         tagResult.distractors,
      keyword_flags:       tagResult.keyword_flags,
      difficulty_tier:     tagResult.difficulty_tier,
      approved:            false,
      paragraph_hash:      para.hash,
    };

    const writeResult = await writePassage(row);
    appendCSV(csvPath, {
      ...csvBase,
      canonical_answer: tagResult.canonical_answer,
      distractors:      tagResult.distractors.join(' | '),
      keyword_flags:    tagResult.keyword_flags.join(', '),
      difficulty_tier:  tagResult.difficulty_tier,
      status:           writeResult.status,
    });

    if (writeResult.status === 'inserted') {
      inserted++;
      writtenPerSource[para.sourceTitle] = (writtenPerSource[para.sourceTitle] ?? 0) + 1;
      console.log(
        `  [Stage 5] inserted ${inserted}/${max}` +
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
  const topReasons = Object.entries(completenessReasons)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([r, n]) => `    ${n.toString().padStart(4)}  ${r}`)
    .join('\n');

  const writtenBySource = Object.entries(writtenPerSource)
    .sort((a, b) => b[1] - a[1])
    .map(([title, n]) => `    ${n.toString().padStart(4)}  ${title.slice(0, 60)}`)
    .join('\n');

  const frontMatterLines = frontMatterPerBook
    .filter(b => b.chars > 0)
    .map(b => `    ${b.chars.toLocaleString().padStart(8)}  ${b.title.slice(0, 55)}`)
    .join('\n');

  console.log(`
═══════════════════════════════════════════════════════
  Pipeline complete — ${classification}
  Books fetched:           ${fetched}
  Paragraphs (complete):   ${extracted}
  Skipped completeness:    ${completenessSkipped}
  Skipped dialogue:        ${dialogueSkipped}
  Front-matter stripped:   ${frontMatterTotal.toLocaleString()} chars total
  Claude filter calls:     ${filtered}
  Claude YES rate:         ${inserted} / ${filtered} (${filtered > 0 ? (inserted / filtered * 100).toFixed(1) : 0}%)
  Claude tag calls:        ${tagged}
  Inserted:                ${inserted}
  Per-source cap applied:  ${perSourceCap}
  Duplicates skipped:      ${duplicates}
  Other skipped:           ${skipped}

  Inserted by source:
${writtenBySource || '    (none)'}

  Front-matter stripped per book:
${frontMatterLines || '    (none stripped)'}

  Top completeness skip reasons:
${topReasons || '    (none)'}

  CSV: ${csvPath}
═══════════════════════════════════════════════════════
`);
}

main().catch(err => {
  console.error('[pipeline] fatal error:', err);
  process.exit(1);
});
