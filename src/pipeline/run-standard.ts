#!/usr/bin/env node
/**
 * Standard-first Gutenberg harvest runner.
 *
 * Wraps the existing classification-first pipeline so teachers/admins can think
 * in FAST standards while the pipeline still uses the mature classification
 * criteria under the hood.
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config();

import { spawnSync } from 'child_process';
import { GUTENBERG_STANDARD_BLUEPRINTS, getGutenbergStandardBlueprint } from './standardBlueprints';

function printHelp() {
  console.log(`
GOGI Standard Gutenberg Pipeline

Usage:
  npm run pipeline:standard -- --standard <ELA.9...> [options]

Options:
  --standard          Required. FAST/B.E.S.T. standard code.
  --max              Max passages per classification (default: 12).
  --max-books        Max books per classification (default: 5).
  --per-source-cap   Max insertions per source title.
  --dry-run          Run harvest/filter only. No DB write.
  --write-all-passed Write every filter-passed passage as pending_review.
  --help             Show this help.

Supported standards:
  ${GUTENBERG_STANDARD_BLUEPRINTS.map((item) => item.standardCode).join('\n  ')}
`);
}

function readArg(args: string[], name: string) {
  const index = args.indexOf(name);
  return index !== -1 ? args[index + 1] : undefined;
}

function main() {
  const args = process.argv.slice(2);
  if (args.includes('--help') || args.includes('-h')) {
    printHelp();
    return;
  }

  const standardCode = readArg(args, '--standard');
  if (!standardCode) {
    console.error('Error: --standard is required.\n');
    printHelp();
    process.exit(1);
  }

  const blueprint = getGutenbergStandardBlueprint(standardCode);
  if (!blueprint) {
    console.error(`Error: no Gutenberg blueprint configured for ${standardCode}.\n`);
    printHelp();
    process.exit(1);
  }

  const max = readArg(args, '--max') ?? '12';
  const maxBooks = readArg(args, '--max-books') ?? '5';
  const perSourceCap = readArg(args, '--per-source-cap');
  const dryRun = args.includes('--dry-run');
  const writeAllPassed = args.includes('--write-all-passed');

  console.log('\n═══════════════════════════════════════════════════════');
  console.log(`  GOGI Standard Harvest  |  ${blueprint.standardCode}`);
  console.log(`  ${blueprint.teacherLabel}`);
  console.log('═══════════════════════════════════════════════════════');
  console.log(`  Student move: ${blueprint.studentMove}`);
  console.log(`  Harvest goal: ${blueprint.harvestGoal}`);
  console.log(`  Coverage strands: ${blueprint.coverageStrands?.length ?? 0}`);
  console.log(`  Fallback classifications: ${blueprint.classifications.join(', ')}`);
  console.log('═══════════════════════════════════════════════════════\n');

  const strandRuns = blueprint.coverageStrands?.length
    ? blueprint.coverageStrands
    : [
        {
          id: 'standard-general',
          label: blueprint.teacherLabel,
          studentCanDo: blueprint.studentMove,
          harvestSignals: [blueprint.harvestGoal],
          classifications: blueprint.classifications,
        },
      ];

  for (const strand of strandRuns) {
    const classifications = strand.classifications?.length
      ? strand.classifications
      : blueprint.classifications;

    console.log(`\n[strand] ${blueprint.standardCode} → ${strand.label}`);
    console.log(`  can-do: ${strand.studentCanDo}`);
    console.log(`  signals: ${strand.harvestSignals.join('; ')}`);

    for (const classification of classifications) {
      const commandArgs = [
        'tsx',
        'src/pipeline/run.ts',
        '--standard',
        blueprint.standardCode,
        '--coverage-strand',
        strand.id,
        '--coverage-label',
        strand.label,
        '--coverage-signals',
        strand.harvestSignals.join('|'),
        '--classification',
        classification,
        '--max',
        max,
        '--max-books',
        maxBooks,
      ];

      if (perSourceCap) commandArgs.push('--per-source-cap', perSourceCap);
      if (dryRun) commandArgs.push('--dry-run');
      if (writeAllPassed) commandArgs.push('--write-all-passed');

      console.log(`\n[standard] ${blueprint.standardCode} / ${strand.id} → ${classification}`);
      console.log(`npx ${commandArgs.join(' ')}\n`);

      const result = spawnSync('npx', commandArgs, {
        cwd: process.cwd(),
        env: process.env,
        stdio: 'inherit',
      });

      if (result.status !== 0) {
        console.error(
          `\n[standard] stopped: ${classification} exited with status ${result.status ?? 'unknown'}.`
        );
        process.exit(result.status ?? 1);
      }
    }
  }

  console.log('\n═══════════════════════════════════════════════════════');
  console.log(`  Standard harvest complete — ${blueprint.standardCode}`);
  console.log('  Review pending passages in /admin/gutenberg-library');
  console.log('═══════════════════════════════════════════════════════\n');
}

main();
