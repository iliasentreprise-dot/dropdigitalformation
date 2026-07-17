-- Tighten user_roles SELECT so authenticated users can only read their own roles.
-- The has_role() SECURITY DEFINER function is used everywhere role checks are needed.
DROP POLICY IF EXISTS "All authenticated users can read all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Authenticated can read roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users read all roles" ON public.user_roles;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='user_roles' AND policyname='Users read own roles'
  ) THEN
    CREATE POLICY "Users read own roles" ON public.user_roles
      FOR SELECT TO authenticated
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='user_roles' AND policyname='Admins read all roles'
  ) THEN
    CREATE POLICY "Admins read all roles" ON public.user_roles
      FOR SELECT TO authenticated
      USING (public.has_role(auth.uid(), 'admin'::app_role));
  END IF;
END$$;