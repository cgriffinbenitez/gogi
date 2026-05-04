import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { assertReleasedItemsAccess } from '@/lib/released-items/auth';
import {
  RELEASED_BOOKLET_GRADES,
  RELEASED_BOOKLET_SUBJECT,
  RELEASED_FAST_BOOKLET_BUCKET,
  type ReleasedBookletUploadResult,
} from '@/lib/released-items/constants';

export const runtime = 'nodejs';

function cleanFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 140);
}

function parseInteger(value: FormDataEntryValue | null) {
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : null;
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    await assertReleasedItemsAccess(supabase, user);

    const form = await req.formData();
    const file = form.get('file');
    const bookletName = String(form.get('booklet_name') ?? '').trim();
    const grade = parseInteger(form.get('grade'));
    const releaseYear = parseInteger(form.get('release_year'));
    const sourceUrl = String(form.get('source_url') ?? '').trim() || null;
    const totalItemsExpected = parseInteger(form.get('total_items_expected'));

    if (!bookletName) {
      return NextResponse.json({ error: 'booklet_name is required.' }, { status: 400 });
    }
    if (!grade || !RELEASED_BOOKLET_GRADES.includes(grade as never)) {
      return NextResponse.json({ error: 'grade must be 8, 9, or 10.' }, { status: 400 });
    }
    if (!releaseYear || releaseYear < 2000 || releaseYear > 2100) {
      return NextResponse.json({ error: 'release_year is required.' }, { status: 400 });
    }
    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: 'Released FAST booklet PDF is required.' },
        { status: 400 }
      );
    }
    if (file.type && file.type !== 'application/pdf') {
      return NextResponse.json({ error: 'Please upload a PDF booklet.' }, { status: 400 });
    }

    const pdfBytes = await file.arrayBuffer();
    const storagePath = `grade-${grade}/${releaseYear}/${Date.now()}-${cleanFileName(file.name || 'released-fast-booklet.pdf')}`;

    const { error: uploadError } = await supabase.storage
      .from(RELEASED_FAST_BOOKLET_BUCKET)
      .upload(storagePath, Buffer.from(pdfBytes), {
        contentType: 'application/pdf',
        upsert: false,
      });

    if (uploadError) throw new Error(uploadError.message);

    const { data: booklet, error: insertError } = await supabase
      .from('released_test_booklets')
      .insert({
        booklet_name: bookletName,
        grade,
        subject: RELEASED_BOOKLET_SUBJECT,
        release_year: releaseYear,
        source_url: sourceUrl,
        raw_pdf_path: storagePath,
        total_items_expected: totalItemsExpected,
        extraction_status: 'pending',
      })
      .select(
        'id, booklet_name, grade, subject, release_year, raw_pdf_path, extraction_status, uploaded_at'
      )
      .single();

    if (insertError) throw new Error(insertError.message);

    return NextResponse.json({
      ok: true,
      booklet: booklet as ReleasedBookletUploadResult,
      next_step: `/api/released-items/booklet/${booklet.id}/extract`,
    });
  } catch (err) {
    console.error('[api/released-items/booklet/upload] error:', err);
    const message = err instanceof Error ? err.message : 'Could not upload released FAST booklet.';
    const status = /teacher or admin access/i.test(message)
      ? 403
      : /unauthorized/i.test(message)
        ? 401
        : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
