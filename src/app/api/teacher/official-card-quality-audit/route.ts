import { NextRequest, NextResponse } from 'next/server';
import {
  buildOfficialCardQualityAudit,
  officialCardQualityAuditMarkdown,
} from '@/lib/teacher/officialCardQualityAudit';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const format = url.searchParams.get('format') ?? 'json';
    const report = await buildOfficialCardQualityAudit();

    if (format === 'markdown' || format === 'md') {
      return new NextResponse(officialCardQualityAuditMarkdown(report), {
        headers: {
          'Content-Type': 'text/markdown; charset=utf-8',
          'Cache-Control': 'no-store',
          'Content-Disposition': 'inline; filename="gogi-official-card-quality-audit.md"',
        },
      });
    }

    return NextResponse.json({ ok: true, report }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('[api/teacher/official-card-quality-audit] error:', error);
    const message = error instanceof Error ? error.message : 'Could not audit official cards.';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
