import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { buildTeachingReadinessBoard } from '@/lib/teacher/pullOutSheet';

export const runtime = 'nodejs';

type ManualSourceRow = {
  source_title: string | null;
  standard_code: string | null;
  word_count: number | null;
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

  return process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
}

function normalizeTitle(value: string | null) {
  return (value ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

async function getManualUploadMap() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !getSupabaseApiKey()) {
    return new Map<string, number>();
  }

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, getSupabaseApiKey());
  const { data, error } = await supabase
    .from('intervention_passages')
    .select('source_title, standard_code, word_count')
    .in('source', ['manual_rights'])
    .not('source_title', 'is', null)
    .limit(2000);

  if (error) {
    console.warn('[api/teacher/teaching-readiness] manual upload lookup skipped:', error.message);
    return new Map<string, number>();
  }

  const map = new Map<string, number>();
  for (const row of (data ?? []) as ManualSourceRow[]) {
    const title = normalizeTitle(row.source_title);
    const standard = row.standard_code?.trim();
    if (!title || !standard) continue;
    const key = `${standard}::${title}`;
    map.set(key, Math.max(map.get(key) ?? 0, row.word_count ?? 0));
  }
  return map;
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const targetPerSkill = Number(url.searchParams.get('target') ?? 5);
    const maxStandards = Number(url.searchParams.get('max_standards') ?? 20);
    const board = await buildTeachingReadinessBoard({ targetPerSkill, maxStandards });
    const manualUploads = await getManualUploadMap();

    const enrichedBoard = {
      ...board,
      standards: board.standards.map((standard) => ({
        ...standard,
        availableTexts: standard.availableTexts.map((text) => {
          const key = `${standard.code}::${normalizeTitle(text.title)}`;
          const manualWordCount = manualUploads.get(key);
          if (!manualWordCount || text.hasLocalText) return text;
          return {
            ...text,
            status: 'manual_upload',
            wordCount: Math.max(text.wordCount, manualWordCount),
            hasLocalText: true,
            textPath: null,
          };
        }),
      })),
    };

    return NextResponse.json({ ok: true, board: enrichedBoard });
  } catch (error) {
    console.error('[api/teacher/teaching-readiness] error:', error);
    const message = error instanceof Error ? error.message : 'Could not build teaching readiness board.';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
