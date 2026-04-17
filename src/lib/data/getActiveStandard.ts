import { createClient } from '@/lib/supabase/client';

export async function getActiveStandard(studentId: string): Promise<{
  standardId: string;
  phase: string;
  sessionId: string | null;
} | null> {
  const supabase = createClient();
  const { data } = await supabase
    .from('sessions')
    .select('id, standard_id, phase')
    .eq('student_id', studentId)
    .eq('mastery_achieved', false)
    .neq('status', 'interrupted')
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) {
    return { standardId: 'ELA.9.R.1.1', phase: 'diagnostic', sessionId: null };
  }
  return { standardId: data.standard_id, phase: data.phase, sessionId: data.id };
}
