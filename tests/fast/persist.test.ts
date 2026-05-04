import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ParsedFastReport } from '../../src/lib/fast/constants';

const generateFastProfileForStudent = vi.fn();

vi.mock('../../src/lib/fast/profile', () => ({
  generateFastProfileForStudent,
}));

const { persistFastReportAndGenerateProfile } = await import('../../src/lib/fast/persist');

function report(overrides: Partial<ParsedFastReport> = {}): ParsedFastReport {
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
      benchmark_code: 'ELA.9.R.1.1',
      reporting_category: 'RP',
      benchmark_description: null,
      points_earned: index % 2,
      points_possible: 1,
      is_correct: index % 2 === 1,
    })),
    ...overrides,
  };
}

function fakeSupabase() {
  const operations: Array<{ table: string; action: string; payload?: unknown; options?: unknown }> =
    [];
  const assessment = { id: 'assessment-existing', test_reason: 'PM3', test_year: 2026 };

  return {
    operations,
    client: {
      from(table: string) {
        return {
          upsert(payload: unknown, options: unknown) {
            operations.push({ table, action: 'upsert', payload, options });
            return {
              select() {
                return {
                  single: async () => ({ data: assessment, error: null }),
                };
              },
            };
          },
          delete() {
            operations.push({ table, action: 'delete' });
            return {
              eq: async (_column: string, value: string) => {
                operations.push({ table, action: 'delete_eq', payload: value });
                return { error: null };
              },
            };
          },
          insert(payload: unknown) {
            operations.push({ table, action: 'insert', payload });
            return { error: null };
          },
        };
      },
    },
  };
}

describe('FAST persistence', () => {
  beforeEach(() => {
    generateFastProfileForStudent.mockResolvedValue({ id: 'profile-1' });
  });

  it('uses the PM unique key and replaces child evidence on re-upload', async () => {
    const supabase = fakeSupabase();

    await persistFastReportAndGenerateProfile(
      supabase.client as never,
      'student-1',
      report(),
      'student-1/reese.pdf'
    );

    expect(supabase.operations[0]).toMatchObject({
      table: 'fast_assessments',
      action: 'upsert',
      payload: expect.objectContaining({ assessment_grade: 9 }),
      options: { onConflict: 'fl_student_id,test_reason,test_year' },
    });

    expect(supabase.operations).toEqual(
      expect.arrayContaining([
        { table: 'fast_category_performance', action: 'delete' },
        { table: 'fast_category_performance', action: 'delete_eq', payload: 'assessment-existing' },
        { table: 'fast_item_responses', action: 'delete' },
        { table: 'fast_item_responses', action: 'delete_eq', payload: 'assessment-existing' },
      ])
    );
    expect(
      supabase.operations.find(
        (operation) => operation.table === 'fast_item_responses' && operation.action === 'insert'
      )?.payload
    ).toHaveLength(40);
    expect(generateFastProfileForStudent).toHaveBeenCalledWith(supabase.client, 'student-1');
  });
});
