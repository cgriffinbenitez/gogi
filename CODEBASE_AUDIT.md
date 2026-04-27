# GOGI Codebase Audit

**Date:** 2026-04-19
**Directory:** `/Users/coachgriffin/Desktop/Gogi-RocketAI/gogi-main`
**Scope:** Read-only. No files were modified.

---

## Section 1 — App Routes

### Middleware Protection

`src/middleware.ts` protects the following path prefixes (unauthenticated → redirect to `/login`):
- `/dashboard/:path*`
- `/standard/:path*`
- `/teacher-dashboard/:path*`
- `/student-home/:path*`
- `/student-diagnostic/:path*`
- `/student-teach/:path*`
- `/student-reassess/:path*`
- `/student-practice/:path*`

### Current Canonical Routes

| File | Route | Description | Auth |
|------|-------|-------------|------|
| `src/app/login/page.tsx` | `/login` | Login screen; on success redirects student → `/dashboard/student`, teacher → `/dashboard/teacher` | No |
| `src/app/dashboard/student/page.tsx` | `/dashboard/student` | Student home — shows active standards as cards with progress status | Yes |
| `src/app/dashboard/teacher/page.tsx` | `/dashboard/teacher` | Teacher dashboard — student roster, standard progress, cognitive/schema data | Yes |
| `src/app/profile/reading/page.tsx` | `/profile/reading` | Reading profile assessment (cognitive traits, reading behaviors); writes to `cognitive_profiles` | Yes |
| `src/app/standard/[standardId]/vocab-check/page.tsx` | `/standard/[standardId]/vocab-check` | Pre-diagnostic vocab readiness check; writes to `vocab_readiness` | Yes |
| `src/app/standard/[standardId]/diagnostic/page.tsx` | `/standard/[standardId]/diagnostic` | Main diagnostic — passage + 10 MCQs, schema demand analysis, classifies dominant gap | Yes |
| `src/app/standard/[standardId]/bridge/page.tsx` | `/standard/[standardId]/bridge` | Transition screen after diagnostic; shows classification badge; routes to correct teach page | Yes |
| `src/app/standard/[standardId]/teach/strategy/page.tsx` | `/standard/[standardId]/teach/strategy` | Layer 1 intervention for `no_metacognitive_strategy` — pre-reading strategy scaffold | Yes |
| `src/app/standard/[standardId]/teach/vocabulary/page.tsx` | `/standard/[standardId]/teach/vocabulary` | Layer 2 intervention for `vocabulary_gap` — Frayer model + definition lookup | Yes |
| `src/app/standard/[standardId]/teach/morphology/page.tsx` | `/standard/[standardId]/teach/morphology` | Layer 2 intervention for `morphology_gap` / `syntax_barrier` — morpheme breakdown | Yes |
| `src/app/standard/[standardId]/teach/figurative/page.tsx` | `/standard/[standardId]/teach/figurative` | Layer 2 intervention for `figurative_language_failure` — 3-step decode | Yes |
| `src/app/standard/[standardId]/teach/mood/page.tsx` | `/standard/[standardId]/teach/mood` | Layer 3 intervention for `mood_misreading` — chip + evidence | Yes |
| `src/app/standard/[standardId]/teach/tone/page.tsx` | `/standard/[standardId]/teach/tone` | Layer 3 intervention for `tone_misreading` — tone/mood/character distinction table | Yes |
| `src/app/standard/[standardId]/teach/inferencing/page.tsx` | `/standard/[standardId]/teach/inferencing` | Layer 3 intervention for `inferencing_literal`, `inferencing_schema`, `inferencing_wm` | Yes |
| `src/app/standard/[standardId]/teach/theme-builder/page.tsx` | `/standard/[standardId]/teach/theme-builder` | Layer 3 intervention for `topic_vs_theme_confusion` — scaffolded theme statement builder | Yes |
| `src/app/standard/[standardId]/teach/evidence/page.tsx` | `/standard/[standardId]/teach/evidence` | Layer 3 intervention for `evidence_retrieval_failure` — theme-evidence mapping organizer | Yes |
| `src/app/standard/[standardId]/teach/structure-purpose/page.tsx` | `/standard/[standardId]/teach/structure-purpose` | Layer 3 intervention for `structure_purpose_disconnect` — structure chip + purpose cloze | Yes |
| `src/app/standard/[standardId]/teach/synthesis/page.tsx` | `/standard/[standardId]/teach/synthesis` | Layer 3 intervention for `comprehension_integration_failure` — 5-box literary analysis | Yes |
| `src/app/standard/[standardId]/teach/schema/page.tsx` | `/standard/[standardId]/teach/schema` | Layer 1 intervention for `schema_deficit` — 3-prompt schema activation | Yes |
| `src/app/standard/[standardId]/teach/reclassify/page.tsx` | `/standard/[standardId]/teach/reclassify` | Reclassification screen shown after 3 failed teach attempts; routes to next gap in allGaps | Yes |
| `src/app/standard/[standardId]/practice/page.tsx` | `/standard/[standardId]/practice` | Practice questions matched to classification; 4-tier fallback fetch | Yes |
| `src/app/standard/[standardId]/progress/page.tsx` | `/standard/[standardId]/progress` | Per-standard progress summary | Yes |
| `src/app/standard/[standardId]/mastery/page.tsx` | `/standard/[standardId]/mastery` | Mastery celebration; displays session stats, power statement, debug div (see Section 9) | Yes |
| `src/app/admin/questions/page.tsx` | `/admin/questions` | Question bank admin — approve, flag, view questions | Yes |

