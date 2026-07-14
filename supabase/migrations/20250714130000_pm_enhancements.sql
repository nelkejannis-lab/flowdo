-- v1.5.0 PM enhancements: time budget, milestones, snooze/reminders

alter table boards add column if not exists time_budget_minutes int check (time_budget_minutes is null or time_budget_minutes > 0);

create table if not exists board_milestones (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references boards(id) on delete cascade,
  title text not null,
  due_date date not null,
  completed boolean not null default false,
  created_at timestamptz not null default now()
);
alter table board_milestones enable row level security;
create policy "Board members manage milestones"
  on board_milestones for all to authenticated
  using (exists (
    select 1 from board_members bm
    where bm.board_id = board_milestones.board_id and bm.user_id = auth.uid()
  ) or exists (
    select 1 from boards b where b.id = board_milestones.board_id and b.owner_id = auth.uid()
  ))
  with check (exists (
    select 1 from board_members bm
    where bm.board_id = board_milestones.board_id and bm.user_id = auth.uid()
  ) or exists (
    select 1 from boards b where b.id = board_milestones.board_id and b.owner_id = auth.uid()
  ));

alter table tasks add column if not exists snoozed_until timestamptz;
alter table tasks add column if not exists reminder_at timestamptz;
