DROP POLICY IF EXISTS "admins manage released booklets" ON public.released_test_booklets;
CREATE POLICY "released item managers manage booklets"
ON public.released_test_booklets FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid()
      AND u.role IN ('teacher', 'admin')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid()
      AND u.role IN ('teacher', 'admin')
  )
);

DROP POLICY IF EXISTS "admins manage released passages" ON public.released_passages;
CREATE POLICY "released item managers manage passages"
ON public.released_passages FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid()
      AND u.role IN ('teacher', 'admin')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid()
      AND u.role IN ('teacher', 'admin')
  )
);

DROP POLICY IF EXISTS "admins manage released items" ON public.released_items;
CREATE POLICY "released item managers manage items"
ON public.released_items FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid()
      AND u.role IN ('teacher', 'admin')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid()
      AND u.role IN ('teacher', 'admin')
  )
);

DROP POLICY IF EXISTS "admins manage released item classifications" ON public.released_item_classifications;
CREATE POLICY "released item managers manage classifications"
ON public.released_item_classifications FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid()
      AND u.role IN ('teacher', 'admin')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid()
      AND u.role IN ('teacher', 'admin')
  )
);

DROP POLICY IF EXISTS "admins manage released item tiers" ON public.released_item_tiers;
CREATE POLICY "released item managers manage tiers"
ON public.released_item_tiers FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid()
      AND u.role IN ('teacher', 'admin')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid()
      AND u.role IN ('teacher', 'admin')
  )
);

DROP POLICY IF EXISTS "admins manage released item roles" ON public.released_item_roles;
CREATE POLICY "released item managers manage roles"
ON public.released_item_roles FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid()
      AND u.role IN ('teacher', 'admin')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid()
      AND u.role IN ('teacher', 'admin')
  )
);

DROP POLICY IF EXISTS "admins manage released item review queue" ON public.released_item_review_queue;
CREATE POLICY "released item managers manage review queue"
ON public.released_item_review_queue FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid()
      AND u.role IN ('teacher', 'admin')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid()
      AND u.role IN ('teacher', 'admin')
  )
);

DROP POLICY IF EXISTS "admins upload released fast booklets" ON storage.objects;
CREATE POLICY "released item managers upload booklets"
ON storage.objects FOR ALL
USING (
  bucket_id = 'released-fast-booklets'
  AND EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid()
      AND u.role IN ('teacher', 'admin')
  )
)
WITH CHECK (
  bucket_id = 'released-fast-booklets'
  AND EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid()
      AND u.role IN ('teacher', 'admin')
  )
);
