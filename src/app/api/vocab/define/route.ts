/**
 * POST /api/vocab/define
 *
 * Body: { word: string; passageContext?: string }
 * Returns: { word, part_of_speech, definition, example }
 *
 * Requires a `vocab_cache` table in Supabase. Create it with:
 *
 *   create table vocab_cache (
 *     id           uuid primary key default gen_random_uuid(),
 *     word         text not null unique,
 *     part_of_speech text not null default '',
 *     definition   text not null default '',
 *     example      text not null default '',
 *     created_at   timestamptz not null default now()
 *   );
 *   alter table vocab_cache enable row level security;
 *   create policy "service role full access" on vocab_cache
 *     using (true) with check (true);
 */

import Anthropic from '@anthropic-ai/sdk';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  const { word, passageContext } = (await request.json()) as {
    word: string;
    passageContext?: string;
  };

  if (!word?.trim()) {
    return Response.json({ error: 'word is required' }, { status: 400 });
  }

  const supabase = await createServerSupabaseClient();

  // ── Cache lookup ────────────────────────────────────────────────────────────
  const { data: cached } = await supabase
    .from('vocab_cache')
    .select('word, part_of_speech, definition, example')
    .eq('word', word.toLowerCase())
    .maybeSingle();

  if (cached) return Response.json(cached);

  // ── Generate with Claude ────────────────────────────────────────────────────
  const client = new Anthropic();

  let def: { part_of_speech: string; definition: string; example: string };

  try {
    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 200,
      system: `You are a vocabulary assistant for 9th-grade students reading classic literature. Given a word and optional passage context, return a JSON object with exactly three fields:
- "part_of_speech": the grammatical role (e.g. "noun", "verb", "adjective")
- "definition": a clear, student-friendly definition (1-2 sentences, max 30 words)
- "example": a short original example sentence using the word naturally

Respond with ONLY valid JSON. No markdown fences, no extra keys, no explanation.`,
      messages: [
        {
          role: 'user',
          content: `Word: "${word}"${passageContext ? `\nPassage context: "${passageContext.slice(0, 300)}"` : ''}`,
        },
      ],
    });

    const raw = message.content[0].type === 'text' ? message.content[0].text : '{}';
    def = JSON.parse(raw.replace(/```json\n?|```/g, '').trim());
  } catch (err) {
    console.error('[vocab/define] Claude call failed:', err);
    def = { part_of_speech: '', definition: 'Definition unavailable.', example: '' };
  }

  const result = {
    word: word.toLowerCase(),
    part_of_speech: def.part_of_speech ?? '',
    definition: def.definition ?? '',
    example: def.example ?? '',
  };

  // ── Write to cache (best-effort) ────────────────────────────────────────────
  supabase.from('vocab_cache').insert(result).then(({ error }) => {
    if (error) console.error('[vocab/define] cache insert failed:', error.message);
  });

  return Response.json(result);
}
