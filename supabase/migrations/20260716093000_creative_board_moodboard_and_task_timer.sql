create table if not exists creative_board_invites (
  id uuid primary key default gen_random_uuid(),
  from_user_id uuid not null references profiles(id) on delete cascade,
  to_user_id uuid not null references profiles(id) on delete cascade,
  role text not null check (role in ('owner', 'editor', 'viewer')),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  created_at timestamptz not null default now(),
  unique (from_user_id, to_user_id, status)
);

create table if not exists creative_board_members (
  owner_id uuid not null references profiles(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  role text not null check (role in ('owner', 'editor', 'viewer')),
  created_at timestamptz not null default now(),
  primary key (owner_id, user_id)
);

create table if not exists creative_moodboard_items (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references profiles(id) on delete cascade,
  title text not null,
  type text not null check (type in ('note', 'image', 'link')),
  text_content text,
  image_url text,
  link_url text,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table creative_board_invites enable row level security;
alter table creative_board_members enable row level security;
alter table creative_moodboard_items enable row level security;

create policy "Creative invites participants read"
  on creative_board_invites for select to authenticated
  using (auth.uid() = from_user_id or auth.uid() = to_user_id);

create policy "Creative invites sender insert"
  on creative_board_invites for insert to authenticated
  with check (auth.uid() = from_user_id);

create policy "Creative invites participants update"
  on creative_board_invites for update to authenticated
  using (auth.uid() = from_user_id or auth.uid() = to_user_id);

create policy "Creative members owner manage"
  on creative_board_members for all to authenticated
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

create policy "Creative members member read own"
  on creative_board_members for select to authenticated
  using (auth.uid() = owner_id or auth.uid() = user_id);

create policy "Creative moodboard read access"
  on creative_moodboard_items for select to authenticated
  using (
    auth.uid() = owner_id
    or exists (
      select 1 from creative_board_members m
      where m.owner_id = creative_moodboard_items.owner_id
        and m.user_id = auth.uid()
    )
  );

create policy "Creative moodboard owner/editor insert"
  on creative_moodboard_items for insert to authenticated
  with check (
    auth.uid() = owner_id
    or exists (
      select 1 from creative_board_members m
      where m.owner_id = creative_moodboard_items.owner_id
        and m.user_id = auth.uid()
        and m.role in ('owner', 'editor')
    )
  );

create policy "Creative moodboard owner/editor update"
  on creative_moodboard_items for update to authenticated
  using (
    auth.uid() = owner_id
    or exists (
      select 1 from creative_board_members m
      where m.owner_id = creative_moodboard_items.owner_id
        and m.user_id = auth.uid()
        and m.role in ('owner', 'editor')
    )
  )
  with check (
    auth.uid() = owner_id
    or exists (
      select 1 from creative_board_members m
      where m.owner_id = creative_moodboard_items.owner_id
        and m.user_id = auth.uid()
        and m.role in ('owner', 'editor')
    )
  );

create policy "Creative moodboard owner/editor delete"
  on creative_moodboard_items for delete to authenticated
  using (
    auth.uid() = owner_id
    or exists (
      select 1 from creative_board_members m
      where m.owner_id = creative_moodboard_items.owner_id
        and m.user_id = auth.uid()
        and m.role in ('owner', 'editor')
    )
  );

alter table task_time_entries add column if not exists owner_id uuid references profiles(id) on delete cascade;
alter table task_time_entries alter column board_id drop not null;

drop policy if exists "Board members manage task time" on task_time_entries;
create policy "Board members or owners manage task time"
  on task_time_entries for all to authenticated
  using (
    (board_id is not null and exists (
      select 1 from board_members bm where bm.board_id = task_time_entries.board_id and bm.user_id = auth.uid()
    ))
    or (board_id is not null and exists (
      select 1 from boards b where b.id = task_time_entries.board_id and b.owner_id = auth.uid()
    ))
    or (board_id is null and owner_id = auth.uid())
  )
  with check (
    (board_id is not null and exists (
      select 1 from board_members bm where bm.board_id = task_time_entries.board_id and bm.user_id = auth.uid()
    ))
    or (board_id is not null and exists (
      select 1 from boards b where b.id = task_time_entries.board_id and b.owner_id = auth.uid()
    ))
    or (board_id is null and owner_id = auth.uid())
  );
