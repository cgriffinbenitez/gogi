import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs/promises';
import path from 'path';
import {
  OFFICIAL_FAST_TEXT_MODELS,
  type OfficialEla9Benchmark,
  type OfficialFastPipelineUse,
} from '@/lib/reading-wins/officialFastSources';

export const runtime = 'nodejs';

const MANIFEST_PATH = path.join(process.cwd(), 'data', 'official-text-library', 'manifest.json');
const MANUAL_UPLOAD_MANIFEST_PATH = path.join(
  process.cwd(),
  'data',
  'official-text-library',
  'manual-uploads',
  'manifest.json'
);

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

type TextCoverageRow = {
  title: string;
  author: string | null;
  pipeline_use: OfficialFastPipelineUse;
  source_documents: string[];
  standards: OfficialEla9Benchmark[];
  uploaded_standards: string[];
  missing_standards: string[];
  uploaded_excerpt_count: number;
  stored_word_count: number;
  local_text_path: string | null;
  status: 'stored' | 'uploaded' | 'harvestable' | 'rights_needed' | 'style_model';
};

type OfficialTextLibraryManifest = {
  entries: Array<{
    title: string;
    author: string | null;
    status: string;
    text_path: string | null;
    word_count: number;
  }>;
};

type ManualUploadManifest = {
  entries: Array<{
    title: string;
    word_count: number;
    path: string;
  }>;
};

type StoredOfficialText = {
  status: string;
  word_count: number;
  text_path: string | null;
};

function keyFor(title: string, author?: string | null) {
  return `${title.trim().toLowerCase()}::${author?.trim().toLowerCase() ?? ''}`;
}

function titleKey(title: string | null | undefined) {
  return (title ?? '').trim().toLowerCase();
}

function bestPipelineUse(a: OfficialFastPipelineUse, b: OfficialFastPipelineUse) {
  if (a === 'priority_seed' || b === 'priority_seed') return 'priority_seed';
  if (a === 'style_model_only' || b === 'style_model_only') return 'style_model_only';
  return 'rights_limited_reference';
}

async function loadStoredOfficialTexts() {
  try {
    const manifest = JSON.parse(
      await fs.readFile(MANIFEST_PATH, 'utf8')
    ) as OfficialTextLibraryManifest;
    const stored = manifest.entries.reduce<Record<string, StoredOfficialText>>((map, entry) => {
      map[titleKey(entry.title)] = {
        status: entry.status,
        word_count: entry.word_count,
        text_path: entry.text_path,
      };
      return map;
    }, {});

    try {
      const manualManifest = JSON.parse(
        await fs.readFile(MANUAL_UPLOAD_MANIFEST_PATH, 'utf8')
      ) as ManualUploadManifest;
      for (const entry of manualManifest.entries ?? []) {
        const key = titleKey(entry.title);
        if (stored[key]?.status === 'stored') continue;
        stored[key] = {
          status: 'manual_upload',
          word_count: entry.word_count,
          text_path: entry.path,
        };
      }
    } catch {
      // No local full-text manual uploads archived yet.
    }

    return stored;
  } catch {
    return {};
  }
}

export async function GET() {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, getSupabaseApiKey());

  try {
    const { data, error } = await supabase
      .from('intervention_passages')
      .select('source_title, standard_code, approval_status')
      .eq('source', 'manual_rights')
      .limit(5000);

    if (error) throw new Error(error.message);

    const [uploadedByTitle, storedByTitle] = await Promise.all([
      Promise.resolve((data ?? []).reduce<
      Record<string, { standards: Set<string>; count: number }>
    >((map, row) => {
      if (row.approval_status === 'rejected') return map;
      const title = titleKey(row.source_title as string | null);
      const standard = String(row.standard_code ?? '').trim();
      if (!title || !standard) return map;
      const current = map[title] ?? { standards: new Set<string>(), count: 0 };
      current.standards.add(standard);
      current.count += 1;
      map[title] = current;
      return map;
    }, {})),
      loadStoredOfficialTexts(),
    ]);

    const byWork = new Map<string, TextCoverageRow>();
    for (const model of OFFICIAL_FAST_TEXT_MODELS) {
      const key = keyFor(model.title, model.author);
      const existing = byWork.get(key);
      if (!existing) {
        byWork.set(key, {
          title: model.title,
          author: model.author ?? null,
          pipeline_use: model.pipelineUse,
          source_documents: [model.sourceDocument],
          standards: [...model.standards],
          uploaded_standards: [],
          missing_standards: [],
          uploaded_excerpt_count: 0,
          stored_word_count: 0,
          local_text_path: null,
          status: 'rights_needed',
        });
        continue;
      }

      existing.pipeline_use = bestPipelineUse(existing.pipeline_use, model.pipelineUse);
      existing.source_documents = [...new Set([...existing.source_documents, model.sourceDocument])];
      existing.standards = [...new Set([...existing.standards, ...model.standards])];
    }

    const rows = [...byWork.values()]
      .map((row) => {
        const uploaded = uploadedByTitle[titleKey(row.title)];
        const stored = storedByTitle[titleKey(row.title)];
        const uploadedStandards = uploaded ? [...uploaded.standards] : [];
        const missingStandards = row.standards.filter(
          (standard) => !uploadedStandards.includes(standard)
        );
        const storedLocally = stored?.status === 'stored' || stored?.status === 'manual_upload';
        const sourceAttemptedButNotStored =
          stored && ['needs_upload', 'fetch_failed', 'needs_gutenberg_match'].includes(stored.status);
        const status: TextCoverageRow['status'] =
          storedLocally
            ? 'stored'
            : uploadedStandards.length > 0
            ? 'uploaded'
            : sourceAttemptedButNotStored
              ? 'rights_needed'
            : row.pipeline_use === 'priority_seed'
              ? 'harvestable'
              : row.pipeline_use === 'style_model_only'
                ? 'style_model'
                : 'rights_needed';

        return {
          ...row,
          uploaded_standards: uploadedStandards,
          missing_standards: missingStandards,
          uploaded_excerpt_count: uploaded?.count ?? 0,
          stored_word_count: storedLocally ? stored.word_count : 0,
          local_text_path: storedLocally ? stored.text_path : null,
          status,
        };
      })
      .sort((a, b) => {
        const rank: Record<TextCoverageRow['status'], number> = {
          rights_needed: 0,
          style_model: 1,
          harvestable: 2,
          uploaded: 3,
          stored: 4,
        };
        const diff = rank[a.status] - rank[b.status];
        return diff || a.title.localeCompare(b.title);
      });

    return NextResponse.json({
      ok: true,
      rows,
      totals: {
        texts: rows.length,
        stored: rows.filter((row) => row.status === 'stored').length,
        uploaded: rows.filter((row) => row.status === 'uploaded').length,
        harvestable: rows.filter((row) => row.status === 'harvestable').length,
        rights_needed: rows.filter((row) => row.status === 'rights_needed').length,
        style_model: rows.filter((row) => row.status === 'style_model').length,
      },
    });
  } catch (err) {
    console.error('[api/reading-wins/gutenberg/text-coverage] error:', err);
    const message = err instanceof Error ? err.message : 'Could not load text coverage.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
