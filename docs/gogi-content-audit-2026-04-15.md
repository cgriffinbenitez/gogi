# GOGI Student Experience Audit — April 15, 2026
## As the persona of Marcus

---

> This is a world-class product audit. Every word Marcus reads matters.  
> Read it start to finish before touching anything.

---

## Audit Scope

Sections covered:
1. Passage Quality
2. Gogi Voice Clarity
3. Protocol Logic (8-step trace, all 15 protocols)
4. Visual Hierarchy
5. Emotional Experience
6. End-to-End Flow Logic

Files audited:
- `src/app/api/claude/route.ts`
- `src/app/student-teach/[standardId]/protocol/ProtocolEngine.tsx`
- `src/app/student-teach/[standardId]/protocol/protocols/ELA9R12Protocols.ts`
- `src/app/student-teach/[standardId]/protocol/protocols/ELA9R11Protocols.ts`
- `src/app/student-teach/[standardId]/protocol/protocols/ELA9R21Protocols.ts`
- `src/app/student-teach/[standardId]/components/TeachSession.tsx`
- `src/app/student-practice/[standardId]/PracticeSession.tsx`
- `src/app/student-reassess/[standardId]/components/ReassessSession.tsx`
- `src/app/student-diagnostic/components/DiagnosticAssessment.tsx`

---

## Severity Legend

- **P0 — Blocker**: Marcus sees wrong content or the feature breaks. Fix before any student touches this.
- **P1 — Critical**: Marcus experiences something meaningfully wrong. Fix before pilot.
- **P2 — High**: Real friction in the learning experience. Fix before week 2.
- **P3 — Polish**: Minor gap in voice, clarity, or visual quality. Address in next iteration.

---

## Section 1: Passage Quality

### How Passages Enter the System

There are two passage pipelines:

**Pipeline A — Seeded (Gutenberg corpus):** Passages extracted by `extract_passages` action and stored in `questions` table. TeachSession loads one via:
```typescript
.from('questions').select('content').eq('standard_id', standardId).gt('difficulty_level', 0).limit(1)
```
This takes the FIRST available intervention passage — no randomization, no rotation. Marcus sees the same passage every time.

**Pipeline B — Claude-generated at runtime:** `generate_reassess` produces a new passage + 5 questions each reassess session. `generate_practice_questions` uses the seeded passage. `generate_protocol_step_content` uses the diagnostic passage passed down from TeachSession.

### Finding 1.1 — Passage Recycling (P1)

**The Issue:** TeachSession's `interventionPassage` query uses `.limit(1)` with no ordering or randomization. Every student who hits the same standard gets passage #1 from the database. If Marcus is placed in ThemeConceptBuilding, he sees the same passage across Teach → Practice. If he ever returns for a second teach session (reclassification), same passage again.

**Impact on Marcus:** He has read it. The passage is no longer a discovery — it is a test he already took.

**Fix:** Add `.order('created_at', { ascending: false })` and rotate across available passages, or seed at least 3 passages per standard and randomize the selection.

### Finding 1.2 — Passage Length Cap Conflict (P0 — see Section 3)

Protocol MicroModel steps (read_only) instruct Claude to generate multi-part content: 3 word pairs, full think-alouds, 3-rung ladders. But `PROTOCOL_CONTENT_SYSTEM_PROMPT` caps Claude at **150 words**. A 4-step think-aloud model with narration for each step cannot fit in 150 words. The content Marcus sees at Step 2 of every protocol will be truncated, rushed, or stripped of the examples that make the model legible.

**This is audited in detail under Section 3.2.**

### Finding 1.3 — Passage Emotional Accessibility (P3)

The `EXTRACT_PASSAGES_SYSTEM_PROMPT` explicitly excludes "graphic violence, abuse, trauma, death of a child, or content that could be activating." This is correct. Gutenberg passages (pre-20th century literary fiction) can carry themes of servitude, class shame, and colonial violence that are invisible at the content level but activating at the emotional level for students like Marcus, who may have personal proximity to displacement and poverty.

**Recommendation:** Add a second filter to passage extraction: "Avoid passages where economic hardship, servitude, or institutional powerlessness is presented without agency or dignity." The student should feel expansive, not reminded.

---

## Section 2: Gogi Voice Clarity

### The Voice Standard

The system prompt for `PROTOCOL_CONTENT_SYSTEM_PROMPT` defines the target voice well:
> "casual, direct, warm, teen peer energy. You believe in this student completely. No academic language. No walls of text. Every word earns its place."

This is the right standard. Now let's check what actually gets generated.

### Finding 2.1 — Voice Quality in claudeGenerates (P3 — mostly strong)

