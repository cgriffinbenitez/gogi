import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { FIRST_WIN_SELF_EFFICACY_OPTIONS } from '@/lib/first-win/types';

export const runtime = 'nodejs';

type Params = {
  params: Promise<{ sessionId: string }>;
};

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { sessionId } = await params;
    const body = (await req.json()) as { self_efficacy_response?: string };

    if (
      !body.self_efficacy_response ||
      !FIRST_WIN_SELF_EFFICACY_OPTIONS.includes(body.self_efficacy_response as never)
    ) {
      return NextResponse.json(
        { error: 'Valid self-efficacy response is required.' },
        { status: 400 }
      );
    }

    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: session, error: sessionError } = await supabase
      .from('first_win_sessions')
      .select('id, student_id, started_at, completed_at')
      .eq('id', sessionId)
      .maybeSingle();

    if (sessionError) throw new Error(sessionError.message);
    if (!session) return NextResponse.json({ error: 'Session not found.' }, { status: 404 });

    const { data: student, error: studentError } = await supabase
      .from('students')
      .select('id')
      .eq('id', session.student_id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (studentError) throw new Error(studentError.message);
    if (!student) return NextResponse.json({ error: 'Student not found.' }, { status: 404 });

    const { data: responses, error: responsesError } = await supabase
      .from('first_win_responses')
      .select('phase, is_correct')
      .eq('session_id', sessionId);

    if (responsesError) throw new Error(responsesError.message);

    const phaseA = (responses ?? []).filter((response) => response.phase === 'A');
    const phaseB = (responses ?? []).filter((response) => response.phase === 'B');
    const completedAt = new Date();
    const startedAt = session.started_at ? new Date(session.started_at) : completedAt;
    const durationSeconds = Math.max(
      0,
      Math.round((completedAt.getTime() - startedAt.getTime()) / 1000)
    );

    const { error: updateError } = await supabase
      .from('first_win_sessions')
      .update({
        completed_at: completedAt.toISOString(),
        phase_a_correct_count: phaseA.filter((response) => response.is_correct).length,
        phase_a_total_count: phaseA.length,
        phase_b_success: phaseB.length ? phaseB.some((response) => response.is_correct) : null,
        self_efficacy_response: body.self_efficacy_response,
        total_duration_seconds: durationSeconds,
        abandoned: false,
      })
      .eq('id', sessionId);

    if (updateError) throw new Error(updateError.message);

    const { error: studentUpdateError } = await supabase
      .from('students')
      .update({ first_win_completed_at: completedAt.toISOString() })
      .eq('id', session.student_id)
      .eq('user_id', user.id);

    if (studentUpdateError) throw new Error(studentUpdateError.message);

    return NextResponse.json({ ok: true, nextRoute: '/dashboard/student' });
  } catch (err) {
    console.error('[api/first-win/session/:sessionId/complete] error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Could not complete First-Win.' },
      { status: 500 }
    );
  }
}
