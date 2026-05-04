-- Durable harvest intelligence foundation.
-- The current app can analyze logs/CSV immediately; these tables give us the
-- future durable database layer so runs do not disappear into terminal output.

CREATE TABLE IF NOT EXISTS gutenberg_harvest_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  standard_code text NOT NULL,
  coverage_strand_id text,
  coverage_strand_label text,
  status text NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'running', 'complete', 'failed', 'cancelled')),
  max_books integer,
  max_passages integer,
  log_path text,
  csv_path text,
  started_at timestamptz DEFAULT now(),
  completed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS gutenberg_harvest_source_stats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid REFERENCES gutenberg_harvest_jobs(id) ON DELETE CASCADE,
  standard_code text NOT NULL,
  coverage_strand_id text,
  classification text,
  source_gutenberg_id integer,
  source_title text,
  source_author text,
  candidates_seen integer DEFAULT 0,
  filter_yes integer DEFAULT 0,
  filter_no integer DEFAULT 0,
  tagged integer DEFAULT 0,
  inserted integer DEFAULT 0,
  write_errors integer DEFAULT 0,
  top_rejection_reason text,
  recommendation text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gutenberg_harvest_jobs_standard_status
  ON gutenberg_harvest_jobs (standard_code, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_gutenberg_harvest_source_stats_standard_strand
  ON gutenberg_harvest_source_stats (standard_code, coverage_strand_id, source_title);