The protocol designers wrote the `claudeGenerates` opening lines directly. These are the best-written voice in the system:

**Excellent:**
- ThemeConceptBuilding Step 3: *"You just saw the difference between a topic and a theme. Now let's see if you can spot it yourself."*
- ThemeHuntingStrategy Step 4: *"Same four steps — this time I'm only giving you the headers. You remember what each one asks for. Trust yourself."*
- AbstractionLadder Step 3: *"I already gave you Rung 1 — what happened. Your job is to skip straight to Rung 3: what does this say about ALL people? Don't describe the story. Climb past it."*
- LiteraryAnalysisParagraph Step 1: *"You can find the theme. You can find evidence. The last move — and the hardest one — is explaining WHY the evidence proves the theme."*
- ThemeEvidenceMapping Step 3: *"I've already told you the theme. Your job is to find the proof."*

**Needs work:**
- ConnotativeLanguage Step 1 orientation: *"Authors choose words on purpose. The words they pick — not just what the words mean, but what they feel like — point directly at the theme."* — Reads more like a teacher's framing than peer voice. No Marcus energy. Rephrase: *"Every word an author writes is a choice. They picked THIS word and not a simpler one. That choice is a clue. Today you're going to learn to read it."*
- ThemeEvidenceMapping Step 1: *"You already have an idea about the theme. Now we need to prove it. Today you're going to learn to find the exact words in the text that make your theme undeniable."* — Good concept, but "undeniable" feels slightly formal. Works fine.

### Finding 2.2 — Orientation Steps Missing Real-Life Hooks (P2)

Across all 15 protocols, the Orientation step is described as: *"naming the destination skill, why it matters in real life, and the exact sequence."* But the actual `claudeGenerates` entries for several protocols skip the real-life hook:

- **DefaultListStrategy:** *"authors organize information intentionally — they pick a structure the same way a director picks a shot."* ✓ (has analogy)
- **ChunkingFailure:** *"mental filing system... folders on a phone."* ✓ 
- **WorkingMemoryOverload:** *"skilled readers use a mental notepad."* ✓
- **ConnotativeLanguage:** *"read the feeling underneath the words."* — no real-life connection in the orientation description
- **AbstractionLadder:** orientation prompt lacks a "why this matters outside school" hook
- **LiteraryAnalysisParagraph:** orientation lacks a real-world frame

**Impact:** Marcus needs to know WHY before he will try. "Today you're going to learn to explain WHY the evidence proves the theme" without answering "why does THAT matter?" loses him at Step 1.

**Fix:** Add one sentence to each orientation `claudeGenerates` entry that explicitly names a real-world context: a job interview, a lease, a text message argument. Make it specific to Marcus's world.

### Finding 2.3 — ReassessTrigger Step 8 Voice (P2)

Every protocol's Step 8 `claudeGenerates` is simply: *"Mastery confirmation in Gogi's voice."* (ELA9R12) or *"A 2-sentence mastery confirmation in Gogi's peer voice: names the specific [skill] mastered and connects it to a real-world context."* (ELA9R11, ELA9R21)

This is the most emotionally important moment in the lesson. Marcus just did something hard. The prompt gives Claude minimal direction and the 150-word system cap applies. The result is likely generic ("You learned how to identify themes. This skill will help you in school").

**Fix:** Step 8 `claudeGenerates` needs explicit emotional beats:
1. Name the specific cognitive move Marcus just demonstrated (not the skill category — the exact move: "You climbed from a character's choice to a truth about all people")
2. Connect it to one specific real-world moment Marcus could actually face
3. One punchy affirmation that sounds like a person, not a platform

The current prompt does describe this, but Step 8 shares the same 150-word cap as a Step 2 MicroModel. These should not have the same cap.

### Finding 2.4 — EvalBreakdown Labels Are Theme-Specific Across All Standards (P1)

`ProtocolEngine.tsx` lines 238–248 render the mastery eval breakdown:
```typescript
const checks = [
  { key: 'theme_universal', label: 'Universal theme (not a topic)' },
  { key: 'evidence_relevant', label: 'Evidence supports the theme' },
  { key: 'reasoning_explicit', label: 'Connection explained explicitly' },
];
```

These labels make sense for ELA.9.R.1.2 (Theme protocols). But for ELA.9.R.1.1 (Inferencing) and ELA.9.R.2.1 (Text Structure), Marcus sees:

- **VocabularyGap MasteryCheck:** "Universal theme (not a topic): ✓" — he just completed a vocabulary exercise, not a theme exercise
- **SituationModelFailure MasteryCheck:** "Evidence supports the theme: ✗" — the step was about building a mental movie and making an inference
- **SyntaxComprehensionFailure MasteryCheck:** "Universal theme (not a topic): ✗" — he was parsing clause boundaries

