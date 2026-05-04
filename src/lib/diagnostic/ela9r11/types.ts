export const ELA9R11_STANDARD_CODE = 'ELA.9.R.1.1';

export type Ela9R11KeyElement =
  | 'setting'
  | 'plot'
  | 'characterization'
  | 'conflict'
  | 'point_of_view'
  | 'theme'
  | 'tone'
  | 'mood'
  | 'figurative_language'
  | 'symbolism'
  | 'structure';

export type Ela9R11LayerOrEffect =
  | 'literal_meaning'
  | 'implied_meaning'
  | 'mood'
  | 'tone'
  | 'theme'
  | 'character_development'
  | 'conflict_development'
  | 'purpose'
  | 'style'
  | 'irony'
  | 'symbolism'
  | 'point_of_view'
  | 'emotional_effect';

export type Ela9R11Subskill =
  | 'element_recognition'
  | 'element_function'
  | 'layer_of_meaning'
  | 'style_connection'
  | 'evidence_precision'
  | 'analytical_explanation'
  | 'distractor_resistance';

export type Ela9R11ItemType =
  | 'element_identification'
  | 'element_function'
  | 'layer_of_meaning'
  | 'evidence_selection'
  | 'explanation_evaluation'
  | 'constructed_response';

export type Ela9R11MisconceptionFlag =
  | 'element_not_identified'
  | 'element_misidentified'
  | 'function_not_explained'
  | 'effect_confused_with_summary'
  | 'meaning_connection_missing'
  | 'style_connection_missing'
  | 'evidence_irrelevant'
  | 'evidence_too_general'
  | 'evidence_misread'
  | 'quote_without_function'
  | 'analysis_too_vague'
  | 'literal_reading_only'
  | 'theme_element_confusion'
  | 'tone_mood_confusion'
  | 'point_of_view_effect_missing'
  | 'figurative_language_effect_missing'
  | 'structure_effect_missing';

export type Ela9R11TeachRoute =
  | 'mood'
  | 'tone'
  | 'evidence'
  | 'theme-builder'
  | 'figurative'
  | 'structure-purpose'
  | 'inferencing'
  | 'strategy';

export type Ela9R11AnswerOption = {
  letter: 'A' | 'B' | 'C' | 'D';
  text: string;
  correct: boolean;
  misconceptions: Ela9R11MisconceptionFlag[];
  rationale?: string;
};

export type Ela9R11EvidenceQuality = 'none' | 'weak' | 'partial' | 'strong';
export type Ela9R11AnalysisQuality = 'none' | 'summary_only' | 'partial' | 'strong';

export type Ela9R11ConstructedResponseEvaluation = {
  accepted: boolean;
  primaryMisconceptionFlag: Ela9R11MisconceptionFlag;
  secondaryFlags: Ela9R11MisconceptionFlag[];
  evidenceQuality: Ela9R11EvidenceQuality;
  analysisQuality: Ela9R11AnalysisQuality;
  studentFeedback: string;
  teacherNote: string;
  recommendedRoute: Ela9R11TeachRoute;
};

export type Ela9R11DiagnosticItem = {
  id: string;
  standardCode?: typeof ELA9R11_STANDARD_CODE;
  passageId?: string;
  itemType: Ela9R11ItemType;
  subskill: Ela9R11Subskill;
  subSkillsMeasured?: Ela9R11Subskill[];
  keyElement: Ela9R11KeyElement;
  layerOrEffect: Ela9R11LayerOrEffect;
  passageTitle: string;
  passage: string;
  stem: string;
  questionText?: string;
  options: Ela9R11AnswerOption[];
  evidenceTargets?: string[];
  teacherNote: string;
  teacherRationale?: string;
  correctAnswerRationale?: string;
  studentFriendlyFeedback?: string;
};

export type Ela9R11StudentAnswer = {
  itemId: string;
  selectedLetter?: 'A' | 'B' | 'C' | 'D';
  selectedEvidence?: string[];
  constructedResponse?: string;
  constructedEvaluation?: Ela9R11ConstructedResponseEvaluation;
};

export type Ela9R11ItemResult = {
  itemId: string;
  correct: boolean;
  selectedLetter: string | null;
  subskill: Ela9R11Subskill;
  keyElement: Ela9R11KeyElement;
  layerOrEffect: Ela9R11LayerOrEffect;
  misconceptions: Ela9R11MisconceptionFlag[];
  teacherRationale?: string;
  correctAnswerRationale?: string;
  selectedRationale?: string;
  constructedEvaluation?: Ela9R11ConstructedResponseEvaluation;
};

export type Ela9R11DiagnosticResult = {
  standardCode: typeof ELA9R11_STANDARD_CODE;
  totalItems: number;
  correctItems: number;
  primaryMisconception: Ela9R11MisconceptionFlag | null;
  secondaryMisconceptions: Ela9R11MisconceptionFlag[];
  recommendedRoute: Ela9R11TeachRoute;
  routeReason: string;
  itemResults: Ela9R11ItemResult[];
  teacherSummary: string;
};
