#!/usr/bin/env node
/**
 * GOGI Pipeline v2 Validator
 * Runs filter-only against 20 candidate paragraphs and reports per-Q breakdown.
 * Does NOT write to DB. Use before real pipeline runs to verify v2 calibration.
 *
 * Usage: npm run validate -- --classification tone_misreading [--sample 20]
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config();

import path from 'path';
import type { CriteriaConfig, FilterResult, Paragraph, SourceConfig } from './types';
import { fetchBooksForClassification } from './stages/fetch';
import { extractParagraphs, stripBookFrontMatter } from './stages/extract';
import { filterParagraph } from './stages/filter';

// ─── Arg parsing ──────────────────────────────────────────────────────────────

function parseArgs(argv: string[]): { classification: string; sample: number } | null {
  const args = argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
GOGI Pipeline v2 Validator

Usage:
  npm run validate -- --classification <name> [--sample <n>]

Options:
  --classification  Required.
  --sample          Number of paragraphs to test (default: 20).
  --help            Show this help.
`);
    process.exit(0);
  }

  const classIdx = args.indexOf('--classification');
  if (classIdx === -1 || !args[classIdx + 1]) {
    console.error('Error: --classification is required.');
    return null;
  }

  const sampleIdx = args.indexOf('--sample');
  const sample = sampleIdx !== -1 && args[sampleIdx + 1]
    ? parseInt(args[sampleIdx + 1], 10)
    : 20;

  return { classification: args[classIdx + 1], sample: isNaN(sample) ? 20 : sample };
}

function loadCriteria(classification: string): CriteriaConfig {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require(path.join(__dirname, 'criteria', `${classification}.json`)) as CriteriaConfig;
}

function loadSources(classification: string): SourceConfig {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require(path.join(__dirname, 'sources', `${classification}.json`)) as SourceConfig;
}

// ─── Report types ─────────────────────────────────────────────────────────────

interface ValidatorResult {
  para: Paragraph;
  result: FilterResult;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const opts = parseArgs(process.argv);
  if (!opts) { process.exit(1); }

  const { classification, sample } = opts;

  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('Error: ANTHROPIC_API_KEY is not set.');
    process.exit(1);
  }

  console.log(`\n═══════════════════════════════════════════════════════`);
  console.log(`  GOGI Pipeline v2 Validator  |  ${classification}`);
  console.log(`  sample: ${sample} paragraphs`);
  console.log(`═══════════════════════════════════════════════════════\n`);

  const criteria = loadCriteria(classification);
  const sources  = loadSources(classification);

  // Fetch books
  const books = await fetchBooksForClassification(sources, 20);
  console.log(`\n[Validator] ${books.length} books fetched. Collecting ${sample} candidate paragraphs...\n`);

  // Round-robin source sampling — same logic as run.ts
  // Per-source cap: ceil(sample / 3) so candidates spread across 3+ books
  const perSourceCap = Math.ceil(sample / 3);
  const candidates: Paragraph[] = [];
  const perSourceCount: Record<string, number> = {};

  for (const book of books) {
    if (candidates.length >= sample) break;
    const { strippedBook } = stripBookFrontMatter(book);
    const allParas = extractParagraphs(strippedBook);
    const complete = allParas.filter(p => !p.skippedReason);
    let fromThisBook = 0;
    for (const p of complete) {
      if (candidates.length >= sample) break;
      if (fromThisBook >= perSourceCap) break;
      candidates.push(p);
      perSourceCount[p.sourceTitle] = (perSourceCount[p.sourceTitle] ?? 0) + 1;
      fromThisBook++;
    }
  }

  const sourceBreakdown = Object.entries(perSourceCount)
    .sort((a, b) => b[1] - a[1])
    .map(([t, n]) => `    ${n}  ${t.slice(0, 55)}`)
    .join('\n');
  console.log(`[Validator] Collected ${candidates.length} candidates (per-source cap: ${perSourceCap}):\n${sourceBreakdown}\n`);
  console.log(`[Validator] Running v2 filter...\n`);

  // Run filter on each candidate
  const results: ValidatorResult[] = [];
  for (let i = 0; i < candidates.length; i++) {
    const para = candidates[i];
    console.log(`  [${i + 1}/${candidates.length}] "${para.sourceTitle.slice(0, 50)}" — ${para.wordCount}w`);
    const result = await filterParagraph(para, criteria);
    results.push({ para, result });
  }

  // ── Analysis ──────────────────────────────────────────────────────────────

  const yes = results.filter(r => r.result.suitable);
  const no  = results.filter(r => !r.result.suitable);

  // Per-Q failure counts
  const q1Fail = no.filter(r => r.result.q1 === 'fail').length;
  const q2Fail = no.filter(r => r.result.q1 === 'pass' && r.result.q2 === 'fail').length;
  const q3Fail = no.filter(r => r.result.q1 === 'pass' && r.result.q2 === 'pass' && r.result.q3 === 'fail').length;
  const q4Fail = no.filter(r => r.result.q1 === 'pass' && r.result.q2 === 'pass' && r.result.q3 === 'pass' && r.result.q4 === 'fail').length;
  const parseErr = no.filter(r => r.result.reasoning === 'parse_error').length;

  // Rejection reason distribution
  const reasonCounts: Record<string, number> = {};
  for (const r of no) {
    const reason = r.result.reasoning.slice(0, 80) || 'unknown';
    reasonCounts[reason] = (reasonCounts[reason] ?? 0) + 1;
  }
  const topReasons = Object.entries(reasonCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([r, n]) => `    ${n.toString().padStart(3)}  ${r}`)
    .join('\n');

  // Schema flags (even on YES passes)
  const allSchemaFlags: string[] = [];
  for (const r of results) {
    if (r.result.schemaFlags?.length) {
      allSchemaFlags.push(...r.result.schemaFlags);
    }
  }
  const flagCounts: Record<string, number> = {};
  for (const f of allSchemaFlags) {
    flagCounts[f] = (flagCounts[f] ?? 0) + 1;
  }
  const topFlags = Object.entries(flagCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([f, n]) => `    ${n.toString().padStart(3)}  ${f.slice(0, 80)}`)
    .join('\n');

  // YES passages list
  const yesLines = yes
    .map(r => `    "${r.para.sourceTitle.slice(0, 40)}" — ${r.para.text.slice(0, 60)}…`)
    .join('\n');

  console.log(`
═══════════════════════════════════════════════════════
  Validator complete — ${classification}
  Candidates tested:       ${results.length}
  YES (suitable):          ${yes.length} / ${results.length} (${results.length > 0 ? (yes.length / results.length * 100).toFixed(1) : 0}%)
  NO  (rejected):          ${no.length} / ${results.length}

  Per-Q failure breakdown (first failing Q per rejected passage):
    Q1 fail (not present):   ${q1Fail}
    Q2 fail (not dominant):  ${q2Fail}
    Q3 fail (accessibility): ${q3Fail}
    Q4 fail (isolation):     ${q4Fail}
    Parse error:             ${parseErr}

  Top rejection reasons:
${topReasons || '    (none)'}

  Schema dependency flags encountered (YES + NO combined):
${topFlags || '    (none)'}

  YES passages:
${yesLines || '    (none)'}
═══════════════════════════════════════════════════════
`);
}

main().catch(err => {
  console.error('[validator] fatal error:', err);
  process.exit(1);
});
