import type { SupabaseClient } from '@supabase/supabase-js';
import {
  FAST_CLASSIFICATION_CODES,
  FAST_GRADE_9_ELA_THRESHOLDS,
  FAST_SIGNAL_ACTIONS,
  FAST_SIGNAL_LABELS,
  type BenchmarkClassificationMapRow,
  type ParsedFastItemResponse,
} from './constants';
import { buildFastGrowthGoal, type FastGrowthGoal } from './growth';
import { getFastRecommendedStandardCode } from './routing';

type FastAssessmentRow = {
  id: string;
  test_reason: string;
  assessment_grade: number | null;
  test_year: number;
  date_taken: string | null;
  scale_score: number | null;
  achievement_level: number | null;
};

type ProfileInput = {
  assessments: FastAssessmentRow[];
  itemResponses: (ParsedFastItemResponse & { fast_assessment_id: string })[];
  classificationMap: BenchmarkClassificationMapRow[];
};

type BenchmarkSummary = {
  benchmark_code: string;
  attempts: number;
  correct: number;
  pct_correct: number;
  missed: number;
};

export type BuiltFastProfile = {
  source_assessment_ids: string[];
  classification_scores: Record<string, number>;
  benchmark_strengths: Record<string, BenchmarkSummary>;
  benchmark_weaknesses: Record<string, BenchmarkSummary>;
  trajectory_data: {
    assessments: FastAssessmentRow[];
    latest_assessment_id: string | null;
  };
  current_achievement_level: number | null;
  next_rung_target: number | null;
  points_to_next_rung: number | null;
  top_strengths: BenchmarkSummary[];
  top_weaknesses: BenchmarkSummary[];
  confidence_label: 'strong_signal' | 'emerging_signal' | 'not_enough_data';
  interpretation: FastProfileInterpretation;
};

type FastProfileInterpretation = {
  summary: string;
  first_instructional_move: string;
  confidence_rationale: string;
  top_barriers: Array<{
    code: string;
    label: string;
    strength: number;
    band: 'Strong signal' | 'Moderate signal' | 'Emerging signal';
    action: string;
  }>;
  benchmark_evidence: Array<{
    benchmark_code: string;
    pct_correct: number;
    attempts: number;
    evidence_label: string;
  }>;
  recommended_next_step: {
    route: 'diagnostic' | 'layer0_calibration' | 'teacher_review';
    label: string;
    reason: string;
    standard_code?: string;
  };
  growth_goal: FastGrowthGoal | null;
};

function roundSignal(value: number) {
  return Math.round(value * 1000) / 1000;
}

function sortAssessments(a: FastAssessmentRow, b: FastAssessmentRow) {
  if (a.test_year !== b.test_year) return b.test_year - a.test_year;
  const pmOrder: Record<string, number> = { PM3: 3, PM2: 2, PM1: 1 };
  const pmDelta = (pmOrder[b.test_reason] ?? 0) - (pmOrder[a.test_reason] ?? 0);
  if (pmDelta) return pmDelta;
  return String(b.date_taken ?? '').localeCompare(String(a.date_taken ?? ''));
}

function getNextRung(scaleScore: number | null, achievementLevel: number | null) {
  if (scaleScore === null || achievementLevel === null) {
    return { next_rung_target: null, points_to_next_rung: null };
  }

  const level = FAST_GRADE_9_ELA_THRESHOLDS.find((row) => row.level === achievementLevel);
  if (!level || level.nextRungTarget === null) {
    return { next_rung_target: null, points_to_next_rung: null };
  }

  return {
    next_rung_target: level.nextRungTarget,
    points_to_next_rung: Math.max(0, level.nextRungTarget - scaleScore),
  };
}

