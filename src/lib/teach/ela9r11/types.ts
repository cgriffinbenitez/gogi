import type { Ela9R11MisconceptionFlag } from '@/lib/diagnostic/ela9r11';

export type TeachStepType =
  | 'skill_frame'
  | 'notice'
  | 'name_the_move'
  | 'explain_effect'
  | 'connect_to_meaning'
  | 'use_evidence'
  | 'build_response'
  | 'revise'
  | 'fade_support';

export type TeachNextAction = 'advance' | 'revise' | 'reteach';
export type TeachInputMode = 'chips' | 'short_text' | 'text';

export type FeedbackRule = {
  condition: string;
  feedback: string;
  nextAction: TeachNextAction;
};

export type TeachStep = {
  id: string;
  stepNumber: number;
  stepType: TeachStepType;
  coachingNote: string;
  studentPrompt: string;
  expectedMove: string;
  scaffoldLevel: 1 | 2 | 3;
  inputMode: TeachInputMode;
  options?: string[];
  feedbackRules: FeedbackRule[];
};

export type TeachMasteryCheck = {
  prompt: string;
  masteryCriteria: string[];
  minimumScoreToPass: number;
};

export type TeachLoop = {
  id: string;
  standardCode: 'ELA.9.R.1.1';
  misconceptionFlag: Ela9R11MisconceptionFlag;
  routeName: string;
  studentFriendlyTitle: string;
  teacherDescription: string;
  whyThisLesson: string;
  samplePassage: {
    title: string;
    author: string;
    text: string;
    focusEvidence: string[];
  };
  transferPassage: {
    title: string;
    author: string;
    text: string;
    focusEvidence: string[];
    targetElement: string;
    targetEffect: string;
  };
  targetElement: string;
  targetEffect: string;
  anchorClaim: string;
  preciseEvidence: string;
  weakEvidence: string;
  steps: TeachStep[];
  masteryCheck: TeachMasteryCheck;
};

export type TeachStepRecord = {
  stepId: string;
  stepType: TeachStepType;
  response: string;
  status: TeachNextAction;
  feedback: string;
  score: number;
  submittedAt: string;
};

export type TeachPhaseRecord = TeachStepRecord & {
  phaseNumber: number;
  phaseName: string;
};

export type TeachStepEvaluation = {
  status: TeachNextAction;
  feedback: string;
  score: number;
};
