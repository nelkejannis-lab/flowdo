-- Flowdo: multi-user schema (profiles, friends, shared boards, task inbox)
-- Run this in the Supabase SQL editor (Project -> SQL Editor -> New query)

-- 1. Profiles -----------------------------------------------------------
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  display_name text not null,
  avatar_color text not null default '#4772FA',
  created_at timestamptz not null default now()
);

alter table profiles enable row level security;

create policy "Profiles are viewable by all authenticated users"
  on profiles for select
  to authenticated
  using (true);

create policy "Users can insert their own profile"
  on profiles for insert
  to authenticated
  with check (auth.uid() = id);

create policy "Users can update their own profile"
  on profiles for update
  to authenticated
  using (auth.uid() = id);

-- automatically create a profile row on signup
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, username, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- 2. Friendships ----------------------------------------------------------
create table if not exists friendships (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references profiles(id) on delete cascade,
  addressee_id uuid not null references profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  unique (requester_id, addressee_id)
);

alter table friendships enable row level security;

create policy "Users can view their own friendships"
  on friendships for select
  to authenticated
  using (auth.uid() = requester_id or auth.uid() = addressee_id);

create policy "Users can send friend requests"
  on friendships for insert
  to authenticated
  with check (auth.uid() = requester_id);

create policy "Participants can update friendship status"
  on friendships for update
  to authenticated
  using (auth.uid() = requester_id or auth.uid() = addressee_id);

create policy "Participants can delete a friendship"
  on friendships for delete
  to authenticated
  using (auth.uid() = requester_id or auth.uid() = addressee_id);

-- 3. Boards / Projects ----------------------------------------------------
create table if not exists boards (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references profiles(id) on delete cascade,
  title text not null,
  description text,
  color text not null default '#4772FA',
  deadline date,
  created_at timestamptz not null default now()
);

create table if not exists board_columns (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references boards(id) on delete cascade,
  title text not null,
  position int not null default 0
);

create table if not exists board_members (
  board_id uuid not null references boards(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  created_at timestamptz not null default now(),
  primary key (board_id, user_id)
);

alter table boards enable row level security;
alter table board_columns enable row level security;
alter table board_members enable row level security;

create policy "Members can view their boards"
  on boards for select
  to authenticated
  using (
    auth.uid() = owner_id
    or exists (select 1 from board_members m where m.board_id = id and m.user_id = auth.uid())
  );

create policy "Owners manage boards"
  on boards for all
  to authenticated
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

create policy "Members can view columns"
  on board_columns for select
  to authenticated
  using (
    exists (
      select 1 from boards b
      where b.id = board_id
        and (b.owner_id = auth.uid() or exists (
          select 1 from board_members m where m.board_id = b.id and m.user_id = auth.uid()
        ))
    )
  );

create policy "Owners manage columns"
  on board_columns for all
  to authenticated
  using (exists (select 1 from boards b where b.id = board_id and b.owner_id = auth.uid()))
  with check (exists (select 1 from boards b where b.id = board_id and b.owner_id = auth.uid()));

create policy "Members can view membership"
  on board_members for select
  to authenticated
  using (
    user_id = auth.uid()
    or exists (select 1 from boards b where b.id = board_id and b.owner_id = auth.uid())
  );

create policy "Owners manage membership"
  on board_members for all
  to authenticated
  using (exists (select 1 from boards b where b.id = board_id and b.owner_id = auth.uid()))
  with check (exists (select 1 from boards b where b.id = board_id and b.owner_id = auth.uid()));

-- 4. Tasks ------------------------------------------------------------------
create table if not exists tasks (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references profiles(id) on delete cascade,
  assigned_to uuid references profiles(id) on delete set null,
  title text not null,
  description text,
  due_date date,
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high')),
  tags text[] not null default '{}',
  urgent boolean not null default false,
  important boolean not null default false,
  completed boolean not null default false,
  completed_at timestamptz,
  board_id uuid references boards(id) on delete set null,
  column_id uuid references board_columns(id) on delete set null,
  subtasks jsonb not null default '[]',
  created_at timestamptz not null default now()
);

alter table tasks enable row level security;

create policy "Users can view their own or assigned tasks"
  on tasks for select
  to authenticated
  using (
    auth.uid() = owner_id
    or auth.uid() = assigned_to
    or (board_id is not null and exists (
      select 1 from board_members m where m.board_id = tasks.board_id and m.user_id = auth.uid()
    ))
    or (board_id is not null and exists (
      select 1 from boards b where b.id = tasks.board_id and b.owner_id = auth.uid()
    ))
  );

create policy "Users can manage their own tasks"
  on tasks for all
  to authenticated
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

create policy "Assignees can update progress on assigned tasks"
  on tasks for update
  to authenticated
  using (auth.uid() = assigned_to)
  with check (auth.uid() = assigned_to);

-- 5. Task inbox / sharing -----------------------------------------------------
create table if not exists task_shares (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references tasks(id) on delete cascade,
  from_user_id uuid not null references profiles(id) on delete cascade,
  to_user_id uuid not null references profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  suggested_board_id uuid references boards(id) on delete set null,
  suggested_column_id uuid references board_columns(id) on delete set null,
  suggested_priority text check (suggested_priority in ('low', 'medium', 'high')),
  created_at timestamptz not null default now()
);

alter table task_shares enable row level security;

create policy "Participants can view shares"
  on task_shares for select
  to authenticated
  using (auth.uid() = from_user_id or auth.uid() = to_user_id);

create policy "Senders can create shares"
  on task_shares for insert
  to authenticated
  with check (auth.uid() = from_user_id);

create policy "Recipients can update share status"
  on task_shares for update
  to authenticated
  using (auth.uid() = to_user_id or auth.uid() = from_user_id);

create policy "Participants can delete shares"
  on task_shares for delete
  to authenticated
  using (auth.uid() = from_user_id or auth.uid() = to_user_id);