This is actively confusing and undermines trust in the system. Marcus has no idea what "universal theme" means in the context of identifying clause relationships.

**Fix:** The `EvalBreakdown` labels must be dynamic. At minimum, they should map per-standard:

| Standard | theme_universal label | evidence_relevant label | reasoning_explicit label |
|---|---|---|---|
| ELA.9.R.1.2 | Universal theme (not a topic) | Evidence supports the theme | Reasoning explained |
| ELA.9.R.1.1 | Inference goes beyond surface | Evidence directly cited | Connection explained |
| ELA.9.R.2.1 | Structure correctly named | Passage-specific evidence | How it shapes meaning |

---

## Section 3: Protocol Logic — 8-Step Trace

### Finding 3.1 — 150-Word Cap Destroys MicroModel Steps (P0)

`PROTOCOL_CONTENT_SYSTEM_PROMPT` (used for ALL `generate_protocol_step_content` calls) states:
> "Maximum 150 words per response."

This cap applies to every step including MicroModel. But MicroModel steps require:

| Protocol | Step 2 MicroModel — What claudeGenerates requires |
|---|---|
| ThemeConceptBuilding | 3 side-by-side topic vs. theme examples (movie, song, real life) + 1 rule sentence |
| ThemeHuntingStrategy | Full 4-step think-aloud model applied to a passage + step-by-step narration |
| AbstractionLadder | 3-rung ladder visualized + familiar example + literary passage example |
| WorkingMemoryOverload | Think-aloud holding two evidence pieces explicitly + reading both back aloud |
| ReadingStrategyFailure | 3-part model (evidence → reasoning → conclusion) + wrong approach + correction |
| SituationModelFailure | WHO/WHAT CHANGED/WHY tracker walked through 3 passage sections |
| VocabularyGap | 5-step context clue hunt applied to 2 sentences |
| SyntaxComprehensionFailure | Full clause breakdown of 1 complex sentence + 1 removal demonstration |

A think-aloud model with 4 narrated steps across a passage takes ~300-400 words minimum to be legible. At 150 words, Claude will generate a compressed fragment that teaches nothing.

**Marcus's experience:** He reads the MicroModel, gets half a demonstration, and enters GuidedPractice without the mental model he needed. He fails. The protocol reclassifies him. He was never given what the protocol promised.

**Fix:** `generate_protocol_step_content` must not use `PROTOCOL_CONTENT_SYSTEM_PROMPT`. It needs its own system prompt without a word cap, or the cap must be raised to 500 words for this action. The 150-word cap is appropriate for feedback (2 sentences of Gogi reaction) but fatal for instructional modeling.

### Finding 3.2 — `read_only` Format Spec Conflicts With MicroModel Content (P0)

In `buildPrompt` for `generate_protocol_step_content` (route.ts line 515):
```typescript
${interactionType === 'read_only' ? 'Speak directly to the student in 3-5 sentences. No lists. No headers. Just Gogi talking.' : ''}
```

MicroModel is `read_only`. Orientation is `read_only`. ReassessTrigger is `read_only`.

These three steps require completely different output shapes:
- **Orientation:** 3 sentences ✓ (this format works)
- **MicroModel:** Multi-part examples, labeled demonstrations, numbered steps, worked examples — requires lists and structure
- **ReassessTrigger:** 2 sentences of emotional closure ✓

The single format spec destroys MicroModel content. "No lists. No headers." applied to AbstractionLadder Step 2 (which needs a visualized 3-rung ladder) means Marcus gets a paragraph of words describing a structure he cannot see.

**Fix:** The format spec must be step-aware. Pass `stepName` to the format logic and apply different templates per step:
- `Orientation`: 3 sentences, no lists
- `MicroModel`: structured demonstration allowed — lists, numbered steps, examples explicitly permitted
- `ReassessTrigger`: 2 sentences, no lists, peer voice only

### Finding 3.3 — `structured_response` Format Spec Is Hardcoded Wrong (P0)

In `buildPrompt` for `generate_protocol_step_content` (route.ts line 517):
```typescript
${interactionType === 'structured_response' ? 'Give clear instructions for a 3-part response: theme, evidence, reasoning.' : ''}
```

This is hardcoded to ELA.9.R.1.2 (Theme) field structure. It is wrong for:

