
-- Updated_at helper
create or replace function public.set_updated_at()
returns trigger language plpgsql security definer set search_path = public as $$
begin new.updated_at = now(); return new; end;
$$;

-- ============ PROFILES ============
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text,
  full_name text,
  avatar_url text,
  bio text,
  show_progression boolean not null default true,
  username_changed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;

drop policy if exists "Profiles are viewable by everyone" on public.profiles;
create policy "Profiles are viewable by everyone" on public.profiles for select using (true);
drop policy if exists "Users can insert their own profile" on public.profiles;
create policy "Users can insert their own profile" on public.profiles for insert with check (auth.uid() = id);
drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile" on public.profiles for update using (auth.uid() = id);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, username, full_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'full_name', '')
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- ============ ROLES ============
do $$ begin
  create type public.app_role as enum ('admin', 'user');
exception when duplicate_object then null; end $$;

create table if not exists public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

drop policy if exists "Users can view their own roles" on public.user_roles;
create policy "Users can view their own roles" on public.user_roles for select using (auth.uid() = user_id);
drop policy if exists "Admins can view all roles" on public.user_roles;
create policy "Admins can view all roles" on public.user_roles for select using (public.has_role(auth.uid(), 'admin'));

create or replace function public.assign_first_user_admin()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.user_roles where role = 'admin') then
    insert into public.user_roles (user_id, role) values (new.id, 'admin') on conflict do nothing;
  else
    insert into public.user_roles (user_id, role) values (new.id, 'user') on conflict do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_assign_role on auth.users;
create trigger on_auth_user_created_assign_role after insert on auth.users
  for each row execute function public.assign_first_user_admin();

-- ============ USERNAME HISTORY ============
create table if not exists public.username_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  old_username text,
  new_username text,
  changed_at timestamptz not null default now()
);
alter table public.username_history enable row level security;
drop policy if exists "Admins can view username history" on public.username_history;
create policy "Admins can view username history" on public.username_history for select using (public.has_role(auth.uid(), 'admin'));
drop policy if exists "Users can insert their own history" on public.username_history;
create policy "Users can insert their own history" on public.username_history for insert with check (auth.uid() = user_id);

-- ============ POSTS & COMMENTS ============
create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  image_url text,
  created_at timestamptz not null default now()
);
alter table public.posts enable row level security;
drop policy if exists "Posts viewable by everyone" on public.posts;
create policy "Posts viewable by everyone" on public.posts for select using (true);
drop policy if exists "Users can create their own posts" on public.posts;
create policy "Users can create their own posts" on public.posts for insert with check (auth.uid() = user_id);
drop policy if exists "Users can update their own posts" on public.posts;
create policy "Users can update their own posts" on public.posts for update using (auth.uid() = user_id);
drop policy if exists "Users can delete their own posts" on public.posts;
create policy "Users can delete their own posts" on public.posts for delete using (auth.uid() = user_id);
create index if not exists idx_posts_created_at on public.posts (created_at desc);

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 1000),
  image_url text,
  created_at timestamptz not null default now()
);
alter table public.comments enable row level security;
drop policy if exists "Comments viewable by everyone" on public.comments;
create policy "Comments viewable by everyone" on public.comments for select using (true);
drop policy if exists "Users can create their own comments" on public.comments;
create policy "Users can create their own comments" on public.comments for insert with check (auth.uid() = user_id);
drop policy if exists "Users can update their own comments" on public.comments;
create policy "Users can update their own comments" on public.comments for update using (auth.uid() = user_id);
drop policy if exists "Users can delete their own comments" on public.comments;
create policy "Users can delete their own comments" on public.comments for delete using (auth.uid() = user_id);
create index if not exists idx_comments_post_id on public.comments (post_id, created_at);

do $$ begin
  alter publication supabase_realtime add table public.posts;
exception when duplicate_object then null; when others then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.comments;
exception when duplicate_object then null; when others then null; end $$;

-- ============ STORAGE: post-images ============
insert into storage.buckets (id, name, public) values ('post-images', 'post-images', true)
on conflict (id) do nothing;

drop policy if exists "Post images publicly readable" on storage.objects;
create policy "Post images publicly readable" on storage.objects for select using (bucket_id = 'post-images');
drop policy if exists "Users can upload post images in their own folder" on storage.objects;
create policy "Users can upload post images in their own folder" on storage.objects for insert
  with check (bucket_id = 'post-images' and auth.uid()::text = (storage.foldername(name))[1]);
drop policy if exists "Users can update their own post images" on storage.objects;
create policy "Users can update their own post images" on storage.objects for update
  using (bucket_id = 'post-images' and auth.uid()::text = (storage.foldername(name))[1]);
drop policy if exists "Users can delete their own post images" on storage.objects;
create policy "Users can delete their own post images" on storage.objects for delete
  using (bucket_id = 'post-images' and auth.uid()::text = (storage.foldername(name))[1]);

