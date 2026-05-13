#!/usr/bin/env tsx
/**
 * Build a persistent local manifest for the official Grade 9 B.E.S.T./FAST text map.
 *
 * This is intentionally text-first, not question-first:
 * 1. Treat Florida's mapped texts as the source of truth.
 * 2. Cache public-domain/Gutenberg text once.
 * 3. Mark rights-limited works as needing manual upload or reference-only use.
 * 4. Emit a manifest that later harvest/question/lesson jobs can trust.
 */

import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { OFFICIAL_FAST_TEXT_MODELS } from '../src/lib/reading-wins/officialFastSources';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });
dotenv.config();

type LibraryStatus =
  | 'stored'
  | 'manual_upload'
  | 'needs_upload'
  | 'reference_only'
  | 'needs_gutenberg_match'
  | 'fetch_failed';

type OfficialLibraryEntry = {
  title: string;
  author: string | null;
  access: string;
  pipeline_use: string;
  source_documents: string[];
  standards: string[];
  gutenberg_ids: number[];
  discovered_gutenberg_id: number | null;
  status: LibraryStatus;
  text_path: string | null;
  char_count: number;
  word_count: number;
  notes: string;
};

const ROOT = process.cwd();
const LIBRARY_DIR = path.join(ROOT, 'data', 'official-text-library');
const TEXT_DIR = path.join(LIBRARY_DIR, 'texts');
const STANDARD_DIR = path.join(LIBRARY_DIR, 'standards');
const MANIFEST_PATH = path.join(LIBRARY_DIR, 'manifest.json');
const SUMMARY_PATH = path.join(LIBRARY_DIR, 'summary.md');
const MANUAL_UPLOAD_MANIFEST_PATH = path.join(LIBRARY_DIR, 'manual-uploads', 'manifest.json');

const GUTENBERG_BASE = 'https://www.gutenberg.org';

function ensureDirs() {
  fs.mkdirSync(TEXT_DIR, { recursive: true });
  fs.mkdirSync(STANDARD_DIR, { recursive: true });
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 90);
}

function wordCount(value: string) {
  return value.trim().split(/\s+/).filter(Boolean).length;
}

