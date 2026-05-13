import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { isOfficialFastAlignedSource } from '@/lib/reading-wins/officialFastSources';
import { extractGutenbergPassageIdFromQuestion } from '@/lib/reading-wins/gutenbergStatus';

export const runtime = 'nodejs';

function getSupabaseApiKey() {
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (
    serviceRole &&
    (serviceRole.startsWith('eyJ') ||
      serviceRole.startsWith('sb_secret_') ||
      serviceRole.length > 80)
  ) {
    return serviceRole;
  }

  return process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
}

type PassageRow = {
  id: string;
  standard_code: string | null;
  source_title: string | null;
  source_author: string | null;
  source_gutenberg_id: number | null;
  approval_status: string | null;
};

export async function POST(req: NextRequest) {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, getSupabaseApiKey());

  try {
    const body = (await req.json().catch(() => ({}))) as {
      standard_code?: string;
      dry_run?: boolean;
    };
    const standardCode = body.standard_code?.trim();
    if (!standardCode) {
      return NextResponse.json({ error: 'standard_code is required.' }, { status: 400 });
    }

    const { data: passages, error: passageError } = await supabase
      .from('intervention_passages')
      .select('id, standard_code, source_title, source_author, source_gutenberg_id, approval_status')
      .eq('source', 'gutenberg')
      .eq('standard_code', standardCode)
      .limit(5000);

    if (passageError) throw new Error(passageError.message);

    const legacyPassages = ((passages ?? []) as PassageRow[]).filter(
      (passage) =>
        passage.approval_status !== 'rejected' &&
        !isOfficialFastAlignedSource({
          standardCode,
          sourceTitle: passage.source_title,
          sourceAuthor: passage.source_author,
          sourceGutenbergId: passage.source_gutenberg_id,
        })
    );
    const legacyIds = legacyPassages.map((passage) => passage.id);

    const { data: questions, error: questionError } = await supabase
      .from('questions')
      .select('id, content')
      .eq('source', 'gutenberg_public_domain')
      .limit(5000);

    if (questionError) throw new Error(questionError.message);

    const legacyIdSet = new Set(legacyIds);
    const questionIdsToRemove = (questions ?? [])
      .filter((question) => {
        const passageId = extractGutenbergPassageIdFromQuestion(question.content as string | null);
        return Boolean(passageId && legacyIdSet.has(passageId));
      })
      .map((question) => question.id as string);

    if (!body.dry_run && legacyIds.length) {
      const { error: updateError } = await supabase
        .from('intervention_passages')
        .update({
          approval_status: 'rejected',
          approved: false,
          rejection_reason:
            'Legacy pre-official harvest archived: not mapped to the official FAST/B.E.S.T. text list for this standard.',
          reviewed_at: new Date().toISOString(),
        })
        .in('id', legacyIds);
      if (updateError) throw new Error(updateError.message);
    }

    if (!body.dry_run && questionIdsToRemove.length) {
      const { error: deleteError } = await supabase
        .from('questions')
        .delete()
        .in('id', questionIdsToRemove);
      if (deleteError) throw new Error(deleteError.message);
    }

    return NextResponse.json({
      ok: true,
      dry_run: Boolean(body.dry_run),
      standard_code: standardCode,
      legacy_passage_count: legacyIds.length,
      removed_question_count: questionIdsToRemove.length,
      message: body.dry_run
        ? `${legacyIds.length} non-official passage${
            legacyIds.length === 1 ? '' : 's'
          } would move to the legacy archive.`
        : `Moved ${legacyIds.length} non-official passage${
            legacyIds.length === 1 ? '' : 's'
          } to the legacy archive and removed ${questionIdsToRemove.length} old promoted question row${
            questionIdsToRemove.length === 1 ? '' : 's'
          }.`,
    });
  } catch (err) {
    console.error('[api/reading-wins/gutenberg/legacy-nonofficial] error:', err);
    const message =
      err instanceof Error ? err.message : 'Could not move non-official passages to legacy.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
