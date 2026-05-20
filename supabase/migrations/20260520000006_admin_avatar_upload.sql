-- Admin can upload and update any user's avatar in the avatars bucket

DROP POLICY IF EXISTS "Admin can upload any avatar" ON storage.objects;
CREATE POLICY "Admin can upload any avatar" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'avatars'
    AND EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Admin can update any avatar" ON storage.objects;
CREATE POLICY "Admin can update any avatar" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'avatars'
    AND EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );
