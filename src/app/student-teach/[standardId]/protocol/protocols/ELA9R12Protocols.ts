// ELA9R12Protocols.ts
// All six clinical intervention protocols for ELA.9.R.1.2 — Universal Themes
// Grounded in: Scarborough (2001), Anderson & Pearson (1984), Beck et al. (2013),
// Graesser et al. (1994), Van den Broek (1990), VanLehn (2011), Anderson et al. (1995)
// Each protocol maps directly to the GOGI Precision Protocols document

import { Protocol } from '../types'

// ─────────────────────────────────────────────
// PROTOCOL 1: THEME CONCEPT-BUILDING
// Trigger: schema_deficit, topic_only
// Layer 1 — Pre-reading / Schema Activation
// ─────────────────────────────────────────────
export const ThemeConceptBuilding: Protocol = {
  name: 'ThemeConceptBuilding',
  label: 'Theme Concept-Building',
  triggerClassifications: ['schema_deficit', 'topic_only'],
  layer: 1,
  cognitiveSkillTargeted: 'Schema Activation',
  researchBasis:
    'Anderson & Pearson (1984); Bransford & Johnson (1972); Hattan et al. (2024). ' +
    'Schema activation before reading is the primary predictor of comprehension. ' +
    'Students must hold the concept of universal theme as a schema before they can identify it in text.',
  steps: [
    {
      stepNumber: 1,
      name: 'Orientation',
      interactionType: 'read_only',
      scaffoldsActive: true,
      claudeGenerates: [
        'A 3-sentence orientation naming: (1) the destination skill, (2) why it matters in real life, (3) the exact sequence of what the student will do today'
      ],
      stepPurpose:
        'Frame the intervention. Student must know where they are going and why before cognitive work begins.',
      advancementCondition: 'Student taps Continue — no evaluation required.',
      masteryRelevant: false,
    },
    {
      stepNumber: 2,
      name: 'MicroModel',
      interactionType: 'read_only',
      scaffoldsActive: true,
      claudeGenerates: [
        'Three side-by-side examples contrasting TOPIC vs UNIVERSAL THEME, using familiar non-school contexts: a movie, a song, and a real-life scenario.',
        'A one-sentence rule: "A theme is never a word. It is a sentence that says something true about all people."',
      ],
      stepPurpose:
        'Build the schema for universal theme as a concept. Student must see the topic/theme distinction modeled before attempting it.',
      advancementCondition: 'Student taps Continue — no evaluation required.',
      masteryRelevant: false,
    },
    {
      stepNumber: 3,
      name: 'GuidedPractice',
      interactionType: 'multiple_choice',
      scaffoldsActive: true,
      claudeGenerates: [
        'Three multiple choice questions presenting a topic word and asking the student to select the correct universal theme from four options.',
        'Each wrong option represents a predictable error: too vague, still a topic, or a plot summary.',
        'After each selection, feedback that names the error type and explains the principle — never gives the answer directly.',
      ],
      stepPurpose:
        'First active application of the topic/theme distinction with full scaffold support. Multiple choice reduces cognitive load while requiring discrimination.',
      advancementCondition: '2 out of 3 correct with no more than one hint used per question.',
      masteryRelevant: false,
    },
    {
      stepNumber: 4,
      name: 'SemiGuided',
      interactionType: 'fill_in',
      scaffoldsActive: true,
      claudeGenerates: [
        'Two fill-in frames: "The topic of this story is ___. The theme of this story is ___." Applied to a short passage (4–6 sentences).',
        'Sentence stem provided for the theme: "This story suggests that ___."',
        'Feedback on student completion that evaluates universality — is this true for all people or just for this character?',
      ],
      stepPurpose:
        'Transition from recognition (multiple choice) to production with partial scaffold. Student generates a theme statement but frame reduces working memory load.',
      advancementCondition: 'Theme statement is a full sentence making a universal claim. Topic field is correctly distinct from theme.',
      masteryRelevant: false,
    },
    {
      stepNumber: 5,
      name: 'IndependentTask',
      interactionType: 'short_response',
      scaffoldsActive: false,
      claudeGenerates: [
        'A fresh short passage (6–10 sentences) from the Gutenberg library on a different topic.',
        'Single prompt: "What is the universal theme of this passage? Write one sentence."',
        'No sentence stem. No frame. No examples visible.',
      ],
      stepPurpose:
        'First fully independent production. Scaffolds removed. Student must generate universal theme from scratch.',
      advancementCondition:
        'Theme is a full sentence. Theme makes a claim applicable beyond this specific story. Topic is not restated as theme.',
      masteryRelevant: true,
    },
    {
      stepNumber: 6,
      name: 'MasteryCheck',
      interactionType: 'structured_response',
      scaffoldsActive: false,
      claudeGenerates: [
        'Evaluation of the independent task response against mastery conditions.',
        'Structured JSON: { theme_universal, evidence_relevant, reasoning_explicit, scaffolds_used }',
        'If not mastered: feedback naming exactly which condition failed and why, without supplying the correct answer.',
      ],
      stepPurpose:
        'System evaluates mastery against explicit criteria. Claude returns JSON. System makes the call.',
      advancementCondition: 'theme_universal = true AND scaffolds_used = false.',
      masteryRelevant: true,
    },
    {
      stepNumber: 7,
      name: 'TransferTask',
      interactionType: 'structured_response',
      scaffoldsActive: false,
      claudeGenerates: [
        'A second fresh passage, higher difficulty.',
        'Prompt: "State the universal theme. Select one piece of evidence. Explain how it supports your theme."',
      ],
      stepPurpose:
        'Confirm transfer — student can apply the skill to an unseen text at higher difficulty without any scaffold.',
      advancementCondition:
        'All three mastery conditions met: theme_universal, evidence_relevant, reasoning_explicit. scaffolds_used = false.',
      masteryRelevant: true,
    },
    {
      stepNumber: 8,
      name: 'ReassessTrigger',
      interactionType: 'read_only',
      scaffoldsActive: false,
      claudeGenerates: [
        'A 2-sentence mastery confirmation in Gogi\'s voice naming the specific skill mastered and connecting it to real-world academic power.',
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
    hint: "The theme is never the topic — it's what the topic teaches everyone. Instead of writing what the story is about, write what it says about all people. Try this frame: 'People often discover _____ when they face _____.' Fill in both blanks using what happens in this passage.",
    fallbackProtocol: 'ThemeHuntingStrategy',
    clinicalRationale:
      'A student who cannot discriminate topic from theme after two full concept-building cycles may lack the metacognitive strategy to approach theme identification systematically, not just the concept itself. Shift to strategy instruction.',
  },
}

// ─────────────────────────────────────────────
// PROTOCOL 2: THEME-HUNTING STRATEGY
// Trigger: no_metacognitive_strategy
// Layer 1 — Pre-reading / Metacognitive Strategy
// ─────────────────────────────────────────────
export const ThemeHuntingStrategy: Protocol = {
  name: 'ThemeHuntingStrategy',
  label: 'Theme-Hunting Strategy',
  triggerClassifications: ['no_metacognitive_strategy'],
  layer: 1,
  cognitiveSkillTargeted: 'Metacognitive Strategy',
  researchBasis:
    'Pressley et al. (1992); NRP (2000); Sweller (1988) — CLT scaffold-fade. ' +
    'Students who are taught to monitor their own strategy use transfer it more reliably than students who are not prompted to reflect.',
  steps: [
    {
      stepNumber: 1,
      name: 'Orientation',
      interactionType: 'read_only',
      scaffoldsActive: true,
      claudeGenerates: [
        '3-sentence orientation naming: the 4-step theme-hunting protocol, why having a strategy matters, and what the student will be able to do at the end.',
      ],
      stepPurpose: 'Frame the strategy as a tool the student will own permanently.',
      advancementCondition: 'Student taps Continue.',
      masteryRelevant: false,
    },
    {
      stepNumber: 2,
      name: 'MicroModel',
      interactionType: 'read_only',
      scaffoldsActive: true,
      claudeGenerates: [
        'Full think-aloud model of the 4-step theme-hunting protocol applied to a short known passage: (1) What does the main character want and what stands in the way? (2) What does the character learn or lose? (3) What does this say about life or human nature? (4) State the theme as a full sentence.',
        'Each step narrated explicitly in Gogi\'s voice. Student watches the cognitive moves happen in sequence.',
      ],
      stepPurpose:
        'Explicit strategy modeling before student attempts. Pressley (1992): students must see the strategy executed before they can execute it independently.',
      advancementCondition: 'Student taps Continue.',
      masteryRelevant: false,
    },
    {
      stepNumber: 3,
      name: 'GuidedPractice',
      interactionType: 'fill_in',
      scaffoldsActive: true,
      claudeGenerates: [
        'Short passage (6–8 sentences) with a full 4-step template. Each step has a guided prompt inside it.',
        'Step 1: "The character wants ___ but ___ stands in the way."',
        'Step 2: "By the end, the character learns/loses ___."',
        'Step 3: "This suggests that people in general ___."',
        'Step 4: "The theme is: ___."',
        'Feedback on each step before student proceeds to next.',
      ],
      stepPurpose:
        'First full execution of the strategy with complete scaffold. Every step supported. CLT: full schema acquisition before reduction.',
      advancementCondition: 'All 4 steps completed. Step 4 produces a universal theme sentence.',
      masteryRelevant: false,
    },
    {
      stepNumber: 4,
      name: 'SemiGuided',
      interactionType: 'fill_in',
      scaffoldsActive: true,
      claudeGenerates: [
        'New passage. Template with headers only — no guided prompts inside each step.',
        'Student sees: Step 1: ___ / Step 2: ___ / Step 3: ___ / Step 4: ___',
        'Feedback on theme statement only.',
      ],
      stepPurpose:
        'Scaffold fade — Sweller (1988). Headers only. Student must recall what each step requires without being told.',
      advancementCondition: 'Step 4 theme is universal and sentence-length.',
      masteryRelevant: false,
    },
    {
      stepNumber: 5,
      name: 'IndependentTask',
      interactionType: 'short_response',
      scaffoldsActive: false,
      claudeGenerates: [
        'New passage. Single prompt: "Use your strategy. What is the universal theme?"',
        'No template. No headers. No hints.',
      ],
      stepPurpose: 'Full independent application. No scaffold visible.',
      advancementCondition: 'Universal theme stated as a full sentence.',
      masteryRelevant: true,
    },
    {
      stepNumber: 6,
      name: 'MasteryCheck',
      interactionType: 'structured_response',
      scaffoldsActive: false,
      claudeGenerates: [
        'Structured JSON evaluation: { theme_universal, evidence_relevant, reasoning_explicit, scaffolds_used }',
        'If not mastered: specific feedback on which step in the strategy likely broke down.',
      ],
      stepPurpose: 'System mastery evaluation.',
      advancementCondition: 'theme_universal = true AND scaffolds_used = false.',
      masteryRelevant: true,
    },
    {
      stepNumber: 7,
      name: 'TransferTask',
      interactionType: 'structured_response',
      scaffoldsActive: false,
      claudeGenerates: [
        'New passage, higher difficulty.',
        'Prompt: "State the universal theme. Select one piece of evidence. Explain how it supports your theme."',
      ],
      stepPurpose: 'Transfer confirmation at higher difficulty.',
      advancementCondition: 'All mastery conditions met.',
      masteryRelevant: true,
    },
    {
      stepNumber: 8,
      name: 'ReassessTrigger',
      interactionType: 'read_only',
      scaffoldsActive: false,
      claudeGenerates: [
        'Mastery confirmation in Gogi\'s voice. Names the strategy mastered. Connects to academic power.',
      ],
      stepPurpose: 'Close protocol. Trigger reassessment.',
      advancementCondition: 'Automatic.',
      masteryRelevant: false,
    },
  ],
  masteryConditions: { minimumAttempts: 1 },
  reclassificationTrigger: {
    attemptThreshold: 3,
    hintUnlockAttempt: 2,
    hint: "Look for the moment in the passage where everything changes for the character — what they do, say, or realize that they couldn't at the start. That turning point is usually where the theme lives. What changed for this character, and what does that change say about people in general?",
    fallbackProtocol: 'ThemeConceptBuilding',
    clinicalRationale:
      'A student failing strategy instruction after two attempts may not have the underlying theme concept itself. Drop back to concept-building before re-attempting strategy.',
  },
}

// ─────────────────────────────────────────────
// PROTOCOL 3: CONNOTATIVE LANGUAGE
// Trigger: vocabulary_gap_connotative, vocabulary_gap
// Layer 2 — During-reading / Vocabulary
// ─────────────────────────────────────────────
export const ConnotativeLanguage: Protocol = {
  name: 'ConnotativeLanguage',
  label: 'Connotative Language',
  triggerClassifications: ['vocabulary_gap_connotative', 'vocabulary_gap'],
  layer: 2,
  cognitiveSkillTargeted: 'Vocabulary — Connotation',
  researchBasis:
    'Beck, McKeown & Kucan (2013) — Tier 2 vocabulary as comprehension gateway. ' +
    'Nation (2001) — 98% vocabulary coverage threshold for independent comprehension. ' +
    'Connotative blindness is the most common Layer 2 failure on literary theme items.',
  steps: [
    {
      stepNumber: 1,
      name: 'Orientation',
      interactionType: 'read_only',
      scaffoldsActive: true,
      claudeGenerates: [
        'Orientation: "Authors choose words on purpose. The words they pick — not just what the words mean, but what they feel like — point directly at the theme. Today you\'re going to learn to read the feeling underneath the words."',
      ],
      stepPurpose: 'Frame connotation as a code the author is using, not an abstract concept.',
      advancementCondition: 'Student taps Continue.',
      masteryRelevant: false,
    },
    {
      stepNumber: 2,
      name: 'MicroModel',
      interactionType: 'read_only',
      scaffoldsActive: true,
      claudeGenerates: [
        'Three word pairs: a neutral word and an emotionally loaded word that mean almost the same thing (e.g., "walked" vs "trudged"; "house" vs "hollow"; "left" vs "abandoned").',
        'For each pair: "What does this word FEEL like? What does the author want you to feel by choosing this word instead of a simpler one?"',
        'Explicit connection: word choice → authorial intent → emergent theme.',
      ],
      stepPurpose:
        'Build the denotation/connotation distinction using concrete, accessible word pairs before applying to a full passage.',
      advancementCondition: 'Student taps Continue.',
      masteryRelevant: false,
    },
    {
      stepNumber: 3,
      name: 'GuidedPractice',
      interactionType: 'multiple_choice',
      scaffoldsActive: true,
      claudeGenerates: [
        'Three isolated sentences from a passage, each containing a high-connotation word. For each sentence, multiple choice: "What does the author want you to FEEL by using this word?"',
        'Options include: the denotative meaning, the correct connotative reading, an unrelated emotion, and an over-literal interpretation.',
        'After each selection: feedback naming the feeling the word carries and connecting it to what the author is building.',
      ],
      stepPurpose:
        'Isolated connotation practice before full passage. Reduces cognitive load — one sentence at a time.',
      advancementCondition: '2 of 3 correct.',
      masteryRelevant: false,
    },
    {
      stepNumber: 4,
      name: 'SemiGuided',
      interactionType: 'fill_in',
      scaffoldsActive: true,
      claudeGenerates: [
        'Full short passage with 3–4 words highlighted.',
        'Prompt for each: "This word feels ___. The author chose it because ___."',
        'After all words: "Based on the author\'s word choices, the theme of this passage is probably about ___."',
      ],
      stepPurpose:
        'Connect connotative reading to theme identification. Student traces word choice → author intent → theme.',
      advancementCondition: 'Theme prediction is directionally accurate — not required to be final theme statement yet.',
      masteryRelevant: false,
    },
    {
      stepNumber: 5,
      name: 'IndependentTask',
      interactionType: 'short_response',
      scaffoldsActive: false,
      claudeGenerates: [
        'New passage, no highlighting.',
        'Prompt: "Identify one word the author chose carefully. Explain what it feels like and how it connects to the theme."',
      ],
      stepPurpose: 'Independent connotative analysis. No words highlighted, no sentence frame.',
      advancementCondition: 'Student identifies a connotatively significant word and connects it to a theme claim.',
      masteryRelevant: true,
    },
    {
      stepNumber: 6,
      name: 'MasteryCheck',
      interactionType: 'structured_response',
      scaffoldsActive: false,
      claudeGenerates: [
        'Structured JSON: { theme_universal, evidence_relevant, reasoning_explicit, scaffolds_used }',
        'Feedback if not mastered: names which element of the word-choice-to-theme connection broke down.',
      ],
      stepPurpose: 'System mastery gate.',
      advancementCondition: 'theme_universal = true AND evidence_relevant = true AND reasoning_explicit = true.',
      masteryRelevant: true,
    },
    {
      stepNumber: 7,
      name: 'TransferTask',
      interactionType: 'structured_response',
      scaffoldsActive: false,
      claudeGenerates: [
        'New passage, higher difficulty.',
        'Full structured prompt: theme + evidence (connotative word or phrase) + reasoning.',
      ],
      stepPurpose: 'Transfer at higher difficulty.',
      advancementCondition: 'All mastery conditions met.',
      masteryRelevant: true,
    },
    {
      stepNumber: 8,
      name: 'ReassessTrigger',
      interactionType: 'read_only',
      scaffoldsActive: false,
      claudeGenerates: ['Mastery confirmation in Gogi\'s voice.'],
      stepPurpose: 'Close protocol.',
      advancementCondition: 'Automatic.',
      masteryRelevant: false,
    },
  ],
  masteryConditions: { minimumAttempts: 1 },
  reclassificationTrigger: {
    attemptThreshold: 3,
    hintUnlockAttempt: 2,
    hint: "Don't just read the words — read the feeling behind them. Find one word or phrase in the passage that feels emotionally charged. Ask: why did the author choose this word over a simpler one? What does that choice reveal about what the author wants you to understand about people?",
    fallbackProtocol: 'AbstractionLadder',
    clinicalRationale:
      'If connotative instruction does not produce theme mastery after two attempts, the student may be able to read emotional tone but unable to abstract it into a universal claim. Shift to abstraction training.',
  },
}

// ─────────────────────────────────────────────
// PROTOCOL 4: ABSTRACTION LADDER
// Trigger: abstract_reasoning_deficit, inferencing_deficit
// Layer 3 — After-reading / Abstract Reasoning
// ─────────────────────────────────────────────
export const AbstractionLadder: Protocol = {
  name: 'AbstractionLadder',
  label: 'Abstraction Ladder',
  triggerClassifications: ['abstract_reasoning_deficit', 'inferencing_deficit'],
  layer: 3,
  cognitiveSkillTargeted: 'Abstract Reasoning',
  researchBasis:
    'Graesser, Singer & Trabasso (1994) — construction-integration model. ' +
    'Van den Broek (1990) — inferencing as a specific trainable skill. ' +
    'Concrete thinking trap is the most common Layer 3 failure: student describes events, cannot abstract to human truth.',
  steps: [
    {
      stepNumber: 1,
      name: 'Orientation',
      interactionType: 'read_only',
      scaffoldsActive: true,
      claudeGenerates: [
        'Orientation: "You read the whole passage. You understood what happened. Now we\'re going to climb higher — from what happened in this story to what it says about ALL people. That\'s the move great readers make."',
      ],
      stepPurpose: 'Name the cognitive move explicitly. Student knows what abstraction IS before attempting it.',
      advancementCondition: 'Student taps Continue.',
      masteryRelevant: false,
    },
    {
      stepNumber: 2,
      name: 'MicroModel',
      interactionType: 'read_only',
      scaffoldsActive: true,
      claudeGenerates: [
        'The Abstraction Ladder visualized in 3 rungs: (1) Event — what literally happened. (2) Pattern — what this type of event always produces. (3) Universal truth — what this says about all people.',
        'Applied to a familiar non-school scenario first (e.g., a kid losing a friend after a fight), then to a short literary passage.',
        'Explicit narration at each rung: "This is still about THIS story. Now we\'re climbing. Now we\'re talking about ALL people."',
      ],
      stepPurpose:
        'Make the abstraction move visible as a concrete 3-step process before student attempts it.',
      advancementCondition: 'Student taps Continue.',
      masteryRelevant: false,
    },
    {
      stepNumber: 3,
      name: 'GuidedPractice',
      interactionType: 'multiple_choice',
      scaffoldsActive: true,
      claudeGenerates: [
        'Three short passages. For each: student sees the event (Rung 1 provided), and must select the correct universal truth (Rung 3) from four options.',
        'Wrong options: one stays at the event level, one is too vague to be a theme, one is a moral lesson not a truth.',
        'Feedback names which rung each wrong answer is stuck on.',
      ],
      stepPurpose:
        'Practice the Rung 1 → Rung 3 jump with scaffold (Rung 1 is given). Student focuses on abstraction only.',
      advancementCondition: '2 of 3 correct.',
      masteryRelevant: false,
    },
    {
      stepNumber: 4,
      name: 'SemiGuided',
      interactionType: 'fill_in',
      scaffoldsActive: true,
      claudeGenerates: [
        'New passage. 3-rung ladder template:',
        'Rung 1: "In this story, ___ happens." (student fills)',
        'Rung 2: "This shows that when people ___, they ___." (student fills)',
        'Rung 3: "The universal theme is: ___." (student fills)',
      ],
      stepPurpose:
        'Student climbs the ladder explicitly, one rung at a time. All three rungs must be completed.',
      advancementCondition: 'Rung 3 is a universal theme sentence — not a plot description.',
      masteryRelevant: false,
    },
    {
      stepNumber: 5,
      name: 'IndependentTask',
      interactionType: 'short_response',
      scaffoldsActive: false,
      claudeGenerates: [
        'New passage. Single prompt: "What is the universal theme? Write one sentence that is true for all people, not just the character in this story."',
      ],
      stepPurpose: 'Independent abstraction. No ladder visible.',
      advancementCondition: 'Theme is universal — not character-specific, not a plot summary.',
      masteryRelevant: true,
    },
    {
      stepNumber: 6,
      name: 'MasteryCheck',
      interactionType: 'structured_response',
      scaffoldsActive: false,
      claudeGenerates: [
        'Structured JSON: { theme_universal, evidence_relevant, reasoning_explicit, scaffolds_used }',
        'If theme_universal = false: feedback naming exactly which rung the student stopped at.',
      ],
      stepPurpose: 'System mastery gate.',
      advancementCondition: 'theme_universal = true AND scaffolds_used = false.',
      masteryRelevant: true,
    },
    {
      stepNumber: 7,
      name: 'TransferTask',
      interactionType: 'structured_response',
      scaffoldsActive: false,
      claudeGenerates: [
        'New passage, higher difficulty.',
        'Full prompt: theme + evidence + reasoning.',
      ],
      stepPurpose: 'Transfer confirmation.',
      advancementCondition: 'All mastery conditions met.',
      masteryRelevant: true,
    },
    {
      stepNumber: 8,
      name: 'ReassessTrigger',
      interactionType: 'read_only',
      scaffoldsActive: false,
      claudeGenerates: ['Mastery confirmation in Gogi\'s voice.'],
      stepPurpose: 'Close protocol.',
      advancementCondition: 'Automatic.',
      masteryRelevant: false,
    },
  ],
  masteryConditions: { minimumAttempts: 1 },
  reclassificationTrigger: {
    attemptThreshold: 3,
    hintUnlockAttempt: 2,
    hint: "Your theme needs to be true for someone who has never read this passage. If your statement only describes this one character, move it up one level. Try adding 'people' or 'we' and see if it still holds: 'People who face _____ often discover _____.' That forces the abstraction the theme requires.",
    fallbackProtocol: 'ThemeConceptBuilding',
    clinicalRationale:
      'If abstraction training fails after two attempts, the student may lack the foundational theme concept entirely. The abstraction ladder has nothing to climb if the student does not understand what a theme is. Return to concept-building.',
  },
}

// ─────────────────────────────────────────────
// PROTOCOL 5: THEME-EVIDENCE MAPPING
// Trigger: evidence_retrieval_failure, no_evidence
// Layer 3 — After-reading / Textual Evidence
// ─────────────────────────────────────────────
export const ThemeEvidenceMapping: Protocol = {
  name: 'ThemeEvidenceMapping',
  label: 'Theme-Evidence Mapping',
  triggerClassifications: ['evidence_retrieval_failure', 'no_evidence'],
  layer: 3,
  cognitiveSkillTargeted: 'Textual Evidence',
  researchBasis:
    'Graham & Perin (2007) — evidence selection as a discrete trainable skill. ' +
    'Hillocks (2011) — students who are taught to evaluate evidence quality produce stronger analytical writing. ' +
    'Evidence retrieval failure is distinct from theme failure: student may hold a valid theme but cannot locate or evaluate the text that proves it.',
  steps: [
    {
      stepNumber: 1,
      name: 'Orientation',
      interactionType: 'read_only',
      scaffoldsActive: true,
      claudeGenerates: [
        'Orientation: "You already have an idea about the theme. Now we need to prove it. Today you\'re going to learn to find the exact words in the text that make your theme undeniable."',
      ],
      stepPurpose: 'Frame evidence as proof, not decoration. Student understands the purpose before the skill.',
      advancementCondition: 'Student taps Continue.',
      masteryRelevant: false,
    },
    {
      stepNumber: 2,
      name: 'MicroModel',
      interactionType: 'read_only',
      scaffoldsActive: true,
      claudeGenerates: [
        'The Evidence Hierarchy modeled explicitly: (1) Direct quote — strongest, (2) Paraphrase — accurate restatement, (3) Summary reference — weakest.',
        'A worked example: theme stated → three evidence options from the same passage → evaluation of which is strongest and why.',
        'The test for evidence quality: "Does this piece of text make the theme UNDENIABLE, or does it only kind of relate?"',
      ],
      stepPurpose: 'Build the schema for evidence quality evaluation before student selects evidence independently.',
      advancementCondition: 'Student taps Continue.',
      masteryRelevant: false,
    },
    {
      stepNumber: 3,
      name: 'GuidedPractice',
      interactionType: 'evidence_selection',
      scaffoldsActive: true,
      claudeGenerates: [
        'A short passage with theme provided. Student selects the best evidence from four highlighted options.',
        'Each option labeled with its evidence type (direct quote, paraphrase, summary, irrelevant).',
        'Feedback on selection: names why the selected option does or does not directly support the given theme.',
      ],
      stepPurpose:
        'Evidence selection with theme given and options labeled. Maximum scaffold — student focuses only on quality evaluation.',
      advancementCondition: 'Correct evidence selected with reasoning articulated.',
      masteryRelevant: false,
    },
    {
      stepNumber: 4,
      name: 'SemiGuided',
      interactionType: 'evidence_selection',
      scaffoldsActive: true,
      claudeGenerates: [
        'New passage. Theme provided. Student selects evidence from the full text — no options highlighted, no labels.',
        '3-column organizer: Theme Statement | Evidence (quote or paraphrase) | Line Reference.',
        'Student must complete all three columns.',
      ],
      stepPurpose:
        'Evidence retrieval from full text with theme scaffold still active. Student locates and evaluates without pre-selected options.',
      advancementCondition: 'Evidence is directly relevant to stated theme. Line reference is accurate.',
      masteryRelevant: false,
    },
    {
      stepNumber: 5,
      name: 'IndependentTask',
      interactionType: 'structured_response',
      scaffoldsActive: false,
      claudeGenerates: [
        'New passage. No theme provided.',
        'Prompt: "State the universal theme. Find the strongest evidence in the text that proves it. Explain why this evidence proves your theme."',
      ],
      stepPurpose: 'Independent theme identification AND evidence retrieval. Both skills required.',
      advancementCondition: 'Theme is universal. Evidence is directly relevant. Basic connection stated.',
      masteryRelevant: true,
    },
    {
      stepNumber: 6,
      name: 'MasteryCheck',
      interactionType: 'structured_response',
      scaffoldsActive: false,
      claudeGenerates: [
        'Structured JSON: { theme_universal, evidence_relevant, reasoning_explicit, scaffolds_used }',
        'If evidence_relevant = false: feedback on why the selected evidence does not prove the stated theme.',
      ],
      stepPurpose: 'System mastery gate.',
      advancementCondition: 'theme_universal = true AND evidence_relevant = true.',
      masteryRelevant: true,
    },
    {
      stepNumber: 7,
      name: 'TransferTask',
      interactionType: 'structured_response',
      scaffoldsActive: false,
      claudeGenerates: [
        'New passage, higher difficulty. Full structured prompt.',
      ],
      stepPurpose: 'Transfer confirmation.',
      advancementCondition: 'All mastery conditions met.',
      masteryRelevant: true,
    },
    {
      stepNumber: 8,
      name: 'ReassessTrigger',
      interactionType: 'read_only',
      scaffoldsActive: false,
      claudeGenerates: ['Mastery confirmation in Gogi\'s voice.'],
      stepPurpose: 'Close protocol.',
      advancementCondition: 'Automatic.',
      masteryRelevant: false,
    },
  ],
  masteryConditions: { minimumAttempts: 1 },
  reclassificationTrigger: {
    attemptThreshold: 3,
    hintUnlockAttempt: 2,
    hint: "Find the single line in the passage that surprised you most — the one that changed how you understood the character. That line is usually your strongest evidence. Paste that exact quote, then ask yourself: why would the author include this specific moment? What does it reveal about people in general?",
    fallbackProtocol: 'LiteraryAnalysisParagraph',
    clinicalRationale:
      'If evidence mapping fails after two attempts, the student may be able to locate evidence but cannot synthesize it into a coherent analytical claim. Shift to full paragraph scaffold.',
  },
}

// ─────────────────────────────────────────────
// PROTOCOL 6: LITERARY ANALYSIS PARAGRAPH
// Trigger: no_reasoning, comprehension_integration_failure, summary_instead_of_analysis
// Layer 3 — After-reading / Integration
// ─────────────────────────────────────────────
export const LiteraryAnalysisParagraph: Protocol = {
  name: 'LiteraryAnalysisParagraph',
  label: 'Literary Analysis Paragraph',
  triggerClassifications: [
    'no_reasoning',
    'comprehension_integration_failure',
    'summary_instead_of_analysis',
  ],
  layer: 3,
  cognitiveSkillTargeted: 'Inferencing + Textual Evidence',
  researchBasis:
    'VanLehn (2011) — step-level feedback tied to specific cognitive states produces largest ITS learning gains. ' +
    'Anderson et al. (1995) — ACT-R cognitive tutor: explicit cognitive models outperform general hint systems. ' +
    'This protocol addresses the highest-level failure: student has theme and evidence but cannot build the reasoning bridge between them.',
  steps: [
    {
      stepNumber: 1,
      name: 'Orientation',
      interactionType: 'read_only',
      scaffoldsActive: true,
      claudeGenerates: [
        'Orientation: "You can find the theme. You can find evidence. The last move — and the hardest one — is explaining WHY the evidence proves the theme. That connection is what turns a response into real analysis. That\'s what we\'re building today."',
      ],
      stepPurpose: 'Name the exact skill gap. Student understands what reasoning IS before attempting it.',
      advancementCondition: 'Student taps Continue.',
      masteryRelevant: false,
    },
    {
      stepNumber: 2,
      name: 'MicroModel',
      interactionType: 'read_only',
      scaffoldsActive: true,
      claudeGenerates: [
        'A fully worked literary analysis paragraph modeled explicitly in 5 parts: (1) Universal theme stated. (2) Literary element identified (character, conflict, symbol, motif). (3) Evidence introduced (quote + paraphrase). (4) Reasoning: "This shows that ___ because ___." (5) Real-world connection.',
        'Each part labeled and narrated: "This is the theme. This is the evidence. THIS is the reasoning — this is where most students stop. We\'re not stopping here."',
      ],
      stepPurpose:
        'Make the reasoning move explicit and visible before student attempts it. VanLehn (2011): step-level modeling at the exact breakdown point.',
      advancementCondition: 'Student taps Continue.',
      masteryRelevant: false,
    },
    {
      stepNumber: 3,
      name: 'GuidedPractice',
      interactionType: 'fill_in',
      scaffoldsActive: true,
      claudeGenerates: [
        'Short passage. Theme and evidence both provided.',
        'Student fills only the reasoning: "This evidence shows the theme is true because ___."',
        'Sentence stem active. Student cannot skip the reasoning step.',
        'Feedback: does the reasoning explain the CONNECTION or just restate the evidence?',
      ],
      stepPurpose:
        'Isolated reasoning practice. Theme and evidence given — student focuses only on building the bridge.',
      advancementCondition: 'Reasoning explains the connection, does not restate evidence.',
      masteryRelevant: false,
    },
    {
      stepNumber: 4,
      name: 'SemiGuided',
      interactionType: 'fill_in',
      scaffoldsActive: true,
      claudeGenerates: [
        'New passage. Theme provided. Student selects evidence AND writes reasoning.',
        'Paragraph scaffold: Theme → Evidence (student selects) → Reasoning (student writes) → Real-world connection (student writes).',
        'Sentence stem for reasoning removed. Student must generate the bridge independently.',
      ],
      stepPurpose:
        'Theme scaffold still active. Evidence selection + reasoning both required. Stem removed.',
      advancementCondition:
        'Evidence is relevant. Reasoning explicitly explains the evidence-theme connection.',
      masteryRelevant: false,
    },
    {
      stepNumber: 5,
      name: 'IndependentTask',
      interactionType: 'structured_response',
      scaffoldsActive: false,
      claudeGenerates: [
        'New passage. No scaffold.',
        'Prompt: "Write a response that includes: (1) the universal theme, (2) evidence from the text, (3) an explanation of how the evidence proves the theme."',
        'No paragraph frame. No sentence stems. No theme provided.',
      ],
      stepPurpose: 'Full independent analytical response. All three components must be self-generated.',
      advancementCondition: 'All three components present. Reasoning is explicit, not implied.',
      masteryRelevant: true,
    },
    {
      stepNumber: 6,
      name: 'MasteryCheck',
      interactionType: 'structured_response',
      scaffoldsActive: false,
      claudeGenerates: [
        'Structured JSON: { theme_universal, evidence_relevant, reasoning_explicit, scaffolds_used }',
        'If reasoning_explicit = false: feedback naming the exact point where the reasoning broke down — did the student restate evidence, make an unsupported leap, or stop before the connection?',
      ],
      stepPurpose: 'System mastery gate. reasoning_explicit is the critical condition for this protocol.',
      advancementCondition: 'All three: theme_universal, evidence_relevant, reasoning_explicit = true. scaffolds_used = false.',
      masteryRelevant: true,
    },
    {
      stepNumber: 7,
      name: 'TransferTask',
      interactionType: 'structured_response',
      scaffoldsActive: false,
      claudeGenerates: [
        'New passage, higher difficulty. Same full prompt.',
      ],
      stepPurpose: 'Transfer at higher difficulty.',
      advancementCondition: 'All mastery conditions met.',
      masteryRelevant: true,
    },
    {
      stepNumber: 8,
      name: 'ReassessTrigger',
      interactionType: 'read_only',
      scaffoldsActive: false,
      claudeGenerates: ['Mastery confirmation in Gogi\'s voice.'],
      stepPurpose: 'Close protocol.',
      advancementCondition: 'Automatic.',
      masteryRelevant: false,
    },
  ],
  masteryConditions: { minimumAttempts: 1 },
  reclassificationTrigger: {
    attemptThreshold: 3,
    hintUnlockAttempt: 2,
    hint: "Your reasoning is the bridge between the evidence and the theme. Try this sentence starter: 'This quote proves the theme because it shows that people _____.' If you cannot complete that sentence using your evidence, your evidence and theme may not match — check that connection first before rewriting.",
    fallbackProtocol: 'ThemeEvidenceMapping',
    clinicalRationale:
      'If paragraph scaffold fails after two attempts, the student may not yet have reliable evidence selection. A student who cannot consistently choose relevant evidence cannot build reasoning from it. Return to evidence mapping.',
  },
}
