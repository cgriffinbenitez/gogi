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

export async function GET(req: NextRequest) {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, getSupabaseApiKey());

  try {
    const standardCode = new URL(req.url).searchParams.get('standard_code');
    if (!standardCode) {
      return NextResponse.json({ error: 'standard_code is required.' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('intervention_passages')
      .select('source_title, approval_status')
      .eq('source', 'manual_rights')
      .eq('standard_code', standardCode)
      .limit(5000);

    if (error) throw new Error(error.message);

    const counts = (data ?? []).reduce<Record<string, number>>((map, row) => {
      if (row.approval_status === 'rejected') return map;
      const title = String(row.source_title ?? '').trim().toLowerCase();
      if (!title) return map;
      map[title] = (map[title] ?? 0) + 1;
      return map;
    }, {});

    return NextResponse.json({ ok: true, counts });
  } catch (err) {
    console.error('[api/reading-wins/gutenberg/rights-coverage] error:', err);
    const message = err instanceof Error ? err.message : 'Could not load rights coverage.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
