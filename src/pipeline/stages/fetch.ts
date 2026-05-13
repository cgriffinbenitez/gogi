import fs from 'fs';
import path from 'path';
import type { FetchedBook, GutendexBook, GutendexResponse, SourceConfig } from '../types';

// Loose name match: all tokens in the display-name form ("Jane Austen")
// appear in the Gutendex "Last, First" format ("Austen, Jane").
function bookMatchesPriorityAuthor(book: GutendexBook, displayName: string): boolean {
  const tokens = displayName.toLowerCase().split(/\s+/);
  return book.authors.some(a => {
    const norm = a.name.toLowerCase();
    return tokens.every(tok => norm.includes(tok));
  });
}

const GUTENDEX_BASE = 'https://gutendex.com/books/';
const GUTENBERG_BASE = 'https://www.gutenberg.org';
const CACHE_DIR = path.join('/tmp', 'gogi-pipeline-cache');

const BOOK_FETCH_DELAY_MS = 2000;
const META_FETCH_DELAY_MS = 300;

// ─── Cache ────────────────────────────────────────────────────────────────────

function ensureCacheDir() {
  if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });
}

function cacheFilePath(gutenbergId: number): string {
  return path.join(CACHE_DIR, `${gutenbergId}.txt`);
}

function readCache(gutenbergId: number): string | null {
  const p = cacheFilePath(gutenbergId);
  if (fs.existsSync(p)) return fs.readFileSync(p, 'utf8');
  return null;
}

function writeCache(gutenbergId: number, text: string) {
  ensureCacheDir();
  fs.writeFileSync(cacheFilePath(gutenbergId), text, 'utf8');
}

function headingPattern(heading: string) {
  const escaped = heading
    .trim()
    .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    .replace(/\s+/g, '\\s+');
  return new RegExp(`^\\s*(?:#+\\s*)?[_*"'“”‘’\`]*\\s*${escaped}\\s*[_*"'“”‘’\`.,:;!\\-—]*\\s*$`, 'im');
}

function sliceOfficialSection(
  text: string,
  seed: NonNullable<SourceConfig['officialGutenbergSeeds']>[number]
) {
  if (!seed.sectionStart) return text;

  const startMatch = headingPattern(seed.sectionStart).exec(text);
  if (!startMatch) {
    console.warn(
      `  [fetch] official section start not found for ${seed.gutenbergId}: "${seed.sectionStart}"`
    );
    return text;
  }

  const afterStart = startMatch.index + startMatch[0].length;
  let endIndex = text.length;
  if (seed.sectionEnd) {
    const endMatch = headingPattern(seed.sectionEnd).exec(text.slice(afterStart));
    if (endMatch) endIndex = afterStart + endMatch.index;
    else {
      console.warn(
        `  [fetch] official section end not found for ${seed.gutenbergId}: "${seed.sectionEnd}"`
      );
    }
  }

  let sliced = text.slice(afterStart, endIndex).trim();
  if (sliced.length < 500) {
    const nextMatch = headingPattern(seed.sectionStart).exec(text.slice(afterStart));
    if (nextMatch) {
      const nextStart = afterStart + nextMatch.index + nextMatch[0].length;
      let nextEnd = text.length;
      if (seed.sectionEnd) {
        const nextEndMatch = headingPattern(seed.sectionEnd).exec(text.slice(nextStart));
        if (nextEndMatch) nextEnd = nextStart + nextEndMatch.index;
      }
      const nextSliced = text.slice(nextStart, nextEnd).trim();
      if (nextSliced.length > sliced.length) sliced = nextSliced;
    }
  }
  console.log(
    `  [fetch] official section isolated: "${seed.sectionStart}"` +
      ` (${sliced.length.toLocaleString()} chars)`
  );
  return sliced || text;
}

// ─── Gutenberg boilerplate stripping ─────────────────────────────────────────

