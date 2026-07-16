-- Explicit Eisenhower matrix placement (not inferred from urgent/important defaults).
alter table public.tasks
  add column if not exists matrix_placed boolean not null default false;

-- Preserve prior Q1–Q3 placement; leave (false,false) uncategorized.
update public.tasks
set matrix_placed = true
where urgent = true or important = true;
