export type FirstWinResponseType = 'multiple_choice' | 'short_text' | 'select_word';

export type FirstWinPhase = 'A' | 'B';

export type FirstWinItem = {
  item_id: string;
  prompt: string;
  context?: string;
  response_type: FirstWinResponseType;
  options?: string[];
  correct_answer: string;
  scaffold_text?: string;
  feedback_correct: string;
  feedback_incorrect: string;
  cognitive_focus: string;
};

export type FirstWinProtocol = {
  id: string;
  strength_classification_code: string;
  bridge_classification_code: string;
  protocol_name: string;
  phase_a_item_count: number;
  phase_b_item_count: number;
  phase_a_content: FirstWinItem[];
  phase_b_content: FirstWinItem[];
  closing_copy: string;
  clinical_rationale: string;
};

export type FirstWinProtocolPayload = {
  protocol: FirstWinProtocol;
  selectedStrengthClassification: string;
  selectedBenchmarkCode: string | null;
  fallbackUsed: boolean;
};

export const FIRST_WIN_SELF_EFFICACY_OPTIONS = [
  'I get it. That made sense.',
  "Mostly clicked. I'd do that again.",
  'Weird, but kind of okay.',
  'Lost me.',
] as const;

export type FirstWinSelfEfficacyResponse = (typeof FIRST_WIN_SELF_EFFICACY_OPTIONS)[number];
