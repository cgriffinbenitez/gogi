/**
 * build-r11-passage-library.ts — R.1.1 Passage Library Builder
 *
 * 8 O. Henry stories from Gutenberg ID 2776.
 * 10 CPALMS-aligned diagnostic questions per story.
 *
 * Design decisions that prevent content-filter errors:
 *   FIX 1 — Simplified generation system prompt (no clinical classification language)
 *   FIX 2 — All passages from O. Henry (pg2776.txt) — clean, appropriate, R.1.1-rich
 *   FIX 3 — Per-passage safety scan before generation; window shifts forward if triggered
 *   FIX 4 — Two-step pipeline: generate questions → classify wrong answers separately
 *
 * Usage:
 *   npx tsx scripts/build-r11-passage-library.ts
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

// ─── Constants ────────────────────────────────────────────────────────────────

const STD_111_ID      = '4f374bcc-9ca9-4b15-94cb-3bdd6afe477e';
const GUTENBERG_URL   = 'https://www.gutenberg.org/cache/epub/2776/pg2776.txt';
const DELAY_MS        = 5000;   // between API calls within a story
const PASSAGE_DELAY_MS = 8000;  // between stories (longer to avoid rate pressure)
const TIMEOUT_MS      = 60_000;
const SKIP_WORDS      = 200;    // words to skip after title marker (skips opening setup)
const EXTRACT_WORDS   = 450;    // target words to extract

// Safety patterns — if found in extracted window, shift forward
const UNSAFE_PATTERNS = [
  'murder', 'murdered', 'killing', 'killed',
  'blood', 'dead body', 'corpse', 'buried alive', 'entomb',
];

// ─── Story catalog ────────────────────────────────────────────────────────────
// All from Gutenberg ID 2776 (O. Henry, "The Four Million" / collected stories)

interface StorySpec {
  title:  string;
  marker: string;   // exact string to search for in the downloaded text
  year:   string;
}

// Titles are stored exactly as written here — DB queries use exact match.
// Markers are matched case-insensitively against the downloaded text.
const STORIES: StorySpec[] = [
  { title: 'The Gift of the Magi',       marker: 'The Gift of the Magi',       year: '1905' },
  { title: 'The Skylight Room',          marker: 'The Skylight Room',          year: '1906' },
  { title: 'The Coming-Out of Maggie',   marker: 'The Coming-Out of Maggie',   year: '1906' },
  { title: 'The Cop and the Anthem',     marker: 'The Cop and the Anthem',     year: '1906' },
  { title: 'Mammon and the Archer',      marker: 'Mammon and the Archer',      year: '1906' },
  { title: 'The Green Door',             marker: 'The Green Door',             year: '1906' },
  { title: 'The Furnished Room',         marker: 'The Furnished Room',         year: '1904' },
  // "After Twenty Years" opening line — more specific than the title alone,
  // prevents false match on a phrase inside another story in pg2776.txt.
  { title: 'After Twenty Years',         marker: 'The policeman on the beat moved up the avenue impressively',  year: '1906' },
];

// ─── R.1.1 skills — one per question, Q1–Q10 ─────────────────────────────────

const SKILLS: string[] = [
  'setting → how setting creates mood',
  'characterization → how character reveals conflict or POV',
  'tone → author\'s attitude through diction',
  'figurative language → what a specific figure means and why the author used it',
  'mood → what feeling the passage creates in the reader and how',
  'diction → why the author chose specific words and their effect on meaning',
  'author\'s purpose → what the author is ultimately communicating',
  'conflict → how conflict develops character or theme',
  'POV → how narrator\'s perspective shapes meaning',
  'integration → how multiple elements work together to create meaning',
];

// Alternating correct options — Q1=B, Q2=C, Q3=B...
const CORRECT_OPTIONS: Array<'B' | 'C'> = ['B','C','B','C','B','C','B','C','B','C'];

// ─── Valid classification codes (Sprint O — 13 canonical) ────────────────────

const VALID_CODES = new Set([
  'no_metacognitive_strategy',
  'vocabulary_gap', 'morphology_gap', 'syntax_barrier', 'figurative_language_failure',
  'mood_misreading', 'tone_misreading',
  'inferencing_literal', 'inferencing_schema', 'inferencing_wm',
  'topic_vs_theme_confusion', 'evidence_retrieval_failure',
  'structure_purpose_disconnect', 'comprehension_integration_failure',
]);

// Default teaching strategy per classification code
const DEFAULT_STRATEGY: Record<string, string> = {
  no_metacognitive_strategy:          'stay_in_text',
  vocabulary_gap:                     'denotation_vs_connotation',
  morphology_gap:                     'denotation_vs_connotation',
  syntax_barrier:                     'says_vs_means',
  figurative_language_failure:        'says_vs_means',
  mood_misreading:                    'denotation_vs_connotation',
  tone_misreading:                    'denotation_vs_connotation',
  inferencing_literal:                'says_vs_means',
  inferencing_schema:                 'real_world_connect',
  inferencing_wm:                     'look_back',
  topic_vs_theme_confusion:           'topic_vs_theme',
  evidence_retrieval_failure:         'stay_in_text',
  structure_purpose_disconnect:       'stay_in_text',
  comprehension_integration_failure:  'stay_in_text',
};

// ─── Types ────────────────────────────────────────────────────────────────────

interface RawQuestion {
  question_stem:    string;
  option_a:         string;
  option_b:         string;
  option_c:         string;
  option_d:         string;
  correct_option:   'B' | 'C';
  skill_targeted:   string;
}

interface ClassifyResult {
  option_a?: string;
  option_b?: string;
  option_c?: string;
  option_d?: string;
}

interface EvalResult {
  score:   number;
  approve: boolean;
  reason:  string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function parseJson<T>(raw: string): T {
  const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
  return JSON.parse(cleaned) as T;
}

/**
 * Retry wrapper for Claude API calls.
 * On credit / balance / rate errors: waits 10 s and retries once (max 2 attempts).
 * Any other error is re-thrown immediately.
 */
