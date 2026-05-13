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

type MetadataPatch = {
  id: string;
  standard_code: string | null;
  coverage_strand_id: string | null;
  coverage_strand_label: string | null;
  coverage_strand_signals: string[] | null;
};

function isCoverageColumnMissing(message: string) {
  return /standard_code|coverage_strand_id|coverage_strand_label|coverage_strand_signals/i.test(
    message
  );
}

export async function POST(req: NextRequest) {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, getSupabaseApiKey());

  try {
    const body = (await req.json().catch(() => ({}))) as { rows?: MetadataPatch[] };
    const rows = (body.rows ?? []).filter((row) => row.id);

    if (!rows.length) {
      return NextResponse.json({ error: 'No metadata rows provided.' }, { status: 400 });
    }

    let updated = 0;

    for (const row of rows) {
      const { error } = await supabase
        .from('intervention_passages')
        .update({
          standard_code: row.standard_code,
          coverage_strand_id: row.coverage_strand_id,
          coverage_strand_label: row.coverage_strand_label,
          coverage_strand_signals: row.coverage_strand_signals,
        })
        .eq('id', row.id);

      if (error) throw new Error(error.message);
      updated += 1;
    }

    return NextResponse.json({
      ok: true,
      updated,
      message: `Applied clean standard/strand metadata to ${updated} passage${
        updated === 1 ? '' : 's'
      }.`,
    });
  } catch (err) {
    console.error('[api/reading-wins/gutenberg/passages/metadata] error:', err);
    const message = err instanceof Error ? err.message : 'Could not update Gutenberg metadata.';

    if (isCoverageColumnMissing(message)) {
      return NextResponse.json(
        {
          error:
            'Metadata columns are not available in the database yet. Apply supabase/migrations/20260503_gutenberg_coverage_strands.sql, then run metadata cleanup again.',
        },
        { status: 409 }
      );
    }

    const status = /unauthorized/i.test(message) ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
