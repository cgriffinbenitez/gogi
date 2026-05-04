import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { buildTeacherWelcomeLine, type WelcomeProfileInput } from '@/lib/welcome/payload';

export const runtime = 'nodejs';

type Params = {
  params: Promise<{ teacherId: string }>;
};

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { teacherId } = await params;
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.id !== teacherId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { data: students, error: studentError } = await supabase
      .from('students')
      .select('id, full_name')
      .eq('teacher_id', teacherId)
      .order('full_name');

    if (studentError) throw new Error(studentError.message);
    const studentIds = (students ?? []).map((student) => student.id);

    const { data: profiles, error: profileError } = studentIds.length
      ? await supabase
          .from('student_cognitive_profiles')
          .select(
            'id, student_id, current_achievement_level, points_to_next_rung, next_rung_target, top_strengths, top_weaknesses, trajectory_data, classification_scores, interpretation'
          )
          .in('student_id', studentIds)
          .eq('active', true)
          .order('generated_at', { ascending: false })
      : { data: [], error: null };

    if (profileError) throw new Error(profileError.message);

    const profileByStudent: Record<string, WelcomeProfileInput> = {};
    for (const profile of (profiles ?? []) as WelcomeProfileInput[]) {
      if (!profileByStudent[profile.student_id]) profileByStudent[profile.student_id] = profile;
    }

    return NextResponse.json({
      ok: true,
      students: (students ?? []).map((student) => {
        const profile = profileByStudent[student.id] ?? null;
        return {
          studentId: student.id,
          fullName: student.full_name,
          hasProfile: Boolean(profile),
          ...buildTeacherWelcomeLine(profile),
        };
      }),
    });
  } catch (err) {
    console.error('[api/welcome/teacher/:teacherId] error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Could not load teacher Welcome cards.' },
      { status: 500 }
    );
  }
}
