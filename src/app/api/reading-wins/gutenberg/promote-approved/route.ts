import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  buildGutenbergReadingWinQuestionInserts,
  mapGutenbergClassificationToFastStandard,
  type GutenbergPassageForReadingWin,
} from '@/lib/reading-wins/gutenbergBridge';

export const runtime = 'nodejs';

function getSupabaseApiKey() {
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (serviceRole && (serviceRole.startsWith('eyJ') || serviceRole.length > 80)) {
    return serviceRole;
  }

  return process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
}

function extractPromotedPassageIds(content: string | null) {
  if (!content) return null;
  return content.match(/Project Gutenberg passage ([0-9a-f-]{20,})/i)?.[1] ?? null;
}

export async function POST(req: NextRequest) {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, getSupabaseApiKey());

  try {
    const body = (await req.json().catch(() => ({}))) as {
      limit?: number;
      classification?: string;
      standard_code?: string;
      passage_ids?: string[];
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
      .select('content')
      .eq('source', 'gutenberg_public_domain')
      .limit(5000);

    if (existingError) throw new Error(existingError.message);

    const alreadyPromoted = new Set(
      (existingRows ?? [])
        .map((row) => extractPromotedPassageIds(row.content as string | null))
        .filter((id): id is string => Boolean(id))
    );

    let query = supabase
      .from('intervention_passages')
      .select(
        'id, classification, paragraph_text, word_count, source_title, source_author, source_year, source_gutenberg_id, intervention_tier, target_signal, supporting_evidence, non_supporting_evidence, plausible_distractors, tier_rationale'
      )
      .eq('source', 'gutenberg')
      .or('approval_status.eq.approved,approved.eq.true')
      .order('created_at', { ascending: false })
      .limit(limit * 3);

    if (body.passage_ids?.length) {
      query = query.in('id', body.passage_ids);
    }

    if (body.classification) {
      query = query.eq('classification', body.classification);
    }

    const { data: passageRows, error: passageError } = await query;

    if (passageError) throw new Error(passageError.message);

    const approvedPassages = ((passageRows ?? []) as GutenbergPassageForReadingWin[])
      .filter((passage) => !alreadyPromoted.has(passage.id))
      .filter((passage) => {
        const standardCode = mapGutenbergClassificationToFastStandard(passage.classification);
        if (!standardCode) return false;
        return body.standard_code ? standardCode === body.standard_code : true;
      })
      .slice(0, limit);

    const inserts = approvedPassages
      .flatMap((passage) => {
        const standardCode = mapGutenbergClassificationToFastStandard(passage.classification);
        return buildGutenbergReadingWinQuestionInserts(passage, {
          standardId: standardCode ? (standardIdByCode.get(standardCode) ?? null) : null,
        });
      })
      .filter(Boolean);

    if (!inserts.length) {
      return NextResponse.json({
        ok: true,
        promoted_count: 0,
        message:
          'No approved Gutenberg passages were ready to promote. Review/approve passages or run the pipeline first.',
      });
    }

    const { error: insertError } = await supabase.from('questions').insert(inserts);
    if (insertError) throw new Error(insertError.message);

    return NextResponse.json({
      ok: true,
      promoted_count: inserts.length,
      scanned_count: passageRows?.length ?? 0,
      message: `Promoted ${inserts.length} approved Gutenberg passage${
        inserts.length === 1 ? '' : 's'
      } into Reading Win question rows.`,
    });
  } catch (err) {
    console.error('[api/reading-wins/gutenberg/promote-approved] error:', err);
    const message = err instanceof Error ? err.message : 'Could not promote Gutenberg passages.';
    const status = /unauthorized/i.test(message) ? 401 : 500;

    return NextResponse.json({ error: message }, { status });
  }
}
