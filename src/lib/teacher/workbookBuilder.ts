import { buildTeachingReadinessBoard } from '@/lib/teacher/pullOutSheet';

type WorkbookVersion = 'student' | 'teacher' | 'answers';

function escapeHtml(value: string | number | null | undefined) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function compact(value: string, max = 1200) {
  const cleaned = value.replace(/\s+/g, ' ').trim();
  if (cleaned.length <= max) return cleaned;
  return `${cleaned.slice(0, max).trim()}...`;
}

function letters(index: number) {
  return String.fromCharCode(65 + index);
}

function pageCss() {
  return `
    :root {
      --ink: #252525;
      --muted: #717171;
      --line: #d8d8d8;
      --soft: #f5f6f8;
      --dark: #1f1f1f;
      --blue: #2f77bb;
      --gold: #f2c14e;
    }
    * { box-sizing: border-box; }
    body {
      color: var(--ink);
      font-family: Arial, Helvetica, sans-serif;
      margin: 0;
      background: #e9e9e9;
      line-height: 1.34;
    }
    .sheet {
      background: white;
      width: 8.5in;
      min-height: 11in;
      margin: 24px auto;
      padding: 0.55in 0.58in;
      box-shadow: 0 10px 30px rgba(0,0,0,.12);
      position: relative;
      page-break-after: always;
    }
    .topline {
      display: flex;
      justify-content: space-between;
      gap: 24px;
      font-size: 11px;
      font-weight: 800;
      border-bottom: 1px dotted #aaa;
      padding-bottom: 10px;
      margin-bottom: 14px;
    }
    .title {
      text-align: center;
      font-size: 32px;
      font-weight: 950;
      letter-spacing: .2px;
      margin: 4px 0 12px;
    }
    .chapter {
      background: #9e9e9e;
      color: #191919;
      border-radius: 10px;
      font-size: 18px;
      font-weight: 950;
      padding: 6px 14px;
      margin: 8px 0 14px;
    }
    .lesson-pill {
      background: #1f1f1f;
      border-radius: 7px;
      color: white;
      display: inline-block;
      font-size: 13px;
      font-weight: 900;
      padding: 4px 12px;
      margin: 3px 0 8px;
    }
    .standard-line {
      color: var(--muted);
      font-size: 11px;
      font-weight: 900;
      text-transform: uppercase;
      letter-spacing: .05em;
      margin: 0 0 4px;
    }
    .skill-box {
      border: 1px solid var(--line);
      border-left: 7px solid var(--blue);
      padding: 10px 12px;
      margin: 8px 0 12px;
      background: #fbfcfe;
      border-radius: 8px;
    }
    .skill-box h3, .guide-box h3 {
      font-size: 13px;
      margin: 0 0 4px;
      text-transform: uppercase;
      letter-spacing: .04em;
      color: var(--blue);
    }
    .skill-box p, .guide-box p {
      margin: 3px 0;
      font-size: 12px;
    }
    .passage-card {
      border-top: 2px solid #1f1f1f;
      padding-top: 8px;
      margin-top: 14px;
      break-inside: avoid;
    }
    .source {
      font-size: 11px;
      color: var(--blue);
      font-weight: 900;
      margin-bottom: 4px;
    }
    .passage {
      font-family: Georgia, 'Times New Roman', serif;
      font-size: 12.5px;
      white-space: pre-wrap;
      margin: 5px 0 9px;
    }
    .question {
      font-size: 12.5px;
      font-weight: 900;
      margin: 8px 0 5px;
    }
    .choices {
      display: grid;
      gap: 2px;
      margin: 0;
      padding: 0;
      list-style: none;
      font-size: 12px;
    }
    .choice {
      display: grid;
      grid-template-columns: 20px 1fr;
      gap: 6px;
      align-items: start;
    }
    .bubble {
      border: 1.5px solid #333;
      border-radius: 50%;
      display: inline-flex;
      width: 16px;
      height: 16px;
      align-items: center;
      justify-content: center;
      font-size: 9px;
      font-weight: 900;
      line-height: 1;
      margin-top: 1px;
    }
    .footer {
      position: absolute;
      bottom: .28in;
      left: .58in;
      right: .58in;
      display: flex;
      justify-content: space-between;
      color: #777;
      font-size: 10px;
      border-top: 1px solid #eee;
      padding-top: 6px;
    }
    .guide-box {
      background: #fff8e1;
      border: 1px solid #efd27d;
      border-radius: 8px;
      margin: 8px 0 10px;
      padding: 9px 11px;
      break-inside: avoid;
    }
    .answer {
      color: #2f6f20;
      font-weight: 950;
    }
    .tracker {
      width: 100%;
      border-collapse: collapse;
      margin-top: 14px;
      font-size: 12px;
    }
    .tracker th, .tracker td {
      border: 1px solid var(--line);
      padding: 7px;
      text-align: left;
      vertical-align: top;
    }
    .tracker th { background: var(--soft); }
    .printbar {
      position: sticky;
      top: 0;
      z-index: 10;
      background: #101010;
      color: white;
      padding: 10px 16px;
      display: flex;
      justify-content: center;
      gap: 10px;
      align-items: center;
      font-size: 13px;
      font-weight: 800;
    }
    .printbar button, .printbar a {
      background: var(--blue);
      color: white;
      border: 0;
      border-radius: 7px;
      padding: 8px 12px;
      font-weight: 900;
      text-decoration: none;
      cursor: pointer;
    }
    @page { size: letter; margin: 0; }
    @media print {
      body { background: white; }
      .printbar { display: none; }
      .sheet {
        width: auto;
        min-height: 11in;
        margin: 0;
        box-shadow: none;
        page-break-after: always;
      }
    }
  `;
}

