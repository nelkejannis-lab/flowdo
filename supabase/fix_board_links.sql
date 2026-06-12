-- Add internal/external launch date fields to boards (projects).
alter table boards add column if not exists internal_launch date;
alter table boards add column if not exists external_launch date;
