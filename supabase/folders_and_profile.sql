-- Project folders + profile avatar picture
-- Run this in the Supabase SQL editor (Project -> SQL Editor -> New query)

-- 1. Board folders ---------------------------------------------------------
create table if not exists board_folders (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references profiles(id) on delete cascade,
  title text not null,
  position int not null default 0,
  created_at timestamptz not null default now()
);

alter table board_folders enable row level security;

create policy "Owners manage their folders"
  on board_folders for all
  to authenticated
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

-- 2. Boards: assign to a folder ---------------------------------------------
alter table boards add column if not exists folder_id uuid references board_folders(id) on delete set null;

-- 3. Profiles: profile picture ------------------------------------------------
alter table profiles add column if not exists avatar_url text;

-- 4. Avatars storage bucket ---------------------------------------------------
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

create policy "Authenticated can upload avatars"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'avatars');

create policy "Authenticated can read avatars"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'avatars');

create policy "Authenticated can update their avatars"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'avatars');

create policy "Authenticated can delete avatars"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'avatars');