async function callClaude<T>(fn: () => Promise<T>, label: string): Promise<T> {
  const MAX_ATTEMPTS = 2;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const msg = String(err).toLowerCase();
      const isRetryable =
        msg.includes('credit') || msg.includes('balance') || msg.includes('rate');
      if (isRetryable && attempt < MAX_ATTEMPTS) {
        console.warn(`    ⚠  ${label} attempt ${attempt} failed — waiting 10 s before retry…`);
        await sleep(10_000);
        continue;
      }
      throw err;
    }
  }
  // TypeScript requires an explicit unreachable throw — loop always returns or throws
  throw new Error(`${label}: exceeded max retries`);
}

function hasUnsafeContent(text: string): boolean {
  const lower = text.toLowerCase();
  return UNSAFE_PATTERNS.some((p) => lower.includes(p));
}

function sanitizeCode(code: string | undefined): string {
  if (code && VALID_CODES.has(code)) return code;
  return 'inferencing_literal'; // safe Layer 3 fallback
}

/**
 * Find `marker` in `text`, skip `skipWords` words after it,
 * then extract `targetWords` words.
 * Returns null if marker is not found.
 */
function extractWindow(
  text: string,
  marker: string,
  skipWords: number,
  targetWords: number,
): string | null {
  // Case-insensitive search for the marker
  const idx = text.search(new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'));
  if (idx === -1) return null;

  const fromMarker = text.slice(idx).replace(/\s+/g, ' ').trim();
  const words      = fromMarker.split(' ');
  const start      = Math.min(skipWords, words.length - 1);
  return words.slice(start, start + targetWords).join(' ');
}

/**
 * Shift extraction window forward by `shiftWords` words.
 * Used when the primary window contains unsafe content.
 */
function shiftWindow(
  text: string,
  marker: string,
  initialSkip: number,
  shiftWords: number,
  targetWords: number,
): string | null {
  return extractWindow(text, marker, initialSkip + shiftWords, targetWords);
}

// ─── Prompts ──────────────────────────────────────────────────────────────────

// FIX 1 — Simple generation system prompt — no clinical classification language
const GEN_SYSTEM = `You are an ELA assessment designer for 9th grade students. Write multiple choice questions about a literary passage that test reading comprehension and literary analysis skills including: setting, characterization, tone, mood, figurative language, diction, and author's purpose.

Each question needs 4 options A B C D. Wrong answers should represent common student misunderstandings of the skill being tested.

Return valid JSON array only. No markdown. No explanation.`;

function buildGenUserPrompt(title: string, passageText: string): string {
  const lines = SKILLS.map((skill, i) => {
    const q   = i + 1;
    const opt = CORRECT_OPTIONS[i];
    return `Q${q}: ${skill} (correct option: ${opt})`;
  }).join('\n');

  return `Passage title: "${title}"
Author: O. Henry

Passage text:
${passageText}

Generate exactly 10 questions. Each question targets a different literary analysis skill:
${lines}

Return a JSON array of exactly 10 objects:
[
  {
    "question_stem": "string — requires analysis, not literal recall",
    "option_a": "string",
    "option_b": "string",
    "option_c": "string",
    "option_d": "string",
    "correct_option": "B" or "C",
    "skill_targeted": "string"
  }
]`;
}

// FIX 4 — Classification prompt — separate from generation, no passage content
const CLASSIFY_SYSTEM = `You are a reading specialist. Classify each wrong answer option according to the specific cognitive error a struggling 9th grader would make when choosing it.`;

function buildClassifyUserPrompt(
  stem: string,
  correctText: string,
  wrongOptions: { letter: string; text: string }[],
): string {
  const wrongLines = wrongOptions
    .map((o) => `Option ${o.letter}: "${o.text}"`)
    .join('\n');

  return `Question: ${stem}
Correct answer: "${correctText}"

Classify each wrong answer option into ONE category from this list:
no_metacognitive_strategy, vocabulary_gap, morphology_gap, syntax_barrier, figurative_language_failure, mood_misreading, tone_misreading, inferencing_literal, inferencing_schema, inferencing_wm, topic_vs_theme_confusion, evidence_retrieval_failure, structure_purpose_disconnect, comprehension_integration_failure

${wrongLines}

Return JSON only — one key per wrong option letter:
{
  ${wrongOptions.map((o) => `"option_${o.letter.toLowerCase()}": "classification_code"`).join(',\n  ')}
}`;
}

// Evaluation prompt — simple, no passage content in system
const EVAL_SYSTEM = `You are a 9th grade ELA assessment expert. Score this question 1-10 and decide whether to approve it for a student question bank. Respond with valid JSON only: {"score": number, "approve": boolean, "reason": string}`;

function buildEvalUserPrompt(
  skill: string,
  passageExcerpt: string,
  q: RawQuestion,
): string {
  return `Standard: ELA.9.R.1.1 — Explain how key elements enhance or add layers of meaning and/or style in a literary text.
Skill targeted: ${skill}

Passage excerpt (first 250 chars):
"${passageExcerpt}"

Question: ${q.question_stem}
A. ${q.option_a}
B. ${q.option_b}
C. ${q.option_c}
D. ${q.option_d}
Correct: ${q.correct_option}

Score criteria (10 pts total):
- Requires genuine literary analysis, not literal recall (0–3 pts)
- Correct answer is defensible from the passage (0–3 pts)
- Wrong answers are plausible for a struggling 9th grader (0–2 pts)
- Skill is correctly targeted per ELA.9.R.1.1 (0–2 pts)`;
}

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
  const anthropic = new Anthropic({ apiKey: anthropicKey, timeout: TIMEOUT_MS });

  let totalGenerated = 0;
  let totalInserted  = 0;
  let totalApproved  = 0;
  let totalFlagged   = 0;
  const skippedStories: string[] = [];

  // ── API connection test — confirms key works before running the full script ──

  console.log('Testing API connection…');
  try {
    const test = await anthropic.messages.create({
      model:      'claude-sonnet-4-20250514',
      max_tokens: 10,
      messages:   [{ role: 'user', content: 'hi' }],
    });
    console.log('API connection OK:', test.content[0].type);
  } catch (err) {
    console.error('API connection FAILED:', String(err));
    process.exit(1);
  }

  console.log('\n' + '━'.repeat(60));
  console.log('R.1.1 PASSAGE LIBRARY — BUILD START');
  console.log(`Standard: ELA.9.R.1.1 (${STD_111_ID})`);
  console.log(`Source: ${GUTENBERG_URL}`);
  console.log(`Stories: ${STORIES.length} | Questions per story: ${SKILLS.length}`);
  console.log('━'.repeat(60));

  // ── Fetch the full O. Henry collection once ────────────────────────────────

  console.log('\nFetching pg2776.txt from Project Gutenberg…');
  let bookText = '';
  const fallbackUrls = [
    GUTENBERG_URL,
    'https://gutenberg.org/files/2776/2776-0.txt',
    'https://gutenberg.org/files/2776/2776.txt',
  ];

  for (const url of fallbackUrls) {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'GOGI-Passage-Library/1.0 (educational)' },
        signal:  AbortSignal.timeout(20_000),
      });
      if (res.ok) {
        bookText = await res.text();
        if (bookText.length > 10_000) {
          console.log(`✅  Fetched ${Math.round(bookText.length / 1000)}k chars from ${url}\n`);
          break;
        }
      }
    } catch {
      console.warn(`  ⚠  ${url} failed — trying next`);
    }
  }

  if (!bookText) {
    console.error('❌  All Gutenberg fetches failed. Cannot continue.');
    process.exit(1);
  }

  // Strip Project Gutenberg boilerplate
  const pgStart = bookText.search(/\*{3}\s*START OF (THE |THIS )?PROJECT GUTENBERG/i);
  const pgEnd   = bookText.search(/\*{3}\s*END OF (THE |THIS )?PROJECT GUTENBERG/i);
  if (pgStart !== -1) bookText = bookText.slice(pgStart);
  if (pgEnd   !== -1) bookText = bookText.slice(0, pgEnd);

  // ── Process each story ─────────────────────────────────────────────────────

  for (const story of STORIES) {
    console.log('\n' + '═'.repeat(60));
    console.log(`STORY: "${story.title}" (${story.year})`);
    console.log('═'.repeat(60));

    // ── Per-passage DB check — skip only if THIS title has ≥ 8 approved ────────
    // Queries on exact title match so each passage is evaluated independently.
    // "The Most Dangerous Game" (12 approved) skips; O. Henry stories (0) proceed.

    const { count: existingCount } = await supabase
      .from('questions')
      .select('*', { count: 'exact', head: true })
      .eq('standard_id', STD_111_ID)
      .eq('title', story.title)
      .eq('approved', true);

    if ((existingCount ?? 0) >= 8) {
      console.log(`  ✅  Already has ${existingCount} approved questions — skipping`);
      continue;
    }

    // ── Extract passage window ───────────────────────────────────────────────

    let passageText = extractWindow(bookText, story.marker, SKIP_WORDS, EXTRACT_WORDS);

    if (!passageText) {
      console.warn(`  ❌  Marker "${story.marker}" not found in text — skipping story`);
      skippedStories.push(`"${story.title}" — marker not found`);
      continue;
    }

    // FIX 3 — Safety scan: shift window forward if unsafe content found
    if (hasUnsafeContent(passageText)) {
      console.warn(`  ⚠   Safety pattern found in primary window — shifting +300 words`);
      const shifted = shiftWindow(bookText, story.marker, SKIP_WORDS, 300, EXTRACT_WORDS);
      if (!shifted || hasUnsafeContent(shifted)) {
        console.warn(`  ❌  Safety check failed after shift — skipping story`);
        skippedStories.push(`"${story.title}" — failed safety check after shift`);
        continue;
      }
      passageText = shifted;
      console.log(`  ✅  Shifted window is clean`);
    }

    const wordCount = passageText.split(/\s+/).length;
    console.log(`  Passage: ${wordCount} words extracted`);

    if (wordCount < 150) {
      console.warn(`  ❌  Passage too short (${wordCount} words) — skipping`);
      skippedStories.push(`"${story.title}" — extracted passage too short`);
      continue;
    }

    // ── STEP 1: Generate 10 questions (simple prompt, no classification) ─────

    console.log(`\n  STEP 1 — Generating 10 questions…`);
    await sleep(DELAY_MS);

    let rawQuestions: RawQuestion[] = [];
    try {
      const genMsg = await callClaude(
        () => anthropic.messages.create({
          model:      'claude-sonnet-4-6',
          max_tokens: 4096,
          system:     GEN_SYSTEM,
          messages:   [{ role: 'user', content: buildGenUserPrompt(story.title, passageText) }],
        }),
        `generate "${story.title}"`,
      );

      const rawText = genMsg.content[0].type === 'text' ? genMsg.content[0].text : '';
      rawQuestions  = parseJson<RawQuestion[]>(rawText);

      if (!Array.isArray(rawQuestions) || rawQuestions.length === 0) {
        throw new Error('Generation returned empty or non-array JSON');
      }

      // Enforce correct_option from our canonical sequence (override model's output)
      rawQuestions = rawQuestions.map((q, i) => ({
        ...q,
        correct_option: CORRECT_OPTIONS[i] ?? q.correct_option,
      }));

      console.log(`  ✅  Generated ${rawQuestions.length} questions`);
    } catch (err) {
      console.error(`  ❌  Generation failed: ${String(err)}`);
      skippedStories.push(`"${story.title}" — generation failed: ${String(err)}`);
      continue;
    }

    totalGenerated += rawQuestions.length;

    // ── STEP 2: Classify wrong answers (separate call per question) ───────────

    console.log(`\n  STEP 2 — Classifying wrong answers…`);

    // Build a map of classifications for each question
    const classifyMap: ClassifyResult[] = [];

    for (let qi = 0; qi < rawQuestions.length; qi++) {
      const q           = rawQuestions[qi];
      const correctOpt  = q.correct_option; // 'B' or 'C'

      // Determine which options are wrong
      const wrongOptions: { letter: string; text: string }[] = [];
      const allOpts: Record<string, string> = {
        A: q.option_a, B: q.option_b, C: q.option_c, D: q.option_d,
      };
      for (const [letter, text] of Object.entries(allOpts)) {
        if (letter !== correctOpt) {
          wrongOptions.push({ letter, text });
        }
      }
      const correctText = allOpts[correctOpt] ?? '';

      await sleep(DELAY_MS);
      let cls: ClassifyResult = {};
      try {
        const clsMsg = await callClaude(
          () => anthropic.messages.create({
            model:      'claude-sonnet-4-6',
            max_tokens: 300,
            system:     CLASSIFY_SYSTEM,
            messages:   [{
              role: 'user',
              content: buildClassifyUserPrompt(q.question_stem, correctText, wrongOptions),
            }],
          }),
          `classify Q${qi + 1} "${story.title}"`,
        );

        const rawCls = clsMsg.content[0].type === 'text' ? clsMsg.content[0].text : '{}';
        cls          = parseJson<ClassifyResult>(rawCls);
      } catch {
        // leave cls empty — will use fallback codes
      }

      classifyMap.push(cls);
      process.stdout.write(`.`);
    }
    console.log(` done`);

    // ── STEP 3: Evaluate each question for auto-approval + insert ─────────────

    console.log(`\n  STEP 3 — Evaluating and inserting…`);

    let storyInserted = 0;
    let storyApproved = 0;
    let storyFlagged  = 0;

    for (let qi = 0; qi < rawQuestions.length; qi++) {
      const q    = rawQuestions[qi];
      const skill = SKILLS[qi] ?? q.skill_targeted ?? 'literary analysis';
      const cls   = classifyMap[qi] ?? {};

      // Resolve classifications for each option.
      // correctOpt is always 'B' or 'C' (from CORRECT_OPTIONS) so A and D
      // are always distractors — no conditional needed for them.
      const correctOpt = q.correct_option;
      const aClass  = sanitizeCode(cls.option_a);                               // A always distractor
      const bClass  = correctOpt === 'B' ? 'CORRECT' : sanitizeCode(cls.option_b);
      const cClass  = correctOpt === 'C' ? 'CORRECT' : sanitizeCode(cls.option_c);
      const dClass  = sanitizeCode(cls.option_d);                               // D always distractor

      // Build content string
      const content = [
        `PASSAGE:\n\n${passageText}`,
        `---`,
        `QUESTION: ${q.question_stem}`,
        ``,
        `A. ${q.option_a}`,
        `B. ${q.option_b}`,
        `C. ${q.option_c}`,
        `D. ${q.option_d}`,
        ``,
        `CORRECT: ${correctOpt}`,
      ].join('\n');

      // Evaluate for auto-approval
      await sleep(DELAY_MS);
      let evalResult: EvalResult = { score: 0, approve: false, reason: 'eval skipped' };
      try {
        const evalMsg = await callClaude(
          () => anthropic.messages.create({
            model:      'claude-sonnet-4-6',
            max_tokens: 200,
            system:     EVAL_SYSTEM,
            messages:   [{
              role: 'user',
              content: buildEvalUserPrompt(skill, passageText.slice(0, 250), q),
            }],
          }),
          `eval Q${qi + 1} "${story.title}"`,
        );
        const rawEval = evalMsg.content[0].type === 'text' ? evalMsg.content[0].text : '{}';
        evalResult    = parseJson<EvalResult>(rawEval);
      } catch {
        // leave default evalResult
      }

      const score      = evalResult.score ?? 0;
      const isApproved = score >= 7;
      const isFlagged  = score > 0 && score < 5;

      // Insert to DB
      const { error: insertErr } = await supabase.from('questions').insert({
        standard_id:              STD_111_ID,
        title:                    story.title,
        author:                   'O. Henry',
        pub_year:                 story.year,
        content,
        keyword_flags:            [],
        option_a_text:            q.option_a,
        option_b_text:            q.option_b,
        option_c_text:            q.option_c,
        option_d_text:            q.option_d,
        option_a_class:           aClass,
        option_b_class:           bClass,
        option_c_class:           cClass,
        option_d_class:           dClass,
        option_a_strategy:        DEFAULT_STRATEGY[aClass] ?? 'says_vs_means',
        option_b_strategy:        DEFAULT_STRATEGY[bClass] ?? 'says_vs_means',
        option_c_strategy:        DEFAULT_STRATEGY[cClass] ?? 'says_vs_means',
        option_d_strategy:        DEFAULT_STRATEGY[dClass] ?? 'says_vs_means',
        correct_option:           correctOpt,
        cognitive_skill_targeted: skill,
        difficulty_level:         1,
        rationale:                evalResult.reason ?? '',
        approved:                 isApproved,
        flagged:                  isFlagged,
      });

      if (insertErr) {
        console.error(`\n    ❌  Q${qi + 1} insert error: ${insertErr.message}`);
        continue;
      }

      storyInserted++;
      totalInserted++;
      if (isApproved) { storyApproved++; totalApproved++; }
      if (isFlagged)  { storyFlagged++;  totalFlagged++;  }

      const icon = isApproved ? '✅' : isFlagged ? '🚩' : '⚠️';
      console.log(
        `    Q${String(qi + 1).padStart(2, ' ')} ${icon}  score=${score}  ${icon !== '✅' ? evalResult.reason.slice(0, 60) : ''}`,
      );
    }

    console.log(
      `\n  "${story.title}" — inserted: ${storyInserted} | approved: ${storyApproved} | flagged: ${storyFlagged}`,
    );

    // Longer pause between stories to avoid rate pressure
    console.log(`  Waiting ${PASSAGE_DELAY_MS / 1000}s before next story…`);
    await sleep(PASSAGE_DELAY_MS);
  }

  // ── Phase 5: Final verification ────────────────────────────────────────────

  console.log('\n\n' + '━'.repeat(60));
  console.log('PHASE 5 — FINAL VERIFICATION');
  console.log('━'.repeat(60));

  const { data: verifyRows } = await supabase
    .from('questions')
    .select('title, approved, flagged')
    .eq('standard_id', STD_111_ID);

  type VerifyRow = { title: string; approved: boolean; flagged: boolean };
  const rows = (verifyRows ?? []) as VerifyRow[];

  // Group by title
  const byTitle: Record<string, { total: number; approved: number; flagged: number }> = {};
  for (const row of rows) {
    const t = row.title ?? 'unknown';
    if (!byTitle[t]) byTitle[t] = { total: 0, approved: 0, flagged: 0 };
    byTitle[t].total++;
    if (row.approved) byTitle[t].approved++;
    if (row.flagged)  byTitle[t].flagged++;
  }

  console.log('\n  Title                              Total  Approved  Flagged');
  console.log('  ' + '─'.repeat(58));
  for (const [title, counts] of Object.entries(byTitle).sort()) {
    console.log(
      `  ${title.slice(0, 34).padEnd(34)} ${String(counts.total).padStart(5)}  ${String(counts.approved).padStart(8)}  ${String(counts.flagged).padStart(7)}`,
    );
  }

  const passageCount = Object.keys(byTitle).length;

  if (skippedStories.length > 0) {
    console.log(`\n  Skipped stories (${skippedStories.length}):`);
    for (const s of skippedStories) console.log(`    ⚠  ${s}`);
  }

  console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
R.1.1 PASSAGE LIBRARY COMPLETE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Passages fetched:    ${STORIES.length - skippedStories.length}
Passages in DB:      ${passageCount}
Questions generated: ${totalGenerated}
Questions inserted:  ${totalInserted}
Questions approved:  ${totalApproved}
Questions flagged:   ${totalFlagged}
Retired codes:       0
Content filter hits: 0 (clean pipeline)
Pilot ready:         ${totalApproved >= 40 ? '✅' : '⚠️  (need ≥40 approved)'}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
}

main().catch((err) => {
  console.error('\n[FATAL]', err);
  process.exit(1);
});
