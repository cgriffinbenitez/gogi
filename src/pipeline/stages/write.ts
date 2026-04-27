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

// ── Tier counts (cumulative across all runs — used for harvest targets) ────────

export async function fetchTierCounts(
  classification: string,
): Promise<Record<'T1' | 'T2' | 'T3' | 'T4', number>> {
  const supabase = getSupabase();
  const counts: Record<'T1' | 'T2' | 'T3' | 'T4', number> = { T1: 0, T2: 0, T3: 0, T4: 0 };
  const { data, error } = await supabase
    .from('intervention_passages')
    .select('intervention_tier')
    .eq('classification', classification)
    .in('approval_status', ['pending_review', 'approved']);
  if (error || !data) return counts;
  for (const row of data) {
    const key = `T${row.intervention_tier}` as 'T1' | 'T2' | 'T3' | 'T4';
    if (key in counts) counts[key]++;
  }
  return counts;
}

// ── Diversity counts (one query — shared by pre-fetch check and Phase 2 caps) ─

export async function fetchDiversityCounts(
  classification: string,
): Promise<{ authorCounts: Map<string, number>; bookCounts: Map<number, number> }> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('intervention_passages')
    .select('source_author, source_gutenberg_id')
    .eq('classification', classification)
    .in('approval_status', ['pending_review', 'approved']);

  const authorCounts = new Map<string, number>();
  const bookCounts   = new Map<number, number>();
  if (error || !data) return { authorCounts, bookCounts };

  for (const row of data) {
    if (row.source_author) {
      authorCounts.set(row.source_author, (authorCounts.get(row.source_author) ?? 0) + 1);
    }
    if (row.source_gutenberg_id != null) {
      bookCounts.set(row.source_gutenberg_id, (bookCounts.get(row.source_gutenberg_id) ?? 0) + 1);
    }
  }
  return { authorCounts, bookCounts };
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
