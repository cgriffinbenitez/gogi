import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const runtime = 'nodejs';

const LOG_DIR = path.join('/tmp', 'gogi-standard-harvest');

function standardLogPrefix(standardCode: string) {
  return standardCode.replace(/\./g, '-');
}

function inferStatus(log: string, modifiedAt: number) {
  if (/Standard harvest complete/i.test(log)) return 'complete';
  if (/\[pipeline\] fatal error|Error:|stopped:/i.test(log)) return 'failed';
  if (Date.now() - modifiedAt > 120_000) return 'quiet';
  if (/\[Stage 5\] inserted|Tagging and writing/i.test(log)) return 'writing';
  if (/\[filter\]/i.test(log)) return 'filtering';
  if (/\[Stage 1|searching author|downloading|cache hit/i.test(log)) return 'fetching';
  return 'starting';
}

export async function GET(req: NextRequest) {
  try {
    const standardCode = new URL(req.url).searchParams.get('standard_code') ?? '';
    if (!standardCode.trim()) {
      return NextResponse.json({ error: 'standard_code required.' }, { status: 400 });
    }

    if (!fs.existsSync(LOG_DIR)) {
      return NextResponse.json({ ok: true, latest: null });
    }

    const prefix = standardLogPrefix(standardCode);
    const candidates = fs
      .readdirSync(LOG_DIR)
      .filter((file) => file.startsWith(prefix) && file.endsWith('.log'))
      .map((file) => {
        const logPath = path.join(LOG_DIR, file);
        const stat = fs.statSync(logPath);
        return { file, logPath, modifiedAt: stat.mtimeMs, size: stat.size };
      })
      .sort((a, b) => b.modifiedAt - a.modifiedAt);

    const latest = candidates[0];
    if (!latest) return NextResponse.json({ ok: true, latest: null });

    const log = fs.readFileSync(latest.logPath, 'utf8');
    const lines = log.split(/\r?\n/).filter(Boolean);
    const tail = lines.slice(-36);

    return NextResponse.json({
      ok: true,
      latest: {
        file: latest.file,
        log_path: latest.logPath,
        modified_at: new Date(latest.modifiedAt).toISOString(),
        size: latest.size,
        status: inferStatus(log, latest.modifiedAt),
        tail,
      },
    });
  } catch (err) {
    console.error('[api/reading-wins/gutenberg/standard-harvest/status] error:', err);
    const message = err instanceof Error ? err.message : 'Could not load harvest status.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
