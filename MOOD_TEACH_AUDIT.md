# THOROUGH AUDIT REPORT: GOGI TEACH PAGE SPECIFICATION
Date: 2026-04-20
Scope: Read-only — no files modified

---

## 1. DESIGN TOKENS

**File:** `src/lib/constants/design.ts`

### Color Tokens (C object)

**Brand Core:**
- `C.navy`: `#1F4E79` — primary brand dark blue
- `C.blue`: `#2E75B6` — bright action blue
- `C.blueLight`: `#E6F1FB` — pale blue background
- `C.blueMid`: `#B5D4F4` — medium blue ring/border

**Status Colors:**
- `C.green`: `#3B6D11` — mastery/success
- `C.greenLight`: `#C6EFCE` — pale green background
- `C.greenBorder`: `#9FE1CB` — teal-green border
- `C.amber`: `#BA7517` — pre-reading/layer 1
- `C.amberLight`: `#FAEEDA` — pale amber background
- `C.red`: `#A32D2D` — error/incorrect
- `C.redLight`: `#FCEBEB` — pale red background

**Neutrals:**
- `C.gray`: `#888780` — muted text
- `C.dark`: `#2C2C2A` — dark text, almost black
- `C.light`: `#F2F2F2` — light gray background
- `C.border`: `#CCCCCC` — standard border
- `C.white`: `#FFFFFF`
- `C.yellow`: `#FFF3A3` — highlight

**Dark Overlays (bridge + mastery screens):**
- `C.darkCard`: `rgba(255,255,255,0.08)`
- `C.darkBorder`: `rgba(255,255,255,0.15)`
- `C.darkMuted`: `rgba(255,255,255,0.06)`

### Font Family Tokens (FONTS object)

- `FONTS.ui`: `"system-ui, -apple-system, 'Segoe UI', sans-serif"` — all UI/interface text
- `FONTS.passage`: `"Georgia, 'Times New Roman', serif"` — passage text and Gogi's "G" avatar

### Gogi State System

```typescript
type GogiState = 'neutral' | 'engaged' | 'celebrate';

const GOGI_STATES: Record<GogiState, { bg: string; ring: string }> = {
  neutral:   { bg: C.navy,  ring: C.blueMid     },
  engaged:   { bg: C.blue,  ring: C.blueMid     },
  celebrate: { bg: C.green, ring: C.greenBorder },
};
```

### Layer Configuration

- Layer 1 (PRE-READING): amber `#BA7517`
- Layer 2 (DURING READING): blue `#2E75B6`
- Layer 3 (AFTER READING): green `#3B6D11`

### Notes

No explicit spacing scale or border-radius constants. All spacing and border-radius values are hardcoded inline (typically 4–20px; `borderRadius: 6–8px` is most common). No Tailwind, no CSS variables.

---

## 2. TEACH PAGE FILE STRUCTURE

**Directory:** `src/app/standard/[standardId]/teach/`

### All Teach Subdirectories (13 total)

- `evidence/` — Evidence Mapping (Layer 3)
- `figurative/` — Figurative Language (Layer 2)
- `inferencing/` — Inferencing (3-branch: literal/schema/wm)
- `mood/` — Mood Identification (Layer 3)
- `tone/` — Tone Identification (Layer 3)
- `morphology/` — Word Structure (Layer 2)
- `schema/` — Schema Building (Layer 1, 3-prompt card system)
- `strategy/` — Reading Strategy (Layer 1, 4-step sequential cards)
- `structure-purpose/` — Text Structure & Purpose (Layer 3)
- `synthesis/` — Synthesis Scaffold (Layer 3)
- `theme-builder/` — Theme Building (Layer 3)
- `vocabulary/` — Vocabulary Support (Layer 2, quadrant grid)
- `reclassify/` — Bridge showing reclassification message

### mood/page.tsx

**Imports:**
```typescript
'use client';
import { useEffect, useState, useRef, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { createClient } from '@/lib/supabase/client';
import { C, FONTS } from '@/lib/constants/design';
import { useTriggerQuestion } from '@/hooks/useTriggerQuestion';
import {
  TeachNav, PassagePanel, MCVerification, MCOption,
  ChipBank, ChipItem, findHighlightRanges, minWords,
  GogiAvatar, GogiBubble, TEACH_3COL_CSS,
} from '@/components/teach/TeachShared';
```