| Protocol + Step | Correct fields |
|---|---|
| SituationModelFailure IndependentTask | WHO / WHAT CHANGED / WHY / CLAIM |
| VocabularyGap IndependentTask (MasteryCheck) | UNKNOWN WORD / CONTEXT CLUES FOUND / CLUE TYPE / MEANING |
| ChunkingFailure IndependentTask | CATEGORY 1 (name) / CATEGORY 2 (name) / CATEGORY 3 (name) / GROUPING LOGIC |
| MainIdeaExtractionFailure IndependentTask | MAIN IDEA / SUPPORTING DETAIL 1 / SUPPORTING DETAIL 2 |
| TextTypeDiscriminationFailure MasteryCheck | SIGNAL WORDS FOUND / CATEGORY OF EACH / WHAT THEY TELL THE READER / STRUCTURE THEY REVEAL |
| SyntaxComprehensionFailure IndependentTask | CLAUSE 1 / CLAUSE 2 / LOGICAL RELATIONSHIP / FULL SENTENCE MEANING |
| DefaultListStrategy MasteryCheck | STRUCTURE IDENTIFIED / EVIDENCE FROM TEXT / HOW IT SHAPES MEANING |

Marcus working in VocabularyGap is given instructions to write "theme, evidence, reasoning." He has no theme. He has a vocabulary word. The field labels are wrong and the response he submits cannot be correctly evaluated.

**Fix:** The `claudeGenerates` array for each step already specifies the correct field structure. This content is passed to Claude via the `claudeGenerates` param. The hardcoded format spec in the prompt override must be removed. Let `claudeGenerates` drive the output shape. The current override defeats its own purpose.

### Finding 3.4 — `claudeGenerates` Array Passed as Raw String (P2)

In `buildPrompt`, the `claudeGenerates` param is passed as a string directly from the ProtocolEngine. The protocol definition stores it as `string[]`. When TypeScript serializes an array to a string, the result depends on how ProtocolEngine passes it — likely `.join(', ')` or via JSON serialization.

If `claudeGenerates` is passed as `["item1", "item2"]` (JSON string of array), Claude receives a string that looks like a JSON array. If it's `item1, item2`, Claude gets a comma-separated list. Either way, the multi-part nature of the instructions survives, but the structural clarity for Claude is reduced.

**Recommendation:** Verify that ProtocolEngine passes `claudeGenerates` as the array joined with `\n- ` (numbered bullets) rather than raw serialization. This gives Claude clean, directive instructions instead of a flat string.

### Finding 3.5 — ELA9R21 Protocols Use Wrong Field Names in evaluate_mastery_structured (P1)

The `evaluate_mastery_structured` prompt returns:
```json
{
  "theme_universal": ...,
  "evidence_relevant": ...,
  "reasoning_explicit": ...,
  "scaffolds_used": ...
}
```

These field names are re-used for ELA.9.R.2.1 protocols but mapped semantically (e.g., `theme_universal` = "structure correctly named"). This works internally but produces absurd EvalBreakdown labels (Finding 2.4) and creates technical debt: if a new evaluator reads the JSON, "theme_universal: false" for a SyntaxComprehensionFailure response is meaningless.

**This is acceptable for pilot.** Fix in v2 alongside Section 2.4.

### Finding 3.6 — Reclassification Has No UX Acknowledgment (P2)

When a student hits `reclassificationTrigger.attemptThreshold` (3 attempts), ProtocolEngine calls `onReclassify(fallbackProtocol, clinicalRationale)`. TeachSession then calls `setReclassifiedProtocolName(fallbackProtocol)`, which changes the key on `<ProtocolEngine>`, which re-mounts the component and starts the new protocol from Step 1.

Marcus experiences this as: the lesson resets with no explanation. No Gogi voice acknowledging what happened. No "this is a different angle on the same skill." The transition is silent and clinical.

**Fix:** When reclassification fires, show a 2-second GogiAvatar bridge message before re-mounting ProtocolEngine:
> *"Let's try this from a different angle. Same skill, different approach. You've got this."*

This is a 1-component addition: a `reclassifying` view state in TeachSession that renders the bridge, then transitions to the new protocol after 2s.

### Finding 3.7 — TransferTask Always Requires All 4 Conditions (P1)

`derivePassed` for TransferTask (ProtocolEngine lines 119–126):
```typescript
if (step.name === 'TransferTask') {
  return (
    theme_universal === true &&
    evidence_relevant === true &&
    reasoning_explicit === true &&
    scaffolds_used === false
  );
}
```

But VocabularyGap TransferTask is a `short_response` — "Apply your context clue strategy. Find the clue, name the type, derive the meaning. Prose response." There is no theme, no evidence, no explicit reasoning in the ELA.9.R.1.2 sense. Claude evaluating this correctly sets `theme_universal = true` if the meaning derivation is correct, but `reasoning_explicit` may be `false` because there is no "reasoning bridge" in the vocabulary task — only clue identification and meaning derivation.

