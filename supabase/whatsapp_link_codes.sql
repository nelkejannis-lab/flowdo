-- WhatsApp account linking via short one-time codes (NOVAT-AB12CD).
-- Safe to re-run in the Supabase SQL editor.

alter table public.profiles add column if not exists phone_number text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_phone_number_key'
  ) then
    alter table public.profiles add constraint profiles_phone_number_key unique (phone_number);
  end if;
end
$$;

create table if not exists public.whatsapp_link_codes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  code text not null unique,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  consumed_phone text,
  attempt_count integer not null default 0,
  max_attempts integer not null default 5,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint whatsapp_link_codes_code_format check (code ~ '^NOVAT-[A-Z0-9]{6}$'),
  constraint whatsapp_link_codes_attempts_check check (attempt_count >= 0 and max_attempts > 0)
);

create index if not exists whatsapp_link_codes_user_idx on public.whatsapp_link_codes (user_id, created_at desc);
create index if not exists whatsapp_link_codes_expires_idx on public.whatsapp_link_codes (expires_at);

alter table public.whatsapp_link_codes enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'whatsapp_link_codes'
      and policyname = 'users_select_own_whatsapp_link_codes'
  ) then
    create policy users_select_own_whatsapp_link_codes
      on public.whatsapp_link_codes
      for select
      using (auth.uid() = user_id);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'whatsapp_link_codes'
      and policyname = 'users_insert_own_whatsapp_link_codes'
  ) then
    create policy users_insert_own_whatsapp_link_codes
      on public.whatsapp_link_codes
      for insert
      with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'whatsapp_link_codes'
      and policyname = 'users_update_own_whatsapp_link_codes'
  ) then
    create policy users_update_own_whatsapp_link_codes
      on public.whatsapp_link_codes
      for update
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end
$$;

create or replace function public.touch_whatsapp_link_codes_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_touch_whatsapp_link_codes_updated_at on public.whatsapp_link_codes;
create trigger trg_touch_whatsapp_link_codes_updated_at
before update on public.whatsapp_link_codes
for each row execute function public.touch_whatsapp_link_codes_updated_at();