### Retired (Redirect Stubs)

| File | Route | Redirects To |
|------|-------|--------------|
| `src/app/teacher-dashboard/page.tsx` | `/teacher-dashboard` | `/dashboard/teacher` |
| `src/app/student-home/page.tsx` | `/student-home` | `/dashboard/student` |
| `src/app/sign-up-login-screen/page.tsx` | `/sign-up-login-screen` | `/login` |

### Legacy (Orphaned — Full Components, No Inbound Links)

| File | Route | Status |
|------|-------|--------|
| `src/app/student-diagnostic/page.tsx` | `/student-diagnostic` | Full component, unreachable from current flow |
| `src/app/student-teach/page.tsx` | `/student-teach` | Full component, unreachable |
| `src/app/student-teach/[standardId]/page.tsx` | `/student-teach/[standardId]` | Full component, unreachable |
| `src/app/student-practice/page.tsx` | `/student-practice` | Full component, unreachable |
| `src/app/student-practice/[standardId]/page.tsx` | `/student-practice/[standardId]` | Full component, unreachable |
| `src/app/student-reassess/page.tsx` | `/student-reassess` | Full component, unreachable |
| `src/app/student-reassess/[standardId]/page.tsx` | `/student-reassess/[standardId]` | Full component, unreachable |
| `src/app/student-mastery/[standardId]/page.tsx` | `/student-mastery/[standardId]` | Full component, unreachable |
| `src/app/teacher-dashboard/students/[studentId]/page.tsx` | `/teacher-dashboard/students/[studentId]` | Full component, unreachable from new flow |

**Note:** CLAUDE.md line 64-65 still says "student → redirected to /student-home" and "teacher → redirected to /teacher-dashboard" — both are now incorrect; the actual redirects go to `/dashboard/student` and `/dashboard/teacher`.

---

## Section 2 — Database Access

### Files Importing Supabase Client

All client-side pages import from `@/lib/supabase/client`. Server components and API routes import from `@/lib/supabase/server`. No direct imports of `@supabase/ssr` or `@supabase/supabase-js` found in page files.

### Per-File Table Access Summary

| File | Tables Read | Tables Written |
|------|-------------|----------------|
| `diagnostic/page.tsx` | `students`, `standards`, `questions`, `standard_progress`, `schema_interventions`, `schema_responses`, `sessions` | `sessions`, `standard_progress`, `responses` (via API), `schema_interventions` (via API) |
| `bridge/page.tsx` | `students`, `standards`, `sessions` | — |
| `teach/vocabulary/page.tsx` | `students`, `standards`, `sessions`, `responses`, `questions` | `responses` (via API) |
| `teach/strategy/page.tsx` | `students`, `standards`, `sessions` | `responses` (via API) |
| `teach/inferencing/page.tsx` | `students`, `standards`, `sessions` | `responses` (via API) |
| `teach/morphology/page.tsx` | `students`, `standards`, `sessions`, `standard_progress` | `responses` (via API) |
| `teach/evidence/page.tsx` | `students`, `standards`, `sessions`, `standard_progress` | `responses` (via API) |
| `teach/schema/page.tsx` | `students`, `standards`, `sessions`, `standard_progress` | `responses` (via API) |
| `teach/synthesis/page.tsx` | `students`, `standards`, `sessions`, `standard_progress` | `responses` (via API) |
| `teach/theme-builder/page.tsx` | `students`, `standards`, `sessions` | `responses` (via API) |
| `teach/figurative/page.tsx` | `students`, `standards`, `sessions` | `responses` (via API) |
| `teach/mood/page.tsx` | `students`, `standards`, `sessions` | `responses` (via API) |
| `teach/tone/page.tsx` | `students`, `standards`, `sessions` | `responses` (via API) |
| `teach/structure-purpose/page.tsx` | `students`, `standards`, `sessions` | `responses` (via API) |
| `teach/reclassify/page.tsx` | `students`, `standards`, `sessions`, `standard_progress` | `sessions` |
| `practice/page.tsx` | `students`, `standards`, `sessions`, `questions`, `responses`, `standard_progress` | `responses` (via API), `standard_progress` |
| `mastery/page.tsx` | `students`, `standards`, `sessions`, `standard_progress` | `sessions` |
| `vocab-check/page.tsx` | `students`, `standards` | `vocab_readiness` |
| `profile/reading/page.tsx` | `students` | `cognitive_profiles` |
| `dashboard/student/page.tsx` | `students`, `standards`, `sessions`, `standard_progress` | — |
| `dashboard/teacher/page.tsx` | `students`, `standards`, `sessions`, `standard_progress`, `cognitive_profiles`, `vocab_readiness` | — |
| `admin/questions/page.tsx` | `questions`, `standards` | `questions` |
| `src/app/api/responses/create/route.ts` | `sessions` | `responses` |
| `src/app/api/schema/generate/route.ts` | `schema_interventions` | `schema_interventions` |
| `src/app/api/vocab/define/route.ts` | `vocab_cache` | `vocab_cache` |
| `src/lib/classify/classifySession.ts` | `sessions`, `responses` | `sessions`, `standard_progress` |
| `src/hooks/useTriggerQuestion.ts` | `responses`, `sessions`, `questions` | — |

