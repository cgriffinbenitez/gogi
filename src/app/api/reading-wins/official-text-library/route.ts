import fs from 'fs/promises';
import path from 'path';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

const ROOT = process.cwd();
const MANIFEST_PATH = path.join(ROOT, 'data', 'official-text-library', 'manifest.json');
const MANUAL_UPLOAD_MANIFEST_PATH = path.join(
  ROOT,
  'data',
  'official-text-library',
  'manual-uploads',
  'manifest.json'
);

type OfficialTextLibraryEntry = {
  title: string;
  author: string | null;
  access: string;
  pipeline_use: string;
  source_documents: string[];
  standards: string[];
  gutenberg_ids: number[];
  discovered_gutenberg_id: number | null;
  status: 'stored' | 'manual_upload' | 'needs_upload' | 'reference_only' | 'needs_gutenberg_match' | 'fetch_failed';
  text_path: string | null;
  char_count: number;
  word_count: number;
  notes: string;
};

type OfficialTextLibraryManifest = {
  generated_at: string;
  scope: string;
  totals: {
    texts: number;
    stored: number;
    needs_upload: number;
    reference_only: number;
    fetch_failed: number;
    needs_gutenberg_match: number;
  };
  by_standard: Record<string, { stored: number; total: number; texts: string[] }>;
  entries: OfficialTextLibraryEntry[];
};

type ManualUploadManifest = {
  entries: Array<{
    title: string;
    author: string | null;
    word_count: number;
    char_count: number;
    path: string;
  }>;
};

function normalizeTitle(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

async function mergeArchivedManualUploads(manifest: OfficialTextLibraryManifest) {
  try {
    const raw = await fs.readFile(MANUAL_UPLOAD_MANIFEST_PATH, 'utf8');
    const manualManifest = JSON.parse(raw) as ManualUploadManifest;
    const manualByTitle = new Map(
      (manualManifest.entries ?? []).map((entry) => [normalizeTitle(entry.title), entry])
    );

    const entries = manifest.entries.map((entry) => {
      if (entry.status === 'stored') return entry;
      const manual = manualByTitle.get(normalizeTitle(entry.title));
      if (!manual) return entry;
      return {
        ...entry,
        author: manual.author || entry.author,
        status: 'manual_upload' as const,
        text_path: manual.path,
        char_count: manual.char_count || entry.char_count,
        word_count: manual.word_count || entry.word_count,
        notes: `${entry.notes} Local full-text manual upload is available for classroom use.`.trim(),
      };
    });

    const totals = {
      ...manifest.totals,
      stored: entries.filter((entry) => entry.status === 'stored').length,
      needs_upload: entries.filter((entry) => entry.status === 'needs_upload').length,
      reference_only: entries.filter((entry) => entry.status === 'reference_only').length,
      fetch_failed: entries.filter((entry) => entry.status === 'fetch_failed').length,
      needs_gutenberg_match: entries.filter((entry) => entry.status === 'needs_gutenberg_match').length,
      manual_upload: entries.filter((entry) => entry.status === 'manual_upload').length,
    };

    return { ...manifest, totals, entries };
  } catch {
    return manifest;
  }
}

export async function GET() {
  try {
    const raw = await fs.readFile(MANIFEST_PATH, 'utf8');
    const manifest = JSON.parse(raw) as OfficialTextLibraryManifest;
    const mergedManifest = await mergeArchivedManualUploads(manifest);

    return NextResponse.json({
      ok: true,
      manifest: mergedManifest,
    });
  } catch (err) {
    const message =
      err instanceof Error && 'code' in err && err.code === 'ENOENT'
        ? 'Official text library has not been built yet. Run npm run library:official-texts.'
        : err instanceof Error
          ? err.message
          : 'Could not load the official text library.';

    return NextResponse.json({ ok: false, error: message }, { status: 404 });
  }
}
