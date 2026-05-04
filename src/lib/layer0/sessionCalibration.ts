import type { SupabaseClient } from '@supabase/supabase-js';
import type { LoadCalibration } from '@/lib/layer0/scoring';

export type Layer0SessionCalibration = {
  layer0AssessmentId: string | null;
  loadCalibration: LoadCalibration | null;
  teacherReviewFlag: boolean;
};

type Layer0AssessmentRow = {
  id: string;
  load_calibration: LoadCalibration | null;
  teacher_review_flag: boolean | null;
};

export async function getLatestLayer0SessionCalibration(
  supabase: SupabaseClient,
  studentId: string,
): Promise<Layer0SessionCalibration> {
  const { data } = await supabase
    .from('layer0_assessments')
    .select('id, load_calibration, teacher_review_flag')
    .eq('student_id', studentId)
    .eq('status', 'completed')
    .order('administration_number', { ascending: false })
    .order('completed_at', { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();

  const row = data as Layer0AssessmentRow | null;

  return {
    layer0AssessmentId: row?.id ?? null,
    loadCalibration: row?.load_calibration ?? null,
    teacherReviewFlag: row?.teacher_review_flag ?? false,
  };
}

export async function getFirstLayer0Complete(
  supabase: SupabaseClient,
  studentId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from('layer0_assessments')
    .select('id')
    .eq('student_id', studentId)
    .eq('administration_number', 1)
    .eq('status', 'completed')
    .limit(1)
    .maybeSingle();

  return Boolean((data as { id?: string } | null)?.id);
}
