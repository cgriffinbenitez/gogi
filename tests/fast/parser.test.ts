import { describe, expect, it } from 'vitest';
import { assertParsedFastReport } from '../../src/lib/fast/parser';
import type { ParsedFastReport } from '../../src/lib/fast/constants';

function validReport(overrides: Partial<ParsedFastReport> = {}) {
  return {
    fl_student_id: 'FL000000236781',
    test_reason: 'PM3',
    test_label: 'Grade 9 FAST ELA Reading',
    assessment_grade: 9,
    test_year: 2026,
    date_taken: '2026-04-30',
    scale_score: 219,
    achievement_level: 1,
    percentile_rank: 12,
    category_performance: [
      {
        category_code: 'RP',
        category_name: 'Reading Prose and Poetry',
        achievement_level: 'Below the Standard',
      },
      {
        category_code: 'RI',
        category_name: 'Reading Informational Text',
        achievement_level: 'At/Near the Standard',
      },
      {
        category_code: 'RGV',
        category_name: 'Reading Across Genres and Vocabulary',
        achievement_level: 'Below the Standard',
      },
    ],
    item_responses: Array.from({ length: 40 }).map((_, index) => ({
      question_number: index + 1,
      benchmark_code: index % 5 === 0 ? 'ELA.9.V.1.2' : 'ELA.9.R.1.1',
      reporting_category: index % 5 === 0 ? 'RGV' : 'RP',
      benchmark_description: null,
      points_earned: index % 3 === 0 ? 0 : 1,
      points_possible: 1,
      is_correct: index % 3 !== 0,
    })),
    ...overrides,
  };
}

describe('FAST parser validation', () => {
  it('accepts a complete FAST ISR extraction', () => {
    expect(() => assertParsedFastReport(validReport())).not.toThrow();
  });

  it('rejects malformed extraction before it can create partial FAST rows', () => {
    expect(() =>
      assertParsedFastReport(
        validReport({
          scale_score: null,
        })
      )
    ).toThrow('scale score');

    expect(() =>
      assertParsedFastReport(
        validReport({
          date_taken: null,
        })
      )
    ).toThrow('test date');

    expect(() =>
      assertParsedFastReport(
        validReport({
          assessment_grade: null as never,
        })
      )
    ).toThrow('assessment grade');

    expect(() =>
      assertParsedFastReport(
        validReport({
          item_responses: validReport().item_responses.slice(0, 12),
        })
      )
    ).toThrow('too few item rows');
  });
});
