UPDATE public.students
SET full_name = 'Noah Rivera'
WHERE lower(coalesce(full_name, '')) IN ('student 1', 'student1', 'test student one')
   OR user_id IN (
    SELECT id
    FROM public.users
    WHERE lower(email) = 'student1@gogi.pilot'
  );

UPDATE public.users
SET full_name = 'Noah Rivera'
WHERE lower(email) = 'student1@gogi.pilot'
  AND (full_name IS NULL OR lower(full_name) IN ('student 1', 'student1', 'test student one'));
