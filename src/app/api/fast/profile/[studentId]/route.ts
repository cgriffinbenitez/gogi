import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getUserRole } from '@/lib/fast/auth';

type Params = {
  params: Promise<{ studentId: string }>;
};

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { studentId } = await params;
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const role = getUserRole(user);
    let studentQuery = supabase.from('students').select('id').eq('id', studentId);
    if (role === 'teacher') studentQuery = studentQuery.eq('teacher_id', user.id);
    if (role === 'student') studentQuery = studentQuery.eq('user_id', user.id);

    const { data: student, error: studentError } = await studentQuery.single();
    if (studentError || !student) {
      return NextResponse.json({ error: 'Student not found.' }, { status: 404 });
    }

    const { data: profile, error } = await supabase
      .from('student_cognitive_profiles')
      .select('*')
      .eq('student_id', studentId)
      .eq('active', true)
      .order('generated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ profile });
  } catch (err) {
    console.error('[api/fast/profile/:studentId] error:', err);
    return NextResponse.json({ error: 'Could not load FAST profile.' }, { status: 500 });
  }
}
