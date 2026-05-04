ALTER TABLE public.fast_assessments
ADD COLUMN IF NOT EXISTS assessment_grade integer;

UPDATE public.fast_assessments
SET assessment_grade = ((regexp_match(test_label, 'Grade ([0-9]+)'))[1])::integer
WHERE assessment_grade IS NULL
  AND test_label ~ 'Grade [0-9]+';

UPDATE public.fast_assessments
SET assessment_grade = 9
WHERE assessment_grade IS NULL;
