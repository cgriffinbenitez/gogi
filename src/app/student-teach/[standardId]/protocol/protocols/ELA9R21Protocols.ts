// ELA9R21Protocols.ts
// All five clinical intervention protocols for ELA.9.R.2.1 — Analyzing Text Structure and Purpose
// Grounded in: Meyer & Rice (1984) — text structure and recall;
// Swanson & Sachse-Lee (2001) — working memory and reading;
// Oakhill, Cain & Elbro (2015) — comprehension instruction;
// Beck, McKeown & Kucan (2013) — vocabulary and structural signals;
// Chomsky (1965) / Frazier & Fodor (1978) — clause parsing and syntactic processing.
// Each protocol maps to a diagnostic classification that identifies where text
// structure comprehension collapsed during assessment.

import { Protocol } from '../types'

// ─────────────────────────────────────────────
// PROTOCOL 1: DEFAULT LIST STRATEGY
// Trigger: schema_deficit, no_metacognitive_strategy
// Layer 1 — Pre-reading / Schema and Strategy
// ─────────────────────────────────────────────
export const DefaultListStrategy: Protocol = {
  name: 'DefaultListStrategy',
  label: 'Default List Strategy',
  triggerClassifications: ['schema_deficit', 'no_metacognitive_strategy'],
  layer: 1,
  cognitiveSkillTargeted: 'Text Structure — Schema Building',
  researchBasis:
    'Meyer & Rice (1984) — text structure awareness is the single strongest predictor of recall accuracy. ' +
    'Armbruster, Anderson & Ostertag (1987) — explicit structure instruction transfers to independent reading. ' +
    'Students with no structure schema treat all information as equally weighted — ' +
    'they collect facts rather than extracting the architectural logic the author built.',
  steps: [
    {
      stepNumber: 1,
      name: 'Orientation',
      interactionType: 'read_only',
      scaffoldsActive: true,
      claudeGenerates: [
        'A 2–3 sentence orientation in Gogi\'s peer voice: introduces the idea that authors organize information intentionally — they pick a structure the same way a director picks a shot. Names the five common text structures (description, sequence, compare-contrast, cause-effect, problem-solution) and tells the student they will learn to read the structure like a blueprint.',
        'Voice: direct, energetic, zero jargon. Student understands immediately that structure is a meaning-making tool, not an academic category.',
      ],
      stepPurpose:
        'Build the schema that text organization is intentional and extractable before any analysis begins. Student cannot recognize structure they have no concept of.',
      advancementCondition: 'Student taps Continue — no evaluation required.',
      masteryRelevant: false,
    },
    {
      stepNumber: 2,
      name: 'MicroModel',
      interactionType: 'read_only',
      scaffoldsActive: true,
      claudeGenerates: [
        'Gogi reads the current passage aloud (think-aloud narration), identifies the structure by name, and explains the diagnostic question: "How do I know? I look for the author\'s move — are they comparing two things, showing a cause and its effect, or walking through steps?"',
        'A counterfactual demonstration: Gogi reorganizes the same information under a different structure and shows how the meaning shifts — "If this were a list, we would just know the facts. But because it is cause-effect, we understand WHY."',
        'One-sentence rule: "The structure is not decoration — it is the author\'s argument about how the ideas relate."',
      ],
      stepPurpose:
        'Make the structure-meaning connection concrete and visible before the student attempts analysis. The counterfactual makes the choice feel intentional, not arbitrary.',
      advancementCondition: 'Student taps Continue — no evaluation required.',
      masteryRelevant: false,
    },
    {
      stepNumber: 3,
      name: 'GuidedPractice',
      interactionType: 'passage_annotation',
      scaffoldsActive: true,
      claudeGenerates: [
        'The passage below a --- delimiter.',
        'Above the delimiter: Gogi names the structure ("This passage uses cause-effect structure") and directs the student to two specific sentences where that structure is visible — one showing a cause, one showing an effect. Prompt: "Highlight both of these sentences. Tag the cause sentence as Textual Evidence and the effect sentence as Supporting Detail. Then write one sentence explaining what the structure tells you about how the ideas are related."',
        'Student uses PassageAnnotator to tag both locations and write the structural explanation.',
      ],
      stepPurpose:
        'First active structure recognition with structure name and locations given. Student focuses on tagging and explaining the structural relationship, not on identifying the structure.',
      advancementCondition:
        'Student has highlighted both specified locations with correct tags and written a structural explanation that names the relationship between the tagged pieces.',
      masteryRelevant: false,
    },
    {
      stepNumber: 4,
      name: 'SemiGuided',
      interactionType: 'multiple_select',
      scaffoldsActive: true,
      claudeGenerates: [
        'A multiple_select question presenting the five structure types (description, sequence, compare-contrast, cause-effect, problem-solution) with a passage excerpt visible above.',
        'Prompt: "Which text structure best describes how this passage is organized? Select all that apply — some passages use more than one."',
        'After the student selects, feedback names whether their selection matches structural signals in the passage and which signal words or organizational features confirm it.',
      ],
      stepPurpose:
        'Structure identification without location hints — student must name the structure from the full passage. Multiple-select allows for recognition of mixed-structure passages.',
      advancementCondition:
        'Student selects the correct primary structure. If a secondary structure exists, student identifies it or their explanation acknowledges the mixed structure.',
      masteryRelevant: false,
    },
    {
      stepNumber: 5,
      name: 'IndependentTask',
      interactionType: 'passage_annotation',
      scaffoldsActive: false,
      claudeGenerates: [
        'The passage below a --- delimiter.',
        'Above the delimiter: single Gogi prompt — "Find two places in this passage where the author\'s structural choice is visible. Highlight both. Tag the one that shows the organizing pattern as Main Idea and the one that shows evidence of that pattern as Textual Evidence. Then write one sentence explaining what structure the author is using and why they chose it."',
        'No structure name given. No location hints. Student identifies and names the structure independently.',
      ],
      stepPurpose:
        'Full independent structure identification and purpose explanation. Structure name must come from the student, not from a list or a Gogi prompt.',
      advancementCondition:
        'Student names the text structure, highlights two structural markers, and explains how the structure shapes the passage\'s meaning.',
      masteryRelevant: true,
    },
    {
      stepNumber: 6,
      name: 'MasteryCheck',
      interactionType: 'structured_response',
      scaffoldsActive: false,
      claudeGenerates: [
        'Structured response prompt with three fields: STRUCTURE IDENTIFIED | EVIDENCE FROM TEXT | HOW IT SHAPES MEANING.',
        'Structured JSON evaluation: { "theme_universal": <true if STRUCTURE IDENTIFIED names a specific structure type — not a vague description>, "evidence_relevant": <true if EVIDENCE FROM TEXT contains specific passage language that demonstrates the named structure>, "reasoning_explicit": <true if HOW IT SHAPES MEANING explains the relationship between the structure and the passage\'s meaning — not just restates the structure name>, "scaffolds_used": <true if student used the list of structure types from step 4 as a crutch or left any field blank>, "passed": <true only if all three content conditions are true AND scaffolds_used is false> }',
        'Feedback if not passed: names which field broke down. Did the student name a structure but provide evidence for a different one? Did they explain what the structure IS without explaining what it DOES to the meaning?',
        'Fake-out rejection: reject as non-mastery if: (1) structure name is copy-pasted from the Gogi prompt in step 4, (2) any field is blank or single word, (3) EVIDENCE FROM TEXT is a plot summary not a structural feature, (4) HOW IT SHAPES MEANING restates the structure definition instead of connecting it to this passage\'s meaning, (5) incoherent, (6) structure name is correct but evidence is generic and not passage-specific, (7) evidence cited but no meaning connection stated, (8) response applicable to any passage with no passage-specific anchoring.',
      ],
      stepPurpose:
        'System mastery gate. All three fields must be passage-specific and logically connected. HOW IT SHAPES MEANING is the critical condition — naming structure without explaining its function is not mastery.',
      advancementCondition:
        'Student has named the text structure, provided passage-specific evidence, and explained how the structure shapes the meaning of this passage.',
      masteryRelevant: true,
    },
    {
      stepNumber: 7,
      name: 'TransferTask',
      interactionType: 'short_response',
      scaffoldsActive: false,
      claudeGenerates: [
        'A second section or paragraph from the same passage that uses a different structural pattern.',
        'Prompt: "Apply your structure analysis to this section. Name the structure, quote one piece of evidence, and explain what the structure reveals about how these ideas relate."',
        'No fields. Prose response required. Tests whether structure analysis transfers across structural patterns within the same text.',
      ],
      stepPurpose:
        'Transfer confirmation — student applies structure analysis to a second structural pattern in the same text without any scaffold or field template.',
      advancementCondition:
        'Student names a structure, provides passage-specific evidence, and explains the structure\'s function in this section.',
      masteryRelevant: true,
    },
    {
      stepNumber: 8,
      name: 'ReassessTrigger',
      interactionType: 'read_only',
      scaffoldsActive: false,
      claudeGenerates: [
        'A 2-sentence mastery confirmation in Gogi\'s peer voice: names the specific structure-reading skill mastered and connects it to a real-world context — a news article, a lab report, a legal brief, a contract — where reading the organizational logic gives this student actual power.',
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
    hint: "Do not try to name the structure from memory — look for the author's move. Ask yourself: is the author showing that one thing CAUSED another? Is the author comparing two things side by side? Is the author walking through steps in order? Is the author describing a problem and then a solution? Whichever one matches what you see in the passage is your structure. Find two sentences that prove it, then explain what that structure does to the meaning.",
    fallbackProtocol: 'TextTypeDiscriminationFailure',
    clinicalRationale:
      'A student who cannot build a structure schema after two full cycles may be failing at the signal word level — unable to recognize the linguistic markers that identify structure. Shift from schema-building to explicit signal word instruction.',
  },
}

// ─────────────────────────────────────────────
// PROTOCOL 2: CHUNKING FAILURE
// Trigger: comprehension_integration_failure
// Layer 3 — After-reading / Integration
// ─────────────────────────────────────────────
export const ChunkingFailure: Protocol = {
  name: 'ChunkingFailure',
  label: 'Chunking Failure',
  triggerClassifications: ['comprehension_integration_failure'],
  layer: 3,
  cognitiveSkillTargeted: 'Text Structure — Hierarchical Chunking',
  researchBasis:
    'Swanson & Sachse-Lee (2001) — working memory capacity predicts hierarchical text processing. ' +
    'Miller (1956) — chunking is the primary cognitive mechanism for managing information load. ' +
    'Meyer & Rice (1984) — students who cannot group related ideas process text as undifferentiated list, ' +
    'losing the hierarchy the author built. Explicit chunking instruction restores access to that hierarchy.',
  steps: [
    {
      stepNumber: 1,
      name: 'Orientation',
      interactionType: 'read_only',
      scaffoldsActive: true,
      claudeGenerates: [
        'A 2–3 sentence orientation in Gogi\'s peer voice: introduces chunking as a mental filing system. Good readers group related ideas into folders as they read — not every sentence is its own folder. Names the filing logic: big idea, supporting ideas, details. Previews today\'s sequence.',
        'Voice: direct, concrete analogy — folders on a phone, not an academic concept.',
      ],
      stepPurpose:
        'Frame chunking as a natural cognitive tool before any grouping work begins. Student must understand that ideas have relationships before they can be asked to represent them.',
      advancementCondition: 'Student taps Continue — no evaluation required.',
      masteryRelevant: false,
    },
    {
      stepNumber: 2,
      name: 'MicroModel',
      interactionType: 'read_only',
      scaffoldsActive: true,
      claudeGenerates: [
        'Gogi walks through the passage sentence by sentence, grouping ideas into labeled categories explicitly. Narrates the grouping decision for each sentence: "This goes with the first group because it adds a detail to the same point. This one opens a new folder — it introduces a different aspect entirely."',
        'At the end, Gogi draws the resulting hierarchy: one big idea at the top, two or three supporting ideas beneath it, specific details nested under each.',
        'Explicit narration: "Now I can see the shape of the argument. Nothing is floating loose. Every idea has a home."',
      ],
      stepPurpose:
        'Make the hierarchical grouping process visible before the student attempts it. Student sees Gogi make grouping decisions in real time, not after the fact.',
      advancementCondition: 'Student taps Continue — no evaluation required.',
      masteryRelevant: false,
    },
    {
      stepNumber: 3,
      name: 'GuidedPractice',
      interactionType: 'drag_and_drop',
      scaffoldsActive: true,
      claudeGenerates: [
        'A single Gogi instruction line above the --- delimiter: "Sort these ideas from the passage into the right folder. Each idea belongs to exactly one group."',
        'Below the --- delimiter, output EXACTLY this two-line format — nothing else:\nITEMS: [7–9 passage-specific ideas, details, and examples from the passage, each a short phrase of 3–8 words, separated by | pipes]\nCATEGORIES: Main Point | Supporting Idea 1 | Supporting Idea 2',
        'Items must be short, passage-specific phrases (not full sentences). Use exactly the three category labels shown — do not alter them.',
      ],
      stepPurpose:
        'First active hierarchical grouping with pre-extracted items and pre-labeled categories. Student focuses entirely on identifying relationships between ideas.',
      advancementCondition:
        'All items assigned. Main Point contains the central claim. Supporting Ideas contain the strongest sub-arguments. Details are nested under the supporting idea they extend.',
      masteryRelevant: false,
    },
    {
      stepNumber: 4,
      name: 'SemiGuided',
      interactionType: 'drag_and_drop',
      scaffoldsActive: true,
      claudeGenerates: [
        'A single Gogi instruction line above the --- delimiter: "Group these ideas the way the author grouped them. Then name each group yourself — what is each group really about? Drag the items, then write a label for each group in your explanation."',
        'Below the --- delimiter, output EXACTLY this two-line format — nothing else:\nITEMS: [7–9 passage-specific ideas and details from the passage, each a short phrase of 3–8 words, separated by | pipes]\nCATEGORIES: Group 1 | Group 2 | Group 3',
        'Items must be short, passage-specific phrases (not full sentences). Use exactly the three generic labels Group 1, Group 2, Group 3 — the student generates the real category names as part of their explanation.',
      ],
      stepPurpose:
        'Scaffold fade — student must generate category labels rather than fitting items into named folders. Tests whether the student has internalized the logic of grouping.',
      advancementCondition:
        'Groups reflect the passage\'s actual organization. Student-generated labels accurately describe what each group contains.',
      masteryRelevant: false,
    },
    {
      stepNumber: 5,
      name: 'IndependentTask',
      interactionType: 'structured_response',
      scaffoldsActive: false,
      claudeGenerates: [
        'Structured prompt with a grouping task: "Build your mental filing system for this passage. Name your categories, list the ideas that belong in each one, and explain the logic that determines which idea goes where."',
        'No item cards pre-extracted. No category labels given. No drag interface. Student builds the hierarchy as a written structured response.',
        'Format: CATEGORY 1 (name): [ideas listed] | CATEGORY 2 (name): [ideas listed] | CATEGORY 3 (name): [ideas listed] | GROUPING LOGIC: [explanation].',
      ],
      stepPurpose:
        'Full independent hierarchical chunking. Student must extract ideas from the passage, group them, label them, and explain the logic — all from memory and reading.',
      advancementCondition:
        'Categories reflect the passage\'s actual organizational structure. Grouping logic is explained and consistent with the categories named.',
      masteryRelevant: true,
    },
    {
      stepNumber: 6,
      name: 'MasteryCheck',
      interactionType: 'structured_response',
      scaffoldsActive: false,
      claudeGenerates: [
        'Structured JSON evaluation: { "theme_universal": <true if CATEGORY names reflect the passage\'s actual structural groupings — not arbitrary labels>, "evidence_relevant": <true if the ideas listed under each category are accurate and passage-specific>, "reasoning_explicit": <true if GROUPING LOGIC explains the principle by which ideas are sorted — not just restates the category names>, "scaffolds_used": <true if student used the drag-and-drop item list from step 3 or 4 verbatim without adaptation>, "passed": <true only if all three content conditions are true AND scaffolds_used is false> }',
        'Feedback if not passed: names the breakdown. Did the student create categories that overlap? Did the grouping logic describe what each group IS rather than how ideas were assigned to it? Did a detail end up in the wrong folder?',
        'Fake-out rejection: reject as non-mastery if: (1) categories copy the DragAndDrop labels verbatim with no adaptation, (2) any category field is blank, (3) ideas listed under a category do not belong there based on the passage, (4) GROUPING LOGIC says "I grouped similar ideas" without explaining what makes them similar, (5) incoherent, (6) category labels are correct but ideas listed are wrong, (7) ideas listed but no logic stated, (8) grouping applicable to any passage with no passage-specific reasoning.',
      ],
      stepPurpose:
        'System mastery gate. GROUPING LOGIC is the critical condition — it proves the student is chunking by meaning, not by proximity or length.',
      advancementCondition:
        'Student has accurately grouped related ideas from the passage into a logical hierarchy with explained reasoning.',
      masteryRelevant: true,
    },
    {
      stepNumber: 7,
      name: 'TransferTask',
      interactionType: 'short_response',
      scaffoldsActive: false,
      claudeGenerates: [
        'A different section or paragraph from the same passage.',
        'Prompt: "Apply your mental filing system to this section. What are the groups? What belongs in each one? What is the logic? Prose response — no categories required."',
        'No structure given. No template. Tests whether the chunking strategy transfers to a new section of text.',
      ],
      stepPurpose:
        'Transfer confirmation — student applies hierarchical chunking to a new passage section without any template or drag interface.',
      advancementCondition:
        'Response identifies distinct groups of related ideas, assigns passage content to each, and explains the grouping logic.',
      masteryRelevant: true,
    },
    {
      stepNumber: 8,
      name: 'ReassessTrigger',
      interactionType: 'read_only',
      scaffoldsActive: false,
      claudeGenerates: [
        'A 2-sentence mastery confirmation in Gogi\'s peer voice: names the chunking skill mastered and connects it to a real-world context where organizing a dense document into a logical hierarchy gives this student real power.',
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
    hint: "You do not need to hold the whole passage in your head. Just find the first big idea — the one point everything else seems to circle back to. Write it down. Now ask: which other sentences add information to that first point? Put those in group 1. Now look at what is left. Does a second big idea start somewhere? Group those together. Keep going until every idea has a home. Then name each group with one phrase that describes what is inside it.",
    fallbackProtocol: 'DefaultListStrategy',
    clinicalRationale:
      'A student who cannot chunk hierarchically after two attempts may not have a schema for why ideas have different weights at all. Return to structure schema-building before re-attempting hierarchical grouping.',
  },
}

// ─────────────────────────────────────────────
// PROTOCOL 3: MAIN IDEA EXTRACTION FAILURE
// Trigger: inferencing_deficit, abstract_reasoning_deficit
// Layer 3 — After-reading / Main Idea
// ─────────────────────────────────────────────
export const MainIdeaExtractionFailure: Protocol = {
  name: 'MainIdeaExtractionFailure',
  label: 'Main Idea Extraction Failure',
  triggerClassifications: ['inferencing_deficit', 'abstract_reasoning_deficit'],
  layer: 3,
  cognitiveSkillTargeted: 'Text Structure — Main Idea Extraction',
  researchBasis:
    'Oakhill, Cain & Elbro (2015) — main idea identification requires inference, not just recognition. ' +
    'Williams et al. (2009) — explicit instruction in main idea filtering produces lasting comprehension gains. ' +
    'Students who fail main idea tasks are not summarizing wrong — they are applying the wrong filter: ' +
    'they cannot distinguish the author\'s non-negotiable point from interesting supporting content.',
  steps: [
    {
      stepNumber: 1,
      name: 'Orientation',
      interactionType: 'read_only',
      scaffoldsActive: true,
      claudeGenerates: [
        'A 2–3 sentence orientation in Gogi\'s peer voice: frames the main idea as the author\'s one non-negotiable point — the thing the passage cannot exist without. Everything else exists to support it. Names the filtering move: if you removed this sentence, would the whole passage collapse? If yes, that is the main idea.',
        'Voice: direct, concrete. Student understands the filter before they apply it.',
      ],
      stepPurpose:
        'Frame main idea identification as a filtering operation, not a summarizing operation. Student must understand the test before applying it.',
      advancementCondition: 'Student taps Continue — no evaluation required.',
      masteryRelevant: false,
    },
    {
      stepNumber: 2,
      name: 'MicroModel',
      interactionType: 'read_only',
      scaffoldsActive: true,
      claudeGenerates: [
        'Gogi models the filtering process on the current passage: reads each paragraph, asks aloud "what does this support?" — not "what does this say?" Eliminates sentences by testing whether the passage would survive without them. Arrives at the main idea through active subtraction.',
        'A second pass showing what the student does WRONG: Gogi picks an interesting detail, calls it the main idea, then asks — "but what is this detail IN SERVICE OF? That is the main idea."',
        'One-sentence rule: "The main idea is what the author is trying to convince you of. Everything else is how they do it."',
      ],
      stepPurpose:
        'Make the subtraction filter visible. Student sees both the correct move and the common failure (confusing a compelling detail for the central point) before attempting.',
      advancementCondition: 'Student taps Continue — no evaluation required.',
      masteryRelevant: false,
    },
    {
      stepNumber: 3,
      name: 'GuidedPractice',
      interactionType: 'multiple_select',
      scaffoldsActive: true,
      claudeGenerates: [
        'Three candidate main idea statements for the current passage — one correct, one too specific (describes a detail), one too broad (could apply to any passage).',
        'Prompt: "Select the main idea of this passage. You may select more than one if you think the passage has more than one central point."',
        'Feedback on each option: explains specifically why each one is too specific, too broad, or correct — uses the "would the passage collapse?" test explicitly.',
      ],
      stepPurpose:
        'Main idea discrimination with candidate options provided. Student applies the filter without having to generate the main idea from scratch. Focus on discrimination, not production.',
      advancementCondition:
        'Student selects the correct main idea and the feedback explanation connects to the filtering logic Gogi modeled.',
      masteryRelevant: false,
    },
    {
      stepNumber: 4,
      name: 'SemiGuided',
      interactionType: 'passage_annotation',
      scaffoldsActive: true,
      claudeGenerates: [
        'The passage below a --- delimiter.',
        'Above the delimiter: Gogi provides the main idea. Prompt: "The main idea of this passage is: [main idea stated]. Now find the two strongest supporting details — the ones that do the most work proving that main idea. Highlight each one and tag it as Supporting Detail. Also find one detail that is interesting but does not actually prove the main idea — highlight it and tag it as Context Clue to mark it as peripheral. In your explanation, say why each supporting detail earns its place and why the peripheral one does not."',
        'Three highlights required — two Supporting Detail, one Context Clue — forcing the student to actively filter.',
      ],
      stepPurpose:
        'Main idea given — student applies the filter as an active sorting task. Must identify what supports AND what does not, demonstrating discrimination both directions.',
      advancementCondition:
        'Student correctly tags two supporting details and one peripheral detail, and explains why each supporting detail proves the given main idea while the peripheral one does not.',
      masteryRelevant: false,
    },
    {
      stepNumber: 5,
      name: 'IndependentTask',
      interactionType: 'structured_response',
      scaffoldsActive: false,
      claudeGenerates: [
        'Structured prompt: "Extract the main idea of this passage and prove it with two supporting details." Fields: MAIN IDEA | SUPPORTING DETAIL 1 | SUPPORTING DETAIL 2.',
        'No main idea provided. No candidate options. No highlighted details. Student applies the filter from scratch using only their reading.',
      ],
      stepPurpose:
        'Full independent main idea extraction with evidence. Main idea must be passage-specific and both details must directly support it.',
      advancementCondition:
        'Student produces a passage-specific main idea supported by two details that directly prove the main point.',
      masteryRelevant: true,
    },
    {
      stepNumber: 6,
      name: 'MasteryCheck',
      interactionType: 'structured_response',
      scaffoldsActive: false,
      claudeGenerates: [
        'Structured response prompt with four fields: MAIN IDEA | SUPPORTING DETAIL 1 | SUPPORTING DETAIL 2 | WHY THIS IS THE MAIN IDEA.',
        'Structured JSON evaluation: { "theme_universal": <true if MAIN IDEA field contains a passage-specific central claim — not a topic word, not a plot summary>, "evidence_relevant": <true if both SUPPORTING DETAIL fields contain passage-specific content that directly proves the main idea>, "reasoning_explicit": <true if WHY THIS IS THE MAIN IDEA explains the filtering logic — why the other content is in service of this point>, "scaffolds_used": <true if student restated the candidate options from step 3 or left any field blank>, "passed": <true only if all three content conditions are true AND scaffolds_used is false> }',
        'Feedback if not passed: names the exact breakdown. Did the student select a detail as the main idea? Did a supporting detail not actually connect to the main idea? Did WHY THIS IS THE MAIN IDEA just restate the main idea in different words?',
        'Fake-out rejection: reject as non-mastery if: (1) main idea is a copy of the candidate from step 3, (2) any field is blank, (3) MAIN IDEA is a topic label not a claim ("the passage is about friendship"), (4) supporting details describe events without connecting to the main idea claim, (5) incoherent, (6) WHY THIS IS THE MAIN IDEA says "because it is the most important" without explaining the filtering logic, (7) details cited but no connection to main idea stated, (8) main idea could describe any passage on the same topic.',
      ],
      stepPurpose:
        'System mastery gate. WHY THIS IS THE MAIN IDEA is the critical condition — it proves the student is filtering, not guessing.',
      advancementCondition:
        'Student has produced a passage-specific main idea supported by two details and demonstrated active filtering by explaining why this is the main point.',
      masteryRelevant: true,
    },
    {
      stepNumber: 7,
      name: 'TransferTask',
      interactionType: 'short_response',
      scaffoldsActive: false,
      claudeGenerates: [
        'A second paragraph from the same passage.',
        'Prompt: "Apply your filter to this paragraph. What is the main idea? Find one supporting detail that proves it and one detail that does not. Explain the difference."',
        'No fields. Prose response. Tests whether the filter transfers to paragraph-level analysis.',
      ],
      stepPurpose:
        'Transfer confirmation — student applies the main idea filter to a second paragraph, identifying both supporting and non-supporting content.',
      advancementCondition:
        'Student identifies the paragraph\'s main idea, names one supporting detail, names one peripheral detail, and explains why each is or is not proving the main point.',
      masteryRelevant: true,
    },
    {
      stepNumber: 8,
      name: 'ReassessTrigger',
      interactionType: 'read_only',
      scaffoldsActive: false,
      claudeGenerates: [
        'A 2-sentence mastery confirmation in Gogi\'s peer voice: names the main idea filtering skill mastered and connects it to a real-world context where quickly identifying the one non-negotiable point in a dense document gives this student actual power.',
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
    hint: "Ask yourself: if I removed this sentence from the passage, would the rest stop making sense? Run that test on each sentence. The one that makes everything else collapse when you remove it — that is the main idea. The ones that just add detail or examples can go. When you find it, write it as a full sentence claim, not just a topic word.",
    fallbackProtocol: 'ChunkingFailure',
    clinicalRationale:
      'A student who cannot extract the main idea after two full filter-instruction cycles may be failing because they cannot yet group ideas hierarchically — they have no mechanism for distinguishing central from peripheral because all ideas feel equal. Shift to chunking instruction before re-attempting main idea extraction.',
  },
}

// ─────────────────────────────────────────────
// PROTOCOL 4: TEXT TYPE DISCRIMINATION FAILURE
// Trigger: evidence_retrieval_failure, vocabulary_gap_connotative
// Layer 2 — During-reading / Signal Words
// ─────────────────────────────────────────────
export const TextTypeDiscriminationFailure: Protocol = {
  name: 'TextTypeDiscriminationFailure',
  label: 'Text Type Discrimination Failure',
  triggerClassifications: ['evidence_retrieval_failure', 'vocabulary_gap_connotative'],
  layer: 2,
  cognitiveSkillTargeted: 'Text Structure — Signal Word Recognition',
  researchBasis:
    'Meyer & Rice (1984) — signal word fluency is the gateway to structure recognition. ' +
    'Beck, McKeown & Kucan (2013) — Tier 2 signal vocabulary (however, consequently, in contrast) ' +
    'is the most teachable and highest-leverage vocabulary for text structure access. ' +
    'Without signal word recognition, structure is invisible regardless of schema strength.',
  steps: [
    {
      stepNumber: 1,
      name: 'Orientation',
      interactionType: 'read_only',
      scaffoldsActive: true,
      claudeGenerates: [
        'A 2–3 sentence orientation in Gogi\'s peer voice: introduces signal words as the author\'s road signs. They appear at key transitions and tell the reader exactly where the argument is going next. Names three categories — addition signals, contrast signals, cause-effect signals — and tells the student they will learn to spot all three.',
        'Voice: concrete and direct. Makes signal words feel like a code that can be cracked.',
      ],
      stepPurpose:
        'Frame signal words as a distinct, learnable system before the student is asked to identify them. Without a category schema, students read past signal words as function words.',
      advancementCondition: 'Student taps Continue — no evaluation required.',
      masteryRelevant: false,
    },
    {
      stepNumber: 2,
      name: 'MicroModel',
      interactionType: 'read_only',
      scaffoldsActive: true,
      claudeGenerates: [
        'Gogi walks through the passage highlighting signal words as they appear. For each one: names the word, names its category (addition / contrast / cause-effect / sequence / example / summary), explains what the word tells the reader about the relationship between the ideas it connects.',
        'A counterfactual for each: "If the author had used \'however\' instead of \'therefore\', what would change about how you read the next sentence?"',
        'Final synthesis: "Signal words are not decoration. Each one is a instruction about how to connect what just happened to what comes next."',
      ],
      stepPurpose:
        'Make signal words visible as carriers of relational meaning, not just transitions. The counterfactual shows that word choice changes the logical relationship.',
      advancementCondition: 'Student taps Continue — no evaluation required.',
      masteryRelevant: false,
    },
    {
      stepNumber: 3,
      name: 'GuidedPractice',
      interactionType: 'passage_annotation',
      scaffoldsActive: true,
      claudeGenerates: [
        'The passage below a --- delimiter.',
        'Above the delimiter: Gogi identifies one specific signal word in the passage (e.g., "Find the word \'nevertheless\' in the third sentence"). Prompt: "Highlight this signal word. Tag it as Signal Word. Then write one sentence explaining: what relationship does this word signal between the idea before it and the idea after it?"',
        'One signal word given. Student tags and explains the relational logic it carries.',
      ],
      stepPurpose:
        'First active signal word analysis with the specific word identified. Student focuses on understanding the relational meaning, not on finding the word.',
      advancementCondition:
        'Student highlights the correct word, tags it as Signal Word, and explains the logical relationship it signals between the surrounding ideas.',
      masteryRelevant: false,
    },
    {
      stepNumber: 4,
      name: 'SemiGuided',
      interactionType: 'passage_annotation',
      scaffoldsActive: true,
      claudeGenerates: [
        'The passage below a --- delimiter.',
        'Above the delimiter: Gogi names the paragraph to search but does not identify any specific words. Prompt: "Find all the signal words in this paragraph. Highlight each one and tag it as Signal Word. Then write one sentence explaining what each one tells you about how the ideas in that paragraph connect to each other."',
        'No words identified. Student must locate all signal words in the target paragraph independently.',
      ],
      stepPurpose:
        'Scaffold fade — student identifies signal words without Gogi naming them. Full paragraph search required. Tests whether the student has internalized signal word recognition as a scanning skill.',
      advancementCondition:
        'Student identifies at least two signal words in the paragraph, tags each correctly, and explains the relational logic each one carries.',
      masteryRelevant: false,
    },
    {
      stepNumber: 5,
      name: 'IndependentTask',
      interactionType: 'multiple_select',
      scaffoldsActive: false,
      claudeGenerates: [
        'A list of 8–10 words extracted from the passage, mixing genuine signal words (however, consequently, in contrast, furthermore, as a result) with neutral words that are not signal words (the, character, walked, said, because of this).',
        'Prompt: "Select every word from this list that is a signal word in the passage. For each one you select, explain in your response what structural logic it reveals."',
        'After submission, ProtocolEngine generates a follow-up prompt asking the student to name the overall text structure the collective signal words reveal.',
      ],
      stepPurpose:
        'Independent signal word identification from a mixed list — student must discriminate signal from non-signal words across the full passage, then use the pattern to name the structure.',
      advancementCondition:
        'Student selects all genuine signal words and explains the structural logic they reveal collectively.',
      masteryRelevant: true,
    },
    {
      stepNumber: 6,
      name: 'MasteryCheck',
      interactionType: 'structured_response',
      scaffoldsActive: false,
      claudeGenerates: [
        'Structured response prompt with four fields: SIGNAL WORDS FOUND | CATEGORY OF EACH | WHAT THEY TELL THE READER | STRUCTURE THEY REVEAL.',
        'Structured JSON evaluation: { "theme_universal": <true if STRUCTURE THEY REVEAL names a specific text structure type that is consistent with the signal words found>, "evidence_relevant": <true if SIGNAL WORDS FOUND contains actual signal words from the passage — not neutral words or invented words>, "reasoning_explicit": <true if WHAT THEY TELL THE READER explains the specific logical relationships the signal words carry — not just their categories>, "scaffolds_used": <true if student used the multiple-select list from step 5 verbatim without identifying any additional signal words>, "passed": <true only if all three content conditions are true AND scaffolds_used is false> }',
        'Feedback if not passed: names the breakdown. Did the student list non-signal words as signal words? Did the CATEGORY field use invented categories rather than the five standard structure types? Did WHAT THEY TELL THE READER just restate the category name rather than explain the relational logic?',
        'Fake-out rejection: reject as non-mastery if: (1) signal words listed are from the step 5 list verbatim without any additional discovery, (2) any field is blank, (3) CATEGORY OF EACH contains invented categories not connected to text structure, (4) WHAT THEY TELL THE READER says "this word means contrast" without explaining which ideas are being contrasted in this passage, (5) incoherent, (6) signal words correct but structure named does not match them, (7) signal words identified but no structural conclusion stated, (8) structural conclusion is generic and not supported by the specific signal words found.',
      ],
      stepPurpose:
        'System mastery gate. STRUCTURE THEY REVEAL is the critical condition — signal word identification without structural synthesis is not mastery.',
      advancementCondition:
        'Student has identified signal words, explained the logical relationships they carry, and connected them to the text structure they reveal.',
      masteryRelevant: true,
    },
    {
      stepNumber: 7,
      name: 'TransferTask',
      interactionType: 'short_response',
      scaffoldsActive: false,
      claudeGenerates: [
        'A second paragraph from the same passage.',
        'Prompt: "Find the signal words in this paragraph. Name each one, say what relationship it signals, and explain what structure they collectively reveal about this paragraph."',
        'No list. No categories. Prose response. Tests whether signal word analysis transfers to a new passage section.',
      ],
      stepPurpose:
        'Transfer confirmation — student identifies signal words in a new paragraph without any list scaffold and derives the structural logic they reveal.',
      advancementCondition:
        'Response names at least two signal words from the paragraph, explains the relationships they signal, and names the structure they collectively reveal.',
      masteryRelevant: true,
    },
    {
      stepNumber: 8,
      name: 'ReassessTrigger',
      interactionType: 'read_only',
      scaffoldsActive: false,
      claudeGenerates: [
        'A 2-sentence mastery confirmation in Gogi\'s peer voice: names the signal word skill mastered and connects it to a real-world context — a news editorial, a policy document, a job description — where reading the logical connectives gives this student power to understand the argument rather than just the facts.',
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
    hint: "Look for the words that sit between ideas — words like however, therefore, for example, in contrast, as a result, first/then/finally, similarly. These are signal words. Each one tells you something specific: 'however' means a contrast is coming. 'Therefore' means a conclusion follows. 'For example' means the author is proving a point. Find two of these in the passage, say what each one tells you, then ask: what kind of structure uses that combination of signals?",
    fallbackProtocol: 'DefaultListStrategy',
    clinicalRationale:
      'A student who cannot recognize signal words after two full cycles may be missing the foundational schema for why text is organized at all — they do not know what signal words are signaling toward. Return to structure schema-building before re-attempting signal word instruction.',
  },
}

// ─────────────────────────────────────────────
// PROTOCOL 5: SYNTAX COMPREHENSION FAILURE
// Trigger: syntax_barrier, morphology_gap, vocabulary_gap
// Layer 2 — During-reading / Syntax
// ─────────────────────────────────────────────
export const SyntaxComprehensionFailure: Protocol = {
  name: 'SyntaxComprehensionFailure',
  label: 'Syntax Comprehension Failure',
  triggerClassifications: ['syntax_barrier', 'morphology_gap', 'vocabulary_gap'],
  layer: 2,
  cognitiveSkillTargeted: 'Text Structure — Syntax Parsing',
  researchBasis:
    'Frazier & Fodor (1978) — sentence parsing as a constraint-satisfaction process: ' +
    'when clause boundaries are not recognized, the parser misassigns constituents and meaning collapses. ' +
    'Perfetti (2007) — reading efficiency requires automatic clause-level parsing; ' +
    'students who cannot identify clause boundaries cannot extract the logical relationships clauses carry. ' +
    'Structural analysis of informational text is impossible when sentence-level meaning fails first.',
  steps: [
    {
      stepNumber: 1,
      name: 'Orientation',
      interactionType: 'read_only',
      scaffoldsActive: true,
      claudeGenerates: [
        'A 2–3 sentence orientation in Gogi\'s peer voice: introduces complex sentences as layered containers. Each clause holds a piece of meaning and has a relationship to the others — adding information, explaining a cause, or creating a condition. Names the goal: breaking any complex sentence into its parts to extract the full logical structure.',
        'Voice: direct, concrete. Student understands that complex sentences are not confusing — they are organized, and the organization can be decoded.',
      ],
      stepPurpose:
        'Frame clause parsing as a decoding skill before the student attempts it. Without this framing, students experience complex sentences as walls rather than structured containers.',
      advancementCondition: 'Student taps Continue — no evaluation required.',
      masteryRelevant: false,
    },
    {
      stepNumber: 2,
      name: 'MicroModel',
      interactionType: 'read_only',
      scaffoldsActive: true,
      claudeGenerates: [
        'Gogi takes a complex sentence from the passage and breaks it into clauses explicitly. For each clause: identifies the clause type (main clause, subordinate clause, participial phrase, appositive), names what it contributes to the sentence meaning, and shows the logical relationship between clauses (cause, concession, condition, addition, qualification).',
        'A second example: Gogi removes one clause and shows how the sentence meaning changes — proving that each clause contributes something non-redundant.',
        'Final rule: "Every clause earns its place. Find the main clause first — that is the core claim. Everything else is qualifying, explaining, or adding to it."',
      ],
      stepPurpose:
        'Make clause identification and function labeling visible before the student attempts it. Student sees two complete decompositions.',
      advancementCondition: 'Student taps Continue — no evaluation required.',
      masteryRelevant: false,
    },
    {
      stepNumber: 3,
      name: 'GuidedPractice',
      interactionType: 'passage_annotation',
      scaffoldsActive: true,
      claudeGenerates: [
        'The passage below a --- delimiter, with one complex sentence selected and clause boundaries already marked (e.g., "Although the river had flooded [BOUNDARY] the town rebuilt quickly [BOUNDARY] because the community had planned ahead").',
        'Above the delimiter: Gogi instruction — "Highlight each clause in this sentence. Tag each one as Clause. Then write what each clause contributes and what logical relationship connects them."',
        'Three or four clauses pre-bounded — student focuses on function labeling and relationship naming, not boundary identification.',
      ],
      stepPurpose:
        'First clause analysis with boundaries pre-marked. Student focuses entirely on function and relationship — the highest-order parts of clause parsing.',
      advancementCondition:
        'Student highlights all three or four clauses, tags each as Clause, and explains what each contributes and how they logically connect.',
      masteryRelevant: false,
    },
    {
      stepNumber: 4,
      name: 'SemiGuided',
      interactionType: 'passage_annotation',
      scaffoldsActive: true,
      claudeGenerates: [
        'The passage below a --- delimiter, with a new complex sentence shown without boundary markings.',
        'Above the delimiter: Gogi instruction — "Find the clause boundaries in this sentence yourself. Highlight each clause, tag it as Clause, and explain what each one does and how it connects to the main clause."',
        'No pre-marked boundaries. Student must identify where each clause begins and ends, then analyze function and relationship.',
      ],
      stepPurpose:
        'Scaffold fade — student identifies clause boundaries independently. Tests whether the student has internalized the clause-recognition skill rather than just the function-labeling skill.',
      advancementCondition:
        'Student correctly identifies clause boundaries, tags all clauses, and explains the function and logical relationship of each.',
      masteryRelevant: false,
    },
    {
      stepNumber: 5,
      name: 'IndependentTask',
      interactionType: 'structured_response',
      scaffoldsActive: false,
      claudeGenerates: [
        'A new complex sentence from the passage presented in a structured prompt.',
        'Four fields: CLAUSE 1 (text and function) | CLAUSE 2 (text and function) | LOGICAL RELATIONSHIP BETWEEN THEM | FULL SENTENCE MEANING.',
        'No boundaries marked. No categories given. Student identifies clauses, labels functions, names the relationship, and synthesizes the full meaning.',
      ],
      stepPurpose:
        'Full independent clause decomposition and synthesis. All four fields must come from the student\'s reading without any annotation support.',
      advancementCondition:
        'Student correctly identifies clauses, explains their functions, names the logical relationship, and synthesizes the sentence\'s full meaning accurately.',
      masteryRelevant: true,
    },
    {
      stepNumber: 6,
      name: 'MasteryCheck',
      interactionType: 'structured_response',
      scaffoldsActive: false,
      claudeGenerates: [
        'Structured JSON evaluation on the four-field response: { "theme_universal": <true if FULL SENTENCE MEANING accurately captures the complete logical content of the sentence — not a summary of one clause>, "evidence_relevant": <true if CLAUSE 1 and CLAUSE 2 fields contain accurate clause text from the sentence and correct function labels>, "reasoning_explicit": <true if LOGICAL RELATIONSHIP names a specific relationship type — cause, concession, condition, qualification, addition — and explains why that relationship exists between the clauses>, "scaffolds_used": <true if student used the pre-marked boundaries from step 3 or left any field blank>, "passed": <true only if all three content conditions are true AND scaffolds_used is false> }',
        'Feedback if not passed: names the breakdown. Did the student identify a phrase fragment as a clause? Did LOGICAL RELATIONSHIP say "they are connected" without naming the type? Did FULL SENTENCE MEANING capture only the main clause and ignore the subordinate?',
        'Fake-out rejection: reject as non-mastery if: (1) clause text is from step 3\'s pre-marked example rather than the new sentence, (2) any field blank, (3) function labels are invented rather than drawn from standard clause types, (4) LOGICAL RELATIONSHIP names a relationship that contradicts the clause content, (5) incoherent, (6) FULL SENTENCE MEANING is a paraphrase of only the main clause, (7) clauses identified but relationship not named, (8) meaning derived from one clause with subordinate clause ignored.',
      ],
      stepPurpose:
        'System mastery gate. LOGICAL RELATIONSHIP is the critical condition — clause identification without relationship naming is not mastery of syntax parsing.',
      advancementCondition:
        'Student has correctly identified clauses in a complex sentence and explained the logical relationships between them.',
      masteryRelevant: true,
    },
    {
      stepNumber: 7,
      name: 'TransferTask',
      interactionType: 'short_response',
      scaffoldsActive: false,
      claudeGenerates: [
        'A second complex sentence from the same passage.',
        'Prompt: "Apply your clause analysis to this sentence. Identify the clauses, explain what each one contributes, and name the logical relationship between them. Prose response — no fields."',
        'No template. No annotation. Tests whether clause decomposition transfers without structured scaffolding.',
      ],
      stepPurpose:
        'Transfer confirmation — student applies clause analysis to a new complex sentence without the four-field template.',
      advancementCondition:
        'Response identifies at least two clauses, explains the function of each, and names the logical relationship between them.',
      masteryRelevant: true,
    },
    {
      stepNumber: 8,
      name: 'ReassessTrigger',
      interactionType: 'read_only',
      scaffoldsActive: false,
      claudeGenerates: [
        'A 2-sentence mastery confirmation in Gogi\'s peer voice: names the clause-parsing skill mastered and connects it to a real-world context — a legal contract, a medical document, a ballot measure — where reading complex sentence structure accurately gives this student actual power.',
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
    hint: "Break the sentence in half at the longest pause — the comma or the connecting word. Label the first half: who is doing what? That is your main clause. Label the second half: what does this add? Does it explain why? Does it set a condition? Does it qualify the first half? That relationship between the two halves is what the sentence means. Name the halves first, then name the relationship.",
    fallbackProtocol: 'MainIdeaExtractionFailure',
    clinicalRationale:
      'A student who cannot parse complex sentences after two cycles may have the clause-recognition skill but be unable to use it to extract meaning — a higher-order comprehension failure rather than a syntax failure. Shift to main idea extraction, which requires meaning integration rather than structural parsing.',
  },
}
