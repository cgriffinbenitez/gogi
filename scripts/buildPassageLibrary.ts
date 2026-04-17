/**
 * buildPassageLibrary.ts — GOGI Passage Library Builder
 *
 * Fetches 4 safe passages per standard (12 total) from Project Gutenberg,
 * generates one OMC diagnostic question per passage via Claude,
 * auto-approves (score ≥ 7), and inserts into the questions table.
 *
 * Content-filter safety:
 *   - Every passage is pre-screened for violent/slavery/mature content
 *   - startMarker anchors extract only the known-safe section of each text
 *   - All Claude API calls are wrapped in try/catch — a failed call skips
 *     that passage and continues; the script never stops for a single failure
 *
 * Usage:
 *   npx tsx scripts/buildPassageLibrary.ts
 *
 * Env (from .env.local):
 *   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ANTHROPIC_API_KEY
 */

import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(process.cwd(), '.env.local') });

import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';

// ─── Config ───────────────────────────────────────────────────────────────────

const FETCH_DELAY_MS = 1200;
const GEN_DELAY_MS   = 2500;
const EVAL_DELAY_MS  = 1500;

// ─── Standard registry ────────────────────────────────────────────────────────

const STD = {
  'ELA.9.R.1.1': {
    id:    '4f374bcc-9ca9-4b15-94cb-3bdd6afe477e',
    title: 'Inferencing and Textual Evidence',
    type:  'inferencing' as const,
  },
  'ELA.9.R.1.2': {
    id:    'e9bd1f36-5bab-4dbf-ac57-132c55dd139c',
    title: 'Universal Themes in Literary Texts',
    type:  'universal_theme' as const,
  },
  'ELA.9.R.2.1': {
    id:    '595a9506-5cf6-4e5a-8e8d-74473fed3fe8',
    title: 'Analyzing Text Structure and Purpose',
    type:  'text_structure' as const,
  },
} as const;

type StandardCode = keyof typeof STD;
type StandardType  = 'inferencing' | 'universal_theme' | 'text_structure';

// ─── Passage catalog ──────────────────────────────────────────────────────────
//
// gutenbergId  → try direct fetch first
// searchQuery  → Gutendex search fallback (or primary if no ID given)
// startMarker  → find this exact string in the downloaded text, extract from there
// targetWords  → approx 250-350 words extracted from that point
// safetyNote   → documents WHY this section is content-filter safe

interface PassageSpec {
  gutenbergId?: number;
  searchQuery:  string;
  title:        string;
  author:       string;
  year:         string;
  standardCode: StandardCode;
  difficulty:   1 | 2 | 3 | 4;
  startMarker:  string;
  targetWords:  number;
  safetyNote:   string;
}

