import { NextRequest, NextResponse } from 'next/server';
import {
  buildTeachingReadinessAudit,
  teachingReadinessAuditMarkdown,
} from '@/lib/teacher/teachingReadinessAudit';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const format = url.searchParams.get('format') ?? 'json';
    const targetPerSkill = Number(url.searchParams.get('target') ?? 5);
    const maxStandards = Number(url.searchParams.get('max_standards') ?? 20);
    const skipAdaptations = url.searchParams.get('skip_adaptations') !== '0';
    const audit = await buildTeachingReadinessAudit({ targetPerSkill, maxStandards, skipAdaptations });

    if (format === 'markdown' || format === 'md') {
      return new NextResponse(teachingReadinessAuditMarkdown(audit), {
        headers: {
          'Content-Type': 'text/markdown; charset=utf-8',
          'Content-Disposition': 'inline; filename="gogi-teaching-readiness-audit.md"',
        },
      });
    }

    return NextResponse.json({ ok: true, audit });
  } catch (error) {
    console.error('[api/teacher/teaching-readiness/audit] error:', error);
    const message = error instanceof Error ? error.message : 'Could not run teaching readiness audit.';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
