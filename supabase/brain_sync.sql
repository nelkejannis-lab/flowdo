-- 1. Create brain_columns table
create table if not exists brain_columns (
  id text primary key,
  owner_id uuid not null references profiles(id) on delete cascade,
  title text not null,
  position int not null default 0,
  created_at timestamptz not null default now()
);

-- Enable RLS for brain_columns
alter table brain_columns enable row level security;

-- Policies for brain_columns
create policy "Users can manage their own brain_columns"
  on brain_columns for all
  to authenticated
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

-- 2. Create brain_pages table
create table if not exists brain_pages (
  id text primary key,
  owner_id uuid not null references profiles(id) on delete cascade,
  column_id text not null,
  title text not null,
  content text not null default '',
  summary text,
  audio_base64 text,
  audio_duration int,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Enable RLS for brain_pages
alter table brain_pages enable row level security;

-- Policies for brain_pages
create policy "Users can manage their own brain_pages"
  on brain_pages for all
  to authenticated
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);
