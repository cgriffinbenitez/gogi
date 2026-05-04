import { describe, expect, it } from 'vitest';
import {
  buildStudentWelcomePayload,
  type WelcomeProfileInput,
} from '../../src/lib/welcome/payload';

function profile(overrides: Partial<WelcomeProfileInput> = {}): WelcomeProfileInput {
  return {
    id: 'profile-1',
    student_id: 'student-1',
    current_achievement_level: 1,
    points_to_next_rung: 5,
    next_rung_target: 224,
    top_strengths: [{ benchmark_code: 'ELA.9.V.1.2', pct_correct: 1, attempts: 6 }],
    top_weaknesses: [{ benchmark_code: 'ELA.9.R.1.1', pct_correct: 0, attempts: 6 }],
    trajectory_data: {
      assessments: [
        {
          id: 'assessment-1',
          test_reason: 'PM3',
          assessment_grade: 8,
          test_year: 2026,
          date_taken: '2026-04-30',
          scale_score: 219,
          achievement_level: 1,
        },
      ],
    },
    classification_scores: { figurative_language_failure: 5.2 },
    interpretation: {
      growth_goal: {
        realistic_year_end_range: '235-241',
        realistic_year_end_label: 'Level 2 growth band',
        stretch_goal_label: 'Level 3 · 242',
      },
      top_barriers: [{ code: 'figurative_language_failure', label: 'Figurative language' }],
    },
    ...overrides,
  };
}

describe('student welcome payload', () => {
  it('treats an 8th grade report as entry evidence for a 9th grader', () => {
    const payload = buildStudentWelcomePayload({
      studentId: 'student-1',
      fullName: 'Reese Student',
      gradeLevel: 9,
      profile: profile(),
    });

    expect(payload.frames.trajectory?.copy).toContain('219 on the 8th Grade PM3');
    expect(payload.frames.trajectory?.copy).toContain('starting line for 9th grade');
    expect(payload.frames.destination?.scoreLabel).toBe('8th Grade PM3 score');
    expect(payload.frames.destination?.copy).toContain('Next goal: Level 2 is just 5 points away');
  });

  it('keeps non-entry FAST reports in the simpler score language', () => {
    const payload = buildStudentWelcomePayload({
      studentId: 'student-1',
      fullName: 'Reese Student',
      gradeLevel: 9,
      profile: profile({
        trajectory_data: {
          assessments: [
            {
              id: 'assessment-1',
              test_reason: 'PM2',
              assessment_grade: 9,
              test_year: 2026,
              date_taken: '2026-04-30',
              scale_score: 219,
              achievement_level: 1,
            },
          ],
        },
      }),
    });

    expect(payload.frames.trajectory?.copy).toContain('You scored a 219 on PM2');
    expect(payload.frames.destination?.scoreLabel).toBe('9th Grade PM2 score');
    expect(payload.frames.destination?.copy).toContain('Your next stop: Level 2');
  });

  it('labels PM3 entry evidence as prior-grade evidence for incoming ninth graders', () => {
    const payload = buildStudentWelcomePayload({
      studentId: 'student-1',
      fullName: 'Noah Rivera',
      gradeLevel: 9,
      profile: profile({
        trajectory_data: {
          assessments: [
            {
              id: 'assessment-1',
              test_reason: 'PM3',
              assessment_grade: 9,
              test_year: 2026,
              date_taken: '2026-04-30',
              scale_score: 219,
              achievement_level: 1,
            },
          ],
        },
      }),
    });

    expect(payload.frames.trajectory?.copy).toContain('219 on the 8th Grade PM3');
    expect(payload.frames.destination?.scoreLabel).toBe('8th Grade PM3 score');
    expect(payload.frames.destination?.copy).toContain('Next goal: Level 2 is just 5 points away');
  });
});
