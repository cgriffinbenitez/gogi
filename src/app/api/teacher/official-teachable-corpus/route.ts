import { NextRequest, NextResponse } from 'next/server';
import {
  buildOfficialTeachableCorpus,
  officialTeachableCorpusClaudeMarkdown,
  officialTeachableCorpusMarkdown,
} from '@/lib/teacher/officialTeachableCorpus';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const format = url.searchParams.get('format') ?? 'json';
    const corpus = await buildOfficialTeachableCorpus();

    if (format === 'markdown' || format === 'md') {
      return new NextResponse(officialTeachableCorpusMarkdown(corpus), {
        headers: {
          'Content-Type': 'text/markdown; charset=utf-8',
          'Cache-Control': 'no-store',
          'Content-Disposition': 'inline; filename="gogi-official-teachable-corpus.md"',
        },
      });
    }

    if (format === 'claude') {
      return new NextResponse(officialTeachableCorpusClaudeMarkdown(corpus), {
        headers: {
          'Content-Type': 'text/markdown; charset=utf-8',
          'Cache-Control': 'no-store',
          'Content-Disposition': 'inline; filename="gogi-claude-official-teachable-corpus.md"',
        },
      });
    }

    return NextResponse.json({ ok: true, corpus }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('[api/teacher/official-teachable-corpus] error:', error);
    const message = error instanceof Error ? error.message : 'Could not build official teachable corpus.';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
