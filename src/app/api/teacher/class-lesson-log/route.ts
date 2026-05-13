import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

export const runtime = 'nodejs';

const ROOT = process.cwd();
const CLASS_PLANNER_DIR = path.join(ROOT, 'data', 'class-planner');
const LESSON_LOG_PATH = path.join(CLASS_PLANNER_DIR, 'lesson-log.json');

type LessonLogEntry = {
  id: string;
  taughtAt: string;
  periodLabel: string;
  standard9: string;
  title: string;
  subskill: string;
  lessonType: 'whole_group' | 'small_group' | 'review' | 'fast_sprint';
  source: 'class_planner';
};

type LessonLogFile = {
  updatedAt: string;
  entries: LessonLogEntry[];
};

async function loadLog(): Promise<LessonLogFile> {
  try {
    const raw = await fs.readFile(LESSON_LOG_PATH, 'utf8');
    const parsed = JSON.parse(raw) as LessonLogFile;
    return {
      updatedAt: parsed.updatedAt ?? new Date().toISOString(),
      entries: Array.isArray(parsed.entries) ? parsed.entries : [],
    };
  } catch {
    return { updatedAt: new Date().toISOString(), entries: [] };
  }
}

async function saveLog(entries: LessonLogEntry[]) {
  await fs.mkdir(CLASS_PLANNER_DIR, { recursive: true });
  const next = { updatedAt: new Date().toISOString(), entries };
  await fs.writeFile(LESSON_LOG_PATH, `${JSON.stringify(next, null, 2)}\n`, 'utf8');
  return next;
}

export async function GET() {
  const log = await loadLog();
  return NextResponse.json({ ok: true, log });
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Partial<LessonLogEntry>;
    if (!body.periodLabel || !body.standard9 || !body.title) {
      return NextResponse.json({ ok: false, error: 'Missing lesson log details.' }, { status: 400 });
    }

    const log = await loadLog();
    const entry: LessonLogEntry = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      taughtAt: body.taughtAt || new Date().toISOString(),
      periodLabel: body.periodLabel,
      standard9: body.standard9,
      title: body.title,
      subskill: body.subskill || 'Core skill',
      lessonType: body.lessonType || 'whole_group',
      source: 'class_planner',
    };

    const next = await saveLog([entry, ...log.entries]);
    return NextResponse.json({ ok: true, log: next, entry });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Could not log lesson.';
    console.error('[api/teacher/class-lesson-log] error:', err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const id = url.searchParams.get('id');
    if (!id) {
      const empty = await saveLog([]);
      return NextResponse.json({ ok: true, log: empty });
    }

    const log = await loadLog();
    const next = await saveLog(log.entries.filter((entry) => entry.id !== id));
    return NextResponse.json({ ok: true, log: next });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Could not delete lesson log.';
    console.error('[api/teacher/class-lesson-log] delete error:', err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