-- ============ TRAINING SYSTEM ============
create table if not exists public.modules (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null default '',
  section text not null default 'general',
  position integer not null default 0,
  thumbnail_url text,
  badge text,
  badge_color text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.chapters (
  id uuid primary key default gen_random_uuid(),
  module_id uuid not null references public.modules(id) on delete cascade,
  title text not null,
  description text not null default '',
  video_url text not null default '',
  duration_seconds integer not null default 0,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_chapter_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  chapter_id uuid not null references public.chapters(id) on delete cascade,
  completed_at timestamptz not null default now(),
  primary key (user_id, chapter_id)
);

alter table public.modules enable row level security;
alter table public.chapters enable row level security;
alter table public.user_chapter_progress enable row level security;

drop policy if exists "modules_select" on public.modules;
create policy "modules_select" on public.modules for select using (true);
drop policy if exists "modules_insert" on public.modules;
create policy "modules_insert" on public.modules for insert with check (public.has_role(auth.uid(), 'admin'));
drop policy if exists "modules_update" on public.modules;
create policy "modules_update" on public.modules for update using (public.has_role(auth.uid(), 'admin'));
drop policy if exists "modules_delete" on public.modules;
create policy "modules_delete" on public.modules for delete using (public.has_role(auth.uid(), 'admin'));

drop policy if exists "chapters_select" on public.chapters;
create policy "chapters_select" on public.chapters for select using (true);
drop policy if exists "chapters_insert" on public.chapters;
create policy "chapters_insert" on public.chapters for insert with check (public.has_role(auth.uid(), 'admin'));
drop policy if exists "chapters_update" on public.chapters;
create policy "chapters_update" on public.chapters for update using (public.has_role(auth.uid(), 'admin'));
drop policy if exists "chapters_delete" on public.chapters;
create policy "chapters_delete" on public.chapters for delete using (public.has_role(auth.uid(), 'admin'));

drop policy if exists "progress_select" on public.user_chapter_progress;
create policy "progress_select" on public.user_chapter_progress for select using (user_id = auth.uid());
drop policy if exists "progress_insert" on public.user_chapter_progress;
create policy "progress_insert" on public.user_chapter_progress for insert with check (user_id = auth.uid());
drop policy if exists "progress_delete" on public.user_chapter_progress;
create policy "progress_delete" on public.user_chapter_progress for delete using (user_id = auth.uid());

drop trigger if exists modules_set_updated_at on public.modules;
create trigger modules_set_updated_at before update on public.modules
  for each row execute function public.set_updated_at();
drop trigger if exists chapters_set_updated_at on public.chapters;
create trigger chapters_set_updated_at before update on public.chapters
  for each row execute function public.set_updated_at();

-- ============ STORAGE: course-videos ============
insert into storage.buckets (id, name, public) values ('course-videos', 'course-videos', true)
on conflict (id) do nothing;

drop policy if exists "Course videos readable" on storage.objects;
create policy "Course videos readable" on storage.objects for select using (bucket_id = 'course-videos');
drop policy if exists "Authenticated users upload course videos" on storage.objects;
create policy "Authenticated users upload course videos" on storage.objects for insert to authenticated
  with check (bucket_id = 'course-videos');
drop policy if exists "Authenticated users update course videos" on storage.objects;
create policy "Authenticated users update course videos" on storage.objects for update to authenticated
  using (bucket_id = 'course-videos');
drop policy if exists "Authenticated users delete course videos" on storage.objects;
create policy "Authenticated users delete course videos" on storage.objects for delete to authenticated
  using (bucket_id = 'course-videos');

-- ============ SEED MODULES ============
insert into public.modules (title, description, section, position, badge, badge_color)
select title, description, section, position, badge, badge_color
from (values
  ('La mentalité d''un entrepreneur à +20k/mois', 'Présentation du système PIRATE · Mindset · Motivation', 'mindset', 0, null::text, null::text),
  ('Préparer son compte TikTok', '', 'jour1', 0, 'NEW', '#a855f7'),
  ('L''Offre Irrésistible', '', 'jour1', 1, null, null),
  ('Analyser sa concurrence et faire mieux', '', 'jour1', 2, null, null),
  ('Le Tunnel de vente Pirate', '', 'jour2', 0, null, null),
  ('Créer ton produit digital', '', 'jour2', 1, null, null),
  ('Stratégie Carrousels PIRATE', '', 'jour2', 2, null, null),
  ('Les Lives TikTok', '', 'jour3', 0, null, null),
  ('Closer en DM avec une méthode interdite', '', 'jour3', 1, 'NEW', '#ef4444'),
  ('🧲 LeadMagnet ULTIME', '', 'jour3', 2, 'NEW', '#ef4444'),
  ('La puissance de l''emailing', '', 'bonus', 0, 'NEW', '#f59e0b'),
  ('Comment déclarer', '', 'bonus', 1, null, null),
  ('L''OUTIL d''automatisation TikTok SECRET', 'Accès exclusif aux outils secrets qui font tourner le système en automatique', 'ultime', 0, 'EXCLUSIF', '#f59e0b'),
  ('Logiciel de BOOST d''abonnés ULTIME', 'Accès exclusif aux outils secrets qui font tourner le système en automatique', 'ultime', 1, 'EXCLUSIF', '#f59e0b')
) as v(title, description, section, position, badge, badge_color)
where not exists (select 1 from public.modules limit 1);
