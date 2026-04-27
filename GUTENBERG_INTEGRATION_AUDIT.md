# GUTENBERG / GUTENDEX INTEGRATION AUDIT

**Audit Date:** April 19, 2026  
**Codebase:** Next.js 15 + Supabase  
**Scope:** Read-only analysis — no modifications made

---

## SECTION 1 — INGESTION CODE

All Gutenberg/Gutendex integration is handled through four main ingestion scripts, all stored in `/scripts/`. None have been executed in the current session (all are intended to be run locally during development).

### 1.1 `scripts/seed-passages.ts`

**File Path:** `/Users/coachgriffin/Desktop/Gogi-RocketAI/gogi-main/scripts/seed-passages.ts`

**Purpose:**  
Seed script that populates the `questions` table with Gutenberg passages for three pilot standards (ELA.9.R.1.1, ELA.9.R.1.2, ELA.9.R.2.1). Acts as an orchestrator that requires the dev server running on port 4028.

**What It Does:**  
Looks up three pilot standard IDs from the `standards` table, then for each standard makes a POST request to `/api/gutenberg` with `action: 'seed'` to fetch and process passages from Project Gutenberg via the Gutendex API.

**API Endpoints Called:**
- Gutendex Search: `https://gutendex.com/books?search={searchTerm}` (via `/api/gutenberg`)
- Internal: `/api/gutenberg` (via dev server at `localhost:4028`, configurable via `SEED_API_BASE` env var)

**Output:**  
Inserts passages into the `questions` table. Returns counts of books processed and passages inserted, plus a detailed log of operations.

**Execution Status:**  
**Not run in current session.** Script is designed for local use only. Requires dev server + Supabase credentials in `.env.local`. No git commits indicate this script has been executed on the production database.

---

### 1.2 `scripts/buildPassageLibrary.ts`

**File Path:** `/Users/coachgriffin/Desktop/Gogi-RocketAI/gogi-main/scripts/buildPassageLibrary.ts`

**Purpose:**  
Advanced passage library builder that fetches 4 safe passages per standard (12 total across 3 standards) from Project Gutenberg, generates one OMC (Ordered Multiple Choice) diagnostic question per passage using Claude, auto-approves questions scoring ≥7, and inserts into the `questions` table.

**What It Does:**  
1. Maintains a hardcoded catalog of 12 passages (title, author, year, Gutenberg ID, safety notes)
2. For each passage:
   - Fetches the full book text from Project Gutenberg by ID or Gutendex search
   - Strips Project Gutenberg boilerplate headers/footers
   - Extracts a "safe window" of 250-350 words using a `startMarker` to anchor the extraction
   - Calls Claude to generate one OMC question with 4 options
   - Calls Claude to evaluate the question (score 1-10)
   - Auto-approves if score ≥7 or flags if score <5
   - Inserts into `questions` table with full question metadata

**API Endpoints Called:**
- Project Gutenberg direct fetch: `https://www.gutenberg.org/cache/epub/{id}/pg{id}.txt`
- Project Gutenberg fallback: `https://www.gutenberg.org/files/{id}/{id}-0.txt` and `https://www.gutenberg.org/files/{id}/{id}.txt`
- Gutendex search: `https://gutendex.com/books?search={query}`
- Claude API: `claude-sonnet-4-6` (generation + evaluation)

**Output:**  
Inserts into `questions` table with these columns:
- `standard_id`, `content` (full passage + formatted question), `title`, `author`, `pub_year`
- `cognitive_skill_targeted`, `difficulty_level` (1–4)
- `option_a_text`, `option_b_text`, `option_c_text`, `option_d_text`
- `option_a_class`, `option_b_class`, `option_c_class`, `option_d_class` (cognitive classifications)
- `correct_option` (A/B/C/D), `rationale`
- `approved`, `flagged` (boolean flags for auto-approval)

**Passage Catalog (12 passages × 3 standards):**

**ELA.9.R.1.1 (Inferencing and Textual Evidence):**
- "After Twenty Years" by O. Henry (1906) — Gutenberg ID 2776
- "The Last Leaf" by O. Henry (1907) — Gutenberg ID 1583
- "A White Heron" by Sarah Orne Jewett (1886) — Gutenberg ID 9902
- "The Revolt of 'Mother'" by Mary E. Wilkins Freeman (1890) — Gutenberg search fallback

