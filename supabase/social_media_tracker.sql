-- Social Media Tracker (Instagram)
-- Stores connected Instagram Business/Creator accounts and synced metrics.

create table if not exists social_accounts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  platform text not null default 'instagram',
  username text not null,
  ig_user_id text not null,
  access_token text,
  name text,
  biography text,
  website text,
  profile_picture_url text,
  last_synced_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists social_metrics (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references social_accounts(id) on delete cascade,
  date date not null,
  followers_count int,
  follows_count int,
  media_count int,
  reach int,
  profile_views int,
  accounts_engaged int,
  total_interactions int,
  likes int,
  comments int,
  shares int,
  saves int,
  follows_and_unfollows int,
  created_at timestamptz not null default now(),
  unique (account_id, date)
);

create table if not exists social_posts (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references social_accounts(id) on delete cascade,
  media_id text not null,
  media_type text,
  caption text,
  permalink text,
  media_url text,
  thumbnail_url text,
  posted_at timestamptz,
  like_count int,
  comments_count int,
  reach int,
  saved int,
  shares int,
  total_interactions int,
  created_at timestamptz not null default now(),
  unique (account_id, media_id)
);

create table if not exists social_stories (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references social_accounts(id) on delete cascade,
  media_id text not null,
  media_type text,
  posted_at timestamptz,
  impressions int,
  reach int,
  replies int,
  exits int,
  taps_forward int,
  taps_back int,
  created_at timestamptz not null default now(),
  unique (account_id, media_id)
);

alter table social_accounts enable row level security;
alter table social_metrics enable row level security;
alter table social_posts enable row level security;
alter table social_stories enable row level security;

create policy "Owners manage their social accounts" on social_accounts
  for all to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create policy "Owners manage their social metrics" on social_metrics
  for all to authenticated
  using (exists (select 1 from social_accounts a where a.id = account_id and a.owner_id = auth.uid()))
  with check (exists (select 1 from social_accounts a where a.id = account_id and a.owner_id = auth.uid()));

create policy "Owners manage their social posts" on social_posts
  for all to authenticated
  using (exists (select 1 from social_accounts a where a.id = account_id and a.owner_id = auth.uid()))
  with check (exists (select 1 from social_accounts a where a.id = account_id and a.owner_id = auth.uid()));

create policy "Owners manage their social stories" on social_stories
  for all to authenticated
  using (exists (select 1 from social_accounts a where a.id = account_id and a.owner_id = auth.uid()))
  with check (exists (select 1 from social_accounts a where a.id = account_id and a.owner_id = auth.uid()));
