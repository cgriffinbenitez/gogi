import { describe, expect, it } from 'vitest';
import { buildFastColdStartProfile } from '../../src/lib/fast/profile';
import {
  FAST_CLASSIFICATION_CODES,
  type BenchmarkClassificationMapRow,
} from '../../src/lib/fast/constants';

const clinicalMap: BenchmarkClassificationMapRow[] = [
  {
    benchmark_code: 'ELA.9.R.1.1',
    classification_code: 'figurative_language_failure',
    weight: 0.4,
  },
  { benchmark_code: 'ELA.9.R.1.1', classification_code: 'mood_misreading', weight: 0.2 },
  { benchmark_code: 'ELA.9.R.1.1', classification_code: 'tone_misreading', weight: 0.2 },
  { benchmark_code: 'ELA.9.R.1.1', classification_code: 'inferencing_literal', weight: 0.2 },
  { benchmark_code: 'ELA.9.R.2.2', classification_code: 'evidence_retrieval_failure', weight: 0.6 },
  {
    benchmark_code: 'ELA.9.R.2.2',
    classification_code: 'comprehension_integration_failure',
    weight: 0.4,
  },
  { benchmark_code: 'ELA.9.V.1.2', classification_code: 'morphology_gap', weight: 1.0 },
];

describe('FAST cold-start profile', () => {
  it('keeps all 13 classification codes present even when a code has no signal', () => {
    const profile = buildFastColdStartProfile({
      assessments: [
        {
          id: 'assessment-1',
          test_reason: 'PM1',
          assessment_grade: 9,
          test_year: 2026,
          date_taken: '2026-09-05',
          scale_score: 219,
          achievement_level: 1,
        },
      ],
      itemResponses: [
        {
          fast_assessment_id: 'assessment-1',
          question_number: 1,
          benchmark_code: 'ELA.9.R.1.1',
          points_earned: 0,
          points_possible: 1,
          is_correct: false,
        },
        {
          fast_assessment_id: 'assessment-1',
          question_number: 2,
          benchmark_code: 'ELA.9.V.1.2',
          points_earned: 1,
          points_possible: 1,
          is_correct: true,
        },
      ],
      classificationMap: clinicalMap,
    });

    expect(Object.keys(profile.classification_scores).sort()).toEqual(
      [...FAST_CLASSIFICATION_CODES].sort()
    );
    expect(profile.classification_scores.morphology_gap).toBe(0);
    expect(profile.classification_scores.figurative_language_failure).toBe(0.4);
    expect(profile.benchmark_strengths['ELA.9.V.1.2'].pct_correct).toBe(1);
    expect(profile.benchmark_weaknesses['ELA.9.R.1.1'].pct_correct).toBe(0);
    expect(profile.current_achievement_level).toBe(1);
    expect(profile.next_rung_target).toBe(224);
    expect(profile.points_to_next_rung).toBe(5);
    expect(profile.interpretation.growth_goal?.next_rung_label).toBe('Level 2 · 224');
    expect(profile.interpretation.growth_goal?.realistic_year_end_range).toBe('235-241');
    expect(profile.interpretation.growth_goal?.stretch_goal_label).toBe('Level 3 · 242');
    expect(profile.confidence_label).toBe('not_enough_data');
    expect(profile.interpretation.top_barriers[0].label).toBe('Figurative and symbolic meaning');
    expect(profile.interpretation.first_instructional_move).toContain('figurative language');
  });

  it('uses the latest progress monitoring window for the current ladder position', () => {
    const profile = buildFastColdStartProfile({
      assessments: [
        {
          id: 'pm1',
          test_reason: 'PM1',
          assessment_grade: 9,
          test_year: 2026,
          date_taken: '2026-09-05',
          scale_score: 219,
          achievement_level: 1,
        },
        {
          id: 'pm3',
          test_reason: 'PM3',
          assessment_grade: 9,
          test_year: 2026,
          date_taken: '2027-05-04',
          scale_score: 246,
          achievement_level: 3,
        },
      ],
      itemResponses: [
        {
          fast_assessment_id: 'pm3',
          question_number: 1,
          benchmark_code: 'ELA.9.R.2.2',
          points_earned: 0,
          points_possible: 1,
          is_correct: false,
        },
      ],
      classificationMap: clinicalMap,
    });

    expect(profile.trajectory_data.latest_assessment_id).toBe('pm3');
    expect(profile.current_achievement_level).toBe(3);
    expect(profile.next_rung_target).toBe(254);
    expect(profile.points_to_next_rung).toBe(8);
    expect(profile.classification_scores.evidence_retrieval_failure).toBe(0.6);
    expect(profile.interpretation.recommended_next_step.route).toBe('teacher_review');
  });

  it('promotes repeated aligned misses into a strong signal with a diagnostic next step', () => {
    const profile = buildFastColdStartProfile({
      assessments: [
        {
          id: 'pm3',
          test_reason: 'PM3',
          assessment_grade: 9,
          test_year: 2026,
          date_taken: '2027-05-04',
          scale_score: 219,
          achievement_level: 1,
        },
      ],
      itemResponses: Array.from({ length: 24 }).map((_, index) => ({
        fast_assessment_id: 'pm3',
        question_number: index + 1,
        benchmark_code: index < 12 ? 'ELA.9.R.1.1' : 'ELA.9.R.2.2',
        points_earned: index % 3 === 0 ? 1 : 0,
        points_possible: 1,
        is_correct: index % 3 === 0,
      })),
      classificationMap: clinicalMap,
    });

    expect(profile.confidence_label).toBe('strong_signal');
    expect(profile.interpretation.recommended_next_step.route).toBe('diagnostic');
    expect(profile.interpretation.recommended_next_step.standard_code).toBe('ELA.9.R.2.2');
    expect(profile.interpretation.summary).toContain('FAST Level 1');
    expect(profile.interpretation.benchmark_evidence.length).toBeGreaterThan(0);
  });

  it('matches the Reese-style PM3 fixture expectations from the epic', () => {
    const benchmarkCycle = [
      'ELA.9.R.1.1',
      'ELA.9.R.1.1',
      'ELA.9.R.2.2',
      'ELA.9.R.2.2',
      'ELA.9.V.1.2',
      'ELA.9.V.1.2',
      'ELA.9.V.1.2',
      'ELA.9.R.1.1',
    ];
    const missedQuestions = new Set([1, 2, 3, 4, 8, 9, 10, 11, 12, 16, 20, 24, 28]);
    const itemResponses = Array.from({ length: 40 }).map((_, index) => {
      const questionNumber = index + 1;
      const benchmarkCode = benchmarkCycle[index % benchmarkCycle.length];
      const isCorrect = benchmarkCode === 'ELA.9.V.1.2' || !missedQuestions.has(questionNumber);

      return {
        fast_assessment_id: 'reese-pm3',
        question_number: questionNumber,
        benchmark_code: benchmarkCode,
        reporting_category: benchmarkCode.includes('.V.') ? 'RGV' : 'RP',
        benchmark_description: null,
        points_earned: isCorrect ? 1 : 0,
        points_possible: 1,
        is_correct: isCorrect,
      };
    });

    const profile = buildFastColdStartProfile({
      assessments: [
        {
          id: 'reese-pm3',
          test_reason: 'PM3',
          assessment_grade: 9,
          test_year: 2026,
          date_taken: '2026-04-30',
          scale_score: 219,
          achievement_level: 1,
        },
      ],
      itemResponses,
      classificationMap: clinicalMap,
    });

    expect(profile.current_achievement_level).toBe(1);
    expect(profile.next_rung_target).toBe(224);
    expect(profile.points_to_next_rung).toBe(5);
    expect(profile.classification_scores.morphology_gap).toBe(0);
    expect(profile.benchmark_strengths['ELA.9.V.1.2'].pct_correct).toBe(1);
    expect(Object.keys(profile.classification_scores).sort()).toEqual(
      [...FAST_CLASSIFICATION_CODES].sort()
    );
    expect(profile.benchmark_weaknesses['ELA.9.R.1.1'].missed).toBeGreaterThan(0);
    expect(profile.interpretation.growth_goal?.next_rung_label).toBe('Level 2 · 224');
  });
});