---

## Section 3 — The Diagnostic Flow

### Route: `/standard/[standardId]/diagnostic`
**File:** `src/app/standard/[standardId]/diagnostic/page.tsx`

### Tables Read
- `students` — resolve `student_id` from `auth.uid()`
- `standards` — resolve `standard_id` UUID from `standardCode`
- `standard_progress` — get `sessions_attempted` (for schema demand trigger)
- `questions` — fetch approved questions for this standard (`id, content, cognitive_skill_targeted, title, author, pub_year, keyword_flags` WHERE `approved = true`)
- `schema_interventions` — check if schema already generated for this session
- `schema_responses` — check if student already responded to schema

### Tables Written
- `sessions` INSERT: `student_id, standard_id, phase='diagnostic', status='in_progress'`
- `sessions` UPDATE: `diagnostic_question_id, diagnostic_question_ids` (array of question UUIDs shown)
- `responses` (via `POST /api/responses/create`): per-question responses
- `schema_interventions` (via `POST /api/schema/generate`): pre-reading schema payload
- `standard_progress` (via `classifySession.ts`): `gaps_identified, current_gap`

### Answer Scoring Logic

Each question's correct answer and per-option classifications are embedded in the `questions.content` field and parsed client-side by `parseQuestionContent()`:

```
Content format (embedded in question text):
CORRECT: B
DIAGNOSTIC_CLASSIFICATION_A: inferencing_literal
DIAGNOSTIC_CLASSIFICATION_B: (correct — no classification)
DIAGNOSTIC_CLASSIFICATION_C: vocabulary_gap
DIAGNOSTIC_CLASSIFICATION_D: inferencing_schema
```

Correctness check (diagnostic/page.tsx, response write):
```typescript
mastery_achieved: letter === q.correctLetter
```

Classification stored with each response:
```typescript
diagnostic_classification: q.classifications[letter] ?? null
```

### Classification Algorithm (`src/lib/classify/classifySession.ts`)

1. Count wrong-answer responses by `diagnostic_classification`
2. Threshold: `correctCount >= 8` (out of total questions) → `skipTeach = true`
3. Gap identification: any classification with 2+ occurrences enters `allGaps[]`
4. Sort `allGaps` by: frequency descending, then layer ascending (Layer 1 beats Layer 2/3 on tie)
5. `dominant_classification` = top of sorted list
6. `classification_confidence` = `(dominant_count / total_questions) * 100`

Write to `sessions`:
```typescript
dominant_classification,
gap_classifications: allGaps,
classification_confidence,
mastery_achieved: skipTeach,
status: 'complete',
completed_at: new Date().toISOString()
```

### Post-Diagnostic Routing

```typescript
router.push(`/standard/${standardId}/${result.skipTeach ? 'practice' : 'bridge'}`);
```

- **8+ correct:** → `/standard/[standardId]/practice` (skip teach)
- **Below 8:** → `/standard/[standardId]/bridge` (show classification, then route to teach)

**CLAUDE.md discrepancy:** CLAUDE.md says "80%+" threshold. Code uses `>= 8` correct out of however many questions load. With 10 questions that is 80%, but if question count varies the threshold percentage shifts. Not currently an issue (10 questions loaded), but hardcoded integer not percentage.

### Schema Demand Analysis (Pre-Diagnostic)

Fires before questions are shown if `sessions_attempted > 0 AND sessions_passed < sessions_attempted` (student has failed before), OR always on session 1.

- Calls `POST /api/schema/generate` → Anthropic `claude-sonnet-4-6`
- Generates schema activation card (topic_primer / context_builder / task_framing mode)
- Stored in `schema_interventions`; response stored in `schema_responses`

---

## Section 4 — The Teach/Intervention Flow

### Classification → Route Mapping (`src/lib/classify/getTeachRoute.ts`)

| Classification | Teach Route Segment | Layer |
|---|---|---|
| `no_metacognitive_strategy` | `strategy` | 1 |
| `schema_deficit` | `schema` | 1 |
| `vocabulary_gap` | `vocabulary` | 2 |
| `morphology_gap` | `morphology` | 2 |
| `syntax_barrier` | `morphology` | 2 |
| `figurative_language_failure` | `figurative` | 2 |
| `mood_misreading` | `mood` | 3 |
| `tone_misreading` | `tone` | 3 |
| `inferencing_literal` | `inferencing` | 3 |
| `inferencing_schema` | `inferencing` | 3 |
| `inferencing_wm` | `inferencing` | 3 |
| `topic_vs_theme_confusion` | `theme-builder` | 3 |
| `evidence_retrieval_failure` | `evidence` | 3 |
| `structure_purpose_disconnect` | `structure-purpose` | 3 |
| `comprehension_integration_failure` | `synthesis` | 3 |
| *(default/unknown)* | `vocabulary` | — |

