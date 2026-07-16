-- NOVAT: personal calendar events (general "Event" entries)
-- Run this in the Supabase SQL editor (Project -> SQL Editor -> New query)

create table if not exists calendar_events (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references profiles(id) on delete cascade,
  title text not null,
  description text,
  date date not null,
  end_date date,
  color text not null default '#8B5CF6',
  created_at timestamptz not null default now()
);

alter table calendar_events enable row level security;

create policy "Owners manage their events"
  on calendar_events for all
  to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());