const CATALOG: PassageSpec[] = [

  // ══════════════════════════════════════════════════════════════════════════
  // ELA.9.R.1.1 — Inferencing and Textual Evidence
  // ══════════════════════════════════════════════════════════════════════════

  {
    // GID 2776 = "Whirligigs" (O. Henry, 1917) — contains "After Twenty Years"
    gutenbergId: 2776,
    searchQuery: 'after twenty years o henry whirligigs',
    title:       'After Twenty Years',
    author:      'O. Henry',
    year:        '1906',
    standardCode:'ELA.9.R.1.1',
    difficulty:  1,
    startMarker: 'The policeman on the beat moved up the avenue impressively',
    targetWords: 300,
    safetyNote:  'Opening scene — cop on beat, two old friends reunite. No violence, no mature content.',
  },
  {
    // GID 1583 = "Roads of Destiny" (O. Henry) — contains "The Last Leaf"
    gutenbergId: 1583,
    searchQuery: 'last leaf o henry roads destiny',
    title:       'The Last Leaf',
    author:      'O. Henry',
    year:        '1907',
    standardCode:'ELA.9.R.1.1',
    difficulty:  2,
    startMarker: 'In a little district west of Washington Square',
    targetWords: 300,
    safetyNote:  'Opening — two young artists, ivy vine on brick wall. No death depicted in extract.',
  },
  {
    gutenbergId: 9902,
    searchQuery: 'white heron sarah orne jewett',
    title:       'A White Heron',
    author:      'Sarah Orne Jewett',
    year:        '1886',
    standardCode:'ELA.9.R.1.1',
    difficulty:  3,
    startMarker: 'The woods were already filled with shadows one June evening',
    targetWords: 300,
    safetyNote:  'Opening woods scene — girl and cow walking home at dusk. Pastoral, entirely safe.',
  },
  {
    // GID 57161 = "A New England Nun and Other Stories" by Mary Wilkins Freeman
    searchQuery: 'revolt of mother mary wilkins freeman new england nun',
    title:       'The Revolt of "Mother"',
    author:      'Mary E. Wilkins Freeman',
    year:        '1890',
    standardCode:'ELA.9.R.1.1',
    difficulty:  4,
    startMarker: '"Father!"',
    targetWords: 300,
    safetyNote:  'Opening farm dialogue — husband/wife/daughter about a new barn. No mature content.',
  },

  // ══════════════════════════════════════════════════════════════════════════
  // ELA.9.R.1.2 — Universal Themes in Literary Texts
  // ══════════════════════════════════════════════════════════════════════════

  {
    gutenbergId: 2376,
    searchQuery: 'up from slavery booker washington',
    title:       'Up From Slavery',
    author:      'Booker T. Washington',
    year:        '1901',
    standardCode:'ELA.9.R.1.2',
    difficulty:  1,
    // Skip the plantation opening — extract only the aspirations/education section
    startMarker: 'From the time that I can remember having any thoughts about anything',
    targetWords: 300,
    safetyNote:  'Aspirations section — about longing to learn to read, not the plantation opening. No graphic slavery descriptions.',
  },
  {
    gutenbergId: 45,
    searchQuery: 'anne of green gables montgomery',
    title:       'Anne of Green Gables',
    author:      'L.M. Montgomery',
    year:        '1908',
    standardCode:'ELA.9.R.1.2',
    difficulty:  2,
    startMarker: 'Mrs. Rachel Lynde lived just where the Avonlea main road',
    targetWords: 300,
    safetyNote:  'Opening scene — neighborly village description. Entirely safe and appropriate.',
  },
  {
    gutenbergId: 113,
    searchQuery: 'secret garden frances hodgson burnett',
    title:       'The Secret Garden',
    author:      'Frances Hodgson Burnett',
    year:        '1911',
    standardCode:'ELA.9.R.1.2',
    difficulty:  3,
    // Garden discovery scene — skip the orphan/cholera opening
    startMarker: 'It was the sweetest, most mysterious-looking place',
    targetWords: 300,
    safetyNote:  'Garden discovery scene — wonder and beauty. Skips orphan/cholera opening entirely.',
  },
  {
    gutenbergId: 514,
    searchQuery: 'little women louisa may alcott',
    title:       'Little Women',
    author:      'Louisa May Alcott',
    year:        '1868',
    standardCode:'ELA.9.R.1.2',
    difficulty:  4,
    startMarker: '"Christmas won\'t be Christmas without any presents,"',
    targetWords: 300,
    safetyNote:  'Opening scene — four sisters at home on Christmas Eve. Cheerful, entirely safe.',
  },

  // ══════════════════════════════════════════════════════════════════════════
  // ELA.9.R.2.1 — Analyzing Text Structure and Purpose
  // ══════════════════════════════════════════════════════════════════════════

  {
    gutenbergId: 2489,
    searchQuery: 'rip van winkle washington irving sketch book',
    title:       'Rip Van Winkle',
    author:      'Washington Irving',
    year:        '1819',
    standardCode:'ELA.9.R.2.1',
    difficulty:  1,
    startMarker: 'Whoever has made a voyage up the Hudson',
    targetWords: 300,
    safetyNote:  'Opening description — Catskill Mountains, Dutch village. Purely scenic and safe.',
  },
  {
    gutenbergId: 245,
    searchQuery: 'life on the mississippi mark twain',
    title:       'Life on the Mississippi',
    author:      'Mark Twain',
    year:        '1883',
    standardCode:'ELA.9.R.2.1',
    difficulty:  2,
    // Use the geographical opening — well before slavery chapters
    startMarker: 'The Mississippi is well worth reading about.',
    targetWords: 300,
    safetyNote:  'Geographical opening — river statistics and natural description. Avoids slavery chapters entirely.',
  },
  {
    gutenbergId: 205,
    searchQuery: 'walden henry david thoreau',
    title:       'Walden',
    author:      'Henry David Thoreau',
    year:        '1854',
    standardCode:'ELA.9.R.2.1',
    difficulty:  3,
    startMarker: 'When I wrote the following pages',
    targetWords: 300,
    safetyNote:  'Economy chapter opening — self-reliance philosophy. No mature content.',
  },
  {
    gutenbergId: 98,
    searchQuery: 'tale of two cities charles dickens',
    title:       'A Tale of Two Cities',
    author:      'Charles Dickens',
    year:        '1859',
    standardCode:'ELA.9.R.2.1',
    difficulty:  4,
    startMarker: 'It was the best of times, it was the worst of times',
    targetWords: 220, // Famous opening paragraph is ~200 words — extract fully
    safetyNote:  'Famous opening paragraph only — contrasting anaphora, rhetorical structure. Safe.',
  },
];

