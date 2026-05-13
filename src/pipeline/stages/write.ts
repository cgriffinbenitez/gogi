import fs from 'fs';
import { createClient } from '@supabase/supabase-js';
import type { CSVRow, PassageRow, PassageRowV3, WriteResult } from '../types';

// ─── Supabase client ──────────────────────────────────────────────────────────

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const key =
    serviceRole &&
    (serviceRole.startsWith('eyJ') ||
      serviceRole.startsWith('sb_secret_') ||
      serviceRole.length > 80)
      ? serviceRole
      : process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error(
      '[write] Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY / NEXT_PUBLIC_SUPABASE_ANON_KEY'
    );
  }
  return createClient(url, key);
}

// ─── Duplicate check (v2) ─────────────────────────────────────────────────────

export async function isDuplicate(gutenbergId: number, hash: string): Promise<boolean> {
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
  interventionTier: number
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
    if (
      /standard_code|coverage_strand_id|coverage_strand_label|coverage_strand_signals/i.test(
        error.message
      )
    ) {
      const {
        standard_code: _standardCode,
        coverage_strand_id: _coverageStrandId,
        coverage_strand_label: _coverageStrandLabel,
        coverage_strand_signals: _coverageStrandSignals,
        ...legacyRow
      } = row;
      const retry = await supabase.from('intervention_passages').insert([legacyRow]);
      if (!retry.error) return { status: 'inserted' };
      if (retry.error.code === '23505') return { status: 'duplicate' };
      return { status: 'error', error: retry.error.message };
    }
    if (error.code === '23505') return { status: 'duplicate' };
    return { status: 'error', error: error.message };
  }
  return { status: 'inserted' };
}

export async function attachStandardMetadataToExistingPassage(
  row: PassageRowV3
): Promise<WriteResult> {
  const supabase = getSupabase();
  const updates = {
    classification: row.classification,
    standard_code: row.standard_code,
    coverage_strand_id: row.coverage_strand_id,
    coverage_strand_label: row.coverage_strand_label,
    coverage_strand_signals: row.coverage_strand_signals,
    target_signal: row.target_signal,
    item_patterns_supported: row.item_patterns_supported,
    dominant_concept: row.dominant_concept,
    plausible_distractors: row.plausible_distractors,
    craft_features: row.craft_features,
    discrimination_item_type: row.discrimination_item_type,
    intervention_tier: row.intervention_tier,
    tagger_tier: row.tagger_tier,
    word_count_tier: row.word_count_tier,
    tier_rationale: row.tier_rationale,
    q5_flag_5e_compatible: row.q5_flag_5e_compatible,
    approval_status: row.approval_status,
  };

  const { error } = await supabase
    .from('intervention_passages')
    .update(updates)
    .eq('source_gutenberg_id', row.source_gutenberg_id)
    .eq('paragraph_hash', row.paragraph_hash);

  if (error) {
    if (
      /standard_code|coverage_strand_id|coverage_strand_label|coverage_strand_signals/i.test(
        error.message
      )
    ) {
      return { status: 'duplicate' };
    }
    return { status: 'error', error: error.message };
  }

  return { status: 'updated_existing' };
}

// ── Tier counts (cumulative across scoped runs — used for harvest targets) ─────

export type HarvestCountScope = {
  standardCode?: string;
  coverageStrandId?: string;
};

function isCoverageColumnMissing(message: string): boolean {
  return /standard_code|coverage_strand_id/i.test(message);
}

export async function fetchTierCounts(
  classification: string,
  scope: HarvestCountScope = {}
): Promise<Record<'T1' | 'T2' | 'T3' | 'T4', number>> {
  const supabase = getSupabase();
  const counts: Record<'T1' | 'T2' | 'T3' | 'T4', number> = { T1: 0, T2: 0, T3: 0, T4: 0 };

  let query = supabase
    .from('intervention_passages')
    .select('intervention_tier')
    .eq('classification', classification)
    .in('approval_status', ['pending_review', 'approved']);

  if (scope.standardCode) query = query.eq('standard_code', scope.standardCode);
  if (scope.coverageStrandId) query = query.eq('coverage_strand_id', scope.coverageStrandId);

  let { data, error } = await query;

  if (error && isCoverageColumnMissing(error.message)) {
    const retry = await supabase
      .from('intervention_passages')
      .select('intervention_tier')
      .eq('classification', classification)
      .in('approval_status', ['pending_review', 'approved']);
    data = retry.data;
    error = retry.error;
  }

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
  scope: HarvestCountScope = {}
): Promise<{ authorCounts: Map<string, number>; bookCounts: Map<number, number> }> {
  const supabase = getSupabase();

  let query = supabase
    .from('intervention_passages')
    .select('source_author, source_gutenberg_id')
    .eq('classification', classification)
    .in('approval_status', ['pending_review', 'approved']);

  if (scope.standardCode) query = query.eq('standard_code', scope.standardCode);
  if (scope.coverageStrandId) query = query.eq('coverage_strand_id', scope.coverageStrandId);

  let { data, error } = await query;

  if (error && isCoverageColumnMissing(error.message)) {
    const retry = await supabase
      .from('intervention_passages')
      .select('source_author, source_gutenberg_id')
      .eq('classification', classification)
      .in('approval_status', ['pending_review', 'approved']);
    data = retry.data;
    error = retry.error;
  }

  const authorCounts = new Map<string, number>();
  const bookCounts = new Map<number, number>();
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
  'classification',
  'gutenberg_id',
  'title',
  'author',
  'paragraph_text',
  'word_count',
  'paragraph_count',
  'suitable',
  'reasoning',
  'canonical_answer',
  'distractors',
  'keyword_flags',
  'difficulty_tier',
  'tier',
  'pipeline_version',
  'status',
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
