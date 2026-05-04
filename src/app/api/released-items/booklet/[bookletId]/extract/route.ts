import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { assertReleasedItemsAccess } from '@/lib/released-items/auth';
import { RELEASED_FAST_BOOKLET_BUCKET } from '@/lib/released-items/constants';
import {
  extractReleasedFastBookletWithClaude,
  getReleasedExtractionErrorStatus,
} from '@/lib/released-items/extraction';
import { extractReleasedBookletFromText } from '@/lib/released-items/localExtraction';
import { readPdfTextLocally } from '@/lib/released-items/localPdf';
import { persistReleasedBookletExtraction } from '@/lib/released-items/persist';

export const runtime = 'nodejs';

type Params = {
  params: Promise<{ bookletId: string }>;
};

export async function POST(_req: NextRequest, { params }: Params) {
  const { bookletId } = await params;
  const supabase = await createServerSupabaseClient();

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    await assertReleasedItemsAccess(supabase, user);

    const { data: booklet, error: bookletError } = await supabase
      .from('released_test_booklets')
      .select('id, booklet_name, grade, subject, release_year, total_items_expected, raw_pdf_path')
      .eq('id', bookletId)
      .maybeSingle();

    if (bookletError) throw new Error(bookletError.message);
    if (!booklet) return NextResponse.json({ error: 'Booklet not found.' }, { status: 404 });

    const { error: statusError } = await supabase
      .from('released_test_booklets')
      .update({ extraction_status: 'extracting' })
      .eq('id', bookletId);

    if (statusError) throw new Error(statusError.message);

    const { data: file, error: downloadError } = await supabase.storage
      .from(RELEASED_FAST_BOOKLET_BUCKET)
      .download(booklet.raw_pdf_path);

    if (downloadError || !file) {
      throw new Error(downloadError?.message ?? 'Could not download released FAST booklet PDF.');
    }

    const pdfBytes = await file.arrayBuffer();
    let extraction;
    try {
      extraction = await extractReleasedFastBookletWithClaude(pdfBytes);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (!/content filtering|Output blocked/i.test(message)) throw err;

      const text = await readPdfTextLocally(pdfBytes);
      extraction = extractReleasedBookletFromText(text, {
        booklet_name: booklet.booklet_name,
        grade: booklet.grade,
        subject: booklet.subject,
        release_year: booklet.release_year,
        total_items_expected: booklet.total_items_expected,
      });
    }

    const result = await persistReleasedBookletExtraction(supabase, bookletId, extraction);

    return NextResponse.json({
      ok: true,
      passage_count: result.passage_count,
      item_count: result.item_count,
      next_step: `/api/released-items/booklet/${bookletId}/classify`,
    });
  } catch (err) {
    console.error('[api/released-items/booklet/:id/extract] error:', err);
    const message = err instanceof Error ? err.message : 'Could not extract released FAST booklet.';

    await supabase
      .from('released_test_booklets')
      .update({ extraction_status: 'extraction_failed' })
      .eq('id', bookletId);

    const status = /teacher or admin access/i.test(message)
      ? 403
      : /unauthorized/i.test(message)
        ? 401
        : getReleasedExtractionErrorStatus(message);

    return NextResponse.json({ error: message }, { status });
  }
}
