-- Returns all busy calendar entries for a list of users within a date range.
-- Only returns entries for the caller themselves or their friends (security definer).
create or replace function get_colleague_busy_slots(
  p_user_ids uuid[],
  p_from_date date,
  p_to_date date
)
returns table(user_id uuid, title text, date date, end_date date, start_time time, end_time time)
language sql
security definer
set search_path = public
stable
as $$
  select
    e.owner_id as user_id,
    e.title,
    e.date,
    e.end_date,
    e.start_time,
    e.end_time
  from calendar_entries e
  join unnest(p_user_ids) as u(id) on e.owner_id = u.id
  where e.type = 'termin'
    and e.date <= p_to_date
    and coalesce(e.end_date, e.date) >= p_from_date
    and (u.id = auth.uid() or are_friends(u.id, auth.uid()));
$$;

grant execute on function get_colleague_busy_slots(uuid[], date, date) to authenticated;
