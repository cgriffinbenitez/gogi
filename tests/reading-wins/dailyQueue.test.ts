import { describe, expect, it } from 'vitest';
import {
  buildDailyReadingWinAssignment,
  parseDailyResponseEvidence,
  type DailyFastProfile,
} from '../../src/lib/reading-wins/dailyQueue';

const availableStandardCodes = ['ELA.9.R.1.1', 'ELA.9.R.2.2', 'ELA.9.R.3.1'];

const fastProfile: DailyFastProfile = {
  confidence_label: 'strong_signal',
  current_achievement_level: 1,
  points_to_next_rung: 5,
  interpretation: {
    summary: 'FAST evidence points to figurative language.',
    recommended_next_step: {
      standard_code: 'ELA.9.R.3.1',
      label: 'Assign ELA.9.R.3.1',
      reason: 'Figurative language is the strongest signal.',
    },
    top_barriers: [
      {
        code: 'figurative_language_failure',
        label: 'Figurative language and mood',
        strength: 100,
      },
    ],
    benchmark_evidence: [
      {
        benchmark_code: 'ELA.9.R.3.1',
        pct_correct: 0,
        attempts: 3,
        evidence_label: 'No correct items',
      },
    ],
  },
  top_weaknesses: [{ benchmark_code: 'ELA.9.R.3.1', pct_correct: 0, attempts: 3 }],
};

describe('daily Reading Win queue', () => {
  it('gates students to Layer 0 after FAST profile but before support calibration', () => {
    const assignment = buildDailyReadingWinAssignment({
      fastProfile,
      layer0Complete: false,
      standardStatuses: {},
      availableStandardCodes,
    });

    expect(assignment.kind).toBe('needs_layer0');
    expect(assignment.route).toBe('/layer0');
  });

  it('assigns the top FAST-aligned reading win after Layer 0', () => {
    const assignment = buildDailyReadingWinAssignment({
      fastProfile,
      layer0Complete: true,
      standardStatuses: {},
      availableStandardCodes,
    });

    expect(assignment.kind).toBe('reading_win');
    expect(assignment.standardCode).toBe('ELA.9.R.3.1');
    expect(assignment.route).toBe('/standard/ELA-9-R-3-1/intervention');
    expect(assignment.why).toContain('5 points');
  });

  it('does not assign a student to a standard when the content library is not ready', () => {
    const assignment = buildDailyReadingWinAssignment({
      fastProfile,
      layer0Complete: true,
      standardStatuses: {},
      availableStandardCodes: [],
    });

    expect(assignment.kind).toBe('needs_content_library');
    expect(assignment.standardCode).toBeNull();
    expect(assignment.why).toContain('no standard has enough approved');
  });

  it('repeats the same move when the latest transfer was missed', () => {
    const assignment = buildDailyReadingWinAssignment({
      fastProfile,
      layer0Complete: true,
      standardStatuses: {
        'ELA.9.R.3.1': {
          status: 'inIntervention',
          sessionsAttempted: 1,
          sessionsPassed: 0,
        },
      },
      availableStandardCodes,
      recentResponses: [
        {
          standardCode: 'ELA.9.R.3.1',
          createdAt: '2026-05-03T12:00:00.000Z',
          transferCorrect: false,
          clinicalFlag: false,
          masteryAchieved: false,
        },
      ],
    });

    expect(assignment.kind).toBe('reading_win');
    if (assignment.kind !== 'reading_win') throw new Error('Expected a Reading Win assignment');
    expect(assignment.recentSignal).toBe('repeat_for_transfer');
    expect(assignment.cta).toBe('Retry today’s win →');
  });

  it('parses Reading Win closing evidence from stored response JSON', () => {
    const evidence = parseDailyResponseEvidence({
      student_response: JSON.stringify({
        standard_code: 'ELA.9.R.3.1',
        transfer_correct: true,
        clinical_flag: false,
      }),
      mastery_achieved: true,
      created_at: '2026-05-03T12:00:00.000Z',
    });

    expect(evidence).toMatchObject({
      standardCode: 'ELA.9.R.3.1',
      transferCorrect: true,
      clinicalFlag: false,
      masteryAchieved: true,
    });
  });
});