function buildFastInterpretation(args: {
  classificationScores: Record<string, number>;
  summaries: BenchmarkSummary[];
  latest: FastAssessmentRow | null;
}): Pick<BuiltFastProfile, 'confidence_label' | 'interpretation'> {
  const scored = Object.entries(args.classificationScores)
    .filter(([, score]) => score > 0)
    .sort(([, a], [, b]) => b - a);
  const topScore = scored[0]?.[1] ?? 0;
  const missedItems = args.summaries.reduce((sum, benchmark) => sum + benchmark.missed, 0);
  const totalAttempts = args.summaries.reduce((sum, benchmark) => sum + benchmark.attempts, 0);

  const confidence_label =
    totalAttempts < 20 || missedItems < 3
      ? 'not_enough_data'
      : topScore >= 2 && missedItems >= 8
        ? 'strong_signal'
        : 'emerging_signal';

  const topBarriers = scored.slice(0, 3).map(([code, score]) => {
    const strength = topScore > 0 ? Math.round((score / topScore) * 100) : 0;
    return {
      code,
      label: FAST_SIGNAL_LABELS[code] ?? code.replace(/_/g, ' '),
      strength,
      band:
        strength >= 80
          ? ('Strong signal' as const)
          : strength >= 50
            ? ('Moderate signal' as const)
            : ('Emerging signal' as const),
      action:
        FAST_SIGNAL_ACTIONS[code] ?? 'Use a short diagnostic to confirm the instructional driver.',
    };
  });

  const benchmarkEvidence = args.summaries
    .filter((benchmark) => benchmark.pct_correct < 0.7)
    .slice(0, 5)
    .map((benchmark) => ({
      benchmark_code: benchmark.benchmark_code,
      pct_correct: benchmark.pct_correct,
      attempts: benchmark.attempts,
      evidence_label:
        benchmark.pct_correct === 0
          ? 'No correct items'
          : benchmark.pct_correct < 0.4
            ? 'Low accuracy'
            : 'Mixed accuracy',
    }));

  const primary = topBarriers[0];
  const recommendedStandardCode = getFastRecommendedStandardCode(primary?.code);
  const levelText = args.latest?.achievement_level
    ? `FAST Level ${args.latest.achievement_level}`
    : 'FAST';
  const summary = primary
    ? `${levelText} evidence suggests the first reading barrier to check is ${primary.label.toLowerCase()}.`
    : `${levelText} evidence did not produce a clear missed-benchmark pattern yet.`;

  const recommended_next_step =
    confidence_label === 'not_enough_data'
      ? {
          route: 'teacher_review' as const,
          label: 'Review the uploaded ISR and confirm item parsing',
          reason:
            'There are not enough missed-item signals to make a dependable first recommendation.',
        }
      : {
          route: 'diagnostic' as const,
          label: `Assign ${recommendedStandardCode} diagnostic`,
          reason: primary
            ? `The strongest FAST signal is ${primary.label.toLowerCase()}, so the next step should confirm the misconception with student response evidence.`
            : 'The FAST profile needs a student response before choosing an intervention.',
          standard_code: recommendedStandardCode,
        };
  const rung = getNextRung(
    args.latest?.scale_score ?? null,
    args.latest?.achievement_level ?? null
  );
  const growth_goal = buildFastGrowthGoal({
    scaleScore: args.latest?.scale_score,
    achievementLevel: args.latest?.achievement_level,
    nextRungTarget: rung.next_rung_target,
    pointsToNextRung: rung.points_to_next_rung,
  });

  return {
    confidence_label,
    interpretation: {
      summary,
      first_instructional_move:
        primary?.action ?? 'Run the first literacy diagnostic before assigning intervention.',
      confidence_rationale:
        confidence_label === 'strong_signal'
          ? 'Multiple missed items point to the same cognitive-reading barrier.'
          : confidence_label === 'emerging_signal'
            ? 'The pattern is visible, but GOGI should confirm it with a diagnostic response.'
            : 'The report did not provide enough consistent missed-item evidence for a strong recommendation.',
      top_barriers: topBarriers,
      benchmark_evidence: benchmarkEvidence,
      recommended_next_step,
      growth_goal,
    },
  };
}

