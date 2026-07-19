-- Optional predecessor links between project tasks (same board).
-- task_id is blocked by depends_on_id until that predecessor is completed.

create table if not exists task_dependencies (
  task_id uuid not null references tasks(id) on delete cascade,
  depends_on_id uuid not null references tasks(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (task_id, depends_on_id),
  check (task_id <> depends_on_id)
);

create index if not exists task_dependencies_depends_on_idx on task_dependencies (depends_on_id);

alter table task_dependencies enable row level security;

create policy "Board members can view task dependencies"
  on task_dependencies for select to authenticated
  using (exists (
    select 1 from tasks t
    join board_members bm on bm.board_id = t.board_id
    where t.id = task_dependencies.task_id and bm.user_id = auth.uid()
  ) or exists (
    select 1 from tasks t where t.id = task_dependencies.task_id and t.owner_id = auth.uid()
  ));

create policy "Board members can manage task dependencies"
  on task_dependencies for all to authenticated
  using (exists (
    select 1 from tasks t
    join board_members bm on bm.board_id = t.board_id
    where t.id = task_dependencies.task_id and bm.user_id = auth.uid()
  ) or exists (
    select 1 from tasks t where t.id = task_dependencies.task_id and t.owner_id = auth.uid()
  ))
  with check (
    exists (
      select 1 from tasks t
      join board_members bm on bm.board_id = t.board_id
      where t.id = task_dependencies.task_id and bm.user_id = auth.uid()
    ) or exists (
      select 1 from tasks t where t.id = task_dependencies.task_id and t.owner_id = auth.uid()
    )
  );

-- Both tasks must belong to the same board (enforced via trigger for light integrity).
create or replace function public.task_dependencies_same_board()
returns trigger
language plpgsql
as $$
declare
  board_a uuid;
  board_b uuid;
begin
  select board_id into board_a from tasks where id = new.task_id;
  select board_id into board_b from tasks where id = new.depends_on_id;
  if board_a is null or board_b is null or board_a <> board_b then
    raise exception 'Dependencies must be between tasks on the same board';
  end if;
  return new;
end;
$$;

drop trigger if exists task_dependencies_same_board_trg on task_dependencies;
create trigger task_dependencies_same_board_trg
  before insert or update on task_dependencies
  for each row execute function public.task_dependencies_same_board();
