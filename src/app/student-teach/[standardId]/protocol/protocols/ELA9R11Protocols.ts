// ELA9R11Protocols.ts
// All four clinical intervention protocols for ELA.9.R.1.1 — Inferencing and Textual Evidence
// Grounded in: Swanson & Sachse-Lee (2001) — working memory and reading comprehension;
// Pressley et al. (1992) — explicit strategy instruction; Zwaan & Radvansky (1998) —
// situation model theory; Beck, McKeown & Kucan (2013) — vocabulary and comprehension.
// Each protocol maps to a diagnostic classification that identifies where the
// inferential chain broke during assessment.

import { Protocol } from '../types'

// ─────────────────────────────────────────────
// PROTOCOL 1: WORKING MEMORY OVERLOAD
// Trigger: comprehension_integration_failure, evidence_retrieval_failure
// Layer 3 — After-reading / Integration
// ─────────────────────────────────────────────
export const WorkingMemoryOverload: Protocol = {
  name: 'WorkingMemoryOverload',
  label: 'Working Memory Overload',
  triggerClassifications: ['comprehension_integration_failure', 'evidence_retrieval_failure'],
  layer: 3,
  cognitiveSkillTargeted: 'Inferencing — Working Memory Integration',
  researchBasis:
    'Swanson & Sachse-Lee (2001) — working memory capacity predicts inferencing success. ' +
    'Cain, Oakhill & Bryant (2004) — students with working memory deficits read accurately but ' +
    'fail to integrate meaning across sentence boundaries. ' +
    'Targeted chunking strategies restore inferential capacity without changing text difficulty.',
  steps: [
    {
      stepNumber: 1,
      name: 'Orientation',
      interactionType: 'read_only',
      scaffoldsActive: true,
      claudeGenerates: [
        'A 2–3 sentence orientation in Gogi\'s peer voice: names the destination (connecting two pieces of evidence from different parts of the text), explains that skilled readers use a mental notepad to hold information, and previews the exact sequence of today\'s work.',
        'Voice: warm, direct, zero academic jargon. Student knows exactly what they\'re about to do.',
      ],
      stepPurpose:
        'Frame the working memory challenge concretely before any cognitive work begins. Student must understand the destination — connecting two evidence pieces — before being asked to do it.',
      advancementCondition: 'Student taps Continue — no evaluation required.',
      masteryRelevant: false,
    },
    {
      stepNumber: 2,
      name: 'MicroModel',
      interactionType: 'read_only',
      scaffoldsActive: true,
      claudeGenerates: [
        'A think-aloud model applied to the current passage: Gogi reads paragraph 1, names the first piece of evidence and writes it on the "mental notepad." Reads to the second evidence location, names the second piece. Then reads both pieces back aloud and states the inference that connects them.',
        'Explicit narration: "I am now holding both pieces at the same time. Here is what they tell me together: ___."',
        'Highlights the simultaneity: student sees Gogi hold both pieces actively before connecting them.',
      ],
      stepPurpose:
        'Make the two-piece hold visible as a concrete cognitive act. Student observes the mental notepad strategy before attempting it.',
      advancementCondition: 'Student taps Continue — no evaluation required.',
      masteryRelevant: false,
    },
    {
      stepNumber: 3,
      name: 'GuidedPractice',
      interactionType: 'passage_annotation',
      scaffoldsActive: true,
      claudeGenerates: [
        'The passage text below a --- delimiter.',
        'Above the delimiter: Gogi instruction naming the exact locations of both evidence pieces (e.g., "Look at the third sentence and the last sentence — both carry information about what the character is feeling. Highlight both as Textual Evidence. Then write one sentence connecting what you found.").',
        'The student uses PassageAnnotator to highlight both pre-identified locations, tag each as Textual Evidence, and write a one-sentence explanation connecting them.',
      ],
      stepPurpose:
        'First active use of the mental notepad with both evidence locations given. Student focuses on tagging and connecting, not on finding evidence — maximum scaffold, minimum working memory load.',
      advancementCondition:
        'Student has highlighted both specified locations, tagged each as Textual Evidence, and written a connection sentence that references both pieces.',
      masteryRelevant: false,
    },
    {
      stepNumber: 4,
      name: 'SemiGuided',
      interactionType: 'passage_annotation',
      scaffoldsActive: true,
      claudeGenerates: [
        'The passage below a --- delimiter.',
        'Above the delimiter: Gogi gives one evidence location (e.g., "Start with the second paragraph — highlight the moment where something changes for the character"). Student must independently find the second piece.',
        'Prompt: "Now find a second piece of evidence from a different part of the passage that connects to what you just found. Highlight it, tag it as Textual Evidence, and write one sentence showing how they connect."',
      ],
      stepPurpose:
        'Scaffold fade — one evidence piece located, one retrieved independently. Tests whether the student can sustain the mental notepad strategy with partial support.',
      advancementCondition:
        'Student has located and tagged two pieces of evidence from different parts of the passage. Connection sentence references both and states what they reveal together.',
      masteryRelevant: false,
    },
    {
      stepNumber: 5,
      name: 'IndependentTask',
      interactionType: 'passage_annotation',
      scaffoldsActive: false,
      claudeGenerates: [
        'The passage below a --- delimiter.',
        'Above the delimiter: single Gogi prompt with no location hints — "Two pieces of evidence in this passage connect to the same inference. Find both, highlight them, tag each as Textual Evidence, and write the inference they create together."',
        'No pre-identified locations. No scaffold. Student runs the full mental notepad strategy independently.',
      ],
      stepPurpose:
        'Full independent evidence retrieval and integration. Both pieces must come from different parts of the passage with no hints.',
      advancementCondition:
        'Student identifies two textual evidence pieces from different passage locations and produces an inference that requires both simultaneously.',
      masteryRelevant: true,
    },
    {
      stepNumber: 6,
      name: 'MasteryCheck',
      interactionType: 'structured_response',
      scaffoldsActive: false,
      claudeGenerates: [
        'Structured JSON evaluation: { "theme_universal": <true if inference is explicit and specific — not a plot summary>, "evidence_relevant": <true if both evidence pieces directly support the inference>, "reasoning_explicit": <true if student explains HOW the two pieces connect>, "scaffolds_used": <true if student restated the Gogi prompt or used fill-in language>, "passed": <true only if all three content conditions are true AND scaffolds_used is false> }',
        'Feedback if not passed: names the exact breakdown. Did the student state only one piece of evidence? Did they state the inference without connecting the two pieces? Did they summarize instead of infer?',
        'Fake-out rejection: reject as non-mastery if response is: (1) copy-paste from passage, (2) blank or single word, (3) restatement of events without inference, (4) disconnected from the question, (5) incoherent, (6) sophisticated restatement disguised as inference, (7) evidence dropped with no connection stated, (8) generic claim applicable to any passage.',
      ],
      stepPurpose:
        'System mastery gate. evidence_relevant and reasoning_explicit are the critical conditions — both evidence pieces must be present and the connection must be explicit.',
      advancementCondition:
        'Student has pulled two pieces of evidence from different parts of the passage and connected them to one explicit inference. Scaffolds not used. Minimum one genuine attempt.',
      masteryRelevant: true,
    },
    {
      stepNumber: 7,
      name: 'TransferTask',
      interactionType: 'short_response',
      scaffoldsActive: false,
      claudeGenerates: [
        'A second inference question from the same passage, targeting a different implied meaning.',
        'Prompt: "Find two pieces of evidence from different parts of this passage. Write the inference they create together. No highlights this time — just your written response."',
        'No PassageAnnotator — full prose response required to confirm transfer.',
      ],
      stepPurpose:
        'Confirm transfer — student applies the two-piece mental notepad strategy to a new inference question from the same passage without annotation scaffolding.',
      advancementCondition:
        'Response contains two identifiable evidence references from different passage locations and an inference that requires both.',
      masteryRelevant: true,
    },
    {
      stepNumber: 8,
      name: 'ReassessTrigger',
      interactionType: 'read_only',
      scaffoldsActive: false,
      claudeGenerates: [
        'A 2-sentence mastery confirmation in Gogi\'s peer voice: names the specific mental notepad skill mastered and connects it to a real-world context where holding and connecting information gives this student real power.',
      ],
      stepPurpose: 'Close the protocol. Trigger reassessment routing.',
      advancementCondition: 'Automatic on TransferTask mastery.',
      masteryRelevant: false,
    },
  ],
  masteryConditions: {
    minimumAttempts: 1,
  },
  reclassificationTrigger: {
    attemptThreshold: 3,
    hintUnlockAttempt: 2,
    hint: "You do not need to hold the whole passage in your head at once — just two pieces. Read the first paragraph and write down the one most important detail. Then read the last paragraph and do the same. Now look at both notes. What do those two details tell you together that neither one tells you alone? That connection is the inference.",
    fallbackProtocol: 'ReadingStrategyFailure',
    clinicalRationale:
      'A student who cannot integrate evidence after two full working memory protocols may not have an active reading strategy at all — reading passively without constructing meaning as they go. Shift from memory-management training to strategy-first instruction.',
  },
}

