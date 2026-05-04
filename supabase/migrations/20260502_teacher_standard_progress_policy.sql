DROP POLICY IF EXISTS "teachers manage own students progress" ON public.standard_progress;

CREATE POLICY "teachers manage own students progress"
ON public.standard_progress FOR ALL
USING (
  public.get_my_role() = 'admin'
  OR student_id IN (
    SELECT id FROM public.students WHERE teacher_id = auth.uid()
  )
)
WITH CHECK (
  public.get_my_role() = 'admin'
  OR student_id IN (
    SELECT id FROM public.students WHERE teacher_id = auth.uid()
  )
);
