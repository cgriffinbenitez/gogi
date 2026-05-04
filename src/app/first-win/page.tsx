import { redirect } from 'next/navigation';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import FirstWinClient from './first-win-client';

type FirstWinPageProps = {
  searchParams: Promise<{ preview?: string }>;
};

export default async function FirstWinPage({ searchParams }: FirstWinPageProps) {
  const params = await searchParams;
  const preview = params.preview === '1';
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data: student } = await supabase
    .from('students')
    .select('id, first_win_completed_at')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!student) redirect('/login?error=no_student_record');
  if (student.first_win_completed_at && !preview) redirect('/dashboard/student');

  return <FirstWinClient studentId={student.id} preview={preview} />;
}