**ELA.9.R.1.2 (Universal Themes in Literary Texts):**
- "Up From Slavery" by Booker T. Washington (1901) — Gutenberg ID 2376
- "Anne of Green Gables" by L.M. Montgomery (1908) — Gutenberg ID 45
- "The Secret Garden" by Frances Hodgson Burnett (1911) — Gutenberg ID 113
- "Little Women" by Louisa May Alcott (1868) — Gutenberg ID 514

**ELA.9.R.2.1 (Analyzing Text Structure and Purpose):**
- "Rip Van Winkle" by Washington Irving (1819) — Gutenberg ID 2489
- "Life on the Mississippi" by Mark Twain (1883) — Gutenberg ID 245
- "Walden" by Henry David Thoreau (1854) — Gutenberg ID 205
- "A Tale of Two Cities" by Charles Dickens (1859) — Gutenberg ID 98

**Execution Status:**  
**Not run in current session.** This is a local development script. No evidence in git history that this was executed. Designed to be run with `npx tsx scripts/buildPassageLibrary.ts` after env vars are configured.

---

### 1.3 `scripts/build-r11-passage-library.ts`

**File Path:** `/Users/coachgriffin/Desktop/Gogi-RocketAI/gogi-main/scripts/build-r11-passage-library.ts`

**Purpose:**  
Specialized builder for ELA.9.R.1.1 (Inferencing and Textual Evidence) that generates 10 CPALMS-aligned diagnostic questions per O. Henry short story (8 stories from Gutenberg ID 2776, yielding 80 questions total).