### Bridge Page Routing Logic (`src/app/standard/[standardId]/bridge/page.tsx`)

1. Fetch most recent `sessions` row with `dominant_classification`
2. Display classification badge (human-readable text, e.g. "Reading strategy needed")
3. After 2-second delay, show "Show me" button
4. On click: `router.push(teachRoute(standardId, classification))`
   - `teachRoute = /standard/${standardId}/teach/${getTeachRoute(classification)}`
5. Default if no session found: `vocabulary_gap` → `/teach/vocabulary`

### Standards Coverage

All 14 teach routes are standard-agnostic — `standardCode` is passed to each page but used only to:
- Fetch the trigger question (which is standard-scoped)
- Display the standard title in the nav
- Write the correct `standard_id` to responses

All 3 pilot standards (ELA.9.R.1.1, ELA.9.R.1.2, ELA.9.R.2.1) route through the same teach pages. The intervention content adapts to the trigger question pulled for that standard.

### Trigger Question Hook (`src/hooks/useTriggerQuestion.ts`)

Each teach page calls `useTriggerQuestion(studentId, standardCode, classificationCode)`:

1. Query `responses` for a row where `diagnostic_classification = classificationCode` (most recent session)
2. If found: use that row's `question_id` as the trigger question
3. Fallback: use first entry of `sessions.diagnostic_question_ids` array
4. Fetch from `questions`: `id, content, title, author, keyword_flags`
5. Extract: `passageText`, `passageTitle`, `passageAuthor`, `blockingWord` (first keyword_flag), `passageContext` (sentence containing blocking word)

### Reclassification Flow (`src/app/standard/[standardId]/teach/reclassify/page.tsx`)

Triggered if student fails teach intervention (3 turns without mastery):
1. Read `standard_progress.gap_classifications` (allGaps array from diagnostic)
2. Pick next entry after current `dominant_classification`
3. Navigate to `/teach/reclassify?from=[old]&to=[new]&count=[turn]`
4. On continue: navigate to new teach page for secondary classification
5. **No maximum turn limit exists** — can loop through all gaps indefinitely

---

## Section 5 — Classification Logic

### Canonical Classification Codes (13 total)

Defined in `src/lib/classify/classifySession.ts`:

**Layer 1 — Pre-Reading**
- `no_metacognitive_strategy` — no reading strategy before approaching text
- `schema_deficit` — no background knowledge to anchor text

**Layer 2 — During Reading**
- `vocabulary_gap` — unknown word blocks comprehension
- `morphology_gap` — word structure failure
- `syntax_barrier` — sentence structure failure
- `figurative_language_failure` — reads figurative language literally

**Layer 3 — After Reading**
- `mood_misreading` — confuses character emotion with mood
- `tone_misreading` — confuses content with author attitude
- `inferencing_literal` — reads literally, misses implied meaning
- `inferencing_schema` — activates wrong background schema
- `inferencing_wm` — working memory failure breaks inference chain
- `topic_vs_theme_confusion` — names topic instead of articulating theme
- `evidence_retrieval_failure` — cannot locate textual evidence
- `structure_purpose_disconnect` — identifies structure but misses author purpose
- `comprehension_integration_failure` — cannot synthesize across whole text

### How Classification Is Assigned

Classifications are **not AI-generated at runtime**. They are **pre-encoded in question content** by question authors. The `questions.content` field contains embedded metadata parsed by `parseQuestionContent()`:

```
Question stem text here...

CORRECT: B
DIAGNOSTIC_CLASSIFICATION_A: inferencing_literal
DIAGNOSTIC_CLASSIFICATION_B:
DIAGNOSTIC_CLASSIFICATION_C: vocabulary_gap
DIAGNOSTIC_CLASSIFICATION_D: inferencing_schema
```

When a student selects option A, the response is written with `diagnostic_classification: 'inferencing_literal'`. Correct answers have no classification (or empty string).

### Dominant Classification Selection

`src/lib/classify/classifySession.ts` — called after all questions answered:

```typescript
// 1. Count wrong answers by classification
const counts: Record<string, number> = {};
wrongResponses.forEach(r => {
  if (r.diagnostic_classification) counts[r.diagnostic_classification] = (counts[r.diagnostic_classification] || 0) + 1;
});

// 2. Filter to gaps with 2+ occurrences
const allGaps = Object.entries(counts)
  .filter(([_, count]) => count >= 2)
  .sort(([a, ca], [b, cb]) => {
    if (cb !== ca) return cb - ca;           // higher count first
    return LAYER_ORDER[a] - LAYER_ORDER[b]; // lower layer first on tie
  })
  .map(([cls]) => cls);

// 3. Dominant = first in sorted list
const dominant = allGaps[0] ?? 'no_metacognitive_strategy';
```

### No Runtime AI Classification

There is no Anthropic API call that classifies student responses at diagnostic time. The AI is used for:
- Schema activation generation (`/api/schema/generate`)
- Vocabulary definition lookup (`/api/vocab/define`)
- Synthesis box 4 analysis grading (`/api/vocab/define` — repurposed endpoint)

