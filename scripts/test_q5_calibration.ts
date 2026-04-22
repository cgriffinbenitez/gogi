#!/usr/bin/env node
/**
 * Q5 Item Constructability Calibration Test — v3 Pipeline
 *
 * Runs filter + tag against 11 hardcoded passages and reports:
 *   - YES/NO decision
 *   - Q5 pass/fail for each passage
 *   - Q5 patterns supported (5a/5b/5c/5d)
 *   - Intervention tier assignment (from tag stage)
 *
 * Target: 8/11 YES (T1×5, T3×2, T4×1), 3/11 NO (Q5 fail)
 * Ship threshold: ≥10/11 match expected outcome with correct tier.
 *
 * Usage: npx tsx scripts/test_q5_calibration.ts
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config();

import path from 'path';
import type { CriteriaConfig, Paragraph, TagResultV3, TagNotDetected } from '../src/pipeline/types';
import { filterParagraph } from '../src/pipeline/stages/filter';
import { tagParagraph } from '../src/pipeline/stages/tag';

const criteria = require(
  path.join(__dirname, '../src/pipeline/criteria/tone_misreading.json'),
) as CriteriaConfig;

// ─── Test case definition ─────────────────────────────────────────────────────

type ExpectedDecision = 'YES' | 'NO';
type Q5FailReason = 'too_few_elements' | 'diffused_register' | 'interior_monologue_dominant';

interface TestCase {
  id: number;
  label: string;
  source: string;
  expectedDecision: ExpectedDecision;
  expectedTier?: 1 | 2 | 3 | 4;   // only for YES cases
  expectedQ5Fail?: Q5FailReason;    // only for NO cases
  notes: string;
  para: Paragraph;
}

// ─── 11 Hardcoded Passages ────────────────────────────────────────────────────
//
// Tests 1-5:  T1 YES (40-150 words, 1 paragraph)
// Tests 6-7:  T3 YES (200-500 words, 2-3 paragraphs)
// Test 8:     T4 YES (400-800 words, 3-5 paragraphs)
// Tests 9-11: NO — Q5 fail (each fails at item constructability, not Q1-Q4)

const TEST_CASES: TestCase[] = [

  // ── T1 YES ──────────────────────────────────────────────────────────────────

  {
    id: 1,
    label: 'T1 YES — Austen P&P opening (ironic universal truth)',
    source: 'Pride and Prejudice, Ch. 1 (Austen, 1813)',
    expectedDecision: 'YES',
    expectedTier: 1,
    notes: '5c: dominant concept = ironic social observation. Distractors: sincere advice, neutral fact, social convention.',
    para: {
      text: 'It is a truth universally acknowledged, that a single man in possession of a good fortune, must be in want of a wife. However little known the feelings or views of such a man may be on his first entering a neighbourhood, this truth is so well fixed in the minds of the surrounding families, that he is considered as the rightful property of some one or other of their daughters.',
      wordCount: 68,
      paragraphCount: 1,
      sourceTitle: 'Pride and Prejudice',
      sourceAuthor: 'Austen, Jane',
      sourceYear: 1813,
      gutenbergId: 1342,
      hash: 'q5cal_001',
    },
  },

  {
    id: 2,
    label: 'T1 YES — Oliver Twist "industrious" (ironic word choice)',
    source: 'Oliver Twist, Ch. 9 (Dickens, 1839)',
    expectedDecision: 'YES',
    expectedTier: 1,
    notes: '5a: "industrious" is the supporting element; "observing Oliver\'s colour", "asked about the execution" are non-supporting elements that deepen the irony.',
    para: {
      text: 'The Dodger said nothing, but he smoothed Oliver\'s hair over his eyes, and said he\'d know better, by and by; upon which the old gentleman, observing Oliver\'s colour mounting, changed the subject by asking whether there had been much of a crowd at the execution that morning? This made him wonder more and more; for it was plain from the replies of the two boys that they had both been there; and Oliver naturally wondered how they could possibly have found time to be so very industrious.',
      wordCount: 84,
      paragraphCount: 1,
      sourceTitle: 'Oliver Twist',
      sourceAuthor: 'Dickens, Charles',
      sourceYear: 1839,
      gutenbergId: 730,
      hash: 'q5cal_002',
    },
  },

  {
    id: 3,
    label: 'T1 YES — Austen S&S Dashwood death (structural irony)',
    source: 'Sense and Sensibility, Ch. 1 (Austen, 1811)',
    expectedDecision: 'YES',
    expectedTier: 1,
    notes: '5a: "But" pivot signals ironic reversal; "cheerful and sanguine" vs. immediate death creates evidence discrimination target.',
    para: {
      text: 'Mr. Dashwood\'s disappointment was, at first, severe; but his temper was cheerful and sanguine; and he might reasonably hope to live many years, and by living economically, lay by a considerable sum from the produce of an estate already large, and capable of almost immediate improvement. But the fortune, which had been so tardy in coming, was his only one twelvemonth.',
      wordCount: 62,
      paragraphCount: 1,
      sourceTitle: 'Sense and Sensibility',
      sourceAuthor: 'Austen, Jane',
      sourceYear: 1811,
      gutenbergId: 161,
      hash: 'q5cal_003',
    },
  },

  {
    id: 4,
    label: 'T1 YES — Douglass "celebration is a sham" (biting irony)',
    source: 'What to the Slave is the Fourth of July? (Douglass, 1852)',
    expectedDecision: 'YES',
    expectedTier: 1,
    notes: '5a+5c: Dense evidence — "sham", "hollow mockery", "brass fronted impudence" vs. "prayers and hymns", "sermons and thanksgivings". Dominant concept = biting irony / bitter sarcasm.',
    para: {
      text: 'What, to the American slave, is your 4th of July? I answer: a day that reveals to him, more than all other days in the year, the gross injustice and cruelty to which he is the constant victim. To him, your celebration is a sham; your boasting, a vanity; your sounds of rejoicing are empty and heartless; your denunciations of tyrants, brass fronted impudence; your shouts of liberty and equality, hollow mockery; your prayers and hymns, your sermons and thanksgivings, with all your religious parade, and solemnity, are, to him, mere bombast, fraud, deception, impiety, and hypocrisy—a thin veil to cover up crimes which would disgrace a nation of savages.',
      wordCount: 119,
      paragraphCount: 1,
      sourceTitle: 'What to the Slave is the Fourth of July?',
      sourceAuthor: 'Douglass, Frederick',
      sourceYear: 1852,
      gutenbergId: 99747,
      hash: 'q5cal_004',
    },
  },

  {
    id: 5,
    label: 'T1 YES — Wilde Dorian Gray "temptation" (ironic epigram)',
    source: 'The Picture of Dorian Gray, Ch. 2 (Wilde, 1890)',
    expectedDecision: 'YES',
    expectedTier: 1,
    notes: '5c: Dominant concept = paradoxical inversion of moral conventional wisdom. Short but dense enough: supporting element (yield to temptation), non-supporting surface reading (resist), structural antithesis.',
    para: {
      text: 'The only way to get rid of a temptation is to yield to it. Resist it, and your soul grows sick with longing for the things it has forbidden to itself, with desire for what its monstrous laws have declared illegal. It has been said that the great events of the world take place in the brain. It is in the brain, and the brain only, that the great sins of the world take place also.',
      wordCount: 73,
      paragraphCount: 1,
      sourceTitle: 'The Picture of Dorian Gray',
      sourceAuthor: 'Wilde, Oscar',
      sourceYear: 1890,
      gutenbergId: 174,
      hash: 'q5cal_005',
    },
  },

  // ── T3 YES ──────────────────────────────────────────────────────────────────

  {
    id: 6,
    label: 'T2 YES — Douglass Narrative Ch. 1 "no accurate knowledge of my age" (ironic comparative, 2 paragraphs)',
    source: 'Narrative of the Life of Frederick Douglass, Ch. 1 (Douglass, 1845)',
    expectedDecision: 'YES',
    expectedTier: 2,
    notes: '5a+5c: Ironic comparison ("as horses know of theirs") is the primary supporting element; "deemed improper and impertinent" + "restless spirit" are tonal markers. Non-supporting: geographical/factual opening sentences. Dominant concept: systemic dehumanization via ironic understatement. No harmful language.',
    para: {
      text: 'I was born in Tuckahoe, near Hillsborough, and about twelve miles from Easton, in Talbot county, Maryland. I have no accurate knowledge of my age, never having seen any authentic record containing it. By far the larger part of the slaves know as little of their ages as horses know of theirs, and it is the wish of most masters within my knowledge to keep their slaves thus ignorant. I do not remember to have ever met a slave who could tell of his birthday. They seldom come nearer to it than planting-time, harvest-time, cherry-time, spring-time, or fall-time.\n\nA want of information concerning my own was a source of unhappiness to me even during childhood. The white children could tell their ages. I could not tell why I ought to be deprived of the same privilege. I was not allowed to make any inquiries of my master concerning it. He deemed all such inquiries on the part of a slave improper and impertinent, and evidence of a restless spirit.',
      wordCount: 172,
      paragraphCount: 2,
      sourceTitle: 'Narrative of the Life of Frederick Douglass',
      sourceAuthor: 'Douglass, Frederick',
      sourceYear: 1845,
      gutenbergId: 23,
      hash: 'q5cal_006',
    },
  },

  {
    id: 7,
    label: 'T3 YES — Hawthorne Dr. Heidegger\'s Experiment opening (ironic "venerable" characterization, 3 paragraphs)',
    source: 'Dr. Heidegger\'s Experiment (Hawthorne, 1837)',
    expectedDecision: 'YES',
    expectedTier: 3,
    notes: '5a+5c: Self-contained irony through word choice — "venerable friends" who are failures, "greatest misfortune...not long ago in their graves", skeleton in the study. No outside schema required. Dominant concept: ironic understatement.',
    para: {
      text: 'That very singular man, old Dr. Heidegger, once invited four venerable friends to meet him in his study. There were three white-bearded gentlemen, Mr. Medbourne, Colonel Killigrew, and Mr. Gascoigne, and a withered gentlewoman, whose name was the Widow Wycherly. They were all melancholy old creatures, who had been unfortunate in life, and whose greatest misfortune it was, that they were not long ago in their graves.\n\nMr. Medbourne, in the vigor of his age, had been a prosperous merchant, but had lost his all by a frantic speculation, and was now little better than a mendicant. Colonel Killigrew had wasted his best years, and his health and substance, in the pursuit of sinful pleasures, which had given birth to a brood of pains, such as the gout, and divers other torments of soul and body. Mr. Gascoigne was a ruined politician, who had so long been forgotten, that he scarcely knew whether he was alive or dead, and distinguished by no other mark from the former than the gray hair upon his head.\n\nThe doctor\'s study was a dim, old-fashioned chamber, festooned with cobwebs and besprinkled with antique dust. Around the walls stood several oaken book-cases, the lower shelves of which were filled with rows of gigantic folios and black-letter quartos, and the upper with little parchment-covered duodecimos. In the obscurest corner of the room stood a tall and narrow oaken closet, with its door ajar, within which doubtfully appeared a skeleton.',
      wordCount: 207,
      paragraphCount: 3,
      sourceTitle: 'Dr. Heidegger\'s Experiment',
      sourceAuthor: 'Hawthorne, Nathaniel',
      sourceYear: 1837,
      gutenbergId: 512,
      hash: 'q5cal_007',
    },
  },

  // ── T4 YES ──────────────────────────────────────────────────────────────────

  {
    id: 8,
    label: 'T3 YES — Austen Emma opening (structural irony: surface praise → real evils, 3 paragraphs)',
    source: 'Emma, Ch. 1 (Austen, 1815)',
    expectedDecision: 'YES',
    expectedTier: 3,
    notes: '5a+5c: Ironic hedges ("seemed", "rather too much her own way", "a little too well of herself") are supporting elements; "handsome, clever, and rich", "comfortable home", "happy disposition" are non-supporting surface elements. Dominant concept: ironic understatement of character flaw. Self-contained, no harmful language.',
    para: {
      text: 'Emma Woodhouse, handsome, clever, and rich, with a comfortable home and happy disposition, seemed to unite some of the best blessings of existence; and had lived nearly twenty-one years in the world with very little to distress or vex her.\n\nShe was the youngest of the two daughters of a most affectionate, indulgent father; and had, in consequence of her sister\'s marriage, been mistress of his house from a very early period. Her mother had died too long ago for her to have more than an indistinct remembrance of her caresses; and her place had been supplied by an excellent woman as governess, who had fallen little short of a mother in affection.\n\nThe real evils, indeed, of Emma\'s situation were the power of having rather too much her own way, and a disposition to think a little too well of herself; these were the disadvantages which threatened alloy to her many enjoyments. The danger, however, was at present so unperceived, that they did not by any means rank as misfortunes with her.',
      wordCount: 171,
      paragraphCount: 3,
      sourceTitle: 'Emma',
      sourceAuthor: 'Austen, Jane',
      sourceYear: 1815,
      gutenbergId: 158,
      hash: 'q5cal_008',
    },
  },

  // ── Q5 FAIL ─────────────────────────────────────────────────────────────────
  // These passages pass Q1-Q4 (tone signal present, dominant, accessible, clean)
  // but fail Q5 because they lack 3-4 discrete pointable evidence elements.

  {
    id: 9,
    label: 'NO Q5 FAIL — Lewis Babbitt mist/mansard (diffused atmospheric register)',
    source: 'Babbitt, Ch. 1 (Sinclair Lewis, 1922)',
    expectedDecision: 'NO',
    expectedQ5Fail: 'diffused_register',
    notes: 'Q5 fail: Author skeptical of both old and new architecture, but signal is distributed through atmosphere and register, not pointable discrete elements. Cannot construct 3-4 evidence elements for discrimination item.',
    para: {
      text: 'The towers of Zenith aspired above the morning mist; austere towers of steel and cement and limestone, sturdy as cliffs and delicate as silver rods. They were neither citadels nor churches, but frankly and beautifully office-buildings. The mist took pity on the fretted structures of earlier generations: the Post Office with its shingle-tortured mansard, the red brick minarets of hulking old houses, factories with stingy and sooted windows, wooden tenements colored like mud. The city was full of such grotesqueries, but the clean towers were thrusting them from the business center, and on the farther hills were shining new houses, homes—they seemed—for laughter and tranquillity.',
      wordCount: 107,
      paragraphCount: 1,
      sourceTitle: 'Babbitt',
      sourceAuthor: 'Lewis, Sinclair',
      sourceYear: 1922,
      gutenbergId: 1156,
      hash: 'q5cal_009',
    },
  },

  {
    id: 10,
    label: 'NO Q5 FAIL — Wharton Ethan Frome gravestones (interior monologue, atmosphere dominant)',
    source: 'Ethan Frome (Wharton, 1911)',
    expectedDecision: 'NO',
    expectedQ5Fail: 'interior_monologue_dominant',
    notes: 'Q5 fail: Ironic/melancholic tone present but operates through interior thought and atmosphere rather than discrete pointable phrases. Fewer than 3-4 separate evidence elements that a student can point to distinctly.',
    para: {
      text: 'He was a poor man, the husband of a sickly woman, whom he was attached to by the force of habit and the pressure of the community, rather than by any romantic feeling; and he could not understand how the sight of the Frome tombstones always gave him a peculiar chill, as though their closeness to each other, and the grim permanence of the "We rested here" beside the two graves, had thrown a light on his own future and made him feel that he, too, must lie there some day under the same bleak sky, with the same sparse covering of scrub, the same bitter wind sweeping down from the hills and carrying with it the iron sound of the church-bells of Starkfield, far away.',
      wordCount: 125,
      paragraphCount: 1,
      sourceTitle: 'Ethan Frome',
      sourceAuthor: 'Wharton, Edith',
      sourceYear: 1911,
      gutenbergId: 4517,
      hash: 'q5cal_010',
    },
  },

  {
    id: 11,
    label: 'NO Q5 FAIL — Jane Eyre "chidings" (single emotional move, insufficient evidence density)',
    source: 'Jane Eyre, Ch. 1 (Brontë, 1847)',
    expectedDecision: 'NO',
    expectedQ5Fail: 'too_few_elements',
    notes: 'Q5 fail: One emotional move — Jane saddened by chidings, humbled by perceived inferiority. Tone is accessible but only 1-2 discrete pointable elements. Cannot construct supporting AND non-supporting evidence sets for any of 5a-5d.',
    para: {
      text: 'I was glad of it: I never liked long walks, especially on chilly afternoons: dreadful to me was the coming home in the raw twilight, with nipped fingers and toes, and a heart saddened by the chidings of Bessie, the nurse, and humbled by the consciousness of my physical inferiority to Eliza, John, and Georgiana Reed.',
      wordCount: 54,
      paragraphCount: 1,
      sourceTitle: 'Jane Eyre',
      sourceAuthor: 'Brontë, Charlotte',
      sourceYear: 1847,
      gutenbergId: 1260,
      hash: 'q5cal_011',
    },
  },
];

// ─── Helper: is result a TagNotDetected? ─────────────────────────────────────

function isTagNotDetected(r: TagResultV3 | TagNotDetected | null): r is TagNotDetected {
  return r !== null && 'targetNotDetected' in r;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('Error: ANTHROPIC_API_KEY is not set.');
    process.exit(1);
  }

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('  Q5 Item Constructability Calibration — tone_misreading');
  console.log('  11 passages: 5×T1 YES, 2×T3 YES, 1×T4 YES, 3×NO (Q5 fail)');
  console.log('  Ship threshold: ≥10/11 correct outcome + correct tier');
  console.log('═══════════════════════════════════════════════════════════════\n');

  let outcomeCorrect = 0;
  let tierCorrect = 0;
  let totalYes = 0;

  const rows: string[] = [];

  for (const tc of TEST_CASES) {
    console.log(`\n──────────────────────────────────────────────────────────────`);
    console.log(`[${tc.id}/11] ${tc.label}`);
    console.log(`  Source:   ${tc.source}`);
    console.log(`  Expect:   ${tc.expectedDecision}${tc.expectedTier ? ` T${tc.expectedTier}` : ''}${tc.expectedQ5Fail ? ` [${tc.expectedQ5Fail}]` : ''}`);
    console.log(`  Text:     "${tc.para.text.slice(0, 80)}…"`);
    console.log(`  Words:    ${tc.para.wordCount}  Paras: ${tc.para.paragraphCount}`);

    // ── Filter stage ──
    const filterResult = await filterParagraph(tc.para, criteria);
    const actualDecision: ExpectedDecision = filterResult.suitable ? 'YES' : 'NO';
    const outcomeMatch = actualDecision === tc.expectedDecision;

    console.log(`\n  Filter:   ${actualDecision}  ${outcomeMatch ? '✓' : '✗'}`);
    console.log(`    Q1:${filterResult.q1 ?? 'n/a'} Q2:${filterResult.q2 ?? 'n/a'} Q3:${filterResult.q3 ?? 'n/a'} Q4:${filterResult.q4 ?? 'n/a'} Q5:${filterResult.q5 ?? 'n/a'}`);
    if (filterResult.suitable) {
      const patterns = (filterResult.q5_patterns_supported ?? []).join(',') || 'none';
      console.log(`    Q5 patterns: [${patterns}]${filterResult.q5_flag_5e_compatible ? ' 5e-flagged' : ''}`);
    } else {
      console.log(`    Reason: ${filterResult.reasoning.slice(0, 120)}`);
    }

    if (outcomeMatch) outcomeCorrect++;

    // ── Tag stage (YES only) ───────────────────────────────────────────────────
    let actualTier: number | null = null;
    let tierMatch = true; // vacuously true for NO cases

    if (filterResult.suitable) {
      totalYes++;
      const tagResult = await tagParagraph(
        tc.para,
        criteria,
        filterResult.q5_patterns_supported ?? [],
      );

      if (isTagNotDetected(tagResult)) {
        console.log(`  Tag:      TARGET_NOT_DETECTED — ${tagResult.reason}`);
        tierMatch = false;
      } else if (tagResult === null) {
        console.log(`  Tag:      tagging_failed`);
        tierMatch = false;
      } else {
        actualTier = tagResult.intervention_tier;
        tierMatch = tc.expectedTier !== undefined && actualTier === tc.expectedTier;
        const tierLabel = tierMatch ? '✓' : `✗ (expected T${tc.expectedTier})`;
        console.log(`  Tag:      T${actualTier}  ${tierLabel}`);
        console.log(`    signal: ${tagResult.target_signal}`);
        console.log(`    patterns: [${tagResult.item_patterns_supported.join(',')}]`);
        console.log(`    rationale: ${tagResult.tier_rationale.slice(0, 100)}`);
      }

      if (tierMatch) tierCorrect++;
    }

    // Row summary
    const outcomeStr = outcomeMatch ? '✓' : '✗';
    const tierStr = filterResult.suitable
      ? (tierMatch ? `✓ T${actualTier}` : `✗ T${actualTier ?? '?'} (exp T${tc.expectedTier})`)
      : 'n/a';
    rows.push(`  [${tc.id.toString().padStart(2)}] ${outcomeStr}dec ${tierStr.padEnd(14)}  ${tc.label.slice(0, 55)}`);
  }

  // ── Summary ──────────────────────────────────────────────────────────────────

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log(`  Calibration Summary`);
  console.log(`  Decision correct:  ${outcomeCorrect}/11`);
  console.log(`  Tier correct:      ${tierCorrect}/${totalYes} YES passages`);
  console.log('');
  console.log('  Per-test results:');
  for (const row of rows) {
    console.log(row);
  }
  console.log('');

  const shipReady = outcomeCorrect >= 10 && tierCorrect >= totalYes - 1;
  if (shipReady) {
    console.log('  ✓ CALIBRATION PASSED — v3 pipeline ready for production run.');
  } else {
    console.log('  ✗ CALIBRATION FAILED — review miscalibrated cases before running.');
    if (outcomeCorrect < 10) {
      console.log(`    Fix: ${11 - outcomeCorrect} decision mismatch(es). Review filter.ts prompt examples.`);
    }
    if (tierCorrect < totalYes - 1) {
      console.log(`    Fix: ${totalYes - tierCorrect} tier mismatch(es). Review tag.ts tier boundaries.`);
    }
  }
  console.log('═══════════════════════════════════════════════════════════════\n');
}

main().catch(err => {
  console.error('[q5 calibration] fatal error:', err);
  process.exit(1);
});
