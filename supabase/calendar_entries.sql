-- Flowdo: shared calendar entries (Termin, Reise, Urlaub) with invites

create table if not exists calendar_entries (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references profiles(id) on delete cascade,
  type text not null check (type in ('termin', 'reise', 'urlaub')),
  title text not null,
  description text,
  date date not null,
  end_date date,
  start_time time,
  end_time time,
  color text not null default '#4772FA',
  created_at timestamptz not null default now()
);

create table if not exists calendar_entry_invites (
  entry_id uuid not null references calendar_entries(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  primary key (entry_id, user_id)
);

alter table calendar_entries enable row level security;
alter table calendar_entry_invites enable row level security;

-- helper functions (security definer to avoid RLS recursion)
create or replace function is_entry_owner(_entry_id uuid, _user_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from calendar_entries e where e.id = _entry_id and e.owner_id = _user_id
  );
$$;

create or replace function is_entry_invitee(_entry_id uuid, _user_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from calendar_entry_invites i where i.entry_id = _entry_id and i.user_id = _user_id
  );
$$;

create or replace function are_friends(_a uuid, _b uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from friendships f
    where f.status = 'accepted'
      and ((f.requester_id = _a and f.addressee_id = _b) or (f.requester_id = _b and f.addressee_id = _a))
  );
$$;

-- calendar_entries policies
create policy "Owner, invitees and friends (travel/vacation) can view entries"
  on calendar_entries for select
  to authenticated
  using (
    owner_id = auth.uid()
    or is_entry_invitee(id, auth.uid())
    or (type in ('reise', 'urlaub') and are_friends(owner_id, auth.uid()))
  );

create policy "Owners manage their entries"
  on calendar_entries for all
  to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

-- calendar_entry_invites policies
create policy "Invitees and owners can view invites"
  on calendar_entry_invites for select
  to authenticated
  using (
    user_id = auth.uid()
    or is_entry_owner(entry_id, auth.uid())
  );

create policy "Owners manage invites"
  on calendar_entry_invites for all
  to authenticated
  using (is_entry_owner(entry_id, auth.uid()))
  with check (is_entry_owner(entry_id, auth.uid()));
