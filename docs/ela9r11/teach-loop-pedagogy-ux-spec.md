# ELA.9.R.1.1 Teach Loop Pedagogy + UX Spec

Issue: #13  
Status: Locked instructional spec for the current Card 12 teach-loop engine  
Scope: ELA.9.R.1.1 Teach phase only

## Product Promise

GOGI must make the diagnostic actionable:

```text
diagnose the breakdown -> teach the missing move -> require practice -> reassess mastery
```

Card 11 identifies the student's primary misconception. Card 12 routes the student into a Teach loop. Card 13 locks the instructional structure those Teach loops must follow.

The Teach phase is not a lesson page, worksheet, video, or click-through explanation. It is a short active thinking loop that teaches one missing move and requires the student to use it.

## Current Alignment

The original issue said "spec only, no code" and assumed Teach routes were still generic. Since then, the repo now has a unified Card 12 route:

```text
/standard/[standardId]/teach/ela9r11
```

The spec below governs that engine and any future refinement. It does not introduce a new route, a new architecture, or a second Teach system.

## Non-Negotiables

- One Teach loop targets one primary misconception.
- Students never see internal labels such as `evidence_too_general`.
- Every screen asks for one cognitive action.
- Every active step requires a student response.
- Feedback names one revision move at a time.
- Feedback never gives the final response.
- Transfer uses an unseen passage.
- The loop must fit an 8-minute Teach block on a school laptop.

## The Repeatable Thinking Formula

Every ELA.9.R.1.1 Teach loop trains the same core formula:

```text
Claim -> Sharp Evidence -> Author Move -> Effect -> Meaning/Style
```

Student-facing language:

```text
What are we proving?
What detail proves it?
What is the author doing?
What does that detail make the reader understand or feel?
Why does it matter?
```

Teacher-facing language:

```text
The student is learning to connect a literary element to evidence and explain how it adds meaning and/or style.
```

## 5-Phase Teach Model

### Phase 1: Foundation Check

Purpose: Confirm the student understands the job before the loop starts.

Student action:
- Chooses what the evidence must do for a claim.

Expected output:
- A selected response showing that evidence must prove the exact claim, not merely repeat a related plot detail.

Success condition:
- Student chooses the option equivalent to "prove the exact claim."

Failure condition:
- Student chooses plot retell, vague literary language, or a broad related detail.

Feedback rule:
- Name the job again without giving the answer.

Feedback template:

```text
That keeps the answer too general. The job is to prove the exact claim, not just mention the story.
```

Target time: 45 seconds

### Phase 2: Name the Move

Purpose: Teach the student the missing thinking move in plain language.

Student action:
- Reads a one-sentence skill frame and identifies the author move being practiced.

Expected output:
- Names or selects the literary element or craft move that matters in the passage.

Success condition:
- Student correctly identifies the author move or a closely related category.

Failure condition:
- Student selects a topic, plot event, character name, or disconnected literary term.

Feedback rule:
- Contrast the wrong category with the target category.

Feedback template:

```text
That label does not fit the job this detail is doing. Look for the author move, not just the event.
```

Target time: 60 seconds

### Phase 3: Pattern Recognition

Purpose: Teach the student what to look for in the text.

Student action:
- Selects or highlights the smallest useful evidence.

Expected output:
- Chooses a precise word, phrase, or detail that proves the claim.

Success condition:
- Evidence directly supports the target claim.

Failure condition:
- Evidence is related but too broad, irrelevant, or merely summarizes the event.

Feedback rule:
- Compare evidence quality, not correctness alone.

Feedback template:

```text
That detail may be related, but it is not sharp enough. Choose the smallest detail that proves the claim.
```

Target time: 90 seconds

### Phase 4: Run the Move

Purpose: Require the student to perform the actual ELA.9.R.1.1 reasoning move.

Required sequence:

```text
Notice -> Name -> Defend
```

Notice:
- Identify the relevant detail.

Name:
- State the author move or meaning created by the detail.

Defend:
- Explain how the detail creates meaning, style, mood, tone, character development, conflict development, or theme.

Student action:
- Builds a short analytical response using the loop formula.

Expected output:

```text
The author uses [element/move] when [evidence]. This shows/creates/reveals [effect], which matters because [meaning/style].
```

Success condition:
- Response includes the author move, precise evidence, and effect.

Failure condition:
- Response only summarizes, drops a quote, names an element without function, or gives vague analysis.

Feedback rule:
- Identify the first missing part only.

Feedback templates:

```text
You named the move. Now explain what it does.
```

```text
You have evidence. Now explain what that evidence proves.
```

```text
Use a smaller detail from the passage. Broad evidence makes the claim harder to prove.
```

Target time: 3 minutes

### Phase 5: Transfer Check

Purpose: Verify the student can use the move without the same scaffold.

Student action:
- Reads a new, unseen passage.
- Answers one ELA.9.R.1.1-aligned prompt.
- Uses evidence and explanation.

Expected output:
- A complete response or selected evidence-plus-explanation interaction showing transfer.

Success condition:
- Student independently identifies the relevant detail, names the move, and explains the effect.

