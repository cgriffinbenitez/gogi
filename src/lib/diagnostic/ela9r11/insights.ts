import { ELA9R11_MISCONCEPTIONS } from './misconceptions';
import type { Ela9R11DiagnosticResult, Ela9R11MisconceptionFlag, Ela9R11TeachRoute } from './types';
import type { Layer0Band, LoadCalibration } from '@/lib/layer0/scoring';

export type DiagnosticConfidenceLabel = 'strong_signal' | 'emerging_signal' | 'not_enough_data';
export type DiagnosticDriver =
  | 'literacy_gap'
  | 'cognitive_load_interaction'
  | 'mastery_ready'
  | 'insufficient_evidence';

export type Layer0InsightInput = {
  layer0AssessmentId: string | null;
  loadCalibration: LoadCalibration | null;
  teacherReviewFlag: boolean;
  dsbBand?: Layer0Band | null;
  cptBand?: Layer0Band | null;
  sdstBand?: Layer0Band | null;
  rtvBand?: Layer0Band | null;
};

export type MisconceptionMapEntry = {
  flag: Ela9R11MisconceptionFlag;
  label: string;
  count: number;
  route: Ela9R11TeachRoute;
  studentNeed: string;
  teacherDescription: string;
};

export type Ela9R11DiagnosticInsight = {
  standardCode: 'ELA.9.R.1.1';
  correctItems: number;
  totalItems: number;
  primaryMisconception: Ela9R11MisconceptionFlag | null;
  secondaryMisconceptions: Ela9R11MisconceptionFlag[];
  misconceptionMap: MisconceptionMapEntry[];
  confidenceLabel: DiagnosticConfidenceLabel;
  confidenceScore: number;
  likelyDriver: DiagnosticDriver;
  recommendedRoute: Ela9R11TeachRoute;
  loadCalibration: LoadCalibration;
  layer0AssessmentId: string | null;
  cognitiveLoadFlags: string[];
  instructionalHypothesis: string;
  interventionDesign: string[];
  prePostLookFors: string[];
  teacherSummary: string;
};

export function buildEla9R11DiagnosticInsight(
  result: Ela9R11DiagnosticResult,
  layer0: Layer0InsightInput
): Ela9R11DiagnosticInsight {
  const misconceptionMap = buildMisconceptionMap(result);
  const primaryCount = misconceptionMap[0]?.count ?? 0;
  const incorrectItems = Math.max(result.totalItems - result.correctItems, 0);
  const primaryShare = incorrectItems ? primaryCount / incorrectItems : 0;
  const confidence = confidenceFromEvidence(
    result.totalItems,
    primaryCount,
    primaryShare,
    incorrectItems
  );
  const loadCalibration = layer0.loadCalibration ?? 'standard';
  const cognitiveLoadFlags = cognitiveFlags(layer0);
  const likelyDriver = driverFromEvidence(
    result,
    confidence.label,
    loadCalibration,
    cognitiveLoadFlags
  );
  const recommendedRoute = result.recommendedRoute;

  return {
    standardCode: 'ELA.9.R.1.1',
    correctItems: result.correctItems,
    totalItems: result.totalItems,
    primaryMisconception: result.primaryMisconception,
    secondaryMisconceptions: result.secondaryMisconceptions,
    misconceptionMap,
    confidenceLabel: confidence.label,
    confidenceScore: confidence.score,
    likelyDriver,
    recommendedRoute,
    loadCalibration,
    layer0AssessmentId: layer0.layer0AssessmentId,
    cognitiveLoadFlags,
    instructionalHypothesis: buildHypothesis(
      result,
      likelyDriver,
      loadCalibration,
      cognitiveLoadFlags
    ),
    interventionDesign: interventionDesignFor(loadCalibration, result.primaryMisconception),
    prePostLookFors: prePostLookFors(
      result.primaryMisconception,
      recommendedRoute,
      loadCalibration
    ),
    teacherSummary: result.teacherSummary,
  };
}

function buildMisconceptionMap(result: Ela9R11DiagnosticResult): MisconceptionMapEntry[] {
  const counts = new Map<Ela9R11MisconceptionFlag, number>();
  result.itemResults.forEach((item) => {
    if (item.correct) return;
    item.misconceptions.forEach((flag) => counts.set(flag, (counts.get(flag) ?? 0) + 1));
  });

  return [...counts.entries()]
    .sort(([flagA, countA], [flagB, countB]) => {
      if (countA !== countB) return countB - countA;
      return ELA9R11_MISCONCEPTIONS[flagB].priority - ELA9R11_MISCONCEPTIONS[flagA].priority;
    })
    .map(([flag, count]) => {
      const spec = ELA9R11_MISCONCEPTIONS[flag];
      return {
        flag,
        label: spec.label,
        count,
        route: spec.route,
        studentNeed: spec.studentNeed,
        teacherDescription: spec.teacherDescription,
      };
    });
}

