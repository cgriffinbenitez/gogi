import { NextRequest, NextResponse } from 'next/server';
import { buildPullOutSheet } from '@/lib/teacher/pullOutSheet';
import { buildLessonPackageFromPullOutSheet, enrichLessonPackageWithReadyCards } from '@/lib/teacher/lessonPackages';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const standardCode = url.searchParams.get('standard_code') ?? 'ELA.9.R.1.1';
    const periodLabel = url.searchParams.get('period') ?? 'Selected period';
    const lessonTitle = url.searchParams.get('title') ?? standardCode;
    const subSkillId = url.searchParams.get('sub_skill_id');
    const pm3Accuracy = url.searchParams.get('accuracy');
    const pm3Misses = url.searchParams.get('misses');

    const sheet = await buildPullOutSheet({ standardCode, subSkillId, maxRows: subSkillId ? 12 : 18 });
    const lessonPackage = await enrichLessonPackageWithReadyCards(
      buildLessonPackageFromPullOutSheet({ standardCode, sheet, subSkillId }),
      { standardCode, subSkillId }
    );
    const anchor = lessonPackage.sourceRows[0] ?? null;

    return NextResponse.json({
      ok: true,
      lesson: {
        periodLabel,
        standardCode,
        subSkillId,
        title: lessonTitle || lessonPackage.standard.title,
        objective: `Students will use a precise text excerpt to practice ${lessonTitle.toLowerCase()} and prove the answer with evidence.`,
        pm3: {
          accuracy: pm3Accuracy,
          misses: pm3Misses,
        },
        essentialQuestion: sheet.essentialQuestion,
        teacherNotes: sheet.teacherNotes,
        lessonPackage,
        anchor,
        practiceRows: lessonPackage.sourceRows,
        qualityWarnings: [...lessonPackage.blockers, ...lessonPackage.warnings],
      },
    });
  } catch (error) {
    console.error('[api/teacher/lesson-launch] error:', error);
    const message = error instanceof Error ? error.message : 'Could not build the lesson launch.';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