// ─── Claude prompts ───────────────────────────────────────────────────────────

const EVAL_SYSTEM = `You are a clinical literacy assessment expert. Evaluate this OMC diagnostic question for 9th grade Title I students against these criteria:
1. Stem requires inferencing / theme analysis / structure analysis — NOT literal recall
2. Correct answer is genuinely defensible from passage text
3. Each distractor is plausible and maps logically to its cognitive layer
4. Wrong answers are NOT obviously wrong to a careful reader
5. Language is appropriate for 9th grade reading level

Respond with valid JSON only — no markdown. Keep "reason" under 40 words. Keep each "issues" item under 15 words:
{
  "score": number,
  "approve": boolean,
  "reason": string,
  "issues": string[]
}`;

const BASE_GEN_SYSTEM = `You are a clinical literacy assessment designer for 9th grade Title I ELA students in Miami. Write Ordered Multiple Choice (OMC) diagnostic questions where each wrong answer is pre-coded to a specific cognitive breakdown layer.

Layers:
- Layer 1 (schema_deficit or no_metacognitive_strategy): student lacks background knowledge or reading strategy
- Layer 2 (vocabulary_gap or morphology_gap): student is blocked by a specific word or structure
- Layer 3 (inferencing_deficit or evidence_retrieval_failure): student decodes but cannot draw conclusions

Write ONE question with EXACTLY 4 options: 1 correct + 1 Layer-1 distractor + 1 Layer-2 distractor + 1 Layer-3 distractor.

RULES:
- correct_option must be B or C (never A or D — avoids primacy/recency bias)
- Every distractor must be genuinely plausible — a smart student who missed the specific cognitive move would pick it
- Never make wrong answers obviously wrong
- rationale must explain why each distractor maps to its layer

Respond with valid JSON only — no markdown:
{
  "question_stem": string,
  "option_a": { "text": string, "classification": string },
  "option_b": { "text": string, "classification": string },
  "option_c": { "text": string, "classification": string },
  "option_d": { "text": string, "classification": string },
  "correct_option": "B" | "C",
  "cognitive_skill_targeted": string,
  "rationale": string,
  "difficulty_level": "scaffolded" | "standard" | "transfer"
}`;