The hard requirement for `reasoning_explicit = true` on all TransferTasks will cause VocabularyGap (and potentially ChunkingFailure, TextTypeDiscriminationFailure) TransferTask to fail even when the student demonstrably mastered the skill.

**Fix:** `derivePassed` for TransferTask should check `advancementCondition` or read the `masteryConditions` from the step definition to determine which fields are critical per protocol, just as MasteryCheck does.

---

## Section 4: Visual Hierarchy

*Note: GOGI_Screen_Mockup.jsx was not found in the repository. Visual assessment performed from reading the component source and CSS class patterns. Several findings require the mockup for confirmation.*

### Finding 4.1 — GogiAvatar Has No Emotional State (P2)

`GogiAvatar.tsx` currently has: static green glow, `size` prop only (sm/md). No mood states. No animation on feedback. No visual response to student success or struggle.

Marcus finishes a hard MasteryCheck and GogiAvatar is identical to when he started. There is no embodied signal from Gogi that this moment is different from any other moment.

**What the mockup was expected to specify:** mood-driven ring color, pulse animation on success, dim on failure.

**Minimum viable implementation without the mockup:**
- `mood` prop: `'default' | 'encouraging' | 'celebrating' | 'thinking'`
- `celebrating`: ring pulses teal with a wider radius
- `encouraging`: ring dims slightly (student is struggling)
- `thinking`: ring cycles at 50% opacity (Claude is working)
- `default`: current static green glow

**Use cases:** `encouraging` during feedback + reclassification. `celebrating` on ReassessTrigger. `thinking` during generating/evaluating views.

### Finding 4.2 — Step Breadcrumb Loses Meaning on Mobile (P2)

`StepDots` (ProtocolEngine lines 199–234) renders 8 dots with expanding width for the active dot and the step name. On a 375px viewport (iPhone SE), 8 dots + label + gaps exceeds available width and wraps. The `flex-wrap` class allows wrapping but the resulting layout is broken — dots on two rows with no visual hierarchy.

**Fix:** On mobile (`< 640px`), collapse StepDots to: `Step 3 of 8 · Try Together` as a text string. This gives location without layout cost.

### Finding 4.3 — EvalBreakdown Clinical Labels Are Exposed to Marcus (P1)

`EvalBreakdown` renders internal evaluation field names in uppercase: "Universal theme (not a topic)", "Evidence supports the theme", "Connection explained explicitly". While these are humanized, the component is still presenting Marcus with a clinical rubric checklist rather than actionable feedback.

**The problem:** Marcus fails MasteryCheck. He sees:
```
✗ Universal theme (not a topic)
✓ Evidence supports the theme  
✓ Connection explained explicitly
```
He is shown which field failed. But without Gogi's voice explanation of WHY it failed and what to do, this is a binary verdict he cannot act on.

**The fix:** The `feedback` field from Claude's evaluation JSON (returned in `evaluate_mastery_structured`) already contains the actionable Gogi message. This should be the primary content of the feedback view. EvalBreakdown should be secondary — collapsed by default, expandable for students who want to see it, or removed entirely.

### Finding 4.4 — Passage Typography Not Differentiated (P3)

The diagnostic passage, intervention passage, and protocol step content all render in the same `text-sm text-[#94A3B8]` style via `renderGogiContent`. Gogi's voice and the passage the student is analyzing are visually identical. Marcus cannot tell where the literary text begins and Gogi's instructions end.

**Fix:** Passages (when they appear in protocol steps) should render in a distinct typography block:
- Background: `bg-white/[0.04]` with border
- Font: slightly larger (`text-[15px]`) with `leading-[1.75]`
- Color: `text-[#CBD5E1]` (slightly brighter than body copy)

This is the passage typography problem the mockup was expected to address.

---

## Section 5: Emotional Experience

### Marcus — Full Journey Map

**Login → Home → Diagnostic**

Login: *"Good to see you."* — correct peer voice. The greeting is personal.

Home → Diagnostic entry: Marcus sees a Standard card with a status pill. He clicks Start. The diagnostic intro now reads in peer voice (fixed in prior session). The "Quick heads up" bullets tell him the rules clearly.

During diagnostic: 5 questions, AI-generated at runtime (or seeded). Marcus selects options. No feedback between questions. No Gogi presence. Five cold questions.

**Finding 5.1 — Diagnostic Is Emotionally Flat (P2)**

Marcus completes all 5 questions with no acknowledgment between them. The diagnostic is correctly designed to be silent (feedback would corrupt the diagnostic signal). But entering the results screen after 5 silent questions, with no transition, feels abrupt.

