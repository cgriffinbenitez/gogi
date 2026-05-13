import Anthropic from '@anthropic-ai/sdk';
import { NextRequest, NextResponse } from 'next/server';
import { getFastReadingDemandsForStandard } from '@/lib/reading-wins/fastSkillMap';
import { getOfficialFastTextModelsForStandard } from '@/lib/reading-wins/officialFastSources';

export const runtime = 'nodejs';

type LessonRequest = {
  standard_code?: string;
  text_title?: string;
  text_author?: string;
  excerpt?: string;
  excerpts?: string[];
  curated_vocab?: Array<{
    word: string;
    pos: string;
    student_friendly_def: string;
    example_sentence_from_text: string;
  }>;
  curated_worked_example?: {
    element_named: string;
    evidence_quoted: string;
    evidence_location: string;
    layer_identified: string;
    effect_explanation: string;
  };
  lesson_focus?: string;
  student_level?: 'support' | 'grade_level' | 'stretch';
  lesson_minutes?: number;
};

type LessonSection = {
  title: string;
  teacher_move: string;
  student_notes: string;
};

type LiteraryLesson = {
  title: string;
  standard_code: string;
  standard_text: string;
  anchor_text: string;
  objective: string;
  plain_english_standard: string;
  skill_overview: string;
  how_to_identify: string[];
  how_to_solve: string[];
  vocabulary: Array<{ term: string; meaning: string; example: string }>;
  cornell_sequence: LessonSection[];
  worked_example: {
    element: string;
    evidence: string;
    effect: string;
  };
  guided_practice: string[];
  independent_practice: string[];
  cue_questions: string[];
  summary_frame: string;
  exit_ticket: string;
  teacher_key: string[];
  ppt_sequence: Array<{
    slide: number;
    title: string;
    minutes: number;
    teacher_action: string;
    student_task: string;
  }>;
  trust_chain: string[];
  source: 'claude' | 'template';
};

function clean(value: string | null | undefined) {
  return (value ?? '').trim();
}