function coverPage(args: {
  title: string;
  subtitle: string;
  standardCode: string;
  standardText: string;
  version: WorkbookVersion;
}) {
  const versionLabel =
    args.version === 'student' ? 'Student Workbook' : args.version === 'teacher' ? 'Teacher Guide' : 'Answer Sheet';
  return `
    <section class="sheet">
      <div class="topline"><span>Name: ____________________________</span><span>Period: ______ Date: __________</span></div>
      <h1 class="title">${escapeHtml(args.title)}</h1>
      <div class="chapter">${escapeHtml(versionLabel)}</div>
      <div class="skill-box">
        <h3>${escapeHtml(args.standardCode)}</h3>
        <p><strong>Standard:</strong> ${escapeHtml(args.standardText)}</p>
        <p><strong>Purpose:</strong> Reusable, laminated FAST-aligned practice built from GOGI gold cards.</p>
        <p><strong>Student routine:</strong> Read, paraphrase, underline evidence, answer, then explain why the correct answer works.</p>
      </div>
      <table class="tracker">
        <thead><tr><th>Lesson</th><th>Skill</th><th>Score</th><th>Reteach Needed?</th></tr></thead>
        <tbody>
          ${Array.from({ length: 8 }, (_, index) => `<tr><td>${index + 1}</td><td></td><td>____ / ____</td><td>Yes / No</td></tr>`).join('')}
        </tbody>
      </table>
      <div class="footer"><span>GOGI Grade 9 FAST Reading Workbook</span><span>${escapeHtml(args.subtitle)}</span></div>
    </section>
  `;
}

function studentLessonPage(args: {
  lessonNumber: number;
  standardCode: string;
  standardTitle: string;
  skill: Awaited<ReturnType<typeof buildTeachingReadinessBoard>>['standards'][number]['skills'][number];
}) {
  return `
    <section class="sheet">
      <div class="topline"><span>Date of Completion: __________________</span><span>Score: ____________</span></div>
      <h1 class="title">Chapter 1 - Reading</h1>
      <div class="chapter">Lesson ${args.lessonNumber}: ${escapeHtml(args.skill.label)}</div>
      <p class="standard-line">${escapeHtml(args.standardCode)} · ${escapeHtml(args.standardTitle)}</p>
      <div class="skill-box">
        <h3>Skill Strategy</h3>
        <p>${escapeHtml(args.skill.scaffold ?? args.skill.studentMove)}</p>
        <p><strong>Common trap:</strong> ${escapeHtml(args.skill.commonMiss ?? 'Choosing an answer that summarizes instead of proving the skill.')}</p>
      </div>
      ${args.skill.pullOuts
        .map((row, index) => {
          const questionNumber = index + 1;
          return `
            <div class="passage-card">
              <div class="lesson-pill">Question ${questionNumber} is based on the passage below</div>
              <div class="source">${escapeHtml(row.selection)} · ${escapeHtml(row.exactLinesOrParagraphs)}</div>
              <div class="passage">${escapeHtml(compact(row.excerpt))}</div>
              <p class="question">${questionNumber}. ${escapeHtml(row.anchorQuestion.stem)}</p>
              <ul class="choices">
                ${row.anchorQuestion.choices
                  .map(
                    (choice, choiceIndex) => `
                      <li class="choice"><span class="bubble">${letters(choiceIndex)}</span><span>${escapeHtml(choice.text)}</span></li>
                    `
                  )
                  .join('')}
              </ul>
            </div>
          `;
        })
        .join('')}
      <div class="footer"><span>GOGI Workbook</span><span>Lesson ${args.lessonNumber}</span></div>
    </section>
  `;
}

