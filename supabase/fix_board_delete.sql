-- Allow board owners to update tasks within boards they own.
-- This is required so that deleting a board can succeed: deleting a board
-- cascades to "ON DELETE SET NULL" updates on tasks.board_id/column_id for
-- ALL tasks in that board, even tasks owned by other members. Without this
-- policy, that cascading UPDATE is blocked by RLS for tasks owned by other
-- users, causing the whole board DELETE to fail.

drop policy if exists "Board owners can update tasks in their boards" on tasks;
create policy "Board owners can update tasks in their boards"
  on tasks for update
  to authenticated
  using (
    board_id is not null
    and is_board_owner(board_id, auth.uid())
  )
  with check (
    board_id is null
    or is_board_owner(board_id, auth.uid())
  );
