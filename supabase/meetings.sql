-- Erstelle die 'meetings'-Tabelle
create table public.meetings (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users not null,
  title text not null,
  date text not null,
  transcript text not null,
  summary text not null,
  action_items jsonb default '[]'::jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Aktiviere Row Level Security
alter table public.meetings enable row level security;

-- Policies für den sicheren Zugriff (nur eigene Meetings)
create policy "Users can view their own meetings"
  on public.meetings for select
  using (auth.uid() = user_id);

create policy "Users can insert their own meetings"
  on public.meetings for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own meetings"
  on public.meetings for update
  using (auth.uid() = user_id);

create policy "Users can delete their own meetings"
  on public.meetings for delete
  using (auth.uid() = user_id);
