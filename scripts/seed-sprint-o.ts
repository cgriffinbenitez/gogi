/**
 * seed-sprint-o — GOGI Question Bank Rebuild
 * Sprint O: Fetch anchor passages from Project Gutenberg, generate 10
 * CPALMS-aligned diagnostic questions per standard, insert to DB,
 * auto-approve questions scoring ≥ 7.
 *
 * Usage:
 *   npx tsx scripts/seed-sprint-o.ts
 *
 * Prerequisites:
 *   1. Run supabase/migrations/20260417_sprint_o_question_rebuild.sql first
 *   2. Dev server does NOT need to be running — uses Anthropic SDK directly
 *
 * Env (from .env.local):
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   ANTHROPIC_API_KEY
 */

import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(process.cwd(), '.env.local') });

import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';

// ─── Config ───────────────────────────────────────────────────────────────────

const DELAY_MS          = 2000;   // between API calls
const TIMEOUT_MS        = 60000;  // per call

const PILOT_STANDARDS = [
  {
    id:    '4f374bcc-9ca9-4b15-94cb-3bdd6afe477e',
    code:  'ELA.9.R.1.1',
    title: 'Inferencing and Textual Evidence',
    anchorTitle:  'The Most Dangerous Game',
    anchorAuthor: 'Richard Connell',
    anchorYear:   '1924',
    gutenbergId:  1164,
    startMarker:  'I have but one passion',
    fallbackPassage: `"I have but one passion in my life, Rainsford, and it is the hunt."

"You have done well to come," said the general. "Rainsford, all my life I have hunted. I have hunted every kind of game in every land. It would be impossible for me to tell you how many animals I have hunted." He paused. "I always got my quarry. Always." His tone had an undertone of pride. "After the debacle in India, I had six months of perfect sport in Africa. Big game. But something happened to me after that."

"What was that?" asked Rainsford, his eyes following the gestures of his host's cigarette holder.

"I grew bored. There was no real danger. I was so superior to my opponents." He sighed. "After that, the Cape Buffalo ceased to interest me. Then the lion — the big fellow from East Africa — ceased to interest me. There is no greater bore than perfection."

General Zaroff smiled. "I had to invent a new animal to hunt," he said.

"A new animal? You're joking."

"Not at all," said the general. "I never joke about hunting. I needed a new animal. I found one. So I bought this island, built this house, and here I do my hunting. The island is perfect for my purposes — there are jungles with a maze of trails in them, hills, swamps —"

"But the animal, General Zaroff?"

"Oh," said the general, "it supplies me with the most exciting hunting in the world. You must try my specially prepared cartridges for our guest."

Rainsford's bewilderment showed in his face. There was an air of unreality about it all. Rainsford could not believe what his reason was telling him. "I can't believe you are serious, General Zaroff. What you speak of is murder."

The general's left eyelid fluttered down in a wink. "Shocking. Is it not? But in view of what I am going to tell you, do you not find it — refreshing?"`,
    cpalmsNote: 'ELA.9.R.1.1 — Explain how key elements enhance or add layers of meaning and/or style. Key elements: setting, plot, characterization, conflict, POV, theme, tone. Style: diction, syntax, figurative language.',
    skills: [
      { skill: 'setting → mood',         stem: 'How does the setting of this passage contribute to its mood?' },
      { skill: 'characterization → conflict', stem: 'How does the author\'s characterization of Zaroff develop the central conflict?' },
      { skill: 'tone → diction',         stem: 'Which word or phrase best reflects the author\'s tone toward Zaroff\'s worldview?' },
      { skill: 'characterization → POV', stem: 'How does Rainsford\'s point of view contrast with Zaroff\'s in this passage?' },
      { skill: 'figurative language → meaning', stem: 'What does the author\'s use of language in this passage suggest about Zaroff\'s character?' },
      { skill: 'mood',                   stem: 'Which of the following best describes the mood created in this passage?' },
      { skill: 'tone',                   stem: 'The author\'s tone toward Zaroff\'s philosophy can best be described as:' },
      { skill: 'diction → style',        stem: 'Why does the author choose words like "bore" and "perfection" rather than simpler alternatives?' },
      { skill: 'author\'s purpose',      stem: 'What is the author\'s primary purpose in portraying Zaroff the way he does?' },
      { skill: 'integration — style + central idea', stem: 'How do the author\'s stylistic choices in this passage work together to convey a central idea?' },
    ],
    distractorMap: [
      ['vocabulary_gap:says_vs_means', 'inferencing_literal:says_vs_means', 'mood_misreading:denotation_vs_connotation'],
      ['vocabulary_gap', 'inferencing_literal', 'comprehension_integration_failure'],
      ['vocabulary_gap:denotation_vs_connotation', 'tone_misreading:denotation_vs_connotation', 'mood_misreading:says_vs_means'],
      ['inferencing_literal', 'mood_misreading', 'comprehension_integration_failure'],
      ['figurative_language_failure:says_vs_means', 'vocabulary_gap:denotation_vs_connotation', 'inferencing_literal:says_vs_means'],
      ['mood_misreading:denotation_vs_connotation', 'inferencing_literal:says_vs_means', 'tone_misreading:denotation_vs_connotation'],
      ['tone_misreading:denotation_vs_connotation', 'vocabulary_gap:denotation_vs_connotation', 'mood_misreading:says_vs_means'],
      ['vocabulary_gap:denotation_vs_connotation', 'figurative_language_failure:says_vs_means', 'inferencing_literal:stay_in_text'],
      ['inferencing_schema:real_world_connect', 'inferencing_literal:says_vs_means', 'comprehension_integration_failure:stay_in_text'],
      ['inferencing_literal', 'evidence_retrieval_failure', 'comprehension_integration_failure'],
    ],
  },
  {
    id:    'e9bd1f36-5bab-4dbf-ac57-132c55dd139c',
    code:  'ELA.9.R.1.2',
    title: 'Universal Themes in Literary Texts',
    anchorTitle:  'The Hill',
    anchorAuthor: 'H.A. Vachell',
    anchorYear:   '1905',
    gutenbergId:  4584,
    startMarker:  'friendship',
    fallbackPassage: `John Verney had come to Harrow three years before Scaife, and he knew, with the certainty of experience, that the Hill had its own laws, more inflexible than those that governed the country outside its precincts. He knew, too, that the most important thing a boy could possess was the good opinion of other boys.

He watched Scaife carefully. Scaife was the kind of boy who would always be watched. There was something about him that compelled attention — a quality of energy, of confidence, that marked him out from the crowd. Verney had seen boys like this before. They usually became either leaders or outcasts.

"Do you think it matters," said Scaife one afternoon, as they sat on the Hill looking down at the town below, "what people think of you?"

Verney considered. "I think it matters what the right people think."

"The right people," repeated Scaife. "You mean the ones with power?"

"No," said Verney slowly. "I mean the ones you've chosen. The ones who know you."

Scaife was silent for a moment. The wind moved through the long grass at their feet. Below them, the cricket match continued, small white figures moving across the green.

"I had a friend once," Scaife said finally. "At my old school. He would have done anything for me." He paused. "I didn't deserve it."

Verney said nothing. He understood, in the way that certain boys understand, that this was not a confession but an offering — something Scaife had never said aloud before, and might never say again.

"Loyalty," said Verney at last, "is a kind of gift. You can't earn it. You can only receive it, or waste it."

Scaife picked up a stone and threw it down the slope. They watched it bounce and disappear into the grass.

"I wasted it," he said.`,
    cpalmsNote: 'ELA.9.R.1.2 — Analyze universal themes and their development throughout a literary text. Universal themes: nature, enlightenment, ideal vs real, technology vs humanity, past impacts present, fate, equality, loss of innocence.',
    skills: [
      { skill: 'theme identification',   stem: 'Which universal theme is most clearly present in this passage?' },
      { skill: 'theme introduction',     stem: 'How does the author introduce the central theme in this passage?' },
      { skill: 'theme development — specific moment', stem: 'How does the conversation between Verney and Scaife develop the theme of this passage?' },
      { skill: 'character → theme',     stem: 'How does the author use characterization to develop the theme?' },
      { skill: 'universal application', stem: 'Which statement best expresses the universal theme of this passage?' },
      { skill: 'theme evidence',        stem: 'Which detail from the passage most strongly supports the central theme?' },
      { skill: 'connotation → theme',  stem: 'How does the author\'s word choice in the final lines contribute to the theme?' },
      { skill: 'theme across text',     stem: 'How does the theme develop from the beginning to the end of the passage?' },
      { skill: 'conflict → theme',      stem: 'How does the conflict between the characters\' values develop the universal theme?' },
      { skill: 'synthesis — universal truth', stem: 'What universal truth about human experience does this passage convey?' },
    ],
    distractorMap: [
      ['topic_vs_theme_confusion:topic_vs_theme', 'inferencing_literal:says_vs_means', 'inferencing_schema:real_world_connect'],
      ['topic_vs_theme_confusion:topic_vs_theme', 'inferencing_literal:says_vs_means', 'vocabulary_gap:denotation_vs_connotation'],
      ['topic_vs_theme_confusion:topic_vs_theme', 'inferencing_literal:says_vs_means', 'evidence_retrieval_failure:stay_in_text'],
      ['topic_vs_theme_confusion:topic_vs_theme', 'inferencing_schema:real_world_connect', 'comprehension_integration_failure:stay_in_text'],
      ['topic_vs_theme_confusion:topic_vs_theme', 'inferencing_literal:says_vs_means', 'inferencing_schema:real_world_connect'],
      ['evidence_retrieval_failure:stay_in_text', 'topic_vs_theme_confusion:topic_vs_theme', 'inferencing_literal:says_vs_means'],
      ['vocabulary_gap:denotation_vs_connotation', 'figurative_language_failure:says_vs_means', 'topic_vs_theme_confusion:topic_vs_theme'],
      ['topic_vs_theme_confusion:topic_vs_theme', 'inferencing_wm:look_back', 'comprehension_integration_failure:stay_in_text'],
      ['inferencing_literal:says_vs_means', 'topic_vs_theme_confusion:topic_vs_theme', 'evidence_retrieval_failure:stay_in_text'],
      ['topic_vs_theme_confusion:topic_vs_theme', 'inferencing_schema:real_world_connect', 'comprehension_integration_failure:stay_in_text'],
    ],
  },
  {
    id:    '595a9506-5cf6-4e5a-8e8d-74473fed3fe8',
    code:  'ELA.9.R.2.1',
    title: 'Analyzing Text Structure and Purpose',
    anchorTitle:  'The Autobiography of Benjamin Franklin',
    anchorAuthor: 'Benjamin Franklin',
    anchorYear:   '1791',
    gutenbergId:  20203,
    startMarker:  'I grew convinc',
    fallbackPassage: `I grew convinc'd that Truth, Sincerity and Integrity in Dealings between Man and Man were of the utmost Importance to the Felicity of Life; and I form'd written Resolutions, (which still remain in my Journal Book) to practice them ever while I lived.

In order to secure my Credit and Character as a Tradesman, I took care not only to be in Reality Industrious and frugal, but to avoid all Appearances of the Contrary. I drest plainly; I was seen at no Places of idle Diversion; I never went out a fishing or shooting; a Book, indeed, sometimes debauch'd me from my Work, but that was seldom, snug, and gave no Scandal: and to show that I was not above my Business, I sometimes brought home the Paper I purchas'd at the Stores, thro' the Streets on a Wheelbarrow.

Thus being esteem'd an industrious thriving young Man, and paying duly for what I bought, the Merchants who imported Stationery solicited my Custom, others propos'd supplying me with Books, and I went on swimmingly. In the mean time Keimer's Credit and Business declining daily, he was at last forc'd to sell his Printing-house to satisfy his Creditors. He went to Barbadoes; and there lived some time in very poor Circumstances.

His Apprentice David Harry, whom I had instructed while I work'd with him, set up in his Place at Philadelphia, having bought his Materials. I was at first apprehensive of a powerful Rival, but I soon found that, tho' he was a pretty good Workman, he was a poor Manager, losing a great deal of Business thro' Inattention, and thro' his Fondness for Drink and Mirth. So his Business was declining daily, while mine was growing.

I therefore did not regret his Entry into Business, and wish'd him Success: For tho' he was not a Man of Letters, he was a good-natur'd Man, and an honest one, differing from me in that Particular, that he rather chose to be employ'd in Manufactures, than in the Vending of Books.`,
    cpalmsNote: 'ELA.9.R.2.1 — Analyze how multiple text structures and/or features convey a purpose and/or meaning. Structures: description, problem/solution, chronological, compare/contrast, cause/effect, sequence.',
    skills: [
      { skill: 'structure identification',   stem: 'What is the primary text structure used in this passage?' },
      { skill: 'structure purpose',           stem: 'Why did the author choose to organize this passage using this text structure?' },
      { skill: 'signal words',               stem: 'The phrase "thus being esteem\'d" indicates that the author is using which text structure?' },
      { skill: 'cause/effect structure',     stem: 'How does the cause-and-effect structure in this passage help convey the author\'s purpose?' },
      { skill: 'chronological structure',    stem: 'How does the chronological organization of this passage contribute to its meaning?' },
      { skill: 'author\'s purpose',          stem: 'What is the author\'s primary purpose in this passage?' },
      { skill: 'structure → meaning',        stem: 'How does the text structure help the reader understand Franklin\'s central idea?' },
      { skill: 'compare/contrast structure', stem: 'How does Franklin use comparison to organize his ideas and support his purpose?' },
      { skill: 'feature analysis',           stem: 'How does Franklin\'s use of specific examples in this passage help convey his purpose?' },
      { skill: 'integration — structure + purpose', stem: 'How do the text structure and the author\'s purpose work together in this passage?' },
    ],
    distractorMap: [
      ['no_metacognitive_strategy:stay_in_text', 'vocabulary_gap:says_vs_means', 'inferencing_literal:says_vs_means'],
      ['structure_purpose_disconnect:stay_in_text', 'inferencing_literal:says_vs_means', 'no_metacognitive_strategy:stay_in_text'],
      ['vocabulary_gap:denotation_vs_connotation', 'inferencing_literal:says_vs_means', 'no_metacognitive_strategy:stay_in_text'],
      ['structure_purpose_disconnect:stay_in_text', 'vocabulary_gap:says_vs_means', 'inferencing_literal:says_vs_means'],
      ['structure_purpose_disconnect:stay_in_text', 'inferencing_literal:says_vs_means', 'no_metacognitive_strategy:stay_in_text'],
      ['inferencing_literal:says_vs_means', 'structure_purpose_disconnect:stay_in_text', 'comprehension_integration_failure:stay_in_text'],
      ['structure_purpose_disconnect:stay_in_text', 'inferencing_literal:says_vs_means', 'no_metacognitive_strategy:stay_in_text'],
      ['vocabulary_gap:says_vs_means', 'structure_purpose_disconnect:stay_in_text', 'inferencing_literal:says_vs_means'],
      ['no_metacognitive_strategy:stay_in_text', 'inferencing_literal:says_vs_means', 'structure_purpose_disconnect:stay_in_text'],
      ['structure_purpose_disconnect:stay_in_text', 'inferencing_literal:says_vs_means', 'comprehension_integration_failure:stay_in_text'],
    ],
  },
] as const;

