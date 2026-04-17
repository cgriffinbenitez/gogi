import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const role =
      (user.user_metadata?.role as string | undefined) ??
      (user.app_metadata?.role as string | undefined);
    if (role !== 'teacher') {
      return NextResponse.json({ error: 'Forbidden — teacher role required' }, { status: 403 });
    }

    const { question_id } = (await req.json()) as { question_id: string };
    if (!question_id) {
      return NextResponse.json({ error: 'question_id required' }, { status: 400 });
    }

    const { error } = await supabase
      .from('questions')
      .update({ approved: true, flagged: false })
      .eq('id', question_id);

    if (error) {
      console.error('[api/questions/approve] error:', error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[api/questions/approve] exception:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