function compactExcerpt(excerpt: string | undefined) {
  const text = clean(excerpt)
    .replace(/\u00ad/g, '')
    .replace(/([A-Za-z])¬\s+([a-z])/g, '$1$2')
    .replace(/\[\s*no\s*\]/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
  const clipped = text.slice(0, 1400);
  const lastSentence = clipped.match(/^([\s\S]*?[.!?])(?:\s+[A-Z“"]|$)/g)?.at(-1)?.trim();
  return (lastSentence && lastSentence.length > 260 ? lastSentence : clipped).trim();
}

type StandardLessonFrame = {
  plainEnglish: string;
  skillOverview: string;
  cpalmClarification: string;
  keyElements: string[];
  howToIdentify: string[];
  howToSolve: string[];
  vocabulary: Array<{ term: string; meaning: string; example: string }>;
};

const STANDARD_LESSON_FRAMES: Record<string, StandardLessonFrame> = {
  'ELA.9.R.1.1': {
    plainEnglish:
      'Explain how a specific key element adds meaning and/or style in a literary text. Do not just summarize what happened.',
    skillOverview:
      'R.1.1 is about the job of a key literary element. Students identify the element, explain the literal layer, then explain the deeper layer: mood, tone, theme, characterization, conflict, or author purpose.',
    cpalmClarification:
      'Key elements include setting, plot, characterization, conflict, point of view, theme, tone, and style. Students should explain how the element creates layered meaning, not merely identify it.',
    keyElements: [
      'setting',
      'plot',
      'characterization',
      'conflict',
      'point of view',
      'theme',
      'tone',
      'style',
    ],
    howToIdentify: [
      'Find the exact key element: setting, plot event, conflict, characterization, point of view, theme clue, tone, or style move.',
      'Ask what is literally happening in that moment.',
      'Ask what deeper layer the element creates: mood, tone, theme, character change, conflict, or author purpose.',
    ],
    howToSolve: [
      'Name the key element.',
      'Explain the literal layer in plain words.',
      'Explain the deeper layer: how the element changes meaning, style, mood, tone, theme, or character.',
      'Eliminate answers that only retell the event.',
    ],
    vocabulary: [
      {
        term: 'key element',
        meaning: 'A story part that carries meaning, such as setting, plot, conflict, character, point of view, theme, tone, or style.',
        example: 'A plot reversal can reveal that a character has changed.',
      },
      {
        term: 'literal layer',
        meaning: 'What is directly happening in the text.',
        example: 'The animals see the pigs walking on two legs.',
      },
      {
        term: 'deeper layer',
        meaning: 'What the detail suggests beyond the surface event.',
        example: 'The pigs have become like the humans they once opposed.',
      },
      {
        term: 'author effect',
        meaning: 'What the writer makes the reader understand, feel, or notice.',
        example: 'The detail creates irony because the revolution has failed.',
      },
    ],
  },
};

function getLessonFrame(standardCode: string, demand: ReturnType<typeof getFastReadingDemandsForStandard>[number] | undefined): StandardLessonFrame {
  return (
    STANDARD_LESSON_FRAMES[standardCode] ?? {
      plainEnglish:
        demand?.fastDemand ??
        'Students use exact evidence to explain how a specific part of a text creates meaning, purpose, or effect.',
      skillOverview:
        'The skill is to locate exact evidence, explain what it means in context, and connect it to the author effect.',
      cpalmClarification:
        'Students should move from evidence to meaning instead of stopping at summary.',
      keyElements: ['evidence', 'meaning', 'author effect'],
      howToIdentify: [
        'Find the exact word, phrase, sentence, structure, or detail the question points to.',
        'Ask what the evidence means in this moment.',
        'Connect that evidence to meaning, mood, character, theme, argument, or purpose.',
      ],
      howToSolve: [
        `Use the GOGI strategy: ${demand?.studentMove ?? 'name the evidence, explain it, and connect it to effect.'}`,
        'Eliminate choices that only summarize the passage.',
        'Choose the answer that explains the job of the evidence in context.',
      ],
      vocabulary: [
        {
          term: 'effect',
          meaning: 'What a detail causes the reader to understand, feel, or notice.',
          example: 'The detail makes the scene feel tense because it shows danger closing in.',
        },
        {
          term: 'evidence',
          meaning: 'The exact words from the text that prove the answer.',
          example: 'Use the quoted line from the passage.',
        },
      ],
    }
  );
}

function selectWorkedEvidence(excerpt: string, standardCode: string) {
  const text = compactExcerpt(excerpt);
  if (!text) return 'Use the strongest short excerpt from the selected text.';

  if (standardCode === 'ELA.9.R.1.1') {
    const r11Targets = [
      /It was a pig walking on his hind legs\./i,
      /out from the door of the farmhouse came a long file of pigs, all walking on their hind legs\./i,
      /Napoleon himself, majestically upright[^.]*\./i,
      /the sheep.*?new song[^.]*\./i,
    ];
    for (const pattern of r11Targets) {
      const match = text.match(pattern);
      if (match?.[0]) return match[0].trim();
    }
  }

  const sentences = text.match(/[^.!?]+[.!?]+/g) ?? [text];
  return (sentences.find((sentence) => sentence.length >= 45 && sentence.length <= 260) ?? sentences[0])
    .replace(/\s+/g, ' ')
    .trim();
}

function buildWorkedEffect({
  standardCode,
  anchorText,
  evidence,
  focus,
}: {
  standardCode: string;
  anchorText: string;
  evidence: string;
  focus: string;
}) {
  const lower = `${anchorText} ${evidence}`.toLowerCase();
  if (
    standardCode === 'ELA.9.R.1.1' &&
    lower.includes('animal farm') &&
    lower.includes('walking on')
  ) {
    return 'The plot detail shows the pigs becoming like the humans they replaced. Literally, the animals see pigs walking on two legs; deeper down, the moment reveals the corruption of the revolution and adds irony because the pigs now violate the old rule against human behavior.';
  }

  return `This ${focus.toLowerCase()} detail matters because it does more than move the plot forward. It creates a literal layer students can point to and a deeper layer they must explain with evidence.`;
}

function fallbackLesson(body: LessonRequest): LiteraryLesson {
  const standardCode = clean(body.standard_code) || 'ELA.9.R.1.1';
  const demand = getFastReadingDemandsForStandard(standardCode)[0];
  const models = getOfficialFastTextModelsForStandard(standardCode);
  const matchedText =
    models.find(
      (model) =>
        model.title === body.text_title &&
        (!body.text_author || model.author === body.text_author)
    ) ?? models[0];
  const anchorText = `${clean(body.text_title) || matchedText?.title || 'Selected text'}${
    clean(body.text_author) || matchedText?.author
      ? ` — ${clean(body.text_author) || matchedText?.author}`
      : ''
  }`;
  const standardText = demand?.standardText ?? matchedText?.notes ?? 'Grade 9 ELA standard';
  const move = demand?.studentMove ?? 'Name the skill, point to evidence, and explain its effect.';
  const focus = clean(body.lesson_focus) || demand?.teacherTitle || 'Florida B.E.S.T. reading skill';
  const frame = getLessonFrame(standardCode, demand);
  const excerpt = compactExcerpt(body.excerpt || body.excerpts?.[0]);
  const workedEvidence = selectWorkedEvidence(excerpt, standardCode);
  const lessonMinutes = Math.max(30, Math.min(120, Number(body.lesson_minutes ?? 90)));
  const curatedVocab =
    body.curated_vocab?.map((item) => ({
      term: item.word,
      meaning: item.student_friendly_def,
      example: item.example_sentence_from_text,
    })) ?? [];
  const curatedWorked = body.curated_worked_example;

  return {
    title: `${standardCode} Cornell Lesson: ${focus}`,
    standard_code: standardCode,
    standard_text: standardText,
    anchor_text: anchorText,
    objective: `Students will use ${anchorText} to explain how a named key element adds meaning and/or style, using exact text evidence.`,
    plain_english_standard: frame.plainEnglish,
    skill_overview: frame.skillOverview,
    how_to_identify: frame.howToIdentify,
    how_to_solve: frame.howToSolve,
    vocabulary: curatedVocab.length ? curatedVocab : frame.vocabulary,
    cornell_sequence: [
      {
        title: 'Set Up Cornell Notes',
        teacher_move: 'Students draw the cue column, notes column, and summary space.',
        student_notes: `Standard: ${standardCode}. Anchor text: ${anchorText}.`,
      },
      {
        title: 'Verbatim Standard + Clarification',
        teacher_move:
          'Students copy the B.E.S.T. wording, then underline the required reading action.',
        student_notes: `${standardText} Clarification: ${frame.cpalmClarification}`,
      },
      {
        title: 'Skill Overview',
        teacher_move: 'Teach the named key elements and the layers-of-meaning model.',
        student_notes: `Key elements: ${frame.keyElements.join(', ')}. Today I need to ${move}`,
      },
      {
        title: 'How To Spot It',
        teacher_move: 'Model how to locate the exact evidence before looking at answer choices.',
        student_notes: 'First, I point to the exact evidence. Then I ask what job it does.',
      },
      {
        title: 'Worked Example',
        teacher_move:
          'Think aloud with the named element, literal layer, deeper layer, and author effect.',
        student_notes:
          'Named element + literal layer + deeper layer + author effect = complete R.1.1 analysis.',
      },
      {
        title: 'Guided Practice',
        teacher_move: 'Students try the same move with one new piece of evidence while you prompt.',
        student_notes: 'My answer must explain why the evidence matters.',
      },
      {
        title: 'Independent Practice',
        teacher_move: 'Students answer one FAST-style item and justify the answer in one sentence.',
        student_notes: 'I can prove my answer with exact words from the text.',
      },
    ],
    worked_example: {
      element:
        curatedWorked?.element_named ??
        (standardCode === 'ELA.9.R.1.1'
          ? 'Plot detail and characterization'
          : focus),
      evidence: curatedWorked?.evidence_quoted ?? workedEvidence,
      effect:
        curatedWorked?.effect_explanation ??
        buildWorkedEffect({ standardCode, anchorText, evidence: workedEvidence, focus }),
    },
    guided_practice: [
      'Underline the exact evidence the question is asking about.',
      'Write one sentence explaining what the evidence suggests.',
      'Pick the answer choice that matches that effect, not just the topic.',
    ],
    independent_practice: [
      'Answer one FAST-style question tied to the same skill.',
      'Explain why the correct answer is stronger than one tempting distractor.',
    ],
    cue_questions: [
      'What exact evidence is the question pointing to?',
      'Which key element is doing the work?',
      'What is the literal layer?',
      'What deeper layer does the element create?',
      'How does this detail affect meaning, style, mood, tone, theme, or purpose?',
    ],
    summary_frame:
      `Today I learned that ${standardCode} means I must use exact evidence to explain how an author creates meaning. I can do this by naming the detail, explaining what it suggests, and connecting it to the text.`,
    exit_ticket:
      'Choose one detail from today’s text and explain, in two sentences, what it suggests and why it matters.',
    teacher_key: [
      'Strong student answers must use exact evidence.',
      'Strong student answers must explain effect, not just summarize.',
      'If students miss it, return to the evidence before debating answer choices.',
    ],
    ppt_sequence: [
      {
        slide: 1,
        title: 'Opening Skill Target',
        minutes: 5,
        teacher_action: `Name the benchmark and the ${focus} skill students will practice today.`,
        student_task: 'Set up Cornell notes and write the learning target.',
      },
      {
        slide: 2,
        title: 'Plain-English Standard',
        minutes: 7,
        teacher_action: 'Translate the standard into the exact reading move students must make.',
        student_task: 'Copy the standard and underline the action verb.',
      },
      {
        slide: 3,
        title: 'How To Spot The Skill',
        minutes: 8,
        teacher_action: 'Model how to locate the key detail before reading answer choices.',
        student_task: 'Circle the evidence the question is pointing to.',
      },
      {
        slide: 4,
        title: 'Anchor Excerpt',
        minutes: 10,
        teacher_action: `Read the selected ${anchorText} excerpt and mark the teachable moment.`,
        student_task: 'Annotate the exact phrase, sentence, or structure that carries the skill.',
      },
      {
        slide: 5,
        title: 'Worked Example',
        minutes: 12,
        teacher_action: 'Think aloud with element, evidence, and effect.',
        student_task: 'Complete the worked example row in Cornell notes.',
      },
      {
        slide: 6,
        title: 'Guided FAST-Style Practice',
        minutes: 15,
        teacher_action: 'Guide students through one FAST-style item and one tempting distractor.',
        student_task: 'Choose the answer and explain why one distractor is weaker.',
      },
      {
        slide: 7,
        title: 'Silent Written Rep',
        minutes: 12,
        teacher_action: 'Release students to apply the same move with a new evidence point while you circulate and mark misconceptions.',
        student_task: 'Write a two-sentence evidence/effect explanation in Cornell notes.',
      },
      {
        slide: 8,
        title: 'Independent Rep',
        minutes: 12,
        teacher_action: 'Give one clean independent question aligned to the same benchmark.',
        student_task: 'Answer independently and justify with exact text evidence.',
      },
      {
        slide: 9,
        title: 'Cornell Summary',
        minutes: 5,
        teacher_action: 'Prompt students to summarize the skill move, not the passage plot.',
        student_task: 'Write the Cornell summary using the frame.',
      },
      {
        slide: 10,
        title: 'Exit Ticket',
        minutes: lessonMinutes >= 90 ? 4 : 3,
        teacher_action: 'Collect the exit ticket to decide tomorrow’s reteach or next rep.',
        student_task: 'Answer the exit ticket in two precise sentences.',
      },
    ],
    trust_chain: [
      `Standard: ${standardCode}`,
      `B.E.S.T./CPALMS clarification: ${frame.cpalmClarification}`,
      `Official text: ${anchorText}`,
      `Skill move: ${move}`,
      curatedWorked
        ? 'Excerpt source: ready-to-teach lesson source'
        : excerpt
          ? 'Excerpt source: GOGI staged content library'
          : 'Excerpt source: no staged excerpt selected yet',
      'Lesson format: Cornell notes explicit instruction template',
      'Assessment shape: FAST-style evidence and effect reasoning',
    ],
    source: 'template',
  };
}

const CARLOS_LESSON_DECK_RULES = `
Carlos's Lesson Deck Design System v2, adapted for GOGI:
- Bell-to-bell journal-driven lesson. Students write, annotate, solve, and revise on almost every slide.
- Cornell notes are the default: cue column, notes column, summary band.
- Slide 3 must include verbatim Florida B.E.S.T. wording, plain-English wording, and CPALMS/assessment clarification when available.
- Every lesson includes a vocabulary anchor before the first passage: 4-5 Tier 2/3 words or academic reading terms.
- Students complete three increasingly independent reps: worked example, guided practice, independent practice.
- Cue column work is non-negotiable: model cue questions, then require students to write their own.
- Summary must use the lesson's academic language.
- Exit ticket must require: name the skill, quote or point to evidence, explain the effect, use one academic/vocab word.
- Visual target is the Midnight Executive Cornell style: navy, gold, ice blue, white, and journal-task stamps.
- Carlos override: do not create turn-and-talk, partner share, or open discussion blocks. Replace them with silent written reps, teacher checkpoints, marked revision, and accountable journal work.
`;

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

function repairLesson(lesson: LiteraryLesson, body: LessonRequest): LiteraryLesson {
  const standardCode = lesson.standard_code;
  const demand = getFastReadingDemandsForStandard(standardCode)[0];
  const frame = getLessonFrame(standardCode, demand);
  const anchorText = lesson.anchor_text;
  const excerpt = compactExcerpt(body.excerpt || body.excerpts?.[0]);
  const workedEvidence = selectWorkedEvidence(excerpt || lesson.worked_example.evidence, standardCode);
  const placeholderEffect =
    !lesson.worked_example.effect ||
    /creates meaning beyond a surface summary/i.test(lesson.worked_example.effect) ||
    lesson.worked_example.effect.trim().length < 90;
  const misconceptionAsOverview =
    demand?.commonMiss && lesson.skill_overview.trim() === demand.commonMiss.trim();
  const curatedVocab =
    body.curated_vocab?.map((item) => ({
      term: item.word,
      meaning: item.student_friendly_def,
      example: item.example_sentence_from_text,
    })) ?? [];
  const curatedWorked = body.curated_worked_example;
  const safeWorkedElement = clean(lesson.worked_example.element);
  const safeWorkedEvidence = clean(lesson.worked_example.evidence);
  const safeWorkedEffect = clean(lesson.worked_example.effect);
  const finalWorkedEvidence = curatedWorked?.evidence_quoted ?? safeWorkedEvidence ?? workedEvidence;

  return {
    ...lesson,
    objective:
      lesson.objective && !/practice .* add layers/i.test(lesson.objective)
        ? lesson.objective
        : `Students will use ${anchorText} to explain how a named key element adds meaning and/or style, using exact text evidence.`,
    plain_english_standard:
      standardCode === 'ELA.9.R.1.1' ? frame.plainEnglish : lesson.plain_english_standard,
    skill_overview:
      standardCode === 'ELA.9.R.1.1' || misconceptionAsOverview
        ? frame.skillOverview
        : lesson.skill_overview,
    how_to_identify:
      standardCode === 'ELA.9.R.1.1' ? frame.howToIdentify : lesson.how_to_identify,
    how_to_solve: standardCode === 'ELA.9.R.1.1' ? frame.howToSolve : lesson.how_to_solve,
    vocabulary:
      curatedVocab.length >= 4
        ? curatedVocab
        : lesson.vocabulary.length >= 4 && standardCode !== 'ELA.9.R.1.1'
        ? lesson.vocabulary
        : frame.vocabulary,
    worked_example: {
      element:
        curatedWorked?.element_named ??
        (standardCode === 'ELA.9.R.1.1'
          ? 'Plot detail and characterization'
          : safeWorkedElement || frame.keyElements[0] || lesson.title),
      evidence: finalWorkedEvidence || excerpt || 'Use exact evidence from the selected excerpt.',
      effect: placeholderEffect
        ? curatedWorked?.effect_explanation ??
          buildWorkedEffect({
            standardCode,
            anchorText,
            evidence: finalWorkedEvidence || workedEvidence,
            focus: safeWorkedElement || lesson.title,
          })
        : curatedWorked?.effect_explanation ?? safeWorkedEffect,
    },
    trust_chain: [
      ...new Set([
        ...(lesson.trust_chain ?? []),
        `B.E.S.T./CPALMS clarification: ${frame.cpalmClarification}`,
        curatedWorked ? 'Ready-to-teach source: curated worked example used' : 'Backup source: generated worked example used',
      ]),
    ],
  };
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as LessonRequest;
  const standardCode = clean(body.standard_code);

  if (!standardCode) {
    return NextResponse.json({ error: 'Choose a standard first.' }, { status: 400 });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ lesson: fallbackLesson(body) });
  }

  const baseLesson = fallbackLesson(body);
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, timeout: 60_000 });

  try {
    const message = await client.messages.create({
      model: process.env.ANTHROPIC_LESSON_MODEL ?? process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-6',
      max_tokens: 2400,
      temperature: 0.2,
      system:
        `You are GOGI Literary Intelligence, an expert Grade 9 Florida B.E.S.T. ELA lesson designer. Create concise, teacher-usable Cornell notes lessons. Keep language clear enough for Title I ninth graders. Do not over-explain. Do not generate copyrighted excerpts; only use provided excerpt text if present.\n\n${CARLOS_LESSON_DECK_RULES}`,
      messages: [
        {
          role: 'user',
          content: `Return ONLY JSON matching this shape:
{
  "title": string,
  "standard_code": string,
  "standard_text": string,
  "anchor_text": string,
  "objective": string,
  "plain_english_standard": string,
  "skill_overview": string,
  "how_to_identify": string[],
  "how_to_solve": string[],
  "vocabulary": [{"term": string, "meaning": string, "example": string}],
  "cornell_sequence": [{"title": string, "teacher_move": string, "student_notes": string}],
  "worked_example": {"element": string, "evidence": string, "effect": string},
  "guided_practice": string[],
  "independent_practice": string[],
  "cue_questions": string[],
  "summary_frame": string,
  "exit_ticket": string,
  "teacher_key": string[],
  "ppt_sequence": [{"slide": number, "title": string, "minutes": number, "teacher_action": string, "student_task": string}],
  "trust_chain": string[]
}

Build the lesson from this template baseline:
${JSON.stringify(baseLesson, null, 2)}

Rules:
- Cornell sequence must follow: setup, standard, skill overview, how to identify, how to solve, worked example, guided practice, independent practice, cue questions, summary, exit ticket.
- The lesson must support Florida FAST-style reading work: locate exact evidence, interpret it in context, explain the author effect.
- For ELA.9.R.1.1 specifically, teach the named key elements: setting, plot, characterization, conflict, point of view, theme, tone, and style. Use a layers model: literal layer -> mood/tone layer -> theme/character layer -> author purpose/style layer.
- Skill overview must define the skill. Do not put the common mistake or misconception in the skill overview.
- Worked example effect must be a real analysis of the provided excerpt. Never write placeholder sentences like "this creates meaning beyond a surface summary."
- Clean OCR artifacts before using excerpt evidence. Remove bracket junk, broken hyphenation, and any cut-off midword fragments.
- Do not write vague stems like "what does it suggest in context" without naming the exact student task.
- Keep every student-facing sentence short and classroom-ready.
- Keep students writing, annotating, solving, and revising for nearly the full block. Do not add turn-and-talk, partner chatter, or open discussion blocks unless they are replaced by written accountable responses.
- Include a vocabulary anchor concept in the lesson: academic terms students need for the skill and text.
- The exported PowerPoint uses Carlos's Cornell template, so content must fit short slide boxes: concise, directive, journal-task language.
- If an excerpt is provided, use only a short quoted phrase from it in the worked example.`,
        },
      ],
    });

    const textBlock = message.content.find((block) => block.type === 'text');
    const parsed = parseJson(textBlock?.text ?? '');
    if (!clean(parsed?.worked_example?.element)) {
      parsed.worked_example = {
        ...(parsed.worked_example ?? {}),
        element: baseLesson.worked_example.element,
      };
    }
    if (!clean(parsed?.worked_example?.evidence)) {
      parsed.worked_example = {
        ...(parsed.worked_example ?? {}),
        evidence: baseLesson.worked_example.evidence,
      };
    }
    if (!clean(parsed?.worked_example?.effect)) {
      parsed.worked_example = {
        ...(parsed.worked_example ?? {}),
        effect: baseLesson.worked_example.effect,
      };
    }
    return NextResponse.json({
      lesson: {
        ...repairLesson(
          {
            ...baseLesson,
            ...parsed,
            standard_code: standardCode,
            source: 'claude',
          },
          body
        ),
        source: 'claude',
      },
    });
  } catch (error) {
    console.error('[api/teacher/literary-intelligence/generate] error:', error);
    return NextResponse.json({ lesson: baseLesson });
  }
}
