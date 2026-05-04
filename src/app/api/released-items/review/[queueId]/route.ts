import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { assertReleasedItemsAccess } from '@/lib/released-items/auth';

export const runtime = 'nodejs';

type Params = {
  params: Promise<{ queueId: string }>;
};

const VALID_ACTIONS = new Set(['approved', 'rejected', 'flagged_for_revision', 'pending']);

export async function PATCH(req: NextRequest, { params }: Params) {
  const { queueId } = await params;
  const supabase = await createServerSupabaseClient();

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    await assertReleasedItemsAccess(supabase, user);

    const body = (await req.json()) as { status?: string; review_notes?: string };
    if (!body.status || !VALID_ACTIONS.has(body.status)) {
      return NextResponse.json({ error: 'Valid review status required.' }, { status: 400 });
    }

    const { error } = await supabase
      .from('released_item_review_queue')
      .update({
        status: body.status,
        review_notes: body.review_notes ?? null,
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
        decision_reason: body.status,
      })
      .eq('id', queueId);

    if (error) throw new Error(error.message);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[api/released-items/review/:id] error:', err);
    const message = err instanceof Error ? err.message : 'Could not update released item review.';
    const status = /teacher or admin access/i.test(message)
      ? 403
      : /unauthorized/i.test(message)
        ? 401
        : 500;

    return NextResponse.json({ error: message }, { status });
  }
}
