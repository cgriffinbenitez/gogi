import { getFastRecommendedStandardCode, standardCodeToRouteId } from '../fast/routing';
import {
  FAST_GRADE9_READING_DEMANDS,
  getPrimaryFastReadingDemand,
  type FastGrade9ReadingDemand,
} from './fastSkillMap';

type ProfileBarrier = {
  code: string;
  label: string;
  strength?: number | null;
  band?: string | null;
  action?: string | null;
};

type BenchmarkEvidence = {
  benchmark_code: string;
  pct_correct: number;
  attempts: number;
  evidence_label?: string | null;
};

type BenchmarkSummary = {
  benchmark_code: string;
  pct_correct: number;
  attempts: number;
};

export type DailyFastProfile = {
  confidence_label: string | null;
  current_achievement_level: number | null;
  points_to_next_rung: number | null;
  interpretation: {
    summary?: string;
    recommended_next_step?: {
      standard_code?: string;
      label?: string;
      reason?: string;
    };
    top_barriers?: ProfileBarrier[];
    benchmark_evidence?: BenchmarkEvidence[];
  } | null;
  top_weaknesses?: BenchmarkSummary[] | null;
};

export type DailyStandardStatus = {
  status: 'notStarted' | 'inDiagnostic' | 'inIntervention' | 'mastered';
  sessionsAttempted: number;
  sessionsPassed: number;
  currentGap?: string | null;
};

export type DailyResponseEvidence = {
  standardCode: string | null;
  createdAt: string | null;
  transferCorrect: boolean | null;
  clinicalFlag: boolean | null;
  masteryAchieved: boolean | null;
};

type ReadingWinRecentSignal =
  | 'new_gap'
  | 'repeat_for_transfer'
  | 'increase_difficulty'
  | 'continue_gap';

export type DailyReadingWinAssignment =
  | {
      kind: 'needs_fast_profile';
      title: string;
      studentTitle: string;
      teacherTitle: string;
      standardCode: null;
      route: string;
      cta: string;
      why: string;
      confidence: 'not_enough_data';
      sessionPlan: string[];
      nextDecisionRule: string;
    }
  | {
      kind: 'needs_layer0';
      title: string;
      studentTitle: string;
      teacherTitle: string;
      standardCode: null;
      route: string;
      cta: string;
      why: string;
      confidence: 'emerging_signal' | 'strong_signal' | 'not_enough_data';
      sessionPlan: string[];
      nextDecisionRule: string;
    }
  | {
      kind: 'needs_content_library';
      title: string;
      studentTitle: string;
      teacherTitle: string;
      standardCode: null;
      route: string;
      cta: string;
      why: string;
      confidence: 'emerging_signal' | 'strong_signal' | 'not_enough_data';
      sessionPlan: string[];
      nextDecisionRule: string;
    }
  | {
      kind: 'reading_win';
      title: string;
      studentTitle: string;
      teacherTitle: string;
      standardCode: string;
      route: string;
      cta: string;
      why: string;
      confidence: 'emerging_signal' | 'strong_signal' | 'not_enough_data';
      demand: FastGrade9ReadingDemand;
      sessionPlan: string[];
      nextDecisionRule: string;
      recentSignal: ReadingWinRecentSignal;
    };

type BuildDailyReadingWinArgs = {
  fastProfile: DailyFastProfile | null;
  layer0Complete: boolean;
  standardStatuses: Record<string, DailyStandardStatus | undefined>;
  availableStandardCodes: string[];
  recentResponses?: DailyResponseEvidence[];
};

type Candidate = {
  standardCode: string;
  score: number;
  reason: string;
};

const DEFAULT_CONFIDENCE = 'not_enough_data' as const;

function normalizeConfidence(value: string | null | undefined) {
  if (value === 'strong_signal' || value === 'emerging_signal') return value;
  return DEFAULT_CONFIDENCE;
}

function pushCandidate(
  candidates: Candidate[],
  available: Set<string>,
  standardCode: string | null | undefined,
  score: number,
  reason: string
) {
  if (!standardCode || !available.has(standardCode)) return;
  candidates.push({ standardCode, score, reason });
}

function latestForStandard(responses: DailyResponseEvidence[], standardCode: string) {
  return responses.find((response) => response.standardCode === standardCode) ?? null;
}

