import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { parsePm3Workbook } from '@/lib/pm3/parsePm3Planner';

export const runtime = 'nodejs';

const ROOT = process.cwd();
const CLASS_PLANNER_DIR = path.join(ROOT, 'data', 'class-planner');
const CLASS_PLANNER_PATH = path.join(CLASS_PLANNER_DIR, 'planner.json');

type StoredPlannerDashboard = {
  periodCount: number;
  studentCount: number;
  periods: ReturnType<typeof parsePm3Workbook>[];
  allPriorities: Array<{
    periodLabel: string;
    standard9: string;
    title: string;
    accuracy: number;
    misses: number;
    lessonHref: string;
  }>;
  updatedAt?: string;
};

async function loadStoredDashboard(): Promise<StoredPlannerDashboard | null> {
  try {
    const raw = await fs.readFile(CLASS_PLANNER_PATH, 'utf8');
    return JSON.parse(raw) as StoredPlannerDashboard;
  } catch {
    return null;
  }
}

async function saveStoredDashboard(dashboard: StoredPlannerDashboard) {
  await fs.mkdir(CLASS_PLANNER_DIR, { recursive: true });
  await fs.writeFile(
    CLASS_PLANNER_PATH,
    `${JSON.stringify({ ...dashboard, updatedAt: new Date().toISOString() }, null, 2)}\n`,
    'utf8'
  );
}

function buildDashboard(periods: ReturnType<typeof parsePm3Workbook>[]): StoredPlannerDashboard {
  const sortedPeriods = [...periods].sort((a, b) => a.periodLabel.localeCompare(b.periodLabel));
  const allPriorities = sortedPeriods.flatMap((period) =>
    period.lessonQueue.map((lesson) => ({
      periodLabel: period.periodLabel,
      standard9: lesson.standard9,
      title: lesson.title,
      accuracy: lesson.accuracy,
      misses: lesson.misses,
      lessonHref: lesson.lessonHref,
    }))
  );

  return {
    periodCount: sortedPeriods.length,
    studentCount: sortedPeriods.reduce((sum, period) => sum + period.studentCount, 0),
    periods: sortedPeriods,
    allPriorities,
  };
}

export async function GET() {
  const dashboard = await loadStoredDashboard();
  return NextResponse.json({ ok: true, dashboard });
}

export async function DELETE(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const periodLabel = url.searchParams.get('period');
    const dashboard = await loadStoredDashboard();
    if (!dashboard) return NextResponse.json({ ok: true, dashboard: null });

    if (!periodLabel) {
      await fs.rm(CLASS_PLANNER_PATH, { force: true });
      return NextResponse.json({ ok: true, dashboard: null });
    }

    const remainingPeriods = dashboard.periods.filter((period) => period.periodLabel !== periodLabel);
    if (!remainingPeriods.length) {
      await fs.rm(CLASS_PLANNER_PATH, { force: true });
      return NextResponse.json({ ok: true, dashboard: null });
    }

    const nextDashboard = buildDashboard(remainingPeriods);
    await saveStoredDashboard(nextDashboard);
    return NextResponse.json({ ok: true, dashboard: nextDashboard });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Could not delete class planner data.';
    console.error('[api/teacher/pm3-planner] delete error:', err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const files = form.getAll('files').filter((item): item is File => item instanceof File);
    const periodLabels = form.getAll('periodLabels').map((item) => String(item));

    if (!files.length) {
      return NextResponse.json({ ok: false, error: 'Upload at least one PM3 Excel file.' }, { status: 400 });
    }

    const dashboard = await loadStoredDashboard();
    const periodMap = new Map((dashboard?.periods ?? []).map((period) => [period.periodLabel, period]));

    for (let index = 0; index < files.length; index++) {
      const file = files[index];
      if (!/\.xlsx$/i.test(file.name)) {
        return NextResponse.json(
          { ok: false, error: `${file.name} is not an .xlsx file.` },
          { status: 400 }
        );
      }

      const buffer = Buffer.from(await file.arrayBuffer());
      const period = parsePm3Workbook(buffer, file.name, periodLabels[index]);
      periodMap.set(period.periodLabel, period);
    }

    const nextDashboard = buildDashboard([...periodMap.values()]);
    await saveStoredDashboard(nextDashboard);

    return NextResponse.json({
      ok: true,
      dashboard: nextDashboard,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Could not read the class planner file.';
    console.error('[api/teacher/pm3-planner] error:', err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