// ─────────────────────────────────────────────
// PROTOCOL 2: READING STRATEGY FAILURE
// Trigger: no_metacognitive_strategy
// Layer 1 — Pre-reading / Metacognitive Strategy
// ─────────────────────────────────────────────
export const ReadingStrategyFailure: Protocol = {
  name: 'ReadingStrategyFailure',
  label: 'Reading Strategy Failure',
  triggerClassifications: ['no_metacognitive_strategy'],
  layer: 1,
  cognitiveSkillTargeted: 'Inferencing — Active Reading Strategy',
  researchBasis:
    'Pressley et al. (1992) — Transactional Strategies Instruction produces lasting comprehension gains. ' +
    'NRP (2000) — explicit strategy instruction is the most replicable reading intervention. ' +
    'Passive readers collect words without constructing logical relationships; ' +
    'the fix is strategy installation, not re-reading.',
  steps: [
    {
      stepNumber: 1,
      name: 'Orientation',
      interactionType: 'read_only',
      scaffoldsActive: true,
      claudeGenerates: [
        'A 2–3 sentence orientation in Gogi\'s peer voice: introduces the idea that reading for inference means building an argument while you read — every conclusion needs a "because." Names the three-part structure the student will learn: EVIDENCE → REASONING → CONCLUSION. Tells the student exactly what they will do today.',
        'Voice: direct, energetic, zero academic jargon. Student understands immediately why the strategy matters.',
      ],
      stepPurpose:
        'Frame passive reading as the problem and the three-part strategy as the solution before any cognitive work begins.',
      advancementCondition: 'Student taps Continue — no evaluation required.',
      masteryRelevant: false,
    },
    {
      stepNumber: 2,
      name: 'MicroModel',
      interactionType: 'read_only',
      scaffoldsActive: true,
      claudeGenerates: [
        'A fully worked three-part model applied to a short passage from the current text: (1) EVIDENCE — the exact quote or detail from the text. (2) REASONING — what that detail implies or suggests about the character, situation, or meaning. (3) CONCLUSION — the explicit inference stated as a complete sentence.',
        'Each part labeled and narrated in Gogi\'s voice: "This is the evidence. Now here is my reasoning — this is the step most readers skip. Now here is my conclusion."',
        'Second example showing a WRONG approach (skipping reasoning, jumping from evidence to conclusion), then the correction.',
      ],
      stepPurpose:
        'Make the three-part structure explicit and the reasoning step visible. Student sees both the correct move and the failure mode before attempting.',
      advancementCondition: 'Student taps Continue — no evaluation required.',
      masteryRelevant: false,
    },
    {
      stepNumber: 3,
      name: 'GuidedPractice',
      interactionType: 'fill_in',
      scaffoldsActive: true,
      claudeGenerates: [
        'A short passage (5–8 sentences) with the EVIDENCE and CONCLUSION pre-filled.',
        'Student writes only the REASONING step: "This shows ___ because ___."',
        'Sentence stem is active — student cannot skip the reasoning.',
        'Feedback: does the reasoning explain the connection between the evidence and the conclusion, or does it just restate the evidence?',
      ],
      stepPurpose:
        'Isolated reasoning practice with maximum scaffold. Evidence and conclusion given — student focuses only on constructing the reasoning bridge. This is the step most students skip.',
      advancementCondition:
        'Reasoning step explains the connection between evidence and conclusion. Does not restate the evidence. Does not repeat the conclusion.',
      masteryRelevant: false,
    },
    {
      stepNumber: 4,
      name: 'SemiGuided',
      interactionType: 'fill_in',
      scaffoldsActive: true,
      claudeGenerates: [
        'A new short passage. EVIDENCE pre-filled. Student writes both REASONING and CONCLUSION independently.',
        'Template: "EVIDENCE: [pre-filled] | REASONING: ___ | CONCLUSION: ___"',
        'Reasoning sentence stem removed. Student must generate the bridge independently.',
        'Feedback on whether the conclusion follows logically from the reasoning, not just from the evidence.',
      ],
      stepPurpose:
        'Scaffold fade — evidence given, reasoning and conclusion generated independently. Tests whether the student has internalized the three-part structure.',
      advancementCondition:
        'Conclusion is an explicit inference that requires the reasoning step — not a restatement of the evidence.',
      masteryRelevant: false,
    },
    {
      stepNumber: 5,
      name: 'IndependentTask',
      interactionType: 'short_response',
      scaffoldsActive: false,
      claudeGenerates: [
        'A new passage. Single prompt: "Use your three-part strategy. Find evidence, explain your reasoning, and state your conclusion."',
        'No template. No sentence stems. No pre-filled sections. Student executes the full strategy from memory.',
      ],
      stepPurpose:
        'Full independent application of the three-part strategy. All three components must be self-generated in a single coherent response.',
      advancementCondition:
        'Response contains identifiable evidence, explicit reasoning, and a conclusion. Reasoning step is present and connects the evidence to the conclusion.',
      masteryRelevant: true,
    },
    {
      stepNumber: 6,
      name: 'MasteryCheck',
      interactionType: 'structured_response',
      scaffoldsActive: false,
      claudeGenerates: [
        'Structured JSON evaluation: { "theme_universal": <true if the conclusion is an explicit inference — not a plot summary or topic restatement>, "evidence_relevant": <true if the evidence directly supports the stated conclusion>, "reasoning_explicit": <true if the student wrote a visible reasoning step connecting evidence to conclusion>, "scaffolds_used": <true if student used the fill-in template or restated the Gogi prompt>, "passed": <true only if all three content conditions are true AND scaffolds_used is false> }',
        'Feedback if not passed: names the exact breakdown point in the three-part sequence. Did the student skip reasoning? Did the conclusion not follow from the evidence? Did the student summarize instead of infer?',
        'Fake-out rejection: reject as non-mastery if response is: (1) copy-paste from passage, (2) blank or single word, (3) restatement without reasoning, (4) disconnected from the inference task, (5) incoherent, (6) sophisticated restatement disguised as inference, (7) evidence cited with no reasoning step, (8) generic claim applicable to any passage.',
      ],
      stepPurpose:
        'System mastery gate. reasoning_explicit is the critical condition — this protocol specifically targets the reasoning step that passive readers omit.',
      advancementCondition:
        'Student has produced explicit evidence, reasoning step, and conclusion in logical sequence. Scaffolds not used.',
      masteryRelevant: true,
    },
    {
      stepNumber: 7,
      name: 'TransferTask',
      interactionType: 'short_response',
      scaffoldsActive: false,
      claudeGenerates: [
        'A second inference question from the same passage targeting a different implied meaning.',
        'Prompt: "Apply your strategy to this new question. Evidence → Reasoning → Conclusion. Write all three."',
        'No template visible. Student must recall and apply the structure independently.',
      ],
      stepPurpose:
        'Transfer confirmation — student applies the three-part strategy to a second inference question without any template or scaffold visible.',
      advancementCondition:
        'All three mastery conditions met on a new inference question: evidence cited, reasoning explicit, conclusion follows logically.',
      masteryRelevant: true,
    },
    {
      stepNumber: 8,
      name: 'ReassessTrigger',
      interactionType: 'read_only',
      scaffoldsActive: false,
      claudeGenerates: [
        'A 2-sentence mastery confirmation in Gogi\'s peer voice: names the specific reasoning strategy mastered and connects it to a real-world context — a moment outside school where having that reasoning step gives this student actual power.',
      ],
      stepPurpose: 'Close the protocol. Trigger reassessment routing.',
      advancementCondition: 'Automatic on TransferTask mastery.',
      masteryRelevant: false,
    },
  ],
  masteryConditions: {
    minimumAttempts: 1,
  },
  reclassificationTrigger: {
    attemptThreshold: 3,
    hintUnlockAttempt: 2,
    hint: "Your conclusion needs a 'because' before it can be an inference. Write your evidence first — just the exact words from the text. Then ask: what does this detail tell me that the author never directly says? Write THAT as your conclusion. Then write one sentence connecting the two: 'This evidence shows ___ because ___.' That middle sentence is your reasoning.",
    fallbackProtocol: 'SituationModelFailure',
    clinicalRationale:
      'A student who cannot produce a reasoning step after two full strategy cycles may lack a coherent mental model of the passage itself — they have no material to reason from. Shift to situation model construction before re-attempting strategy instruction.',
  },
}

