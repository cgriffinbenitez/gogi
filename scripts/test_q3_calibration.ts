#!/usr/bin/env node
/**
 * Q3 Accessibility Calibration Test
 * One-off script to verify v2 filter correctly gates Dickens institutional
 * tone patterns vs. clinically clean tone passages.
 *
 * Usage: npx tsx scripts/test_q3_calibration.ts
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config();

import path from 'path';
import type { CriteriaConfig, Paragraph } from '../src/pipeline/types';
import { filterParagraph } from '../src/pipeline/stages/filter';

const criteria = require(
  path.join(__dirname, '../src/pipeline/criteria/tone_misreading.json'),
) as CriteriaConfig;

// ─── Test cases ───────────────────────────────────────────────────────────────

interface TestCase {
  label: string;
  expected: 'REJECT' | 'APPROVE';
  para: Paragraph;
}

const TEST_CASES: TestCase[] = [
  {
    label: 'TEST 1 — should REJECT (institutional schema) — A Tale of Two Cities',
    expected: 'REJECT',
    para: {
      text: 'There were a king with a large jaw and a queen with a plain face, on the throne of England; there were a king with a large jaw and a queen with a fair face, on the throne of France. In both countries it was clearer than crystal to the lords of the State preserves of loaves and fishes, that things in general were settled for ever.',
      wordCount: 62,
      sourceTitle: 'A Tale of Two Cities',
      sourceAuthor: 'Dickens, Charles',
      sourceYear: 1859,
      gutenbergId: 98,
      hash: 'test001',
    },
  },
  {
    label: 'TEST 2 — should REJECT (institutional schema) — Bleak House',
    expected: 'REJECT',
    para: {
      text: 'The raw afternoon is rawest, and the dense fog is densest, and the muddy streets are muddiest near that leaden-headed old obstruction, appropriate ornament for the threshold of a leaden-headed old corporation, Temple Bar. And hard by Temple Bar, in Lincoln\'s Inn Hall, at the very heart of the fog, sits the Lord High Chancellor in his High Court of Chancery.',
      wordCount: 61,
      sourceTitle: 'Bleak House',
      sourceAuthor: 'Dickens, Charles',
      sourceYear: 1853,
      gutenbergId: 1023,
      hash: 'test002',
    },
  },
  {
    label: 'TEST 3 — should REJECT (no tone present) — A Christmas Carol',
    expected: 'REJECT',
    para: {
      text: 'The same face: the very same. Marley in his pigtail, usual waistcoat, tights and boots; the tassels on the latter bristling, like his pigtail, and his coat-skirts, and the hair upon his head. The chain he drew was clasped about his middle. It was long, and wound about him like a tail; and it was made (for Scrooge observed it closely) of cash-boxes, keys, padlocks, ledgers, deeds, and heavy purses wrought in steel.',
      wordCount: 72,
      sourceTitle: 'A Christmas Carol in Prose; Being a Ghost Story of Christmas',
      sourceAuthor: 'Dickens, Charles',
      sourceYear: 1843,
      gutenbergId: 46,
      hash: 'test003',
    },
  },
  {
    label: 'TEST 4 — should APPROVE (clinically clean) — Oliver Twist',
    expected: 'APPROVE',
    para: {
      text: 'The Dodger said nothing, but he smoothed Oliver\'s hair over his eyes, and said he\'d know better, by and by; upon which the old gentleman, observing Oliver\'s colour mounting, changed the subject by asking whether there had been much of a crowd at the execution that morning? This made him wonder more and more; for it was plain from the replies of the two boys that they had both been there; and Oliver naturally wondered how they could possibly have found time to be so very industrious.',
      wordCount: 84,
      sourceTitle: 'Oliver Twist',
      sourceAuthor: 'Dickens, Charles',
      sourceYear: 1839,
      gutenbergId: 730,
      hash: 'test004',
    },
  },
  {
    label: 'TEST 5 — should APPROVE (clinically clean) — Sense and Sensibility',
    expected: 'APPROVE',
    para: {
      text: 'Mr. Dashwood\'s disappointment was, at first, severe; but his temper was cheerful and sanguine; and he might reasonably hope to live many years, and by living economically, lay by a considerable sum from the produce of an estate already large, and capable of almost immediate improvement. But the fortune, which had been so tardy in coming, was his only one twelvemonth.',
      wordCount: 62,
      sourceTitle: 'Sense and Sensibility',
      sourceAuthor: 'Austen, Jane',
      sourceYear: 1811,
      gutenbergId: 161,
      hash: 'test005',
    },
  },
];

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('Error: ANTHROPIC_API_KEY is not set.');
    process.exit(1);
  }

  console.log('\n═══════════════════════════════════════════════════════');
  console.log('  Q3 Accessibility Calibration Test — tone_misreading');
  console.log('  5 passages: 3 should-REJECT, 2 should-APPROVE');
  console.log('═══════════════════════════════════════════════════════\n');

  let correct = 0;
  let incorrect = 0;

  for (const tc of TEST_CASES) {
    console.log(`\n──────────────────────────────────────────────────────`);
    console.log(`${tc.label}`);
    console.log(`Expected: ${tc.expected}`);
    console.log(`Text: "${tc.para.text.slice(0, 80)}…"`);

    const result = await filterParagraph(tc.para, criteria);
    const actual = result.suitable ? 'APPROVE' : 'REJECT';
    const match  = actual === tc.expected ? '✓ CORRECT' : '✗ MISCALIBRATED';

    console.log(`\nResult:   ${actual}  ${match}`);
    console.log(`  decision:     ${result.suitable ? 'YES' : 'NO'}`);
    console.log(`  q1_presence:  ${result.q1 ?? 'n/a'}`);
    console.log(`  q2_dominance: ${result.q2 ?? 'n/a'}`);
    console.log(`  q3_access:    ${result.q3 ?? 'n/a'}`);
    console.log(`  q4_isolation: ${result.q4 ?? 'n/a'}`);
    console.log(`  reason:       ${result.reasoning.slice(0, 120)}`);
    if (result.schemaFlags?.length) {
      console.log(`  schema_flags:`);
      for (const f of result.schemaFlags) {
        console.log(`    - ${f.slice(0, 100)}`);
      }
    }

    if (actual === tc.expected) { correct++; } else { incorrect++; }
  }

  console.log('\n═══════════════════════════════════════════════════════');
  console.log(`  Score: ${correct}/5 correct`);
  if (incorrect === 0) {
    console.log('  v2 filter is correctly calibrated for this test set.');
  } else {
    console.log(`  WARNING: ${incorrect} miscalibrated result(s) — review before next run.`);
  }
  console.log('═══════════════════════════════════════════════════════\n');
}

main().catch(err => {
  console.error('[calibration test] fatal error:', err);
  process.exit(1);
});
