create table if not exists team_invites (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams(id) on delete cascade,
  from_user_id uuid not null references profiles(id) on delete cascade,
  to_user_id uuid not null references profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  created_at timestamptz not null default now(),
  unique (team_id, to_user_id)
);

alter table team_invites enable row level security;

create policy "Team owners can send invites"
  on team_invites for insert
  to authenticated
  with check (
    auth.uid() = from_user_id and
    exists (select 1 from teams t where t.id = team_id and t.owner_id = auth.uid())
  );

create policy "Participants can view their invites"
  on team_invites for select
  to authenticated
  using (auth.uid() = to_user_id or auth.uid() = from_user_id);

create policy "Invitees can update status"
  on team_invites for update
  to authenticated
  using (auth.uid() = to_user_id);

create policy "Owner or invitee can delete"
  on team_invites for delete
  to authenticated
  using (auth.uid() = to_user_id or auth.uid() = from_user_id);
