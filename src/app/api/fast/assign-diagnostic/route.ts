import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { assertTeacherCanAccessStudent } from '@/lib/fast/auth';

type Body = {
  student_id?: string;
  standard_code?: string;
  reason?: string;
};

export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = (await req.json()) as Body;
    const studentId = body.student_id;
    const standardCode = body.standard_code ?? 'ELA.9.R.1.1';

    if (!studentId) {
      return NextResponse.json({ error: 'student_id is required.' }, { status: 400 });
    }

    await assertTeacherCanAccessStudent(supabase, user, studentId);

    const standardResult = await supabase
      .from('standards')
      .select('id, code, title')
      .eq('code', standardCode)
      .maybeSingle();
    let standard = standardResult.data;
    const standardError = standardResult.error;

    if (standardError) return NextResponse.json({ error: standardError.message }, { status: 500 });
    if (!standard) {
      const fallback = await supabase
        .from('standards')
        .select('id, code, title')
        .eq('code', 'ELA.9.R.1.1')
        .maybeSingle();

      if (fallback.error)
        return NextResponse.json({ error: fallback.error.message }, { status: 500 });
      if (!fallback.data) {
        return NextResponse.json(
          { error: `Standard ${standardCode} was not found.` },
          { status: 404 }
        );
      }

      standard = fallback.data;
    }

    const { data: progress, error: progressError } = await supabase
      .from('standard_progress')
      .upsert(
        {
          student_id: studentId,
          standard_id: standard.id,
          current_status: 'diagnostic',
          teacher_flag: false,
          teacher_flag_reason: null,
          current_gap: null,
          last_session_at: new Date().toISOString(),
        },
        { onConflict: 'student_id,standard_id' }
      )
      .select('*')
      .single();

    if (progressError) return NextResponse.json({ error: progressError.message }, { status: 500 });

    return NextResponse.json({
      ok: true,
      standard,
      progress,
      reason: body.reason ?? null,
    });
  } catch (err) {
    console.error('[api/fast/assign-diagnostic] error:', err);
    const message = err instanceof Error ? err.message : 'Could not assign diagnostic.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
