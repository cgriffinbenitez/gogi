ALTER TABLE public.demo_participants
  ADD COLUMN IF NOT EXISTS run_mode text NOT NULL DEFAULT 'demo'
  CHECK (run_mode IN ('demo', 'research'));

ALTER TABLE public.layer0_assessments
  ADD COLUMN IF NOT EXISTS run_mode text NOT NULL DEFAULT 'student'
  CHECK (run_mode IN ('student', 'demo', 'research'));

CREATE INDEX IF NOT EXISTS idx_demo_participants_run_mode
ON public.demo_participants(run_mode);

CREATE INDEX IF NOT EXISTS idx_layer0_assessments_run_mode
ON public.layer0_assessments(run_mode);
