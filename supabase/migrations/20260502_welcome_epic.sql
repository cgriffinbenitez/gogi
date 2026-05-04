ALTER TABLE public.students
ADD COLUMN IF NOT EXISTS welcome_completed_at timestamptz;

CREATE TABLE IF NOT EXISTS public.welcome_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (event_type IN ('viewed', 'frame_advanced', 'completed', 'abandoned')),
  frame_key text,
  time_on_frame_ms integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_welcome_events_student
ON public.welcome_events(student_id, created_at DESC);

ALTER TABLE public.welcome_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "students manage own welcome events" ON public.welcome_events;
CREATE POLICY "students manage own welcome events"
ON public.welcome_events FOR ALL
USING (
  student_id IN (
    SELECT id FROM public.students WHERE user_id = auth.uid()
  )
)
WITH CHECK (
  student_id IN (
    SELECT id FROM public.students WHERE user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "teachers read own students welcome events" ON public.welcome_events;
CREATE POLICY "teachers read own students welcome events"
ON public.welcome_events FOR SELECT
USING (
  student_id IN (
    SELECT id FROM public.students WHERE teacher_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "students update own welcome completion" ON public.students;
CREATE POLICY "students update own welcome completion"
ON public.students FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

GRANT SELECT, INSERT, UPDATE ON TABLE public.welcome_events TO authenticated;
GRANT ALL ON TABLE public.welcome_events TO service_role;