Failure condition:
- Student falls back into the original misconception.

Pass outcome:
- Save Teach completion.
- Route to Practice.

Fail outcome:
- Save Teach attempt.
- Keep student in intervention for the next session.

Target time: 2 minutes

## Classification Mapping

All ELA.9.R.1.1 misconception flags use the same 5-phase structure but emphasize a different missing move.

| Misconception flag | Student-friendly loop | Missing move |
| --- | --- | --- |
| `element_not_identified` | Find the author move | Separate element from topic/detail/event |
| `element_misidentified` | Sort the element correctly | Distinguish similar literary categories |
| `function_not_explained` | Explain what the element does | Move from label to function |
| `effect_confused_with_summary` | Turn summary into analysis | Move from event to author effect |
| `meaning_connection_missing` | Answer the so what | Connect element to deeper meaning |
| `style_connection_missing` | Connect craft to effect | Connect author choice to reader experience |
| `literal_reading_only` | Go past the literal event | Infer beyond surface meaning |
| `evidence_irrelevant` | Choose evidence that proves it | Match evidence directly to claim |
| `evidence_misread` | Read the evidence accurately | Interpret evidence in context |
| `evidence_too_general` | Make the evidence sharper | Replace broad evidence with precise proof |
| `quote_without_function` | Explain how the quote works | Attach evidence to reasoning |
| `analysis_too_vague` | Make the analysis specific | Replace vague analysis with exact effect |
| `theme_element_confusion` | Build theme through an element | Explain how an element develops theme |
| `tone_mood_confusion` | Separate tone from mood | Distinguish author attitude from reader feeling |
| `point_of_view_effect_missing` | Explain perspective effect | Connect POV to reader understanding |
| `figurative_language_effect_missing` | Explain figurative effect | Explain what figure/image/symbol adds |
| `structure_effect_missing` | Explain structure effect | Connect order, pacing, contrast, or repetition to meaning |

## Interaction Rules

Foundation Check:
- Chip selection.
- No text input.
- Immediate feedback.

Name the Move:
- Chip selection for early scaffold.
- Later versions may use drag/sort.

Pattern Recognition:
- Highlight/select evidence.
- Evidence must be visible in the passage.

Run the Move:
- Short text or structured response builder.
- Student must complete the reasoning link.

Transfer Check:
- Unseen passage.
- Minimal scaffold.
- No answer reveal.

## Feedback Rules

Feedback must be:
- specific
- short
- one move at a time
- connected to the student response
- non-shaming
- non-clinical

Feedback must not:
- reveal the final answer
- show internal labels
- give generic "try again" messages
- diagnose the student in clinical language

Allowed feedback pattern:

```text
You [what the student did]. Now [one revision move].
```

Examples:

```text
You picked a related detail. Now choose the smaller phrase that proves the exact claim.
```

```text
You named the element. Now explain what it makes the reader understand.
```

```text
You used evidence. Now connect it with because.
```

## Cognitive Load Rules

- No more than one active task per phase.
- No more than three answer choices in scaffolded chip steps.
- Passage stays visible while the student works.
- Current claim stays visible while the student works.
- Feedback appears near the active task.
- Step labels are for orientation only; students should not need to understand system terminology.

## Timing Budget

| Phase | Target time |
| --- | ---: |
| Foundation Check | 45 seconds |
| Name the Move | 60 seconds |
| Pattern Recognition | 90 seconds |
| Run the Move | 3 minutes |
| Transfer Check | 2 minutes |
| Total | ~8 minutes |

## Persistence Requirements

At minimum, save:
- student id
- standard id/code
- diagnostic session id
- primary misconception flag
- assigned Teach route
- Teach loop id
- current Teach step
- step responses
- step feedback
- step status
- mastery check score
- Teach loop completion status
- started/saved/completed timestamps

Current implementation may store these in `responses.student_response` JSON until a dedicated Teach progress table exists.

## Acceptance Checklist

- Each ELA.9.R.1.1 misconception flag maps to one Teach loop.
- Each Teach loop has student-facing title and teacher-facing description.
- Each loop follows the 5-phase Teach model.
- Each phase has one cognitive purpose.
- Each active phase requires a student response.
- Student cannot passively click through.
- Feedback targets one missing move at a time.
- Feedback does not give away the final response.
- Student-facing copy hides internal labels.
- Teacher-facing output preserves the diagnostic reason.
- Teach step progress is saved.
- Teach completion is saved.
- Passing the transfer/mastery check routes to Practice.
- Failed transfer keeps the student in intervention for a future session.
- Flow fits an 8-minute Teach block.

## Out of Scope

- New standards beyond ELA.9.R.1.1
- Full Practice redesign
- Full Reassess redesign
- New content pipeline work
- Parent dashboard
- District dashboard
- Gamification

## Definition of Done

Card 13 is complete when this spec is approved as the locked instructional model for ELA.9.R.1.1 Teach loops and future Teach code changes can be judged against it.

The next engineering card should update the current `Ela9R11TeachLoopRunner` to match this spec exactly, especially the 5-phase flow and unseen transfer check.
