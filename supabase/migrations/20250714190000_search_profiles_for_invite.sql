-- Org admins can search profiles (username, display_name, email) for inviting members.

create or replace function public.search_profiles_for_invite(p_query text, p_org_id uuid)
returns table (
  id uuid,
  display_name text,
  username text,
  role_description text,
  app_role text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_q text;
begin
  v_q := trim(both from lower(regexp_replace(coalesce(p_query, ''), '^@', '')));
  if length(v_q) < 2 then
    return;
  end if;

  if not public.is_app_admin() and not public.is_org_owner_or_admin(p_org_id) then
    raise exception 'Not authorized';
  end if;

  return query
  select p.id, p.display_name, p.username, p.role_description, p.app_role
  from public.profiles p
  left join auth.users u on u.id = p.id
  where (
    p.username ilike '%' || v_q || '%'
    or p.display_name ilike '%' || v_q || '%'
    or lower(coalesce(u.email, '')) ilike '%' || v_q || '%'
  )
  and p.id <> auth.uid()
  and not exists (
    select 1 from public.organization_members om
    where om.org_id = p_org_id and om.user_id = p.id
  )
  order by
    case
      when lower(p.username) like v_q || '%' then 0
      when lower(p.display_name) like v_q || '%' then 1
      else 2
    end,
    p.display_name
  limit 12;
end;
$$;

revoke all on function public.search_profiles_for_invite(text, uuid) from public;
grant execute on function public.search_profiles_for_invite(text, uuid) to authenticated;
