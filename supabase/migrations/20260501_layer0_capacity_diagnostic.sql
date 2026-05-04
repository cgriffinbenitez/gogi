CREATE TABLE IF NOT EXISTS public.layer0_assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  administration_number int NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'abandoned')),
  is_demo boolean NOT NULL DEFAULT false,
  demo_participant_id uuid REFERENCES public.demo_participants(id),
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,

  dsb_max_span int,
  dsb_total_correct int,
  dsb_band text CHECK (dsb_band IN ('low', 'mid', 'adequate')),

  cpt_commission_errors int,
  cpt_omission_errors int,
  cpt_mean_rt_ms int,
  cpt_rt_cv numeric(5,3),
  cpt_band text CHECK (cpt_band IN ('low', 'mid', 'adequate')),

  sdst_correct int,
  sdst_attempted int,
  sdst_band text CHECK (sdst_band IN ('low', 'mid', 'adequate')),

  rtv_band text CHECK (rtv_band IN ('low', 'mid', 'adequate')),
  layer0_composite text CHECK (layer0_composite IN ('high_capacity', 'mixed_capacity', 'low_capacity')),
  load_calibration text CHECK (load_calibration IN ('standard', 'reduced', 'maximum_reduction')),
  teacher_review_flag boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.layer0_trials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id uuid NOT NULL REFERENCES public.layer0_assessments(id) ON DELETE CASCADE,
  task text NOT NULL CHECK (task IN ('dsb', 'sart', 'sdst')),
  trial_index int NOT NULL,
  stimulus text NOT NULL,
  response text,
  is_correct boolean,
  rt_ms int,
  is_target boolean,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_layer0_assessments_student ON public.layer0_assessments(student_id);
CREATE INDEX IF NOT EXISTS idx_layer0_assessments_admin ON public.layer0_assessments(student_id, administration_number);
CREATE INDEX IF NOT EXISTS idx_layer0_assessments_demo_participant ON public.layer0_assessments(demo_participant_id);
CREATE INDEX IF NOT EXISTS idx_layer0_trials_assessment ON public.layer0_trials(assessment_id);

ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS layer0_assessment_id uuid REFERENCES public.layer0_assessments(id),
  ADD COLUMN IF NOT EXISTS load_calibration_at_session text CHECK (load_calibration_at_session IN ('standard', 'reduced', 'maximum_reduction'));

ALTER TABLE public.layer0_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.layer0_trials ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "students manage own layer0 assessments" ON public.layer0_assessments;
CREATE POLICY "students manage own layer0 assessments"
ON public.layer0_assessments
FOR ALL
TO authenticated
USING (
  student_id IN (SELECT id FROM public.students WHERE user_id = auth.uid())
)
WITH CHECK (
  student_id IN (SELECT id FROM public.students WHERE user_id = auth.uid())
);

DROP POLICY IF EXISTS "teachers read own students layer0 assessments" ON public.layer0_assessments;
CREATE POLICY "teachers read own students layer0 assessments"
ON public.layer0_assessments
FOR SELECT
TO authenticated
USING (
  student_id IN (SELECT id FROM public.students WHERE teacher_id = auth.uid())
);

DROP POLICY IF EXISTS "demo users read demo layer0 assessments" ON public.layer0_assessments;
CREATE POLICY "demo users read demo layer0 assessments"
ON public.layer0_assessments
FOR SELECT
TO authenticated
USING (
  is_demo = true
  AND demo_participant_id IN (
    SELECT id FROM public.demo_participants WHERE auth_user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "teachers read demo layer0 assessments" ON public.layer0_assessments;
CREATE POLICY "teachers read demo layer0 assessments"
ON public.layer0_assessments
FOR SELECT
TO authenticated
USING (
  is_demo = true
  AND public.get_my_role() IN ('teacher', 'admin')
);

DROP POLICY IF EXISTS "students manage own layer0 trials" ON public.layer0_trials;
CREATE POLICY "students manage own layer0 trials"
ON public.layer0_trials
FOR ALL
TO authenticated
USING (
  assessment_id IN (
    SELECT a.id
    FROM public.layer0_assessments a
    JOIN public.students s ON s.id = a.student_id
    WHERE s.user_id = auth.uid()
  )
)
WITH CHECK (
  assessment_id IN (
    SELECT a.id
    FROM public.layer0_assessments a
    JOIN public.students s ON s.id = a.student_id
    WHERE s.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "teachers read own students layer0 trials" ON public.layer0_trials;
CREATE POLICY "teachers read own students layer0 trials"
ON public.layer0_trials
FOR SELECT
TO authenticated
USING (
  assessment_id IN (
    SELECT a.id
    FROM public.layer0_assessments a
    JOIN public.students s ON s.id = a.student_id
    WHERE s.teacher_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "demo users read demo layer0 trials" ON public.layer0_trials;
CREATE POLICY "demo users read demo layer0 trials"
ON public.layer0_trials
FOR SELECT
TO authenticated
USING (
  assessment_id IN (
    SELECT a.id
    FROM public.layer0_assessments a
    JOIN public.demo_participants d ON d.id = a.demo_participant_id
    WHERE a.is_demo = true
      AND d.auth_user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "teachers read demo layer0 trials" ON public.layer0_trials;
CREATE POLICY "teachers read demo layer0 trials"
ON public.layer0_trials
FOR SELECT
TO authenticated
USING (
  assessment_id IN (
    SELECT a.id
    FROM public.layer0_assessments a
    WHERE a.is_demo = true
      AND public.get_my_role() IN ('teacher', 'admin')
  )
);
