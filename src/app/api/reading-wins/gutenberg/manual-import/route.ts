import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import { findOfficialFastTextModelsBySource } from '@/lib/reading-wins/officialFastSources';
import { getGutenbergStandardBlueprint } from '@/pipeline/standardBlueprints';
import { extractPassageUnits } from '@/pipeline/stages/extract';
import type { FetchedBook, TierKey } from '@/pipeline/types';

export const runtime = 'nodejs';

const ROOT = process.cwd();
const MANUAL_UPLOAD_DIR = path.join(ROOT, 'data', 'official-text-library', 'manual-uploads');
const MANUAL_UPLOAD_MANIFEST_PATH = path.join(MANUAL_UPLOAD_DIR, 'manifest.json');

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
  generated_at: string;
  entries: ManualUploadManifestEntry[];
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

function wordCount(value: string) {
  return value.trim().split(/\s+/).filter(Boolean).length;
}

function simpleHash(value: string) {
  let hash = 0;
  for (const char of value) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }
  return `manual-${hash.toString(16)}`;
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

type ManualUnit = {
  text: string;
  wordCount: number;
  paragraphCount: number;
  hash: string;
  tierKey: TierKey | null;
};

function normalizeManualText(value: string) {
  return value
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\f/g, '\n')
    .replace(/([A-Za-z])-\n([a-z])/g, '$1$2')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function cleanManualFullText(value: string) {
  return normalizeManualText(value)
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => {
      if (!line) return true;
      const letters = (line.match(/[A-Za-z]/g) ?? []).length;
      const digits = (line.match(/\d/g) ?? []).length;
      if (letters < 3 && digits > 0) return false;
      if (/^[\W\d_]{1,24}$/.test(line)) return false;
      if (/^(digitized by|internet archive|university of|library|copyright|all rights reserved)$/i.test(line)) {
        return false;
      }
      return true;
    })
    .join('\n')
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

async function saveManualSourceText(args: {
  title: string;
  author: string | null;
  year: number | null;
  text: string;
}) {
  const cleanedText = cleanManualFullText(args.text);
  if (!cleanedText) return null;

  await fs.mkdir(MANUAL_UPLOAD_DIR, { recursive: true });

  const key = slugify([args.title, args.author].filter(Boolean).join(' '));
  const filename = `${key}.txt`;
  const relativePath = path.join('data', 'official-text-library', 'manual-uploads', filename);
  const fullPath = path.join(ROOT, relativePath);

  await fs.writeFile(fullPath, `${cleanedText}\n`, 'utf8');

  const manifest = await readManualUploadManifest();
  const entry: ManualUploadManifestEntry = {
    key,
    title: args.title,
    author: args.author,
    year: args.year,
    word_count: wordCount(cleanedText),
    char_count: cleanedText.length,
    path: relativePath,
    updated_at: new Date().toISOString(),
  };

  const nextEntries = [
    entry,
    ...manifest.entries.filter((item) => item.key !== key && item.title.toLowerCase() !== args.title.toLowerCase()),
  ].sort((a, b) => a.title.localeCompare(b.title));

  await fs.writeFile(
    MANUAL_UPLOAD_MANIFEST_PATH,
    `${JSON.stringify({ generated_at: new Date().toISOString(), entries: nextEntries }, null, 2)}\n`,
    'utf8'
  );

  return entry;
}

function tierForWordCount(count: number): TierKey {
  if (count < 180) return 'T1';
  if (count < 260) return 'T2';
  if (count < 320) return 'T3';
  return 'T4';
}

function isUsableManualChunk(text: string) {
  const count = wordCount(text);
  if (count < 80 || count > 420) return false;
  const letters = (text.match(/[A-Za-z]/g) ?? []).length;
  return letters / Math.max(1, text.length) > 0.55;
}

function makeManualUnit(text: string, paragraphCount = 1): ManualUnit | null {
  const clean = text.replace(/\s+/g, ' ').trim();
  const count = wordCount(clean);
  if (!isUsableManualChunk(clean)) return null;
  return {
    text: clean,
    wordCount: count,
    paragraphCount,
    hash: simpleHash(clean),
    tierKey: tierForWordCount(count),
  };
}

