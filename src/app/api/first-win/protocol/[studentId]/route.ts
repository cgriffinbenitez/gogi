import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { loadFirstWinProtocolForStudent } from '@/lib/first-win/protocol';

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
      .select('id, user_id')
      .eq('id', studentId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (studentError) throw new Error(studentError.message);
    if (!student) return NextResponse.json({ error: 'Student not found.' }, { status: 404 });

    const payload = await loadFirstWinProtocolForStudent(supabase, studentId);
    return NextResponse.json({ ok: true, payload });
  } catch (err) {
    console.error('[api/first-win/protocol/:studentId] error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Could not load First-Win protocol.' },
      { status: 500 }
    );
  }
}
