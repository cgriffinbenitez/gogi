import { redirect } from 'next/navigation';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import WelcomeClient from './welcome-client';

type WelcomePageProps = {
  searchParams: Promise<{ preview?: string; login?: string }>;
};

export default async function WelcomePage({ searchParams }: WelcomePageProps) {
  const params = await searchParams;
  const preview = params.preview === '1';
  const loginReplay = params.login === '1';
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data: student } = await supabase
    .from('students')
    .select('id, full_name, welcome_completed_at, first_win_completed_at')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!student) redirect('/login?error=no_student_record');
  if (student.welcome_completed_at && !student.first_win_completed_at && !preview && !loginReplay) {
    redirect('/first-win');
  }
  if (student.welcome_completed_at && !preview && !loginReplay) redirect('/dashboard/student');

  return <WelcomeClient studentId={student.id} preview={preview} loginReplay={loginReplay} />;
}
