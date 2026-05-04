import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { assertReleasedItemsAccess } from '@/lib/released-items/auth';
import { buildReleasedItemClassificationPlan } from '@/lib/released-items/classification';

export const runtime = 'nodejs';

type Params = {
  params: Promise<{ bookletId: string }>;
};

type ReleasedItemRow = {
  id: string;
  item_number: number;
  benchmark_code: string;
  reporting_category: 'RP' | 'RI' | 'RGV';
  item_type: string;
  prompt_text: string;
  correct_answer: string;
  extraction_confidence: number;
  passage_id: string | null;
  released_passages?: { passage_word_count?: number | null } | null;
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
      .select('id, extraction_status')
      .eq('id', bookletId)
      .maybeSingle();

    if (bookletError) throw new Error(bookletError.message);
    if (!booklet) return NextResponse.json({ error: 'Booklet not found.' }, { status: 404 });
    if (booklet.extraction_status !== 'extracted') {
      return NextResponse.json({ error: 'Run extraction before classification.' }, { status: 400 });
    }

    const { data: items, error: itemsError } = await supabase
      .from('released_items')
      .select(
        'id, item_number, benchmark_code, reporting_category, item_type, prompt_text, correct_answer, extraction_confidence, passage_id, released_passages(passage_word_count)'
      )
      .eq('booklet_id', bookletId)
      .order('item_number', { ascending: true });

    if (itemsError) throw new Error(itemsError.message);
    const releasedItems = (items ?? []) as ReleasedItemRow[];
    if (!releasedItems.length) {
      return NextResponse.json({ error: 'No released items found to classify.' }, { status: 400 });
    }

    const { data: benchmarkRows, error: benchmarkError } = await supabase
      .from('fast_benchmark_classification_map')
      .select('benchmark_code, classification_code, weight, rationale');

    if (benchmarkError) throw new Error(benchmarkError.message);

    const plans = releasedItems.map((item) =>
      buildReleasedItemClassificationPlan(
        {
          ...item,
          passage_word_count: item.released_passages?.passage_word_count ?? 0,
          extraction_confidence: Number(item.extraction_confidence),
        },
        (benchmarkRows ?? []).map((row) => ({
          benchmark_code: String(row.benchmark_code),
          classification_code: String(row.classification_code),
          weight: Number(row.weight),
          rationale: row.rationale ? String(row.rationale) : null,
        }))
      )
    );

    const itemIds = releasedItems.map((item) => item.id);

    const { error: deleteReviewError } = await supabase
      .from('released_item_review_queue')
      .delete()
      .in('released_item_id', itemIds);
    if (deleteReviewError) throw new Error(deleteReviewError.message);

    const { error: deleteRolesError } = await supabase
      .from('released_item_roles')
      .delete()
      .in('released_item_id', itemIds);
    if (deleteRolesError) throw new Error(deleteRolesError.message);

    const { error: deleteTiersError } = await supabase
      .from('released_item_tiers')
      .delete()
      .in('id', itemIds);
    if (deleteTiersError) throw new Error(deleteTiersError.message);

    const { error: deleteClassificationsError } = await supabase
      .from('released_item_classifications')
      .delete()
      .in('released_item_id', itemIds);
    if (deleteClassificationsError) throw new Error(deleteClassificationsError.message);

    const classifications = plans.flatMap((plan) => plan.classifications);
    const tiers = plans.map((plan) => plan.tier);
    const roles = plans.flatMap((plan) => plan.roles);
    const reviewRows = plans.map((plan) => plan.reviewQueue);

    const { error: classificationError } = await supabase
      .from('released_item_classifications')
      .insert(classifications);
    if (classificationError) throw new Error(classificationError.message);

    const { error: tierError } = await supabase.from('released_item_tiers').insert(tiers);
    if (tierError) throw new Error(tierError.message);

    const { error: roleError } = await supabase.from('released_item_roles').insert(roles);
    if (roleError) throw new Error(roleError.message);

    const { error: reviewError } = await supabase
      .from('released_item_review_queue')
      .insert(reviewRows);
    if (reviewError) throw new Error(reviewError.message);

    return NextResponse.json({
      ok: true,
      item_count: releasedItems.length,
      classification_count: classifications.length,
      review_count: reviewRows.length,
    });
  } catch (err) {
    console.error('[api/released-items/booklet/:id/classify] error:', err);
    const message = err instanceof Error ? err.message : 'Could not classify released items.';
    const status = /teacher or admin access/i.test(message)
      ? 403
      : /unauthorized/i.test(message)
        ? 401
        : 500;

    return NextResponse.json({ error: message }, { status });
  }
}
