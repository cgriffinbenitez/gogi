import { FAST_GRADE_9_ELA_THRESHOLDS } from './constants';

export type FastTrajectoryAssessment = {
  id: string;
  test_reason: string;
  assessment_grade?: number | null;
  test_year: number;
  date_taken: string | null;
  scale_score: number | null;
  achievement_level: number | null;
};

export type FastTrajectoryPoint = FastTrajectoryAssessment & {
  sequence_label: string;
  growth_from_previous: number | null;
  crossed_rung_from_previous: boolean;
};

export type FastTrajectorySummary = {
  points: FastTrajectoryPoint[];
  first_score: number | null;
  latest_score: number | null;
  total_growth: number | null;
  first_level: number | null;
  latest_level: number | null;
  crossed_rung: boolean;
  narrative: string;
};

function getPmOrder(testReason: string) {
  const order: Record<string, number> = { PM1: 1, PM2: 2, PM3: 3 };
  return order[testReason] ?? 0;
}

function levelForScore(scaleScore: number | null | undefined) {
  if (scaleScore === null || scaleScore === undefined) return null;
  return (
    FAST_GRADE_9_ELA_THRESHOLDS.find(
      (threshold) => scaleScore >= threshold.min && scaleScore <= threshold.max
    )?.level ?? null
  );
}

export function sortFastTrajectoryAssessments<T extends FastTrajectoryAssessment>(
  assessments: T[]
) {
  return [...assessments].sort((a, b) => {
    if (a.test_year !== b.test_year) return a.test_year - b.test_year;
    const pmDelta = getPmOrder(a.test_reason) - getPmOrder(b.test_reason);
    if (pmDelta) return pmDelta;
    return String(a.date_taken ?? '').localeCompare(String(b.date_taken ?? ''));
  });
}

export function buildFastTrajectorySummary(
  assessments: FastTrajectoryAssessment[]
): FastTrajectorySummary {
  const points = sortFastTrajectoryAssessments(assessments).map((assessment, index, sorted) => {
    const previous = sorted[index - 1] ?? null;
    const currentScore = assessment.scale_score;
    const previousScore = previous?.scale_score ?? null;
    const growth =
      currentScore === null || previousScore === null ? null : currentScore - previousScore;
    const currentLevel = assessment.achievement_level ?? levelForScore(currentScore);
    const previousLevel = previous?.achievement_level ?? levelForScore(previousScore);

    return {
      ...assessment,
      sequence_label: `${assessment.test_reason} ${assessment.test_year}`,
      growth_from_previous: growth,
      crossed_rung_from_previous:
        currentLevel !== null && previousLevel !== null && currentLevel > previousLevel,
    };
  });

  const scoredPoints = points.filter((point) => point.scale_score !== null);
  const first = scoredPoints[0] ?? null;
  const latest = scoredPoints[scoredPoints.length - 1] ?? null;
  const firstScore = first?.scale_score ?? null;
  const latestScore = latest?.scale_score ?? null;
  const totalGrowth = firstScore === null || latestScore === null ? null : latestScore - firstScore;
  const firstLevel = first?.achievement_level ?? levelForScore(firstScore);
  const latestLevel = latest?.achievement_level ?? levelForScore(latestScore);
  const crossedRung =
    firstLevel !== null && latestLevel !== null ? latestLevel > firstLevel : false;

  const narrative =
    points.length < 2 || totalGrowth === null
      ? 'Only one FAST window is available, so GOGI is using the current score as the starting point.'
      : crossedRung
        ? `Growth is visible: ${totalGrowth > 0 ? '+' : ''}${totalGrowth} points and movement from Level ${firstLevel} to Level ${latestLevel}.`
        : `Growth is ${totalGrowth > 0 ? '+' : ''}${totalGrowth} points so far; the student has not crossed the next FAST rung yet.`;

  return {
    points,
    first_score: firstScore,
    latest_score: latestScore,
    total_growth: totalGrowth,
    first_level: firstLevel,
    latest_level: latestLevel,
    crossed_rung: crossedRung,
    narrative,
  };
}
