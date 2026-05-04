CREATE TABLE IF NOT EXISTS public.diagnostic_insights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  standard_id uuid NOT NULL REFERENCES public.standards(id) ON DELETE CASCADE,
  layer0_assessment_id uuid REFERENCES public.layer0_assessments(id),
  load_calibration text CHECK (load_calibration IN ('standard', 'reduced', 'maximum_reduction')),
  primary_misconception text,
  secondary_misconceptions text[] NOT NULL DEFAULT '{}',
  recommended_route text,
  confidence_label text NOT NULL CHECK (confidence_label IN ('strong_signal', 'emerging_signal', 'not_enough_data')),
  confidence_score int NOT NULL DEFAULT 0,
  likely_driver text NOT NULL CHECK (likely_driver IN ('literacy_gap', 'cognitive_load_interaction', 'mastery_ready', 'insufficient_evidence')),
  insight jsonb NOT NULL DEFAULT '{}'::jsonb,
  pre_intervention_response_id uuid REFERENCES public.responses(id),
  post_intervention_response_id uuid REFERENCES public.responses(id),
  growth_signal text CHECK (growth_signal IN ('improved', 'unchanged', 'regressed', 'not_measured')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(session_id)
);

CREATE INDEX IF NOT EXISTS idx_diagnostic_insights_student
ON public.diagnostic_insights(student_id);

CREATE INDEX IF NOT EXISTS idx_diagnostic_insights_standard
ON public.diagnostic_insights(standard_id);

CREATE INDEX IF NOT EXISTS idx_diagnostic_insights_layer0
ON public.diagnostic_insights(layer0_assessment_id);

ALTER TABLE public.diagnostic_insights ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "students read own diagnostic insights" ON public.diagnostic_insights;
CREATE POLICY "students read own diagnostic insights"
ON public.diagnostic_insights
FOR SELECT
TO authenticated
USING (
  student_id IN (SELECT id FROM public.students WHERE user_id = auth.uid())
);

DROP POLICY IF EXISTS "students manage own diagnostic insights" ON public.diagnostic_insights;
CREATE POLICY "students manage own diagnostic insights"
ON public.diagnostic_insights
FOR INSERT
TO authenticated
WITH CHECK (
  student_id IN (SELECT id FROM public.students WHERE user_id = auth.uid())
);

DROP POLICY IF EXISTS "students update own diagnostic insights" ON public.diagnostic_insights;
CREATE POLICY "students update own diagnostic insights"
ON public.diagnostic_insights
FOR UPDATE
TO authenticated
USING (
  student_id IN (SELECT id FROM public.students WHERE user_id = auth.uid())
)
WITH CHECK (
  student_id IN (SELECT id FROM public.students WHERE user_id = auth.uid())
);

DROP POLICY IF EXISTS "teachers read own students diagnostic insights" ON public.diagnostic_insights;
CREATE POLICY "teachers read own students diagnostic insights"
ON public.diagnostic_insights
FOR SELECT
TO authenticated
USING (
  student_id IN (SELECT id FROM public.students WHERE teacher_id = auth.uid())
);

GRANT ALL ON TABLE public.diagnostic_insights TO authenticated;
GRANT ALL ON TABLE public.diagnostic_insights TO service_role;
