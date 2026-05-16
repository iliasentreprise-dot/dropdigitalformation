
-- 1) chapter_resources
CREATE TABLE IF NOT EXISTS public.chapter_resources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chapter_id uuid NOT NULL REFERENCES public.chapters(id) ON DELETE CASCADE,
  title text NOT NULL,
  file_url text NOT NULL,
  file_type text NOT NULL DEFAULT 'pdf',
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.chapter_resources ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "chapter_resources_select" ON public.chapter_resources;
CREATE POLICY "chapter_resources_select" ON public.chapter_resources
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "chapter_resources_admin_all" ON public.chapter_resources;
CREATE POLICY "chapter_resources_admin_all" ON public.chapter_resources
  FOR ALL USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 2) module_completions
CREATE TABLE IF NOT EXISTS public.module_completions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  module_id uuid NOT NULL REFERENCES public.modules(id) ON DELETE CASCADE,
  completed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, module_id)
);
ALTER TABLE public.module_completions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "module_completions_own" ON public.module_completions;
CREATE POLICY "module_completions_own" ON public.module_completions
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 3) chapter_reactions
CREATE TABLE IF NOT EXISTS public.chapter_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  chapter_id uuid NOT NULL REFERENCES public.chapters(id) ON DELETE CASCADE,
  reaction text NOT NULL CHECK (reaction IN ('like', 'fire', 'lightbulb', 'think')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, chapter_id)
);
ALTER TABLE public.chapter_reactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "chapter_reactions_select" ON public.chapter_reactions;
CREATE POLICY "chapter_reactions_select" ON public.chapter_reactions
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "chapter_reactions_own_write" ON public.chapter_reactions;
CREATE POLICY "chapter_reactions_own_write" ON public.chapter_reactions
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 4) profile columns (idempotent)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS bio text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS show_progression boolean NOT NULL DEFAULT true;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS username_changed boolean NOT NULL DEFAULT false;

-- 5) Storage buckets
INSERT INTO storage.buckets (id, name, public) VALUES ('chapter-resources', 'chapter-resources', true) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('module-thumbnails', 'module-thumbnails', true) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true) ON CONFLICT (id) DO NOTHING;

-- Storage policies
DROP POLICY IF EXISTS "Public read chapter-resources" ON storage.objects;
CREATE POLICY "Public read chapter-resources" ON storage.objects FOR SELECT USING (bucket_id = 'chapter-resources');
DROP POLICY IF EXISTS "Admin write chapter-resources" ON storage.objects;
CREATE POLICY "Admin write chapter-resources" ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'chapter-resources' AND public.has_role(auth.uid(), 'admin'))
  WITH CHECK (bucket_id = 'chapter-resources' AND public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Public read module-thumbnails" ON storage.objects;
CREATE POLICY "Public read module-thumbnails" ON storage.objects FOR SELECT USING (bucket_id = 'module-thumbnails');
DROP POLICY IF EXISTS "Admin write module-thumbnails" ON storage.objects;
CREATE POLICY "Admin write module-thumbnails" ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'module-thumbnails' AND public.has_role(auth.uid(), 'admin'))
  WITH CHECK (bucket_id = 'module-thumbnails' AND public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Public read avatars" ON storage.objects;
CREATE POLICY "Public read avatars" ON storage.objects FOR SELECT USING (bucket_id = 'avatars');
DROP POLICY IF EXISTS "Users manage own avatar" ON storage.objects;
CREATE POLICY "Users manage own avatar" ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