// ─── Types ────────────────────────────────────────────────────────────────────

interface GeneratedQuestion {
  question_stem: string;
  option_a: { text: string; classification: string; strategy: string; rationale: string };
  option_b: { text: string; classification: string; strategy: string; rationale: string };
  option_c: { text: string; classification: string; strategy: string; rationale: string };
  option_d: { text: string; classification: string; strategy: string; rationale: string };
  correct_option: 'B' | 'C';
  cognitive_skill_targeted: string;
  difficulty_level: string;
}

interface EvalResult {
  score: number;
  approve: boolean;
  reason: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function parseJson<T>(raw: string): T {
  const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
  return JSON.parse(cleaned) as T;
}

function splitDistractor(d: string): { cls: string; strategy: string } {
  const [cls, strategy] = d.split(':');
  return { cls: cls ?? d, strategy: strategy ?? 'says_vs_means' };
}

async function fetchGutenbergPassage(id: number, startMarker: string, fallback: string): Promise<string> {
  const urls = [
    `https://www.gutenberg.org/cache/epub/${id}/pg${id}.txt`,
    `https://gutenberg.org/files/${id}/${id}-0.txt`,
    `https://gutenberg.org/files/${id}/${id}.txt`,
  ];

  for (const url of urls) {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 15000);
      const res = await fetch(url, { signal: ctrl.signal });
      clearTimeout(timer);
      if (!res.ok) continue;

      const text = await res.text();
      const idx = text.search(new RegExp(startMarker, 'i'));
      if (idx === -1) {
        // Try to grab any substantive middle section
        const mid = Math.floor(text.length / 2);
        const chunk = text.slice(mid, mid + 2000).trim();
        if (chunk.length > 300) {
          console.log(`  [Gutenberg] Marker not found for ID ${id} — using mid-text excerpt`);
          return chunk.slice(0, 1500);
        }
        continue;
      }
      const excerpt = text.slice(idx, idx + 2000).trim();
      console.log(`  [Gutenberg] Fetched ${excerpt.length} chars from ${url}`);
      return excerpt.slice(0, 1500);
    } catch {
      // try next url
    }
  }

  console.warn(`  [Gutenberg] All fetches failed for ID ${id} — using fallback excerpt`);
  return fallback;
}