**CLAUDE.md note (line 68):** "AiTutorDrawer.tsx needs to be rewired from OpenAI" — this file was not found in current source, suggesting it may have been removed or not yet built.

---

## Section 6 — Design System

### `src/lib/constants/design.ts` — Exports

#### `C` — Color Tokens
```typescript
export const C = {
  // Brand core
  navy:        '#1F4E79',
  blue:        '#2E75B6',
  blueLight:   '#E6F1FB',
  blueMid:     '#B5D4F4',
  // Status
  green:       '#3B6D11',
  greenLight:  '#C6EFCE',
  greenBorder: '#9FE1CB',
  amber:       '#BA7517',
  amberLight:  '#FAEEDA',
  red:         '#A32D2D',
  redLight:    '#FCEBEB',
  // Neutrals
  gray:        '#888780',
  dark:        '#2C2C2A',
  light:       '#F2F2F2',
  border:      '#CCCCCC',
  white:       '#FFFFFF',
  yellow:      '#FFF3A3',
  // Dark screen overlays (Bridge + Mastery)
  darkCard:    'rgba(255,255,255,0.08)',
  darkBorder:  'rgba(255,255,255,0.15)',
  darkMuted:   'rgba(255,255,255,0.06)',
}
```

#### `GOGI_STATES` — Avatar State Config
- `neutral`: navy bg, blueMid ring
- `engaged`: blue bg, blueMid ring
- `celebrate`: green bg, greenBorder ring

#### `STATUS_CONFIG` — Standard Progress Status Display
- `notStarted` / `inDiagnostic` / `inIntervention` / `mastered`
- Each has: label, bg color, border color, text color, accent color

#### `LAYER_CONFIG` — Layer Visual Config
- Layer 1: amberLight bg, amber border (pre-reading)
- Layer 2: blueLight bg, blue border (during reading)
- Layer 3: greenLight bg, green border (after reading)

#### `FONTS`
```typescript
export const FONTS = {
  ui:      "system-ui, -apple-system, 'Segoe UI', sans-serif",
  passage: "Georgia, 'Times New Roman', serif",
}
```

#### `STANDARDS` — Pilot Standard Metadata
- `ELA.9.R.1.1`, `ELA.9.R.1.2`, `ELA.9.R.2.1`
- Each has: `code`, `title`, `short`

#### `POWER_STATEMENTS` — Mastery affirmations (one per standard)

#### `FRAMING_SENTENCES` — Schema activation framing (one per standard)

### Styling Approach

**Pattern: 100% inline styles driven by `C.*` tokens. No Tailwind classes used in any student-facing or teacher-facing page.**

Sampled across: `diagnostic/page.tsx`, `bridge/page.tsx`, `teach/vocabulary/page.tsx`, `mastery/page.tsx`, `dashboard/student/page.tsx` — all use exclusively `style={{ ... }}` props with `C.navy`, `C.border`, etc.

`tailwind.config.js` exists and defines tokens (violet, amber, emerald, rose, sky scales) but these are not referenced in any scanned component. Tailwind may be active for global resets via `globals.css` but produces no utility classes in page markup.

---

## Section 7 — Supabase Schema as the Code Sees It

The following is what the TypeScript code actually expects. Columns in **bold** are used in code but absent from CLAUDE.md's defined schema.

### `students`
```
id                    uuid        PK
user_id               uuid        FK → auth.users
teacher_id            uuid        FK → users
full_name             text
grade_level           text
fast_pm1_score        numeric
fast_pm2_score        numeric
reading_profile_complete boolean
consent_on_file       boolean
consent_signed_date   date
consent_signed_by     text
assent_on_file        boolean
assent_signed_date    date
cohort_group          text        CHECK IN ('A','B') OR NULL
exit_diagnostic_complete boolean  (added by state_persistence migration)
created_at            timestamptz
```

### `sessions`
```
id                    uuid        PK
student_id            uuid        FK → students
standard_id           uuid        FK → standards
phase                 text        ('diagnostic','teach','practice','reassess','exit_diagnostic')
status                text        ('in_progress','complete')
mastery_achieved      boolean
started_at            timestamptz
completed_at          timestamptz
time_spent_seconds    int
last_active_at        timestamptz (added by state_persistence migration)
teach_phase_completed text[]      (added by state_persistence migration)
dominant_classification  text     ← CODE WRITES, NOT IN CLAUDE.md
gap_classifications   text[]      ← CODE WRITES, NOT IN CLAUDE.md
classification_confidence int     ← CODE WRITES, NOT IN CLAUDE.md
diagnostic_question_id   uuid     ← CODE WRITES, NOT IN CLAUDE.md
diagnostic_question_ids  uuid[]   ← CODE WRITES, NOT IN CLAUDE.md
```

### `questions`
```
id                    uuid        PK
standard_id           uuid        FK → standards
content               text        (embeds CORRECT: and DIAGNOSTIC_CLASSIFICATION_X: metadata)
cognitive_skill_targeted text
difficulty_level      text        (in CLAUDE.md but not accessed in current code)
title                 text        ← CODE READS, NOT IN CLAUDE.md
author                text        ← CODE READS, NOT IN CLAUDE.md
pub_year              text        ← CODE READS, NOT IN CLAUDE.md
keyword_flags         text[]      ← CODE READS, NOT IN CLAUDE.md
approved              boolean     ← CODE READS, NOT IN CLAUDE.md
created_at            timestamptz
```

