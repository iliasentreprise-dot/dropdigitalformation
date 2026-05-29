-- Allow admins to delete any group_messages row
drop policy if exists "group_messages_delete_admin" on public.group_messages;
create policy "group_messages_delete_admin" on public.group_messages
  for delete using (
    exists (
      select 1 from public.user_roles
      where user_roles.user_id = auth.uid()
      and user_roles.role = 'admin'
    )
  );