const STANDARD_INSTRUCTION: Record<StandardType, string> = {
  inferencing: `Question type: INFERENCING
Stem must require reading between the lines — never ask for a fact directly stated.
Correct: genuine inference from implicit textual evidence.
Layer 1 distractor: schema-based guess using surface topic knowledge, not text evidence.
Layer 2 distractor: plausible misreading caused by misunderstanding a key vocabulary word.
Layer 3 distractor: literal reading that missed the implied meaning.
Stem format: "Based on this passage, what does [detail] most strongly suggest about [character/situation]?" or "What can the reader infer about [subject] from [specific detail]?"`,

  universal_theme: `Question type: UNIVERSAL THEME
Stem must ask what the text reveals about human nature or experience — beyond specific plot events.
Correct: universal theme that applies broadly to human experience, supported by textual evidence.
Layer 1 distractor: confuses a plot summary or character action with the theme (what happened, not what it means).
Layer 2 distractor: misreads a key thematic word or symbol, arriving at a plausible but wrong thematic claim.
Layer 3 distractor: identifies a topic (a single word like "loss") rather than a theme (a complete statement about human experience).
Stem format: "Based on this passage, what does [story element] most strongly suggest about [aspect of human experience]?"`,

  text_structure: `Question type: TEXT STRUCTURE AND PURPOSE
Stem must ask HOW the author organized the text OR WHY they structured it that way.
Correct: correctly identifies both the text structure AND the author's purpose for using it.
Layer 1 distractor: student has no schema for text structures (chronological, cause/effect, compare/contrast, problem/solution) and guesses based on content alone.
Layer 2 distractor: student misreads a structural signal word or transition, leading to wrong structure identification.
Layer 3 distractor: student identifies WHAT the text is about (content/topic) instead of HOW it is organized (structure/purpose).
Stem format: "How does the author organize this passage?" or "Why does the author [structural choice] in this passage?" or "Which text structure best describes how the author develops the central idea?"`,
};

// ─── Types ────────────────────────────────────────────────────────────────────

interface GenResponse {
  question_stem:            string;
  option_a:                 { text: string; classification: string };
  option_b:                 { text: string; classification: string };
  option_c:                 { text: string; classification: string };
  option_d:                 { text: string; classification: string };
  correct_option:           'B' | 'C';
  cognitive_skill_targeted: string;
  rationale:                string;
  difficulty_level:         string;
}

interface EvalResult {
  score:   number;
  approve: boolean;
  reason:  string;
  issues:  string[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function parseJson<T>(raw: string): T {
  return JSON.parse(
    raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, ''),
  ) as T;
}

/** Strip Project Gutenberg header/footer boilerplate */
function stripPGWrapper(text: string): string {
  const startPatterns = [
    /\*{3}\s*START OF (THE|THIS) PROJECT GUTENBERG[^\n]*\n/i,
    /\*{3}\s*START OF (THE|THIS) GUTENBERG[^\n]*\n/i,
  ];
  const endPatterns = [
    /\*{3}\s*END OF (THE|THIS) PROJECT GUTENBERG/i,
    /\*{3}\s*END OF (THE|THIS) GUTENBERG/i,
  ];

  let body = text;

  for (const pat of startPatterns) {
    const m = body.match(pat);
    if (m && m.index !== undefined) {
      body = body.slice(m.index + m[0].length);
      break;
    }
  }

  for (const pat of endPatterns) {
    const m = body.match(pat);
    if (m && m.index !== undefined) {
      body = body.slice(0, m.index);
      break;
    }
  }

  return body;
}

/**
 * Find startMarker in text, then extract targetWords words from that point.
 * Returns null if marker is not found.
 */
function extractWindow(text: string, startMarker: string, targetWords: number): string | null {
  const idx = text.indexOf(startMarker);
  if (idx === -1) return null;

  const fromMarker = text.slice(idx);
  // Normalize whitespace — collapse multiple spaces/newlines into single space
  const normalized = fromMarker.replace(/\s+/g, ' ').trim();

  // Extract targetWords words
  const words = normalized.split(' ');
  const selected = words.slice(0, targetWords);
  return selected.join(' ');
}

/** Try to fetch Gutenberg plain text by book ID */
async function fetchByGutenbergId(id: number): Promise<string | null> {
  const urls = [
    `https://www.gutenberg.org/cache/epub/${id}/pg${id}.txt`,
    `https://www.gutenberg.org/files/${id}/${id}-0.txt`,
    `https://www.gutenberg.org/files/${id}/${id}.txt`,
  ];

  for (const url of urls) {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'GOGI-Passage-Library-Builder/1.0' },
        signal:  AbortSignal.timeout(15_000),
      });
      if (res.ok) {
        const text = await res.text();
        if (text.length > 500) return text; // sanity check — real books are large
      }
    } catch {
      // try next URL
    }
  }
  return null;
}