// ─────────────────────────────────────────────
// PROTOCOL 3: SITUATION MODEL FAILURE
// Trigger: inferencing_deficit, abstract_reasoning_deficit, schema_deficit
// Layer 3 — After-reading / Mental Model
// ─────────────────────────────────────────────
export const SituationModelFailure: Protocol = {
  name: 'SituationModelFailure',
  label: 'Situation Model Failure',
  triggerClassifications: ['inferencing_deficit', 'abstract_reasoning_deficit', 'schema_deficit'],
  layer: 3,
  cognitiveSkillTargeted: 'Inferencing — Situation Model Construction',
  researchBasis:
    'Zwaan & Radvansky (1998) — situation model theory: skilled readers construct an integrated mental representation tracking characters, causality, space, and time. ' +
    'Cain & Oakhill (1999) — poor comprehenders process sentences individually without building an integrated passage model. ' +
    'Explicit situation model tracking restores inferential capacity by giving students a structure for their mental representation.',
  steps: [
    {
      stepNumber: 1,
      name: 'Orientation',
      interactionType: 'read_only',
      scaffoldsActive: true,
      claudeGenerates: [
        'A 2–3 sentence orientation in Gogi\'s peer voice: introduces the mental movie concept — good readers build a picture in their head of who is involved, what just changed, and why it matters, and they update it as they read. Names the three tracker categories: WHO, WHAT CHANGED, WHY. Previews what the student will do today.',
        'Voice: concrete, direct, no academic language. Makes the mental movie feel accessible and powerful.',
      ],
      stepPurpose:
        'Frame situation model construction as a natural skill (building a mental movie) before the student attempts it explicitly.',
      advancementCondition: 'Student taps Continue — no evaluation required.',
      masteryRelevant: false,
    },
    {
      stepNumber: 2,
      name: 'MicroModel',
      interactionType: 'read_only',
      scaffoldsActive: true,
      claudeGenerates: [
        'A think-aloud walk through the passage in three sections. At each section boundary Gogi pauses and updates the mental movie tracker explicitly: "WHO: still the same character, but now we know she feels ___.  WHAT CHANGED: she used to ___, now she ___. WHY: because ___."',
        'After all three sections: Gogi states the inference that the completed tracker makes possible — "With that full picture built, I can now say: ___, even though the author never directly says it."',
        'Explicit narration: "I did not wait until the end to understand. I kept updating as I read."',
      ],
      stepPurpose:
        'Make the situation model update process visible and concrete. Student sees the tracker being built incrementally across the passage before attempting it themselves.',
      advancementCondition: 'Student taps Continue — no evaluation required.',
      masteryRelevant: false,
    },
    {
      stepNumber: 3,
      name: 'GuidedPractice',
      interactionType: 'drag_and_drop',
      scaffoldsActive: true,
      claudeGenerates: [
        'A single Gogi instruction line above the --- delimiter: "Sort these ideas into the three parts of your mental movie. Drag each one into the category where it belongs."',
        'Below the --- delimiter, output EXACTLY this two-line format — nothing else:\nITEMS: [6–9 passage-specific ideas, details, and turning points from the passage, each a short phrase of 3–8 words, separated by | pipes]\nCATEGORIES: WHO | WHAT CHANGED | WHY',
        'Items must be concrete, passage-specific phrases drawn from the current passage. The three category labels are always exactly WHO, WHAT CHANGED, and WHY — do not alter them.',
      ],
      stepPurpose:
        'First active use of the situation model tracker with pre-extracted items. Student practices categorization without the cognitive load of evidence retrieval.',
      advancementCondition:
        'All items assigned. WHO category contains character/agent information, WHAT CHANGED contains a state or action shift, WHY contains a causal explanation.',
      masteryRelevant: false,
    },
    {
      stepNumber: 4,
      name: 'SemiGuided',
      interactionType: 'passage_annotation',
      scaffoldsActive: true,
      claudeGenerates: [
        'The passage below a --- delimiter.',
        'Above the delimiter: Gogi instruction — "Find the moments in this passage where something shifts — a character\'s feeling, a choice, or a turning point. Highlight each shift. Tag it as Supporting Detail if it shows what changed, or Textual Evidence if it shows why the change happened. Then write one sentence below each highlight explaining what it adds to your mental movie."',
        'Student identifies their own checkpoints rather than sorting pre-extracted items — partial retrieval scaffold.',
      ],
      stepPurpose:
        'Scaffold fade — student locates their own situation model checkpoints rather than sorting pre-extracted items. Tests whether the tracker structure has been internalized.',
      advancementCondition:
        'Student identifies at least two passage moments, tags them correctly, and annotates each with what it adds to the mental movie.',
      masteryRelevant: false,
    },
    {
      stepNumber: 5,
      name: 'IndependentTask',
      interactionType: 'structured_response',
      scaffoldsActive: false,
      claudeGenerates: [
        'Structured response prompt with four fields:',
        'WHO: [Who is this about and what do we know about them by the end?]',
        'WHAT CHANGED: [What shifted for this character between the start and end of the passage?]',
        'WHY: [What caused or drove that change?]',
        'CLAIM: [Write one inference the text implies but never directly states — something your completed mental movie makes possible.]',
        'No items pre-extracted. No annotation. Student builds the full model and uses it to produce an inference independently.',
      ],
      stepPurpose:
        'Full independent situation model construction and inference. All four fields must be self-generated and the CLAIM must require the WHO/WHAT CHANGED/WHY tracker to be possible.',
      advancementCondition:
        'Student has tracked a character or causal chain across the full passage and used it to produce a claim the text implies but never directly states.',
      masteryRelevant: true,
    },
    {
      stepNumber: 6,
      name: 'MasteryCheck',
      interactionType: 'structured_response',
      scaffoldsActive: false,
      claudeGenerates: [
        'Structured JSON evaluation: { "theme_universal": <true if the CLAIM field contains an explicit inference that goes beyond plot summary>, "evidence_relevant": <true if WHO, WHAT CHANGED, and WHY fields contain passage-specific content that directly supports the CLAIM>, "reasoning_explicit": <true if the tracker fields and CLAIM are logically connected — the CLAIM follows from the completed model>, "scaffolds_used": <true if student restated the field labels or used fill-in language from the Gogi prompt>, "passed": <true only if all three content conditions are true AND scaffolds_used is false> }',
        'Feedback if not passed: names which tracker field is missing, vague, or disconnected from the CLAIM. Directs the student back to the specific field that broke the model.',
        'Fake-out rejection: reject as non-mastery if response is: (1) copy-paste from passage, (2) any field left blank or filled with a single word, (3) CLAIM is a plot restatement not an inference, (4) WHO/WHAT CHANGED/WHY fields are disconnected from each other, (5) incoherent, (6) sophisticated restatement disguised as inference, (7) CLAIM stated without any connection to the tracker fields, (8) generic inference applicable to any passage.',
      ],
      stepPurpose:
        'System mastery gate. All four fields must be present and connected — the CLAIM must be shown to emerge from the completed model.',
      advancementCondition:
        'Student has tracked a character or causal chain across the full passage and used it to support a claim that requires the complete mental model.',
      masteryRelevant: true,
    },
    {
      stepNumber: 7,
      name: 'TransferTask',
      interactionType: 'short_response',
      scaffoldsActive: false,
      claudeGenerates: [
        'A second claim question from the same passage targeting a different implied meaning.',
        'Prompt: "Apply your mental movie. Build the WHO, WHAT CHANGED, and WHY — then write the inference those three pieces make possible. Prose response only."',
        'No structured fields visible. Student reconstructs the model mentally and produces the inference as prose.',
      ],
      stepPurpose:
        'Transfer confirmation — student applies the situation model strategy to a new claim question without the four-field scaffold visible.',
      advancementCondition:
        'Response contains identifiable character/causal tracking and an inference that requires that tracking.',
      masteryRelevant: true,
    },
    {
      stepNumber: 8,
      name: 'ReassessTrigger',
      interactionType: 'read_only',
      scaffoldsActive: false,
      claudeGenerates: [
        'A 2-sentence mastery confirmation in Gogi\'s peer voice: names the mental movie skill mastered and connects it to a real-world moment where building a complete picture of a situation — not just collecting facts — gives this student actual power.',
      ],
      stepPurpose: 'Close the protocol. Trigger reassessment routing.',
      advancementCondition: 'Automatic on TransferTask mastery.',
      masteryRelevant: false,
    },
  ],
  masteryConditions: {
    minimumAttempts: 1,
  },
  reclassificationTrigger: {
    attemptThreshold: 3,
    hintUnlockAttempt: 2,
    hint: "Stop reading the whole passage and just focus on one moment: find the sentence where something changes for the character — what they do, say, feel, or decide. Write down what changed. Then ask: why did that change happen? Write down the cause. Now look at both answers. What do they tell you together that the author never directly says? That is your inference.",
    fallbackProtocol: 'WorkingMemoryOverload',
    clinicalRationale:
      'A student who cannot construct a situation model after two attempts may be attempting to hold the model but losing pieces as they read — a working memory management problem rather than a model-building deficit. Shift to explicit working memory chunking strategies.',
  },
}

