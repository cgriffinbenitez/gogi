import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { buildStudentWelcomePayload, type WelcomeProfileInput } from '@/lib/welcome/payload';

export const runtime = 'nodejs';

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

    const { data: student, error: studentError } = await supabase
      .from('students')
      .select('id, full_name, user_id, grade_level, welcome_completed_at')
      .eq('id', studentId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (studentError) throw new Error(studentError.message);
    if (!student) return NextResponse.json({ error: 'Student not found.' }, { status: 404 });

    const { data: profile, error: profileError } = await supabase
      .from('student_cognitive_profiles')
      .select(
        'id, student_id, current_achievement_level, points_to_next_rung, next_rung_target, top_strengths, top_weaknesses, trajectory_data, classification_scores, interpretation'
      )
      .eq('student_id', studentId)
      .eq('active', true)
      .order('generated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (profileError) throw new Error(profileError.message);

    return NextResponse.json({
      ok: true,
      welcomeCompletedAt: student.welcome_completed_at ?? null,
      payload: buildStudentWelcomePayload({
        studentId,
        fullName: student.full_name,
        gradeLevel: student.grade_level,
        profile: (profile ?? null) as WelcomeProfileInput | null,
      }),
    });
  } catch (err) {
    console.error('[api/welcome/student/:studentId] error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Could not load Welcome.' },
      { status: 500 }
    );
  }
}