/** Try to find a Gutenberg text via Gutendex search */
async function fetchBySearch(query: string): Promise<string | null> {
  try {
    const searchRes = await fetch(
      `https://gutendex.com/books?search=${encodeURIComponent(query)}`,
      {
        headers: { Accept: 'application/json', 'User-Agent': 'GOGI-Passage-Library-Builder/1.0' },
        signal:  AbortSignal.timeout(10_000),
      },
    );
    if (!searchRes.ok) return null;

    const data = await searchRes.json() as {
      results: Array<{ formats: Record<string, string> }>
    };
    const books = data.results ?? [];

    for (const book of books.slice(0, 3)) {
      const textUrl =
        book.formats['text/plain; charset=utf-8'] ||
        book.formats['text/plain; charset=us-ascii'] ||
        book.formats['text/plain'] ||
        null;

      if (!textUrl) continue;

      try {
        const textRes = await fetch(textUrl, {
          headers: { 'User-Agent': 'GOGI-Passage-Library-Builder/1.0' },
          signal:  AbortSignal.timeout(15_000),
        });
        if (textRes.ok) {
          const text = await textRes.text();
          if (text.length > 500) return text;
        }
      } catch {
        continue;
      }
    }
  } catch {
    // search failed
  }
  return null;
}

/**
 * Fetch passage text for a spec: try by GutenbergId first, then searchQuery.
 * Returns the raw full book text, or null on failure.
 */
async function fetchBookText(spec: PassageSpec): Promise<string | null> {
  let text: string | null = null;

  if (spec.gutenbergId) {
    text = await fetchByGutenbergId(spec.gutenbergId);
    if (text) return text;
    console.log(`    ⚠  ID ${spec.gutenbergId} fetch failed — trying search`);
  }

  text = await fetchBySearch(spec.searchQuery);
  return text;
}