The results screen now uses amber arrows instead of red ✗ (fixed). But there is no Gogi voice at the results screen. Marcus sees his standards listed with → arrows and nothing explaining what comes next or why it matters that this happened.

**Fix:** Add a 1-2 sentence Gogi message at the top of the results screen before the standard list:
> *"Here's what I found. These are the specific spots where we can build something real."*

Then the standard list. Then the CTA button. This transforms the results screen from a verdict to an invitation.

**Teach Phase Entry**

TeachSession loads (`view === 'loading'`): "Setting up your lesson…" — adequate.

Protocol starts. Orientation fires. Step 1 is `read_only` — Marcus reads 3 sentences, taps Continue.

**Finding 5.2 — Protocol Entry Has No Emotional Frame (P2)**

The transition from TeachSession's loading screen to ProtocolEngine's Step 1 (Orientation) has no bridge. Marcus goes from the loading spinner directly to Gogi talking about a cognitive skill. He does not know:
- What lesson he is about to do
- How long it will take
- What success looks like when he's done

The Orientation step is supposed to answer these questions, but at 3 sentences with a 150-word cap, the content is compressed. If the cap is fixed (Finding 3.1), this becomes less critical. But even with unlimited words, a cold entry into protocol instruction is jarring.

**Fix:** Before ProtocolEngine fires Step 1, TeachSession should show a 1-step interstitial:

> [GogiAvatar] "You're going to [name the destination] today. It's [number] steps. Let's go."

This is what students need to feel safe entering a new cognitive task.

**During Teach — Steps 3–7**

Marcus answers. He is wrong. Gogi responds. He tries again. This loop is the core of the product.

**Finding 5.3 — Feedback View Has No Encouragement for Repeated Failure (P2)**

When Marcus fails a step twice, he sees:
1. Claude's feedback (2 sentences)
2. EvalBreakdown (which fields failed)
3. A retry area

After 3 attempts, he reclassifies — silently (Finding 3.6).

There is nothing in the 3-attempt cycle that acknowledges Marcus as a person who is struggling and still in the room. The feedback is correctly non-punishing ("Never say 'however' or 'unfortunately'"), but it is also emotionally neutral. Each retry is identical in tone to the first.

