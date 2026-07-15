-- Organization invite links (company join URL)
create table if not exists org_invite_links (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  token text not null unique,
  role text not null default 'member',
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists org_invite_links_token_idx on org_invite_links (token);

alter table org_invite_links enable row level security;

create policy "Org admins manage invite links"
  on org_invite_links for all
  to authenticated
  using (
    exists (
      select 1 from organization_members m
      where m.org_id = org_invite_links.org_id
        and m.user_id = auth.uid()
        and m.role in ('admin', 'owner')
    )
  );

-- Memory items (WhatsApp-style capture)
create table if not exists memory_items (
  id uuid primary key,
  owner_id uuid not null references profiles(id) on delete cascade,
  text text not null,
  source text not null default 'manual',
  meeting_id uuid,
  tags text[] default '{}',
  linked_brain_page_id uuid,
  created_at timestamptz not null default now()
);

alter table memory_items enable row level security;

create policy "Users manage own memory"
  on memory_items for all
  to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());
