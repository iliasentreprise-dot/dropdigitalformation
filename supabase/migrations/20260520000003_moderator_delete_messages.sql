-- Modérateurs peuvent supprimer les messages du groupe
DROP POLICY IF EXISTS "Admin can delete messages" ON public.group_messages;
DROP POLICY IF EXISTS "Admin and moderators can delete messages" ON public.group_messages;
CREATE POLICY "Admin and moderators can delete messages" ON public.group_messages
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role IN ('admin', 'moderator')
    )
  );
