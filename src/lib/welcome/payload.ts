import { buildFastGrowthGoal } from '../fast/growth';
import { getStudentFirstName } from '../students/displayName';
import { buildFastTrajectorySummary, type FastTrajectoryAssessment } from '../fast/trajectory';
import { getWelcomeStrengthLabel } from './strengths';

type BenchmarkSummary = {
  benchmark_code: string;
  pct_correct: number;
  attempts: number;
  correct?: number;
  missed?: number;
};

export type WelcomeProfileInput = {
  id: string;
  student_id: string;
  current_achievement_level: number | null;
  points_to_next_rung: number | null;
  next_rung_target: number | null;
  top_strengths: BenchmarkSummary[] | null;
  top_weaknesses: BenchmarkSummary[] | null;
  trajectory_data: {
    assessments?: FastTrajectoryAssessment[];
  } | null;
  classification_scores?: Record<string, number> | null;
  interpretation?: {
    growth_goal?: {
      realistic_year_end_range?: string;
      realistic_year_end_label?: string;
      stretch_goal_label?: string;
    } | null;
    top_barriers?: Array<{ code: string; label: string }>;
  } | null;
};

export type StudentWelcomePayload = {
  studentId: string;
  profileId: string | null;
  firstName: string;
  hasProfile: boolean;
  frames: {
    greeting: { firstName: string };
    trajectory?: {
      variant: 'multi_point_rising' | 'cross_year' | 'single_point';
      delta?: number;
      currentScore?: number;
      scores: number[];
      scoreLabel?: string | null;
      copy: string;
    };
    strength?: {
      benchmarkCode: string | null;
      strengthLabel: string;
      gloss: string;
      relative: boolean;
    };
    destination?: {
      pointsToNextRung: number | null;
      currentScore: number | null;
      scoreLabel: string | null;
      nextLevelLabel: string | null;
      nextRungTarget: number | null;
      yearGoalRange: string | null;
      stretchGoalLabel: string | null;
      copy: string;
    };
  };
  doorwayTarget: string;
};

function pickStrength(profile: WelcomeProfileInput | null) {
  const strengths = [...(profile?.top_strengths ?? [])].sort((a, b) => {
    if (b.pct_correct !== a.pct_correct) return b.pct_correct - a.pct_correct;
    return b.attempts - a.attempts;
  });
  const strong = strengths.find((row) => row.pct_correct >= 0.5 && row.attempts >= 2);
  const selected = strong ?? strengths[0] ?? null;
  const label = getWelcomeStrengthLabel(selected?.benchmark_code);

  return {
    benchmarkCode: selected?.benchmark_code ?? null,
    strengthLabel: label.strengthLabel,
    gloss: strong
      ? label.gloss
      : `Your strongest area right now is ${label.strengthLabel}. We'll start there.`,
    relative: !strong,
  };
}

function ordinalGrade(grade: number) {
  const suffix =
    grade % 100 >= 11 && grade % 100 <= 13
      ? 'th'
      : grade % 10 === 1
        ? 'st'
        : grade % 10 === 2
          ? 'nd'
          : grade % 10 === 3
            ? 'rd'
            : 'th';
  return `${grade}${suffix}`;
}

function latestAssessment(profile: WelcomeProfileInput | null) {
  return profile?.trajectory_data?.assessments?.[0] ?? null;
}

function displayAssessmentGrade(
  assessment: FastTrajectoryAssessment | null | undefined,
  context: { gradeLevel?: number | null } = {}
) {
  if (
    assessment?.test_reason?.trim().toUpperCase() === 'PM3' &&
    context.gradeLevel &&
    (!assessment.assessment_grade || assessment.assessment_grade >= context.gradeLevel)
  ) {
    return context.gradeLevel - 1;
  }

  return assessment?.assessment_grade ?? context.gradeLevel ?? null;
}

function assessmentLabel(
  assessment: FastTrajectoryAssessment | null | undefined,
  context: { gradeLevel?: number | null } = {}
) {
  const grade = displayAssessmentGrade(assessment, context);
  const reason = assessment?.test_reason?.trim();
  if (!grade && !reason) return null;
  return [grade ? `${ordinalGrade(grade)} Grade` : null, reason, 'score'].filter(Boolean).join(' ');
}

function isPriorGradeEvidence(args: {
  profile: WelcomeProfileInput | null;
  gradeLevel?: number | null;
}) {
  const assessmentGrade = displayAssessmentGrade(latestAssessment(args.profile), {
    gradeLevel: args.gradeLevel,
  });
  return Boolean(
    assessmentGrade &&
    args.gradeLevel &&
    Number.isInteger(assessmentGrade) &&
    Number.isInteger(args.gradeLevel) &&
    assessmentGrade < args.gradeLevel
  );
}

