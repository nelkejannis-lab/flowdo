-- NOVAT: tamper-proof time tracking (German Arbeitszeiterfassung)
-- Adds an append-only punch event log ("Stempeluhr") and a change/audit trail.
-- Both are append-only at the API level: RLS grants SELECT + INSERT only, so
-- authenticated users can never UPDATE or DELETE their own records. Deletion
-- still cascades from profiles (GDPR account deletion) via the FK on delete cascade,
-- which intentionally bypasses RLS through the foreign-key action.

-- 1. Punch events (Kommen / Gehen) ---------------------------------------------
create table if not exists work_time_punches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  punched_at timestamptz not null default now(),
  kind text not null check (kind in ('in', 'out')),
  source text not null default 'app',
  created_at timestamptz not null default now()
);

create index if not exists work_time_punches_user_time_idx
  on work_time_punches (user_id, punched_at desc);

alter table work_time_punches enable row level security;

-- SELECT + INSERT only → append-only. No update/delete policy is intentional.
create policy "Users can read their own punches"
  on work_time_punches for select
  to authenticated
  using (user_id = auth.uid());

create policy "Users can add their own punches"
  on work_time_punches for insert
  to authenticated
  with check (user_id = auth.uid());

-- 2. Change/audit trail for manual corrections ---------------------------------
create table if not exists work_time_audit (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  entry_date date not null,
  field text not null,
  old_value text,
  new_value text,
  reason text,
  changed_at timestamptz not null default now()
);

create index if not exists work_time_audit_user_date_idx
  on work_time_audit (user_id, entry_date desc);

alter table work_time_audit enable row level security;

create policy "Users can read their own audit log"
  on work_time_audit for select
  to authenticated
  using (user_id = auth.uid());

create policy "Users can add their own audit log entries"
  on work_time_audit for insert
  to authenticated
  with check (user_id = auth.uid());
