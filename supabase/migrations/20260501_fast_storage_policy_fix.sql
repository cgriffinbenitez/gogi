DROP POLICY IF EXISTS "teachers upload fast reports" ON storage.objects;

CREATE POLICY "teachers insert own student fast reports"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'fast-reports'
  AND (
    EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id = auth.uid()
        AND u.role = 'admin'
    )
    OR EXISTS (
      SELECT 1
      FROM public.students s
      WHERE s.teacher_id = auth.uid()
        AND s.id::text = split_part(name, '/', 1)
    )
  )
);

CREATE POLICY "teachers read own student fast reports"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'fast-reports'
  AND (
    EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id = auth.uid()
        AND u.role = 'admin'
    )
    OR EXISTS (
      SELECT 1
      FROM public.students s
      WHERE s.teacher_id = auth.uid()
        AND s.id::text = split_part(name, '/', 1)
    )
  )
);

CREATE POLICY "teachers update own student fast reports"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'fast-reports'
  AND (
    EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id = auth.uid()
        AND u.role = 'admin'
    )
    OR EXISTS (
      SELECT 1
      FROM public.students s
      WHERE s.teacher_id = auth.uid()
        AND s.id::text = split_part(name, '/', 1)
    )
  )
)
WITH CHECK (
  bucket_id = 'fast-reports'
  AND (
    EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id = auth.uid()
        AND u.role = 'admin'
    )
    OR EXISTS (
      SELECT 1
      FROM public.students s
      WHERE s.teacher_id = auth.uid()
        AND s.id::text = split_part(name, '/', 1)
    )
  )
);