function buildTrajectory(
  profile: WelcomeProfileInput | null,
  context: { gradeLevel?: number | null } = {}
) {
  const summary = buildFastTrajectorySummary(profile?.trajectory_data?.assessments ?? []);
  const scores = summary.points
    .map((point) => point.scale_score)
    .filter((score): score is number => score !== null);

  if (scores.length >= 2 && summary.total_growth !== null && summary.total_growth > 0) {
    const sameYear = new Set(summary.points.map((point) => point.test_year)).size === 1;
    return {
      variant: sameYear ? ('multi_point_rising' as const) : ('cross_year' as const),
      delta: summary.total_growth,
      currentScore: summary.latest_score ?? undefined,
      scores,
      scoreLabel: assessmentLabel(summary.points[0], context),
      copy: sameYear
        ? `You gained ${summary.total_growth} points this year.\nYou're moving.`
        : `Your reading score is rising.\nYou're on a path.`,
    };
  }

  const currentScore = summary.latest_score ?? scores[0] ?? null;
  if (currentScore === null) return null;
  const assessment = latestAssessment(profile);
  const assessmentGrade = displayAssessmentGrade(assessment, context);
  const priorGrade = isPriorGradeEvidence({ profile, gradeLevel: context.gradeLevel });

  return {
    variant: 'single_point' as const,
    currentScore,
    scores: [currentScore],
    scoreLabel: assessmentLabel(assessment, context),
    copy:
      priorGrade && assessmentGrade && context.gradeLevel
        ? `You scored a ${currentScore} on the ${ordinalGrade(assessmentGrade)} Grade ${assessment?.test_reason ?? 'FAST'}.\nThat's your starting line for ${ordinalGrade(context.gradeLevel)} grade.`
        : `You scored a ${currentScore}${assessment?.test_reason ? ` on ${assessment.test_reason}` : ''}.\nThat's your starting line.`,
  };
}

function destinationCopy(
  profile: WelcomeProfileInput | null,
  context: { gradeLevel?: number | null } = {}
) {
  const fallbackGrowthGoal = buildFastGrowthGoal({
    scaleScore: latestScore(profile),
    achievementLevel: profile?.current_achievement_level,
    nextRungTarget: profile?.next_rung_target,
    pointsToNextRung: profile?.points_to_next_rung,
  });
  const yearGoalRange =
    profile?.interpretation?.growth_goal?.realistic_year_end_range ??
    fallbackGrowthGoal?.realistic_year_end_range ??
    null;
  const stretchGoalLabel =
    profile?.interpretation?.growth_goal?.stretch_goal_label ??
    fallbackGrowthGoal?.stretch_goal_label ??
    null;

  if (profile?.current_achievement_level === 5 || profile?.points_to_next_rung === null) {
    return {
      pointsToNextRung: null,
      currentScore: latestScore(profile),
      scoreLabel: assessmentLabel(latestAssessment(profile), context),
      nextLevelLabel: null,
      nextRungTarget: null,
      yearGoalRange,
      stretchGoalLabel,
      copy: "You're at the top.\nLet's keep you there.",
    };
  }

  const points = profile?.points_to_next_rung ?? null;
  const nextLevel =
    profile?.current_achievement_level === null || profile?.current_achievement_level === undefined
      ? null
      : `Level ${profile.current_achievement_level + 1}`;
  return {
    pointsToNextRung: points,
    currentScore: latestScore(profile),
    scoreLabel: assessmentLabel(latestAssessment(profile), context),
    nextLevelLabel: nextLevel,
    nextRungTarget: profile?.next_rung_target ?? null,
    yearGoalRange,
    stretchGoalLabel,
    copy:
      points === null
        ? "Let's start with what you do best."
        : isPriorGradeEvidence({ profile, gradeLevel: context.gradeLevel }) && context.gradeLevel
          ? `Next goal: ${nextLevel ?? 'the next rung'} is just ${points} points away.`
          : `Your next stop: ${nextLevel ?? 'the next rung'} is within reach.\n${points} points away.`,
  };
}

function latestScore(profile: WelcomeProfileInput | null) {
  return latestAssessment(profile)?.scale_score ?? null;
}

export function buildStudentWelcomePayload(args: {
  studentId: string;
  fullName: string;
  gradeLevel?: number | null;
  profile: WelcomeProfileInput | null;
}): StudentWelcomePayload {
  const name = getStudentFirstName(args.fullName);

  if (!args.profile) {
    return {
      studentId: args.studentId,
      profileId: null,
      firstName: name,
      hasProfile: false,
      frames: {
        greeting: { firstName: name },
      },
      doorwayTarget: '/first-win',
    };
  }

  return {
    studentId: args.studentId,
    profileId: args.profile.id,
    firstName: name,
    hasProfile: true,
    frames: {
      greeting: { firstName: name },
      trajectory: buildTrajectory(args.profile, { gradeLevel: args.gradeLevel }) ?? undefined,
      strength: pickStrength(args.profile),
      destination: destinationCopy(args.profile, { gradeLevel: args.gradeLevel }),
    },
    doorwayTarget: '/first-win',
  };
}

export function buildTeacherWelcomeLine(profile: WelcomeProfileInput | null) {
  const strength = pickStrength(profile);
  const trajectory = buildTrajectory(profile);
  const topWeakness =
    profile?.interpretation?.top_barriers?.[0]?.label ??
    Object.entries(profile?.classification_scores ?? {})
      .sort(([, a], [, b]) => Number(b) - Number(a))[0]?.[0]
      ?.replace(/_/g, ' ') ??
    'No signal yet';

  return {
    strength,
    trajectory,
    weaknessLabel: topWeakness,
    pointsToNextRung: profile?.points_to_next_rung ?? null,
    nextRungTarget: profile?.next_rung_target ?? null,
  };
}
