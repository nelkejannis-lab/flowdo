-- Calendar entries: optional project link + invite notifications

alter table calendar_entries
  add column if not exists board_id uuid references boards(id) on delete set null;

create index if not exists calendar_entries_board_id_idx on calendar_entries(board_id);

-- Extend notification types for calendar invites
alter table notifications drop constraint if exists notifications_type_check;
alter table notifications add constraint notifications_type_check
  check (type in ('mention', 'task_share', 'board_invite', 'birthday', 'question', 'calendar_invite'));

create or replace function notify_calendar_invites(
  p_entry_id uuid,
  p_inviter_id uuid,
  p_user_ids uuid[]
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inviter_name text;
  v_title text;
  v_date date;
  v_uid uuid;
begin
  select display_name into v_inviter_name from profiles where id = p_inviter_id;
  select title, date into v_title, v_date from calendar_entries where id = p_entry_id;

  foreach v_uid in array p_user_ids loop
    if v_uid <> p_inviter_id then
      insert into notifications (user_id, type, title, body, link)
      values (
        v_uid,
        'calendar_invite',
        coalesce(v_inviter_name, 'Jemand') || ' hat dich zu einem Termin eingeladen',
        coalesce(v_title, 'Termin') || ' · ' || to_char(v_date, 'DD.MM.YYYY'),
        '/termine'
      );
    end if;
  end loop;
end;
$$;

grant execute on function notify_calendar_invites(uuid, uuid, uuid[]) to authenticated;
