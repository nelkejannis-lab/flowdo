-- Standalone reference: messages schema (also in migrations/)

create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  from_user_id uuid not null references profiles(id) on delete cascade,
  to_user_id uuid not null references profiles(id) on delete cascade,
  body text not null,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

alter table messages enable row level security;

create policy "Participants can view messages"
  on messages for select to authenticated
  using (auth.uid() = from_user_id or auth.uid() = to_user_id);

create policy "Users can send messages"
  on messages for insert to authenticated
  with check (auth.uid() = from_user_id);

create policy "Recipients can mark read"
  on messages for update to authenticated
  using (auth.uid() = to_user_id);

create table if not exists team_messages (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams(id) on delete cascade,
  from_user_id uuid not null references profiles(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

alter table team_messages enable row level security;

create policy "Team members can view team messages"
  on team_messages for select to authenticated
  using (
    exists (select 1 from team_members tm where tm.team_id = team_messages.team_id and tm.user_id = auth.uid())
    or exists (select 1 from teams t where t.id = team_messages.team_id and t.owner_id = auth.uid())
  );

create policy "Team members can send team messages"
  on team_messages for insert to authenticated
  with check (
    auth.uid() = from_user_id and (
      exists (select 1 from team_members tm where tm.team_id = team_messages.team_id and tm.user_id = auth.uid())
      or exists (select 1 from teams t where t.id = team_messages.team_id and t.owner_id = auth.uid())
    )
  );
