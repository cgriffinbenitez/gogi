import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  buildGutenbergReadingWinStatus,
  type GutenbergPipelinePassageStatusRow,
  type GutenbergPromotedQuestionStatusRow,
} from '@/lib/reading-wins/gutenbergStatus';

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

function isCoverageColumnMissing(message: string) {
  return /standard_code/i.test(message);
}

export async function GET() {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, getSupabaseApiKey());

  try {
    async function loadPassages() {
      const withCoverage = await supabase
        .from('intervention_passages')
        .select(
          'id, classification, standard_code, approval_status, approved, source_title, source_author'
        )
        .eq('source', 'gutenberg')
        .order('created_at', { ascending: false })
        .limit(5000);

      if (withCoverage.error && isCoverageColumnMissing(withCoverage.error.message)) {
        return supabase
          .from('intervention_passages')
          .select('id, classification, approval_status, approved, source_title, source_author')
          .eq('source', 'gutenberg')
          .order('created_at', { ascending: false })
          .limit(5000);
      }

      return withCoverage;
    }

    const [{ data: passages, error: passageError }, { data: promoted, error: promotedError }] =
      await Promise.all([
        loadPassages(),
        supabase
          .from('questions')
          .select('content, cognitive_skill_targeted, source_classification')
          .eq('source', 'gutenberg_public_domain')
          .limit(5000),
      ]);

    if (passageError) throw new Error(passageError.message);
    if (promotedError) throw new Error(promotedError.message);

    const rows = buildGutenbergReadingWinStatus({
      passages: (passages ?? []) as GutenbergPipelinePassageStatusRow[],
      promotedQuestions: (promoted ?? []) as GutenbergPromotedQuestionStatusRow[],
    });

    return NextResponse.json({
      ok: true,
      rows,
      totals: {
        approved_passages: rows.reduce((sum, row) => sum + row.approved_passages, 0),
        pending_review_passages: rows.reduce((sum, row) => sum + row.pending_review_passages, 0),
        unpromoted_approved_passages: rows.reduce(
          (sum, row) => sum + row.unpromoted_approved_passages,
          0
        ),
        promoted_question_rows: rows.reduce((sum, row) => sum + row.promoted_question_rows, 0),
      },
    });
  } catch (err) {
    console.error('[api/reading-wins/gutenberg/status] error:', err);
    const message = err instanceof Error ? err.message : 'Could not load Gutenberg status.';
    const status = /unauthorized/i.test(message) ? 401 : 500;

    return NextResponse.json({ error: message }, { status });
  }
}
