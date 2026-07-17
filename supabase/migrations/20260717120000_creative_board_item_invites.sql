-- Per-item Creative Board sharing (notes + moodboard cards)

create table if not exists creative_board_item_invites (
  id uuid primary key default gen_random_uuid(),
  item_type text not null check (item_type in ('note', 'moodboard')),
  item_id text not null,
  from_user_id uuid not null references profiles(id) on delete cascade,
  to_user_id uuid not null references profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  created_at timestamptz not null default now()
);

create unique index if not exists creative_board_item_invites_pending_unique
  on creative_board_item_invites (item_type, item_id, to_user_id)
  where status = 'pending';

alter table creative_board_item_invites enable row level security;

create or replace function is_creative_item_owner(_item_type text, _item_id text, _user_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select case
    when _item_type = 'note' then exists (
      select 1 from brain_pages where id = _item_id and owner_id = _user_id
    )
    when _item_type = 'moodboard' then exists (
      select 1 from creative_moodboard_items where id::text = _item_id and owner_id = _user_id
    )
    else false
  end;
$$;

create or replace function has_creative_item_invite(_item_type text, _item_id text, _user_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from creative_board_item_invites
    where item_type = _item_type
      and item_id = _item_id
      and to_user_id = _user_id
      and status = 'accepted'
  );
$$;

create policy "Creative item invites participants read"
  on creative_board_item_invites for select to authenticated
  using (auth.uid() = from_user_id or auth.uid() = to_user_id);

create policy "Creative item invites sender insert"
  on creative_board_item_invites for insert to authenticated
  with check (
    auth.uid() = from_user_id
    and is_creative_item_owner(item_type, item_id, auth.uid())
  );

create policy "Creative item invites participants update"
  on creative_board_item_invites for update to authenticated
  using (auth.uid() = from_user_id or auth.uid() = to_user_id);

drop policy if exists "Users can manage their own brain_pages" on brain_pages;

create policy "Brain pages select owned or invited"
  on brain_pages for select to authenticated
  using (
    owner_id = auth.uid()
    or has_creative_item_invite('note', id, auth.uid())
  );

create policy "Brain pages owner insert"
  on brain_pages for insert to authenticated
  with check (auth.uid() = owner_id);

create policy "Brain pages owner update"
  on brain_pages for update to authenticated
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

create policy "Brain pages owner delete"
  on brain_pages for delete to authenticated
  using (auth.uid() = owner_id);

drop policy if exists "Creative moodboard read access" on creative_moodboard_items;

create policy "Creative moodboard read access"
  on creative_moodboard_items for select to authenticated
  using (
    auth.uid() = owner_id
    or exists (
      select 1 from creative_board_members m
      where m.owner_id = creative_moodboard_items.owner_id
        and m.user_id = auth.uid()
    )
    or has_creative_item_invite('moodboard', id::text, auth.uid())
  );
