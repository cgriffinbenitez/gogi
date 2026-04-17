// ─── SCHEMA MIGRATION REQUIRED ───────────────────────────────────────────────
// Run this SQL in Supabase before deploying this file:
//
// CREATE TABLE IF NOT EXISTS passages (
//   id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
//   standard_id   uuid REFERENCES standards(id),
//   gutenberg_id  text,
//   title         text NOT NULL,
//   author        text NOT NULL,
//   pub_year      text,
//   text          text NOT NULL,
//   keyword_flags jsonb DEFAULT '[]',      -- string[] of vocab words to highlight
//   lexile_level  integer,
//   created_at    timestamptz DEFAULT now()
// );
//
// ALTER TABLE sessions ADD COLUMN IF NOT EXISTS passage_id uuid REFERENCES passages(id);
// ─────────────────────────────────────────────────────────────────────────────

import { createClient } from '@/lib/supabase/client';

export interface Passage {
  id: string;
  standard_id: string;
  gutenberg_id: string;
  title: string;
  author: string;
  pub_year: string;
  text: string;
  keyword_flags: string[];
  lexile_level: number;
}

export async function getPassage(
  standardId: string,
  studentId: string,
): Promise<Passage | null> {
  const supabase = createClient();

  // Get seen passage IDs for this student + standard
  const { data: seenSessions } = await supabase
    .from('sessions')
    .select('passage_id')
    .eq('student_id', studentId)
    .eq('standard_id', standardId)
    .not('passage_id', 'is', null);

  const seenIds: string[] = seenSessions
    ?.map((s: { passage_id: string | null }) => s.passage_id)
    .filter((id): id is string => Boolean(id)) ?? [];

  // Fetch unseen passages
  let query = supabase
    .from('passages')
    .select('*')
    .eq('standard_id', standardId);

  if (seenIds.length > 0) {
    query = query.not('id', 'in', `(${seenIds.join(',')})`);
  }

  const { data, error } = await query.limit(10);

  if (error) {
    console.error('[getPassage] passages table error:', error.message);
    return null;
  }

  if (!data || data.length === 0) {
    // All passages seen — reset cycle, return any passage for this standard
    const { data: any } = await supabase
      .from('passages')
      .select('*')
      .eq('standard_id', standardId)
      .limit(1);
    return (any?.[0] as Passage) ?? null;
  }

  // Return a random unseen passage
  return data[Math.floor(Math.random() * data.length)] as Passage;
}
