import { NextRequest, NextResponse } from 'next/server';
import { buildWorkbookHtml } from '@/lib/teacher/workbookBuilder';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const standardCode = url.searchParams.get('standard') ?? 'ELA.9.R.1.1';
    const versionParam = url.searchParams.get('version');
    const version =
      versionParam === 'teacher' || versionParam === 'answers' || versionParam === 'student'
        ? versionParam
        : 'student';
    const html = await buildWorkbookHtml({ standardCode, version });
    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('[api/teacher/workbook] error:', error);
    const message = error instanceof Error ? error.message : 'Could not build workbook.';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
