#!/usr/bin/env tsx
import fs from 'fs';
import path from 'path';
import {
  buildOfficialExcerptInventory,
  officialExcerptInventoryMarkdown,
} from '../src/lib/teacher/officialExcerptInventory';

function readArg(args: string[], name: string) {
  const index = args.indexOf(name);
  return index !== -1 ? args[index + 1] : undefined;
}

async function main() {
  const args = process.argv.slice(2);
  const maxPerLane = Number(readArg(args, '--max-per-lane') ?? '50');
  const inventory = await buildOfficialExcerptInventory({
    maxPerTextStandardStrand: Number.isFinite(maxPerLane) ? maxPerLane : 50,
  });
  const outDir = path.join(process.cwd(), 'data', 'official-text-library');
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'teachable-excerpt-inventory.json'), JSON.stringify(inventory, null, 2));
  fs.writeFileSync(path.join(outDir, 'teachable-excerpt-inventory.md'), officialExcerptInventoryMarkdown(inventory));

  console.log('\n═══════════════════════════════════════════════════════');
  console.log('  GOGI Official Excerpt Inventory Built');
  console.log(`  Official texts:             ${inventory.summary.officialTexts}`);
  console.log(`  Local source texts:         ${inventory.summary.localTexts}`);
  console.log(`  Texts with candidates:      ${inventory.summary.textsWithCandidates}`);
  console.log(`  Mined teachable candidates: ${inventory.summary.totalCandidates}`);
  console.log(`  Standards represented:      ${inventory.summary.standardsRepresented}`);
  console.log('  JSON:                       data/official-text-library/teachable-excerpt-inventory.json');
  console.log('  Summary:                    data/official-text-library/teachable-excerpt-inventory.md');
  console.log('═══════════════════════════════════════════════════════\n');
}

main().catch((error) => {
  console.error('[official-excerpt-inventory] failed:', error);
  process.exit(1);
});