### `responses`
```
id                    uuid        PK
session_id            uuid        FK → sessions
question_id           uuid        FK → questions
student_id            uuid        FK → students
standard_id           uuid        FK → standards
cognitive_skill_targeted text
diagnostic_classification text
intervention_type     text
intervention_content  text
student_response      text
mastery_achieved      boolean
attempt_number        int
ai_feedback           text        (defined in CLAUDE.md; not yet populated in code)
teacher_override      text        (defined in CLAUDE.md; not yet populated in code)
created_at            timestamptz
```

### `standards`
```
id                    uuid        PK
code                  text        ('ELA.9.R.1.1', etc.)
title                 text
description           text
cognitive_domain      text
created_at            timestamptz
```

### `standard_progress` ← NOT IN CLAUDE.md
```
student_id            uuid        FK → students
standard_id           uuid        FK → standards
sessions_attempted    int
sessions_passed       int
seen_passage_titles   text[]
gaps_identified       text[]      (all gaps from diagnostic)
current_gap           text        (dominant classification)
mastered_at           timestamptz (set by trigger trg_mark_standard_mastered)
```

### `cognitive_profiles` ← NOT IN CLAUDE.md
```
student_id            uuid        FK → students
(remaining columns not determinable from code scan — inserted as object)
```

### `vocab_readiness` ← NOT IN CLAUDE.md
```
student_id            uuid        FK → students
standard_id           uuid        FK → standards
(remaining columns not determinable from code scan)
```

### `schema_interventions` ← NOT IN CLAUDE.md
```
id                    uuid        PK
session_id            uuid        FK → sessions
student_id            uuid        FK → students
standard_id           uuid        FK → standards
question_id           uuid        FK → questions
schema_mode           text        ('topic_primer','context_builder','task_framing')
trigger_reason        text
demand_score          int
generated_payload     jsonb
model_version         text
created_at            timestamptz
```

### `schema_responses` ← NOT IN CLAUDE.md
```
schema_intervention_id uuid       FK → schema_interventions
student_id            uuid        FK → students
student_response      text
readiness_score       int
response_quality_score int
```

### `vocab_cache` ← NOT IN CLAUDE.md
```
(columns not determinable from code scan — used for API result caching)
```

### `users` (Supabase `auth.users` + public profile)
```
id                    uuid        PK
email                 text
full_name             text
school                text
district              text
role                  text        ('student','teacher')
created_at            timestamptz
```

---

## Section 8 — Current CLAUDE.md Contents (Verbatim)

```markdown
# GOGI — AI-Powered ELA Literacy Platform

## What is GOGI
GOGI is a Florida B.E.S.T. standards-aligned ELA literacy platform for Title 1 students. It uses a 4-step personalized learning loop (Diagnose → Teach → Practice → Reassess) to improve student reading comprehension and give teachers real-time visibility into student progress — standard by standard.

## The Problem We're Solving
Title 1 ELA teachers have no single system that:
- Establishes a baseline per student (not whole-class)
- Builds a personalized learning path from that baseline
- Tracks whether the work is actually moving the needle
- Frees the teacher from whole-group remediation
- Documents differentiated instruction (DI) automatically
- Ingests external assessment data (PM1, PM2) and recalibrates

## Pilot Plan
- 10 students total: 5 on GOGI (treatment), 5 traditional intervention (control)
- 3 Florida BEST ELA standards targeted
- 6-8 weeks, Fall 2026-27 school year
- Success = demonstrable growth comparison between both groups

## Tech Stack
- Frontend: Next.js 15, React 19, TypeScript, Tailwind CSS
- Backend: Supabase (auth, database, real-time)
- AI: Anthropic Claude API (NOT OpenAI)
- Repo: https://github.com/cgriffinbenitez/gogi

## DATABASE SCHEMA
This is the single source of truth for all database tables and columns. Never reference a column not listed here. If a feature requires a new column, flag it before writing any code.

**users**
- id, email, full_name, school, district, role, created_at

**students**
- id, teacher_id, full_name, grade_level, fast_pm1_score, fast_pm2_score, created_at, user_id
- reading_profile_complete (boolean, default false)
- consent_on_file (boolean NOT NULL, default false), consent_signed_date (date), consent_signed_by (text)
- assent_on_file (boolean NOT NULL, default false), assent_signed_date (date)
- cohort_group (text, CHECK IN ('A','B') OR NULL) — pilot cohort assignment

**standards**
- id, code, title, description, cognitive_domain, created_at

**sessions**
- id, student_id, standard_id, phase, status, mastery_achieved, started_at, completed_at, time_spent_seconds

**questions**
- id, standard_id, content, cognitive_skill_targeted, difficulty_level, created_at

**responses**
- id, session_id, question_id, student_id, standard_id, cognitive_skill_targeted, diagnostic_classification, intervention_type, intervention_content, student_response, mastery_achieved, attempt_number, ai_feedback, teacher_override, created_at

## Target Florida BEST Standards (Pilot)
- ELA.9.R.1.1 — Inferencing and textual evidence
- ELA.9.R.1.2 — Universal themes in literary texts
- ELA.9.R.2.1 — Analyzing text structure and purpose

## Learning Loop Logic
- Diagnostic score 80%+ → skip to Reassess
- Diagnostic score below 80% → Teach → Practice → Reassess
- Reassess score 80%+ → mastery achieved
- sessions.phase values: diagnostic, teach, practice, reassess

## User Roles
- student → redirected to /student-home on login
- teacher → redirected to /teacher-dashboard on login

## Key Product Decisions
- AI Tutor uses Anthropic Claude API (AiTutorDrawer.tsx needs to be rewired from OpenAI)
- All data currently hardcoded — everything needs to connect to Supabase
- Student data privacy is critical — FERPA and COPPA compliant design required
- Row Level Security (RLS) must be enabled — students see only their own data

## Development Process
- Kanban board: GitHub Projects (github.com/cgriffinbenitez/gogi)
- No feature gets built without a user story and acceptance criteria
- Every card goes through: Backlog → Ready → In Progress → In Review → Done
- Current card in progress: #3 Database schema set up in Supabase

## What Good Looks Like
- Clean, accessible UI appropriate for 9th grade reading level
- Mobile friendly — students may access on phones
- Fast load times — Title 1 schools may have limited bandwidth
- Every interaction that matters is saved to Supabase
- Teacher dashboard shows real data, not mocked data
```

