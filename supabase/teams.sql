create table if not exists teams (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references profiles(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

alter table teams enable row level security;

create policy "Owners manage their teams"
  on teams for all
  to authenticated
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

create table if not exists team_members (
  team_id uuid not null references teams(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  primary key (team_id, user_id)
);

alter table team_members enable row level security;

create policy "Team owners manage members"
  on team_members for all
  to authenticated
  using (exists (select 1 from teams t where t.id = team_id and t.owner_id = auth.uid()))
  with check (exists (select 1 from teams t where t.id = team_id and t.owner_id = auth.uid()));
