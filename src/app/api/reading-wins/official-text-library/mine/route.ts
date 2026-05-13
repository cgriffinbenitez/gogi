import { execFile } from 'child_process';
import { NextRequest, NextResponse } from 'next/server';
import { promisify } from 'util';

export const runtime = 'nodejs';

const execFileAsync = promisify(execFile);

function cleanStandardCode(value: unknown) {
  const standard = typeof value === 'string' ? value.trim() : '';
  if (!/^ELA\.9\.[RV]\.[0-9]\.[0-9]$/.test(standard)) return null;
  return standard;
}

function cleanMaxPerText(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 2;
  return Math.max(1, Math.min(8, Math.floor(parsed)));
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      standard_code?: string;
      max_per_text?: number;
    };
    const standardCode = cleanStandardCode(body.standard_code);
    if (!standardCode) {
      return NextResponse.json(
        { ok: false, error: 'Choose a valid Grade 9 ELA standard before mining.' },
        { status: 400 }
      );
    }

    const maxPerText = cleanMaxPerText(body.max_per_text);
    const { stdout, stderr } = await execFileAsync(
      'npm',
      [
        'run',
        'library:mine-official',
        '--',
        '--standard',
        standardCode,
        '--max-per-text',
        String(maxPerText),
      ],
      {
        cwd: process.cwd(),
        env: process.env,
        maxBuffer: 1024 * 1024 * 3,
        timeout: 120_000,
      }
    );

    const insertedMatch = stdout.match(/Inserted:\s+([0-9]+)/i);
    const consideredMatch = stdout.match(/Candidate rows considered:\s+([0-9]+)/i);
    const duplicateMatch = stdout.match(/Duplicates skipped:\s+([0-9]+)/i);
    const errorMatch = stdout.match(/Errors:\s+([0-9]+)/i);

    return NextResponse.json({
      ok: true,
      standard_code: standardCode,
      max_per_text: maxPerText,
      considered_count: consideredMatch ? Number(consideredMatch[1]) : null,
      inserted_count: insertedMatch ? Number(insertedMatch[1]) : null,
      duplicate_count: duplicateMatch ? Number(duplicateMatch[1]) : null,
      error_count: errorMatch ? Number(errorMatch[1]) : null,
      message: `${standardCode}: mined official stored texts into the content library.`,
      stdout,
      stderr,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Official text mining failed.';
    console.error('[api/reading-wins/official-text-library/mine] error:', err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
