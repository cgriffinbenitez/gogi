import { NextRequest, NextResponse } from 'next/server';
import { buildPullOutSheet } from '@/lib/teacher/pullOutSheet';
import { buildLessonPackageFromPullOutSheet } from '@/lib/teacher/lessonPackages';
import { buildCornellLessonPptx, type PptxLesson } from '@/lib/presentations/simplePptx';

export const runtime = 'nodejs';

function slug(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 90);
}

function toPercent(value: string | null) {
  if (!value) return null;
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  return `${Math.round(numeric * 100)}%`;
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const standardCode = url.searchParams.get('standard_code') ?? 'ELA.9.R.1.1';
    const periodLabel = url.searchParams.get('period') ?? 'Selected period';
    const lessonTitle = url.searchParams.get('title') ?? standardCode;
    const subSkillId = url.searchParams.get('sub_skill_id');
    const pm3Accuracy = toPercent(url.searchParams.get('accuracy'));
    const pm3Misses = url.searchParams.get('misses');

    const sheet = await buildPullOutSheet({ standardCode, subSkillId, maxRows: subSkillId ? 5 : 8 });
    const lessonPackage = buildLessonPackageFromPullOutSheet({ standardCode, sheet, subSkillId });
    const anchor = lessonPackage.sourceRows[0] ?? null;

    if (!anchor || !lessonPackage.workedExample) {
      return NextResponse.json(
        {
          error:
            'GOGI needs one audited teaching card with a worked example before it can export a PowerPoint for this standard.',
        },
        { status: 409 }
      );
    }

    const vocab = lessonPackage.vocabulary.map((item) => ({
      term: item.term,
      meaning: item.meaning,
      example: item.example,
    }));
    const correctChoice = anchor.anchorQuestion.choices.find((choice) => choice.correct);

    const lesson: PptxLesson = {
      title: `${standardCode} Cornell Lesson: ${lessonPackage.standard.title}`,
      standard_code: standardCode,
      standard_text: lessonPackage.standard.officialText,
      anchor_text: lessonPackage.text?.selection ?? anchor.selection,
      objective: `Students will use ${lessonPackage.text?.selection ?? anchor.selection} to practice ${lessonPackage.standard.title.toLowerCase()} and prove the answer with exact evidence.`,
      plain_english_standard: lessonPackage.standard.strategy,
      skill_overview:
        anchor.instructionalSupport?.teachFirst?.[0] ??
        `${lessonPackage.standard.title}: students use exact evidence to explain how the text creates meaning, style, mood, purpose, or reader effect.`,
      how_to_identify:
        anchor.instructionalSupport?.studentStrategy?.length
          ? anchor.instructionalSupport.studentStrategy
          : lessonPackage.standard.studentsNeedToKnow.slice(0, 5),
      how_to_solve: [
        lessonPackage.standard.strategy,
        'Box the exact words that prove the skill.',
        'Eliminate choices that only summarize the excerpt.',
        'Choose the answer that explains what the evidence does for the reader.',
      ],
      vocabulary: vocab,
      cornell_sequence: [],
      worked_example: {
        element: lessonPackage.workedExample.element,
        evidence: lessonPackage.textClean,
        effect: lessonPackage.workedExample.effect,
      },
      guided_practice: [
        anchor.anchorQuestion.stem,
        ...anchor.anchorQuestion.choices.map((choice) => `${choice.label}. ${choice.text}`),
      ],
      independent_practice: [
        'Answer the FAST-style check before looking at the teacher key.',
        'Then justify your answer with one exact quote and one effect sentence.',
      ],
      cue_questions: [
        `How does this excerpt show ${anchor.skillFocus.toLowerCase()}?`,
        `What exact evidence proves ${anchor.skillFocus.toLowerCase()}?`,
        'Which answer choice explains effect instead of summary?',
        'How does the author make the reader understand more than the literal event?',
        'What should I look for next time I see this skill?',
      ],
      summary_frame: `In this excerpt from ${lessonPackage.text?.selection ?? anchor.selection}, the author uses ___ to create ___ because ___.`,
      exit_ticket: anchor.anchorQuestion.stem,
      teacher_key: [
        correctChoice ? `Correct answer: ${correctChoice.label}. ${correctChoice.text}` : 'Teacher key: review the strongest answer choice.',
        pm3Accuracy && pm3Misses
          ? `Class data reason: ${pm3Accuracy} correct and ${pm3Misses} missed item opportunities.`
          : 'Class data reason: selected from the current lesson queue.',
      ],
      trust_chain: [
        lessonPackage.label,
        lessonPackage.text?.selection ?? anchor.selection,
        anchor.exactLinesOrParagraphs,
        periodLabel,
      ],
    };

    const pptx = buildCornellLessonPptx(lesson);
    const filename = `${slug(`${standardCode}-${lessonPackage.standard.title}-${periodLabel}`) || 'gogi-cornell-lesson'}.pptx`;

    return new NextResponse(pptx, {
      headers: {
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': String(pptx.length),
      },
    });
  } catch (error) {
    console.error('[api/teacher/lesson-launch/pptx] error:', error);
    return NextResponse.json({ error: 'Could not export the lesson PowerPoint.' }, { status: 500 });
  }
}
