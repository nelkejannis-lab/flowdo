-- Mooncrew: project invitations (accept/decline like task shares)

create table if not exists board_invites (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references boards(id) on delete cascade,
  from_user_id uuid not null references profiles(id) on delete cascade,
  to_user_id uuid not null references profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  board_title text not null,
  board_color text not null,
  created_at timestamptz not null default now()
);

alter table board_invites enable row level security;

create policy "Participants can view board invites"
  on board_invites for select
  to authenticated
  using (auth.uid() = from_user_id or auth.uid() = to_user_id);

create policy "Owners can create board invites"
  on board_invites for insert
  to authenticated
  with check (
    auth.uid() = from_user_id
    and exists (select 1 from boards b where b.id = board_id and b.owner_id = auth.uid())
  );

create policy "Recipients can update invite status"
  on board_invites for update
  to authenticated
  using (auth.uid() = to_user_id or auth.uid() = from_user_id);

create policy "Participants can delete board invites"
  on board_invites for delete
  to authenticated
  using (auth.uid() = from_user_id or auth.uid() = to_user_id);
