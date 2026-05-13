import { NextRequest, NextResponse } from 'next/server';
import {
  buildOfficialAutoGoldCardCorpus,
  officialAutoGoldCardsMarkdown,
} from '@/lib/teacher/officialAutoGoldCards';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const format = url.searchParams.get('format') ?? 'json';
    const corpus = await buildOfficialAutoGoldCardCorpus();

    if (format === 'markdown' || format === 'md') {
      return new NextResponse(officialAutoGoldCardsMarkdown(corpus), {
        headers: {
          'Content-Type': 'text/markdown; charset=utf-8',
          'Cache-Control': 'no-store',
          'Content-Disposition': 'inline; filename="gogi-auto-ready-gold-cards.md"',
        },
      });
    }

    return NextResponse.json({ ok: true, corpus }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('[api/teacher/official-auto-gold-cards] error:', error);
    const message = error instanceof Error ? error.message : 'Could not build auto-ready gold cards.';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