function stripBoilerplate(text: string): string {
  // Find START marker
  const startRe = /\*{3,}\s*START OF (?:THE |THIS )PROJECT GUTENBERG[^\n]*/i;
  const endRe   = /\*{3,}\s*END OF (?:THE |THIS )PROJECT GUTENBERG[^\n]*/i;

  let body = text;
  const startMatch = startRe.exec(text);
  if (startMatch) {
    const afterMarker = text.indexOf('\n', startMatch.index);
    if (afterMarker !== -1) body = text.slice(afterMarker + 1);
  }
  const endMatch = endRe.exec(body);
  if (endMatch) body = body.slice(0, endMatch.index);

  return body.trim();
}

// ─── Gutendex metadata queries ────────────────────────────────────────────────

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchBooksMeta(query: string, isAuthor: boolean): Promise<GutendexBook[]> {
  const param = isAuthor ? 'search' : 'search';
  const url = `${GUTENDEX_BASE}?${param}=${encodeURIComponent(query)}&languages=en`;

  try {
    const resp = await fetch(url);
    if (!resp.ok) {
      console.warn(`  [fetch] Gutendex query failed: ${url} (${resp.status})`);
      return [];
    }
    const data = (await resp.json()) as GutendexResponse;
    return data.results ?? [];
  } catch (err) {
    console.warn(`  [fetch] Gutendex network error for query "${query}":`, err);
    return [];
  }
}

// ─── Text URL resolver ────────────────────────────────────────────────────────

function resolveTextUrl(book: GutendexBook): string | null {
  const f = book.formats;
  return (
    f['text/plain; charset=utf-8']    ??
    f['text/plain; charset=us-ascii'] ??
    f['text/plain']                   ??
    null
  );
}

// ─── Book text fetch (rate-limited, cached) ───────────────────────────────────

async function fetchBookText(book: GutendexBook): Promise<string | null> {
  const cached = readCache(book.id);
  if (cached) {
    console.log(`  [fetch] cache hit: ${book.id} "${book.title.slice(0, 50)}"`);
    return cached;
  }

  const textUrl = resolveTextUrl(book);
  if (!textUrl) {
    console.log(`  [fetch] no plain-text format: ${book.id} "${book.title.slice(0, 50)}"`);
    return null;
  }

  try {
    console.log(`  [fetch] downloading: ${book.id} "${book.title.slice(0, 50)}"`);
    await sleep(BOOK_FETCH_DELAY_MS);
    const resp = await fetch(textUrl);
    if (!resp.ok) {
      console.warn(`  [fetch] download failed: ${book.id} (${resp.status})`);
      return null;
    }
    const raw = await resp.text();
    const text = stripBoilerplate(raw);
    writeCache(book.id, text);
    return text;
  } catch (err) {
    console.warn(`  [fetch] download error for book ${book.id}:`, err);
    return null;
  }
}

async function fetchOfficialSeedText(seed: NonNullable<SourceConfig['officialGutenbergSeeds']>[number]) {
  const cached = readCache(seed.gutenbergId);
  if (cached) {
    console.log(`  [fetch] official cache hit: ${seed.gutenbergId} "${seed.title.slice(0, 50)}"`);
    return sliceOfficialSection(cached, seed);
  }

  const urls = [
    `${GUTENBERG_BASE}/ebooks/${seed.gutenbergId}.txt.utf-8`,
    `${GUTENBERG_BASE}/files/${seed.gutenbergId}/${seed.gutenbergId}-0.txt`,
    `${GUTENBERG_BASE}/files/${seed.gutenbergId}/${seed.gutenbergId}.txt`,
  ];

  for (const url of urls) {
    try {
      console.log(`  [fetch] downloading official seed: ${seed.gutenbergId} "${seed.title.slice(0, 50)}"`);
      await sleep(BOOK_FETCH_DELAY_MS);
      const resp = await fetch(url);
      if (!resp.ok) continue;
      const raw = await resp.text();
      const text = stripBoilerplate(raw);
      writeCache(seed.gutenbergId, text);
      return sliceOfficialSection(text, seed);
    } catch (err) {
      console.warn(`  [fetch] official seed download error for ${seed.gutenbergId}:`, err);
      return null;
    }
  }

  console.warn(`  [fetch] no official seed text format worked: ${seed.gutenbergId} "${seed.title}"`);
  return null;
}

// ─── Author name from book ───────────────────────────────────────────────────

function primaryAuthor(book: GutendexBook): string {
  if (!book.authors.length) return 'Unknown';
  return book.authors[0].name;
}

