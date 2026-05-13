import { NextRequest, NextResponse } from 'next/server';
import { buildTextTeachingMap } from '@/lib/teacher/pullOutSheet';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const title = url.searchParams.get('title');
    const maxRowsPerStandard = Number(url.searchParams.get('rows') ?? 2);
    const map = await buildTextTeachingMap({ title, maxRowsPerStandard });

    return NextResponse.json({ ok: true, map });
  } catch (error) {
    console.error('[api/teacher/text-teaching-map] error:', error);
    const message = error instanceof Error ? error.message : 'Could not build text teaching map.';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
