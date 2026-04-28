CREATE TABLE intervention_passages (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  classification      text NOT NULL,
  paragraph_text      text NOT NULL,
  word_count          int NOT NULL,
  source              text NOT NULL DEFAULT 'gutenberg',
  source_title        text,
  source_author       text,
  source_year         int,
  source_gutenberg_id int,
  canonical_answer    text,
  distractors         text[],
  keyword_flags       text[],
  difficulty_tier     int CHECK (difficulty_tier IN (1, 2, 3)),
  approved            boolean NOT NULL DEFAULT false,
  reviewed_at         timestamp,
  reviewed_by         uuid,
  rejection_reason    text,
  paragraph_hash      text,
  created_at          timestamp DEFAULT now()
);

CREATE INDEX ON intervention_passages(classification);
CREATE INDEX ON intervention_passages(approved);
CREATE UNIQUE INDEX ON intervention_passages(source_gutenberg_id, paragraph_hash);
