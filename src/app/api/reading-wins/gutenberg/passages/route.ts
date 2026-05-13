import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  buildGutenbergReadingWinQuestionInsert,
  type GutenbergPassageForReadingWin,
} from '@/lib/reading-wins/gutenbergBridge';
import { extractGutenbergPassageIdFromQuestion } from '@/lib/reading-wins/gutenbergStatus';
import { getFastAldGuidanceForStandard } from '@/lib/fast/achievementLevelDescriptions';

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

function extractSection(content: string | null, section: string) {
  if (!content) return null;
  const pattern = new RegExp(`${section}:\\n([\\s\\S]*?)(?=\\n\\n[A-Z_]+:|$)`, 'i');
  return content.match(pattern)?.[1]?.trim() ?? null;
}

function buildGeneratedItemPreview(passage: GutenbergPassageForReadingWin) {
  const insert = buildGutenbergReadingWinQuestionInsert(passage, { standardId: null });
  if (!insert) return null;

  return {
    question: extractSection(insert.content, 'QUESTION'),
    options: extractSection(insert.content, 'OPTIONS'),
    answer: extractSection(insert.content, 'ANSWER'),
    target_standard: extractSection(insert.content, 'TARGET_STANDARD'),
    target_skill: extractSection(insert.content, 'TARGET_SKILL'),
    quality: extractSection(insert.content, 'FAST_ITEM_QUALITY'),
    teacher_trust_note: extractSection(insert.content, 'TEACHER_TRUST_NOTE'),
    rationale: insert.rationale,
    difficulty_level: insert.difficulty_level,
  };
}

function extractAldRationale(tierRationale?: string | null) {
  const scoreMatch = tierRationale?.match(/ALD alignment score:\s*([0-9.-]+)/i);
  const reasonsMatch = tierRationale?.match(/ALD reasons:\s*([\s\S]*?)(?:\s+No question package generated\.|$)/i);
  return {
    score: scoreMatch ? Number(scoreMatch[1]) : null,
    reasons: reasonsMatch?.[1]
      ?.split('|')
      .map((item) => item.trim())
      .filter(Boolean) ?? [],
  };
}

function buildAldPurpose(passage: GutenbergPassageForReadingWin) {
  if (!passage.standard_code) return null;
  const guidance = getFastAldGuidanceForStandard(passage.standard_code);
  const rationale = extractAldRationale(passage.tier_rationale);
  const matchedGuidance = guidance.filter((item) =>
    rationale.reasons.some((reason) => reason.includes(item.question))
  );

  return {
    score: rationale.score,
    questions: (matchedGuidance.length ? matchedGuidance : guidance).slice(0, 3).map((item) => ({
      category_code: item.category_code,
      category_name: item.category_name,
      question: item.question,
      content_use: item.content_use,
    })),
    reasons: rationale.reasons,
  };
}

const PASSAGE_SELECT_WITH_COVERAGE =
  'id, classification, source, standard_code, coverage_strand_id, coverage_strand_label, coverage_strand_signals, paragraph_text, word_count, source_title, source_author, source_year, source_gutenberg_id, intervention_tier, target_signal, supporting_evidence, non_supporting_evidence, plausible_distractors, tier_rationale, approval_status, approved, rejection_reason, created_at, reviewed_at';

const PASSAGE_SELECT_LEGACY =
  'id, classification, source, paragraph_text, word_count, source_title, source_author, source_year, source_gutenberg_id, intervention_tier, target_signal, supporting_evidence, non_supporting_evidence, plausible_distractors, tier_rationale, approval_status, approved, rejection_reason, created_at, reviewed_at';

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
    const includeLegacy = url.searchParams.get('include_legacy') === '1';
    const limit = Math.max(1, Math.min(200, Number(url.searchParams.get('limit') ?? 80)));

    function buildPassageQuery(select: string) {
      let passageQuery = supabase
        .from('intervention_passages')
        .select(select)
        .in('source', ['gutenberg', 'manual_rights', 'official_text_library'])
        .order('created_at', { ascending: false })
        .limit(limit);

      if (standardCode && select === PASSAGE_SELECT_WITH_COVERAGE) {
        passageQuery = passageQuery.eq('standard_code', standardCode);
      }

      if (status === 'approved') {
        passageQuery = passageQuery.or('approval_status.eq.approved,approved.eq.true');
      } else if (status === 'pending') {
        passageQuery = passageQuery.or('approval_status.eq.pending_review,approval_status.is.null');
      } else if (status === 'rejected') {
        passageQuery = passageQuery.eq('approval_status', 'rejected');
        passageQuery = passageQuery.not('rejection_reason', 'ilike', 'Legacy pre-official%');
      } else if (status === 'legacy') {
        passageQuery = passageQuery.eq('approval_status', 'rejected');
        passageQuery = passageQuery.ilike('rejection_reason', 'Legacy pre-official%');
      } else if (!includeLegacy) {
        passageQuery = passageQuery.or(
          'rejection_reason.is.null,rejection_reason.not.ilike.Legacy pre-official%'
        );
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
          .in('source', ['gutenberg_public_domain', 'rights_managed_literature'])
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
        standard_code: passage.standard_code ?? null,
        generated_item_preview: buildGeneratedItemPreview({
          ...passage,
          standard_code: passage.standard_code ?? null,
        }),
        ald_purpose: buildAldPurpose({
          ...passage,
          standard_code: passage.standard_code ?? null,
        }),
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