**3-column layout:**
1. PassagePanel (30%) — literary passage with word highlighting
2. Gogi Coaching (35%) — avatar + coaching bubbles + CTA button
3. Intervention Card (35%) — multi-step interaction

**State:**
- `studentId`, `standardUuid`, `sessionId` — session context from Supabase
- `loadTimeout` — 5-second hard timeout to show content if passage loads slowly
- `selectedMood` — chip selection
- `b1`, `b2` (evidence words), `b3` (reasoning) — cloze frame inputs
- `step1Clicked`, `step2Done`, `mcPassed` — progressive unlock flags
- `submitting` — prevents double-submit

**3-step progression:**
1. MOOD vs CHARACTER EMOTION — concept clarification 2-column comparison card, unlocks on button click
2. IDENTIFY & EVIDENCE — chip selection + cloze inputs, unlocks MC after validation
3. VERIFY YOUR UNDERSTANDING — MCVerification gate (1 correct of 4)

**Data fetch:**
```typescript
const { data: triggerQ, loading: passageLoading } = useTriggerQuestion(
  studentId || null,
  standardCode,
  'mood_misreading'
);
```

**Completion handler:**
```typescript
async function handleCTA() {
  if (!mcPassed || submitting) return;
  setSubmitting(true);
  try {
    if (sessionId && studentId && standardUuid) {
      await fetch('/api/responses/create', {
        method: 'POST',
        body: JSON.stringify({
          session_id: sessionId,
          student_id: studentId,
          standard_id: standardUuid,
          cognitive_skill_targeted: 'mood_identification',
          intervention_type: 'mood_chip_evidence',
          student_response: `Mood: ${selectedMood} | Words: ${b1}, ${b2} | Reason: ${b3}`,
          mastery_achieved: false,
        }),
      });
    }
  } catch (err) { console.error('[TeachMood] response write error:', err); }
  router.push(`/standard/${standardId}/practice`);
}
```

### tone/page.tsx (comparison)

Identical 3-column layout and component reuse. Intentional differences:

- Classification: `'tone_misreading'`
- Cognitive skill: `'tone_identification'`
- Intervention type: `'tone_distinction'`
- Step 1 shows a **3-way** distinction table (Tone vs Mood vs Character Emotion) instead of 2-way
- ChipBank uses `showDefinitions={true}` with 2 columns; mood hides definitions
- MC asks about AUTHOR's tone (not reader's mood)
- Evidence textarea minimum: 8 words (mood uses 6)

---

## 3. SHARED TEACH COMPONENTS

**File:** `src/components/teach/TeachShared.tsx` (541 lines)

### TeachNav

```typescript
Props: { standardCode: string; navLabel: string; layerColor: string }
```
52px top navigation bar, C.navy background. Shows standard title + layer label + back buttons. Inline styles only.

### MCVerification

```typescript
Props: {
  question: string;
  options: MCOption[];      // { text: string; wrongFeedback: string }[]
  correctIndex: number;
  onCorrect: () => void;
  accentColor?: string;
}
```
Labeled A/B/C/D buttons. Shows wrong feedback inline. After 2 wrong attempts, reveals correct answer AND calls `onCorrect()` (unlocks progression regardless of correctness). Color states: green/red borders and backgrounds.

### ChipBank

```typescript
Props: {
  chips: ChipItem[];        // { label: string; definition?: string }[]
  selected: string;
  onSelect: (label: string) => void;
  showDefinitions: boolean;
  selectedBg?: string;      // default C.navy
  columns?: 1 | 2;
}
```
Toggle selection. Pills (`borderRadius: 20px`) without definitions; cards (`borderRadius: 8px`) with. White unselected, `selectedBg` when selected.

### PassagePanel

```typescript
Props: {
  passageTitle: string;
  passageAuthor: string;
  passageText: string;
  ranges: [number, number][];
  markStyle: CSSProperties;
  onJump: () => void;
  panelRef: RefObject<HTMLDivElement>;
  loading: boolean;
  loadTimeout: boolean;
}
```
30% flex width. Renders passage with `<mark>` elements at highlight ranges. "JUMP TO HIGHLIGHT" blue pill button. Georgia font for text.

### GogiAvatar / GogiBubble