function normalizeTitle(value: string | null | undefined) {
  return (value ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function getSupabaseApiKey() {
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (
    serviceRole &&
    (serviceRole.startsWith('eyJ') || serviceRole.startsWith('sb_secret_') || serviceRole.length > 80)
  ) {
    return serviceRole;
  }

  return process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
}

async function loadManualUploadMap() {
  const map = new Map<string, { path: string | null; wordCount: number; charCount: number }>();

  try {
    if (!fs.existsSync(MANUAL_UPLOAD_MANIFEST_PATH)) throw new Error('No local manual upload manifest');
    const manifest = JSON.parse(fs.readFileSync(MANUAL_UPLOAD_MANIFEST_PATH, 'utf8')) as {
      entries?: Array<{ title?: string; path?: string; word_count?: number; char_count?: number }>;
    };
    for (const entry of manifest.entries ?? []) {
      if (!entry.title || !entry.path) continue;
      map.set(normalizeTitle(entry.title), {
        path: entry.path,
        wordCount: entry.word_count ?? 0,
        charCount: entry.char_count ?? 0,
      });
    }
  } catch {
    // Local manual archive is optional; the database upload ledger can still count manual source text.
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = getSupabaseApiKey();
  if (!url || !key) return map;

  try {
    const supabase = createClient(url, key);
    const { data, error } = await supabase
      .from('intervention_passages')
      .select('source_title, paragraph_text, word_count')
      .eq('source', 'manual_rights')
      .not('source_title', 'is', null)
      .limit(5000);

    if (error) {
      console.warn(`[library:official-texts] manual upload database lookup skipped: ${error.message}`);
      return map;
    }

    const grouped = new Map<string, { words: number; chars: number; seen: Set<string> }>();
    for (const row of (data ?? []) as Array<{ source_title: string | null; paragraph_text: string | null; word_count: number | null }>) {
      const key = normalizeTitle(row.source_title);
      const text = row.paragraph_text?.trim() ?? '';
      if (!key || !text || map.has(key)) continue;
      const group = grouped.get(key) ?? { words: 0, chars: 0, seen: new Set<string>() };
      const textKey = text.slice(0, 220).toLowerCase();
      if (group.seen.has(textKey)) continue;
      group.seen.add(textKey);
      group.words += row.word_count ?? wordCount(text);
      group.chars += text.length;
      grouped.set(key, group);
    }

    for (const [key, group] of grouped) {
      map.set(key, { path: null, wordCount: group.words, charCount: group.chars });
    }
  } catch (error) {
    console.warn(
      `[library:official-texts] manual upload database lookup skipped: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }

  return map;
}

function stripBoilerplate(text: string) {
  const startRe = /\*{3,}\s*START OF (?:THE |THIS )PROJECT GUTENBERG[^\n]*/i;
  const endRe = /\*{3,}\s*END OF (?:THE |THIS )PROJECT GUTENBERG[^\n]*/i;

  let body = text;
  const startMatch = startRe.exec(text);
  if (startMatch) {
    const afterMarker = text.indexOf('\n', startMatch.index);
    if (afterMarker !== -1) body = text.slice(afterMarker + 1);
  }
  const endMatch = endRe.exec(body);
  if (endMatch) body = body.slice(0, endMatch.index);

  return body
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\f/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{4,}/g, '\n\n\n')
    .trim();
}

function headingPattern(heading: string) {
  const escaped = heading
    .trim()
    .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    .replace(/\s+/g, '\\s+');
  return new RegExp(`^\\s*(?:#+\\s*)?[_*"'“”‘’\`]*\\s*${escaped}\\s*[_*"'“”‘’\`.,:;!\\-—]*\\s*$`, 'im');
}

function sliceSection(text: string, args: { sectionStart?: string; sectionEnd?: string }) {
  if (!args.sectionStart) return text;

  const startMatch = headingPattern(args.sectionStart).exec(text);
  if (!startMatch) return text;

  const sliceFrom = (matchIndex: number, matchText: string) => {
    const afterStart = matchIndex + matchText.length;
    let endIndex = text.length;
    if (args.sectionEnd) {
      const endMatch = headingPattern(args.sectionEnd).exec(text.slice(afterStart));
      if (endMatch) endIndex = afterStart + endMatch.index;
    }
    return text.slice(afterStart, endIndex).trim();
  };

  let sliced = sliceFrom(startMatch.index, startMatch[0]);
  if (sliced.length < 500) {
    const nextMatch = headingPattern(args.sectionStart).exec(
      text.slice(startMatch.index + startMatch[0].length)
    );
    if (nextMatch) {
      const nextIndex = startMatch.index + startMatch[0].length + nextMatch.index;
      const nextSliced = sliceFrom(nextIndex, nextMatch[0]);
      if (nextSliced.length > sliced.length) sliced = nextSliced;
    }
  }

  return sliced || text;
}

async function fetchGutenbergText(gutenbergId: number) {
  const urls = [
    `${GUTENBERG_BASE}/ebooks/${gutenbergId}.txt.utf-8`,
    `${GUTENBERG_BASE}/files/${gutenbergId}/${gutenbergId}-0.txt`,
    `${GUTENBERG_BASE}/files/${gutenbergId}/${gutenbergId}.txt`,
    `${GUTENBERG_BASE}/cache/epub/${gutenbergId}/pg${gutenbergId}.txt`,
  ];

  for (const url of urls) {
    try {
      const response = await fetch(url);
      if (!response.ok) continue;
      return stripBoilerplate(await response.text());
    } catch {
      // Try the next known Gutenberg text URL format.
    }
  }

  return null;
}

async function discoverGutenbergId(model: (typeof OFFICIAL_FAST_TEXT_MODELS)[number]) {
  const queries = [
    ...(model.gutendexSearchTerms ?? []),
    `${model.title} ${model.author ?? ''}`.trim(),
  ].filter(Boolean);

  for (const query of queries) {
    try {
      const response = await fetch(
        `https://gutendex.com/books/?search=${encodeURIComponent(query)}&languages=en`
      );
      if (!response.ok) continue;
      const body = (await response.json()) as {
        results?: Array<{
          id: number;
          title: string;
          authors?: Array<{ name: string }>;
          formats?: Record<string, string>;
        }>;
      };
      const candidates = body.results ?? [];
      const textCandidates = candidates.filter((candidate) =>
        Object.keys(candidate.formats ?? {}).some((format) => format.startsWith('text/plain'))
      );
      const titleNeedle = model.title.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
      const authorNeedle = (model.author ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
      const best =
        textCandidates.find((candidate) => {
          const title = candidate.title.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
          const authors = (candidate.authors ?? [])
            .map((author) => author.name.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim())
            .join(' ');
          return title.includes(titleNeedle) && (!authorNeedle || authors.includes(authorNeedle.split(' ')[0] ?? ''));
        }) ?? textCandidates[0];

      if (best) return best.id;
    } catch {
      // Try next query.
    }
  }

  return null;
}

function entryKey(title: string, author?: string | null) {
  return `${title.trim().toLowerCase()}::${author?.trim().toLowerCase() ?? ''}`;
}

function mergeModels() {
  const byWork = new Map<string, (typeof OFFICIAL_FAST_TEXT_MODELS)[number]>();
  for (const model of OFFICIAL_FAST_TEXT_MODELS) {
    const key = entryKey(model.title, model.author);
    const existing = byWork.get(key);
    if (!existing) {
      byWork.set(key, { ...model, standards: [...model.standards] });
      continue;
    }

    existing.standards = [...new Set([...existing.standards, ...model.standards])];
    existing.gutenbergIds = [...new Set([...(existing.gutenbergIds ?? []), ...(model.gutenbergIds ?? [])])];
    existing.priorityAuthors = [...new Set([...(existing.priorityAuthors ?? []), ...(model.priorityAuthors ?? [])])];
    existing.gutendexSearchTerms = [
      ...new Set([...(existing.gutendexSearchTerms ?? []), ...(model.gutendexSearchTerms ?? [])]),
    ];
    existing.notes = `${existing.notes} ${model.notes}`.trim();
  }
  return [...byWork.values()].sort((a, b) => a.title.localeCompare(b.title));
}

function shouldFetch(model: (typeof OFFICIAL_FAST_TEXT_MODELS)[number]) {
  return model.pipelineUse === 'priority_seed';
}

function readArg(args: string[], name: string) {
  const index = args.indexOf(name);
  return index !== -1 ? args[index + 1] : undefined;
}

function statusLabel(status: LibraryStatus, storedText: string, manualWordCount = 0) {
  if (status === 'stored') return `stored ${wordCount(storedText).toLocaleString()} words`;
  if (status === 'manual_upload') {
    const words = storedText ? wordCount(storedText) : manualWordCount;
    return `manual full text ${words.toLocaleString()} words`;
  }
  if (status === 'reference_only') return 'reference only';
  if (status === 'fetch_failed') return 'fetch failed';
  if (status === 'needs_gutenberg_match') return 'needs Gutenberg match';
  return 'needs upload';
}

function printHelp() {
  console.log(`
GOGI Official Text Library Builder

Usage:
  npm run library:official-texts
  npm run library:official-texts -- --standard ELA.9.R.1.1
  npm run library:official-texts -- --refresh-public-domain

Options:
  --standard                 Optional. Build only official works mapped to this standard.
  --refresh-public-domain    Refetch/slice public-domain source files even if cached locally.
  --help                     Show this help.
`);
}

async function build() {
  const args = process.argv.slice(2);
  if (args.includes('--help') || args.includes('-h')) {
    printHelp();
    return;
  }
  const selectedStandard = readArg(args, '--standard');
  const refreshPublicDomain = args.includes('--refresh-public-domain');

  ensureDirs();

  const entries: OfficialLibraryEntry[] = [];
  const manualUploadMap = await loadManualUploadMap();
  const models = mergeModels().filter((model) =>
    selectedStandard ? model.standards.includes(selectedStandard as never) : true
  );

  console.log('\n═══════════════════════════════════════════════════════');
  console.log('  GOGI Official Text Library Build');
  console.log(`  Scope: ${selectedStandard ?? 'all Grade 9 mapped texts'}`);
  console.log(`  Official works: ${models.length}`);
  console.log('═══════════════════════════════════════════════════════\n');

  for (const model of models) {
    const gutenbergIds = model.gutenbergIds ?? [];
    let discoveredGutenbergId: number | null = gutenbergIds[0] ?? null;
    const textFile = `${slugify(`${model.title}-${model.author ?? 'unknown'}`)}.txt`;
    const textPath = path.join(TEXT_DIR, textFile);
    let status: LibraryStatus =
      model.pipelineUse === 'style_model_only' ? 'reference_only' : 'needs_upload';
    let storedText =
      fs.existsSync(textPath) && !(refreshPublicDomain && shouldFetch(model))
        ? fs.readFileSync(textPath, 'utf8')
        : '';
    const manualUpload = manualUploadMap.get(normalizeTitle(model.title));
    const manualText =
      manualUpload?.path && fs.existsSync(path.join(ROOT, manualUpload.path))
        ? fs.readFileSync(path.join(ROOT, manualUpload.path), 'utf8')
        : '';

    if (shouldFetch(model)) {
      if (!discoveredGutenbergId) {
        discoveredGutenbergId = await discoverGutenbergId(model);
      }
      if (!storedText) {
        const idsToFetch = gutenbergIds.length ? gutenbergIds : discoveredGutenbergId ? [discoveredGutenbergId] : [];
        const fetchedTexts: string[] = [];
        for (const id of idsToFetch) {
          const rawText = await fetchGutenbergText(id);
          if (rawText) {
            fetchedTexts.push(
              sliceSection(rawText, {
                sectionStart: model.sectionStart,
                sectionEnd: model.sectionEnd,
              })
            );
          }
        }
        if (fetchedTexts.length) {
          storedText = fetchedTexts.join('\n\n\n');
          fs.writeFileSync(textPath, storedText, 'utf8');
        }
      }
      status = storedText ? 'stored' : discoveredGutenbergId ? 'fetch_failed' : 'needs_upload';
    }

    if (!storedText && (manualText || manualUpload)) {
      storedText = manualText;
      status = 'manual_upload';
    }

    const relativeTextPath =
      status === 'manual_upload' && manualUpload?.path
        ? manualUpload.path
        : storedText
          ? path.relative(ROOT, textPath)
          : null;
    entries.push({
      title: model.title,
      author: model.author ?? null,
      access: model.access,
      pipeline_use: model.pipelineUse,
      source_documents: [model.sourceDocument],
      standards: [...model.standards].sort(),
      gutenberg_ids: gutenbergIds,
      discovered_gutenberg_id: discoveredGutenbergId,
      status,
      text_path: relativeTextPath,
      char_count: storedText.length || manualUpload?.charCount || 0,
      word_count: storedText ? wordCount(storedText) : manualUpload?.wordCount ?? 0,
      notes: model.notes,
    });

    const label = statusLabel(status, storedText, manualUpload?.wordCount ?? 0);
    console.log(`  ${label.padEnd(24)} ${model.title} — ${model.author ?? 'Unknown'}`);
  }

  const totals = {
    texts: entries.length,
    stored: entries.filter((entry) => entry.status === 'stored').length,
    needs_upload: entries.filter((entry) => entry.status === 'needs_upload').length,
    manual_upload: entries.filter((entry) => entry.status === 'manual_upload').length,
    reference_only: entries.filter((entry) => entry.status === 'reference_only').length,
    fetch_failed: entries.filter((entry) => entry.status === 'fetch_failed').length,
    needs_gutenberg_match: entries.filter((entry) => entry.status === 'needs_gutenberg_match').length,
  };

  const byStandard = entries.reduce<Record<string, { stored: number; total: number; texts: string[] }>>(
    (map, entry) => {
      for (const standard of entry.standards) {
        const current = map[standard] ?? { stored: 0, total: 0, texts: [] };
        current.total += 1;
        if (entry.status === 'stored' || entry.status === 'manual_upload') current.stored += 1;
        current.texts.push(entry.title);
        map[standard] = current;
      }
      return map;
    },
    {}
  );

  const manifest = {
    generated_at: new Date().toISOString(),
    scope: selectedStandard ?? 'all',
    totals,
    by_standard: Object.fromEntries(Object.entries(byStandard).sort(([a], [b]) => a.localeCompare(b))),
    entries,
  };

  fs.writeFileSync(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  for (const [standard, row] of Object.entries(byStandard)) {
    const standardEntries = entries.filter((entry) => entry.standards.includes(standard));
    fs.writeFileSync(
      path.join(STANDARD_DIR, `${standard}.json`),
      `${JSON.stringify(
        {
          generated_at: manifest.generated_at,
          standard,
          stored_texts: row.stored,
          mapped_texts: row.total,
          entries: standardEntries,
        },
        null,
        2
      )}\n`,
      'utf8'
    );
  }
  fs.writeFileSync(
    SUMMARY_PATH,
    [
      '# GOGI Official Text Library',
      '',
      `Generated: ${manifest.generated_at}`,
      `Scope: ${manifest.scope}`,
      '',
      `- Official works: ${totals.texts}`,
      `- Stored public-domain texts: ${totals.stored}`,
      `- Manual full-text uploads: ${totals.manual_upload}`,
      `- Needs upload/manual rights: ${totals.needs_upload}`,
      `- Reference/style model only: ${totals.reference_only}`,
      `- Fetch failed: ${totals.fetch_failed}`,
      `- Needs Gutenberg match: ${totals.needs_gutenberg_match}`,
      '',
      '## Standard Coverage',
      '',
      '| Standard | Stored Texts | Total Mapped Texts |',
      '| --- | ---: | ---: |',
      ...Object.entries(byStandard)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([standard, row]) => `| ${standard} | ${row.stored} | ${row.total} |`),
      '',
    ].join('\n'),
    'utf8'
  );

  console.log('\n═══════════════════════════════════════════════════════');
  console.log('  Official text library build complete');
  console.log(`  Stored:       ${totals.stored}/${totals.texts}`);
  console.log(`  Manual:       ${totals.manual_upload}`);
  console.log(`  Needs upload: ${totals.needs_upload}`);
  console.log(`  Manifest:     ${path.relative(ROOT, MANIFEST_PATH)}`);
  console.log(`  Summary:      ${path.relative(ROOT, SUMMARY_PATH)}`);
  console.log(`  Standards:    ${path.relative(ROOT, STANDARD_DIR)}`);
  console.log('═══════════════════════════════════════════════════════\n');
}

build().catch((err) => {
  console.error('[library:official-texts] failed:', err);
  process.exit(1);
});
