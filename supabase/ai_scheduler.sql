-- Flowdo: AI scheduler - check colleague availability for a proposed appointment
-- Returns busy/free per requested user, limited to friends (and yourself), without exposing
-- the full calendar entry (only the conflicting title, for the requesting user's context).

create or replace function check_colleague_availability(
  p_user_ids uuid[],
  p_date date,
  p_end_date date,
  p_start_time time,
  p_end_time time
)
returns table(user_id uuid, busy boolean, conflict_title text)
language sql
security definer
set search_path = public
stable
as $$
  select
    u.id as user_id,
    exists (
      select 1 from calendar_entries e
      where e.owner_id = u.id
        and e.type = 'termin'
        and e.date <= coalesce(p_end_date, p_date)
        and coalesce(e.end_date, e.date) >= p_date
        and (
          p_start_time is null or p_end_time is null
          or e.start_time is null or e.end_time is null
          or (e.start_time < p_end_time and e.end_time > p_start_time)
        )
    ) as busy,
    (
      select e.title from calendar_entries e
      where e.owner_id = u.id
        and e.type = 'termin'
        and e.date <= coalesce(p_end_date, p_date)
        and coalesce(e.end_date, e.date) >= p_date
        and (
          p_start_time is null or p_end_time is null
          or e.start_time is null or e.end_time is null
          or (e.start_time < p_end_time and e.end_time > p_start_time)
        )
      limit 1
    ) as conflict_title
  from unnest(p_user_ids) as u(id)
  where u.id = auth.uid() or are_friends(u.id, auth.uid());
$$;

grant execute on function check_colleague_availability(uuid[], date, date, time, time) to authenticated;
