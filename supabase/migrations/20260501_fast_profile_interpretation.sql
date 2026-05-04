ALTER TABLE public.student_cognitive_profiles
ADD COLUMN IF NOT EXISTS confidence_label text NOT NULL DEFAULT 'not_enough_data'
CHECK (confidence_label IN ('strong_signal', 'emerging_signal', 'not_enough_data')),
ADD COLUMN IF NOT EXISTS interpretation jsonb NOT NULL DEFAULT '{}'::jsonb;
