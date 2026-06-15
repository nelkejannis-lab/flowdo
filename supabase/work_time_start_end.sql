-- Mooncrew: add start/end time to work time entries
-- Run this in the Supabase SQL editor (Project -> SQL Editor -> New query)

alter table work_time_entries add column if not exists start_time text;
alter table work_time_entries add column if not exists end_time text;
