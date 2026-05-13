import { NextRequest, NextResponse } from 'next/server';
import { buildPullOutSheet } from '@/lib/teacher/pullOutSheet';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const standardCode = url.searchParams.get('standard_code') ?? 'ELA.9.R.1.1';
    const unitName = url.searchParams.get('unit_name') ?? undefined;
    const subSkillId = url.searchParams.get('sub_skill_id');
    const maxRows = Number(url.searchParams.get('max_rows') ?? 12);

    const sheet = await buildPullOutSheet({ standardCode, unitName, maxRows, subSkillId });

    return NextResponse.json({ ok: true, sheet });
  } catch (error) {
    console.error('[api/teacher/pull-out-sheet] error:', error);
    const message = error instanceof Error ? error.message : 'Could not build the pull-out sheet.';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
