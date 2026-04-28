import crypto from 'crypto';
import type { FetchedBook, Paragraph, TierKey } from '../types';

// ─── Front-matter stripping ───────────────────────────────────────────────────

const FRONT_MATTER_MARKERS = [
  /^CHAPTER\s+(I|1|ONE)\b/m,
  /^STORY\s+(I|1|ONE)\b/m,
  /^TALE\s+(I|1|ONE)\b/m,
  /^BOOK\s+(I|1|ONE)\b/m,
  /^PART\s+(I|1|ONE)\b/m,
  /^\*\s*\*\s*\*/m,
];

// CC0 / public-domain dedication boilerplate that appears at the head of some
// Gutenberg editions. If we see this pattern inside the 10% search window we
// skip forward past it to the first blank-line-separated block that follows,
// rather than letting it surface as filter candidates.
const CC0_BOILERPLATE_RE =
  /Creative Commons.*?CC0|relinquishment in perpetuity|vested or contingent/i;

/**
 * Strip Gutenberg front matter (title pages, prefaces, biographical essays,
 * tables of contents) from the beginning of a book's text.
 * Returns the stripped book and how many characters were removed.
 */
export function stripBookFrontMatter(
  book: FetchedBook,
): { strippedBook: FetchedBook; charsSkipped: number } {
  // Normalize line endings first so regex anchors work
  const normalized = book.text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const tenPercent = Math.floor(normalized.length * 0.1);
  const searchWindow = normalized.slice(0, tenPercent);

  // If CC0/public-domain boilerplate detected at the head, skip past it to
  // the next double-newline block so legal text doesn't surface as candidates.
  if (CC0_BOILERPLATE_RE.test(searchWindow)) {
    const afterBoilerplate = normalized.indexOf('\n\n', searchWindow.length);
    const cutTo = afterBoilerplate !== -1 ? afterBoilerplate + 2 : tenPercent;
    // Still try the standard markers in the remaining text
    const remainingWindow = normalized.slice(cutTo, cutTo + tenPercent);
    for (const re of FRONT_MATTER_MARKERS) {
      const match = re.exec(remainingWindow);
      if (match) {
        const absIndex = cutTo + match.index;
        return {
          strippedBook: { ...book, text: normalized.slice(absIndex) },
          charsSkipped: absIndex,
        };
      }
    }
    return {
      strippedBook: { ...book, text: normalized.slice(cutTo) },
      charsSkipped: cutTo,
    };
  }

  for (const re of FRONT_MATTER_MARKERS) {
    const match = re.exec(searchWindow);
    if (match) {
      return {
        strippedBook: { ...book, text: normalized.slice(match.index) },
        charsSkipped: match.index,
      };
    }
  }

  // Fallback: skip first 15%
  const cutPoint = Math.floor(normalized.length * 0.15);
  return {
    strippedBook: { ...book, text: normalized.slice(cutPoint) },
    charsSkipped: cutPoint,
  };
}

export const MIN_WORDS = 150;
export const MAX_WORDS = 350;
const MAX_DIALOGUE_RATIO = 0.35; // skip if >35% of chars are inside quotation marks

// ─── Helpers ──────────────────────────────────────────────────────────────────

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function sha256Short(text: string): string {
  return crypto.createHash('sha256').update(text).digest('hex').slice(0, 16);
}

function isDialogueHeavy(text: string): boolean {
  // Count characters inside "..." pairs
  let inQuote    = false;
  let quoteChars = 0;
  for (const ch of text) {
    if (ch === '"') { inQuote = !inQuote; continue; }
    if (inQuote) quoteChars++;
  }
  return quoteChars / text.length > MAX_DIALOGUE_RATIO;
}

function isSectionHeader(text: string): boolean {
  const trimmed = text.trim();
  // Chapter headings, roman numerals, all-caps short lines
  if (/^(chapter|part|book|section|act|scene)\s+[ivxlcdm\d]/i.test(trimmed)) return true;
  if (/^[IVXLCDM]+\.?\s*$/.test(trimmed)) return true;
  if (trimmed.length < 40 && trimmed === trimmed.toUpperCase() && /[A-Z]/.test(trimmed)) return true;
  return false;
}

