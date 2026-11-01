-- HAMOKSHA database schema for Supabase
-- Run this whole file once in: Supabase Dashboard > SQL Editor > New query

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------
create table if not exists public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  role         text not null default 'student' check (role in ('student', 'teacher')),
  created_at   timestamptz not null default now()
);

-- Private key/value settings (no policies = not readable from the browser)
create table if not exists public.app_config (
  key   text primary key,
  value text not null default ''
);
insert into public.app_config (key, value) values ('teacher_code', '')
  on conflict (key) do nothing;

create table if not exists public.rooms (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null references public.profiles(id) on delete cascade,
  subject    text not null check (subject in ('general', 'math', 'languages', 'programming', 'science')),
  title      text not null default 'New chat',
  created_at timestamptz not null default now()
);
create index if not exists rooms_owner_idx   on public.rooms (owner_id, subject, created_at desc);
create index if not exists rooms_subject_idx on public.rooms (subject, created_at desc);

create table if not exists public.messages (
  id          uuid primary key default gen_random_uuid(),
  room_id     uuid not null references public.rooms(id) on delete cascade,
  sender_id   uuid references public.profiles(id) on delete set null,
  sender_role text not null check (sender_role in ('student', 'teacher', 'ai')),
  sender_name text not null default '',
  content     text not null check (char_length(content) between 1 and 8000),
  created_at  timestamptz not null default now()
);
create index if not exists messages_room_idx on public.messages (room_id, created_at);

create table if not exists public.meetings (
  id           uuid primary key default gen_random_uuid(),
  teacher_id   uuid not null references public.profiles(id) on delete cascade,
  teacher_name text not null default '',
  title        text not null,
  peer_id      text not null unique,
  active       boolean not null default true,
  created_at   timestamptz not null default now()
);
create index if not exists meetings_active_idx on public.meetings (active, created_at desc);

-- ---------------------------------------------------------------
-- Helper functions (security definer so policies do not recurse)
-- ---------------------------------------------------------------
create or replace function public.is_teacher()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'teacher');
$$;

-- A user can access their own rooms. Teachers can also access every
-- educational room (anything that is not the private "general" chat).
create or replace function public.can_access_room(rid uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.rooms r
    where r.id = rid
      and (r.owner_id = auth.uid() or (r.subject <> 'general' and public.is_teacher()))
  );
$$;

create or replace function public.owns_room(rid uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (select 1 from public.rooms r where r.id = rid and r.owner_id = auth.uid());
$$;

-- ---------------------------------------------------------------
-- Create a profile automatically when a user signs up
-- ---------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  wanted_role text := coalesce(new.raw_user_meta_data ->> 'role', 'student');
  required_code text;
begin
  if wanted_role = 'teacher' then
    select value into required_code from public.app_config where key = 'teacher_code';
    if coalesce(required_code, '') <> ''
       and coalesce(new.raw_user_meta_data ->> 'teacher_code', '') <> required_code then
      raise exception 'Invalid teacher code';
    end if;
  else
    wanted_role := 'student';
  end if;

  insert into public.profiles (id, display_name, role)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'display_name', ''), split_part(new.email, '@', 1)),
    wanted_role
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------
alter table public.profiles   enable row level security;
alter table public.app_config enable row level security;
alter table public.rooms      enable row level security;
alter table public.messages   enable row level security;
alter table public.meetings   enable row level security;

-- profiles: you see yourself; teachers see everyone (to label students)
drop policy if exists "profiles read" on public.profiles;
create policy "profiles read" on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.is_teacher());

-- rooms
drop policy if exists "rooms read" on public.rooms;
create policy "rooms read" on public.rooms
  for select to authenticated
  using (owner_id = auth.uid() or (subject <> 'general' and public.is_teacher()));

drop policy if exists "rooms insert" on public.rooms;
create policy "rooms insert" on public.rooms
  for insert to authenticated
  with check (owner_id = auth.uid());

drop policy if exists "rooms update" on public.rooms;
create policy "rooms update" on public.rooms
  for update to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

drop policy if exists "rooms delete" on public.rooms;
create policy "rooms delete" on public.rooms
  for delete to authenticated
  using (owner_id = auth.uid());

-- messages
drop policy if exists "messages read" on public.messages;
create policy "messages read" on public.messages
  for select to authenticated
  using (public.can_access_room(room_id));

drop policy if exists "messages insert" on public.messages;
create policy "messages insert" on public.messages
  for insert to authenticated
  with check (
    public.can_access_room(room_id)
    and (
      (sender_role = 'student' and sender_id = auth.uid() and public.owns_room(room_id))
      or (sender_role = 'ai' and public.owns_room(room_id))
      or (sender_role = 'teacher' and sender_id = auth.uid() and public.is_teacher())
    )
  );

-- meetings: everyone signed in can see live classes; only teachers manage them
drop policy if exists "meetings read" on public.meetings;
create policy "meetings read" on public.meetings
  for select to authenticated
  using (active = true or teacher_id = auth.uid());

drop policy if exists "meetings insert" on public.meetings;
create policy "meetings insert" on public.meetings
  for insert to authenticated
  with check (teacher_id = auth.uid() and public.is_teacher());

drop policy if exists "meetings update" on public.meetings;
create policy "meetings update" on public.meetings
  for update to authenticated
  using (teacher_id = auth.uid())
  with check (teacher_id = auth.uid());

-- ---------------------------------------------------------------
-- Realtime
-- ---------------------------------------------------------------
do $$
begin
  begin alter publication supabase_realtime add table public.messages; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.rooms;    exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.meetings; exception when duplicate_object then null; end;
end $$;

-- Optional: require a secret code for teacher sign-ups.
-- update public.app_config set value = 'choose-a-secret-code' where key = 'teacher_code';
