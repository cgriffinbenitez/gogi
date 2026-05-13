import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

type TemplateLesson = {
  title: string;
  standard_code: string;
  standard_text: string;
  anchor_text: string;
  objective: string;
  plain_english_standard: string;
  skill_overview: string;
  how_to_identify: string[];
  how_to_solve: string[];
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
  trust_chain?: string[];
};

export function buildCornellTemplatePptx(lesson: TemplateLesson) {
  const workDir = mkdtempSync(path.join(tmpdir(), 'gogi-cornell-pptx-'));
  const lessonPath = path.join(workDir, 'lesson.json');
  const outputPath = path.join(workDir, 'lesson.pptx');
  const templatePath = path.join(
    process.cwd(),
    'src/lib/presentations/templates/cornell-notes-template.pptx'
  );
  const scriptPath = path.join(process.cwd(), 'scripts/render_cornell_template_pptx.py');

  writeFileSync(lessonPath, JSON.stringify(lesson), 'utf8');

  execFileSync('python3', [scriptPath, templatePath, lessonPath, outputPath], {
    cwd: process.cwd(),
    stdio: 'pipe',
    timeout: 20_000,
  });

  return readFileSync(outputPath);
}
