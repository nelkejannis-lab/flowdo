-- Standalone reference: calendar OAuth connections (also in migrations/)

create table if not exists calendar_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  provider text not null check (provider in ('google', 'microsoft', 'ical')),
  access_token text,
  refresh_token text,
  token_expires_at timestamptz,
  email text,
  display_name text,
  ical_url text,
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, provider)
);

alter table calendar_connections enable row level security;

create policy "Users manage own calendar connections"
  on calendar_connections for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

revoke select (access_token, refresh_token) on calendar_connections from authenticated;
