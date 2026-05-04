import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { getGutenbergStandardBlueprint } from '@/pipeline/standardBlueprints';

export const runtime = 'nodejs';

function numberBetween(value: unknown, fallback: number, min: number, max: number) {
  const parsed = Math.floor(Number(value));
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
}

function hasAnthropicKey() {
  return Boolean(process.env.ANTHROPIC_API_KEY && process.env.ANTHROPIC_API_KEY.length > 20);
}

export async function POST(req: NextRequest) {
  try {
    if (
      process.env.NODE_ENV === 'production' &&
      process.env.ALLOW_GUTENBERG_HARVEST_API !== 'true'
    ) {
      return NextResponse.json(
        {
          error:
            'Gutenberg harvest launching is disabled in production unless ALLOW_GUTENBERG_HARVEST_API=true.',
        },
        { status: 403 }
      );
    }

    const body = (await req.json().catch(() => ({}))) as {
      standard_code?: string;
      max?: number;
      max_books?: number;
      dry_run?: boolean;
    };

    const standardCode = body.standard_code?.trim();
    if (!standardCode) {
      return NextResponse.json({ error: 'standard_code required.' }, { status: 400 });
    }

    const blueprint = getGutenbergStandardBlueprint(standardCode);
    if (!blueprint) {
      return NextResponse.json(
        { error: `No Gutenberg blueprint configured for ${standardCode}.` },
        { status: 400 }
      );
    }

    if (!hasAnthropicKey()) {
      return NextResponse.json(
        {
          error:
            'ANTHROPIC_API_KEY is not configured, so GOGI cannot run the Claude filter/tag steps yet.',
        },
        { status: 400 }
      );
    }

    const max = numberBetween(body.max, 12, 1, 40);
    const maxBooks = numberBetween(body.max_books, 5, 1, 12);
    const dryRun = Boolean(body.dry_run);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const logDir = path.join('/tmp', 'gogi-standard-harvest');
    fs.mkdirSync(logDir, { recursive: true });
    const logPath = path.join(logDir, `${standardCode.replace(/\./g, '-')}-${timestamp}.log`);
    const out = fs.openSync(logPath, 'a');

    const args = [
      'run',
      'pipeline:standard',
      '--',
      '--standard',
      standardCode,
      '--max',
      String(max),
      '--max-books',
      String(maxBooks),
    ];
    if (dryRun) args.push('--dry-run');

    const child = spawn('npm', args, {
      cwd: process.cwd(),
      detached: true,
      env: process.env,
      stdio: ['ignore', out, out],
    });

    child.unref();

    return NextResponse.json({
      ok: true,
      pid: child.pid,
      log_path: logPath,
      standard_code: standardCode,
      classifications: blueprint.classifications,
      coverage_strands: blueprint.coverageStrands ?? [],
      message: `${standardCode} harvest started. Return to this page in a few minutes to review pending passages.`,
    });
  } catch (err) {
    console.error('[api/reading-wins/gutenberg/standard-harvest] error:', err);
    const message = err instanceof Error ? err.message : 'Could not start Gutenberg harvest.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
