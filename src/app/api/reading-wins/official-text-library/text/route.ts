import fs from 'fs/promises';
import path from 'path';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

const ROOT = process.cwd();
const MANIFEST_PATH = path.join(ROOT, 'data', 'official-text-library', 'manifest.json');
const TEXT_ROOT = path.join(ROOT, 'data', 'official-text-library', 'texts');
const MANUAL_UPLOAD_DIR = path.join(ROOT, 'data', 'official-text-library', 'manual-uploads');
const MANUAL_UPLOAD_MANIFEST_PATH = path.join(MANUAL_UPLOAD_DIR, 'manifest.json');

type OfficialTextLibraryEntry = {
  title: string;
  author: string | null;
  status: string;
  text_path: string | null;
  word_count: number;
  standards: string[];
};

type ManualTextRow = {
  source_title: string | null;
  source_author: string | null;
  paragraph_text: string | null;
  word_count: number | null;
  created_at: string | null;
};

type OfficialTextLibraryManifest = {
  entries: OfficialTextLibraryEntry[];
};

type ManualUploadManifestEntry = {
  key: string;
  title: string;
  author: string | null;
  year: number | null;
  word_count: number;
  char_count: number;
  path: string;
  updated_at: string;
};

type ManualUploadManifest = {
  entries: ManualUploadManifestEntry[];
};

type TextSection = {
  id: string;
  label: string;
  startLine: number;
  endLine: number;
  wordCount: number;
  preview: string;
  content: string;
};

function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

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

  return process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
}

function countWords(value: string) {
  return value.trim().split(/\s+/).filter(Boolean).length;
}