function confidenceFromEvidence(
  totalItems: number,
  primaryCount: number,
  primaryShare: number,
  incorrectItems: number
): { label: DiagnosticConfidenceLabel; score: number } {
  if (totalItems < 8 || incorrectItems === 0) {
    return {
      label: incorrectItems === 0 ? 'strong_signal' : 'not_enough_data',
      score: incorrectItems === 0 ? 92 : 35,
    };
  }

  const score = Math.min(95, Math.round(35 + primaryCount * 12 + primaryShare * 35));
  if (primaryCount >= 3 && primaryShare >= 0.45) return { label: 'strong_signal', score };
  if (primaryCount >= 2) return { label: 'emerging_signal', score: Math.max(score, 62) };
  return { label: 'not_enough_data', score: Math.min(score, 55) };
}

function cognitiveFlags(layer0: Layer0InsightInput) {
  const flags: string[] = [];
  if (layer0.dsbBand === 'low') flags.push('working_memory_low');
  if (layer0.cptBand === 'low') flags.push('attention_control_low');
  if (layer0.sdstBand === 'low') flags.push('processing_speed_low');
  if (layer0.rtvBand === 'low') flags.push('response_consistency_low');
  if (layer0.teacherReviewFlag) flags.push('layer0_teacher_review');
  return flags;
}

function driverFromEvidence(
  result: Ela9R11DiagnosticResult,
  confidence: DiagnosticConfidenceLabel,
  loadCalibration: LoadCalibration,
  cognitiveLoadFlags: string[]
): DiagnosticDriver {
  if (result.correctItems >= result.totalItems) return 'mastery_ready';
  if (confidence === 'not_enough_data') return 'insufficient_evidence';
  if (loadCalibration !== 'standard' || cognitiveLoadFlags.length >= 2) {
    return 'cognitive_load_interaction';
  }
  return 'literacy_gap';
}

function buildHypothesis(
  result: Ela9R11DiagnosticResult,
  driver: DiagnosticDriver,
  loadCalibration: LoadCalibration,
  cognitiveLoadFlags: string[]
) {
  if (driver === 'mastery_ready') {
    return 'Current evidence suggests the student can perform the 9.R.1.1 move under this diagnostic load.';
  }
  if (driver === 'insufficient_evidence') {
    return 'The diagnostic did not produce a stable misconception cluster yet. Use another response before treating the route as settled.';
  }

  const primary = result.primaryMisconception
    ? ELA9R11_MISCONCEPTIONS[result.primaryMisconception].label.toLowerCase()
    : 'the literacy move';
  if (driver === 'cognitive_load_interaction') {
    const flagText = cognitiveLoadFlags.length
      ? ` Flags: ${cognitiveLoadFlags.map((flag) => flag.replace(/_/g, ' ')).join(', ')}.`
      : '';
    return `The student shows ${primary}, and Layer 0 suggests the task load may be shaping the reading error pattern (${loadCalibration.replace(/_/g, ' ')}).${flagText}`;
  }
  return `The strongest current signal is a literacy misconception: ${primary}. Layer 0 does not currently suggest major load reduction beyond normal supports.`;
}

function interventionDesignFor(
  loadCalibration: LoadCalibration,
  primary: Ela9R11MisconceptionFlag | null
) {
  const primaryNeed = primary
    ? ELA9R11_MISCONCEPTIONS[primary].studentNeed
    : 'Confirm the student can transfer the full 9.R.1.1 move.';
  const base = [`Target move: ${primaryNeed}`];

  if (loadCalibration === 'maximum_reduction') {
    return [
      ...base,
      'Use one passage chunk, one visible model, and one response move at a time.',
      'Reduce answer choices and keep the element/evidence/effect frame visible.',
      'Require teacher review before treating mastery evidence as stable.',
    ];
  }
  if (loadCalibration === 'reduced') {
    return [
      ...base,
      'Keep directions visible and split the response into element, evidence, and effect.',
      'Use short checks for each move before asking for the full analytical response.',
    ];
  }
  return [
    ...base,
    'Use the standard teach loop and fade scaffolds after the student explains effect with evidence.',
  ];
}

function prePostLookFors(
  primary: Ela9R11MisconceptionFlag | null,
  route: Ela9R11TeachRoute,
  loadCalibration: LoadCalibration
) {
  const routeText = route.replace(/-/g, ' ');
  const lookFors = [
    `Next response should show fewer ${primary ? ELA9R11_MISCONCEPTIONS[primary].label.toLowerCase() : 'general 9.R.1.1'} errors.`,
    `Student should complete the ${routeText} transfer check with a clearer element/evidence/effect link.`,
    'Reassessment should show the same move on a new passage, not only recall of the teach example.',
  ];
  if (loadCalibration !== 'standard') {
    lookFors.push(
      'Track whether the student can keep accuracy when scaffolds are gradually reduced.'
    );
  }
  return lookFors;
}
