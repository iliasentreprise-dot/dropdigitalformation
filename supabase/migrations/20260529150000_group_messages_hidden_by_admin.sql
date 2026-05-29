-- Add hidden_by_admin column
alter table public.group_messages
  add column if not exists hidden_by_admin boolean not null default false;

-- UPDATE policy: admins can update any message (needed for hidden_by_admin)
drop policy if exists "group_messages_update_admin" on public.group_messages;
create policy "group_messages_update_admin" on public.group_messages
  for update to authenticated
  using (
    exists (
      select 1 from public.user_roles
      where user_id = auth.uid() and role = 'admin'
    )
  )
  with check (
    exists (
      select 1 from public.user_roles
      where user_id = auth.uid() and role = 'admin'
    )
  );

-- UPDATE SELECT policy: admin sees all, author sees own, others see only visible+non-hidden
drop policy if exists "group_messages_select" on public.group_messages;
create policy "group_messages_select" on public.group_messages
  for select to authenticated
  using (
    exists (
      select 1 from public.user_roles
      where user_id = auth.uid() and role = 'admin'
    )
    or user_id = auth.uid()
    or (visible = true and (hidden_by_admin is null or hidden_by_admin = false))
  );

