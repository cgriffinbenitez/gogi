import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  buildGutenbergReadingWinQuestionInserts,
  type GutenbergPassageForReadingWin,
} from '@/lib/reading-wins/gutenbergBridge';

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

function extractPromotedPassageIds(content: string | null) {
  if (!content) return null;
  return (
    content.match(/Project Gutenberg passage ([0-9a-f-]{20,})/i)?.[1] ??
    content.match(/GOGI rights-managed passage ([0-9a-f-]{20,})/i)?.[1] ??
    null
  );
}

const PASSAGE_SELECT_WITH_COVERAGE =
  'id, classification, source, standard_code, coverage_strand_id, coverage_strand_label, coverage_strand_signals, paragraph_text, word_count, source_title, source_author, source_year, source_gutenberg_id, intervention_tier, target_signal, supporting_evidence, non_supporting_evidence, plausible_distractors, tier_rationale';

const PASSAGE_SELECT_LEGACY =
  'id, classification, source, paragraph_text, word_count, source_title, source_author, source_year, source_gutenberg_id, intervention_tier, target_signal, supporting_evidence, non_supporting_evidence, plausible_distractors, tier_rationale';
const REVIEWABLE_PASSAGE_SOURCES = ['gutenberg', 'manual_rights', 'official_text_library'];

function isCoverageColumnMissing(message: string) {
  return /standard_code|coverage_strand_id|coverage_strand_label|coverage_strand_signals/i.test(
    message
  );
}

export async function POST(req: NextRequest) {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, getSupabaseApiKey());

  try {
    const body = (await req.json().catch(() => ({}))) as {
      limit?: number;
      classification?: string;
      standard_code?: string;
      passage_ids?: string[];
      replace_existing?: boolean;
    };
    const limit = Math.max(1, Math.min(100, Math.floor(Number(body.limit ?? 40))));

    const { data: standardRows, error: standardError } = await supabase
      .from('standards')
      .select('id, code');

    if (standardError) throw new Error(standardError.message);

    const standardIdByCode = new Map(
      (standardRows ?? []).map((standard) => [standard.code as string, standard.id as string])
    );

    const { data: existingRows, error: existingError } = await supabase
      .from('questions')
      .select('id, content')
      .in('source', ['gutenberg_public_domain', 'rights_managed_literature'])
      .limit(5000);

    if (existingError) throw new Error(existingError.message);

    const existingByPassageId = new Map<string, string[]>();
    for (const row of existingRows ?? []) {
      const passageId = extractPromotedPassageIds(row.content as string | null);
      if (!passageId) continue;
      existingByPassageId.set(passageId, [
        ...(existingByPassageId.get(passageId) ?? []),
        row.id as string,
      ]);
    }
    const replaceIds = new Set(body.replace_existing ? (body.passage_ids ?? []) : []);
    const alreadyPromoted = new Set(
      Array.from(existingByPassageId.keys())
        .filter((id) => !replaceIds.has(id))
        .filter((id): id is string => Boolean(id))
    );

    function buildPassageQuery(select: string) {
      let query = supabase
        .from('intervention_passages')
        .select(select)
        .in('source', REVIEWABLE_PASSAGE_SOURCES)
        .or('approval_status.eq.approved,approved.eq.true')
        .order('created_at', { ascending: false })
        .limit(limit * 3);

      if (body.passage_ids?.length) {
        query = query.in('id', body.passage_ids);
      }

      if (body.classification) {
        query = query.eq('classification', body.classification);
      }

      if (body.standard_code && select === PASSAGE_SELECT_WITH_COVERAGE) {
        query = query.eq('standard_code', body.standard_code);
      }

      return query;
    }

    const { data: passageRows, error: passageError } = await buildPassageQuery(
      PASSAGE_SELECT_WITH_COVERAGE
    ).then((result) =>
      result.error && isCoverageColumnMissing(result.error.message)
        ? buildPassageQuery(PASSAGE_SELECT_LEGACY)
        : result
    );

    if (passageError) throw new Error(passageError.message);

    const approvedPassages = ((passageRows ?? []) as unknown as GutenbergPassageForReadingWin[])
      .filter((passage) => !alreadyPromoted.has(passage.id))
      .filter((passage) => {
        const standardCode = passage.standard_code ?? null;
        if (!standardCode) return false;
        return body.standard_code ? standardCode === body.standard_code : true;
      })
      .slice(0, limit);

    const promotionPackages = approvedPassages.map((passage) => {
      const standardCode = passage.standard_code ?? null;
      const questionInserts = buildGutenbergReadingWinQuestionInserts(passage, {
        standardId: standardCode ? (standardIdByCode.get(standardCode) ?? null) : null,
      });

      return {
        passage,
        standardCode,
        questionInserts,
      };
    });
    const inserts = promotionPackages.flatMap((item) => item.questionInserts).filter(Boolean);
    const skippedQualityGate = promotionPackages.filter((item) => !item.questionInserts.length);
    const passagesToReplace = body.replace_existing
      ? promotionPackages.map((item) => item.passage)
      : promotionPackages
          .filter((item) => item.questionInserts.length > 0)
          .map((item) => item.passage);
    const questionIdsToReplace = passagesToReplace
      .flatMap((passage) => existingByPassageId.get(passage.id) ?? [])
      .filter(Boolean);

    if (questionIdsToReplace.length) {
      const { error: deleteError } = await supabase
        .from('questions')
        .delete()
        .in('id', questionIdsToReplace);
      if (deleteError) throw new Error(deleteError.message);
    }

    if (!inserts.length) {
      return NextResponse.json({
        ok: true,
        promoted_count: 0,
        replaced_count: questionIdsToReplace.length,
        skipped_quality_gate: skippedQualityGate.length,
        message:
          skippedQualityGate.length > 0
            ? `No approved Gutenberg passages passed the FAST item quality gate. ${
                questionIdsToReplace.length
                  ? `Removed ${questionIdsToReplace.length} older item row${
                      questionIdsToReplace.length === 1 ? '' : 's'
                    }. `
                  : ''
              }${skippedQualityGate.length} passage${
                skippedQualityGate.length === 1 ? '' : 's'
              } need stronger evidence, distractors, or a tighter standard target.`
            : 'No approved Gutenberg passages were ready to promote. Review/approve passages or run the pipeline first.',
      });
    }

    const { error: insertError } = await supabase.from('questions').insert(inserts);
    if (insertError) throw new Error(insertError.message);

    return NextResponse.json({
      ok: true,
      promoted_count: inserts.length,
      scanned_count: passageRows?.length ?? 0,
      replaced_count: questionIdsToReplace.length,
      skipped_quality_gate: skippedQualityGate.length,
      message: `Promoted ${inserts.length} approved Gutenberg passage${
        inserts.length === 1 ? '' : 's'
      } into Reading Win question rows. ${
        questionIdsToReplace.length ? `Replaced ${questionIdsToReplace.length} older item rows. ` : ''
      }${
        skippedQualityGate.length
          ? `${skippedQualityGate.length} passage${
              skippedQualityGate.length === 1 ? '' : 's'
            } skipped the FAST item quality gate.`
          : 'Every selected passage passed the FAST item quality gate.'
      }`,
    });
  } catch (err) {
    console.error('[api/reading-wins/gutenberg/promote-approved] error:', err);
    const message = err instanceof Error ? err.message : 'Could not promote Gutenberg passages.';
    const status = /unauthorized/i.test(message) ? 401 : 500;

    return NextResponse.json({ error: message }, { status });
  }
}
