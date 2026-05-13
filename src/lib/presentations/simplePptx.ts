export type PptxLesson = {
  title: string;
  standard_code: string;
  standard_text: string;
  anchor_text: string;
  objective: string;
  plain_english_standard: string;
  skill_overview: string;
  how_to_identify: string[];
  how_to_solve: string[];
  vocabulary?: Array<{ term: string; meaning: string; example: string }>;
  cornell_sequence: Array<{
    title: string;
    teacher_move: string;
    student_notes: string;
  }>;
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
  ppt_sequence?: Array<{
    slide: number;
    title: string;
    minutes: number;
    teacher_action: string;
    student_task: string;
  }>;
  trust_chain?: string[];
};

type SlideSpec = {
  kicker: string;
  title: string;
  lines: string[];
  note?: string;
  mode?: 'cover' | 'cornell' | 'passage' | 'table' | 'checklist' | 'close';
};

export type DesignerTextBox = {
  x: number;
  y: number;
  w: number;
  h: number;
  text: string | string[];
  fontSize?: number;
  bold?: boolean;
  color?: string;
  fill?: string;
  border?: string;
  bullet?: boolean;
};

export type DesignerSlide = {
  title: string;
  background?: string;
  boxes: DesignerTextBox[];
};

export type DesignerDeck = {
  title: string;
  slides: DesignerSlide[];
};

const SLIDE_W = 12192000;
const SLIDE_H = 6858000;
const NAVY = '1E2761';
const NAVY_2 = '2C3A78';
const GOLD = 'F2C14E';
const BLUE_SOFT = 'CADCFC';
const BLUE_MID = '8AA0C9';
const CREAM = 'FFF8E1';
const WHITE = 'FFFFFF';
const INK = '101828';
const MUTED = '344054';

function xml(value: string | number | null | undefined) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function clampLine(value: string, max = 150) {
  const cleaned = value.replace(/\s+/g, ' ').trim();
  if (cleaned.length <= max) return cleaned;
  return `${cleaned.slice(0, max).trim()}...`;
}

function bulletLines(values: string[], max = 5) {
  return values.filter(Boolean).slice(0, max).map((value) => clampLine(value, 135));
}

function vocabularyLines(lesson: PptxLesson) {
  const vocab = lesson.vocabulary ?? [];
  if (vocab.length) {
    return vocab
      .slice(0, 5)
      .map((item) => `${item.term}: ${item.meaning}`);
  }

  return [
    'evidence: exact words from the text that prove an answer',
    'effect: what the evidence makes the reader understand, feel, or notice',
    'context: the sentence or moment around the quoted evidence',
    'analysis: explaining why the evidence matters',
  ];
}

function splitPracticeText(text: string) {
  const sentences = text.match(/[^.!?]+[.!?]+/g)?.map((item) => item.trim()) ?? [];
  if (sentences.length >= 3) {
    const first = sentences.slice(0, Math.ceil(sentences.length / 3)).join(' ');
    const second = sentences
      .slice(Math.ceil(sentences.length / 3), Math.ceil((sentences.length * 2) / 3))
      .join(' ');
    const third = sentences.slice(Math.ceil((sentences.length * 2) / 3)).join(' ');
    return [first, second, third].map((part) => clampLine(part, 520));
  }

  return [text, text, text].map((part) => clampLine(part, 520));
}