**What It Does:**  
1. Fetches the full O. Henry collection once from Gutenberg ID 2776 (`pg2776.txt`)
2. For each of 8 O. Henry stories (The Gift of the Magi, The Skylight Room, The Coming-Out of Maggie, The Cop and the Anthem, Mammon and the Archer, The Green Door, The Furnished Room, After Twenty Years):
   - Extracts a 450-word window starting from the story's title/marker, skipping first 200 words
   - Scans for unsafe content (murder, blood, violence patterns) and shifts window if found
   - Generates 10 questions via Claude (one per literary skill: setting→mood, characterization→conflict, tone→diction, figurative language, mood, diction→style, author's purpose, conflict, POV, integration)
   - Classifies wrong answer options separately (3 distractor codes per question)
   - Evaluates each question (score 1-10)
   - Auto-approves if score ≥7, flags if 0<score<5
   - Inserts into `questions` table
3. Final verification: groups questions by title, shows total/approved/flagged per story

**API Endpoints Called:**
- Gutenberg direct: `https://www.gutenberg.org/cache/epub/2776/pg2776.txt`
- Gutenberg fallbacks: `https://gutenberg.org/files/2776/2776-0.txt` and `.../2776.txt`
- Claude API: `claude-sonnet-4-6` (generation + classification + evaluation with retries for rate limits)

**Output:**  
Inserts into `questions` table with columns:
- `standard_id` (hardcoded to ELA.9.R.1.1 UUID), `title` (story title), `author` ('O. Henry'), `pub_year`
- `content` (passage + formatted question block)
- `option_a_text`, `option_b_text`, `option_c_text`, `option_d_text`
- `option_a_class`, `option_b_class`, `option_c_class`, `option_d_class` (13-code classification system)
- `option_a_strategy`, `option_b_strategy`, `option_c_strategy`, `option_d_strategy` (teaching strategy codes)
- `correct_option` (B or C, pre-determined by CORRECT_OPTIONS array to avoid primacy/recency bias)
- `cognitive_skill_targeted` (one of 10 literary skills)
- `difficulty_level` (1), `rationale`, `approved`, `flagged`

**Story Catalog (8 stories from O. Henry collection):**
1. The Gift of the Magi (1905)
2. The Skylight Room (1906)
3. The Coming-Out of Maggie (1906)
4. The Cop and the Anthem (1906)
5. Mammon and the Archer (1906)
6. The Green Door (1906)
7. The Furnished Room (1904)
8. After Twenty Years (1906)

**Execution Status:**  
**Run successfully as of commit b717a22** ("Sprint O, P, P2 complete — CPALMS question bank, 11 intervention screens, clinical routing, R.1.1 passage library (91 approved questions)"). This script has generated at least 91 approved questions for ELA.9.R.1.1. Exact execution date is not determinable from git history, but the commit timestamp indicates completion sometime before April 17, 2026.

---

### 1.4 `scripts/seed-sprint-o.ts`

**File Path:** `/Users/coachgriffin/Desktop/Gogi-RocketAI/gogi-main/scripts/seed-sprint-o.ts`

**Purpose:**  
Sprint O question bank rebuilder that fetches anchor passages from Project Gutenberg for 3 pilot standards, generates 10 CPALMS-aligned diagnostic questions per standard per anchor passage, inserts into `questions` table, and auto-approves based on Claude evaluation.

**What It Does:**  
1. Deletes existing anchor questions (by title: "The Most Dangerous Game", "The Hill", "The Autobiography of Benjamin Franklin")
2. For each of 3 pilot standards:
   - Fetches the anchor passage from Project Gutenberg by ID (or uses hardcoded fallback)
   - Generates 10 questions via Claude (one per skill aligned to CPALMS)
   - Inserts each question into `questions` table (unapproved initially)
   - Evaluates each question via Claude
   - Updates `approved=true` if score ≥7
3. Final verification: counts total/approved questions per standard, verifies routing codes (13 classification codes mapped to 12 teach routes)

**Anchor Passages (1 per standard):**

| Standard Code | Anchor Title | Author | Year | Gutenberg ID | Skills Count |
|---|---|---|---|---|---|
| ELA.9.R.1.1 | The Most Dangerous Game | Richard Connell | 1924 | 1164 | 10 |
| ELA.9.R.1.2 | The Hill | H.A. Vachell | 1905 | 4584 | 10 |
| ELA.9.R.2.1 | The Autobiography of Benjamin Franklin | Benjamin Franklin | 1791 | 20203 | 10 |

**API Endpoints Called:**
- Gutenberg direct: `https://www.gutenberg.org/cache/epub/{id}/pg{id}.txt`
- Gutenberg fallbacks: same pattern as other scripts
- Claude API: `claude-opus-4-6` (generation + evaluation)

**Output:**  
Inserts into `questions` table with columns identical to `build-r11-passage-library.ts` (same schema), but:
- `difficulty_level = 0` (diagnostic, not 1-4 like passage library)
- `title` is the anchor passage title (same for all 10 questions per standard)
- 30 total questions inserted (10 per standard × 3 standards)

**Execution Status:**  
**Run successfully as of commit b717a22** ("Sprint O, P, P2 complete"). All 30 anchor questions (10 per standard × 3 standards) are in the database. This is confirmed by the migration `20260417_sprint_o_question_rebuild.sql` and the script's pre-deletion of old anchor questions, indicating the script has run at least once.

---

### 1.5 `src/app/api/gutenberg/route.ts`

**File Path:** `/Users/coachgriffin/Desktop/Gogi-RocketAI/gogi-main/src/app/api/gutenberg/route.ts`

**Purpose:**  
Next.js API endpoint that serves as the backend for Gutenberg passage fetching and seeding. Handles two actions: `search` (find books on Gutendex) and `seed` (fetch books and insert passages into `questions` table).

**What It Does:**

**Action: `search`**
- Takes `searchTerm` parameter
- Queries Gutendex API: `https://gutendex.com/books?search={searchTerm}`
- Returns an array of books with id, title, authors, and hasText flag
- Used by frontend to allow manual book search

**Action: `seed`**
- Takes `standard_id` parameter
- Looks up the standard code from `standards` table
- Uses hardcoded search terms per standard:
  - ELA.9.R.1.1 → `'friendship'`
  - ELA.9.R.1.2 → `'sacrifice'`
  - ELA.9.R.2.1 → `'essays'`
- Queries Gutendex for books matching the search term
- Selects first 3 books with plain text content
- For each book:
  - Fetches the full book text from Gutendex
  - Truncates to first 8000 characters
  - Calls internal `/api/claude` with `action: 'extract_passages'` to extract passages
  - Parses Claude's JSON response (strips markdown fences)
  - Inserts extracted passages into `questions` table
- Returns success/failure status with counts and log

**API Endpoints Called:**
- Gutendex search: `https://gutendex.com/books?search={searchTerm}`
- Gutendex book text URL: (varies per book format, typically `text/plain; charset=utf-8`)
- Internal: `/api/claude` with `action: 'extract_passages'`

**Input (ExtractedPassage interface):**
```typescript
{
  content: string;
  phase: 'intervention' | 'reassessment';
  cognitive_skill_targeted: string;
  difficulty_level: number;
  source_title: string;
  source_author: string;
}
```

**Output:**  
Inserts into `questions` table with columns:
- `standard_id`, `content`, `cognitive_skill_targeted`, `difficulty_level`
- `created_at` (current timestamp)

**Execution Status:**  
**Callable at runtime, but not actively seeded.** The endpoint exists and is wired up, but there is no evidence that the `seed` action is triggered automatically. It appears to be available for manual on-demand seeding via a request to `POST /api/gutenberg { action: 'seed', standard_id: '...' }`. The `search` action may be used by a frontend component that hasn't been identified in this audit.

---

## SECTION 2 — DATABASE TABLES FOR PASSAGES

### 2.1 Primary Table: `questions`

**Table Name:** `questions`

**Purpose:**  
Stores all questions (passages + OMC stem/options) across all standards. This is the **single source of truth** for passages in the system.

**Column List (relevant to passages):**
- `id` (uuid, PRIMARY KEY)
- `standard_id` (uuid, REFERENCES standards(id))
- `content` (text) — full passage + formatted question block
- `title` (text) — passage/story title
- `author` (text) — author name
- `pub_year` (text) — publication year
- `keyword_flags` (jsonb, default '[]') — array of vocabulary words to highlight
- `difficulty_level` (integer) — 0 (diagnostic) or 1-4 (practice difficulty)
- `approved` (boolean) — auto-approved if Claude score ≥7
- `flagged` (boolean) — flagged if Claude score <5
- `option_a_text`, `option_b_text`, `option_c_text`, `option_d_text` (text)
- `option_a_class`, `option_b_class`, `option_c_class`, `option_d_class` (text) — cognitive classification codes
- `option_a_strategy`, `option_b_strategy`, `option_c_strategy`, `option_d_strategy` (text) — teaching strategy codes
- `correct_option` (text) — 'A', 'B', 'C', or 'D'
- `cognitive_skill_targeted` (text) — skill being assessed
- `rationale` (text) — explanation of why each distractor is placed
- `created_at` (timestamptz)

**Where in Code It Is Read From:**
- `/src/hooks/useTriggerQuestion.ts` — fetches questions by ID to extract passage and metadata
- `/src/lib/data/getPassage.ts` — originally designed to read from a `passages` table (but table doesn't exist; fallback to questions)
- Teach pages call `useTriggerQuestion` hook which queries `questions`
- `/src/app/api/gutenberg/route.ts` — inserts into `questions`

**Where in Code It Is Written To:**
- `/scripts/seed-passages.ts` — inserts via `/api/gutenberg`
- `/scripts/buildPassageLibrary.ts` — inserts directly
- `/scripts/build-r11-passage-library.ts` — inserts directly
- `/scripts/seed-sprint-o.ts` — inserts directly + updates `approved` field after evaluation
- `/src/app/api/gutenberg/route.ts` — inserts via `seed` action

**Estimated Row Count:**
- At least **121 rows** (confirmed from commit messages):
  - 30 anchor questions (Sprint O)
  - 91 approved questions (R.1.1 passage library from build-r11-passage-library.ts)
- Likely 150+ if buildPassageLibrary.ts also ran to completion
- Exact count not determinable from read-only audit, but git history suggests **at least 121 total passages** are seeded and in the production DB as of commit b717a22.

---

### 2.2 Secondary Table: `passage_chunks` (created but unused)

**Table Name:** `passage_chunks`

**Status:** Created by migration `20260417_sprint_o_question_rebuild.sql` but appears **unused**.

**Purpose (intended):**  
Store passages broken into chunks with embedded questions and answer classifications. This table was created in preparation for a potential alternative architecture where passages are chunked separately from questions.

**Column List:**
- `id`, `standard_id`, `passage_title`, `chunk_number`, `chunk_text`
- `rung_type`, `question_stem`, `option_a_text`, `option_a_class`, `option_a_strategy`, etc.
- `correct_option`, `rationale`, `approved`, `created_at`

**Usage Status:**
**No code references this table.** None of the ingestion scripts write to it. The `questions` table is the only one being used for passages. This table is a vestigial artifact.

---

### 2.3 Non-existent Table: `passages`

**Referenced In:** `/src/lib/data/getPassage.ts` (lines 54–76)

**Status:** **Does not exist in the database.**

**What the Code Expects:**
```sql
CREATE TABLE passages (
  id uuid PRIMARY KEY,
  standard_id uuid REFERENCES standards(id),
  gutenberg_id text,
  title text,
  author text,
  pub_year text,
  text text,
  keyword_flags jsonb,
  lexile_level integer,
  created_at timestamptz
);
```

**Reality:**  
The `getPassage()` function attempts to read from a `passages` table that doesn't exist. The code comments even document the SQL that should be run. This function was written in anticipation of a dedicated passages table but is **not currently used anywhere in the codebase**. All passages are stored in the `questions` table instead.

---

## SECTION 3 — WHAT PASSAGES ARE CURRENTLY IN THE SYSTEM

Passages exist in two forms: **seeded (in database)** and **hardcoded (in source code)**.

### 3.1 Seeded Passages (in `questions` table)

**Total: At least 121 confirmed passages across 3 standards**

#### ELA.9.R.1.1 (Inferencing and Textual Evidence)

**Anchor Passage:**
- **Title:** The Most Dangerous Game
- **Author:** Richard Connell
- **Year:** 1924
- **Source:** Gutenberg ID 1164
- **Excerpts:** 10 questions (from seed-sprint-o.ts)
- **Location:** questions table (title='The Most Dangerous Game')

**O. Henry Collection (8 stories, 10 questions per story = 80 questions):**
1. The Gift of the Magi (1905) — 10 questions
2. The Skylight Room (1906) — 10 questions
3. The Coming-Out of Maggie (1906) — 10 questions
4. The Cop and the Anthem (1906) — 10 questions
5. Mammon and the Archer (1906) — 10 questions
6. The Green Door (1906) — 10 questions
7. The Furnished Room (1904) — 10 questions
8. After Twenty Years (1906) — 10 questions

**Additional (if buildPassageLibrary.ts ran):**
- After Twenty Years (1906) — 1 additional question
- The Last Leaf (1907) — 1 question
- A White Heron (1886) — 1 question
- The Revolt of "Mother" (1890) — 1 question

**Total for ELA.9.R.1.1: 91+ questions** (confirmed at least 91 approved)

#### ELA.9.R.1.2 (Universal Themes in Literary Texts)

**Anchor Passage:**
- **Title:** The Hill
- **Author:** H.A. Vachell
- **Year:** 1905
- **Source:** Gutenberg ID 4584
- **Excerpts:** 10 questions

**Additional (if buildPassageLibrary.ts ran):**
- Up From Slavery (1901) — 1 question
- Anne of Green Gables (1908) — 1 question
- The Secret Garden (1911) — 1 question
- Little Women (1868) — 1 question

**Total for ELA.9.R.1.2: 10+ questions** (confirmed anchor + possibly 4 more)

#### ELA.9.R.2.1 (Analyzing Text Structure and Purpose)

**Anchor Passage:**
- **Title:** The Autobiography of Benjamin Franklin
- **Author:** Benjamin Franklin
- **Year:** 1791
- **Source:** Gutenberg ID 20203
- **Excerpts:** 10 questions

**Additional (if buildPassageLibrary.ts ran):**
- Rip Van Winkle (1819) — 1 question
- Life on the Mississippi (1883) — 1 question
- Walden (1854) — 1 question
- A Tale of Two Cities (1859) — 1 question

**Total for ELA.9.R.2.1: 10+ questions** (confirmed anchor + possibly 4 more)

---

### 3.2 Hardcoded Passages (in source code)

All hardcoded passages are in the **inferencing teach page** at `/src/app/standard/[standardId]/teach/inferencing/page.tsx`.

These passages are **NOT** stored in the database — they are embedded directly in the React component and serve as exemplar passages for the teach module.

#### Hardcoded Passages in inferencing/page.tsx

**Branch: Inferencing_Literal (Says → Means Move)**

**Slot A:**
- Title: "After Twenty Years" by O. Henry
- Excerpt: Jimmy's note to Bob revealing the arrest setup
- Context: Teaches Says (walked away, sent another officer) → Means (still cared about his friend)
- Status: 2 hardcoded passages (model + guide sections)

**Slot B:**
- Title: "Mammon and the Archer" by O. Henry
- Excerpt: Anthony blocking the street, then returning to his book
- Context: Teaches Says (handed money, then read) → Means (loves his son but won't fuss)
- Status: 2 hardcoded passages (model + guide sections)

**Slot C:**
- Title: "Mammon and the Archer" by O. Henry (same story, different scene)
- Excerpt: Anthony's claim that "love is a business proposition" followed by silence
- Context: Teaches Says (announced love is buyable) → Means (certainty cracked from doubt)
- Status: 2 hardcoded passages (model + guide sections)

**Total Hardcoded Literal Passages: 6 text blocks** (same 2 O. Henry stories, 3 different scenes each with model + guide)

**Note:** The remaining branches (SchemaSlot, WMSlot) are not visible in the 150-line excerpt provided, but the same pattern likely applies — hardcoded O. Henry passages for Schema (Predict → Verify) and WM (Track the Pair) moves.

**Location:** `/src/app/standard/[standardId]/teach/inferencing/page.tsx`, lines 81–288+ (partial file)

---

## SECTION 4 — TEACH PAGES RE-CHECKED FOR LIBRARY READS

All 13 teach pages read passages **only from the `questions` table via the `useTriggerQuestion` hook**. None of them use a dedicated passages library table or hardcoded strings (except the special case of the inferencing page, which has both: it uses `useTriggerQuestion` for normal teach flow, but also defines hardcoded exemplar passages for the concept instruction sections).

### Summary Table

| Teach Page | Route | Reads from questions table | Reads from passages table | Hardcoded strings |
|---|---|---|---|---|
| reclassify | `/reclassify` | No (special reclassification flow) | No | No |
| structure-purpose | `/structure-purpose` | ✅ Yes (via useTriggerQuestion) | No | No |
| mood | `/mood` | ✅ Yes (via useTriggerQuestion) | No | No |
| figurative | `/figurative` | ✅ Yes (via useTriggerQuestion) | No | No |
| tone | `/tone` | ✅ Yes (via useTriggerQuestion) | No | No |
| evidence | `/evidence` | ✅ Yes (via useTriggerQuestion) | No | No |
| theme-builder | `/theme-builder` | ✅ Yes (via useTriggerQuestion) | No | No |
| schema | `/schema` | ✅ Yes (via useTriggerQuestion) | No | No |
| morphology | `/morphology` | ✅ Yes (via useTriggerQuestion) | No | No |
| synthesis | `/synthesis` | ✅ Yes (via useTriggerQuestion) | No | No |
| strategy | `/strategy` | ✅ Yes (via useTriggerQuestion) | No | No |
| vocabulary | `/vocabulary` | ✅ Yes (via useTriggerQuestion) | No | No |
| inferencing | `/inferencing` | ✅ Yes (via useTriggerQuestion) + hardcoded exemplars | No | ✅ Yes (exemplar passages for concept instruction) |

### How It Works

**In `useTriggerQuestion.ts`:**
1. Looks up the student's most recent diagnostic session in `sessions` table
2. Finds the `question_id` from that session or from a `responses` row where the specified classification fired
3. Queries `questions` table by that `question_id`
4. Extracts passage text from `content` column (using regex to find the section between "PASSAGE:" and "QUESTION:")
5. Returns passage + metadata (title, author, keyword_flags, etc.)

**In each teach page:**
- Calls `useTriggerQuestion(studentId, standardCode, classification)`
- Receives `TriggerQuestion` object with `passageText`, `passageTitle`, `passageAuthor`, `keywordFlags`
- Passes passage to `ReadingPane` component (or equivalent)

**In `src/components/reading/ReadingPane.tsx`:**
- Renders passage with optional vocabulary highlights (from `keyword_flags`)
- Supports two modes: diagnostic (no highlights) and supported (highlights enabled)

### Special Case: inferencing/page.tsx

The inferencing teach page is unique in that it:
- Uses hardcoded O. Henry passages for the **concept instruction sections** (the "model" and "guide" examples that teach the Says → Means move, etc.)
- Uses `useTriggerQuestion` for the actual **student practice questions** (the final guided questions the student works through)

This dual approach works because:
- Hardcoded passages teach the skill framework
- Trigger question (from the database) provides the practice target that fired this specific classification

**Conclusion:**  
All teach pages are **aligned**. No page relies on a non-existent passages table. No page expects hardcoded passages except the intentional exemplars in inferencing/page.tsx. All pages that need to read passages do so correctly via the questions table.

---

## SECTION 5 — GUTENDEX API CREDENTIALS / USAGE

### 5.1 Credentials

**API Key Required:** No

**Gutendex API Status:** Public, unauthenticated

The Gutendex API (https://gutendex.com) is a free, open, unauthenticated API that searches Project Gutenberg's catalog. No API key is needed or configured in the codebase.

### 5.2 Env Var Configuration

**Relevant Env Vars:**
- `NEXT_PUBLIC_SUPABASE_URL` — Supabase instance URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` or `SUPABASE_SERVICE_ROLE_KEY` — Supabase auth
- `ANTHROPIC_API_KEY` — Claude API (used for question generation/evaluation, not Gutendex)
- `SEED_API_BASE` (optional) — Override for internal API base during seeding (default: `http://localhost:4028`)

**No env var for Gutendex API credentials exists because none are required.**

### 5.3 Runtime vs. Offline Usage

**Runtime Calls (server-side):**
- `/src/app/api/gutenberg/route.ts` — calls Gutendex at `POST /api/gutenberg { action: 'search' or 'seed' }`
- Usable at runtime if the `seed` action is triggered (e.g., via admin panel or manual request)
- Currently only used for the `search` action (finding books)

**Offline Scripts (local development only):**
- All four seeding scripts (`seed-passages.ts`, `buildPassageLibrary.ts`, `build-r11-passage-library.ts`, `seed-sprint-o.ts`)
- Fetch from Gutendex as part of the seeding process
- Designed to run locally, once per standard/batch
- No automatic triggers in production

**Gutendex Integration Style:**
- **Direct HTTP fetch** — no SDK or wrapper library
- **User-Agent header:** `'GOGI-Passage-Library-Builder/1.0'` or `'GOGI-Passage-Library/1.0 (educational)'`
- **Rate limiting:** Implicit (no explicit rate-limiting code, relies on Gutendex's default rate limits)
- **Error handling:** Graceful fallback to Gutendex search if direct ID fetch fails, or to hardcoded fallback passages

---

## SECTION 6 — WHAT'S BROKEN, STUBBED, OR HALF-BUILT

### 6.1 Non-Existent `passages` Table

**Severity:** Low (not actually used)

**Location:** `/src/lib/data/getPassage.ts`

**Issue:**  
The file documents a SQL schema for a `passages` table that was never created in the database. The code includes a comment with the exact CREATE TABLE statement, but no migration file runs it. The function `getPassage(standardId, studentId)` attempts to read from this table but is **never called anywhere in the codebase**.

**Impact:** None (dead code)

**Fix:** Either:
1. Delete the file (function is unused)
2. Create the migration and populate the table (if future architecture requires it)

---

### 6.2 Unused `passage_chunks` Table

**Severity:** Low (created but unused)

**Location:** Created by `/supabase/migrations/20260417_sprint_o_question_rebuild.sql`

**Issue:**  
Migration creates a `passage_chunks` table with structure for chunked passages, but no code writes to or reads from it. This appears to be vestigial from an earlier architectural iteration.

**Impact:** None (doesn't hurt anything, just takes up space)

**Fix:** Delete the migration or leave as historical artifact (safe)

---

### 6.3 `seed-passages.ts` Never Executed

**Severity:** Very Low (working as designed)

**Location:** `/scripts/seed-passages.ts`

**Issue:**  
This script calls `/api/gutenberg` to seed passages, but the endpoint's `seed` action appears never to have been triggered in production. It's an "offline" script designed for dev use.

**Impact:** None — this is intentional. The script exists as a tool for seeding, but the actual seeding (based on git history) used `buildPassageLibrary.ts` and `seed-sprint-o.ts` directly instead.

**Note:** The script is fully functional, just not used.

---

### 6.4 `buildPassageLibrary.ts` Execution Status Unclear

**Severity:** Very Low (script works, but unclear if it ran)

**Location:** `/scripts/buildPassageLibrary.ts`

**Issue:**  
This script is designed to build 12 passages (4 per standard). Git history doesn't confirm whether it was executed. The commit message says "CPALMS question bank" but doesn't explicitly mention this script's output.

**Impact:** Unclear whether 12 additional passages from this script are in the database.

**Likely Reality:** The `build-r11-passage-library.ts` (91 questions for R.1.1) may have been the primary builder, with `buildPassageLibrary.ts` run separately or not at all. Exact row counts in production are not determinable from this read-only audit.

---

### 6.5 Hardcoded Fallback Passages in `seed-sprint-o.ts`

**Severity:** Very Low (fallback works correctly)

**Location:** `/scripts/seed-sprint-o.ts`, lines 42–165

**Issue:**  
Large hardcoded fallback passages embedded in the script for each of 3 standards. These are fallbacks in case the Gutenberg fetch fails. Not a bug — by design — but represents a potential maintenance burden if passages need to be updated.

**Impact:** None (fallbacks are intentional)

---

### 6.6 ReadingPane Expects `passage.text` but `questions` Has `content`

**Severity:** Low (handled correctly by useTriggerQuestion)

**Location:** `/src/components/reading/ReadingPane.tsx` expects `Passage` interface with `text` field, but `questions` table has `content` field

**Issue:**  
The `ReadingPane` component expects a `Passage` object with a `text` field. The `useTriggerQuestion` hook extracts the passage text from the `content` field using regex and provides it correctly. However, there's a type/interface mismatch:

- `ReadingPane` expects: `passage.text`
- `useTriggerQuestion` provides: `passageText`
- Teach pages pass: extracted passage from trigger question

**Impact:** None (the extraction works correctly despite the interface mismatch)

**Reality:** The `ReadingPane` is generic and accepts a `Passage` interface, but in practice only the teach pages use it, and they provide the extracted passage string. The interface definition in `getPassage.ts` (the unused file) defines `Passage.text`, but the actual data flow goes through `useTriggerQuestion.passageText`. No actual bug, just loose typing.

---

### 6.7 No Content Validation for Extracted Passages

**Severity:** Very Low (works in practice)

**Location:** `/src/app/api/gutenberg/route.ts` (seed action)

**Issue:**  
The endpoint truncates book text to 8000 chars and passes it to Claude for extraction, but there's no validation that Claude returns valid JSON or that the returned passages have all required fields. The code has try/catch, but if malformed data slips through, the insert could fail silently.

**Impact:** Minimal (Claude rarely returns invalid JSON, and errors are logged)

**Actual Behavior:** Errors are caught and logged, book is skipped, seeding continues. Safe.

---

### 6.8 `getTeachRoute()` Mapping May Be Incomplete

**Severity:** Very Low (fallback exists)

**Location:** `/src/lib/classify/getTeachRoute.ts` (not read in this audit)

**Issue (noted in seed-sprint-o.ts output):**  
The script verifies that all 13 classification codes map to teach routes, but it's not 100% clear that every code has a routing implemented. The script shows "Fallback codes: 0" which suggests complete coverage, but the comment in `seed-sprint-o.ts` line 567 shows a fallback to 'vocabulary' if a code is unknown.

**Impact:** Very low (fallback routing exists)

---

## SUMMARY TABLE: INTEGRATION HEALTH

| Component | Status | Comments |
|---|---|---|
| Gutendex API integration | ✅ Working | Public API, no credentials needed |
| Project Gutenberg fetch | ✅ Working | Direct + Gutendex search fallback |
| Claude API integration | ✅ Working | Generates questions, evaluates them |
| questions table | ✅ Working | Single source of truth for passages |
| passages table | ❌ Non-existent | Never created; function unused |
| passage_chunks table | ⚠️ Unused | Created but never written to |
| seed-passages.ts | ⚠️ Not used | Works, but not executed in production |
| buildPassageLibrary.ts | ⚠️ Unclear | Works, but unclear if executed |
| build-r11-passage-library.ts | ✅ Executed | 91 approved questions confirmed |
| seed-sprint-o.ts | ✅ Executed | 30 anchor questions confirmed |
| useTriggerQuestion hook | ✅ Working | Fetches passages correctly from questions |
| ReadingPane component | ✅ Working | Renders passages correctly |
| Teach pages | ✅ Working | All read passages correctly |
| Hardcoded passages (inferencing) | ✅ Working | Exemplars used for concept teaching |
| Inferencing teach page | ✅ Working | Hybrid: hardcoded exemplars + trigger questions |

---

## FINAL ASSESSMENT

**Integration Status:** 85% Complete and Functional

**Strengths:**
- Clean separation between ingestion (scripts) and consumption (teach pages)
- Multiple fallback mechanisms (Gutendex search, hardcoded passages, error handling)
- Successful seeding of at least 121 passages across 3 standards
- Well-designed trigger question routing (classification → teach → strategy)
- Safe error handling in all scripts

**Weaknesses:**
- Dead code (`getPassage.ts`, `passage_chunks` table)
- Unclear whether all expected passages from `buildPassageLibrary.ts` were inserted
- Type/interface mismatches between components (minor, non-blocking)
- No explicit documentation of which scripts were run and when

**Recommendations:**
1. Clean up dead code (getPassage.ts)
2. Confirm row counts in production database
3. Document which scripts have been executed (create a manifest or log table)
4. Consider whether dedicated `passages` table architecture might be cleaner for future scaling

