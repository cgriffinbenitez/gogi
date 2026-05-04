export type InferenceQuality = 'weak' | 'partial' | 'strong';

export type ScaffoldMove = 'find_the_move' | 'prove_it_with_evidence' | 'explain_the_effect';

export type PassageChunk = {
  id: string;
  paragraphs: string[];
};

export type InferencePoint = {
  id: string;
  chunkIndex: number;
  title: string;
  anchorText: string;
  coachingFocus: string;
  independenceLevel: 'guided' | 'supported' | 'light' | 'independent';
  openingQuestion: string;
  targetUnderstanding: string;
  evidence: string[];
  effectSignals: string[];
  studentStems: string[];
  continueCue: string;
  scaffoldPrompts: Record<ScaffoldMove, string>;
  guidedClose: string;
};

export type InferencePassage = {
  id: string;
  standardCode: 'ELA.9.R.1.1';
  title: string;
  author: string;
  sourceNote: string;
  studentGoal: string;
  chunks: PassageChunk[];
  inferencePoints: InferencePoint[];
  closingQuestion: string;
};

export type InferenceEvaluation = {
  quality: InferenceQuality;
  scaffoldMove: ScaffoldMove;
  feedback: string;
  canAdvance: boolean;
};

export type InferenceAttempt = {
  pointId: string;
  attemptNumber: number;
  response: string;
  quality: InferenceQuality;
  scaffoldMove: ScaffoldMove;
  feedback: string;
  submittedAt: string;
};
