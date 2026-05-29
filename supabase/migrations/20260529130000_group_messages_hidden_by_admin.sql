-- Add hidden_by_admin column for ghost-mode feature
alter table public.group_messages
  add column if not exists hidden_by_admin boolean not null default false;

-- Update SELECT policy: authors always see their own messages; others only see non-hidden ones
drop policy if exists "group_messages_select" on public.group_messages;
create policy "group_messages_select" on public.group_messages
  for select using (
    user_id = auth.uid()
    or (visible = true and hidden_by_admin is not true)
  );

-- Allow admins to update (needed for hidden_by_admin toggle)
drop policy if exists "group_messages_update_admin" on public.group_messages;
create policy "group_messages_update_admin" on public.group_messages
  for update using (
    exists (
      select 1 from public.user_roles
      where user_roles.user_id = auth.uid()
      and user_roles.role = 'admin'
    )
  );