function isLikelySectionHeading(line: string) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.length > 110) return false;
  if (/^[a-z]/.test(trimmed)) return false;
  if (/^(BOOK|CHAPTER|ACT|PART)\s+([IVXLCDM]+|\d+)\.?$/i.test(trimmed)) return true;
  if (/^SCENE\s+([IVXLCDM]+|\d+)\b/i.test(trimmed)) return true;
  if (/^(PREFACE|PROLOGUE|EPILOGUE|CONTENTS|FOOTNOTES|DRAMATIS PERSON)/i.test(trimmed)) return true;
  if (/^(THE\s+[A-Z][A-Z\s,'-]{3,}|SPEECH\s+AT\b|DELIVERED\b|CORRESPONDENCE\b|FIRST\s+JOINT\s+DEBATE|SECOND\s+JOINT\s+DEBATE|THIRD\s+JOINT\s+DEBATE|FOURTH\s+JOINT\s+DEBATE|FIFTH\s+JOINT\s+DEBATE|SIXTH\s+JOINT\s+DEBATE|SEVENTH\s+JOINT\s+DEBATE)\b/.test(trimmed)) return true;
  if (/^[A-Z][a-z]+\s+\d{1,2},\s+\d{4}\.?$/.test(trimmed)) return true;
  return false;
}

function fallbackSections(text: string): TextSection[] {
  const words = text.split(/\s+/).filter(Boolean);
  const chunkSize = 1200;
  const sections: TextSection[] = [];
  for (let start = 0; start < words.length; start += chunkSize) {
    const chunk = words.slice(start, start + chunkSize).join(' ');
    sections.push({
      id: `chunk-${sections.length + 1}`,
      label: `Chunk ${sections.length + 1}`,
      startLine: 1,
      endLine: 1,
      wordCount: countWords(chunk),
      preview: chunk.slice(0, 180),
      content: chunk,
    });
  }
  return sections;
}

function buildTextSections(text: string): TextSection[] {
  const lines = text.split(/\r?\n/);
  const headingIndexes: Array<{ index: number; label: string }> = [];

  lines.forEach((line, index) => {
    if (isLikelySectionHeading(line)) {
      const label = line.trim().replace(/\s+/g, ' ');
      const previous = headingIndexes[headingIndexes.length - 1];
      if (!previous || previous.label !== label) headingIndexes.push({ index, label });
    }
  });

  const usefulHeadings = headingIndexes.filter((heading, index) => {
    const next = headingIndexes[index + 1]?.index ?? lines.length;
    return next - heading.index > 3;
  });

  if (usefulHeadings.length < 2) return fallbackSections(text);

  const sections = usefulHeadings.map((heading, index) => {
    const nextIndex = usefulHeadings[index + 1]?.index ?? lines.length;
    const content = lines.slice(heading.index, nextIndex).join('\n').trim();
    return {
      id: `section-${index + 1}`,
      label: heading.label,
      startLine: heading.index + 1,
      endLine: nextIndex,
      wordCount: countWords(content),
      preview: content.replace(/\s+/g, ' ').slice(0, 180),
      content,
    };
  });

  const meaningfulSections = sections.filter((section) => section.wordCount >= 80);
  return meaningfulSections.length >= 2 ? meaningfulSections : fallbackSections(text);
}

async function loadArchivedManualText(title: string) {
  try {
    const raw = await fs.readFile(MANUAL_UPLOAD_MANIFEST_PATH, 'utf8');
    const manifest = JSON.parse(raw) as ManualUploadManifest;
    const entries = Array.isArray(manifest.entries) ? manifest.entries : [];
    const entry = entries.find((item) => normalize(item.title) === title);
    if (!entry?.path) return null;

    const fullPath = path.resolve(ROOT, entry.path);
    const relativeToManualRoot = path.relative(MANUAL_UPLOAD_DIR, fullPath);
    if (relativeToManualRoot.startsWith('..') || path.isAbsolute(relativeToManualRoot)) {
      throw new Error('Manual upload text path is outside the source library.');
    }

    const text = await fs.readFile(fullPath, 'utf8');
    return {
      title: entry.title,
      author: entry.author,
      wordCount: entry.word_count || countWords(text),
      standards: [],
      path: entry.path,
      sourceKind: 'manual_upload_full',
      content: text,
      sections: buildTextSections(text),
    };
  } catch (err) {
    const code = typeof err === 'object' && err && 'code' in err ? String(err.code) : '';
    if (code === 'ENOENT') return null;
    throw err;
  }
}

async function loadManualUploadText(title: string) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !getSupabaseApiKey()) return null;

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, getSupabaseApiKey());
  const { data, error } = await supabase
    .from('intervention_passages')
    .select('source_title, source_author, paragraph_text, word_count, created_at')
    .eq('source', 'manual_rights')
    .not('source_title', 'is', null)
    .order('created_at', { ascending: true })
    .limit(3000);

  if (error) throw new Error(error.message);

  const matchingRows = ((data ?? []) as ManualTextRow[]).filter(
    (row) => normalize(row.source_title ?? '') === title && row.paragraph_text?.trim()
  );

  if (!matchingRows.length) return null;

  const seen = new Set<string>();
  const chunks: string[] = [];
  for (const row of matchingRows) {
    const chunk = row.paragraph_text?.trim();
    if (!chunk) continue;
    const key = chunk.slice(0, 180).toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    chunks.push(chunk);
  }

  const content = chunks.join('\n\n');
  const wordCount = countWords(content);
  const sourceTitle = matchingRows[0]?.source_title?.trim() || 'Manual upload';
  const sourceAuthor = matchingRows[0]?.source_author?.trim() || null;

  return {
    title: sourceTitle,
    author: sourceAuthor,
    wordCount,
    standards: [],
    path: null,
    sourceKind: 'manual_upload',
    content,
    sections: buildTextSections(content),
  };
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const title = normalize(url.searchParams.get('title') ?? '');
    if (!title) {
      return NextResponse.json({ ok: false, error: 'Missing text title.' }, { status: 400 });
    }

    const raw = await fs.readFile(MANIFEST_PATH, 'utf8');
    const manifest = JSON.parse(raw) as OfficialTextLibraryManifest;
    const entry = manifest.entries.find((item) => normalize(item.title) === title);

    if (!entry || entry.status !== 'stored' || !entry.text_path) {
      const archivedManualText = await loadArchivedManualText(title);
      if (archivedManualText) {
        return NextResponse.json({ ok: true, text: archivedManualText });
      }

      const manualText = await loadManualUploadText(title);
      if (manualText) {
        return NextResponse.json({ ok: true, text: manualText });
      }
      return NextResponse.json({ ok: false, error: 'GOGI does not have a stored full text for this item yet.' }, { status: 404 });
    }

    const fullPath = path.resolve(ROOT, entry.text_path);
    const relativeToTextRoot = path.relative(TEXT_ROOT, fullPath);
    if (relativeToTextRoot.startsWith('..') || path.isAbsolute(relativeToTextRoot)) {
      return NextResponse.json({ ok: false, error: 'Text path is outside the official library.' }, { status: 400 });
    }

    const text = await fs.readFile(fullPath, 'utf8');
    const sections = buildTextSections(text);
    return NextResponse.json({
      ok: true,
      text: {
        title: entry.title,
        author: entry.author,
        wordCount: entry.word_count,
        standards: entry.standards,
        path: entry.text_path,
        sourceKind: 'official_file',
        content: text,
        sections,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Could not load the full text.';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