function shapeText(id: number, x: number, y: number, w: number, h: number, paragraphs: string[], opts?: {
  fontSize?: number;
  bold?: boolean;
  color?: string;
  fill?: string;
  border?: string;
  bullet?: boolean;
}) {
  const fontSize = opts?.fontSize ?? 2200;
  const color = opts?.color ?? '111827';
  const bodyPr = `<a:bodyPr wrap="square" lIns="160000" tIns="120000" rIns="160000" bIns="120000"><a:spAutoFit/></a:bodyPr>`;
  const fill = opts?.fill
    ? `<a:solidFill><a:srgbClr val="${opts.fill}"/></a:solidFill>`
    : '<a:noFill/>';
  const border = opts?.border
    ? `<a:ln w="12700"><a:solidFill><a:srgbClr val="${opts.border}"/></a:solidFill></a:ln>`
    : '<a:ln><a:noFill/></a:ln>';

  const p = paragraphs
    .filter((line) => line.trim().length > 0)
    .map((line, index) => {
      const bullet = opts?.bullet
        ? '<a:buFont typeface="Arial"/><a:buChar char="•"/>'
        : '<a:buNone/>';
      return `<a:p><a:pPr>${bullet}</a:pPr><a:r><a:rPr lang="en-US" sz="${fontSize}"${opts?.bold ? ' b="1"' : ''}><a:solidFill><a:srgbClr val="${color}"/></a:solidFill><a:latin typeface="Aptos"/></a:rPr><a:t>${xml(line)}</a:t></a:r>${index === paragraphs.length - 1 ? '' : '<a:endParaRPr lang="en-US"/>'}</a:p>`;
    })
    .join('');

  return `<p:sp>
    <p:nvSpPr><p:cNvPr id="${id}" name="Text ${id}"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr>
    <p:spPr><a:xfrm><a:off x="${x}" y="${y}"/><a:ext cx="${w}" cy="${h}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom>${fill}${border}</p:spPr>
    <p:txBody>${bodyPr}<a:lstStyle/>${p || '<a:p/>'}</p:txBody>
  </p:sp>`;
}

function slideXml(spec: SlideSpec, index: number) {
  const bodyLines = spec.lines.length ? spec.lines : [''];
  const isCover = spec.mode === 'cover';
  const isClose = spec.mode === 'close';
  const bodyFill = spec.mode === 'passage' ? CREAM : WHITE;
  const titleColor = isCover || isClose ? WHITE : NAVY;
  const bg = isCover || isClose ? NAVY : 'F7F9FC';
  const noteFill = spec.mode === 'checklist' ? BLUE_SOFT : CREAM;
  const titleY = isCover ? 1500000 : 500000;
  const titleH = isCover ? 1600000 : 760000;
  const bodyY = isCover ? 3420000 : 1760000;
  const bodyH = spec.note ? 3350000 : 4200000;

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld>
    <p:bg><p:bgPr><a:solidFill><a:srgbClr val="${bg}"/></a:solidFill><a:effectLst/></p:bgPr></p:bg>
    <p:spTree>
      <p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
      <p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${SLIDE_W}" cy="${SLIDE_H}"/><a:chOff x="0" y="0"/><a:chExt cx="${SLIDE_W}" cy="${SLIDE_H}"/></a:xfrm></p:grpSpPr>
      ${!isCover && !isClose ? shapeText(7, 0, 0, SLIDE_W, 185000, [''], { fill: NAVY, border: NAVY }) : ''}
      ${shapeText(2, 520000, isCover ? 620000 : 280000, isCover ? 3000000 : 2500000, 420000, [spec.kicker.toUpperCase()], { fontSize: 1250, bold: true, color: isCover || isClose ? NAVY : NAVY, fill: GOLD, border: GOLD })}
      ${shapeText(3, 520000, titleY, 11100000, titleH, [spec.title], { fontSize: isCover ? 4200 : 2850, bold: true, color: titleColor })}
      ${
        spec.mode === 'cornell'
          ? shapeText(8, 620000, 1760000, 2500000, 3300000, ['CUE', '(questions)', '', 'Write questions here after the notes are built.'], { fontSize: 1500, color: NAVY, fill: BLUE_SOFT, border: BLUE_MID, bullet: false })
          : ''
      }
      ${shapeText(4, spec.mode === 'cornell' ? 3400000 : 620000, bodyY, spec.mode === 'cornell' ? 8100000 : 10900000, bodyH, bodyLines, { fontSize: spec.mode === 'passage' ? 1600 : 1780, color: MUTED, fill: bodyFill, border: BLUE_MID, bullet: !isCover && !isClose })}
      ${
        spec.note
          ? shapeText(5, 620000, 5480000, 10900000, 620000, [spec.note], { fontSize: 1380, bold: spec.mode === 'passage', color: NAVY, fill: noteFill, border: GOLD })
          : ''
      }
      ${shapeText(6, 10900000, 6300000, 720000, 260000, [`${index} / 24`], { fontSize: 1000, bold: true, color: isCover || isClose ? WHITE : NAVY })}
    </p:spTree>
  </p:cSld>
  <p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>
</p:sld>`;
}

function emu(inches: number) {
  return Math.round(inches * 914400);
}

function normalizeHex(value: string | undefined, fallback: string) {
  return (value || fallback).replace(/^#/, '').slice(0, 6).toUpperCase();
}

function designerSlideXml(spec: DesignerSlide) {
  const bg = normalizeHex(spec.background, 'F7F9FC');
  const boxes = spec.boxes
    .slice(0, 32)
    .map((box, index) => {
      const lines = Array.isArray(box.text) ? box.text : String(box.text).split('\n');
      return shapeText(
        10 + index,
        emu(box.x),
        emu(box.y),
        emu(box.w),
        emu(box.h),
        lines,
        {
          fontSize: Math.round((box.fontSize ?? 16) * 100),
          bold: box.bold,
          color: normalizeHex(box.color, INK),
          fill: box.fill ? normalizeHex(box.fill, WHITE) : undefined,
          border: box.border ? normalizeHex(box.border, BLUE_MID) : undefined,
          bullet: box.bullet,
        }
      );
    })
    .join('');

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld>
    <p:bg><p:bgPr><a:solidFill><a:srgbClr val="${bg}"/></a:solidFill><a:effectLst/></p:bgPr></p:bg>
    <p:spTree>
      <p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
      <p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${SLIDE_W}" cy="${SLIDE_H}"/><a:chOff x="0" y="0"/><a:chExt cx="${SLIDE_W}" cy="${SLIDE_H}"/></a:xfrm></p:grpSpPr>
      ${boxes}
    </p:spTree>
  </p:cSld>
  <p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>
</p:sld>`;
}

