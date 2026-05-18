
-- ============ GROUP MESSAGES ============
create table if not exists public.group_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  content text not null check (char_length(content) between 1 and 1000),
  visible boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.group_messages enable row level security;

drop policy if exists "group_messages_select" on public.group_messages;
create policy "group_messages_select" on public.group_messages
  for select using (visible = true or user_id = auth.uid());

drop policy if exists "group_messages_insert" on public.group_messages;
create policy "group_messages_insert" on public.group_messages
  for insert with check (user_id = auth.uid());

do $$ begin
  alter publication supabase_realtime add table public.group_messages;
exception when duplicate_object then null; when others then null; end $$;

-- ============ RESULTS ============
create table if not exists public.results (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  content text not null check (char_length(content) between 1 and 500),
  amount integer,
  photo_url text,
  visible boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.results enable row level security;

drop policy if exists "results_select" on public.results;
create policy "results_select" on public.results
  for select using (visible = true or user_id = auth.uid());

drop policy if exists "results_insert" on public.results;
create policy "results_insert" on public.results
  for insert with check (user_id = auth.uid());

do $$ begin
  alter publication supabase_realtime add table public.results;
exception when duplicate_object then null; when others then null; end $$;

-- ============ PROFILES: has_software_access ============
alter table public.profiles add column if not exists has_software_access boolean not null default false;

-- ============ STORAGE: avatars ============
insert into storage.buckets (id, name, public) values ('avatars', 'avatars', true) on conflict (id) do nothing;
drop policy if exists "Avatars publicly readable" on storage.objects;
create policy "Avatars publicly readable" on storage.objects for select using (bucket_id = 'avatars');
drop policy if exists "Users upload avatar" on storage.objects;
create policy "Users upload avatar" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]);
drop policy if exists "Users update avatar" on storage.objects;
create policy "Users update avatar" on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]);

-- ============ STORAGE: result-photos ============
insert into storage.buckets (id, name, public) values ('result-photos', 'result-photos', true) on conflict (id) do nothing;
drop policy if exists "Result photos readable" on storage.objects;
create policy "Result photos readable" on storage.objects for select using (bucket_id = 'result-photos');
drop policy if exists "Users upload result photo" on storage.objects;
create policy "Users upload result photo" on storage.objects for insert to authenticated
  with check (bucket_id = 'result-photos' and auth.uid()::text = (storage.foldername(name))[1]);

-- ============ NEW MODULE: Agent IA ============
insert into public.modules (title, description, section, position, badge, badge_color)
select 'Agent IA qui close en DM', 'Automatise tes closings en message privé grâce à l''IA.', 'ultime', 2, 'NOUVEAU', '#f59e0b'
where not exists (select 1 from public.modules where title = 'Agent IA qui close en DM');