function dedupeCandidates(candidates: Candidate[]) {
  const byStandard = new Map<string, Candidate>();
  for (const candidate of candidates) {
    const existing = byStandard.get(candidate.standardCode);
    if (!existing || candidate.score > existing.score) {
      byStandard.set(candidate.standardCode, candidate);
    }
  }
  return [...byStandard.values()].sort((a, b) => b.score - a.score);
}

export function buildDailyReadingWinAssignment(
  args: BuildDailyReadingWinArgs
): DailyReadingWinAssignment {
  const confidence = normalizeConfidence(args.fastProfile?.confidence_label);

  if (!args.fastProfile) {
    return {
      kind: 'needs_fast_profile',
      title: 'Start with reading evidence',
      studentTitle: 'Get your FAST profile loaded',
      teacherTitle: 'FAST profile needed',
      standardCode: null,
      route: '/dashboard/student',
      cta: 'Waiting on FAST profile',
      why: 'GOGI needs the uploaded FAST evidence before choosing a daily Reading Win.',
      confidence: DEFAULT_CONFIDENCE,
      sessionPlan: [
        'Teacher uploads the FAST report.',
        'GOGI builds the first gap map.',
        'Student gets one daily Reading Win.',
      ],
      nextDecisionRule:
        'Once a FAST profile exists, GOGI chooses the highest-priority readable gap.',
    };
  }

  if (!args.layer0Complete) {
    return {
      kind: 'needs_layer0',
      title: 'Today: calibrate support',
      studentTitle: 'Calibrate my support',
      teacherTitle: 'Layer 0 support calibration',
      standardCode: null,
      route: '/layer0',
      cta: 'Calibrate my support →',
      why: 'GOGI has the reading evidence, but needs the support profile before assigning daily remediation load.',
      confidence,
      sessionPlan: [
        'Measure working memory, attention, speed, and consistency.',
        'Set hint, chunking, and pacing level.',
        'Unlock the first Reading Win.',
      ],
      nextDecisionRule:
        'After Layer 0, GOGI assigns the top FAST-aligned Reading Win at the right support load.',
    };
  }

  const available = new Set(args.availableStandardCodes);
  if (available.size === 0) {
    return {
      kind: 'needs_content_library',
      title: 'Reading Win library needed',
      studentTitle: "Today's win is being built",
      teacherTitle: 'No assignable Reading Win content yet',
      standardCode: null,
      route: '/dashboard/student',
      cta: 'Teacher is building today’s win',
      why: 'GOGI has the FAST profile and support calibration, but no standard has enough approved, high-quality content for a full Reading Win loop yet.',
      confidence,
      sessionPlan: [
        'Teacher builds or approves a FAST-aligned content set.',
        'GOGI checks for five reps plus one transfer passage.',
        'Student receives the strongest ready Reading Win.',
      ],
      nextDecisionRule:
        'GOGI should not assign a standard until the question bank passes the Reading Win quality and transfer gate.',
    };
  }

  const candidates: Candidate[] = [];
  const recommended = args.fastProfile.interpretation?.recommended_next_step?.standard_code;

  pushCandidate(
    candidates,
    available,
    recommended,
    120,
    args.fastProfile.interpretation?.recommended_next_step?.reason ??
      'FAST profile recommends this as the first instructional move.'
  );

  args.fastProfile.interpretation?.top_barriers?.forEach((barrier, index) => {
    pushCandidate(
      candidates,
      available,
      getFastRecommendedStandardCode(barrier.code),
      110 - index * 12 + Math.round((barrier.strength ?? 0) / 10),
      `${barrier.label} is a top FAST barrier.`
    );
  });

  args.fastProfile.interpretation?.benchmark_evidence?.forEach((benchmark, index) => {
    const weaknessBoost = Math.round((1 - benchmark.pct_correct) * 40);
    pushCandidate(
      candidates,
      available,
      benchmark.benchmark_code,
      92 - index * 7 + weaknessBoost,
      `${benchmark.benchmark_code} shows ${benchmark.evidence_label?.toLowerCase() ?? 'missed-item evidence'}.`
    );
  });

  args.fastProfile.top_weaknesses?.forEach((benchmark, index) => {
    const weaknessBoost = Math.round((1 - benchmark.pct_correct) * 34);
    pushCandidate(
      candidates,
      available,
      benchmark.benchmark_code,
      82 - index * 6 + weaknessBoost,
      `${benchmark.benchmark_code} is one of the lowest FAST benchmark signals.`
    );
  });

  for (const demand of FAST_GRADE9_READING_DEMANDS) {
    pushCandidate(
      candidates,
      available,
      demand.standardCode,
      30,
      'Fallback Grade 9 FAST Reading Win coverage.'
    );
  }

  const ranked = dedupeCandidates(candidates)
    .map((candidate) => {
      const status = args.standardStatuses[candidate.standardCode];
      const recent = latestForStandard(args.recentResponses ?? [], candidate.standardCode);
      let adjustment = 0;
      let recentSignal: ReadingWinRecentSignal = 'new_gap';

      if (status?.status === 'mastered') adjustment -= 90;
      if (status?.status === 'inIntervention') adjustment += 12;
      if (status?.sessionsAttempted && status.sessionsAttempted > status.sessionsPassed) {
        adjustment += 10;
      }

      if (recent?.clinicalFlag || recent?.transferCorrect === false) {
        adjustment += 34;
        recentSignal = 'repeat_for_transfer';
      } else if (recent?.transferCorrect === true) {
        adjustment -= 24;
        recentSignal = 'increase_difficulty';
      } else if (status?.sessionsAttempted) {
        recentSignal = 'continue_gap';
      }

      return { ...candidate, score: candidate.score + adjustment, recentSignal };
    })
    .sort((a, b) => b.score - a.score);

  const selected = ranked[0];
  const standardCode = selected?.standardCode ?? 'ELA.9.R.1.1';
  const demand = getPrimaryFastReadingDemand(standardCode) ?? FAST_GRADE9_READING_DEMANDS[0];
  const route = `/standard/${standardCodeToRouteId(standardCode)}/intervention`;
  const pointsText =
    args.fastProfile.points_to_next_rung === null ||
    args.fastProfile.points_to_next_rung === undefined
      ? 'the next FAST goal'
      : `${args.fastProfile.points_to_next_rung} points to the next FAST rung`;
  const recentSignal = selected?.recentSignal ?? 'new_gap';
  const cta =
    recentSignal === 'repeat_for_transfer'
      ? 'Retry today’s win →'
      : recentSignal === 'increase_difficulty'
        ? 'Level up today →'
        : 'Start today’s win →';

  return {
    kind: 'reading_win',
    title: "Today's Reading Win",
    studentTitle: demand.studentTitle,
    teacherTitle: demand.teacherTitle,
    standardCode,
    route,
    cta,
    why: `${selected?.reason ?? 'GOGI selected the best available Grade 9 FAST Reading Win'} This supports ${pointsText}.`,
    confidence,
    demand,
    sessionPlan: [
      'Read one FAST-style passage.',
      'Answer five scaffolded reps on one cognitive move.',
      'Finish with a transfer question on a new passage.',
      'GOGI uses the result to choose tomorrow’s win.',
    ],
    nextDecisionRule:
      'If transfer is correct, raise difficulty or move to the next gap. If not, repeat the same move with clearer support and a new passage.',
    recentSignal,
  };
}

export function parseDailyResponseEvidence(row: {
  student_response: string | null;
  mastery_achieved?: boolean | null;
  created_at?: string | null;
}): DailyResponseEvidence {
  try {
    const parsed = JSON.parse(row.student_response ?? '{}') as {
      standard_code?: string | null;
      transfer_correct?: boolean | null;
      clinical_flag?: boolean | null;
      closing_response?: string | null;
    };
    return {
      standardCode: parsed.standard_code ?? null,
      createdAt: row.created_at ?? null,
      transferCorrect:
        typeof parsed.transfer_correct === 'boolean' ? parsed.transfer_correct : null,
      clinicalFlag: typeof parsed.clinical_flag === 'boolean' ? parsed.clinical_flag : null,
      masteryAchieved: row.mastery_achieved ?? null,
    };
  } catch {
    return {
      standardCode: null,
      createdAt: row.created_at ?? null,
      transferCorrect: null,
      clinicalFlag: null,
      masteryAchieved: row.mastery_achieved ?? null,
    };
  }
}
