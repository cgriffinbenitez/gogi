// types.ts
// Core type definitions for GOGI's protocol execution engine
// Every protocol, step, and mastery condition in the system conforms to these types

export type InteractionType =
  | 'multiple_choice'
  | 'evidence_selection'
  | 'fill_in'
  | 'short_response'
  | 'structured_response'
  | 'read_only'            // orientation and micro-model steps — student reads, does not respond
  | 'passage_annotation'   // student highlights and tags a passage, then explains selections
  | 'drag_and_drop'        // student organizes items into labeled categories or sequences
  | 'multiple_select'      // student selects all correct answers from a list (signal words etc.)

export type StepName =
  | 'Orientation'
  | 'MicroModel'
  | 'GuidedPractice'
  | 'SemiGuided'
  | 'IndependentTask'
  | 'MasteryCheck'
  | 'TransferTask'
  | 'ReassessTrigger'

export type CognitiveLayer = 1 | 2 | 3

export interface ProtocolStep {
  stepNumber: number
  name: StepName
  interactionType: InteractionType
  scaffoldsActive: boolean
  // What Claude generates at this step
  claudeGenerates: string[]
  // Plain English instruction to Claude about what this step accomplishes
  stepPurpose: string
  // The advancement condition — what must be true to move to next step
  advancementCondition: string
  // Whether this step contributes to mastery evaluation
  masteryRelevant: boolean
}

export interface MasteryConditions {
  // All four must be true for mastery to be achieved
  theme_universal: boolean   // theme is a universal claim, not a topic
  evidence_relevant: boolean // evidence directly supports the stated theme
  reasoning_explicit: boolean // student explains the connection — not implied
  scaffolds_used: boolean    // if true on final attempt, mastery is NOT achieved
  // Minimum attempt number before mastery can be declared
  minimumAttempts: number
}

export interface ReclassificationTrigger {
  // After this many failed attempts, reclassify
  attemptThreshold: number
  // On this attempt number, surface a scaffold hint before allowing the final retry
  hintUnlockAttempt: number
  // The hint shown to the student on hintUnlockAttempt — protocol-specific scaffold
  hint: string
  // The new classification to try if threshold is hit
  fallbackProtocol: string
  // Clinical rationale for why this fallback makes sense
  clinicalRationale: string
}

export interface Protocol {
  name: string
  label: string
  // Which diagnostic_classification values route here
  triggerClassifications: string[]
  layer: CognitiveLayer
  cognitiveSkillTargeted: string
  // Research basis for this protocol
  researchBasis: string
  steps: ProtocolStep[]
  masteryConditions: Omit<MasteryConditions, 'theme_universal' | 'evidence_relevant' | 'reasoning_explicit' | 'scaffolds_used'>
  reclassificationTrigger: ReclassificationTrigger
}
