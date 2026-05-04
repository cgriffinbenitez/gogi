import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

type Params = {
  params: Promise<{ studentId: string }>;
};

type CompleteBody = {
  events?: Array<{
    frame_key: string;
    time_on_frame_ms: number;
  }>;
};

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { studentId } = await params;
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: student, error: studentError } = await supabase
      .from('students')
      .select('id')
      .eq('id', studentId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (studentError) throw new Error(studentError.message);
    if (!student) return NextResponse.json({ error: 'Student not found.' }, { status: 404 });

    const body = (await req.json().catch(() => ({}))) as CompleteBody;
    const completedAt = new Date().toISOString();

    const { error: updateError } = await supabase
      .from('students')
      .update({ welcome_completed_at: completedAt })
      .eq('id', studentId)
      .eq('user_id', user.id);

    if (updateError) throw new Error(updateError.message);

    const frameEvents = (body.events ?? []).map((event) => ({
      student_id: studentId,
      event_type: 'frame_advanced',
      frame_key: event.frame_key,
      time_on_frame_ms: Math.max(0, Math.round(event.time_on_frame_ms || 0)),
    }));

    const { error: eventError } = await supabase.from('welcome_events').insert([
      ...frameEvents,
      {
        student_id: studentId,
        event_type: 'completed',
        frame_key: 'begin',
        time_on_frame_ms: null,
      },
    ]);

    if (eventError) console.warn('[api/welcome/complete] event insert failed:', eventError.message);

    return NextResponse.json({ ok: true, welcome_completed_at: completedAt });
  } catch (err) {
    console.error('[api/welcome/student/:studentId/complete] error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Could not complete Welcome.' },
      { status: 500 }
    );
  }
}
