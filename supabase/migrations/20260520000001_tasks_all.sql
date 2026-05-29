-- ── TÂCHE 2: temp_password sur profiles ──
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS temp_password text;

-- ── TÂCHE 3: admin_notes sur profiles ──
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS admin_notes text;

-- ── TÂCHE 4: group_messages — remplace la policy SELECT, ajoute suppression admin ──
-- Le chat devient temps réel immédiat (pas de modération pré-affichage)
DROP POLICY IF EXISTS "group_messages_select" ON public.group_messages;
CREATE POLICY "Authenticated users can read group messages" ON public.group_messages
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Admin can delete messages" ON public.group_messages;
CREATE POLICY "Admin can delete messages" ON public.group_messages
  FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  ));

-- Messages visibles immédiatement à l'insertion
ALTER TABLE public.group_messages ALTER COLUMN visible SET DEFAULT true;

-- ── TÂCHE 5: user_roles RLS ──
-- Remplace les anciennes policies par une architecture service-role-only pour les écritures
DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can view all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Authenticated users can read roles" ON public.user_roles;
DROP POLICY IF EXISTS "Only service role can manage roles" ON public.user_roles;

-- Les utilisateurs authentifiés peuvent lire tous les rôles (nécessaire pour isAdmin côté client)
CREATE POLICY "Authenticated users can read roles" ON public.user_roles
  FOR SELECT TO authenticated USING (true);

-- Seul le service role peut écrire dans user_roles (supabaseAdmin bypass RLS)
CREATE POLICY "Only service role can manage roles" ON public.user_roles
  FOR ALL USING (false) WITH CHECK (false);
