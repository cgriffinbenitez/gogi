import { FAST_GRADE_9_ELA_THRESHOLDS } from './constants';

export type FastGrowthGoal = {
  current_level_label: string;
  current_scale_score: number;
  next_rung_target: number | null;
  next_rung_label: string;
  points_to_next_rung: number | null;
  short_term_goal: string;
  realistic_year_end_range: string;
  realistic_year_end_label: string;
  stretch_goal_label: string;
  rationale: string;
};

function formatLevel(level: number | null | undefined) {
  return level ? `Level ${level}` : 'FAST level';
}

function getLevelByScore(scaleScore: number) {
  return (
    FAST_GRADE_9_ELA_THRESHOLDS.find(
      (threshold) => scaleScore >= threshold.min && scaleScore <= threshold.max
    ) ?? null
  );
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(value, max));
}

export function buildFastGrowthGoal(args: {
  scaleScore: number | null | undefined;
  achievementLevel: number | null | undefined;
  nextRungTarget: number | null | undefined;
  pointsToNextRung: number | null | undefined;
}): FastGrowthGoal | null {
  if (args.scaleScore === null || args.scaleScore === undefined) return null;

  const level =
    FAST_GRADE_9_ELA_THRESHOLDS.find((threshold) => threshold.level === args.achievementLevel) ??
    getLevelByScore(args.scaleScore);

  if (!level) return null;

  const nextLevel =
    FAST_GRADE_9_ELA_THRESHOLDS.find((threshold) => threshold.level === level.level + 1) ?? null;
  const stretchLevel =
    FAST_GRADE_9_ELA_THRESHOLDS.find((threshold) => threshold.level === level.level + 2) ??
    nextLevel ??
    level;
  const nextRungTarget = args.nextRungTarget ?? level.nextRungTarget;
  const pointsToNextRung =
    args.pointsToNextRung ??
    (nextRungTarget === null ? null : Math.max(0, nextRungTarget - args.scaleScore));

  if (!nextLevel || nextRungTarget === null) {
    return {
      current_level_label: `${formatLevel(level.level)} · ${args.scaleScore}`,
      current_scale_score: args.scaleScore,
      next_rung_target: null,
      next_rung_label: 'Maintain Level 5',
      points_to_next_rung: null,
      short_term_goal: 'Maintain Level 5 performance with consistent accuracy across benchmarks.',
      realistic_year_end_range: `${level.min}-${level.max}`,
      realistic_year_end_label: `Stay in ${formatLevel(level.level)} · ${level.min}-${level.max}`,
      stretch_goal_label: 'Move toward the top of Level 5',
      rationale:
        'The student is already on the highest FAST rung, so the target is consistency and transfer across item types.',
    };
  }

  const realisticMin = clamp(args.scaleScore + 16, nextRungTarget, nextLevel.max);
  const realisticMax = nextLevel.max;
  const stretchTarget = stretchLevel.level > nextLevel.level ? stretchLevel.min : nextLevel.max;

  return {
    current_level_label: `${formatLevel(level.level)} · ${args.scaleScore}`,
    current_scale_score: args.scaleScore,
    next_rung_target: nextRungTarget,
    next_rung_label: `${formatLevel(nextLevel.level)} · ${nextRungTarget}`,
    points_to_next_rung: pointsToNextRung,
    short_term_goal: `Reach ${formatLevel(nextLevel.level)} by crossing ${nextRungTarget}.`,
    realistic_year_end_range: `${realisticMin}-${realisticMax}`,
    realistic_year_end_label: `${formatLevel(nextLevel.level)} growth band · ${realisticMin}-${realisticMax}`,
    stretch_goal_label: `${formatLevel(stretchLevel.level)} · ${stretchTarget}`,
    rationale:
      'This target assumes consistent GOGI diagnostic work, focused intervention, and reassessment evidence rather than one isolated score jump.',
  };
}
