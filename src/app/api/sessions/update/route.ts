import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { session_id, mastery_achieved, status, completed_at } = body as {
      session_id: string;
      mastery_achieved?: boolean;
      status?: string;
      completed_at?: string;
    };

    if (!session_id) {
      return NextResponse.json({ error: 'session_id required' }, { status: 400 });
    }

    const supabase = await createServerSupabaseClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const patch: Record<string, unknown> = {};
    if (mastery_achieved !== undefined) patch.mastery_achieved = mastery_achieved;
    if (status !== undefined) patch.status = status;
    if (completed_at !== undefined) patch.completed_at = completed_at;

    const { error } = await supabase
      .from('sessions')
      .update(patch)
      .eq('id', session_id);

    if (error) {
      console.error('[api/sessions/update] error:', error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[api/sessions/update] exception:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
