import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

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

type Params = {
  params: Promise<{ passageId: string }>;
};

const VALID_STATUS = new Set(['approved', 'rejected', 'pending_review']);

export async function PATCH(req: NextRequest, { params }: Params) {
  const { passageId } = await params;
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, getSupabaseApiKey());

  try {
    const body = (await req.json()) as {
      status?: string;
      rejection_reason?: string;
      standard_code?: string | null;
      coverage_strand_id?: string | null;
      coverage_strand_label?: string | null;
      coverage_strand_signals?: string[] | null;
    };
    if (body.status && !VALID_STATUS.has(body.status)) {
      return NextResponse.json({ error: 'Valid status required.' }, { status: 400 });
    }

    const updates: Record<string, unknown> = {};

    if (body.status) {
      Object.assign(updates, {
        approved: body.status === 'approved',
        approval_status: body.status,
        reviewed_at: new Date().toISOString(),
        reviewed_by: null,
        rejection_reason: body.status === 'rejected' ? (body.rejection_reason ?? 'Rejected') : null,
      });
    }

    if ('standard_code' in body) updates.standard_code = body.standard_code;
    if ('coverage_strand_id' in body) updates.coverage_strand_id = body.coverage_strand_id;
    if ('coverage_strand_label' in body) updates.coverage_strand_label = body.coverage_strand_label;
    if ('coverage_strand_signals' in body) {
      updates.coverage_strand_signals = body.coverage_strand_signals;
    }

    if (!Object.keys(updates).length) {
      return NextResponse.json({ error: 'No passage updates provided.' }, { status: 400 });
    }

    const { error } = await supabase.from('intervention_passages').update(updates).eq('id', passageId);

    if (error) throw new Error(error.message);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[api/reading-wins/gutenberg/passages/:id] error:', err);
    const message = err instanceof Error ? err.message : 'Could not update Gutenberg passage.';
    const status = /unauthorized/i.test(message) ? 401 : 500;

    return NextResponse.json({ error: message }, { status });
  }
}
