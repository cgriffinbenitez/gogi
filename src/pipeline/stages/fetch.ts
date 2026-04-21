import fs from 'fs';
import path from 'path';
import type { FetchedBook, GutendexBook, GutendexResponse, SourceConfig } from '../types';

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

  console.log(`[Stage 1 — Fetch] querying Gutendex…`);

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

  // Sort by download count (higher popularity → better-known texts)
  allMeta.sort((a, b) => b.download_count - a.download_count);

  const fetched: FetchedBook[] = [];

  for (const book of allMeta.slice(0, maxBooks)) {
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
