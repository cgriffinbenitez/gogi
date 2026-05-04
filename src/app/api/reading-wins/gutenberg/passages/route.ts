import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  mapGutenbergClassificationToFastStandard,
  type GutenbergPassageForReadingWin,
} from '@/lib/reading-wins/gutenbergBridge';
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

type PassageRow = GutenbergPassageForReadingWin & {
  approval_status: string | null;
  approved: boolean | null;
  rejection_reason: string | null;
  created_at: string | null;
  reviewed_at: string | null;
};

const PASSAGE_SELECT_WITH_COVERAGE =
  'id, classification, standard_code, coverage_strand_id, coverage_strand_label, coverage_strand_signals, paragraph_text, word_count, source_title, source_author, source_year, source_gutenberg_id, intervention_tier, target_signal, supporting_evidence, non_supporting_evidence, plausible_distractors, tier_rationale, approval_status, approved, rejection_reason, created_at, reviewed_at';

const PASSAGE_SELECT_LEGACY =
  'id, classification, paragraph_text, word_count, source_title, source_author, source_year, source_gutenberg_id, intervention_tier, target_signal, supporting_evidence, non_supporting_evidence, plausible_distractors, tier_rationale, approval_status, approved, rejection_reason, created_at, reviewed_at';

function isCoverageColumnMissing(message: string) {
  return /standard_code|coverage_strand_id|coverage_strand_label|coverage_strand_signals/i.test(
    message
  );
}

export async function GET(req: NextRequest) {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, getSupabaseApiKey());

  try {
    const url = new URL(req.url);
    const standardCode = url.searchParams.get('standard_code');
    const status = url.searchParams.get('status') ?? 'all';
    const limit = Math.max(1, Math.min(200, Number(url.searchParams.get('limit') ?? 80)));

    let allowedClassifications: string[] | null = null;
    if (standardCode) {
      allowedClassifications = [
        'inferencing',
        'evidence_retrieval_failure',
        'tone_misreading',
        'mood_misreading',
        'figurative_language_failure',
        'comprehension_integration_failure',
        'topic_vs_theme_confusion',
        'structure_purpose_disconnect',
        'vocabulary_gap',
        'morphology_gap',
        'syntax_barrier',
        'schema_strategy_missing',
        'no_metacognitive_strategy',
      ].filter(
        (classification) =>
          mapGutenbergClassificationToFastStandard(classification) === standardCode
      );
    }

    function buildPassageQuery(select: string) {
      let passageQuery = supabase
        .from('intervention_passages')
        .select(select)
        .eq('source', 'gutenberg')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (allowedClassifications?.length) {
        passageQuery = passageQuery.in('classification', allowedClassifications);
      }

      if (status === 'approved') {
        passageQuery = passageQuery.or('approval_status.eq.approved,approved.eq.true');
      } else if (status === 'pending') {
        passageQuery = passageQuery.or('approval_status.eq.pending_review,approval_status.is.null');
      } else if (status === 'rejected') {
        passageQuery = passageQuery.eq('approval_status', 'rejected');
      }

      return passageQuery;
    }

    const [{ data: passages, error: passageError }, { data: questions, error: questionError }] =
      await Promise.all([
        buildPassageQuery(PASSAGE_SELECT_WITH_COVERAGE).then((result) =>
          result.error && isCoverageColumnMissing(result.error.message)
            ? buildPassageQuery(PASSAGE_SELECT_LEGACY)
            : result
        ),
        supabase
          .from('questions')
          .select(
            'id, content, cognitive_skill_targeted, source_classification, title, option_a_text, option_b_text, option_c_text, option_d_text, correct_option, rationale, difficulty_level'
          )
          .eq('source', 'gutenberg_public_domain')
          .limit(5000),
      ]);

    if (passageError) throw new Error(passageError.message);
    if (questionError) throw new Error(questionError.message);

    const questionsByPassage = new Map<string, typeof questions>();
    for (const question of questions ?? []) {
      const passageId = extractGutenbergPassageIdFromQuestion(question.content as string | null);
      if (!passageId) continue;
      questionsByPassage.set(passageId, [...(questionsByPassage.get(passageId) ?? []), question]);
    }

    const rows = ((passages ?? []) as unknown as PassageRow[])
      .map((passage) => ({
        ...passage,
        standard_code:
          passage.standard_code ?? mapGutenbergClassificationToFastStandard(passage.classification),
        promoted_questions: questionsByPassage.get(passage.id) ?? [],
        promoted_question_count: questionsByPassage.get(passage.id)?.length ?? 0,
      }))
      .filter((row) => (standardCode ? row.standard_code === standardCode : true));

    return NextResponse.json({ ok: true, rows });
  } catch (err) {
    console.error('[api/reading-wins/gutenberg/passages] error:', err);
    const message = err instanceof Error ? err.message : 'Could not load Gutenberg passages.';
    const status = /unauthorized/i.test(message) ? 401 : 500;

    return NextResponse.json({ error: message }, { status });
  }
}