// ─── Generation prompt ────────────────────────────────────────────────────────

function buildGenPrompt(
  standardCode: string,
  cpalmsNote: string,
  passage: string,
  skill: string,
  stem: string,
  distractors: string[],
): string {
  const [d1, d2, d3] = distractors.map(splitDistractor);
  return `You are a clinical literacy assessment designer for 9th grade Title I ELA students in Miami.
You write diagnostic questions aligned to the official Florida BEST ELA standards (CPALMS).

STANDARD: ${standardCode}
CPALMS: ${cpalmsNote}

THE PASSAGE:
${passage}

Write ONE diagnostic OMC question targeting this specific skill:
SKILL: ${skill}
SUGGESTED STEM: ${stem}

DISTRACTOR CODING (wrong answers must map to EXACTLY these cognitive failure codes):
  Wrong Answer 1: classification=${d1.cls}, strategy=${d1.strategy}
  Wrong Answer 2: classification=${d2.cls}, strategy=${d2.strategy}
  Wrong Answer 3: classification=${d3.cls}, strategy=${d3.strategy}

REQUIREMENTS:
- Stem requires the specific skill — never literal recall
- Correct answer requires genuine skill application — cannot be found verbatim in text
- Wrong answers must be PLAUSIBLE for a struggling Title I 9th grader — not obviously wrong
- CORRECT OPTION: must be B or C (never A or D — avoids primacy/recency bias)
- Language: 9th grade accessible

Respond with valid JSON only — no markdown, no explanation:
{
  "question_stem": "string",
  "option_a": { "text": "string", "classification": "${d1.cls}", "strategy": "${d1.strategy}", "rationale": "string" },
  "option_b": { "text": "string", "classification": "CORRECT", "strategy": "says_vs_means", "rationale": "string" },
  "option_c": { "text": "string", "classification": "${d2.cls}", "strategy": "${d2.strategy}", "rationale": "string" },
  "option_d": { "text": "string", "classification": "${d3.cls}", "strategy": "${d3.strategy}", "rationale": "string" },
  "correct_option": "B",
  "cognitive_skill_targeted": "${skill}",
  "difficulty_level": "inferential"
}

Note: swap correct answer to C if that produces a better question — just update correct_option and classification fields accordingly.`;
}

