-- Allow all authenticated users to read all roles
-- (role badges are public info — no security concern)
DROP POLICY IF EXISTS "All users can read all roles" ON public.user_roles;
CREATE POLICY "All users can read all roles" ON public.user_roles
  FOR SELECT TO authenticated USING (true);

-- SECURITY DEFINER function: returns the top role for any user_id
-- Bypasses RLS so can always be called by any authenticated user
CREATE OR REPLACE FUNCTION public.get_top_role(_user_id uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE
    WHEN EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'admin') THEN 'admin'
    WHEN EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'moderator') THEN 'moderator'
    ELSE 'user'
  END
$$;

-- Batch version: returns (user_id, role) for an array of user_ids
CREATE OR REPLACE FUNCTION public.get_roles_for_users(_user_ids uuid[])
RETURNS TABLE(user_id uuid, role text) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT DISTINCT ON (ur.user_id) ur.user_id,
    CASE ur.role::text
      WHEN 'admin' THEN 'admin'
      WHEN 'moderator' THEN 'moderator'
      ELSE 'user'
    END AS role
  FROM public.user_roles ur
  WHERE ur.user_id = ANY(_user_ids)
  ORDER BY ur.user_id,
    CASE ur.role::text WHEN 'admin' THEN 1 WHEN 'moderator' THEN 2 ELSE 3 END
$$;
