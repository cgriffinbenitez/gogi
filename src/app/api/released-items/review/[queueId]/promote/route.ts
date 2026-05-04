import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { assertReleasedItemsAccess } from '@/lib/released-items/auth';
import { buildReleasedQuestionInsert } from '@/lib/released-items/promotion';

export const runtime = 'nodejs';

type Params = {
  params: Promise<{ queueId: string }>;
};

type ReviewRow = {
  id: string;
  released_item_id: string;
  status: string;
  released_items: {
    id: string;
    booklet_id: string;
    item_number: number;
    benchmark_code: string;
    item_type: string;
    prompt_text: string;
    options: Array<{ letter: string; text: string }>;
    correct_answer: string;
    released_passages?: {
      passage_title?: string | null;
      passage_text?: string | null;
    } | null;
  } | null;
};

type ReleasedItemReview = NonNullable<ReviewRow['released_items']>;
type ReleasedPassageReview = NonNullable<ReleasedItemReview['released_passages']>;

type RawReviewRow = Omit<ReviewRow, 'released_items'> & {
  released_items:
    | (Omit<ReleasedItemReview, 'released_passages'> & {
        released_passages: ReleasedPassageReview | ReleasedPassageReview[] | null;
      })
    | Array<
        Omit<ReleasedItemReview, 'released_passages'> & {
          released_passages: ReleasedPassageReview | ReleasedPassageReview[] | null;
        }
      >
    | null;
};

function tierToDifficulty(tier?: string | null) {
  if (tier === 'T4') return 4;
  if (tier === 'T3') return 3;
  if (tier === 'T2') return 2;
  return 1;
}

function normalizeReviewRow(row: RawReviewRow): ReviewRow {
  const item = Array.isArray(row.released_items) ? row.released_items[0] : row.released_items;
  const passage = Array.isArray(item?.released_passages)
    ? item.released_passages[0]
    : item?.released_passages;

  return {
    ...row,
    released_items: item ? { ...item, released_passages: passage ?? null } : null,
  };
}

export async function POST(_req: NextRequest, { params }: Params) {
  const { queueId } = await params;
  const supabase = await createServerSupabaseClient();

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    await assertReleasedItemsAccess(supabase, user);

    const { data: review, error: reviewError } = await supabase
      .from('released_item_review_queue')
      .select(
        'id, released_item_id, status, released_items(id, booklet_id, item_number, benchmark_code, item_type, prompt_text, options, correct_answer, released_passages(passage_title, passage_text))'
      )
      .eq('id', queueId)
      .maybeSingle();

    if (reviewError) throw new Error(reviewError.message);
    if (!review) return NextResponse.json({ error: 'Review item not found.' }, { status: 404 });

    const row = normalizeReviewRow(review as unknown as RawReviewRow);
    const item = row.released_items;
    if (!item) return NextResponse.json({ error: 'Released item not found.' }, { status: 404 });

    const { data: existingQuestion, error: existingError } = await supabase
      .from('questions')
      .select('id')
      .eq('released_item_id', item.id)
      .maybeSingle();

    if (existingError) throw new Error(existingError.message);
    if (existingQuestion) {
      return NextResponse.json({
        ok: true,
        question_id: existingQuestion.id,
        already_promoted: true,
      });
    }

    const [{ data: standard }, { data: primaryClassification }, { data: tier }] = await Promise.all(
      [
        supabase.from('standards').select('id').eq('code', item.benchmark_code).maybeSingle(),
        supabase
          .from('released_item_classifications')
          .select('classification_code, weight, confidence')
          .eq('released_item_id', item.id)
          .order('weight', { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase.from('released_item_tiers').select('tier').eq('id', item.id).maybeSingle(),
      ]
    );

    const insert = buildReleasedQuestionInsert(item, {
      standardId: standard?.id ?? null,
      primaryClassification:
        primaryClassification?.classification_code ?? 'evidence_retrieval_failure',
      difficultyLevel: tierToDifficulty(tier?.tier),
    });

    const { data: question, error: insertError } = await supabase
      .from('questions')
      .insert(insert)
      .select('id')
      .single();

    if (insertError) throw new Error(insertError.message);

    const { error: reviewUpdateError } = await supabase
      .from('released_item_review_queue')
      .update({
        status: 'approved',
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
        decision_reason: 'promoted_to_question_bank',
      })
      .eq('id', queueId);

    if (reviewUpdateError) throw new Error(reviewUpdateError.message);

    const { data: releasedIds, error: releasedIdsError } = await supabase
      .from('released_items')
      .select('id')
      .eq('booklet_id', item.booklet_id);

    if (releasedIdsError) throw new Error(releasedIdsError.message);

    const { count, error: countError } = await supabase
      .from('questions')
      .select('id', { count: 'exact', head: true })
      .eq('is_released_item', true)
      .not('released_item_id', 'is', null)
      .in(
        'released_item_id',
        (releasedIds ?? []).map((releasedItem) => releasedItem.id)
      );

    if (!countError) {
      await supabase
        .from('released_test_booklets')
        .update({ total_items_promoted: count ?? 0 })
        .eq('id', item.booklet_id);
    }

    return NextResponse.json({ ok: true, question_id: question.id });
  } catch (err) {
    console.error('[api/released-items/review/:id/promote] error:', err);
    const message = err instanceof Error ? err.message : 'Could not promote released item.';
    const status = /teacher or admin access/i.test(message)
      ? 403
      : /unauthorized/i.test(message)
        ? 401
        : 500;

    return NextResponse.json({ error: message }, { status });
  }
}