---

## Section 9 — Gaps and Inconsistencies

### CRITICAL — Schema Mismatches That Will Cause Runtime Failures

#### 1. `sessions` table is missing 5 columns the code writes

`src/lib/classify/classifySession.ts` writes these columns after every diagnostic:
```typescript
dominant_classification    text
gap_classifications        text[]
classification_confidence  int
diagnostic_question_id     uuid
diagnostic_question_ids    uuid[]
```
None of these appear in CLAUDE.md's `sessions` definition. If these columns don't exist in Supabase, **every diagnostic completion fails silently** — the session never gets marked complete, the bridge page has no classification to read, and the student cannot proceed to teach.

**Required migration:**
```sql
ALTER TABLE sessions
  ADD COLUMN IF NOT EXISTS dominant_classification text,
  ADD COLUMN IF NOT EXISTS gap_classifications text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS classification_confidence int,
  ADD COLUMN IF NOT EXISTS diagnostic_question_id uuid,
  ADD COLUMN IF NOT EXISTS diagnostic_question_ids uuid[] DEFAULT '{}';
```

#### 2. `questions` table is missing 5 columns the code reads

The diagnostic page selects `title, author, pub_year, keyword_flags, approved` from `questions`. These render passage attribution and gate question display. If absent, questions load but passage metadata is null/undefined, and `approved` filter returns nothing (no questions).

**Required migration:**
```sql
ALTER TABLE questions
  ADD COLUMN IF NOT EXISTS title text,
  ADD COLUMN IF NOT EXISTS author text,
  ADD COLUMN IF NOT EXISTS pub_year text,
  ADD COLUMN IF NOT EXISTS keyword_flags text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS approved boolean DEFAULT false;
```

#### 3. Eight tables used by code are not documented in CLAUDE.md

These tables must exist in Supabase or the features that use them fail entirely:

| Table | Used By | Impact if Missing |
|---|---|---|
| `standard_progress` | 20+ locations | No progress tracking, mastery gate broken |
| `schema_interventions` | `diagnostic/page.tsx`, `/api/schema/generate` | Schema activation broken |
| `schema_responses` | `diagnostic/page.tsx` | Schema resumption broken |
| `vocab_readiness` | `vocab-check/page.tsx`, teacher dashboard | Vocab check broken |
| `cognitive_profiles` | `profile/reading/page.tsx`, teacher dashboard | Reading profile broken |
| `vocab_cache` | `/api/vocab/define` | Definition lookup fails without cache, falls back to API every time |

### HIGH — Logic Discrepancies

#### 4. CLAUDE.md mastery threshold (80%) does not match code threshold (>= 8 correct)

CLAUDE.md line 58: "Diagnostic score 80%+ → skip to Reassess"  
Code: `correctCount >= 8` (integer, not percentage)

With 10 questions these are equivalent. But if question count ever varies (e.g. 8 questions loaded), the threshold would be 100% correct — functionally unachievable. The code should use `correctCount / total >= 0.8`.

#### 5. CLAUDE.md login redirects are stale

CLAUDE.md lines 64-65:
```
student → redirected to /student-home on login
teacher → redirected to /teacher-dashboard on login
```

Actual code in `login/page.tsx`:
```
student → /dashboard/student
teacher → /dashboard/teacher
```

`/student-home` and `/teacher-dashboard` are now redirect stubs. The CLAUDE.md instructions will mislead any developer following them.

#### 6. Mastery debug div visible to students

`src/app/standard/[standardId]/mastery/page.tsx` lines 248-262 render:
```
sessions.mastery_achieved = true  |  maintenance queue scheduled  |  badge unlocked on dashboard
```
This is raw database/system text visible to every student who reaches the mastery screen. Cognitive sovereignty violation.

#### 7. Vocab-check completion screen exposes numeric score