function buildSlides(lesson: PptxLesson): SlideSpec[] {
  const evidence = clampLine(lesson.worked_example.evidence, 820);
  const [passageOne, passageTwo, passageThree] = splitPracticeText(lesson.worked_example.evidence);
  const vocab = vocabularyLines(lesson);
  const standardTitle = lesson.title.replace(`${lesson.standard_code} Cornell Lesson:`, '').trim();

  const slides: SlideSpec[] = [
    {
      kicker: lesson.standard_code,
      title: lesson.title,
      lines: [
        `Anchor text: ${lesson.anchor_text}`,
        `Objective: ${lesson.objective}`,
        'Cornell Notes · 90 minutes · Journal-driven',
      ],
      note: 'Name __________________   Date _________   Period ____',
      mode: 'cover',
    },
    {
      kicker: lesson.standard_code,
      title: 'Set up your Cornell page',
      lines: [
        'CUE COLUMN — questions go here later.',
        'NOTES COLUMN — definitions, examples, evidence, and worked examples go here.',
        'SUMMARY — bottom 5 lines, 2–3 sentences in your own words.',
        `Always include standard code: ${lesson.standard_code}.`,
      ],
      note: 'NOTES — Draw your Cornell layout now. Label each zone.',
      mode: 'cornell',
    },
    {
      kicker: '3 min',
      title: "Today's standard",
      lines: [
        `FLORIDA B.E.S.T.: ${lesson.standard_text}`,
        `IN PLAIN ENGLISH: ${lesson.plain_english_standard}`,
        `TODAY'S SKILL: ${standardTitle || lesson.objective}`,
      ],
      note: 'NOTES — Copy the Florida standard, plain-English version, and focus skill.',
      mode: 'cornell',
    },
    {
      kicker: '4 min',
      title: 'Key definition',
      lines: [
        lesson.skill_overview,
        'A strong answer does more than name the device or detail.',
        'A strong answer explains what the author makes the reader notice, feel, or understand.',
      ],
      note: 'NOTES — Copy the definition. Underline the words that name the author effect.',
      mode: 'cornell',
    },
    {
      kicker: '5 min',
      title: 'The GOGI reading move',
      lines: [
        '1. Spot the exact evidence.',
        '2. Name what the evidence is doing.',
        '3. Explain the effect on meaning, mood, purpose, theme, or style.',
        ...bulletLines(lesson.how_to_solve, 3),
      ],
      note: 'NOTES — Draw this as a 3-step process: SPOT → NAME → EXPLAIN.',
      mode: 'cornell',
    },
    {
      kicker: '6 min',
      title: 'How to spot it',
      lines: bulletLines(lesson.how_to_identify, 6),
      note: 'NOTES — Copy the spotting rules. Star the one that feels hardest.',
      mode: 'cornell',
    },
    {
      kicker: '5 min',
      title: 'Vocabulary anchor',
      lines: vocab,
      note: 'VOCAB → NOTES COLUMN. Add one example sentence for today’s skill.',
      mode: 'cornell',
    },
    {
      kicker: '10 min',
      title: 'Passage 1 — active reading',
      lines: [
        passageOne || evidence,
        'READ TWICE. First read: get the meaning. Second read with pen: box the key evidence and underline the effect clues.',
      ],
      note: 'NOTES — Box the evidence. Underline words that create the effect.',
      mode: 'passage',
    },
    {
      kicker: '8 min',
      title: 'Worked example — Passage 1',
      lines: [
        `Element: ${clampLine(lesson.worked_example.element)}`,
        `Evidence: ${clampLine(lesson.worked_example.evidence, 220)}`,
        `Effect: ${clampLine(lesson.worked_example.effect, 220)}`,
        'Your turn: add one more evidence/effect row from the passage.',
      ],
      note: 'Teacher think-aloud: element + evidence + effect.',
      mode: 'table',
    },
    {
      kicker: '3 min',
      title: 'Silent Rep 1',
      lines: [
        'Choose the strongest evidence point from Passage 1.',
        'Write one sentence naming what the evidence shows.',
        'Write one sentence explaining the effect on the reader.',
        'Use one precise skill word from today’s notes.',
      ],
      note: 'NOTES — Silent writing. Pen moving the entire time.',
      mode: 'checklist',
    },
    {
      kicker: '10 min',
      title: 'Passage 2 — guided practice',
      lines: [
        passageTwo || evidence,
        'Guided task: underline one detail, name the key element, then explain the effect.',
        ...bulletLines(lesson.guided_practice, 3),
      ],
      note: 'NOTES — Build the same evidence/effect table. We check together.',
      mode: 'passage',
    },
    {
      kicker: '4 min',
      title: 'Check your annotations',
      lines: [
        'Your table should name the element or move.',
        'Your evidence should be a direct quote or exact detail.',
        'Your effect should explain what the evidence does for the reader.',
        ...bulletLines(lesson.teacher_key, 3),
      ],
      note: 'MARK YOUR WORK — Add anything you missed in a different color.',
      mode: 'table',
    },
    {
      kicker: '10 min',
      title: 'Passage 3 — independent',
      lines: [
        passageThree || evidence,
        'Independent task: answer the question in writing before checking any answer choices.',
        ...bulletLines(lesson.independent_practice, 3),
      ],
      note: 'NOTES — Independent work. Answer first, then justify with exact evidence.',
      mode: 'passage',
    },
    {
      kicker: '4 min',
      title: 'Teacher Checkpoint',
      lines: [
        'Keep journals open to the independent response.',
        'Teacher scans for: exact evidence, effect explained, answer is more than summary.',
        'If your response is marked, revise immediately in a different color.',
        'Add one stronger evidence/effect sentence before moving on.',
      ],
      note: 'No partner talk. This is a fast written checkpoint and revision window.',
      mode: 'checklist',
    },
    {
      kicker: '3 min',
      title: 'What is a cue column?',
      lines: [
        'Cue questions are the questions your notes already answer.',
        'You wrote the answers in the notes column.',
        'Now you write questions that force you to re-read those notes.',
      ],
      note: 'NOTES — Label your cue column now. Draw the feed arrow between columns.',
      mode: 'cornell',
    },
    {
      kicker: '4 min',
      title: 'What makes a cue question good?',
      lines: [
        'Weak cue: asks for one fact or a definition only.',
        'Strong cue: forces you to explain evidence and effect.',
        'Strong cue: can only be answered by reading your matching notes.',
        ...bulletLines(lesson.cue_questions, 3),
      ],
      note: 'NOTES — Copy one weak cue and one strong cue as a reference.',
      mode: 'cornell',
    },
    {
      kicker: '5 min',
      title: 'Cue column — model',
      lines: bulletLines(lesson.cue_questions, 5).map((question) => `Cue: ${question}`),
      note: 'Watch how each cue matches a note. You will do this next.',
      mode: 'table',
    },
    {
      kicker: '6 min',
      title: 'Now write 5 cue questions',
      lines: [
        'How does ___ create ___?',
        'Why did the author include ___?',
        'What effect does ___ have on the reader?',
        'What evidence shows that ___?',
        'How does this detail connect to the standard?',
      ],
      note: 'NOTES — Write 5 questions in the left column. They must match notes you already wrote.',
      mode: 'cornell',
    },
    {
      kicker: '4 min',
      title: 'Write the summary',
      lines: [lesson.summary_frame],
      note: 'SUMMARY — 2–3 sentences in your own words. Underline the skill word.',
      mode: 'cornell',
    },
    {
      kicker: '3 min',
      title: 'Self-check before exit ticket',
      lines: [
        'Cornell layout drawn — 3 zones visible.',
        `Standard code at top right: ${lesson.standard_code}.`,
        'Notes column includes standard, definition, evidence, and worked example.',
        'Cue column has 5+ questions.',
        'Summary is written in 2–3 sentences.',
      ],
      note: 'Tick each box. Any missing piece — fix it now.',
      mode: 'checklist',
    },
    {
      kicker: '5 min',
      title: 'Exit ticket',
      lines: [
        lesson.exit_ticket,
        'Your answer must include: name the skill, quote evidence, explain the effect, and use precise academic language.',
      ],
      note: 'Write on a separate page. Hand in before you leave.',
      mode: 'table',
    },
    {
      kicker: '2 min',
      title: 'Today, you can now...',
      lines: [
        'Set up a Cornell page for a reading skill.',
        `Explain what ${lesson.standard_code} asks you to do.`,
        'Cite exact evidence and explain its effect.',
        'Write cue questions that match your notes.',
        'Use the GOGI move on a FAST-style question.',
      ],
      note: 'Tomorrow: the next rep moves from guided support toward independence.',
      mode: 'checklist',
    },
    {
      kicker: lesson.standard_code,
      title: 'Journals down. Pens down.',
      lines: [
        'Journal check on Friday.',
        'Next lesson: keep applying the same GOGI move with new text evidence.',
      ],
      note: lesson.trust_chain?.join(' · ') ?? 'GOGI Literary Intelligence',
      mode: 'close',
    },
  ];

  return slides.slice(0, 24);
}