**Fix:** On attempt 2 (not attempt 1 — don't be condescending), GogiAvatar should add a single additional sentence to Claude's feedback:
> *"You're still in it. Let's look at it one more time."*

On attempt 3 (before reclassification):
> *"Let's try this from a completely different direction — I've got another way to teach this to you."*

These are not inserted into the Claude API call. They are hardcoded in ProtocolEngine's `feedback` view, conditionally rendered based on `attemptCount`.

**Reclassification**

As noted in Finding 3.6 — silent protocol reload. Marcus experiences an unacknowledged reset. This is the most emotionally dangerous moment in the product.

**Teach Complete**

The TeachSession `complete` view now shows:
- Teal checkmark
- "Lesson complete." (22px/700)  
- GogiAvatar + "You just learned something real. Time to try it out."
- Continue button → auto-routes to Practice in 3s

This is correct. The voice is on target. The 3-second delay is respectful — Marcus gets a moment before he's moved.

**Practice Phase**

3 questions at 3 scaffold levels. Each uses the same passage from Teach. This is pedagogically correct (schema transfer).

**Finding 5.4 — Practice Has No Mid-Session Encouragement (P3)**

Q1 feedback → Q2 loads. No Gogi transition between questions. Q2 feedback → Q3 loads. Again, no transition. The practice session moves from question to question with only the feedback card as a bridge.

For Marcus, Q2 is harder than Q1 (scaffold reduced). If he failed Q1, he enters Q2 already shaken. No acknowledgment that the difficulty is intentional.

**Fix:** A 1-sentence Gogi bridge before Q2 and Q3:
- Before Q2: *"Same skill, less support this time."*
- Before Q3: *"Now you try it with nothing in the way."*

These are 1-2 word changes to the practice UI — display a bridge text in the transition between questions. Not a full API call. Hardcoded.

**Practice → Reassess Transition**

The `transitioning` view (recently fixed): teal checkmark, "Practice complete.", GogiAvatar + "You just put in real work. Your check-in is next.", Continue button. 3-second auto-route.

This is strong. The voice is right.

**Reassess Phase**

The animated loading screen (recently fixed): GogiAvatar + rotating messages + 25-second progress bar. Good.

Reassess is 5 questions. Marcus answers each. Feedback is 2 sentences of Gogi voice. After Q5 — if mastery is achieved, he sees a completion screen. If not, he is either looped back (not implemented yet in ReassessSession) or routed to an unclear state.

**Finding 5.5 — Post-Reassess Mastery Screen Not Specified (P1)**

The ReassessSession completion state is not audited here (code not read in full), but based on the GOGI learning loop: if Marcus achieves 80%+ on reassess, he has demonstrated mastery of the standard. This is the most important moment in the entire product.

There must be a mastery confirmation screen that:
1. Names what Marcus now owns as a skill
2. Connects it to something real in his life
3. Updates the home page status to "Mastered" in real time

If this screen is generic, or if it routes Marcus back to home without acknowledgment, the emotional peak of the product is lost.

**Action:** Read `ReassessSession.tsx` in full during the next implementation session. Audit the completion/mastery state before pilot.

---

## Section 6: End-to-End Flow Logic

### Finding 6.1 — Diagnostic → Teach Routing Depends on Single Wrong Response (P1)

`TeachSession` init (lines 131–160):
```typescript
const { data: wrongResponse } = await supabase
  .from('responses')
  .select('diagnostic_classification, question_id, cognitive_skill_targeted')
  .eq('student_id', student.id)
  .eq('standard_id', standardId)
  .eq('mastery_achieved', false)
  .order('created_at', { ascending: false })
  .limit(1)
```

The protocol is selected based on the SINGLE MOST RECENT wrong response's `diagnostic_classification`. If Marcus answered 4 questions correctly and 1 wrong, his entire teach protocol is determined by which cognitive breakdown caused that one wrong answer.

This is the intended diagnostic logic — one diagnostic question per classification gives a signal. But if the seeded questions don't distribute cleanly across classification types, Marcus may get a mismatched protocol.

**Example:** If all 5 diagnostic questions happen to have Layer 3 distractors for two classifications (e.g., `abstract_reasoning_deficit` and `evidence_retrieval_failure`), and Marcus always picks the wrong Layer 2 answer, his classification will be `vocabulary_gap` even though his primary failure is abstract reasoning.

**This is a content quality issue, not a code bug.** The diagnostic questions must be verified to have exactly one distractor per layer with distinct classification codes.

**Recommendation:** Verify that all seeded diagnostic questions for each standard have exactly 4 options with exactly these 4 classifications: one Key, one Layer 1 distractor (schema_deficit or no_metacognitive_strategy), one Layer 2 distractor (vocabulary gap family), one Layer 3 distractor (inferencing gap family).

### Finding 6.2 — Practice → Reassess Passes Protocol Name, Not Standard Data (P2)

`PracticeSession` completes and routes to `/student-reassess/${standardId}`. The standard ID is correctly passed. But `ReassessSession` must independently query for the student's classification and session history to contextualize the reassessment.

If Marcus reclassified during Teach (going from ThemeConceptBuilding to ThemeHuntingStrategy), the most recent wrong response now may be from ThemeHuntingStrategy's MasteryCheck. The reassessment should reflect what Marcus actually worked on — but the routing is by standard, not by protocol. This is acceptable for pilot but should be flagged for v2.

### Finding 6.3 — `onReclassify` Second Argument (clinicalRationale) Is Silently Dropped (P3)

`ProtocolEngineProps` declares:
```typescript
onReclassify: (fallbackProtocol: string, clinicalRationale: string) => void;
```

`TeachSession` implements:
```tsx
onReclassify={(fallbackProtocol) => setReclassifiedProtocolName(fallbackProtocol)}
```

The `clinicalRationale` is never stored. This means the teacher dashboard can never show WHY a student was reclassified — only that they were. For a product that promises "real-time visibility into student progress, standard by standard," this data is important.

**Fix (pilot-safe):** Save the `clinicalRationale` to the responses table when reclassification fires. Add a call to Supabase inside TeachSession's `onReclassify` handler. No schema change needed — use the existing `ai_feedback` column or `intervention_content`.

### Finding 6.4 — Rate Limit Window Is Per-Server-Instance (P3)

`rateLimitMap` is an in-memory `Map<string, number[]>`. Resets on server restart. On Vercel (serverless), each cold start is a new instance. A student who hits 100 calls and triggers a 429 may immediately get a fresh limit on the next serverless invocation.

**Impact on pilot:** Acceptable. 5-10 students, predictable server startup. Track actual call counts via Supabase instead of in-memory for v2.

---

## Priority Fix Matrix

### P0 — Fix Before Any Student Touches This

| # | Finding | File | What to Fix |
|---|---|---|---|
| 1 | 150-word cap kills MicroModel steps | `route.ts:60-69` | Remove word cap from `PROTOCOL_CONTENT_SYSTEM_PROMPT` or split into separate system prompt for `generate_protocol_step_content` with 500-word cap |
| 2 | `read_only` format spec overrides MicroModel | `route.ts:515` | Make format spec step-name-aware: only apply "3-5 sentences, no lists" to Orientation and ReassessTrigger |
| 3 | `structured_response` format spec hardcoded to theme/evidence/reasoning | `route.ts:517` | Remove the hardcoded format spec; let `claudeGenerates` content drive the output shape |

### P1 — Fix Before Pilot Launch

| # | Finding | File | What to Fix |
|---|---|---|---|
| 4 | EvalBreakdown labels are theme-specific across all standards | `ProtocolEngine.tsx:238-248` | Dynamic label map per-standard |
| 5 | TransferTask `derivePassed` requires all 4 conditions | `ProtocolEngine.tsx:119-126` | Make TransferTask check advancementCondition per protocol, same as MasteryCheck |
| 6 | Post-reassess mastery screen not confirmed | `ReassessSession.tsx` | Audit completion/mastery state; verify emotional peak is present |
| 7 | Diagnostic results screen has no Gogi voice | `DiagnosticAssessment.tsx` | Add 1-2 Gogi sentences before the standard list on results screen |

### P2 — Fix Before Week 2 of Pilot

| # | Finding | File | What to Fix |
|---|---|---|---|
| 8 | Reclassification has no UX acknowledgment | `TeachSession.tsx` | Add `reclassifying` view state with GogiAvatar bridge message |
| 9 | Orientation voice lacks real-life hook (6 protocols) | `ELA9R12Protocols.ts`, `ELA9R11Protocols.ts`, `ELA9R21Protocols.ts` | Add real-world context to ConnotativeLanguage, AbstractionLadder, LiteraryAnalysisParagraph orientation claudeGenerates |
| 10 | No encouragement on repeated failure | `ProtocolEngine.tsx` | Add hardcoded attempt-count-aware Gogi lines in feedback view |
| 11 | Protocol entry has no emotional frame | `TeachSession.tsx` | Add 1-step interstitial before ProtocolEngine fires |
| 12 | Practice has no between-question bridges | `PracticeSession.tsx` | Hardcoded 1-sentence transition before Q2 and Q3 |
| 13 | GogiAvatar has no emotional states | `GogiAvatar.tsx` | Add `mood` prop with 4 states: default, encouraging, celebrating, thinking |
| 14 | Step breadcrumb breaks on mobile | `ProtocolEngine.tsx:199-234` | Collapse to text string on small viewports |
| 15 | onReclassify drops clinicalRationale | `TeachSession.tsx:360` | Save clinicalRationale to Supabase on reclassification |

### P3 — Polish Pass

| # | Finding | File | What to Fix |
|---|---|---|---|
| 16 | Passage recycling — same passage every session | `TeachSession.tsx:169-178` | Randomize passage selection from available pool |
| 17 | ReassessTrigger Step 8 voice underspecified | All protocol files | Strengthen Step 8 claudeGenerates with explicit emotional beats |
| 18 | Passage typography not differentiated | `ProtocolEngine.tsx:renderGogiContent` | Distinct typography block for passage content |
| 19 | Gutenberg passages may carry activating themes | `EXTRACT_PASSAGES_SYSTEM_PROMPT` | Add economic hardship/servitude filter to extraction prompt |
| 20 | EvalBreakdown is primary feedback surface | `ProtocolEngine.tsx` | Make Claude feedback primary; EvalBreakdown secondary/collapsible |

---

## What Is Working

These elements are strong and should be preserved:

1. **The 8-step scaffold-fade architecture** — pedagogically rigorous, research-grounded. VanLehn, Pressley, Sweller properly applied.
2. **Reclassification fallback logic** — every protocol has a correct clinical rationale for its fallback. The chain of protocols for each standard is pedagogically coherent.
3. **GuidedPractice opening lines** — the `claudeGenerates` opening lines for Steps 3 and 4 across all protocols are strong peer voice. These are some of the best student-facing copy in the product.
4. **The 8 fake-out rejection conditions** in both `evaluate_mastery_structured` and `evaluate_practice_response` — this is what separates GOGI from a naive LLM rubric.
5. **Warm error messages** across all 4 student components — this was fixed correctly.
6. **Practice → Reassess and Teach → Practice transition screens** — the 3-second bridge with GogiAvatar and peer voice is exactly right.
7. **Diagnostic intro peer voice rewrite** — the "Quick heads up:" bullets and the opening framing are now correct.
8. **Rate limit toast** — the 429 message is warm and doesn't feel like a system error.
9. **`callClaude` AbortController timeout** — correctly implemented per-attempt.

---

*Audit written: 2026-04-15*  
*Next audit: After P0 fixes are deployed*
