import Anthropic from '@anthropic-ai/sdk';
import { NextRequest, NextResponse } from 'next/server';
import { buildPullOutSheet } from '@/lib/teacher/pullOutSheet';
import { buildLessonPackageFromPullOutSheet } from '@/lib/teacher/lessonPackages';
import {
  buildCornellLessonPptx,
  buildDesignerDeckPptx,
  type DesignerDeck,
  type PptxLesson,
} from '@/lib/presentations/simplePptx';

export const runtime = 'nodejs';

function slug(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 90);
}

function parseJson(text: string) {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const match = trimmed.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('Claude did not return JSON.');
    return JSON.parse(match[0]);
  }
}

function compact(value: string, max = 1600) {
  const cleaned = value
    .replace(/\u00ad/g, '')
    .replace(/([A-Za-z])¬\s+([a-z])/g, '$1$2')
    .replace(/\[\s*no\s*\]/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (cleaned.length <= max) return cleaned;
  const clipped = cleaned.slice(0, max);
  const lastStop = Math.max(clipped.lastIndexOf('.'), clipped.lastIndexOf('!'), clipped.lastIndexOf('?'));
  return lastStop > 400 ? clipped.slice(0, lastStop + 1) : clipped;
}

function fallbackLesson(args: {
  standardCode: string;
  lessonTitle: string;
  periodLabel: string;
  lessonPackage: ReturnType<typeof buildLessonPackageFromPullOutSheet>;
}): PptxLesson {
  const row = args.lessonPackage.sourceRows[0];
  const correct = row?.anchorQuestion.choices.find((choice) => choice.correct);
  return {
    title: `${args.standardCode} Cornell Lesson: ${args.lessonPackage.standard.title}`,
    standard_code: args.standardCode,
    standard_text: args.lessonPackage.standard.officialText,
    anchor_text: args.lessonPackage.text?.selection ?? row?.selection ?? 'Selected GOGI text',
    objective: `Students will use ${args.lessonPackage.text?.selection ?? 'the selected excerpt'} to practice ${args.lessonPackage.standard.title.toLowerCase()} and prove the answer with exact evidence.`,
    plain_english_standard: args.lessonPackage.standard.strategy,
    skill_overview:
      row?.instructionalSupport?.teachFirst?.[0] ??
      `${args.lessonPackage.standard.title}: students use exact evidence to explain what the text does.`,
    how_to_identify:
      row?.instructionalSupport?.studentStrategy?.length
        ? row.instructionalSupport.studentStrategy
        : args.lessonPackage.standard.studentsNeedToKnow.slice(0, 5),
    how_to_solve: [
      args.lessonPackage.standard.strategy,
      'Box the exact words that prove the skill.',
      'Eliminate choices that only summarize the excerpt.',
      'Choose the answer that explains what the evidence does for the reader.',
    ],
    vocabulary: args.lessonPackage.vocabulary.map((item) => ({
      term: item.term,
      meaning: item.meaning,
      example: item.example,
    })),
    cornell_sequence: [],
    worked_example: {
      element: args.lessonPackage.workedExample?.element ?? row?.skillFocus ?? args.lessonPackage.standard.title,
      evidence: compact(args.lessonPackage.textClean),
      effect:
        args.lessonPackage.workedExample?.effect ??
        row?.whyThisExcerpt ??
        'This evidence helps students explain the reading skill with exact support.',
    },
    guided_practice: row
      ? [row.anchorQuestion.stem, ...row.anchorQuestion.choices.map((choice) => `${choice.label}. ${choice.text}`)]
      : ['Complete the evidence/effect table.'],
    independent_practice: [
      'Answer the FAST-style check before looking at the teacher key.',
      'Justify the answer with one quote and one effect sentence.',
    ],
    cue_questions: [
      `How does this excerpt show ${row?.skillFocus?.toLowerCase() ?? 'the skill'}?`,
      'What exact evidence proves the skill?',
      'Which answer explains effect instead of summary?',
      'How does the author make the reader understand more than the literal event?',
      'What should I look for next time I see this skill?',
    ],
    summary_frame: `In this excerpt, the author uses ___ to create ___ because ___.`,
    exit_ticket: row?.anchorQuestion.stem ?? 'Explain how the evidence supports the skill.',
    teacher_key: correct ? [`Correct answer: ${correct.label}. ${correct.text}`] : [],
    trust_chain: [args.lessonPackage.label, args.periodLabel, args.lessonPackage.text?.selection ?? 'selected text'],
  };
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const standardCode = url.searchParams.get('standard_code') ?? 'ELA.9.R.1.1';
    const periodLabel = url.searchParams.get('period') ?? 'Selected period';
    const lessonTitle = url.searchParams.get('title') ?? standardCode;
    const subSkillId = url.searchParams.get('sub_skill_id');

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { error: 'ANTHROPIC_API_KEY is not configured. Add it locally, restart GOGI, then try again.' },
        { status: 502 }
      );
    }

    const sheet = await buildPullOutSheet({ standardCode, subSkillId, maxRows: subSkillId ? 5 : 8 });
    const lessonPackage = buildLessonPackageFromPullOutSheet({ standardCode, sheet, subSkillId });
    const baseLesson = fallbackLesson({ standardCode, lessonTitle, periodLabel, lessonPackage });

    if (!lessonPackage.sourceRows.length) {
      return NextResponse.json(
        { error: 'GOGI needs at least one audited teaching card before Claude can build a lesson deck.' },
        { status: 409 }
      );
    }

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, timeout: 90_000 });
    const message = await client.messages.create({
      model: process.env.ANTHROPIC_LESSON_MODEL ?? process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-6',
      max_tokens: 12000,
      temperature: 0.25,
      system: `You are Carlos's expert Grade 9 Florida B.E.S.T. ELA PowerPoint designer.

Your job is to convert GOGI's lesson package into a polished 90-minute Cornell-notes PowerPoint deck design in Carlos's style.

Pedagogy:
- Bell-to-bell journal-driven lesson.
- Students write, annotate, solve, and revise for nearly the full block.
- Promethean-ready: projected slide text must be concise and copyable.
- Follow this exact 6-phase, 90-minute lesson framework:
  1. Retrieval / Do Now, 8 minutes: 3-5 quick questions on prior learning. Students answer in journals before cold-call review.
  2. I Do, 15 minutes: focused instruction in small steps with explicit teacher think-aloud and worked example.
  3. We Do, 20 minutes: guided practice with high questioning rate and frequent checks for understanding.
  4. You Do Together, 20 minutes: partner or trio work with sentence frames and teacher circulation.
  5. You Do Alone, 18 minutes: independent FAST-style practice in the format students will be tested in.
  6. Exit / Close, 7 minutes: formative check, quick close, and tomorrow's retrieval prompt.
- The three supplied GOGI Gold Cards must become the lesson spine:
  Gold Card 1 = I Do model.
  Gold Card 2 = We Do / You Do Together guided practice.
  Gold Card 3 = You Do Alone independent FAST-style check.
- Do not add loose turn-and-talk or open discussion. If there is a pause, make it accountable writing.
- Do not invent copyrighted text. Use only the supplied excerpt and supplied package information.
- Do not use placeholder analysis. Worked example effect must be real and specific.
- You control the slide design. Return positioned slide boxes, not generic lesson prose.
- Coordinates are inches on a 16:9 10 x 5.625 slide. Keep all boxes inside the slide.
- Use Carlos's Midnight Executive palette only: NAVY #1E2761, GOLD #F2C14E, ICE #CADCFC, WHITE #FFFFFF, near-black #111827, muted #344054.
- Return only valid JSON. No markdown. No commentary.`,
      messages: [
        {
          role: 'user',
          content: `Return ONLY JSON matching this exact shape:
{
  "title": string,
  "slides": [
    {
      "title": string,
      "background": "#F7F9FC" | "#1E2761" | "#FFFFFF" | "#FFF8E1",
      "boxes": [
        {
          "x": number,
          "y": number,
          "w": number,
          "h": number,
          "text": string | string[],
          "fontSize": number,
          "bold": boolean,
          "color": string,
          "fill": string,
          "border": string,
          "bullet": boolean
        }
      ]
    }
  ]
}

Design requirements:
- Build 24 numbered lesson slides, plus an optional simple closing slide if useful.
- Match this exemplar rhythm:
  1 title, 2 Cornell setup, 3 today's standard, 4 key definition, 5 concept overview, 6-7 direct instruction, 8 vocabulary anchor, 9 passage 1, 10 worked example table, 11 written pause/check, 12 passage 2 guided practice, 13 check annotations, 14 passage 3 independent, 15 teacher checkpoint, 16 cue column intro, 17 good cue questions, 18 cue model, 19 write 5 cue questions, 20 summary, 21 self-check, 22 exit ticket, 23 today you can now, 24 journals down.
- Every slide must have top-left date/period or lesson label, top-right standard code, and a bottom journal task box beginning with "✎".
- Use large clear slide titles, compact text, visible boxes/tables, and Cornell-style stamps.
- Teacher key must NOT appear on student-facing slides. Put answer-key guidance as teacher-facing wording only if necessary, but do not reveal "Correct answer" on a projected slide.
- For passage slides, use 1-2 readable paragraphs, not a one-sentence fragment and never "[...]".
- Do not put more than 7 text boxes on one slide.
- Avoid tiny font. Body text should usually be 13-18 pt; titles 26-34 pt.
- Keep text within boxes. Do not use long walls of text.

Use this baseline lesson content:
${JSON.stringify(baseLesson, null, 2)}

Use this GOGI lesson package:
${JSON.stringify(
  {
    status: lessonPackage.status,
    standard: lessonPackage.standard,
    text: lessonPackage.text,
    excerpt: compact(lessonPackage.textClean, 2200),
    vocabulary: lessonPackage.vocabulary,
    workedExample: lessonPackage.workedExample,
    sourceRows: lessonPackage.sourceRows.map((row) => ({
      skillFocus: row.skillFocus,
      location: row.exactLinesOrParagraphs,
      whyThisWorks: row.whyThisExcerpt,
      evidencePoints: row.teacherTrust.evidencePoints.slice(0, 5),
      question: row.anchorQuestion,
    })),
  },
  null,
  2
)}

Build the strongest possible classroom deck content for ${periodLabel}.

Critical rules:
- Multiple practice beats are allowed, but keep them tied to this same lesson package/text.
- Vocabulary must be useful for the excerpt and skill, not generic meta-words unless the skill requires them.
- Worked example must teach the skill explicitly and include a real effect explanation.
- FAST-style check must be rigorous, not obvious by answer length.
- This is Carlos's real classroom deck. Make it look like something he can project tomorrow.`,
        },
      ],
    });

    const textBlock = message.content.find((block) => block.type === 'text');
    const parsed = parseJson(textBlock?.text ?? '');
    let pptx: Buffer;
    if (Array.isArray(parsed.slides) && parsed.slides.length >= 18) {
      const deck: DesignerDeck = {
        title: parsed.title || baseLesson.title,
        slides: parsed.slides,
      };
      pptx = buildDesignerDeckPptx(deck);
    } else {
      const lesson: PptxLesson = {
        ...baseLesson,
        ...parsed,
        standard_code: standardCode,
        trust_chain: [
          ...new Set([
            ...(Array.isArray(parsed.trust_chain) ? parsed.trust_chain : []),
            ...(baseLesson.trust_chain ?? []),
            'Generated through Claude API from GOGI lesson package',
          ]),
        ],
      };
      pptx = buildCornellLessonPptx(lesson);
    }
    const filename = `${slug(`${standardCode}-${lessonPackage.standard.title}-${periodLabel}-claude`)}.pptx`;

    return new NextResponse(new Uint8Array(pptx), {
      headers: {
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': String(pptx.length),
      },
    });
  } catch (error) {
    console.error('[api/teacher/lesson-launch/claude-pptx] error:', error);
    return NextResponse.json({ error: 'Claude could not generate the lesson PowerPoint.' }, { status: 500 });
  }
}