function teacherLessonPage(args: {
  lessonNumber: number;
  standardCode: string;
  standardTitle: string;
  skill: Awaited<ReturnType<typeof buildTeachingReadinessBoard>>['standards'][number]['skills'][number];
}) {
  return `
    <section class="sheet">
      <div class="topline"><span>Teacher Guide</span><span>${escapeHtml(args.standardCode)}</span></div>
      <h1 class="title">Lesson ${args.lessonNumber} Key</h1>
      <div class="chapter">${escapeHtml(args.skill.label)}</div>
      <div class="skill-box">
        <h3>Teach First</h3>
        <p>${escapeHtml(args.skill.studentMove)}</p>
        <p><strong>Mastery signal:</strong> ${escapeHtml(args.skill.masterySignal ?? '')}</p>
      </div>
      ${args.skill.pullOuts
        .map((row, index) => {
          const correctIndex = row.anchorQuestion.choices.findIndex((choice) => choice.correct);
          const correct = row.anchorQuestion.choices[correctIndex];
          return `
            <div class="guide-box">
              <h3>Question ${index + 1} · ${escapeHtml(row.selection)}</h3>
              <p><strong>Stem:</strong> ${escapeHtml(row.anchorQuestion.stem)}</p>
              <p class="answer"><strong>Answer:</strong> ${letters(correctIndex)}. ${escapeHtml(correct?.text ?? '')}</p>
              <p><strong>Why:</strong> ${escapeHtml(row.whyThisExcerpt)} The strongest evidence points are: ${escapeHtml(row.teacherTrust.evidencePoints.slice(0, 3).join(' · '))}.</p>
              <p><strong>Reteach move:</strong> ${escapeHtml(row.instructionalSupport?.prometheanPrompt ?? row.moveStatementTemplate)}</p>
            </div>
          `;
        })
        .join('')}
      <div class="footer"><span>GOGI Teacher Guide</span><span>Lesson ${args.lessonNumber}</span></div>
    </section>
  `;
}

function answerSheetPage(args: {
  standardCode: string;
  standardTitle: string;
  skills: Awaited<ReturnType<typeof buildTeachingReadinessBoard>>['standards'][number]['skills'];
}) {
  return `
    <section class="sheet">
      <div class="topline"><span>Name: ____________________________</span><span>Period: ______ Date: __________</span></div>
      <h1 class="title">GOGI Answer Sheet</h1>
      <div class="chapter">${escapeHtml(args.standardCode)} · ${escapeHtml(args.standardTitle)}</div>
      <table class="tracker">
        <thead><tr><th>Lesson</th><th>Question</th><th>A</th><th>B</th><th>C</th><th>D</th><th>Evidence line</th></tr></thead>
        <tbody>
          ${args.skills
            .map((skill, lessonIndex) =>
              skill.pullOuts
                .map(
                  (_row, questionIndex) => `
                    <tr>
                      <td>${lessonIndex + 1}</td>
                      <td>${questionIndex + 1}</td>
                      <td>○</td><td>○</td><td>○</td><td>○</td>
                      <td>________________________________________</td>
                    </tr>
                  `
                )
                .join('')
            )
            .join('')}
        </tbody>
      </table>
      <div class="footer"><span>GOGI Workbook</span><span>Answer Sheet</span></div>
    </section>
  `;
}

export async function buildWorkbookHtml(args: {
  standardCode?: string;
  version?: WorkbookVersion;
}) {
  const standardCode = args.standardCode ?? 'ELA.9.R.1.1';
  const version = args.version ?? 'student';
  const board = await buildTeachingReadinessBoard({ targetPerSkill: 5, maxStandards: 20 });
  const standard = board.standards.find((item) => item.code === standardCode) ?? board.standards[0];
  if (!standard) throw new Error('No workbook-ready standards found.');

  const readySkills = standard.skills.filter((skill) => skill.pullOuts.length > 0);
  const subtitle = `${standard.code} · ${standard.title}`;
  const title = 'GOGI Grade 9 FAST Reading Workbook';
  const pages =
    version === 'answers'
      ? [
          coverPage({
            title,
            subtitle,
            standardCode: standard.code,
            standardText: standard.standardText,
            version,
          }),
          answerSheetPage({ standardCode: standard.code, standardTitle: standard.title, skills: readySkills }),
        ]
      : [
          coverPage({
            title,
            subtitle,
            standardCode: standard.code,
            standardText: standard.standardText,
            version,
          }),
          ...readySkills.map((skill, index) =>
            version === 'teacher'
              ? teacherLessonPage({
                  lessonNumber: index + 1,
                  standardCode: standard.code,
                  standardTitle: standard.title,
                  skill,
                })
              : studentLessonPage({
                  lessonNumber: index + 1,
                  standardCode: standard.code,
                  standardTitle: standard.title,
                  skill,
                })
          ),
        ];

  const label =
    version === 'student'
      ? 'Student workbook'
      : version === 'teacher'
        ? 'Teacher guide'
        : 'Answer sheet';

  return `<!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>${escapeHtml(label)} · ${escapeHtml(subtitle)}</title>
        <style>${pageCss()}</style>
      </head>
      <body>
        <div class="printbar">
          <span>${escapeHtml(label)} · ${escapeHtml(subtitle)}</span>
          <button onclick="window.print()">Print / Save PDF</button>
          <a href="/teacher-dashboard/workbook-builder">Back to Workbook Builder</a>
        </div>
        ${pages.join('')}
      </body>
    </html>`;
}