function normalizeWhitespace(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n +/g, '\n')
    .trim();
}

export function isCompleteParagraph(text: string): { complete: boolean; reason?: string } {
  const trimmed = text.trim();

  // 1. Must start with capital letter or opening quotation mark
  if (!/^[A-Z"']/.test(trimmed)) {
    return { complete: false, reason: 'starts mid-sentence' };
  }

  // 2. Must end with terminal punctuation
  if (!/[.!?"']\s*$/.test(trimmed)) {
    return { complete: false, reason: 'ends without terminal punctuation' };
  }

  // 3. Unbalanced double quotes
  const doubleQuoteCount = (text.match(/"/g) ?? []).length;
  if (doubleQuoteCount % 2 !== 0) {
    return { complete: false, reason: 'unbalanced double quotes' };
  }

  // 4. Unbalanced parentheses
  const openParens  = (text.match(/\(/g) ?? []).length;
  const closeParens = (text.match(/\)/g) ?? []).length;
  if (openParens !== closeParens) {
    return { complete: false, reason: 'unbalanced parentheses' };
  }

  // 5. Chapter/section header
  if (/^\s*(CHAPTER|BOOK|PART|SECTION|ACT|SCENE)\s+[IVXLC0-9]+/i.test(text)) {
    return { complete: false, reason: 'chapter or section header' };
  }

  // 6. Divider lines
  if (/^\s*[\*_=\-\.]{3,}\s*$/.test(text)) {
    return { complete: false, reason: 'divider or decoration' };
  }

  // 7. Illustration/footnote markers
  if (/\[Illustration|\[Image|\[Footnote/.test(text)) {
    return { complete: false, reason: 'illustration or footnote marker' };
  }

  // 8. Trailing em-dash or en-dash (cut off)
  if (/[—–]\s*$/.test(trimmed)) {
    return { complete: false, reason: 'trailing em-dash, likely cut off' };
  }

  // 9. Leading em-dash or en-dash (cut off)
  if (/^\s*[—–]/.test(text)) {
    return { complete: false, reason: 'leading em-dash, likely cut off' };
  }

  // 10. Editorial or biographical content
  if (
    /\bborn\s+(in|on)\s+\d{4}/i.test(text) ||
    /\bdied\s+(in|on)\s+\d{4}/i.test(text) ||
    /\b\d{4}(\s*[-–]\s*\d{4})?\b.*\b(birth|death|biography)/i.test(text) ||
    /\beditor('s)?\s+(note|introduction|preface)/i.test(text) ||
    /\btranslated\s+(by|from)/i.test(text)
  ) {
    return { complete: false, reason: 'editorial or biographical content' };
  }

  return { complete: true };
}

function cleanParagraph(text: string): string {
  return text
    // Remove Gutenberg footnote refs like [1] [23]
    .replace(/\[\s*[0-9]+\s*\]/g, '')
    // Collapse multi-spaces
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/**
 * Returns true if candidate text substantially overlaps with any already-accepted
 * passage from the same source book.
 *
 * Overlap is detected two ways:
 *   1. Candidate's opening 100 chars appear inside a seen passage  (candidate is
 *      a sub-window or right-shift of an accepted passage).
 *   2. A seen passage's opening 100 chars appear inside the candidate  (candidate
 *      is a super-window or left-shift of an accepted passage).
 *
 * 100-char anchor ≈ 15-20 words — long enough to be unambiguous, short enough
 * to fire on adjacent sliding-window chunks (the typical White Fang / Buck-
 * stealing pattern).  Passages shorter than 50 chars are skipped (can't anchor).
 *
 * Scope: same-source-book only.  Callers pass a per-book accumulator.
 */
function isContentDuplicate(
  candidate: string,
  seenTexts: string[],
): { isDuplicate: boolean; matchedAgainst?: string } {
  const anchor = candidate.trim().slice(0, 100);
  if (anchor.length < 50) return { isDuplicate: false };

  for (const seen of seenTexts) {
    // Check 1: candidate's opening appears inside the seen passage
    if (seen.includes(anchor)) {
      return { isDuplicate: true, matchedAgainst: seen.slice(0, 100) };
    }
    // Check 2: seen passage's opening appears inside the candidate
    const seenAnchor = seen.trim().slice(0, 100);
    if (seenAnchor.length >= 50 && candidate.includes(seenAnchor)) {
      return { isDuplicate: true, matchedAgainst: seenAnchor };
    }
  }
  return { isDuplicate: false };
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export function extractParagraphs(
  book: FetchedBook,
): Array<Paragraph & { skippedReason?: string }> {
  // Normalize line endings before splitting (Gutenberg books use CRLF)
  const normalizedText = book.text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  // Split on blank lines (one or more)
  const raw = normalizedText.split(/\n{2,}/);
  const results: Array<Paragraph & { skippedReason?: string; paragraphCount: number }> = [];

  const acceptedTexts:      string[] = [];
  let   accepted            = 0;
  let   rejectedForLength   = 0;
  let   rejectedForOverlap  = 0;

  for (const block of raw) {
    let text = normalizeWhitespace(block.replace(/\n/g, ' '));
    if (!text) continue;
    if (isSectionHeader(text)) continue;

    const wc = wordCount(text);
    if (wc < MIN_WORDS || wc > MAX_WORDS) { rejectedForLength++; continue; }

    // Clean before completeness check
    text = cleanParagraph(text);

    // Completeness check (after word-count, before dialogue)
    const completeness = isCompleteParagraph(text);
    if (!completeness.complete) {
      results.push({
        text,
        wordCount:    wordCount(text),
        sourceTitle:  book.title,
        sourceAuthor: book.author,
        sourceYear:   book.year,
        gutenbergId:  book.gutenbergId,
        hash:         sha256Short(text),
        paragraphCount: 1,
        skippedReason: completeness.reason,
      });
      continue;
    }

    if (isDialogueHeavy(text)) {
      results.push({
        text,
        wordCount:    wordCount(text),
        sourceTitle:  book.title,
        sourceAuthor: book.author,
        sourceYear:   book.year,
        gutenbergId:  book.gutenbergId,
        hash:         sha256Short(text),
        paragraphCount: 1,
        skippedReason: 'dialogue_heavy',
      });
      continue;
    }

    // Content-overlap dedup — same-source-book scope
    const dupCheck = isContentDuplicate(text, acceptedTexts);
    if (dupCheck.isDuplicate) {
      console.log(
        `[dedup] rejecting overlap from "${book.title}"\n` +
        `  candidate : ${text.slice(0, 60)}…\n` +
        `  matched   : ${dupCheck.matchedAgainst?.slice(0, 60)}…`,
      );
      rejectedForOverlap++;
      continue;
    }

    acceptedTexts.push(text);
    accepted++;
    results.push({
      text,
      wordCount:      wordCount(text),
      sourceTitle:    book.title,
      sourceAuthor:   book.author,
      sourceYear:     book.year,
      gutenbergId:    book.gutenbergId,
      hash:           sha256Short(text),
      paragraphCount: 1,
    });
  }

  console.log(
    `[extract] "${book.title}" — ${accepted} accepted, ` +
    `${rejectedForLength} rejected for length, ` +
    `${rejectedForOverlap} rejected for content overlap`,
  );

  return results;
}

// ─── v3: Multi-tier passage unit extraction ───────────────────────────────────

// Tier word-count windows — all must stay within the absolute 150-350 cap.
// T1 < T2 < T3 < T4 in target length to preserve cognitive differentiation,
// but no tier may produce a passage outside [MIN_WORDS, MAX_WORDS].
// Exported so tests can assert both the specific values and containment within the cap.
export const TIER_BOUNDS: Record<TierKey, { min: number; max: number }> = {
  T1: { min: 150, max: 210 },
  T2: { min: 175, max: 260 },
  T3: { min: 225, max: 310 },
  T4: { min: 275, max: 350 },
};

// Paragraph span sizes per tier
const TIER_PARA_COUNTS: Record<TierKey, number[]> = {
  T1: [1],
  T2: [1, 2],
  T3: [2, 3],
  T4: [3, 4, 5],
};

type PassageUnit = Paragraph & { skippedReason?: string };

/**
 * v3 multi-tier extraction. Returns candidate passage units grouped by tier.
 * Units may overlap across tiers (same paragraph can be start of T1 and T3).
 * Deduplicates within each tier by paragraph_hash.
 * Keeps extractParagraphs intact for v2 compat.
 */
export function extractPassageUnits(
  book: FetchedBook,
): Record<TierKey, PassageUnit[]> {
  const normalizedText = book.text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const rawBlocks = normalizedText.split(/\n{2,}/);

  // Normalize and filter all blocks to candidate prose blocks (no headers, non-empty)
  const blocks: string[] = [];
  for (const block of rawBlocks) {
    const t = normalizeWhitespace(block.replace(/\n/g, ' '));
    if (!t || isSectionHeader(t)) continue;
    blocks.push(cleanParagraph(t));
  }

  const result: Record<TierKey, PassageUnit[]> = { T1: [], T2: [], T3: [], T4: [] };

  // Shared across all tiers — prevents overlapping windows from the same source
  // location reaching the DB regardless of which tier they qualify for.
  const acceptedTextsThisBook: string[] = [];
  let   accepted            = 0;
  let   rejectedForLength   = 0;
  let   rejectedForOverlap  = 0;

  for (const tierKey of (['T1', 'T2', 'T3', 'T4'] as TierKey[])) {
    const { min, max } = TIER_BOUNDS[tierKey];
    const seenHashes = new Set<string>();

    for (const spanLen of TIER_PARA_COUNTS[tierKey]) {
      for (let i = 0; i <= blocks.length - spanLen; i++) {
        const span = blocks.slice(i, i + spanLen);

        // Completeness: first block must start clean, last must end cleanly
        const firstCheck = isCompleteParagraph(span[0]);
        const lastCheck  = isCompleteParagraph(span[span.length - 1]);
        if (!firstCheck.complete || !lastCheck.complete) continue;

        const joined = span.join('\n\n');
        const wc = wordCount(joined);
        if (wc < min || wc > max) { rejectedForLength++; continue; }

        // Skip if dialogue-heavy (check joined unit)
        if (isDialogueHeavy(joined)) continue;

        const hash = sha256Short(joined);
        if (seenHashes.has(hash)) continue;
        seenHashes.add(hash);

        // Terminal safety guard — catches any future TIER_BOUNDS drift that
        // would let a passage outside the absolute cap reach the DB.
        if (wc < MIN_WORDS || wc > MAX_WORDS) {
          throw new Error(
            `extract safety guard: passage wordCount=${wc} outside absolute cap ` +
            `[${MIN_WORDS}, ${MAX_WORDS}] (tier=${tierKey}, paragraphs=${spanLen})`,
          );
        }

        // Content-overlap dedup — same-source-book scope, shared across all tiers
        const dupCheck = isContentDuplicate(joined, acceptedTextsThisBook);
        if (dupCheck.isDuplicate) {
          console.log(
            `[dedup] rejecting overlap from "${book.title}" (${tierKey}, ${spanLen}p)\n` +
            `  candidate : ${joined.slice(0, 60)}…\n` +
            `  matched   : ${dupCheck.matchedAgainst?.slice(0, 60)}…`,
          );
          rejectedForOverlap++;
          continue;
        }

        acceptedTextsThisBook.push(joined);
        accepted++;
        result[tierKey].push({
          text:           joined,
          wordCount:      wc,
          paragraphCount: spanLen,
          sourceTitle:    book.title,
          sourceAuthor:   book.author,
          sourceYear:     book.year,
          gutenbergId:    book.gutenbergId,
          hash,
        });
      }
    }
  }

  console.log(
    `[extract] "${book.title}" — ${accepted} accepted, ` +
    `${rejectedForLength} rejected for length, ` +
    `${rejectedForOverlap} rejected for content overlap`,
  );

  return result;
}