Re-exported from `@/components/gogi/`. `GogiAvatar` renders the animated "G" circle in the three Gogi states. `GogiBubble` renders the speech bubble containing Gogi's copy.

### Utility Functions

**`findHighlightRanges(text, strategy)`** — strategies: `'figurative' | 'mood' | 'tone' | 'theme' | 'structure'`. Returns sorted merged `[number, number][]` ranges. Mood strategy matches MOOD_WORDS array; tone strategy matches TONE_WORDS.

**`renderHighlighted(text, ranges, markStyle)`** — renders text with `<mark>` elements at specified ranges.

**`minWords(text, n)`** — returns true if text has ≥ n words.

**`detectFigureType(text)`** — returns `'SIMILE' | 'SYMBOL' | 'PERSONIFICATION' | 'METAPHOR'`.

### TEACH_3COL_CSS

```typescript
TEACH_3COL_CSS(borderColor: string): string
```
CSS template string. Desktop: flex row with three columns. `@768px`: switches to column layout with fixed heights. Used as:
```typescript
<style>{TEACH_3COL_CSS(C.border)}</style>
```

---

## 4. DATA FETCH HOOKS

**File:** `src/hooks/useTriggerQuestion.ts`

```typescript
export function useTriggerQuestion(
  studentId: string | null,
  standardCode: string,
  classification: string
): { data: TriggerQuestion | null; loading: boolean }

export interface TriggerQuestion {
  questionId: string;
  passageText: string;
  passageTitle: string;
  passageAuthor: string;
  keywordFlags: string[];
  blockingWord: string;    // first keyword_flag
  passageContext: string;  // sentence containing blockingWord
}
```

**Queries made:**
1. Resolve standard UUID by code
2. Find most recent response where `diagnostic_classification = classification` for this student/standard — returns `question_id`
3. Fallback: most recent diagnostic session's `diagnostic_question_ids[0]`
4. Fetch `questions` row by that ID — extracts passage from content string before `QUESTION:` marker

Hook only fires when `studentId` is non-null.

---

## 5. GOGI VOICE / COPY PATTERNS

Direct quotes from GogiBubble components across teach pages:

**mood/page.tsx:**
> "Mood is not what the character feels. Mood is what **YOU** feel as a reader. The author controls that feeling through very specific word choices."

> "You now have the tools to identify mood in any passage. Ask: how does this text make ME feel — and why?"

**tone/page.tsx:**
> "Tone is the author's **attitude** — not the character's emotion, not the reader's feeling. Ask: what does the *AUTHOR* think about what they're describing?"

> "Every author has a stance. Tone is how that stance leaks through their word choices. You can hear it now."

**schema/page.tsx:**
> "The passage didn't connect because your brain didn't have a mental model for it yet. These 3 prompts will build one. Do the work — don't rush."

> "Don't just answer to get through it. The quality of what you write here determines how well the passage makes sense when you practice."

**strategy/page.tsx:**
> "You don't have a system for attacking a text yet. I'll give you one. It takes 60 seconds."

**figurative/page.tsx (MC wrong feedback):**
> "That's a literal reading — the figure isn't describing reality. It's creating meaning beyond the literal. What emotional or intellectual effect does it have?"

> "That's the character's experience, not the author's technique. Why did the AUTHOR choose this specific comparison? What does it do for the reader?"

**inferencing/page.tsx:**
> "Sometimes the author tells you something flat-out. Sometimes they don't — they leave clues and make you figure it out... You use what the text *says* to decide what it *means*."

**Key voice patterns:**
- Direct second-person address: "YOU", "your brain", "you now have"
- Three-part structures: what it IS, what it ISN'T, why it MATTERS
- Metacognitive framing: "Ask yourself...", "Your brain fills the gap..."
- Clinical precision with conversational warmth
- Bold/italic on key distinctions (character ≠ reader ≠ author)
- Short declarative sentences followed by a payoff line

---

## 6. CLASSIFICATION ROUTER AND PROTOCOL ENGINE

### ClassificationRouter.ts

**File:** `src/app/student-teach/[standardId]/protocol/ClassificationRouter.ts`

Maps `diagnostic_classification` codes to named clinical protocols (25 ProtocolName values). Has three routing maps (THEME, INFERENCING, TEXT_STRUCTURE). **Not used by simple teach pages (mood, tone, figurative, etc.).** Those pages are direct URL routes.

