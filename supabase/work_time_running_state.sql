-- NOVAT: sync running clock-in state across devices
-- Run this in the Supabase SQL editor (Project -> SQL Editor -> New query)

alter table work_time_settings add column if not exists running_started_at timestamptz;
alter table work_time_settings add column if not exists running_date date;