`src/app/standard/[standardId]/vocab-check/page.tsx` lines 593-633 render:
- A large `{coverageScore}%` number
- A visual progress bar
- A threshold marker at 98%
- Contextual message based on score ranges (≥95%, ≥80%, <80%)

This exposes a numeric score and classification thresholds to students. Same cognitive sovereignty issue as the classification blocks.

#### 8. Diagnostic passage hidden on mobile

`src/app/standard/[standardId]/diagnostic/page.tsx` CSS (lines 579-584):
```css
@media (max-width: 768px) {
  .questioning-columns > div:first-child { display: none !important; }
}
```
The passage panel is completely hidden on mobile. Students using phones (Title 1 context — likely common) answer diagnostic questions without being able to see the passage. This invalidates diagnostic data for mobile users.

### MEDIUM — Dead Code and Unnecessary Console Output

#### 9. `console.log` statements in production paths

Found in (partial list):
- `diagnostic/page.tsx`: 11+ `console.log`/`console.error` statements logging `authLoading`, `user.id`, `triggerQ`, session data
- `teach/evidence/page.tsx` lines 157-161: logs auth state and triggerQ
- `teach/schema/page.tsx` lines 228-232: same pattern
- `teach/morphology/page.tsx` lines 237-241: same pattern
- `teach/synthesis/page.tsx` lines 251-255: same pattern
- `classifySession.ts`: logs classification computation steps
- `useTriggerQuestion.ts`: logs trigger question resolution

These log student IDs, session data, and diagnostic responses to the browser console. FERPA concern: student PII in console output accessible to anyone with DevTools open.

#### 10. Legacy routes are orphaned, not deleted

8 legacy page files under `student-diagnostic/`, `student-teach/`, `student-practice/`, `student-reassess/`, `student-mastery/` are full component implementations that cannot be reached from any current navigation flow. They are protected by middleware but add dead weight and confusion. They should either be deleted or converted to redirect stubs (like `/teacher-dashboard`, `/student-home`, `/sign-up-login-screen`).

#### 11. `lastSelectedOption` state variable is dead code

`src/app/standard/[standardId]/teach/vocabulary/page.tsx` line 79:
```typescript
const [lastSelectedOption, setLastSelectedOption] = useState<string | null>(null);
```
`setLastSelectedOption` is called (line 168) but the value is never read after the classification panel was deleted earlier today. Dead state variable.

#### 12. No reclassification turn limit

`src/app/standard/[standardId]/teach/reclassify/page.tsx` has no maximum iteration check. A student could loop through all gaps (potentially 5-6 rounds) without ever achieving mastery. There is no "escalate to teacher" path from reclassification.

### LOW — Missing Features Referenced in CLAUDE.md

#### 13. `AiTutorDrawer.tsx` not found

CLAUDE.md line 68: "AiTutorDrawer.tsx needs to be rewired from OpenAI"
No file matching `AiTutorDrawer` found anywhere in `src/`. Either deleted or never built.

#### 14. `responses.ai_feedback` and `responses.teacher_override` never populated

Both columns exist in the schema (CLAUDE.md) and are defined in the `responses` table. No code path writes to them. They appear to be reserved for future features.

#### 15. Mastery threshold on reassess undefined

CLAUDE.md says "Reassess score 80%+ → mastery achieved." No reassess route exists under `/standard/[standardId]/`. The mastery screen (`/standard/[standardId]/mastery`) is navigated to from practice, but no reassess-specific scoring or threshold logic was found.

#### 16. No exit diagnostic implementation

`students.exit_diagnostic_complete` column and trigger exist (from `state_persistence_foundation.sql` migration), but no `/standard/[standardId]/exit-diagnostic/` route or page exists.

---

## Summary Table

| # | Finding | Severity |
|---|---------|----------|
| 1 | `sessions` missing 5 columns — diagnostic completion fails | **CRITICAL** |
| 2 | `questions` missing 5 columns — questions may not load | **CRITICAL** |
| 3 | 6 tables undocumented in CLAUDE.md but required for operation | **CRITICAL** |
| 4 | Mastery threshold: CLAUDE.md says 80%, code uses integer `>= 8` | **HIGH** |
| 5 | CLAUDE.md login redirects are stale (point to retired routes) | **HIGH** |
| 6 | Mastery debug div renders raw DB text to students | **HIGH** |
| 7 | Vocab-check exposes numeric score + threshold to students | **HIGH** |
| 8 | Diagnostic passage hidden on mobile via `display:none` | **HIGH** |
| 9 | `console.log` logs student IDs and session data (FERPA concern) | **MEDIUM** |
| 10 | 8 legacy routes are orphaned full components, not stubs | **MEDIUM** |
| 11 | `lastSelectedOption` is dead state (never read after deletion) | **LOW** |
| 12 | No reclassification turn limit; no teacher escalation path | **MEDIUM** |
| 13 | `AiTutorDrawer.tsx` referenced in CLAUDE.md but not found | **LOW** |
| 14 | `responses.ai_feedback` / `teacher_override` never written | **LOW** |
| 15 | Reassess phase has no implementation | **LOW** |
| 16 | Exit diagnostic has no implementation | **LOW** |
