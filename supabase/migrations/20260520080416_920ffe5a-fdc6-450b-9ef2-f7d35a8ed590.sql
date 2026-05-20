
-- Results posts (the wall)
CREATE TABLE IF NOT EXISTS public.results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content text NOT NULL CHECK (char_length(content) BETWEEN 1 AND 2000),
  amount integer,
  photo_url text,
  visible boolean NOT NULL DEFAULT true,
  deleted_at timestamptz,
  deleted_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_results_created_at ON public.results (created_at DESC);
ALTER TABLE public.results ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "results_select" ON public.results;
CREATE POLICY "results_select" ON public.results FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "results_insert" ON public.results;
CREATE POLICY "results_insert" ON public.results FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "results_update" ON public.results;
CREATE POLICY "results_update" ON public.results FOR UPDATE TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderator'));
DROP POLICY IF EXISTS "results_delete" ON public.results;
CREATE POLICY "results_delete" ON public.results FOR DELETE TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

ALTER PUBLICATION supabase_realtime ADD TABLE public.results;

-- Reactions on results
CREATE TABLE IF NOT EXISTS public.result_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  result_id uuid NOT NULL REFERENCES public.results(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  emoji text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (result_id, user_id, emoji)
);
ALTER TABLE public.result_reactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rr_select" ON public.result_reactions;
CREATE POLICY "rr_select" ON public.result_reactions FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "rr_insert" ON public.result_reactions;
CREATE POLICY "rr_insert" ON public.result_reactions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "rr_delete" ON public.result_reactions;
CREATE POLICY "rr_delete" ON public.result_reactions FOR DELETE TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderator'));
ALTER PUBLICATION supabase_realtime ADD TABLE public.result_reactions;

-- Comments on results
CREATE TABLE IF NOT EXISTS public.result_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  result_id uuid NOT NULL REFERENCES public.results(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 1000),
  deleted_at timestamptz,
  deleted_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_result_comments ON public.result_comments (result_id, created_at);
ALTER TABLE public.result_comments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rc_select" ON public.result_comments;
CREATE POLICY "rc_select" ON public.result_comments FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "rc_insert" ON public.result_comments;
CREATE POLICY "rc_insert" ON public.result_comments FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "rc_update" ON public.result_comments;
CREATE POLICY "rc_update" ON public.result_comments FOR UPDATE TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderator'));
DROP POLICY IF EXISTS "rc_delete" ON public.result_comments;
CREATE POLICY "rc_delete" ON public.result_comments FOR DELETE TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderator'));
ALTER PUBLICATION supabase_realtime ADD TABLE public.result_comments;

-- Storage bucket for result photos
INSERT INTO storage.buckets (id, name, public) VALUES ('result-photos', 'result-photos', true)
  ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "result_photos_read" ON storage.objects;
CREATE POLICY "result_photos_read" ON storage.objects FOR SELECT USING (bucket_id = 'result-photos');
DROP POLICY IF EXISTS "result_photos_upload" ON storage.objects;
CREATE POLICY "result_photos_upload" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'result-photos' AND auth.uid()::text = (storage.foldername(name))[1]);
DROP POLICY IF EXISTS "result_photos_delete" ON storage.objects;
CREATE POLICY "result_photos_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'result-photos' AND (auth.uid()::text = (storage.foldername(name))[1] OR public.has_role(auth.uid(), 'admin')));
