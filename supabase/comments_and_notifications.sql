-- Comments (shared for tasks and boards)
create table if not exists comments (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references profiles(id) on delete cascade,
  task_id uuid references tasks(id) on delete cascade,
  board_id uuid references boards(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),
  check (
    (task_id is not null and board_id is null) or
    (board_id is not null and task_id is null)
  )
);

alter table comments enable row level security;

-- Anyone who can see the task/board can read comments
create policy "Comments readable by task/board participants"
  on comments for select
  to authenticated
  using (
    author_id = auth.uid()
    or (task_id is not null and exists (
      select 1 from tasks t
      where t.id = task_id
        and (t.owner_id = auth.uid() or t.assigned_to = auth.uid())
    ))
    or (board_id is not null and exists (
      select 1 from board_members bm where bm.board_id = comments.board_id and bm.user_id = auth.uid()
      union
      select 1 from boards b where b.id = comments.board_id and b.owner_id = auth.uid()
    ))
  );

create policy "Authenticated users can comment"
  on comments for insert
  to authenticated
  with check (auth.uid() = author_id);

create policy "Authors can delete own comments"
  on comments for delete
  to authenticated
  using (auth.uid() = author_id);

-- Notifications
create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  type text not null check (type in ('mention', 'task_share', 'board_invite')),
  title text not null,
  body text,
  link text,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

alter table notifications enable row level security;

create policy "Users see their own notifications"
  on notifications for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Function: create mention notifications from a comment
create or replace function notify_mentions(
  p_comment_id uuid,
  p_author_id uuid,
  p_body text,
  p_task_id uuid,
  p_board_id uuid,
  p_mentioned_user_ids uuid[]
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_author_name text;
  v_context_title text;
  v_link text;
  v_uid uuid;
begin
  select display_name into v_author_name from profiles where id = p_author_id;

  if p_task_id is not null then
    select title into v_context_title from tasks where id = p_task_id;
    v_link := '/tasks';
  else
    select title into v_context_title from boards where id = p_board_id;
    v_link := '/projekte/' || p_board_id;
  end if;

  foreach v_uid in array p_mentioned_user_ids loop
    if v_uid <> p_author_id then
      insert into notifications (user_id, type, title, body, link)
      values (
        v_uid,
        'mention',
        v_author_name || ' hat dich erwähnt',
        left(p_body, 120),
        v_link
      );
    end if;
  end loop;
end;
$$;

grant execute on function notify_mentions(uuid, uuid, text, uuid, uuid, uuid[]) to authenticated;