function buildQuestionBlock(r: GenResponse): string {
  return (
    '\n\n---\n\n' +
    `QUESTION: ${r.question_stem}\n\n` +
    `A. ${r.option_a.text}\n` +
    `B. ${r.option_b.text}\n` +
    `C. ${r.option_c.text}\n` +
    `D. ${r.option_d.text}\n\n` +
    `CORRECT: ${r.correct_option}\n` +
    `DIAGNOSTIC_CLASSIFICATION_A: ${r.option_a.classification}\n` +
    `DIAGNOSTIC_CLASSIFICATION_B: ${r.option_b.classification}\n` +
    `DIAGNOSTIC_CLASSIFICATION_C: ${r.option_c.classification}\n` +
    `DIAGNOSTIC_CLASSIFICATION_D: ${r.option_d.classification}\n` +
    `COGNITIVE_SKILL: ${r.cognitive_skill_targeted}`
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const supabaseUrl  = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey  = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('❌  Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }
  if (!anthropicKey) {
    console.error('❌  Missing ANTHROPIC_API_KEY');
    process.exit(1);
  }

  const supabase  = createClient(supabaseUrl, supabaseKey);
  const anthropic = new Anthropic({ apiKey: anthropicKey, timeout: 60_000 });

  console.log('\n' + '═'.repeat(70));
  console.log('GOGI Passage Library Builder — 12 passages × 3 standards');
  console.log('═'.repeat(70));

  const skipped: string[] = [];
  let inserted = 0;
  let approved = 0;

  // ── Track processed passages to skip duplicates ──────────────────────────
  for (const spec of CATALOG) {
    const std     = STD[spec.standardCode];
    const label   = `[${spec.standardCode} D${spec.difficulty}] "${spec.title}"`;

    console.log(`\n${'─'.repeat(70)}`);
    console.log(`${label}`);
    console.log(`  Author: ${spec.author} (${spec.year})`);
    console.log(`  Safety: ${spec.safetyNote}`);

    // ── Check if already in DB (idempotent) ────────────────────────────────
    const { data: existing } = await supabase
      .from('questions')
      .select('id')
      .eq('standard_id', std.id)
      .eq('difficulty_level', spec.difficulty)
      .ilike('content', `%${spec.startMarker.slice(0, 30)}%`)
      .limit(1);

    if (existing && existing.length > 0) {
      console.log(`  ✅  Already in DB — skipping`);
      continue;
    }

    // ── Fetch book text ────────────────────────────────────────────────────
    await sleep(FETCH_DELAY_MS);
    process.stdout.write(`  Fetching from Gutenberg… `);

    let bookText: string | null = null;
    try {
      bookText = await fetchBookText(spec);
    } catch (err) {
      console.log(`❌  Fetch error: ${(err as Error).message}`);
      skipped.push(`${label} — fetch error: ${(err as Error).message}`);
      continue;
    }

    if (!bookText) {
      console.log('❌  Could not retrieve text');
      skipped.push(`${label} — Gutenberg fetch returned no text`);
      continue;
    }
    console.log(`✅  (${Math.round(bookText.length / 1000)}k chars)`);

    // ── Strip PG header/footer ─────────────────────────────────────────────
    const bodyText = stripPGWrapper(bookText);

    // ── Extract safe window ────────────────────────────────────────────────
    const passageText = extractWindow(bodyText, spec.startMarker, spec.targetWords);

    if (!passageText) {
      console.log(`  ❌  startMarker not found: "${spec.startMarker.slice(0, 50)}…"`);
      skipped.push(`${label} — startMarker not found in downloaded text`);
      continue;
    }

    const wordCount = passageText.split(/\s+/).length;
    console.log(`  Extracted ${wordCount} words from safe section`);

    if (wordCount < 150) {
      console.log(`  ⚠   Too short (${wordCount} words) — skipping`);
      skipped.push(`${label} — extracted text too short (${wordCount} words)`);
      continue;
    }

    // ── Generate OMC question ──────────────────────────────────────────────
    await sleep(GEN_DELAY_MS);
    process.stdout.write(`  Generating question (${std.type})… `);

    const genSystem = BASE_GEN_SYSTEM + '\n\n' + STANDARD_INSTRUCTION[std.type];
    const genUser   =
      `Standard: ${spec.standardCode} — ${std.title}\n` +
      `Passage title: ${spec.title}\n` +
      `Author: ${spec.author} (${spec.year})\n` +
      `Difficulty target: ${spec.difficulty === 1 ? 'scaffolded' : spec.difficulty <= 3 ? 'standard' : 'transfer'}\n\n` +
      `PASSAGE:\n${passageText}`;

    let genParsed: GenResponse;
    try {
      const msg = await anthropic.messages.create({
        model:      'claude-sonnet-4-6',
        max_tokens: 1024,
        system:     genSystem,
        messages:   [{ role: 'user', content: genUser }],
      });
      genParsed = parseJson<GenResponse>(
        (msg.content[0] as { type: string; text: string }).text,
      );
    } catch (err) {
      console.log(`❌  Claude error: ${(err as Error).message}`);
      skipped.push(`${label} — generation failed: ${(err as Error).message}`);
      continue;
    }

    if (!genParsed.question_stem || !genParsed.option_a?.text || !genParsed.correct_option) {
      console.log('❌  Malformed generation response');
      skipped.push(`${label} — generation returned malformed JSON`);
      continue;
    }
    console.log(`✅  stem: "${genParsed.question_stem.slice(0, 60)}…"`);

    // ── Evaluate ───────────────────────────────────────────────────────────
    await sleep(EVAL_DELAY_MS);
    process.stdout.write(`  Evaluating… `);

    const evalUser =
      `Standard: ${spec.standardCode} — ${std.title}\n\n` +
      `PASSAGE (first 600 chars):\n${passageText.slice(0, 600)}\n\n` +
      `QUESTION:\n${genParsed.question_stem}\n\n` +
      `A. ${genParsed.option_a.text} [${genParsed.option_a.classification}]\n` +
      `B. ${genParsed.option_b.text} [${genParsed.option_b.classification}]\n` +
      `C. ${genParsed.option_c.text} [${genParsed.option_c.classification}]\n` +
      `D. ${genParsed.option_d.text} [${genParsed.option_d.classification}]\n\n` +
      `CORRECT: ${genParsed.correct_option}\nRATIONALE:\n${genParsed.rationale}`;

    let evalResult: EvalResult;
    try {
      const msg = await anthropic.messages.create({
        model:      'claude-sonnet-4-6',
        max_tokens: 300,
        system:     EVAL_SYSTEM,
        messages:   [{ role: 'user', content: evalUser }],
      });
      evalResult = parseJson<EvalResult>(
        (msg.content[0] as { type: string; text: string }).text,
      );
    } catch (err) {
      console.log(`❌  Eval error: ${(err as Error).message}`);
      skipped.push(`${label} — evaluation failed: ${(err as Error).message}`);
      // Still insert — just mark unapproved
      evalResult = { score: 0, approve: false, reason: 'eval failed', issues: [] };
    }

    const score    = evalResult.score ?? 0;
    const isApproved = score >= 7;
    const isFlagged  = score < 5 && score > 0;

    console.log(
      `score=${score} → ${isApproved ? '✅ APPROVED' : isFlagged ? '🚩 FLAGGED' : '⚠ MANUAL'}`
    );
    if (evalResult.reason) console.log(`    ${evalResult.reason}`);

    // ── Insert into questions table ────────────────────────────────────────
    const { error: insertErr } = await supabase.from('questions').insert({
      standard_id:              std.id,
      content:                  passageText + buildQuestionBlock(genParsed),
      title:                    spec.title,
      author:                   spec.author,
      pub_year:                 spec.year,
      cognitive_skill_targeted: genParsed.cognitive_skill_targeted,
      difficulty_level:         spec.difficulty,
      approved:                 isApproved,
      flagged:                  isFlagged,
      option_a_text:            genParsed.option_a.text,
      option_b_text:            genParsed.option_b.text,
      option_c_text:            genParsed.option_c.text,
      option_d_text:            genParsed.option_d.text,
      option_a_class:           genParsed.option_a.classification,
      option_b_class:           genParsed.option_b.classification,
      option_c_class:           genParsed.option_c.classification,
      option_d_class:           genParsed.option_d.classification,
      correct_option:           genParsed.correct_option,
      rationale:                genParsed.rationale,
    });

    if (insertErr) {
      console.log(`  ❌  DB insert error: ${insertErr.message}`);
      skipped.push(`${label} — DB insert failed: ${insertErr.message}`);
      continue;
    }

    inserted++;
    if (isApproved) approved++;
    console.log(`  ✅  Inserted (approved=${isApproved})`);
  }

  // ── Final report ─────────────────────────────────────────────────────────

  console.log('\n' + '═'.repeat(70));
  console.log('FINAL REPORT');
  console.log('═'.repeat(70));

  // Count by standard
  for (const [code, std] of Object.entries(STD) as [StandardCode, typeof STD[StandardCode]][]) {
    const { data: rows } = await supabase
      .from('questions')
      .select('id, approved, difficulty_level')
      .eq('standard_id', std.id)
      .gt('difficulty_level', 0);

    const total    = rows?.length ?? 0;
    const appCount = (rows ?? []).filter((r: { approved: boolean }) => r.approved).length;
    console.log(`  ${code}  library passages: ${total} total, ${appCount} approved`);
  }

  console.log(`\n  This run: ${inserted} passages inserted, ${approved} auto-approved`);

  if (skipped.length > 0) {
    console.log(`\n  Skipped (${skipped.length}):`);
    for (const s of skipped) console.log(`    ⚠  ${s}`);
  } else {
    console.log('\n  No passages skipped.');
  }

  console.log('\n' + '═'.repeat(70) + '\n');
}

main().catch((err) => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
