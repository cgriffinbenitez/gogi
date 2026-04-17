import { redirect } from 'next/navigation';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { STANDARDS } from '@/lib/constants/design';
import StudentDashboardContent from './StudentDashboardContent';

export default async function StudentDashboardPage() {
  const supabase = await createServerSupabaseClient();

  // Auth guard — middleware already redirects, this is a safety net
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // Get student record (id + name)
  const { data: student } = await supabase
    .from('students')
    .select('id, full_name')
    .eq('user_id', user.id)
    .single();

  if (!student) {
    // Auth user exists but no students row — redirect to login with message
    redirect('/login?error=no_student_record');
  }

  // Fetch the 3 pilot standard UUIDs by code
  const pilotCodes = Object.keys(STANDARDS);
  const { data: standards } = await supabase
    .from('standards')
    .select('id, code, title')
    .in('code', pilotCodes);

  // Sort to match STANDARDS key order (ELA.9.R.1.1, 1.2, 2.1)
  const sorted = (standards ?? []).sort(
    (a, b) => pilotCodes.indexOf(a.code) - pilotCodes.indexOf(b.code),
  );

  return (
    <StudentDashboardContent
      studentId={student.id}
      studentName={student.full_name}
      standards={sorted}
    />
  );
}
