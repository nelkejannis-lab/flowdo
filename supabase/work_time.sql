-- NOVAT: sync work time entries & settings across devices

create table if not exists work_time_entries (
  user_id uuid not null references profiles(id) on delete cascade,
  date date not null,
  worked_minutes integer not null default 0,
  break_minutes integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, date)
);

create table if not exists work_time_settings (
  user_id uuid primary key references profiles(id) on delete cascade,
  weekly_hours numeric not null default 38.5,
  work_days_per_week integer not null default 5,
  default_break_minutes integer not null default 45,
  settled_weekend_days integer not null default 0,
  updated_at timestamptz not null default now()
);

alter table work_time_entries enable row level security;
alter table work_time_settings enable row level security;

create policy "Users manage their own work time entries"
  on work_time_entries for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "Users manage their own work time settings"
  on work_time_settings for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
