CREATE TABLE IF NOT EXISTS public.demo_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id uuid NOT NULL,
  participant_label text NOT NULL,
  tester_type text NOT NULL DEFAULT 'adult' CHECK (tester_type IN ('adult', 'teacher', 'student', 'other')),
  context_note text,
  consent_research boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_demo_participants_auth_user ON public.demo_participants(auth_user_id);
CREATE INDEX IF NOT EXISTS idx_demo_participants_created ON public.demo_participants(created_at DESC);

DO $$
BEGIN
  IF to_regclass('public.layer0_assessments') IS NOT NULL THEN
    ALTER TABLE public.layer0_assessments
      ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS demo_participant_id uuid REFERENCES public.demo_participants(id);

    CREATE INDEX IF NOT EXISTS idx_layer0_assessments_demo_participant
    ON public.layer0_assessments(demo_participant_id);
  END IF;
END $$;

ALTER TABLE public.demo_participants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "demo users manage own participants" ON public.demo_participants;
CREATE POLICY "demo users manage own participants"
ON public.demo_participants
FOR ALL
TO authenticated
USING (auth_user_id = auth.uid())
WITH CHECK (auth_user_id = auth.uid());

DROP POLICY IF EXISTS "teachers read demo participants" ON public.demo_participants;
CREATE POLICY "teachers read demo participants"
ON public.demo_participants
FOR SELECT
TO authenticated
USING (public.get_my_role() IN ('teacher', 'admin'));

GRANT ALL ON TABLE public.demo_participants TO authenticated;
GRANT ALL ON TABLE public.demo_participants TO service_role;
