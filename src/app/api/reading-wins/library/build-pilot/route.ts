import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import {
  buildOriginalFastAlignedDraftSet,
  evaluateOriginalItemQuality,
  getPreferredOriginalPassageType,
  type OriginalItemBenchmark,
} from '@/lib/original-items/engine';
import { buildOriginalQuestionInsert } from '@/lib/original-items/promotion';
import { FAST_GRADE9_READING_DEMANDS } from '@/lib/reading-wins/fastSkillMap';
import {
  analyzeReadingWinCoverage,
  type PromotedReadingWinQuestion,
} from '@/lib/reading-wins/sessionBuilder';

export const runtime = 'nodejs';

type QuestionBankRow = PromotedReadingWinQuestion & {
  source_classification: string | null;
};

type BuildResult = {
  standard_code: string;
  status_before: 'ready' | 'thin' | 'blocked';
  status_after: 'ready' | 'thin' | 'blocked';
  viable_before: number;
  viable_after: number;
  generated_count: number;
  promoted_count: number;
  issues_after: string[];
};

const DEFAULT_TARGET_PER_STANDARD = 24;
const MAX_TARGET_PER_STANDARD = 60;
const MAX_GENERATE_PER_STANDARD = 40;

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient();

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = (await req.json().catch(() => ({}))) as {
      target_per_standard?: number;
      standards?: string[];
    };
    const targetPerStandard = Math.max(
      6,
      Math.min(
        MAX_TARGET_PER_STANDARD,
        Math.floor(Number(body.target_per_standard ?? DEFAULT_TARGET_PER_STANDARD))
      )
    );
    const requestedStandards = new Set(body.standards ?? []);
    const demands = requestedStandards.size
      ? FAST_GRADE9_READING_DEMANDS.filter((demand) => requestedStandards.has(demand.standardCode))
      : FAST_GRADE9_READING_DEMANDS;

    const results: BuildResult[] = [];

    for (const demand of demands) {
      const { data: standard, error: standardError } = await supabase
        .from('standards')
        .select('id')
        .eq('code', demand.standardCode)
        .maybeSingle();

      if (standardError) throw new Error(standardError.message);

      const { data: beforeRows, error: beforeError } = await supabase
        .from('questions')
        .select(
          'id, content, cognitive_skill_targeted, source_classification, difficulty_level, title, option_a_text, option_b_text, option_c_text, option_d_text, correct_option, rationale, source, is_released_item'
        )
        .eq('approved', true)
        .eq('flagged', false)
        .or(
          `cognitive_skill_targeted.eq.${demand.standardCode},source_classification.eq.${demand.standardCode}`
        )
        .limit(1200);

      if (beforeError) throw new Error(beforeError.message);

      const before = analyzeReadingWinCoverage({
        demand,
        questions: (beforeRows ?? []) as QuestionBankRow[],
      });
      const needed = Math.max(0, targetPerStandard - before.viableRows);
      const generateCount = Math.min(MAX_GENERATE_PER_STANDARD, needed);
      let promotedCount = 0;
      let generatedCount = 0;

      if (generateCount > 0) {
        const benchmarkCode = demand.standardCode as OriginalItemBenchmark;
        const drafts = buildOriginalFastAlignedDraftSet({
          benchmarkCode,
          passageType: getPreferredOriginalPassageType(benchmarkCode),
          grade: 9,
          count: generateCount,
        });
        const qualityGates = drafts.map((draft) => evaluateOriginalItemQuality(draft));
        const acceptedDrafts = drafts.filter(
          (_, index) => qualityGates[index].decision !== 'reject'
        );
        generatedCount = acceptedDrafts.length;

        if (acceptedDrafts.length) {
          const { data: insertedDrafts, error: draftError } = await supabase
            .from('original_item_drafts')
            .insert(acceptedDrafts.map((draft) => ({ ...draft, created_by: user.id })))
            .select('*');

          if (draftError) throw new Error(draftError.message);

          for (const draft of insertedDrafts ?? []) {
            const insert = buildOriginalQuestionInsert(draft, {
              standardId: standard?.id ?? null,
            });
            const { data: question, error: promoteError } = await supabase
              .from('questions')
              .insert(insert)
              .select('id')
              .single();

            if (promoteError) throw new Error(promoteError.message);
            promotedCount += 1;

            await supabase
              .from('original_item_drafts')
              .update({
                status: 'promoted',
                promoted_question_id: question.id,
                updated_at: new Date().toISOString(),
              })
              .eq('id', draft.id);
          }
        }
      }

      const { data: afterRows, error: afterError } = await supabase
        .from('questions')
        .select(
          'id, content, cognitive_skill_targeted, source_classification, difficulty_level, title, option_a_text, option_b_text, option_c_text, option_d_text, correct_option, rationale, source, is_released_item'
        )
        .eq('approved', true)
        .eq('flagged', false)
        .or(
          `cognitive_skill_targeted.eq.${demand.standardCode},source_classification.eq.${demand.standardCode}`
        )
        .limit(1200);

      if (afterError) throw new Error(afterError.message);

      const after = analyzeReadingWinCoverage({
        demand,
        questions: (afterRows ?? []) as QuestionBankRow[],
      });

      results.push({
        standard_code: demand.standardCode,
        status_before: before.status,
        status_after: after.status,
        viable_before: before.viableRows,
        viable_after: after.viableRows,
        generated_count: generatedCount,
        promoted_count: promotedCount,
        issues_after: after.issues,
      });
    }

    const readyCount = results.filter((result) => result.status_after === 'ready').length;

    return NextResponse.json({
      ok: true,
      target_per_standard: targetPerStandard,
      ready_count: readyCount,
      standard_count: results.length,
      generated_count: results.reduce((sum, result) => sum + result.generated_count, 0),
      promoted_count: results.reduce((sum, result) => sum + result.promoted_count, 0),
      results,
      message: `${readyCount}/${results.length} standards are Reading Win ready after library build.`,
    });
  } catch (err) {
    console.error('[api/reading-wins/library/build-pilot] error:', err);
    const message = err instanceof Error ? err.message : 'Could not build pilot library.';
    const status = /unauthorized/i.test(message) ? 401 : 500;

    return NextResponse.json({ error: message }, { status });
  }
}
