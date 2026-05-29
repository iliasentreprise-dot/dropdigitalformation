DROP POLICY IF EXISTS "progress_select" ON public.user_chapter_progress;
CREATE POLICY "progress_select" ON public.user_chapter_progress
  FOR SELECT TO authenticated
  USING (true);