// ─────────────────────────────────────────────
// PROTOCOL 4: VOCABULARY GAP
// Trigger: vocabulary_gap, vocabulary_gap_connotative, morphology_gap, syntax_barrier
// Layer 2 — During-reading / Vocabulary
// ─────────────────────────────────────────────
export const VocabularyGap: Protocol = {
  name: 'VocabularyGap',
  label: 'Vocabulary Gap',
  triggerClassifications: [
    'vocabulary_gap',
    'vocabulary_gap_connotative',
    'morphology_gap',
    'syntax_barrier',
  ],
  layer: 2,
  cognitiveSkillTargeted: 'Inferencing — Vocabulary',
  researchBasis:
    'Beck, McKeown & Kucan (2013) — Tier 2 vocabulary as comprehension gateway. ' +
    'Graves (2006) — context clue instruction is the highest-leverage vocabulary intervention. ' +
    'Nation (2001) — 98% vocabulary coverage threshold for independent comprehension. ' +
    'When unknown words block sentence-level meaning, the inferential chain breaks before higher-order processing begins.',
  steps: [
    {
      stepNumber: 1,
      name: 'Orientation',
      interactionType: 'read_only',
      scaffoldsActive: true,
      claudeGenerates: [
        'A 2–3 sentence orientation in Gogi\'s peer voice: frames vocabulary as a detective skill — the passage always leaves clues about what unknown words mean. Names the clue types the student will learn to spot. Previews today\'s sequence.',
        'Voice: confident, direct, zero jargon. Student feels like they are gaining a detection superpower, not studying vocabulary.',
      ],
      stepPurpose:
        'Frame context clue reading as active detective work rather than passive word-guessing before any cognitive work begins.',
      advancementCondition: 'Student taps Continue — no evaluation required.',
      masteryRelevant: false,
    },
    {
      stepNumber: 2,
      name: 'MicroModel',
      interactionType: 'read_only',
      scaffoldsActive: true,
      claudeGenerates: [
        'A five-step context clue hunt modeled explicitly on a sentence from the current passage: (1) Spot the unknown word. (2) Read the sentence before it. (3) Read the sentence after it. (4) Look for examples, synonyms, antonyms, or explanatory phrases nearby. (5) Name the clue type (synonym clue, contrast clue, example clue, definition clue, inference clue) and state the derived meaning.',
        'A second example applying the same five steps to a different sentence — faster pace, same structure.',
        'Explicit narration: "The word is hard but the passage gives it away if you look in the right place."',
      ],
      stepPurpose:
        'Make the five-step context clue process explicit and concrete before student attempts it. Student sees two complete cycles before their first try.',
      advancementCondition: 'Student taps Continue — no evaluation required.',
      masteryRelevant: false,
    },
    {
      stepNumber: 3,
      name: 'GuidedPractice',
      interactionType: 'passage_annotation',
      scaffoldsActive: true,
      claudeGenerates: [
        'The passage below a --- delimiter, with the unknown word identified for the student.',
        'Above the delimiter: Gogi instruction naming the target word and pointing to the exact sentence containing the clue (e.g., "Look at the sentence right after the word \'furtive\' appears — the author gives it away. Highlight the clue, tag it as Context Clue, and write what the word means based on that clue.").',
        'Student uses PassageAnnotator to highlight the specific clue sentence, tag it as Context Clue, and write the derived meaning.',
      ],
      stepPurpose:
        'First active context clue hunt with both the unknown word and the clue location identified. Student focuses on clue recognition and meaning derivation, not clue searching.',
      advancementCondition:
        'Student has highlighted the correct clue location, tagged it as Context Clue, and derived a meaning that is consistent with the identified clue.',
      masteryRelevant: false,
    },
    {
      stepNumber: 4,
      name: 'SemiGuided',
      interactionType: 'passage_annotation',
      scaffoldsActive: true,
      claudeGenerates: [
        'The passage below a --- delimiter.',
        'Above the delimiter: Gogi names the unknown word only. No clue location given.',
        'Prompt: "Find the clue or clues the author left near this word. Highlight each one, tag it as Context Clue, and write what the word means based on what you found."',
        'Student must locate clues independently — maximum two unknowns to ensure focus.',
      ],
      stepPurpose:
        'Scaffold fade — unknown word named, clue location not given. Student runs the full five-step search independently for the first time.',
      advancementCondition:
        'Student locates at least one valid context clue, tags it correctly, and derives a meaning that is defensible based on the clue found.',
      masteryRelevant: false,
    },
    {
      stepNumber: 5,
      name: 'IndependentTask',
      interactionType: 'passage_annotation',
      scaffoldsActive: false,
      claudeGenerates: [
        'A new sentence or short passage containing an unfamiliar word.',
        'Above the --- delimiter: single Gogi prompt — "You will find an unfamiliar word in this passage. Find the clues the author left, highlight them, tag each as Context Clue, and explain the word\'s meaning."',
        'No word identified. No location given. Student runs the full detection strategy start to finish.',
      ],
      stepPurpose:
        'Full independent context clue detection and meaning derivation. Student must identify the unfamiliar word, locate the clues, and explain the meaning without any prompting.',
      advancementCondition:
        'Student identifies an unfamiliar word independently, locates specific context clues, and derives a meaning that is logically consistent with those clues.',
      masteryRelevant: true,
    },
    {
      stepNumber: 6,
      name: 'MasteryCheck',
      interactionType: 'structured_response',
      scaffoldsActive: false,
      claudeGenerates: [
        'Structured response prompt with four fields: UNKNOWN WORD | CONTEXT CLUES FOUND | CLUE TYPE | MEANING.',
        'Structured JSON evaluation: { "theme_universal": <true if the MEANING field contains a logical derivation — not a dictionary definition or guess>, "evidence_relevant": <true if CONTEXT CLUES FOUND contains specific text from the passage that actually supports the stated meaning>, "reasoning_explicit": <true if the student names the CLUE TYPE and explains how the clue leads to the meaning>, "scaffolds_used": <true if student used guess language, said "I think" without evidence, or left any field blank>, "passed": <true only if all three content conditions are true AND scaffolds_used is false> }',
        'Feedback if not passed: names which of the four fields broke down and why. Did the student find the wrong clue? Did they name a clue type that does not match what they highlighted? Did they guess a meaning without connecting it to the clue?',
        'Fake-out rejection: reject as non-mastery if: (1) meaning is a dictionary definition not derived from context, (2) any field is blank, (3) clue cited does not logically support the stated meaning, (4) clue type label does not match the actual clue, (5) incoherent, (6) sophisticated-sounding guess with no clue evidence, (7) clue identified but no connection to meaning stated, (8) generic meaning that could apply to any context.',
      ],
      stepPurpose:
        'System mastery gate. All four fields must be present and logically connected — the meaning must be shown to emerge from the specific clue found.',
      advancementCondition:
        'Student has identified specific context clues and used them to correctly derive word meaning with the clue-to-meaning connection made explicit.',
      masteryRelevant: true,
    },
    {
      stepNumber: 7,
      name: 'TransferTask',
      interactionType: 'short_response',
      scaffoldsActive: false,
      claudeGenerates: [
        'A second unfamiliar word from the same or a new sentence.',
        'Prompt: "Apply your context clue strategy. Find the clue, name the type, derive the meaning. Prose response — no fields this time."',
        'No structured fields. Student reconstructs the strategy from memory and applies it as prose.',
      ],
      stepPurpose:
        'Transfer confirmation — student applies the context clue strategy to a second unfamiliar word without the four-field scaffold visible.',
      advancementCondition:
        'Response names a specific clue from the text, identifies the clue type, and derives a meaning that is consistent with the clue.',
      masteryRelevant: true,
    },
    {
      stepNumber: 8,
      name: 'ReassessTrigger',
      interactionType: 'read_only',
      scaffoldsActive: false,
      claudeGenerates: [
        'A 2-sentence mastery confirmation in Gogi\'s peer voice: names the specific context clue skill mastered and connects it to a real-world moment — a contract, a job application, a legal document, a news story — where being able to decode unfamiliar language gives this student actual power.',
      ],
      stepPurpose: 'Close the protocol. Trigger reassessment routing.',
      advancementCondition: 'Automatic on TransferTask mastery.',
      masteryRelevant: false,
    },
  ],
  masteryConditions: {
    minimumAttempts: 1,
  },
  reclassificationTrigger: {
    attemptThreshold: 3,
    hintUnlockAttempt: 2,
    hint: "Do not try to figure out the word alone — use the sentences around it. Read the sentence right before the unknown word. Read the sentence right after it. Now ask: is there a word nearby that means almost the same thing? Is there an example that shows what it means? Is there a contrast that shows what it is NOT? Find one of those three things and you have your clue. Circle it, then write what the word must mean.",
    fallbackProtocol: 'SituationModelFailure',
    clinicalRationale:
      'A student who cannot derive meaning from context clues after two full cycles may have a broader comprehension gap — vocabulary access is failing not just at the word level but at the level of sentence and passage understanding. Shift to situation model construction to rebuild global text meaning before re-attempting vocabulary strategies.',
  },
}
