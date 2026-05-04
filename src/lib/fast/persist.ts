import type { SupabaseClient } from '@supabase/supabase-js';
import type { ParsedFastReport } from './constants';
import { generateFastProfileForStudent } from './profile';

export async function persistFastReportAndGenerateProfile(
  supabase: Pick<SupabaseClient, 'from'>,
  studentId: string,
  report: ParsedFastReport,
  rawPdfPath: string | null
) {
  const { data: assessment, error: assessmentError } = await supabase
    .from('fast_assessments')
    .upsert(
      {
        student_id: studentId,
        fl_student_id: report.fl_student_id,
        test_reason: report.test_reason,
        test_label: report.test_label ?? null,
        assessment_grade: report.assessment_grade,
        test_year: report.test_year,
        date_taken: report.date_taken ?? null,
        scale_score: report.scale_score ?? null,
        achievement_level: report.achievement_level ?? null,
        percentile_rank: report.percentile_rank ?? null,
        raw_pdf_path: rawPdfPath,
        parsed_at: new Date().toISOString(),
        parse_status: 'parsed',
        parse_error: null,
      },
      { onConflict: 'fl_student_id,test_reason,test_year' }
    )
    .select('*')
    .single();

  if (assessmentError) throw new Error(assessmentError.message);

  const { error: categoryDeleteError } = await supabase
    .from('fast_category_performance')
    .delete()
    .eq('fast_assessment_id', assessment.id);

  if (categoryDeleteError) throw new Error(categoryDeleteError.message);

  const { error: itemDeleteError } = await supabase
    .from('fast_item_responses')
    .delete()
    .eq('fast_assessment_id', assessment.id);

  if (itemDeleteError) throw new Error(itemDeleteError.message);

  if (report.category_performance.length) {
    const { error: categoryError } = await supabase.from('fast_category_performance').insert(
      report.category_performance.map((category) => ({
        fast_assessment_id: assessment.id,
        category_code: category.category_code,
        category_name: category.category_name,
        achievement_level: category.achievement_level,
      }))
    );

    if (categoryError) throw new Error(categoryError.message);
  }

  const { error: itemError } = await supabase.from('fast_item_responses').insert(
    report.item_responses.map((item) => {
      const pointsPossible = Number(item.points_possible || 1);
      const pointsEarned = Number(item.points_earned || 0);

      return {
        fast_assessment_id: assessment.id,
        question_number: item.question_number,
        benchmark_code: item.benchmark_code,
        reporting_category: item.reporting_category ?? null,
        benchmark_description: item.benchmark_description ?? null,
        points_earned: pointsEarned,
        points_possible: pointsPossible,
        is_correct: item.is_correct ?? pointsEarned >= pointsPossible,
      };
    })
  );

  if (itemError) throw new Error(itemError.message);

  const profile = await generateFastProfileForStudent(supabase, studentId);

  return {
    assessment,
    profile,
    item_count: report.item_responses.length,
  };
}
