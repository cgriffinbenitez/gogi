# GOGI Intervention Passage Criteria v2

**Status:** Locked April 22, 2026
**Supersedes:** GOGI_Intervention_Passage_Criteria_v1_draft
**Applies to:** Every primitive in the GOGI taxonomy

Universal clinical criteria for evaluating candidate passages across all 
13 cognitive primitives. Classification-specific canonical vocabulary and 
exemplar patterns layer on top of this universal frame.

## The 4-Question Clinical Calibration

Every candidate passage must pass all four questions. Failure on any 
single question = reject.

### Q1 — Presence

Is the target skill signal present in this passage? Can the target 
cognitive phenomenon (tone, mood, figurative language, inferencing 
opportunity, theme, evidence, structure, etc.) be named using this 
classification's canonical vocabulary? If no, reject — construct not 
present.

### Q2 — Dominance

Is the target skill the dominant signal? The target skill must be the 
primary work the passage does, not a secondary feature beneath plot 
action, character emotion, description, or symbolism. A passage where 
tone is present but subordinate to characterization teaches 
characterization, not tone. If the target skill is not dominant, reject — 
construct confound.

### Q3 — Accessibility (primary architectural criterion)

Can a Title I 9th grader detect the target skill signal using ONLY 
content present in the passage plus universal human/social understanding?

This is the load-bearing criterion. The passage must be self-contained — 
a reader should be able to detect the target skill from what is written 
on the page, not from what they already know before reading it.

**Self-contained signals (ACCEPTABLE):**

- Universal human dynamics (flattery met with indifference, expectation 
  undercut by reality, self-deprecating humor, observational irony about 
  behavior)
- Period setting that is inferable from context (the passage explains 
  what it needs the reader to know)
- Vocabulary that can be resolved through sentence-level context clues
- Structural tonal moves (ironic modifiers, parallel undercutting, 
  register shifts)
- Emotional/social situations any 9th grader can access (family 
  dynamics, social pressure, disappointment, desire, curiosity)

**Schema-gated signals (REJECT):**

- Specific historical events the reader must already know (French 
  Revolution, Civil War, Great Depression, specific wars, specific 
  political movements) unless the event is named and contextualized in 
  the passage itself
- Named institutions requiring outside knowledge (Court of Chancery, 
  Parliament, specific legal or political systems, specific religious 
  institutions)
- Biblical, classical, or literary allusions unless the allusion is 
  explained within the passage
- Named landmarks, monuments, or geographic references requiring outside 
  knowledge (Temple Bar, Canterbury, specific historical sites)
- Novel-level metaphors — symbols or motifs that only function if the 
  reader has read the entire source work
- Cultural registers or codes requiring period-specific social knowledge 
  (Victorian mourning conventions, Regency courtship rules, specific 
  class markers)
- Named historical figures requiring the reader to know who they are and 
  what they represent

**The acid test:** If you were to hand this passage to a Title I 9th 
grader cold, with no pre-teaching, no vocabulary support, and no context, 
could they detect the target skill signal? If detection requires outside 
knowledge the kid almost certainly does not have, reject.

**The inferability rule:** Period-specific content is acceptable if and 
only if the passage itself gives the reader what they need.

- ACCEPTABLE: "Elizabeth took up some needlework" — period but action 
  inferable and not load-bearing for tonal work
- ACCEPTABLE: "he had lost his wife" — period euphemism, context makes 
  meaning clear
- REJECTABLE: "at the very heart of the fog, sits the Lord High Chancellor 
  in his High Court of Chancery" — requires knowing what Chancery is and 
  does to read the mocking tone
- REJECTABLE: "the lords of the State preserves of loaves and fishes" — 
  Biblical allusion plus institutional reference, tone fully gated behind 
  schema

**If in doubt, reject.** False negatives in review are recoverable 
(passage stays in corpus, gets reviewed again later). False positives 
contaminate pilot data.

### Q4 — Clean Isolation

Does the passage isolate the target skill without heavy cognitive 
overload from other primitives? The passage should not be cognitively 
overloaded by competing demands. A passage that is clinically 
tone-focused but buried in tier-5 syntax barrier and figurative language 
density fails isolation. Some overlap with other primitives is expected 
and acceptable — but the target skill must be the primary cognitive work, 
cleanly accessible once Q3 is satisfied.

## Rejection Taxonomy

Every rejection captures which Q failed and why in one sentence.

- **Q1 fail — No target skill present** ("Descriptive passage, no 
  authorial tone detectable")
- **Q1 fail — Canonical answer fabricated** ("Tag prompt invented tone 
  label; passage is mood-dominant")
- **Q2 fail — Construct confound** ("Characterization dominant over 
  tone")
- **Q2 fail — Primitive mismatch** ("Passage teaches 
  figurative_language_failure, not tone_misreading")
- **Q3 fail — Schema-gated historical** ("Requires knowledge of French 
  Revolution to read the irony")
- **Q3 fail — Schema-gated institutional** ("Requires knowledge of Court 
  of Chancery to read the mockery")
- **Q3 fail — Schema-gated allusive** ("Biblical allusion carries the 
  tonal work, not inferable from passage")
- **Q3 fail — Schema-gated novel-level** ("Tone carrier is a symbol that 
  only functions across the whole novel")
- **Q4 fail — Cognitive overload** ("Syntax barrier and figurative 
  density prevent tone isolation")
- **Format fail** — reserved for format/genre mismatches (play dialogue, 
  verse when prose expected, etc.)
- **Deployment fail** — reserved for passages that pass clinical review 
  but require pilot-exclusion (e.g., historically harmful language 
  requiring teacher framing)

## Applicability Across Primitives

This 4-question frame is universal. Classification-specific documents 
layer on top:

- **tone_misreading** — inherits 4 Qs + 21-term canonical vocabulary + 
  Richards Layer 3 framing
- **mood_misreading** — inherits 4 Qs + mood canonical vocabulary + 
  Richards Layer 2 framing
- **figurative_language_failure** — inherits 4 Qs + figurative taxonomy 
  (metaphor, simile, personification, hyperbole, etc.)
- **syntax_barrier** — inherits 4 Qs + syntactic complexity typology
- All 13 primitives inherit the same 4-Q frame

The accessibility principle (Q3) is the same for every primitive. The 
specific skill being assessed changes. The requirement that the skill be 
detectable using only passage content does not.

## Change Log

- **v1 (draft)** — April 20, 2026. Initial mood_misreading criteria. 4 
  questions but Q3 accessibility was implicit.
- **v2 (locked)** — April 22, 2026. Q3 accessibility elevated to primary 
  architectural criterion. Universal template for all 13 primitives. 
  Inferability rule formalized. Rejection taxonomy codified. Post tone 
  pipeline review surfacing schema-gating as cross-cutting failure mode.
