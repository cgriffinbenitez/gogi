import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import {
  buildOfficialExcerptInventory,
  officialExcerptInventoryMarkdown,
  type OfficialExcerptInventory,
} from '@/lib/teacher/officialExcerptInventory';

export const runtime = 'nodejs';

const INVENTORY_PATH = path.join(process.cwd(), 'data', 'official-text-library', 'teachable-excerpt-inventory.json');

async function loadSavedInventory() {
  try {
    return JSON.parse(await fs.readFile(INVENTORY_PATH, 'utf8')) as OfficialExcerptInventory;
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const format = url.searchParams.get('format') ?? 'json';
    const refresh = url.searchParams.get('refresh') === '1';
    const maxPerLane = Number(url.searchParams.get('maxPerLane') ?? '50');
    const savedInventory = refresh ? null : await loadSavedInventory();
    const inventory =
      savedInventory
        ? savedInventory
        : await buildOfficialExcerptInventory({
            maxPerTextStandardStrand: Number.isFinite(maxPerLane) ? maxPerLane : 50,
          });

    if (format === 'markdown' || format === 'md') {
      return new NextResponse(officialExcerptInventoryMarkdown(inventory), {
        headers: {
          'Content-Type': 'text/markdown; charset=utf-8',
          'Cache-Control': 'no-store',
          'Content-Disposition': 'inline; filename="gogi-official-excerpt-inventory.md"',
        },
      });
    }

    return NextResponse.json({ ok: true, inventory }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('[api/teacher/official-excerpt-inventory] error:', error);
    const message = error instanceof Error ? error.message : 'Could not build official excerpt inventory.';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
