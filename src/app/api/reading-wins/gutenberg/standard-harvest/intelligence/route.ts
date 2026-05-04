import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';

export const runtime = 'nodejs';

const LOG_DIR = path.join('/tmp', 'gogi-standard-harvest');

type CsvRecord = {
  title?: string;
  author?: string;
  suitable?: string;
  reasoning?: string;
  status?: string;
};

function standardLogPrefix(standardCode: string) {
  return standardCode.replace(/\./g, '-');
}

function latestLogForStandard(standardCode: string) {
  if (!fs.existsSync(LOG_DIR)) return null;
  const prefix = standardLogPrefix(standardCode);
  const logs = fs
    .readdirSync(LOG_DIR)
    .filter((file) => file.startsWith(prefix) && file.endsWith('.log'))
    .map((file) => {
      const logPath = path.join(LOG_DIR, file);
      const stat = fs.statSync(logPath);
      return { file, logPath, modifiedAt: stat.mtimeMs };
    })
    .sort((a, b) => b.modifiedAt - a.modifiedAt);
  return logs[0] ?? null;
}

function extractCsvPath(log: string) {
  return log.match(/\[CSV\] writing to ([^\n]+)/)?.[1]?.trim() ?? null;
}

function rejectionBucket(reasoning: string) {
  const text = reasoning.toLowerCase();
  if (text.includes('q1') || text.includes('presence fail') || text.includes('no meaningful')) {
    return 'target signal missing';
  }
  if (text.includes('q2') || text.includes('dominance')) {
    return 'target not dominant';
  }
  if (text.includes('q3') || text.includes('schema') || text.includes('outside knowledge')) {
    return 'schema or context gated';
  }
  if (text.includes('q4') || text.includes('overload')) {
    return 'cognitive overload';
  }
  if (text.includes('q5') || text.includes('evidence density') || text.includes('item pattern')) {
    return 'not enough item evidence';
  }
  return 'other rejection';
}

function recommendationForBook(book: {
  title: string;
  total: number;
  suitable: number;
  errors: number;
}) {
  const yieldRate = book.total ? book.suitable / book.total : 0;
  if (book.errors > 0) return 'Recover failed writes after key/schema fix.';
  if (book.total >= 15 && yieldRate === 0) return 'De-prioritize for this strand.';
  if (book.total >= 15 && yieldRate < 0.08) return 'Use sparingly; low-yield source.';
  if (yieldRate >= 0.2) return 'Promote as a strong source candidate.';
  if (book.suitable > 0) return 'Keep testing; some strand fit found.';
  return 'Not enough data yet.';
}

export async function GET(req: NextRequest) {
  try {
    const standardCode = new URL(req.url).searchParams.get('standard_code') ?? '';
    if (!standardCode.trim()) {
      return NextResponse.json({ error: 'standard_code required.' }, { status: 400 });
    }

    const latest = latestLogForStandard(standardCode);
    if (!latest) return NextResponse.json({ ok: true, intelligence: null });

    const log = fs.readFileSync(latest.logPath, 'utf8');
    const csvPath = extractCsvPath(log);
    const records: CsvRecord[] =
      csvPath && fs.existsSync(csvPath)
        ? parse(fs.readFileSync(csvPath, 'utf8'), {
            columns: true,
            skip_empty_lines: true,
          })
        : [];

    const byBook = new Map<
      string,
      {
        title: string;
        author: string;
        total: number;
        suitable: number;
        rejected: number;
        errors: number;
      }
    >();
    const rejectionBuckets = new Map<string, number>();

    for (const row of records) {
      const title = row.title || 'Unknown source';
      const current = byBook.get(title) ?? {
        title,
        author: row.author || 'Unknown author',
        total: 0,
        suitable: 0,
        rejected: 0,
        errors: 0,
      };
      current.total += 1;
      if (row.suitable === 'true' || row.suitable === 'True') current.suitable += 1;
      if (row.status === 'rejected_by_filter') current.rejected += 1;
      if (row.status === 'error') current.errors += 1;
      byBook.set(title, current);

      if (row.status === 'rejected_by_filter') {
        const bucket = rejectionBucket(row.reasoning ?? '');
        rejectionBuckets.set(bucket, (rejectionBuckets.get(bucket) ?? 0) + 1);
      }
    }

    const books = [...byBook.values()]
      .map((book) => ({
        ...book,
        yield_rate: book.total ? book.suitable / book.total : 0,
        recommendation: recommendationForBook(book),
      }))
      .sort((a, b) => b.suitable - a.suitable || b.total - a.total);

    const totals = {
      candidates_seen: records.length,
      suitable: records.filter((row) => row.suitable === 'true' || row.suitable === 'True').length,
      rejected: records.filter((row) => row.status === 'rejected_by_filter').length,
      write_errors: records.filter((row) => row.status === 'error').length,
      inserted: records.filter((row) => row.status === 'inserted').length,
    };

    return NextResponse.json({
      ok: true,
      intelligence: {
        log_path: latest.logPath,
        csv_path: csvPath,
        totals,
        books,
        rejection_buckets: [...rejectionBuckets.entries()]
          .map(([label, count]) => ({ label, count }))
          .sort((a, b) => b.count - a.count),
        recommendations: [
          totals.write_errors > 0
            ? `${totals.write_errors} accepted/tagged rows hit write errors. Recover these from the CSV after the key fix.`
            : null,
          books.some((book) => book.recommendation.includes('strong'))
            ? 'Keep high-yield books in the source pool for this strand.'
            : null,
          books.some((book) => book.recommendation.includes('De-prioritize'))
            ? 'Move zero-yield books lower for this strand before scaling.'
            : null,
        ].filter(Boolean),
      },
    });
  } catch (err) {
    console.error('[api/reading-wins/gutenberg/standard-harvest/intelligence] error:', err);
    const message = err instanceof Error ? err.message : 'Could not analyze harvest intelligence.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
