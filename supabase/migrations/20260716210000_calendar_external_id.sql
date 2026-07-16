-- Stable linking for external calendar events (Outlook / Google / iCal)
-- Idempotent: safe if columns/indexes already exist

alter table public.calendar_entries
  add column if not exists external_id text,
  add column if not exists external_provider text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'calendar_entries_external_provider_check'
  ) then
    alter table public.calendar_entries
      add constraint calendar_entries_external_provider_check
      check (external_provider is null or external_provider in ('google', 'microsoft', 'ical'));
  end if;
end $$;

create unique index if not exists calendar_entries_owner_external_uidx
  on public.calendar_entries (owner_id, external_provider, external_id)
  where external_id is not null and external_provider is not null;

create unique index if not exists calendar_entries_owner_type_title_date_uidx
  on public.calendar_entries (owner_id, type, title, date);
