-- Allow super_admin (and manager) to upload/update/delete chapter images,
-- not only the 'admin' uploader role.
DROP POLICY IF EXISTS "Admins upload chapter images" ON storage.objects;
DROP POLICY IF EXISTS "Admins update chapter images" ON storage.objects;
DROP POLICY IF EXISTS "Admins delete chapter images" ON storage.objects;

CREATE POLICY "Staff upload chapter images"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'chapter-images' AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
    OR public.has_role(auth.uid(), 'manager'::public.app_role)
  )
);

CREATE POLICY "Staff update chapter images"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'chapter-images' AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
    OR public.has_role(auth.uid(), 'manager'::public.app_role)
  )
);

CREATE POLICY "Staff delete chapter images"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'chapter-images' AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
    OR public.has_role(auth.uid(), 'manager'::public.app_role)
  )
);