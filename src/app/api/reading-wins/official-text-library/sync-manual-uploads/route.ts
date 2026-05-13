import fs from 'fs/promises';
import path from 'path';
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

const ROOT = process.cwd();
const MANUAL_UPLOAD_DIR = path.join(ROOT, 'data', 'official-text-library', 'manual-uploads');
const MANUAL_UPLOAD_MANIFEST_PATH = path.join(MANUAL_UPLOAD_DIR, 'manifest.json');

type ManualUploadManifestEntry = {
  key: string;
  title: string;
  author: string | null;
  year?: number | null;
  word_count: number;
  char_count: number;
  path: string;
  updated_at?: string;
  synced_at?: string;
  sync_source?: 'supabase_manual_rights';
};

type ManualUploadManifest = {
  generated_at: string;
  entries: ManualUploadManifestEntry[];
};

type ManualRightsRow = {
  source_title: string | null;
  source_author: string | null;
  paragraph_text: string | null;
  word_count: number | null;
  created_at: string | null;
};

function getSupabaseApiKey() {
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (
    serviceRole &&
    (serviceRole.startsWith('eyJ') ||
      serviceRole.startsWith('sb_secret_') ||
      serviceRole.length > 80)
  ) {
    return serviceRole;
  }

  return process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
}

function wordCount(value: string) {
  return value.trim().split(/\s+/).filter(Boolean).length;
}

function normalizeTitle(value: string | null | undefined) {
  return (value ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function slugify(value: string) {
  return (
    value
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 100) || 'manual-upload'
  );
}

function cleanChunk(value: string) {
  return value
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\f/g, '\n')
    .replace(/([A-Za-z])-\n([a-z])/g, '$1$2')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

async function readManualUploadManifest(): Promise<ManualUploadManifest> {
  try {
    const raw = await fs.readFile(MANUAL_UPLOAD_MANIFEST_PATH, 'utf8');
    const parsed = JSON.parse(raw) as ManualUploadManifest;
    return {
      generated_at: parsed.generated_at ?? new Date().toISOString(),
      entries: Array.isArray(parsed.entries) ? parsed.entries : [],
    };
  } catch {
    return { generated_at: new Date().toISOString(), entries: [] };
  }
}

export async function POST() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = getSupabaseApiKey();

  if (!url || !key) {
    return NextResponse.json(
      {
        ok: false,
        error: 'Supabase is not configured for this environment.',
      },
      { status: 500 }
    );
  }

  try {
    const supabase = createClient(url, key);
    const { data, error } = await supabase
      .from('intervention_passages')
      .select('source_title, source_author, paragraph_text, word_count, created_at')
      .eq('source', 'manual_rights')
      .not('source_title', 'is', null)
      .order('created_at', { ascending: true })
      .limit(20000);

    if (error) throw new Error(error.message);

    const grouped = new Map<
      string,
      {
        title: string;
        author: string | null;
        chunks: string[];
        seen: Set<string>;
      }
    >();

    for (const row of (data ?? []) as ManualRightsRow[]) {
      const title = row.source_title?.trim();
      const chunk = cleanChunk(row.paragraph_text ?? '');
      if (!title || wordCount(chunk) < 20) continue;

      const author = row.source_author?.trim() || null;
      const groupKey = `${normalizeTitle(title)}::${normalizeTitle(author)}`;
      const group = grouped.get(groupKey) ?? {
        title,
        author,
        chunks: [],
        seen: new Set<string>(),
      };
      const chunkKey = chunk.slice(0, 220).toLowerCase();
      if (!group.seen.has(chunkKey)) {
        group.seen.add(chunkKey);
        group.chunks.push(chunk);
      }
      grouped.set(groupKey, group);
    }

    await fs.mkdir(MANUAL_UPLOAD_DIR, { recursive: true });

    const existingManifest = await readManualUploadManifest();
    const existingByTitle = new Map(
      existingManifest.entries.map((entry) => [
        `${normalizeTitle(entry.title)}::${normalizeTitle(entry.author)}`,
        entry,
      ])
    );
    const syncedEntries: ManualUploadManifestEntry[] = [];
    const preservedEntries: ManualUploadManifestEntry[] = [];

    for (const group of grouped.values()) {
      const content = group.chunks.join('\n\n').trim();
      const count = wordCount(content);
      if (count < 40) continue;

      const groupKey = `${normalizeTitle(group.title)}::${normalizeTitle(group.author)}`;
      const existing = existingByTitle.get(groupKey);
      if (existing && existing.word_count > count * 1.25) {
        preservedEntries.push(existing);
        continue;
      }

      const key = slugify([group.title, group.author].filter(Boolean).join(' '));
      const filename = `${key}.txt`;
      const relativePath = path.join('data', 'official-text-library', 'manual-uploads', filename);
      await fs.writeFile(path.join(ROOT, relativePath), `${content}\n`, 'utf8');

      syncedEntries.push({
        key,
        title: group.title,
        author: group.author,
        word_count: count,
        char_count: content.length,
        path: relativePath,
        updated_at: new Date().toISOString(),
        synced_at: new Date().toISOString(),
        sync_source: 'supabase_manual_rights',
      });
    }

    const syncedKeys = new Set(
      [...syncedEntries, ...preservedEntries].map(
        (entry) => `${normalizeTitle(entry.title)}::${normalizeTitle(entry.author)}`
      )
    );
    const untouchedExisting = existingManifest.entries.filter(
      (entry) => !syncedKeys.has(`${normalizeTitle(entry.title)}::${normalizeTitle(entry.author)}`)
    );
    const nextEntries = [...syncedEntries, ...preservedEntries, ...untouchedExisting].sort((a, b) =>
      a.title.localeCompare(b.title)
    );

    await fs.writeFile(
      MANUAL_UPLOAD_MANIFEST_PATH,
      `${JSON.stringify({ generated_at: new Date().toISOString(), entries: nextEntries }, null, 2)}\n`,
      'utf8'
    );

    return NextResponse.json({
      ok: true,
      rows_read: (data ?? []).length,
      synced_texts: syncedEntries.length,
      preserved_full_texts: preservedEntries.length,
      total_manual_texts: nextEntries.length,
      titles: syncedEntries.map((entry) => entry.title),
    });
  } catch (err) {
    console.error('[api/reading-wins/official-text-library/sync-manual-uploads] error:', err);
    const message = err instanceof Error ? err.message : 'Could not sync manual uploads.';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
