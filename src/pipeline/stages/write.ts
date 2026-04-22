import fs from 'fs';
import { createClient } from '@supabase/supabase-js';
import type { CSVRow, PassageRow, PassageRowV3, WriteResult } from '../types';

// ─── Supabase client ──────────────────────────────────────────────────────────

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error(
      '[write] Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY / NEXT_PUBLIC_SUPABASE_ANON_KEY',
    );
  }
  return createClient(url, key);
}

// ─── Duplicate check (v2) ─────────────────────────────────────────────────────

export async function isDuplicate(
  gutenbergId: number,
  hash: string,
): Promise<boolean> {
  const supabase = getSupabase();
  const { data } = await supabase
    .from('intervention_passages')
    .select('id')
    .eq('source_gutenberg_id', gutenbergId)
    .eq('paragraph_hash', hash)
    .maybeSingle();
  return data !== null;
}

// ─── Duplicate check (v3 — tier-aware) ───────────────────────────────────────

export async function isDuplicateV3(
  gutenbergId: number,
  hash: string,
  interventionTier: number,
): Promise<boolean> {
  const supabase = getSupabase();
  const { data } = await supabase
    .from('intervention_passages')
    .select('id')
    .eq('source_gutenberg_id', gutenbergId)
    .eq('paragraph_hash', hash)
    .eq('intervention_tier', interventionTier)
    .maybeSingle();
  return data !== null;
}

// ─── DB insert (v2) ───────────────────────────────────────────────────────────

export async function writePassage(row: PassageRow): Promise<WriteResult> {
  const supabase = getSupabase();
  const { error } = await supabase.from('intervention_passages').insert([row]);

  if (error) {
    // unique violation = duplicate
    if (error.code === '23505') return { status: 'duplicate' };
    return { status: 'error', error: error.message };
  }
  return { status: 'inserted' };
}

// ─── DB insert (v3) ───────────────────────────────────────────────────────────

export async function writePassageV3(row: PassageRowV3): Promise<WriteResult> {
  const supabase = getSupabase();
  const { error } = await supabase.from('intervention_passages').insert([row]);

  if (error) {
    if (error.code === '23505') return { status: 'duplicate' };
    return { status: 'error', error: error.message };
  }
  return { status: 'inserted' };
}

// ─── CSV ──────────────────────────────────────────────────────────────────────

function escapeCSV(val: string | number | null | undefined): string {
  if (val === null || val === undefined) return '';
  const s = String(val);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

const CSV_HEADERS = [
  'classification', 'gutenberg_id', 'title', 'author',
  'paragraph_text', 'word_count', 'paragraph_count', 'suitable', 'reasoning',
  'canonical_answer', 'distractors', 'keyword_flags',
  'difficulty_tier', 'tier', 'pipeline_version', 'status',
];

export function initCSV(csvPath: string) {
  if (!fs.existsSync(csvPath)) {
    fs.writeFileSync(csvPath, CSV_HEADERS.join(',') + '\n', 'utf8');
  }
}

export function appendCSV(csvPath: string, row: CSVRow) {
  const line = [
    escapeCSV(row.classification),
    escapeCSV(row.gutenberg_id),
    escapeCSV(row.title),
    escapeCSV(row.author),
    escapeCSV(row.paragraph_text),
    escapeCSV(row.word_count),
    escapeCSV(row.paragraph_count ?? 1),
    escapeCSV(String(row.suitable)),
    escapeCSV(row.reasoning),
    escapeCSV(row.canonical_answer),
    escapeCSV(row.distractors),
    escapeCSV(row.keyword_flags),
    escapeCSV(row.difficulty_tier),
    escapeCSV(row.tier ?? ''),
    escapeCSV(row.pipeline_version ?? 'v2'),
    escapeCSV(row.status),
  ].join(',');
  fs.appendFileSync(csvPath, line + '\n', 'utf8');
}
