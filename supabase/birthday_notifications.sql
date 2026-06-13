-- Extend notification type to include 'birthday'
alter table notifications drop constraint if exists notifications_type_check;
alter table notifications add constraint notifications_type_check
  check (type in ('mention', 'task_share', 'board_invite', 'birthday'));

-- Function: create birthday notifications for today's birthdays among friends
-- Called on app load; idempotent (won't double-create for same day)
create or replace function create_birthday_notifications_for_today()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_friend record;
  v_today date := current_date;
  v_already_exists boolean;
begin
  -- Loop over all accepted friendships where the other person has a birthday today
  for v_friend in
    select
      p.id as friend_id,
      p.display_name as friend_name,
      f.requester_id,
      f.addressee_id
    from friendships f
    join profiles p on (
      case when f.requester_id = auth.uid() then p.id = f.addressee_id
           else p.id = f.requester_id end
    )
    where f.status = 'accepted'
      and (f.requester_id = auth.uid() or f.addressee_id = auth.uid())
      and p.birthday is not null
      and extract(month from p.birthday) = extract(month from v_today)
      and extract(day from p.birthday) = extract(day from v_today)
  loop
    -- Check if notification already exists for today
    select exists (
      select 1 from notifications
      where user_id = auth.uid()
        and type = 'birthday'
        and link = '/tasks/inbox/birthday/' || v_friend.friend_id
        and created_at::date = v_today
    ) into v_already_exists;

    if not v_already_exists then
      insert into notifications (user_id, type, title, body, link, read)
      values (
        auth.uid(),
        'birthday',
        '🎂 ' || v_friend.friend_name || ' hat heute Geburtstag!',
        'Vergiss nicht zu gratulieren 🎉',
        '/tasks/inbox/birthday/' || v_friend.friend_id,
        false
      );
    end if;
  end loop;
end;
$$;

grant execute on function create_birthday_notifications_for_today() to authenticated;
