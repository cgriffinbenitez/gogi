import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

type Params = {
  params: Promise<{ sessionId: string }>;
};

export async function POST(_req: NextRequest, { params }: Params) {
  try {
    const { sessionId } = await params;
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: session, error: sessionError } = await supabase
      .from('first_win_sessions')
      .select('id, student_id, completed_at')
      .eq('id', sessionId)
      .maybeSingle();

    if (sessionError) throw new Error(sessionError.message);
    if (!session) return NextResponse.json({ error: 'Session not found.' }, { status: 404 });
    if (session.completed_at) return NextResponse.json({ ok: true });

    const { data: student, error: studentError } = await supabase
      .from('students')
      .select('id')
      .eq('id', session.student_id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (studentError) throw new Error(studentError.message);
    if (!student) return NextResponse.json({ error: 'Student not found.' }, { status: 404 });

    const { error: updateError } = await supabase
      .from('first_win_sessions')
      .update({ abandoned: true })
      .eq('id', sessionId)
      .is('completed_at', null);

    if (updateError) throw new Error(updateError.message);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[api/first-win/session/:sessionId/abandon] error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Could not abandon First-Win session.' },
      { status: 500 }
    );
  }
}
