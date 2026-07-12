-- Security hardening migration (run via Supabase SQL editor or CLI)

-- 1. Admin columns + badge RPC ------------------------------------------------
alter table profiles add column if not exists is_admin boolean not null default false;
alter table profiles add column if not exists badge text;

drop policy if exists "Users can update their own profile" on profiles;
create policy "Users can update their own profile"
  on profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id and is_admin = (select p.is_admin from profiles p where p.id = auth.uid()));

create or replace function admin_set_badge(p_user_id uuid, p_badge text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from profiles where id = auth.uid() and is_admin = true) then
    raise exception 'not authorized';
  end if;
  update profiles set badge = nullif(trim(p_badge), '') where id = p_user_id;
end;
$$;

revoke all on function admin_set_badge(uuid, text) from public;
grant execute on function admin_set_badge(uuid, text) to authenticated;

-- 2. Social account tokens: hide from client ----------------------------------
alter table social_accounts add column if not exists token_configured boolean not null default false;

update social_accounts set token_configured = true where access_token is not null and access_token <> '';

revoke select (access_token) on social_accounts from authenticated;

create or replace function set_social_account_token(p_account_id uuid, p_token text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from social_accounts
    where id = p_account_id and owner_id = auth.uid()
  ) then
    raise exception 'not authorized';
  end if;
  update social_accounts
  set access_token = nullif(trim(p_token), ''),
      token_configured = coalesce(nullif(trim(p_token), ''), '') <> ''
  where id = p_account_id;
end;
$$;

revoke all on function set_social_account_token(uuid, text) from public;
grant execute on function set_social_account_token(uuid, text) to authenticated;

-- 3. Messages -----------------------------------------------------------------
create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  from_user_id uuid not null references profiles(id) on delete cascade,
  to_user_id uuid not null references profiles(id) on delete cascade,
  body text not null,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

alter table messages enable row level security;

drop policy if exists "Participants can view messages" on messages;
create policy "Participants can view messages"
  on messages for select to authenticated
  using (auth.uid() = from_user_id or auth.uid() = to_user_id);

drop policy if exists "Users can send messages" on messages;
create policy "Users can send messages"
  on messages for insert to authenticated
  with check (auth.uid() = from_user_id);

drop policy if exists "Recipients can mark read" on messages;
create policy "Recipients can mark read"
  on messages for update to authenticated
  using (auth.uid() = to_user_id);

-- 4. Team messages ------------------------------------------------------------
create table if not exists team_messages (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams(id) on delete cascade,
  from_user_id uuid not null references profiles(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

alter table team_messages enable row level security;

drop policy if exists "Team members can view team messages" on team_messages;
create policy "Team members can view team messages"
  on team_messages for select to authenticated
  using (
    exists (select 1 from team_members tm where tm.team_id = team_messages.team_id and tm.user_id = auth.uid())
    or exists (select 1 from teams t where t.id = team_messages.team_id and t.owner_id = auth.uid())
  );

drop policy if exists "Team members can send team messages" on team_messages;
create policy "Team members can send team messages"
  on team_messages for insert to authenticated
  with check (
    auth.uid() = from_user_id and (
      exists (select 1 from team_members tm where tm.team_id = team_messages.team_id and tm.user_id = auth.uid())
      or exists (select 1 from teams t where t.id = team_messages.team_id and t.owner_id = auth.uid())
    )
  );

-- 5. Calendar connections -----------------------------------------------------
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

drop policy if exists "Users manage own calendar connections" on calendar_connections;
create policy "Users manage own calendar connections"
  on calendar_connections for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

revoke select (access_token, refresh_token) on calendar_connections from authenticated;

-- 6. Storage RLS (user-scoped paths) ------------------------------------------
drop policy if exists "Authenticated can upload attachments" on storage.objects;
drop policy if exists "Authenticated can read attachments" on storage.objects;
drop policy if exists "Authenticated can delete attachments" on storage.objects;

create policy "Users upload own attachments"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'attachments'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Users read own attachments"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'attachments'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Users delete own attachments"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'attachments'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Authenticated can upload avatars" on storage.objects;
drop policy if exists "Authenticated can read avatars" on storage.objects;
drop policy if exists "Authenticated can update their avatars" on storage.objects;
drop policy if exists "Authenticated can delete avatars" on storage.objects;

create policy "Users upload own avatars"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Anyone can read avatars"
  on storage.objects for select to authenticated
  using (bucket_id = 'avatars');

create policy "Users update own avatars"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Users delete own avatars"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