const crcTable = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buffer: Buffer) {
  let c = 0xffffffff;
  for (const byte of buffer) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function u16(value: number) {
  const buffer = Buffer.alloc(2);
  buffer.writeUInt16LE(value);
  return buffer;
}

function u32(value: number) {
  const buffer = Buffer.alloc(4);
  buffer.writeUInt32LE(value >>> 0);
  return buffer;
}

function zip(files: Array<{ path: string; content: string | Buffer }>) {
  const locals: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;

  for (const file of files) {
    const name = Buffer.from(file.path, 'utf8');
    const data = Buffer.isBuffer(file.content) ? file.content : Buffer.from(file.content, 'utf8');
    const crc = crc32(data);

    const local = Buffer.concat([
      u32(0x04034b50),
      u16(20),
      u16(0),
      u16(0),
      u16(0),
      u16(0),
      u32(crc),
      u32(data.length),
      u32(data.length),
      u16(name.length),
      u16(0),
      name,
      data,
    ]);
    locals.push(local);

    central.push(
      Buffer.concat([
        u32(0x02014b50),
        u16(20),
        u16(20),
        u16(0),
        u16(0),
        u16(0),
        u16(0),
        u32(crc),
        u32(data.length),
        u32(data.length),
        u16(name.length),
        u16(0),
        u16(0),
        u16(0),
        u16(0),
        u32(0),
        u32(offset),
        name,
      ])
    );

    offset += local.length;
  }

  const centralDir = Buffer.concat(central);
  const end = Buffer.concat([
    u32(0x06054b50),
    u16(0),
    u16(0),
    u16(files.length),
    u16(files.length),
    u32(centralDir.length),
    u32(offset),
    u16(0),
  ]);

  return Buffer.concat([...locals, centralDir, end]);
}

function presentationXml(slideCount: number) {
  const slideIds = Array.from({ length: slideCount }, (_, i) => {
    const id = 256 + i;
    return `<p:sldId id="${id}" r:id="rId${i + 2}"/>`;
  }).join('');

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:presentation xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst>
  <p:sldIdLst>${slideIds}</p:sldIdLst>
  <p:sldSz cx="${SLIDE_W}" cy="${SLIDE_H}" type="wide"/>
  <p:notesSz cx="6858000" cy="9144000"/>
</p:presentation>`;
}

function presentationRels(slideCount: number) {
  const slides = Array.from({ length: slideCount }, (_, i) => {
    return `<Relationship Id="rId${i + 2}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide${i + 1}.xml"/>`;
  }).join('');

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="slideMasters/slideMaster1.xml"/>
  ${slides}
</Relationships>`;
}

function contentTypes(slideCount: number) {
  const slideOverrides = Array.from({ length: slideCount }, (_, i) => {
    return `<Override PartName="/ppt/slides/slide${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`;
  }).join('');

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
  <Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>
  <Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/>
  <Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/>
  <Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>
  ${slideOverrides}
</Types>`;
}

const rootRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>`;

const appXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"><Application>GOGI</Application></Properties>`;

function coreXml(title: string) {
  const now = new Date().toISOString();
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <dc:title>${xml(title)}</dc:title><dc:creator>GOGI Literary Intelligence</dc:creator><cp:lastModifiedBy>GOGI</cp:lastModifiedBy><dcterms:created xsi:type="dcterms:W3CDTF">${now}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${now}</dcterms:modified>
</cp:coreProperties>`;
}

const slideRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>
</Relationships>`;

const slideLayout = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sldLayout xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" type="blank" preserve="1"><p:cSld name="Blank"><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${SLIDE_W}" cy="${SLIDE_H}"/><a:chOff x="0" y="0"/><a:chExt cx="${SLIDE_W}" cy="${SLIDE_H}"/></a:xfrm></p:grpSpPr></p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sldLayout>`;

const slideLayoutRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="../slideMasters/slideMaster1.xml"/></Relationships>`;

const slideMaster = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sldMaster xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${SLIDE_W}" cy="${SLIDE_H}"/><a:chOff x="0" y="0"/><a:chExt cx="${SLIDE_W}" cy="${SLIDE_H}"/></a:xfrm></p:grpSpPr></p:spTree></p:cSld><p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/><p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst><p:txStyles><p:titleStyle/><p:bodyStyle/><p:otherStyle/></p:txStyles></p:sldMaster>`;

const slideMasterRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="../theme/theme1.xml"/></Relationships>`;

const theme = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" name="GOGI Cornell Theme"><a:themeElements><a:clrScheme name="GOGI Cornell"><a:dk1><a:srgbClr val="${NAVY}"/></a:dk1><a:lt1><a:srgbClr val="${WHITE}"/></a:lt1><a:dk2><a:srgbClr val="${NAVY_2}"/></a:dk2><a:lt2><a:srgbClr val="${CREAM}"/></a:lt2><a:accent1><a:srgbClr val="${GOLD}"/></a:accent1><a:accent2><a:srgbClr val="${BLUE_SOFT}"/></a:accent2><a:accent3><a:srgbClr val="${BLUE_MID}"/></a:accent3><a:accent4><a:srgbClr val="${NAVY_2}"/></a:accent4><a:accent5><a:srgbClr val="${MUTED}"/></a:accent5><a:accent6><a:srgbClr val="${INK}"/></a:accent6><a:hlink><a:srgbClr val="${NAVY}"/></a:hlink><a:folHlink><a:srgbClr val="${NAVY_2}"/></a:folHlink></a:clrScheme><a:fontScheme name="GOGI Cornell"><a:majorFont><a:latin typeface="Arial"/><a:ea typeface=""/><a:cs typeface=""/></a:majorFont><a:minorFont><a:latin typeface="Arial"/><a:ea typeface=""/><a:cs typeface=""/></a:minorFont></a:fontScheme><a:fmtScheme name="GOGI Cornell"><a:fillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:gradFill rotWithShape="1"><a:gsLst><a:gs pos="0"><a:schemeClr val="phClr"><a:tint val="50000"/><a:satMod val="300000"/></a:schemeClr></a:gs><a:gs pos="35000"><a:schemeClr val="phClr"><a:tint val="37000"/><a:satMod val="300000"/></a:schemeClr></a:gs><a:gs pos="100000"><a:schemeClr val="phClr"><a:tint val="15000"/><a:satMod val="350000"/></a:schemeClr></a:gs></a:gsLst><a:lin ang="16200000" scaled="1"/></a:gradFill><a:gradFill rotWithShape="1"><a:gsLst><a:gs pos="0"><a:schemeClr val="phClr"><a:tint val="100000"/><a:shade val="100000"/><a:satMod val="130000"/></a:schemeClr></a:gs><a:gs pos="100000"><a:schemeClr val="phClr"><a:tint val="50000"/><a:shade val="100000"/><a:satMod val="350000"/></a:schemeClr></a:gs></a:gsLst><a:lin ang="16200000" scaled="0"/></a:gradFill></a:fillStyleLst><a:lnStyleLst><a:ln w="9525" cap="flat" cmpd="sng" algn="ctr"><a:solidFill><a:schemeClr val="phClr"><a:shade val="95000"/><a:satMod val="105000"/></a:schemeClr></a:solidFill><a:prstDash val="solid"/></a:ln><a:ln w="25400" cap="flat" cmpd="sng" algn="ctr"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:prstDash val="solid"/></a:ln><a:ln w="38100" cap="flat" cmpd="sng" algn="ctr"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:prstDash val="solid"/></a:ln></a:lnStyleLst><a:effectStyleLst><a:effectStyle><a:effectLst><a:outerShdw blurRad="40000" dist="20000" dir="5400000" rotWithShape="0"><a:srgbClr val="000000"><a:alpha val="38000"/></a:srgbClr></a:outerShdw></a:effectLst></a:effectStyle><a:effectStyle><a:effectLst><a:outerShdw blurRad="40000" dist="23000" dir="5400000" rotWithShape="0"><a:srgbClr val="000000"><a:alpha val="35000"/></a:srgbClr></a:outerShdw></a:effectLst></a:effectStyle><a:effectStyle><a:effectLst><a:outerShdw blurRad="40000" dist="23000" dir="5400000" rotWithShape="0"><a:srgbClr val="000000"><a:alpha val="35000"/></a:srgbClr></a:outerShdw></a:effectLst><a:scene3d><a:camera prst="orthographicFront"><a:rot lat="0" lon="0" rev="0"/></a:camera><a:lightRig rig="threePt" dir="t"><a:rot lat="0" lon="0" rev="1200000"/></a:lightRig></a:scene3d><a:sp3d><a:bevelT w="63500" h="25400"/></a:sp3d></a:effectStyle></a:effectStyleLst><a:bgFillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:gradFill rotWithShape="1"><a:gsLst><a:gs pos="0"><a:schemeClr val="phClr"><a:tint val="40000"/><a:satMod val="350000"/></a:schemeClr></a:gs><a:gs pos="40000"><a:schemeClr val="phClr"><a:tint val="45000"/><a:shade val="99000"/><a:satMod val="350000"/></a:schemeClr></a:gs><a:gs pos="100000"><a:schemeClr val="phClr"><a:shade val="20000"/><a:satMod val="255000"/></a:schemeClr></a:gs></a:gsLst><a:path path="circle"><a:fillToRect l="50000" t="-80000" r="50000" b="180000"/></a:path></a:gradFill><a:gradFill rotWithShape="1"><a:gsLst><a:gs pos="0"><a:schemeClr val="phClr"><a:tint val="80000"/><a:satMod val="300000"/></a:schemeClr></a:gs><a:gs pos="100000"><a:schemeClr val="phClr"><a:shade val="30000"/><a:satMod val="200000"/></a:schemeClr></a:gs></a:gsLst><a:path path="circle"><a:fillToRect l="50000" t="50000" r="50000" b="50000"/></a:path></a:gradFill></a:bgFillStyleLst></a:fmtScheme></a:themeElements></a:theme>`;

export function buildCornellLessonPptx(lesson: PptxLesson) {
  const slides = buildSlides(lesson);
  const files: Array<{ path: string; content: string | Buffer }> = [
    { path: '[Content_Types].xml', content: contentTypes(slides.length) },
    { path: '_rels/.rels', content: rootRels },
    { path: 'docProps/app.xml', content: appXml },
    { path: 'docProps/core.xml', content: coreXml(lesson.title) },
    { path: 'ppt/presentation.xml', content: presentationXml(slides.length) },
    { path: 'ppt/_rels/presentation.xml.rels', content: presentationRels(slides.length) },
    { path: 'ppt/slideMasters/slideMaster1.xml', content: slideMaster },
    { path: 'ppt/slideMasters/_rels/slideMaster1.xml.rels', content: slideMasterRels },
    { path: 'ppt/slideLayouts/slideLayout1.xml', content: slideLayout },
    { path: 'ppt/slideLayouts/_rels/slideLayout1.xml.rels', content: slideLayoutRels },
    { path: 'ppt/theme/theme1.xml', content: theme },
    ...slides.flatMap((slide, index) => [
      { path: `ppt/slides/slide${index + 1}.xml`, content: slideXml(slide, index + 1) },
      { path: `ppt/slides/_rels/slide${index + 1}.xml.rels`, content: slideRels },
    ]),
  ];

  return zip(files);
}

export function buildDesignerDeckPptx(deck: DesignerDeck) {
  const slides = deck.slides.slice(0, 32);
  const files: Array<{ path: string; content: string | Buffer }> = [
    { path: '[Content_Types].xml', content: contentTypes(slides.length) },
    { path: '_rels/.rels', content: rootRels },
    { path: 'docProps/app.xml', content: appXml },
    { path: 'docProps/core.xml', content: coreXml(deck.title) },
    { path: 'ppt/presentation.xml', content: presentationXml(slides.length) },
    { path: 'ppt/_rels/presentation.xml.rels', content: presentationRels(slides.length) },
    { path: 'ppt/slideMasters/slideMaster1.xml', content: slideMaster },
    { path: 'ppt/slideMasters/_rels/slideMaster1.xml.rels', content: slideMasterRels },
    { path: 'ppt/slideLayouts/slideLayout1.xml', content: slideLayout },
    { path: 'ppt/slideLayouts/_rels/slideLayout1.xml.rels', content: slideLayoutRels },
    { path: 'ppt/theme/theme1.xml', content: theme },
    ...slides.flatMap((slide, index) => [
      { path: `ppt/slides/slide${index + 1}.xml`, content: designerSlideXml(slide) },
      { path: `ppt/slides/_rels/slide${index + 1}.xml.rels`, content: slideRels },
    ]),
  ];

  return zip(files);
}
