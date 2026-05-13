import { NextRequest, NextResponse } from 'next/server';
import { buildCornellLessonPptx } from '@/lib/presentations/simplePptx';

export const runtime = 'nodejs';

function slug(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const lesson = body.lesson;

    if (!lesson?.title || !lesson?.standard_code) {
      return NextResponse.json({ error: 'Generate a lesson before exporting PowerPoint.' }, { status: 400 });
    }

    const pptx = buildCornellLessonPptx(lesson);
    const filename = `${slug(`${lesson.standard_code}-${lesson.title}`) || 'gogi-cornell-lesson'}.pptx`;

    return new NextResponse(pptx, {
      headers: {
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': String(pptx.length),
      },
    });
  } catch (error) {
    console.error('[api/teacher/literary-intelligence/pptx] error:', error);
    return NextResponse.json({ error: 'Could not export the PowerPoint.' }, { status: 500 });
  }
}