function authorYear(book: GutendexBook): number | null {
  const a = book.authors[0];
  if (!a) return null;
  return a.death_year ?? a.birth_year ?? null;
}

// ─── Main: fetch books for a classification ───────────────────────────────────

export async function fetchBooksForClassification(
  sources: SourceConfig,
  maxBooks = 20,
): Promise<FetchedBook[]> {
  const seen    = new Set<number>();
  const allMeta: GutendexBook[] = [];
  const fetched: FetchedBook[] = [];

  console.log(`[Stage 1 — Fetch] querying Gutendex…`);

  for (const seed of sources.officialGutenbergSeeds ?? []) {
    if (seen.has(seed.gutenbergId)) continue;
    seen.add(seed.gutenbergId);
    const text = await fetchOfficialSeedText(seed);
    if (!text) continue;

    fetched.push({
      gutenbergId: seed.gutenbergId,
      title: seed.title,
      author: seed.author,
      year: seed.year ?? null,
      text,
    });
    console.log(`  [Stage 1] fetched official ${fetched.length}/${maxBooks}: ${seed.title.slice(0, 50)}`);
    if (fetched.length >= maxBooks) {
      console.log(`[Stage 1] complete — ${fetched.length} books ready`);
      return fetched;
    }
  }

  if (sources.officialOnly) {
    console.log(`[Stage 1] official-only mode — skipping broad author/topic search`);
    console.log(`[Stage 1] complete — ${fetched.length} official books ready`);
    return fetched;
  }

  // Priority authors first
  for (const author of sources.priorityAuthors) {
    console.log(`  searching author: "${author}"`);
    const books = await fetchBooksMeta(author, true);
    await sleep(META_FETCH_DELAY_MS);
    for (const b of books) {
      if (!seen.has(b.id)) { seen.add(b.id); allMeta.push(b); }
    }
  }

  // Then search terms
  for (const term of sources.gutendexSearchTerms) {
    console.log(`  searching topic: "${term}"`);
    const books = await fetchBooksMeta(term, false);
    await sleep(META_FETCH_DELAY_MS);
    for (const b of books) {
      if (!seen.has(b.id)) { seen.add(b.id); allMeta.push(b); }
    }
  }

  console.log(`[Stage 1] found ${allMeta.length} candidate books`);

  // ── Author-diverse selection ──────────────────────────────────────────────
  // Guarantee up to 2 books per priority author before filling remaining slots
  // with highest-download books. Prevents high-download authors (Austen, Dickens)
  // from consuming all maxBooks slots and crowding out new priority authors.
  const MAX_PER_PRIORITY_AUTHOR = 2;
  const selectedIds  = new Set<number>();
  const orderedMeta: GutendexBook[] = [];

  // Pass 1: up to MAX_PER_PRIORITY_AUTHOR per priority author (by download count)
  for (const authorName of sources.priorityAuthors) {
    const authorBooks = allMeta
      .filter(b => bookMatchesPriorityAuthor(b, authorName))
      .sort((a, b) => b.download_count - a.download_count)
      .slice(0, MAX_PER_PRIORITY_AUTHOR);
    for (const b of authorBooks) {
      if (!selectedIds.has(b.id)) {
        selectedIds.add(b.id);
        orderedMeta.push(b);
      }
    }
  }

  // Pass 2: fill remaining slots with highest-download unselected books
  const remaining = allMeta
    .filter(b => !selectedIds.has(b.id))
    .sort((a, b) => b.download_count - a.download_count);
  for (const b of remaining) orderedMeta.push(b);

  for (const book of orderedMeta.slice(0, maxBooks)) {
    const text = await fetchBookText(book);
    if (!text) continue;

    fetched.push({
      gutenbergId: book.id,
      title:       book.title,
      author:      primaryAuthor(book),
      year:        authorYear(book),
      text,
    });

    console.log(`  [Stage 1] fetched ${fetched.length}/${maxBooks}: ${book.title.slice(0, 50)}`);
    if (fetched.length >= maxBooks) break;
  }

  console.log(`[Stage 1] complete — ${fetched.length} books ready`);
  return fetched;
}
