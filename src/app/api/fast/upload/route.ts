import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { assertTeacherCanAccessStudent } from '@/lib/fast/auth';
import { FAST_REPORT_BUCKET } from '@/lib/fast/constants';
import { getFastParseErrorStatus, parseFastPdfWithClaude } from '@/lib/fast/parser';
import { persistFastReportAndGenerateProfile } from '@/lib/fast/persist';

export const runtime = 'nodejs';

function cleanFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120);
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const form = await req.formData();
    const studentId = String(form.get('student_id') ?? '');
    const file = form.get('file');

    if (!studentId) {
      return NextResponse.json({ error: 'student_id is required.' }, { status: 400 });
    }
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'FAST ISR PDF file is required.' }, { status: 400 });
    }
    if (file.type && file.type !== 'application/pdf') {
      return NextResponse.json({ error: 'Please upload a PDF FAST report.' }, { status: 400 });
    }

    await assertTeacherCanAccessStudent(supabase, user, studentId);

    const pdfBytes = await file.arrayBuffer();
    let storagePath: string | null =
      `${studentId}/${Date.now()}-${cleanFileName(file.name || 'fast-isr.pdf')}`;
    let storageWarning: string | null = null;

    const { error: uploadError } = await supabase.storage
      .from(FAST_REPORT_BUCKET)
      .upload(storagePath, Buffer.from(pdfBytes), {
        contentType: 'application/pdf',
        upsert: true,
      });

    if (uploadError) {
      console.error('[api/fast/upload] storage error:', uploadError.message);
      storageWarning = `The FAST report was parsed, but the PDF was not archived because storage is not ready: ${uploadError.message}`;
      storagePath = null;
    }

    const parsed = await parseFastPdfWithClaude(pdfBytes);
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
      storage_warning: storageWarning,
    });
  } catch (err) {
    console.error('[api/fast/upload] error:', err);
    const message = err instanceof Error ? err.message : 'Could not process FAST report.';
    const status = getFastParseErrorStatus(message);
    return NextResponse.json({ error: message }, { status });
  }
}
