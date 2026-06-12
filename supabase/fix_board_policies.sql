-- Fix infinite recursion between boards <-> board_members RLS policies
-- by using security definer helper functions that bypass RLS internally.

create or replace function is_board_member(_board_id uuid, _user_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from board_members m where m.board_id = _board_id and m.user_id = _user_id
  );
$$;

create or replace function is_board_owner(_board_id uuid, _user_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from boards b where b.id = _board_id and b.owner_id = _user_id
  );
$$;

-- boards: drop + recreate select policy using helper function
drop policy if exists "Members can view their boards" on boards;
create policy "Members can view their boards"
  on boards for select
  to authenticated
  using (
    auth.uid() = owner_id
    or is_board_member(id, auth.uid())
  );

-- board_columns: drop + recreate select policy using helper function
drop policy if exists "Members can view columns" on board_columns;
create policy "Members can view columns"
  on board_columns for select
  to authenticated
  using (
    is_board_owner(board_id, auth.uid())
    or is_board_member(board_id, auth.uid())
  );

-- board_members: drop + recreate select policy using helper function
drop policy if exists "Members can view membership" on board_members;
create policy "Members can view membership"
  on board_members for select
  to authenticated
  using (
    user_id = auth.uid()
    or is_board_owner(board_id, auth.uid())
  );

-- tasks: drop + recreate select policy using helper functions
drop policy if exists "Users can view their own or assigned tasks" on tasks;
create policy "Users can view their own or assigned tasks"
  on tasks for select
  to authenticated
  using (
    auth.uid() = owner_id
    or auth.uid() = assigned_to
    or (board_id is not null and is_board_member(board_id, auth.uid()))
    or (board_id is not null and is_board_owner(board_id, auth.uid()))
  );
