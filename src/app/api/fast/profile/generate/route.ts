import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { assertTeacherCanAccessStudent } from '@/lib/fast/auth';
import { generateFastProfileForStudent } from '@/lib/fast/profile';

type Body = {
  student_id?: string;
};

export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = (await req.json()) as Body;
    if (!body.student_id) {
      return NextResponse.json({ error: 'student_id is required.' }, { status: 400 });
    }

    await assertTeacherCanAccessStudent(supabase, user, body.student_id);
    const profile = await generateFastProfileForStudent(supabase, body.student_id);

    return NextResponse.json({ ok: true, profile });
  } catch (err) {
    console.error('[api/fast/profile/generate] error:', err);
    const message = err instanceof Error ? err.message : 'Could not generate FAST profile.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
