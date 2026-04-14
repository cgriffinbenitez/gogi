import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// ─── Search Terms per Standard ────────────────────────────────────────────────

const SEARCH_TERMS: Record<string, string> = {
  'ELA.9.R.1.1': 'friendship',
  'ELA.9.R.1.2': 'sacrifice',
  'ELA.9.R.2.1': 'essays',
};

// ─── Types ────────────────────────────────────────────────────────────────────

interface GutendexBook {
  id: number;
  title: string;
  authors: { name: string }[];
  formats: Record<string, string>;
}

interface ExtractedPassage {
  content: string;
  phase: 'intervention' | 'reassessment';
  cognitive_skill_targeted: string;
  difficulty_level: number;
  source_title: string;
  source_author: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getTextUrl(formats: Record<string, string>): string | null {
  return formats['text/plain; charset=utf-8'] || formats['text/plain'] || null;
}

function stripMarkdownFences(text: string): string {
  return text
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
}

// ─── Route Handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, ...params } = body as { action: string } & Record<string, string>;

    // ── Search action ──────────────────────────────────────────────────────────
    if (action === 'search') {
      const { searchTerm } = params;
      if (!searchTerm) {
        return NextResponse.json({ error: 'searchTerm required' }, { status: 400 });
      }

      const res = await fetch(
        `https://gutendex.com/books?search=${encodeURIComponent(searchTerm)}`,
        { headers: { Accept: 'application/json' } },
      );
      if (!res.ok) {
        return NextResponse.json({ error: 'Gutendex request failed' }, { status: 502 });
      }

      const data = await res.json();
      const books = (data.results as GutendexBook[]).map((b) => ({
        id: b.id,
        title: b.title,
        authors: b.authors.map((a) => a.name).join(', '),
        hasText: !!getTextUrl(b.formats),
      }));

      return NextResponse.json({ books });
    }

    // ── Seed action ───────────────────────────────────────────────────────────
    if (action === 'seed') {
      const { standard_id } = params;
      if (!standard_id) {
        return NextResponse.json({ error: 'standard_id required' }, { status: 400 });
      }

      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseKey =
        process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

      if (!supabaseUrl || !supabaseKey) {
        return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 });
      }

      const supabase = createClient(supabaseUrl, supabaseKey);

      // Step 1 — Look up standard code
      const { data: standard, error: standardError } = await supabase
        .from('standards')
        .select('code, title')
        .eq('id', standard_id)
        .single();

      if (standardError || !standard) {
        return NextResponse.json({ error: 'Standard not found' }, { status: 404 });
      }

      const searchTerms = SEARCH_TERMS[standard.code as string];
      if (!searchTerms) {
        return NextResponse.json(
          { error: `No search terms configured for standard ${standard.code}` },
          { status: 400 },
        );
      }

      console.log(`[Gutenberg] Seeding standard ${standard.code} — "${standard.title}"`);
      console.log(`[Gutenberg] Search terms: "${searchTerms}"`);

      // Query Gutendex
      const gutendexRes = await fetch(
        `https://gutendex.com/books?search=${encodeURIComponent(searchTerms)}`,
        { headers: { Accept: 'application/json' } },
      );
      if (!gutendexRes.ok) {
        return NextResponse.json({ error: 'Gutendex request failed' }, { status: 502 });
      }

      const gutendexData = await gutendexRes.json();
      const allBooks: GutendexBook[] = gutendexData.results || [];

      // Step 2 — Select first 3 results that have plain text content
      const booksWithText = allBooks.filter((b) => !!getTextUrl(b.formats)).slice(0, 3);

      if (booksWithText.length === 0) {
        return NextResponse.json(
          { error: 'No books with text content found for these search terms' },
          { status: 404 },
        );
      }

      const log: string[] = [];
      let totalInserted = 0;

      // Build the base URL for internal Claude API calls
      const origin = new URL(req.url).origin;
      const claudeApiUrl = `${origin}/api/claude`;

      for (const book of booksWithText) {
        const textUrl = getTextUrl(book.formats)!;
        const authorName = book.authors.map((a) => a.name).join(', ');
        const bookLabel = `"${book.title}" by ${authorName}`;

        console.log(`[Gutenberg]   Fetching: ${bookLabel}`);
        log.push(`Fetching: ${bookLabel}`);

        // Fetch book text
        const textRes = await fetch(textUrl);
        if (!textRes.ok) {
          const msg = `Skipped ${bookLabel} (text fetch failed: ${textRes.status})`;
          console.log(`[Gutenberg]   ${msg}`);
          log.push(msg);
          continue;
        }

        const fullText = await textRes.text();
        const truncatedText = fullText.slice(0, 8000);

        // Step 3 — Call Claude to extract passages
        const claudeRes = await fetch(claudeApiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'extract_passages',
            standardCode: standard.code,
            standardTitle: standard.title,
            bookText: truncatedText,
            sourceTitle: book.title,
            sourceAuthor: authorName,
          }),
        });

        if (!claudeRes.ok) {
          const msg = `Skipped ${bookLabel} (Claude extraction failed: ${claudeRes.status})`;
          console.log(`[Gutenberg]   ${msg}`);
          log.push(msg);
          continue;
        }

        const claudeData = await claudeRes.json();
        const rawText: string = claudeData.text || '';
        const cleanedText = stripMarkdownFences(rawText);

        let passages: ExtractedPassage[];
        try {
          passages = JSON.parse(cleanedText);
          if (!Array.isArray(passages)) throw new Error('Not an array');
        } catch {
          const msg = `Skipped ${bookLabel} (Claude returned invalid JSON)`;
          console.log(`[Gutenberg]   ${msg}`);
          log.push(msg);
          continue;
        }

        // Step 4 — Insert into questions table
        const rows = passages.map((p) => ({
          standard_id,
          content: p.content,
          cognitive_skill_targeted: p.cognitive_skill_targeted,
          difficulty_level: p.difficulty_level,
          created_at: new Date().toISOString(),
        }));

        const { error: insertError } = await supabase.from('questions').insert(rows);
        if (insertError) {
          const msg = `Insert error for ${bookLabel}: ${insertError.message}`;
          console.log(`[Gutenberg]   ${msg}`);
          log.push(msg);
          continue;
        }

        const msg = `Extracted and inserted ${rows.length} passages from ${bookLabel}`;
        console.log(`[Gutenberg]   ${msg}`);
        log.push(msg);
        totalInserted += rows.length;
      }

      console.log(
        `[Gutenberg] Done seeding ${standard.code} — ${totalInserted} passages inserted`,
      );

      return NextResponse.json({
        success: true,
        standard: standard.code,
        booksProcessed: booksWithText.length,
        passagesInserted: totalInserted,
        log,
      });
    }

    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (err) {
    console.error('[Gutenberg API] Error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