function dedupeManualUnits(units: ManualUnit[]) {
  const seen = new Set<string>();
  const deduped: ManualUnit[] = [];
  for (const unit of units) {
    const key = unit.text.slice(0, 140).toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(unit);
  }
  return deduped.slice(0, 30);
}

function manualParagraphWindowUnits(text: string) {
  const paragraphs = cleanManualFullText(text)
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim())
    .filter((paragraph) => wordCount(paragraph) >= 25);
  const units: ManualUnit[] = [];

  for (let start = 0; start < paragraphs.length; start++) {
    for (let size = 1; size <= 4; size++) {
      const span = paragraphs.slice(start, start + size);
      if (span.length < size) continue;
      const unit = makeManualUnit(span.join('\n\n'), size);
      if (unit) units.push(unit);
    }
  }

  return dedupeManualUnits(units);
}

function manualSentenceFallbackUnits(text: string) {
  const normalized = cleanManualFullText(text)
    .replace(/\n+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const sentences = normalized.match(/[^.!?]+[.!?]["')\]]?/g) ?? [];
  const units: ManualUnit[] = [];
  let current: string[] = [];
  let currentWords = 0;

  for (const sentence of sentences) {
    const clean = sentence.trim();
    const sentenceWords = wordCount(clean);
    if (!clean || sentenceWords < 3) continue;

    if (currentWords >= 170 && currentWords + sentenceWords > 310) {
      const unit = makeManualUnit(current.join(' '), 1);
      if (unit) units.push(unit);
      current = [];
      currentWords = 0;
    }

    current.push(clean);
    currentWords += sentenceWords;
  }

  const finalUnit = makeManualUnit(current.join(' '), 1);
  if (finalUnit) units.push(finalUnit);

  return dedupeManualUnits(units);
}

function manualWordWindowUnits(text: string) {
  const words = cleanManualFullText(text).replace(/\n+/g, ' ').split(/\s+/).filter(Boolean);
  const units: ManualUnit[] = [];
  const chunkSize = 240;
  const stride = 220;

  for (let start = 0; start < words.length; start += stride) {
    const chunk = words.slice(start, start + chunkSize).join(' ');
    const unit = makeManualUnit(chunk, 1);
    if (unit) units.push(unit);
  }

  return dedupeManualUnits(units);
}

function selectedManualUnits(args: {
  text: string;
  title: string;
  author?: string | null;
  year?: number | null;
}) {
  const cleanedText = cleanManualFullText(args.text);
  const book: FetchedBook = {
    gutenbergId: 0,
    title: args.title,
    author: args.author ?? 'Rights-managed source',
    year: args.year ?? null,
    text: cleanedText,
  };
  const unitsByTier = extractPassageUnits(book);
  const tierOrder: TierKey[] = ['T1', 'T2', 'T3', 'T4'];
  const selected = tierOrder.flatMap((tierKey) =>
    unitsByTier[tierKey].slice(0, 4).map((unit) => ({ ...unit, tierKey }))
  );
  const paragraphUnits = selected.length ? [] : manualParagraphWindowUnits(cleanedText);
  const sentenceUnits = selected.length || paragraphUnits.length ? [] : manualSentenceFallbackUnits(cleanedText);
  const wordUnits =
    selected.length || paragraphUnits.length || sentenceUnits.length
      ? []
      : manualWordWindowUnits(cleanedText);
  const units = selected.length
    ? selected.slice(0, 30)
    : paragraphUnits.length
      ? paragraphUnits
      : sentenceUnits.length
        ? sentenceUnits
        : wordUnits;

  return {
    units,
    charsSkipped: args.text.length - cleanedText.length,
    usedFallback: selected.length === 0,
    fallbackMode: selected.length
      ? 'gutenberg_paragraphs'
      : paragraphUnits.length
        ? 'manual_paragraph_windows'
        : sentenceUnits.length
          ? 'manual_sentence_chunks'
          : wordUnits.length
            ? 'manual_word_windows'
            : 'none',
  };
}

export async function POST(req: NextRequest) {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, getSupabaseApiKey());

  try {
    const body = (await req.json().catch((err) => {
      const message = err instanceof Error ? err.message : 'Could not read import payload.';
      throw new Error(
        /body exceeded|request entity too large|payload too large|413/i.test(message)
          ? 'That text file is too large for the browser import box. Paste a chapter/excerpt, or split the full text into smaller parts.'
          : message
      );
    })) as {
      standard_code?: string;
      fallback_standard_code?: string;
      coverage_strand_id?: string;
      coverage_strand_label?: string;
      coverage_strand_signals?: string[];
      classification?: string;
      target_signal?: string;
      source_title?: string;
      source_author?: string;
      source_year?: number | null;
      paragraph_text?: string;
      rights_basis?: string;
      save_as_full_text?: boolean;
    };

    const paragraphText = body.paragraph_text?.trim() ?? '';
    const count = wordCount(paragraphText);

    if (!body.source_title?.trim()) {
      return NextResponse.json({ error: 'Source title is required.' }, { status: 400 });
    }
    if (!body.rights_basis?.trim()) {
      return NextResponse.json({ error: 'Rights/use basis is required.' }, { status: 400 });
    }
    if (count < 40) {
      return NextResponse.json(
        { error: 'Paste a teachable excerpt of at least 40 words.' },
        { status: 400 }
      );
    }

    const rightsNote = `Rights-managed manual import: ${body.rights_basis.trim()}`;
    const matchedOfficialTexts = findOfficialFastTextModelsBySource({
      sourceTitle: body.source_title,
      sourceAuthor: body.source_author,
    });
    const canonicalSourceTitle = matchedOfficialTexts[0]?.title ?? body.source_title!.trim();
    const canonicalSourceAuthor =
      body.source_author?.trim() || matchedOfficialTexts[0]?.author || null;
    const mappedStandards = [
      ...new Set(
        matchedOfficialTexts.flatMap((model) => model.standards).filter(Boolean)
      ),
    ];
    const officialMappedImport = mappedStandards.length > 0;
    const shouldArchiveFullText = Boolean(body.save_as_full_text) || count > 1200;
    const standardsToInsert = mappedStandards.length
      ? mappedStandards
      : [body.standard_code ?? body.fallback_standard_code].filter(
          (standard): standard is string => Boolean(standard?.trim())
        );

    if (!standardsToInsert.length) {
      return NextResponse.json(
        {
          error:
            'GOGI could not match that work to the official text map. Add it to the official registry or choose a fallback standard.',
        },
        { status: 400 }
      );
    }

    const archivedManualSource = shouldArchiveFullText
      ? await saveManualSourceText({
          title: canonicalSourceTitle,
          author: canonicalSourceAuthor,
          year: body.source_year ?? null,
          text: paragraphText,
        })
      : null;

    const extracted = shouldArchiveFullText
      ? selectedManualUnits({
          text: paragraphText,
          title: canonicalSourceTitle,
          author: canonicalSourceAuthor,
          year: body.source_year ?? null,
        })
      : {
          units: [
            {
              text: paragraphText,
              wordCount: count,
              paragraphCount: Math.max(1, paragraphText.split(/\n\s*\n/).filter(Boolean).length),
              hash: simpleHash(paragraphText),
              tierKey: null,
            },
          ],
          charsSkipped: 0,
          usedFallback: false,
          fallbackMode: 'single_excerpt',
        };

    if (!extracted.units.length) {
      return NextResponse.json(
        {
          error:
            'GOGI could not find clean teachable excerpts in that full text. Try pasting a cleaner text file or a smaller excerpt.',
        },
        { status: 400 }
      );
    }

    const rows = standardsToInsert.flatMap((standardCode) => {
      const blueprint = getGutenbergStandardBlueprint(standardCode);
      const requestedStrand = blueprint?.coverageStrands?.find(
        (strand) => strand.id === body.coverage_strand_id
      );

      return extracted.units.map((unit) => ({
        classification: officialMappedImport
          ? blueprint?.classifications?.[0] || body.classification?.trim() || 'manual_rights_import'
          : body.classification?.trim() || blueprint?.classifications?.[0] || 'manual_rights_import',
        standard_code: standardCode,
        coverage_strand_id: requestedStrand?.id ?? null,
        coverage_strand_label: requestedStrand?.label ?? null,
        coverage_strand_signals: requestedStrand?.harvestSignals ?? null,
        paragraph_text: unit.text,
        word_count: unit.wordCount,
        paragraph_count: unit.paragraphCount,
        source: 'manual_rights',
        source_title: canonicalSourceTitle,
        source_author: canonicalSourceAuthor,
        source_year: body.source_year ?? null,
        approved: false,
        paragraph_hash: simpleHash(
          `${standardCode}:${canonicalSourceTitle}:${unit.hash}:${unit.text.slice(0, 120)}`
        ),
        pipeline_version: 'manual_rights_v1',
        target_signal:
          (!officialMappedImport ? body.target_signal?.trim() : '') ||
          requestedStrand?.label ||
          blueprint?.teacherLabel ||
          'rights-managed excerpt',
        item_patterns_supported: ['manual_rights_import'],
        supporting_evidence: [],
        non_supporting_evidence: [],
        plausible_distractors: [],
        tier_rationale: `${rightsNote}${
          matchedOfficialTexts.length
            ? `; official text map matched ${matchedOfficialTexts
                .map((model) => model.title)
                .join(', ')}`
            : ''
        }${
          shouldArchiveFullText
            ? `; full text split into excerpt candidates; front matter stripped ${extracted.charsSkipped} chars`
            : ''
        }${
          extracted.usedFallback
            ? `; manual full-text chunker used ${extracted.fallbackMode} because strict paragraph extraction was not enough`
            : ''
        }`,
        intervention_tier: unit.wordCount < 180 ? 1 : unit.wordCount < 260 ? 2 : unit.wordCount < 340 ? 3 : 4,
        approval_status: 'pending_review',
        rejection_reason: rightsNote,
      }));
    });

    const { data, error } = await supabase
      .from('intervention_passages')
      .upsert(rows, { onConflict: 'source_gutenberg_id,paragraph_hash', ignoreDuplicates: true })
      .select('id, standard_code');

    if (error) throw new Error(error.message);
    const createdCount = data?.length ?? 0;
    if (!createdCount) {
      return NextResponse.json({
        ok: true,
        passage_ids: [],
        created_count: 0,
        detected_standards: standardsToInsert,
        official_match_count: matchedOfficialTexts.length,
        archived_full_text: Boolean(archivedManualSource),
        message:
          'GOGI found this text already staged for those standards, so no duplicate rows were added. Change standards/title or paste a different section if you want another import.',
      });
    }

    return NextResponse.json({
      ok: true,
      passage_ids: data?.map((row) => row.id) ?? [],
      created_count: createdCount,
      detected_standards: standardsToInsert,
      official_match_count: matchedOfficialTexts.length,
      archived_full_text: Boolean(archivedManualSource),
      message: mappedStandards.length
        ? `GOGI matched this work to ${standardsToInsert.length} official standard${
            standardsToInsert.length === 1 ? '' : 's'
          }: ${standardsToInsert.join(', ')}. ${
            shouldArchiveFullText
              ? `Full text was split into ${extracted.units.length} candidate excerpt${
                  extracted.units.length === 1 ? '' : 's'
                } using ${extracted.fallbackMode}. The original full upload was also saved for the source reader.`
              : 'Rights-managed excerpt added to the review queue.'
          }`
        : 'Rights-managed excerpt added using the fallback standard. Add the work to the official registry for automatic standard routing next time.',
    });
  } catch (err) {
    console.error('[api/reading-wins/gutenberg/manual-import] error:', err);
    const message = err instanceof Error ? err.message : 'Could not import rights-managed excerpt.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
