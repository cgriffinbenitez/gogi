import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { student_id?: string; protocol_id?: string };
    if (!body.student_id || !body.protocol_id) {
      return NextResponse.json(
        { error: 'student_id and protocol_id are required.' },
        { status: 400 }
      );
    }

    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: student, error: studentError } = await supabase
      .from('students')
      .select('id')
      .eq('id', body.student_id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (studentError) throw new Error(studentError.message);
    if (!student) return NextResponse.json({ error: 'Student not found.' }, { status: 404 });

    const { data: protocol, error: protocolError } = await supabase
      .from('first_win_protocols')
      .select('id')
      .eq('id', body.protocol_id)
      .maybeSingle();

    if (protocolError) throw new Error(protocolError.message);
    if (!protocol) return NextResponse.json({ error: 'Protocol not found.' }, { status: 404 });

    const { error: abandonError } = await supabase
      .from('first_win_sessions')
      .update({ abandoned: true })
      .eq('student_id', body.student_id)
      .is('completed_at', null)
      .eq('abandoned', false);

    if (abandonError) throw new Error(abandonError.message);

    const { data: session, error: sessionError } = await supabase
      .from('first_win_sessions')
      .insert({
        student_id: body.student_id,
        protocol_id: body.protocol_id,
      })
      .select('id, started_at')
      .single();

    if (sessionError) throw new Error(sessionError.message);

    return NextResponse.json({ ok: true, session });
  } catch (err) {
    console.error('[api/first-win/session/start] error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Could not start First-Win.' },
      { status: 500 }
    );
  }
}