export function buildFastColdStartProfile(input: ProfileInput): BuiltFastProfile {
  const assessments = [...input.assessments].sort(sortAssessments);
  const latest = assessments[0] ?? null;
  const latestAssessmentId = latest?.id ?? null;
  const sourceAssessmentIds = assessments.map((assessment) => assessment.id);

  const classificationScores = Object.fromEntries(
    FAST_CLASSIFICATION_CODES.map((code) => [code, 0])
  ) as Record<string, number>;

  const mapByBenchmark = input.classificationMap.reduce<
    Record<string, BenchmarkClassificationMapRow[]>
  >((acc, row) => {
    if (!acc[row.benchmark_code]) acc[row.benchmark_code] = [];
    acc[row.benchmark_code].push(row);
    return acc;
  }, {});

  const benchmarkStats = new Map<string, BenchmarkSummary>();

  for (const item of input.itemResponses) {
    const possible = Number(item.points_possible || 1);
    const earned = Number(item.points_earned || 0);
    const isCorrect = item.is_correct ?? earned >= possible;
    const benchmarkCode = item.benchmark_code;

    const current = benchmarkStats.get(benchmarkCode) ?? {
      benchmark_code: benchmarkCode,
      attempts: 0,
      correct: 0,
      pct_correct: 0,
      missed: 0,
    };

    current.attempts += 1;
    current.correct += isCorrect ? 1 : 0;
    current.missed += isCorrect ? 0 : 1;
    current.pct_correct = roundSignal(current.correct / current.attempts);
    benchmarkStats.set(benchmarkCode, current);

    if (isCorrect) continue;

    for (const mapping of mapByBenchmark[benchmarkCode] ?? []) {
      classificationScores[mapping.classification_code] = roundSignal(
        (classificationScores[mapping.classification_code] ?? 0) + Number(mapping.weight)
      );
    }
  }

  const summaries = [...benchmarkStats.values()].sort((a, b) => {
    if (a.pct_correct !== b.pct_correct) return a.pct_correct - b.pct_correct;
    return b.attempts - a.attempts;
  });

  const benchmarkWeaknesses = Object.fromEntries(
    summaries
      .filter((summary) => summary.pct_correct < 0.7)
      .map((summary) => [summary.benchmark_code, summary])
  );
  const benchmarkStrengths = Object.fromEntries(
    summaries
      .filter((summary) => summary.pct_correct >= 0.8)
      .map((summary) => [summary.benchmark_code, summary])
  );

  const rung = getNextRung(latest?.scale_score ?? null, latest?.achievement_level ?? null);
  const interpreted = buildFastInterpretation({
    classificationScores,
    summaries,
    latest,
  });

  return {
    source_assessment_ids: sourceAssessmentIds,
    classification_scores: classificationScores,
    benchmark_strengths: benchmarkStrengths,
    benchmark_weaknesses: benchmarkWeaknesses,
    trajectory_data: {
      assessments,
      latest_assessment_id: latestAssessmentId,
    },
    current_achievement_level: latest?.achievement_level ?? null,
    next_rung_target: rung.next_rung_target,
    points_to_next_rung: rung.points_to_next_rung,
    top_strengths: summaries
      .filter((summary) => summary.pct_correct >= 0.8)
      .slice(-5)
      .reverse(),
    top_weaknesses: summaries.filter((summary) => summary.pct_correct < 0.7).slice(0, 5),
    confidence_label: interpreted.confidence_label,
    interpretation: interpreted.interpretation,
  };
}

export async function generateFastProfileForStudent(
  supabase: Pick<SupabaseClient, 'from'>,
  studentId: string
) {
  const { data: assessments, error: assessmentError } = await supabase
    .from('fast_assessments')
    .select(
      'id, test_reason, assessment_grade, test_year, date_taken, scale_score, achievement_level'
    )
    .eq('student_id', studentId);

  if (assessmentError) throw new Error(assessmentError.message);
  if (!assessments?.length) throw new Error('No FAST assessments found for this student.');

  const assessmentIds = assessments.map((assessment: FastAssessmentRow) => assessment.id);

  const { data: itemResponses, error: itemError } = await supabase
    .from('fast_item_responses')
    .select(
      'fast_assessment_id, question_number, benchmark_code, reporting_category, benchmark_description, points_earned, points_possible, is_correct'
    )
    .in('fast_assessment_id', assessmentIds);

  if (itemError) throw new Error(itemError.message);

  const { data: classificationMap, error: mapError } = await supabase
    .from('fast_benchmark_classification_map')
    .select('benchmark_code, classification_code, weight, rationale');

  if (mapError) throw new Error(mapError.message);

  const profile = buildFastColdStartProfile({
    assessments,
    itemResponses: itemResponses ?? [],
    classificationMap: classificationMap ?? [],
  });

  const { error: deactivateError } = await supabase
    .from('student_cognitive_profiles')
    .update({ active: false })
    .eq('student_id', studentId)
    .eq('active', true);

  if (deactivateError) throw new Error(deactivateError.message);

  const { data: insertedProfile, error: insertError } = await supabase
    .from('student_cognitive_profiles')
    .insert({
      student_id: studentId,
      generated_from: 'fast_isr',
      source_assessment_ids: profile.source_assessment_ids,
      classification_scores: profile.classification_scores,
      benchmark_strengths: profile.benchmark_strengths,
      benchmark_weaknesses: profile.benchmark_weaknesses,
      trajectory_data: profile.trajectory_data,
      current_achievement_level: profile.current_achievement_level,
      next_rung_target: profile.next_rung_target,
      points_to_next_rung: profile.points_to_next_rung,
      top_strengths: profile.top_strengths,
      top_weaknesses: profile.top_weaknesses,
      confidence_label: profile.confidence_label,
      interpretation: profile.interpretation,
      active: true,
    })
    .select('*')
    .single();

  if (insertError) throw new Error(insertError.message);

  return insertedProfile;
}
