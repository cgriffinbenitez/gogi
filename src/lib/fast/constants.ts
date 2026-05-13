export const FAST_CLASSIFICATION_CODES = [
  'figurative_language_failure',
  'mood_misreading',
  'tone_misreading',
  'inferencing_literal',
  'topic_vs_theme_confusion',
  'inferencing_schema',
  'evidence_retrieval_failure',
  'vocabulary_gap',
  'structure_purpose_disconnect',
  'no_metacognitive_strategy',
  'comprehension_integration_failure',
  'morphology_gap',
  'syntax_barrier',
] as const;

export type FastClassificationCode = (typeof FAST_CLASSIFICATION_CODES)[number];

export const FAST_REPORT_BUCKET = 'fast-reports';

export const FAST_GRADE_9_ELA_THRESHOLDS = [
  { level: 1, min: 174, max: 223, nextRungTarget: 224 },
  { level: 2, min: 224, max: 241, nextRungTarget: 242 },
  { level: 3, min: 242, max: 253, nextRungTarget: 254 },
  { level: 4, min: 254, max: 266, nextRungTarget: 267 },
  { level: 5, min: 267, max: 303, nextRungTarget: null },
] as const;

export type FastTestReason = 'PM1' | 'PM2' | 'PM3';

export type FastCategoryCode = 'RP' | 'RI' | 'RGV';

export type FastCategoryAchievement =
  | 'Below the Standard'
  | 'At/Near the Standard'
  | 'Above the Standard';

export type ParsedFastCategoryPerformance = {
  category_code: FastCategoryCode;
  category_name: string;
  achievement_level: FastCategoryAchievement;
  achievement_level_description?: string | null;
  next_steps?: string | null;
};

export type ParsedFastItemResponse = {
  question_number: number;
  benchmark_code: string;
  reporting_category?: string | null;
  benchmark_description?: string | null;
  points_earned: number;
  points_possible: number;
  is_correct?: boolean;
};

export type ParsedFastReport = {
  fl_student_id: string;
  test_reason: FastTestReason;
  test_label?: string | null;
  assessment_grade: number;
  test_year: number;
  date_taken?: string | null;
  scale_score?: number | null;
  achievement_level?: number | null;
  percentile_rank?: number | null;
  category_performance: ParsedFastCategoryPerformance[];
  item_responses: ParsedFastItemResponse[];
};

export type BenchmarkClassificationMapRow = {
  benchmark_code: string;
  classification_code: string;
  weight: number;
  rationale?: string | null;
};

export type FastProfileSignal = {
  code: string;
  label: string;
  score: number;
};

export const FAST_SIGNAL_LABELS: Record<string, string> = {
  figurative_language_failure: 'Figurative and symbolic meaning',
  mood_misreading: 'Mood from word choice and details',
  tone_misreading: 'Tone and speaker attitude',
  inferencing_literal: 'Literal reading when inference is needed',
  topic_vs_theme_confusion: 'Theme versus topic',
  inferencing_schema: 'Inference schema/background knowledge',
  evidence_retrieval_failure: 'Finding the right evidence',
  vocabulary_gap: 'Vocabulary in context',
  structure_purpose_disconnect: 'Structure and author purpose',
  no_metacognitive_strategy: 'Monitoring confusion',
  comprehension_integration_failure: 'Putting details together',
  morphology_gap: 'Word parts and morphology',
  syntax_barrier: 'Sentence structure',
};

export const FAST_SIGNAL_ACTIONS: Record<string, string> = {
  figurative_language_failure:
    'Start with ELA.9.R.3.1: explain how figurative language creates mood, then confirm whether symbolic/layered meaning also needs ELA.9.R.1.1 support.',
  mood_misreading: 'Have students name mood from concrete details before interpreting theme.',
  tone_misreading: 'Use speaker attitude, diction, and contrast work before full analysis.',
  inferencing_literal: 'Teach students to move from stated detail to supported inference.',
  topic_vs_theme_confusion:
    'Separate what the text is about from what it says about life or people.',
  inferencing_schema: 'Build background structure before asking for independent inference.',
  evidence_retrieval_failure:
    'Practice locating and justifying the exact detail that proves an answer.',
  vocabulary_gap: 'Pre-teach high-leverage words and use context-clue routines.',
  structure_purpose_disconnect: 'Connect paragraph structure to author purpose before analysis.',
  no_metacognitive_strategy: 'Add stop-and-check moments so students notice confusion early.',
  comprehension_integration_failure: 'Use two-detail synthesis before longer response work.',
  morphology_gap: 'Teach prefixes, roots, and suffixes tied to passage vocabulary.',
  syntax_barrier: 'Unpack long sentences before asking inference or theme questions.',
};
