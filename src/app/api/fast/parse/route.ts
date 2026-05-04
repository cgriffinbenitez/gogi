import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { assertTeacherCanAccessStudent } from '@/lib/fast/auth';
import { FAST_REPORT_BUCKET } from '@/lib/fast/constants';
import { getFastParseErrorStatus, parseFastPdfWithClaude } from '@/lib/fast/parser';
import { persistFastReportAndGenerateProfile } from '@/lib/fast/persist';

export const runtime = 'nodejs';

type ParseBody = {
  student_id?: string;
  storage_path?: string;
};

export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = (await req.json()) as ParseBody;
    const studentId = body.student_id;
    const storagePath = body.storage_path;

    if (!studentId || !storagePath) {
      return NextResponse.json(
        { error: 'student_id and storage_path are required.' },
        { status: 400 }
      );
    }

    await assertTeacherCanAccessStudent(supabase, user, studentId);

    const { data: pdf, error: downloadError } = await supabase.storage
      .from(FAST_REPORT_BUCKET)
      .download(storagePath);

    if (downloadError || !pdf) {
      return NextResponse.json(
        { error: downloadError?.message ?? 'FAST report file not found.' },
        { status: 404 }
      );
    }

    const parsed = await parseFastPdfWithClaude(await pdf.arrayBuffer());
    const result = await persistFastReportAndGenerateProfile(
      supabase,
      studentId,
      parsed,
      storagePath
    );

    return NextResponse.json({
      ok: true,
      assessment: result.assessment,
      profile: result.profile,
      item_count: result.item_count,
    });
  } catch (err) {
    console.error('[api/fast/parse] error:', err);
    const message = err instanceof Error ? err.message : 'Could not parse FAST report.';
    const status = getFastParseErrorStatus(message);
    return NextResponse.json({ error: message }, { status });
  }
}
