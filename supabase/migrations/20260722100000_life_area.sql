-- Privat vs Arbeit separation for tasks, calendar entries, and boards/projects

alter table public.tasks
  add column if not exists life_area text not null default 'work'
    check (life_area in ('work', 'private'));

alter table public.calendar_entries
  add column if not exists life_area text not null default 'work'
    check (life_area in ('work', 'private'));

alter table public.boards
  add column if not exists life_area text not null default 'work'
    check (life_area in ('work', 'private'));

create index if not exists tasks_life_area_idx on public.tasks (owner_id, life_area);
create index if not exists calendar_entries_life_area_idx on public.calendar_entries (owner_id, life_area);
create index if not exists boards_life_area_idx on public.boards (owner_id, life_area);
