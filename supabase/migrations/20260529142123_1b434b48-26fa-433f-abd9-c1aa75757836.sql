
-- 1. Hide sensitive profile columns from anon/authenticated reads (admin code uses service role)
REVOKE SELECT (admin_notes, temp_password) ON public.profiles FROM anon, authenticated;

-- 2. Restrict course-videos write to admins only
DROP POLICY IF EXISTS "Authenticated users upload course videos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users update course videos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users delete course videos" ON storage.objects;

CREATE POLICY "Admins upload course videos" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'course-videos' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins update course videos" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'course-videos' AND public.has_role(auth.uid(), 'admin'))
  WITH CHECK (bucket_id = 'course-videos' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins delete course videos" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'course-videos' AND public.has_role(auth.uid(), 'admin'));

-- 3. Restrict module-thumbnails write to admins only
DROP POLICY IF EXISTS "Authenticated upload module thumbnails" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated update module thumbnails" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated delete module thumbnails" ON storage.objects;
-- The "Admin write module-thumbnails" ALL policy already covers admin writes.

-- 4. Restrict user_chapter_progress reads to own user + admin/moderator
DROP POLICY IF EXISTS "progress_select" ON public.user_chapter_progress;
CREATE POLICY "progress_select" ON public.user_chapter_progress
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'moderator')
  );
