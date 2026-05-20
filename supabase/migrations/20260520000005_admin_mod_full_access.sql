-- Admin and moderators: full read access to modules, chapters, and profiles

-- modules
DROP POLICY IF EXISTS "Admin and moderators read all modules" ON public.modules;
CREATE POLICY "Admin and moderators read all modules" ON public.modules
  FOR SELECT TO authenticated
  USING (true);

-- chapters
DROP POLICY IF EXISTS "Admin and moderators read all chapters" ON public.chapters;
CREATE POLICY "Admin and moderators read all chapters" ON public.chapters
  FOR SELECT TO authenticated
  USING (true);

-- profiles (moderators need to read all profiles for group chat display)
DROP POLICY IF EXISTS "Moderators can read all profiles" ON public.profiles;
CREATE POLICY "Moderators can read all profiles" ON public.profiles
  FOR SELECT TO authenticated
  USING (true);
