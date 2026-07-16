-- NOVAT: Sync user settings across devices
-- Run this in the Supabase SQL editor (Project -> SQL Editor -> New query)

-- 1. Add settings JSONB column to profiles
alter table public.profiles add column if not exists settings jsonb not null default '{}'::jsonb;
