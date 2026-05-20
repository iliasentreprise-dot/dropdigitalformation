
-- 1. reply_to_id sur group_messages
ALTER TABLE public.group_messages
  ADD COLUMN IF NOT EXISTS reply_to_id uuid REFERENCES public.group_messages(id) ON DELETE SET NULL;

-- 2. message_reactions
CREATE TABLE IF NOT EXISTS public.message_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES public.group_messages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  emoji text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (message_id, user_id, emoji)
);
ALTER TABLE public.message_reactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS mr_select ON public.message_reactions;
DROP POLICY IF EXISTS mr_insert ON public.message_reactions;
DROP POLICY IF EXISTS mr_delete ON public.message_reactions;
CREATE POLICY mr_select ON public.message_reactions FOR SELECT TO authenticated USING (true);
CREATE POLICY mr_insert ON public.message_reactions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY mr_delete ON public.message_reactions FOR DELETE TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'moderator'));
ALTER PUBLICATION supabase_realtime ADD TABLE public.message_reactions;

-- 3. follows
CREATE TABLE IF NOT EXISTS public.follows (
  follower_id uuid NOT NULL,
  following_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (follower_id, following_id),
  CHECK (follower_id <> following_id)
);
ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS follows_select ON public.follows;
DROP POLICY IF EXISTS follows_insert ON public.follows;
DROP POLICY IF EXISTS follows_delete ON public.follows;
CREATE POLICY follows_select ON public.follows FOR SELECT USING (true);
CREATE POLICY follows_insert ON public.follows FOR INSERT TO authenticated WITH CHECK (auth.uid() = follower_id);
CREATE POLICY follows_delete ON public.follows FOR DELETE TO authenticated USING (auth.uid() = follower_id);

-- compteurs
CREATE OR REPLACE FUNCTION public.update_follow_counts()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.profiles SET following_count = COALESCE(following_count,0)+1 WHERE id = NEW.follower_id;
    UPDATE public.profiles SET followers_count = COALESCE(followers_count,0)+1 WHERE id = NEW.following_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.profiles SET following_count = GREATEST(COALESCE(following_count,0)-1,0) WHERE id = OLD.follower_id;
    UPDATE public.profiles SET followers_count = GREATEST(COALESCE(followers_count,0)-1,0) WHERE id = OLD.following_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END $$;
DROP TRIGGER IF EXISTS trg_follow_counts ON public.follows;
CREATE TRIGGER trg_follow_counts AFTER INSERT OR DELETE ON public.follows
  FOR EACH ROW EXECUTE FUNCTION public.update_follow_counts();

-- auto-follow admin pour nouveaux profils
CREATE OR REPLACE FUNCTION public.auto_follow_admin()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE admin_id uuid;
BEGIN
  SELECT user_id INTO admin_id FROM public.user_roles WHERE role='admin' ORDER BY created_at LIMIT 1;
  IF admin_id IS NOT NULL AND admin_id <> NEW.id THEN
    INSERT INTO public.follows (follower_id, following_id) VALUES (NEW.id, admin_id)
      ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_auto_follow_admin ON public.profiles;
CREATE TRIGGER trg_auto_follow_admin AFTER INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.auto_follow_admin();

-- rattrapage : tous suivent l'admin
INSERT INTO public.follows (follower_id, following_id)
SELECT p.id, ur.user_id
FROM public.profiles p
CROSS JOIN (SELECT user_id FROM public.user_roles WHERE role='admin' ORDER BY created_at LIMIT 1) ur
WHERE p.id <> ur.user_id
ON CONFLICT DO NOTHING;

-- recalcul des compteurs
UPDATE public.profiles p SET
  followers_count = (SELECT COUNT(*) FROM public.follows f WHERE f.following_id = p.id),
  following_count = (SELECT COUNT(*) FROM public.follows f WHERE f.follower_id = p.id);

-- 4. muted users
CREATE TABLE IF NOT EXISTS public.muted_users (
  user_id uuid PRIMARY KEY,
  muted_by uuid NOT NULL,
  muted_at timestamptz NOT NULL DEFAULT now(),
  reason text
);
ALTER TABLE public.muted_users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS muted_select ON public.muted_users;
DROP POLICY IF EXISTS muted_write ON public.muted_users;
CREATE POLICY muted_select ON public.muted_users FOR SELECT TO authenticated USING (true);
CREATE POLICY muted_write ON public.muted_users FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'moderator'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'moderator'));

-- bloquer envoi de message si muté (ne pas muter l'admin)
DROP POLICY IF EXISTS group_messages_insert ON public.group_messages;
CREATE POLICY group_messages_insert ON public.group_messages FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND (
      public.has_role(auth.uid(),'admin')
      OR NOT EXISTS (SELECT 1 FROM public.muted_users WHERE user_id = auth.uid())
    )
  );
