
-- 1) chapters & modules: restrict SELECT to authenticated users
DROP POLICY IF EXISTS chapters_select ON public.chapters;
CREATE POLICY chapters_select ON public.chapters FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS modules_select ON public.modules;
CREATE POLICY modules_select ON public.modules FOR SELECT TO authenticated USING (true);

REVOKE SELECT ON public.chapters FROM anon;
REVOKE SELECT ON public.modules FROM anon;

-- 2) group_messages: restrict SELECT to authenticated
DROP POLICY IF EXISTS group_messages_select ON public.group_messages;
CREATE POLICY group_messages_select ON public.group_messages
  FOR SELECT TO authenticated
  USING ((user_id = auth.uid()) OR (hidden_by_admin = false));

REVOKE SELECT ON public.group_messages FROM anon;

-- 3) profiles: prevent users from modifying sensitive columns via trigger
CREATE OR REPLACE FUNCTION public.protect_profile_sensitive_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Admins can modify anything
  IF public.has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN NEW;
  END IF;
  -- For self-updates, force sensitive columns to their previous values
  NEW.has_software_access := OLD.has_software_access;
  NEW.followers_count := OLD.followers_count;
  NEW.following_count := OLD.following_count;
  NEW.username_changed := OLD.username_changed;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_profile_sensitive_columns_trg ON public.profiles;
CREATE TRIGGER protect_profile_sensitive_columns_trg
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_profile_sensitive_columns();

-- 4) realtime.messages: restrict moderator_sales and private_messages topic subscriptions
DROP POLICY IF EXISTS "moderator_sales_realtime_access" ON realtime.messages;
CREATE POLICY "moderator_sales_realtime_access" ON realtime.messages
  FOR SELECT TO authenticated
  USING (
    -- Allow non-restricted topics; restrict moderator_sales-related topics
    NOT (realtime.topic() IN ('ea_sales_rt', 'moderator_sales'))
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'moderator'::app_role)
  );

DROP POLICY IF EXISTS "private_messages_realtime_access" ON realtime.messages;
CREATE POLICY "private_messages_realtime_access" ON realtime.messages
  FOR SELECT TO authenticated
  USING (
    -- For topics scoped to a user's private messages (pm:<uuid>), require match;
    -- other topics are unaffected by this policy.
    NOT (realtime.topic() LIKE 'pm:%')
    OR realtime.topic() = ('pm:' || auth.uid()::text)
    OR public.has_role(auth.uid(), 'admin'::app_role)
  );

ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;
