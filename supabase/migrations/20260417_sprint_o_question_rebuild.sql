-- Sprint O — Question bank rebuild + routing update
-- Run this in Supabase SQL editor BEFORE running scripts/seed-sprint-o.ts

-- ─── Phase 1: New tables ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS passage_chunks (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  standard_id      uuid        REFERENCES standards(id),
  passage_title    text,
  chunk_number     int,
  chunk_text       text,
  rung_type        text,
  question_stem    text,
  option_a_text    text,
  option_a_class   text,
  option_a_strategy text,
  option_b_text    text,
  option_b_class   text,
  option_b_strategy text,
  option_c_text    text,
  option_c_class   text,
  option_c_strategy text,
  option_d_text    text,
  option_d_class   text,
  option_d_strategy text,
  correct_option   text,
  rationale        text,
  approved         boolean     DEFAULT false,
  created_at       timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS inferencing_strategies (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  strategy_code        text        UNIQUE,
  strategy_name        text,
  opening_line         text,
  guiding_question_1   text,
  guiding_question_2   text,
  guiding_question_3   text,
  hint_text            text,
  explanation_text     text,
  created_at           timestamptz DEFAULT now()
);

-- ─── Phase 1: Add strategy columns to questions ───────────────────────────────

ALTER TABLE questions
  ADD COLUMN IF NOT EXISTS option_a_strategy text;
ALTER TABLE questions
  ADD COLUMN IF NOT EXISTS option_b_strategy text;
ALTER TABLE questions
  ADD COLUMN IF NOT EXISTS option_c_strategy text;
ALTER TABLE questions
  ADD COLUMN IF NOT EXISTS option_d_strategy text;

-- ─── Phase 2: Seed 6 inferencing strategies ───────────────────────────────────

INSERT INTO inferencing_strategies (strategy_code, strategy_name, opening_line, guiding_question_1, guiding_question_2, guiding_question_3, hint_text, explanation_text)
VALUES

(
  'says_vs_means',
  'Says vs Means',
  'You found what the text SAYS. Now find what it MEANS. Those are two different things.',
  'What does this part of the text literally say? Just the facts.',
  'Why would a character say or do this? What does it reveal about them beyond the surface?',
  'What is the author implying here that they never directly stated?',
  'The correct answer goes BEYOND what the text says. If you can point to the exact words that prove your answer — it might be too literal.',
  'The author chose these specific words to imply something deeper. The gap between what is said and what is meant — that gap IS the inference.'
),

(
  'look_back',
  'Look Back',
  'The answer to this question is connected to something earlier in the passage. You need to find that connection.',
  'Scroll back to the earlier part of the passage. What important information did the author give you there?',
  'Now look at this question moment. What is the author asking you to understand here?',
  'How does what you found earlier connect to this moment? Write the link explicitly.',
  'Working memory tip: the passage gave you a clue earlier that you may have forgotten by the time you reached this question. The two parts connect.',
  'Good readers hold earlier information while reading later sections. The connection between those two moments is what produces the inference.'
),

(
  'real_world_connect',
  'Real World Connect',
  'You need real-world knowledge to understand what this text is implying. Let''s build that bridge.',
  'Think about a situation in real life that is similar to what is happening in this passage. What would you expect to happen in that situation?',
  'What do people usually feel, do, or believe when they are in this kind of situation?',
  'Now apply that real-world knowledge to the text. Given what you know — what is the author implying?',
  'The author assumed you would bring real-world knowledge to this moment. Think about what you know about human behavior in similar situations.',
  'This inference requires connecting what happens in the text to what you know about how people and situations actually work in the world.'
),

(
  'stay_in_text',
  'Stay in the Text',
  'Your answer sounds reasonable — but is it actually supported by THIS text? Let''s check.',
  'Find the specific words in the passage that prove your answer. Quote them exactly.',
  'If you cannot find specific words — where did your answer come from? Outside knowledge? A feeling?',
  'Now re-read the passage. What does THIS author actually show or imply — staying only in the text?',
  'Every correct answer must be provable from the passage itself. If your evidence comes from outside the text — look again.',
  'Strong readers stay anchored to the text while inferring. The inference goes beyond what is stated — but it must be supported by what IS stated.'
),

(
  'denotation_vs_connotation',
  'Denotation vs Connotation',
  'You found what this word MEANS. Now find what it FEELS like. Those are two different things.',
  'What is the literal definition of this word — its denotation?',
  'What emotion or attitude does this word carry — its connotation? What feeling does it create in the reader?',
  'Why did the author choose THIS word instead of a simpler one? What effect were they going for?',
  'Authors choose words for their emotional weight, not just their meaning. The connotation — the feeling — is the key to understanding tone and mood.',
  'Every word carries both a definition and an emotional charge. The author''s word choices reveal their attitude and create the mood of the text.'
),

(
  'topic_vs_theme',
  'Topic vs Theme',
  'You identified what this text is ABOUT. Now identify what the text is SAYING about that topic.',
  'What is the topic of this text — what subject does it deal with? (One or two words.)',
  'What does the author SAY about that topic? What claim is being made about human experience?',
  'Write a complete theme statement: [Topic] + [what the text says about it] = universal human truth.',
  'A theme is never just one word. ''Loyalty'' is a topic. ''Loyalty requires sacrifice'' is a theme. The theme makes a claim about human experience.',
  'The difference between topic and theme is the difference between what a story is about and what it means. Theme applies to anyone, anywhere — that''s what makes it universal.'
)

ON CONFLICT (strategy_code) DO UPDATE SET
  strategy_name      = EXCLUDED.strategy_name,
  opening_line       = EXCLUDED.opening_line,
  guiding_question_1 = EXCLUDED.guiding_question_1,
  guiding_question_2 = EXCLUDED.guiding_question_2,
  guiding_question_3 = EXCLUDED.guiding_question_3,
  hint_text          = EXCLUDED.hint_text,
  explanation_text   = EXCLUDED.explanation_text;
