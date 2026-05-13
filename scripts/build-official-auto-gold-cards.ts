#!/usr/bin/env tsx
import fs from 'fs';
import path from 'path';
import {
  buildOfficialAutoGoldCardCorpus,
  officialAutoGoldCardsMarkdown,
} from '../src/lib/teacher/officialAutoGoldCards';

async function main() {
  const corpus = await buildOfficialAutoGoldCardCorpus();
  const outDir = path.join(process.cwd(), 'data', 'official-text-library');
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'auto-ready-gold-cards.json'), JSON.stringify(corpus, null, 2));
  fs.writeFileSync(path.join(outDir, 'auto-ready-gold-cards.md'), officialAutoGoldCardsMarkdown(corpus));

  console.log('\n═══════════════════════════════════════════════════════');
  console.log('  GOGI Auto-Ready Gold Cards Built');
  console.log(`  Auto-ready cards:          ${corpus.summary.autoReadyCards}`);
  console.log(`  Texts with cards:          ${corpus.summary.textsWithAutoReadyCards}`);
  console.log(`  Standards represented:     ${corpus.summary.standardsRepresented}`);
  console.log('  JSON:                      data/official-text-library/auto-ready-gold-cards.json');
  console.log('  Summary:                   data/official-text-library/auto-ready-gold-cards.md');
  console.log('═══════════════════════════════════════════════════════\n');
}

main().catch((error) => {
  console.error('[official-auto-gold-cards] failed:', error);
  process.exit(1);
});
