import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { buildOriginalQuestionInsert } from '@/lib/original-items/promotion';

export const runtime = 'nodejs';

type Params = {
  params: Promise<{ draftId: string }>;
};

type DraftRow = {
  id: string;
  benchmark_code: string;
  passage_title: string;
  passage_text: string;
  prompt_text: string;
  options: Array<{ letter: string; text: string }>;
  correct_answer: string;
  correct_rationale: string;
  remediation_hint: string;
  difficulty_estimate: number;
  promoted_question_id: string | null;
};

export async function POST(_req: NextRequest, { params }: Params) {
  const { draftId } = await params;
  const supabase = await createServerSupabaseClient();

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: draft, error: draftError } = await supabase
      .from('original_item_drafts')
      .select(
        'id, benchmark_code, passage_title, passage_text, prompt_text, options, correct_answer, correct_rationale, remediation_hint, difficulty_estimate, promoted_question_id'
      )
      .eq('id', draftId)
      .maybeSingle();

    if (draftError) throw new Error(draftError.message);
    if (!draft)
      return NextResponse.json({ error: 'Original item draft not found.' }, { status: 404 });

    const item = draft as DraftRow;
    if (item.promoted_question_id) {
      return NextResponse.json({
        ok: true,
        already_promoted: true,
        question_id: item.promoted_question_id,
      });
    }

    const { data: standard, error: standardError } = await supabase
      .from('standards')
      .select('id')
      .eq('code', item.benchmark_code)
      .maybeSingle();

    if (standardError) throw new Error(standardError.message);

    const insert = buildOriginalQuestionInsert(item, {
      standardId: standard?.id ?? null,
    });

    const { data: question, error: insertError } = await supabase
      .from('questions')
      .insert(insert)
      .select('id')
      .single();

    if (insertError) throw new Error(insertError.message);

    const { error: updateError } = await supabase
      .from('original_item_drafts')
      .update({
        status: 'promoted',
        promoted_question_id: question.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', item.id);

    if (updateError) throw new Error(updateError.message);

    return NextResponse.json({ ok: true, question_id: question.id });
  } catch (err) {
    console.error('[api/original-items/:id/promote] error:', err);
    const message = err instanceof Error ? err.message : 'Could not promote original item.';
    const status = /unauthorized/i.test(message) ? 401 : 500;

    return NextResponse.json({ error: message }, { status });
  }
}
