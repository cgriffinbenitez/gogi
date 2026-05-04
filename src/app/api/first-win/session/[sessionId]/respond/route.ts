import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getFirstWinItem, isFirstWinAnswerCorrect } from '@/lib/first-win/protocol';
import type { FirstWinPhase, FirstWinProtocol } from '@/lib/first-win/types';

export const runtime = 'nodejs';

type Params = {
  params: Promise<{ sessionId: string }>;
};

type ResponseBody = {
  phase?: FirstWinPhase;
  item_index?: number;
  student_response?: string;
  scaffold_used?: boolean;
  time_on_item_ms?: number;
};

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { sessionId } = await params;
    const body = (await req.json()) as ResponseBody;

    if (!body.phase || !['A', 'B'].includes(body.phase)) {
      return NextResponse.json({ error: 'Valid phase is required.' }, { status: 400 });
    }
    if (!Number.isInteger(body.item_index) || Number(body.item_index) < 0) {
      return NextResponse.json({ error: 'Valid item_index is required.' }, { status: 400 });
    }
    if (!body.student_response) {
      return NextResponse.json({ error: 'student_response is required.' }, { status: 400 });
    }
    const phase = body.phase;
    const itemIndex = Number(body.item_index);
    const studentResponse = body.student_response;

    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: session, error: sessionError } = await supabase
      .from('first_win_sessions')
      .select('id, student_id, completed_at, first_win_protocols(*)')
      .eq('id', sessionId)
      .maybeSingle();

    if (sessionError) throw new Error(sessionError.message);
    if (!session) return NextResponse.json({ error: 'Session not found.' }, { status: 404 });
    if (session.completed_at) {
      return NextResponse.json({ error: 'Session is already complete.' }, { status: 409 });
    }

    const { data: student, error: studentError } = await supabase
      .from('students')
      .select('id')
      .eq('id', session.student_id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (studentError) throw new Error(studentError.message);
    if (!student) return NextResponse.json({ error: 'Student not found.' }, { status: 404 });

    const protocol = session.first_win_protocols as unknown as FirstWinProtocol;
    const item = getFirstWinItem(protocol, phase, itemIndex);
    if (!item) return NextResponse.json({ error: 'Item not found.' }, { status: 404 });

    const isCorrect = isFirstWinAnswerCorrect(item, studentResponse);
    const { data: response, error: responseError } = await supabase
      .from('first_win_responses')
      .upsert(
        {
          session_id: sessionId,
          phase,
          item_index: itemIndex,
          item_content: item,
          student_response: studentResponse,
          is_correct: isCorrect,
          scaffold_used: Boolean(body.scaffold_used),
          time_on_item_ms: Math.max(0, Number(body.time_on_item_ms ?? 0)),
        },
        { onConflict: 'session_id,phase,item_index' }
      )
      .select('id, is_correct')
      .single();

    if (responseError) throw new Error(responseError.message);

    return NextResponse.json({
      ok: true,
      response,
      feedback: isCorrect ? item.feedback_correct : item.feedback_incorrect,
      scaffold: item.scaffold_text ?? null,
    });
  } catch (err) {
    console.error('[api/first-win/session/:sessionId/respond] error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Could not save First-Win response.' },
      { status: 500 }
    );
  }
}