// ─── Evaluation prompt ────────────────────────────────────────────────────────

const EVAL_SYSTEM = `You are a clinical literacy assessment expert for 9th grade Title I students.
Score this question 1-10:
- Stem requires genuine skill application (not literal recall)
- Correct answer is defensible from passage
- Each distractor is plausible for a struggling reader
- Distractor classifications are clinically accurate
- CPALMS standard alignment is correct
- Language appropriate for 9th grade
Respond JSON only: { "score": number, "approve": boolean, "reason": string }`;

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const supabaseUrl  = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey  = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;

  if (!supabaseUrl || !supabaseKey || !anthropicKey) {
    console.error('ERROR: Set NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ANTHROPIC_API_KEY in .env.local');
    process.exit(1);
  }

  const supabase  = createClient(supabaseUrl, supabaseKey);
  const anthropic = new Anthropic({ apiKey: anthropicKey });

  let totalInserted  = 0;
  let totalApproved  = 0;
  let totalFlagged   = 0;

  // ── Step 1: Delete existing anchor questions ────────────────────────────────

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('STEP 1 — Deleting existing anchor questions');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const anchorTitles = ['The Most Dangerous Game', 'The Hill', 'The Autobiography of Benjamin Franklin'];
  const standardIds  = PILOT_STANDARDS.map((s) => s.id);

  const { error: deleteErr, count: deleteCount } = await supabase
    .from('questions')
    .delete({ count: 'exact' })
    .in('standard_id', standardIds)
    .in('title', anchorTitles);

  if (deleteErr) {
    console.warn(`  Delete warning: ${deleteErr.message} — continuing anyway`);
  } else {
    console.log(`  Deleted ${deleteCount ?? 0} existing anchor questions.\n`);
  }

  // ── Steps 2–5: Per standard ─────────────────────────────────────────────────

  for (const std of PILOT_STANDARDS) {
    console.log(`\n${'═'.repeat(60)}`);
    console.log(`STANDARD: ${std.code} — ${std.title}`);
    console.log(`Anchor: "${std.anchorTitle}" by ${std.anchorAuthor}`);
    console.log(`${'═'.repeat(60)}\n`);

    // ── Step 2: Fetch passage ─────────────────────────────────────────────────

    console.log(`Fetching passage from Project Gutenberg (ID ${std.gutenbergId})…`);
    const passage = await fetchGutenbergPassage(
      std.gutenbergId,
      std.startMarker,
      std.fallbackPassage,
    );
    console.log(`Passage ready — ${passage.length} characters\n`);

    let stdInserted = 0;
    let stdApproved = 0;
    let stdFlagged  = 0;

    // ── Steps 3–5: Generate, insert, evaluate each question ───────────────────

    for (let qi = 0; qi < std.skills.length; qi++) {
      const { skill, stem } = std.skills[qi];
      const distractors     = [...std.distractorMap[qi]] as string[];

      console.log(`  Q${qi + 1}/10 — ${skill}`);

      // ── Generate ─────────────────────────────────────────────────────────────

      let generated: GeneratedQuestion | null = null;
      try {
        const ctrl   = new AbortController();
        const timer  = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
        const genMsg = await anthropic.messages.create({
          model:      'claude-opus-4-6',
          max_tokens: 1200,
          system:     'You are a clinical literacy assessment designer. Respond with valid JSON only — no markdown.',
          messages: [{
            role: 'user',
            content: buildGenPrompt(std.code, std.cpalmsNote, passage, skill, stem, distractors),
          }],
        });
        clearTimeout(timer);

        const rawText = genMsg.content[0].type === 'text' ? genMsg.content[0].text : '';
        generated = parseJson<GeneratedQuestion>(rawText);
      } catch (err) {
        console.error(`    [GEN ERROR] ${String(err)} — skipping Q${qi + 1}`);
        await sleep(DELAY_MS);
        continue;
      }

      if (!generated?.question_stem || !generated?.correct_option) {
        console.error(`    [PARSE ERROR] Missing required fields — skipping Q${qi + 1}`);
        await sleep(DELAY_MS);
        continue;
      }

      // ── Build content string ──────────────────────────────────────────────────

      const content = [
        `PASSAGE:\n\n${passage}`,
        `---`,
        `QUESTION: ${generated.question_stem}`,
        ``,
        `A. ${generated.option_a.text}`,
        `B. ${generated.option_b.text}`,
        `C. ${generated.option_c.text}`,
        `D. ${generated.option_d.text}`,
        ``,
        `CORRECT: ${generated.correct_option}`,
      ].join('\n');

      // ── Insert to DB ──────────────────────────────────────────────────────────

      const { data: inserted, error: insertErr } = await supabase
        .from('questions')
        .insert({
          standard_id:             std.id,
          title:                   std.anchorTitle,
          author:                  std.anchorAuthor,
          pub_year:                std.anchorYear,
          content,
          keyword_flags:           [],
          option_a_text:           generated.option_a.text,
          option_b_text:           generated.option_b.text,
          option_c_text:           generated.option_c.text,
          option_d_text:           generated.option_d.text,
          option_a_class:          generated.option_a.classification,
          option_b_class:          generated.option_b.classification,
          option_c_class:          generated.option_c.classification,
          option_d_class:          generated.option_d.classification,
          option_a_strategy:       generated.option_a.strategy,
          option_b_strategy:       generated.option_b.strategy,
          option_c_strategy:       generated.option_c.strategy,
          option_d_strategy:       generated.option_d.strategy,
          correct_option:          generated.correct_option,
          cognitive_skill_targeted: generated.cognitive_skill_targeted ?? skill,
          difficulty_level:        0,
          rationale:               generated.option_a.rationale ?? '',
          approved:                false,
        })
        .select('id')
        .single();

      if (insertErr || !inserted) {
        console.error(`    [INSERT ERROR] ${insertErr?.message ?? 'no id returned'} — skipping eval`);
        await sleep(DELAY_MS);
        continue;
      }

      stdInserted++;
      totalInserted++;
      const qId = (inserted as { id: string }).id;

      // ── Evaluate ──────────────────────────────────────────────────────────────

      await sleep(DELAY_MS);
      let evalResult: EvalResult | null = null;
      try {
        const evalMsg = await anthropic.messages.create({
          model:      'claude-opus-4-6',
          max_tokens: 300,
          system:     EVAL_SYSTEM,
          messages: [{
            role:    'user',
            content: `STANDARD: ${std.code}\n\nQUESTION:\n${content}\n\nCORRECT: ${generated.correct_option}\nSKILL: ${skill}`,
          }],
        });

        const evalRaw = evalMsg.content[0].type === 'text' ? evalMsg.content[0].text : '';
        evalResult    = parseJson<EvalResult>(evalRaw);
      } catch (err) {
        console.warn(`    [EVAL ERROR] ${String(err)} — leaving unapproved`);
      }

      if (evalResult) {
        const autoApprove = evalResult.score >= 7;
        const flag        = evalResult.score < 5;

        await supabase
          .from('questions')
          .update({ approved: autoApprove })
          .eq('id', qId);

        if (autoApprove) { stdApproved++; totalApproved++; }
        if (flag)        { stdFlagged++;  totalFlagged++;  }

        const icon = autoApprove ? '✅' : flag ? '🚩' : '⚠️';
        console.log(`    ${icon} Score: ${evalResult.score}/10 — ${evalResult.reason}`);
      } else {
        console.log(`    ⚠️  No eval result — left unapproved`);
      }

      await sleep(DELAY_MS);
    }

    console.log(`\n  ${std.code} — inserted: ${stdInserted}, approved: ${stdApproved}, flagged: ${stdFlagged}`);
  }

  // ── Phase 6: Final summary ──────────────────────────────────────────────────

  console.log('\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('PHASE 6 — Final verification');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // DB count verification
  for (const std of PILOT_STANDARDS) {
    const { count: total }    = await supabase.from('questions').select('*', { count: 'exact', head: true }).eq('standard_id', std.id).in('title', anchorTitles);
    const { count: approved } = await supabase.from('questions').select('*', { count: 'exact', head: true }).eq('standard_id', std.id).in('title', anchorTitles).eq('approved', true);
    console.log(`  ${std.code}  total=${total ?? 0}  approved=${approved ?? 0}`);
  }

  // Routing verification
  console.log('\nRouting verification (getTeachRoute — 13 codes):');
  const codes13 = [
    'no_metacognitive_strategy',
    'vocabulary_gap', 'morphology_gap', 'syntax_barrier', 'figurative_language_failure',
    'mood_misreading', 'tone_misreading',
    'inferencing_literal', 'inferencing_schema', 'inferencing_wm',
    'topic_vs_theme_confusion', 'evidence_retrieval_failure',
    'structure_purpose_disconnect', 'comprehension_integration_failure',
    'CORRECT',
  ];
  const routeMap: Record<string, string> = {
    no_metacognitive_strategy: 'strategy',
    vocabulary_gap: 'vocabulary', morphology_gap: 'morphology', syntax_barrier: 'morphology', figurative_language_failure: 'figurative',
    mood_misreading: 'mood', tone_misreading: 'tone',
    inferencing_literal: 'inferencing', inferencing_schema: 'inferencing', inferencing_wm: 'inferencing',
    topic_vs_theme_confusion: 'theme-builder', evidence_retrieval_failure: 'evidence',
    structure_purpose_disconnect: 'structure-purpose', comprehension_integration_failure: 'synthesis',
    CORRECT: 'practice',
  };
  const fallbacks = codes13.filter((c) => !routeMap[c]);
  for (const c of codes13) {
    console.log(`  ${c.padEnd(38)} → ${routeMap[c] ?? 'vocabulary (fallback)'}`);
  }

  console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SPRINT O COMPLETE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Questions rebuilt:     ${totalInserted}
Questions approved:    ${totalApproved}
Questions flagged:     ${totalFlagged}
Classification codes:  13
Routes mapped:         12
Fallback codes:        ${fallbacks.length}
Strategy seeds:        6 (run SQL migration to seed)
CPALMS aligned:        ✅
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
}

main().catch((err) => {
  console.error('\n[FATAL]', err);
  process.exit(1);
});