### ProtocolEngine.tsx

**File:** `src/app/student-teach/[standardId]/protocol/ProtocolEngine.tsx`

State machine for advanced 8-step scaffold-fade sequences. **Not used by simple teach pages.** Standalone teach pages (mood, tone, etc.) manage their own step state with plain `useState`.

### How teach pages know their classification

Each teach page **hardcodes** its classification string:
```typescript
// mood/page.tsx
const { data: triggerQ } = useTriggerQuestion(studentId, standardCode, 'mood_misreading');

// tone/page.tsx
const { data: triggerQ } = useTriggerQuestion(studentId, standardCode, 'tone_misreading');
```

Navigation to the teach page originates from `getTeachRoute(classification)` in the bridge/practice pages, which maps code → URL segment. The teach page never reads the classification from the URL — it is fixed per file.

---

## 7. LOAD-BEARING PATTERNS

### Response write on completion

All teach pages call `POST /api/responses/create` inside `handleCTA()`. Required fields: `session_id`, `student_id`, `standard_id`. `mastery_achieved` is **always `false`** on teach pages — the teach phase is formative only.

**Field conventions by page:**
| Page | cognitive_skill_targeted | intervention_type | student_response format |
|---|---|---|---|
| mood | `mood_identification` | `mood_chip_evidence` | `Mood: X \| Words: w1, w2 \| Reason: r` |
| tone | `tone_identification` | `tone_distinction` | `Tone: X \| Diction: w1, w2 \| Belief: r` |
| schema | `schema_building` | `schema_prompts` | `p1 \| p2 \| p3` |

### CTA button gating

All teach pages gate the CTA on `mcPassed && !submitting`:
```typescript
<button
  onClick={handleCTA}
  disabled={!mcPassed || submitting}
  style={{ ..., opacity: mcPassed && !submitting ? 1 : 0.4 }}
>
  I've got it — Practice →
</button>
```

### Route on completion

All teach pages route to:
```typescript
router.push(`/standard/${standardId}/practice`);
```

### teach_phase_completed column

Exists in the `sessions` table (added in `20260418_state_persistence_foundation.sql`, type `text[]`). **No teach page reads or writes it.** Its ownership is unresolved.

### Session initialization pattern (all teach pages)

```typescript
useEffect(() => {
  if (authLoading || !user) return;
  async function init() {
    // 1. Fetch student row (user_id → student.id)
    // 2. Fetch standard UUID (code → standard.id)
    // 3. Fetch most recent in-progress teach session, or insert one
    // 4. Set studentId, standardUuid, sessionId state
  }
  init();
}, [user, authLoading]);
```
`useTriggerQuestion` is called unconditionally at the component level but gated by passing `null` for `studentId` until init completes.

---

## ARCHITECTURAL INCONSISTENCIES

1. **Dual routing systems exist** — simple teach pages use direct URL + hardcoded classification; `ClassificationRouter.ts` and `ProtocolEngine.tsx` exist in a separate `student-teach/` route that appears to be a parallel (possibly older) architecture. Unclear if both are in production use.

2. **`teach_phase_completed` column is orphaned** — added by migration, never written by any teach page. Intended for resume logic that was never implemented.

3. **MCVerification always unlocks after 2 wrong attempts** — students can progress without demonstrating correct understanding. `onCorrect()` fires on both success and 2-attempt exhaustion.

4. **Classification strings hardcoded per file** — `'mood_misreading'` in mood/page.tsx, `'tone_misreading'` in tone/page.tsx, etc. No shared constant. A typo produces a phantom code that silently falls back to the wrong passage in `useTriggerQuestion`.

5. **No error state in teach page init** — if student/standard/session lookups fail, pages silently render with empty state. No error boundary or user-facing fallback.

6. **`schema_deficit` missing from BADGE_TEXT and getTeachRoute** — now fixed (2026-04-20 bridge commit), but the `schema/` teach page exists and the `/teach/schema` route is valid.

7. **`status = 'completed'` vs `status = 'complete'`** — seed scripts write `'completed'`; `classifySession.ts` writes `'complete'`; bridge page now filters for `'complete'`. Seeded test sessions must use `'complete'` to be found by the bridge.
