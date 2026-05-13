#!/usr/bin/env tsx
import fs from 'fs';
import path from 'path';
import {
  buildOfficialTeachableCorpus,
  officialTeachableCorpusClaudeMarkdown,
  officialTeachableCorpusMarkdown,
} from '../src/lib/teacher/officialTeachableCorpus';

async function main() {
  const corpus = await buildOfficialTeachableCorpus();
  const outDir = path.join(process.cwd(), 'data', 'official-text-library');
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'teachable-corpus.json'), JSON.stringify(corpus, null, 2));
  fs.writeFileSync(path.join(outDir, 'teachable-corpus.md'), officialTeachableCorpusMarkdown(corpus));
  fs.writeFileSync(path.join(outDir, 'teachable-corpus-claude.md'), officialTeachableCorpusClaudeMarkdown(corpus));

  console.log('\n═══════════════════════════════════════════════════════');
  console.log('  GOGI Official Teachable Corpus Built');
  console.log(`  Official texts:          ${corpus.summary.officialTexts}`);
  console.log(`  Stored/manual texts:     ${corpus.summary.locallyStoredTexts}`);
  console.log(`  Texts with gold cards:   ${corpus.summary.textsWithGoldCards}`);
  console.log(`  Gold-card text links:    ${corpus.summary.totalGoldCards}`);
  console.log(`  Standards represented:   ${corpus.summary.standardsRepresented}`);
  console.log('  JSON:                    data/official-text-library/teachable-corpus.json');
  console.log('  Summary:                 data/official-text-library/teachable-corpus.md');
  console.log('  Claude packet:           data/official-text-library/teachable-corpus-claude.md');
  console.log('═══════════════════════════════════════════════════════\n');
}

main().catch((error) => {
  console.error('[official-teachable-corpus] failed:', error);
  process.exit(1);
});
