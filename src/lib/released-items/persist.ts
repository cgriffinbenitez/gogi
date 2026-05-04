import type { SupabaseClient } from '@supabase/supabase-js';
import type { ReleasedBookletExtraction } from './extraction';

type SupabaseLike = Pick<SupabaseClient, 'from'>;

export async function persistReleasedBookletExtraction(
  supabase: SupabaseLike,
  bookletId: string,
  extraction: ReleasedBookletExtraction
) {
  const { error: statusError } = await supabase
    .from('released_test_booklets')
    .update({ extraction_status: 'extracting' })
    .eq('id', bookletId);

  if (statusError) throw new Error(statusError.message);

  const { error: deleteItemsError } = await supabase
    .from('released_items')
    .delete()
    .eq('booklet_id', bookletId);

  if (deleteItemsError) throw new Error(deleteItemsError.message);

  const { error: deletePassagesError } = await supabase
    .from('released_passages')
    .delete()
    .eq('booklet_id', bookletId);

  if (deletePassagesError) throw new Error(deletePassagesError.message);

  const { data: passages, error: passageError } = await supabase
    .from('released_passages')
    .insert(
      extraction.passages.map((passage) => ({
        booklet_id: bookletId,
        passage_index: passage.passage_index,
        passage_title: passage.passage_title ?? null,
        passage_type: passage.passage_type,
        passage_text: passage.passage_text,
        passage_word_count: passage.passage_word_count ?? 0,
        inferred_lexile: passage.inferred_lexile ?? null,
      }))
    )
    .select('id, passage_index');

  if (passageError) throw new Error(passageError.message);

  const passageIdByIndex = new Map<number, string>(
    (passages ?? []).map((passage) => [Number(passage.passage_index), String(passage.id)])
  );

  for (const passage of extraction.passages) {
    if (!passage.paired_with_passage_index) continue;
    const passageId = passageIdByIndex.get(passage.passage_index);
    const pairedId = passageIdByIndex.get(passage.paired_with_passage_index);
    if (!passageId || !pairedId) continue;

    const { error: pairError } = await supabase
      .from('released_passages')
      .update({ paired_with_passage_id: pairedId })
      .eq('id', passageId);

    if (pairError) throw new Error(pairError.message);
  }

  const { data: items, error: itemError } = await supabase
    .from('released_items')
    .insert(
      extraction.items.map((item) => ({
        booklet_id: bookletId,
        passage_id: item.passage_index ? (passageIdByIndex.get(item.passage_index) ?? null) : null,
        item_number: item.item_number,
        benchmark_code: item.benchmark_code,
        reporting_category: item.reporting_category,
        item_type: item.item_type,
        prompt_text: item.prompt_text,
        options: item.options,
        correct_answer: item.correct_answer,
        cognitive_complexity: item.cognitive_complexity ?? null,
        extraction_confidence: item.extraction_confidence,
      }))
    )
    .select('id, item_number');

  if (itemError) throw new Error(itemError.message);

  const { error: updateBookletError } = await supabase
    .from('released_test_booklets')
    .update({
      total_items_extracted: extraction.items.length,
      total_items_expected:
        extraction.metadata.total_items_expected && extraction.metadata.total_items_expected > 0
          ? extraction.metadata.total_items_expected
          : extraction.items.length,
      extraction_status: 'extracted',
      extracted_at: new Date().toISOString(),
    })
    .eq('id', bookletId);

  if (updateBookletError) throw new Error(updateBookletError.message);

  return {
    passages: passages ?? [],
    items: items ?? [],
    passage_count: extraction.passages.length,
    item_count: extraction.items.length,
  };
}
