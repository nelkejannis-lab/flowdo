-- Admin badge management + profile admin flag

alter table profiles add column if not exists is_admin boolean not null default false;
alter table profiles add column if not exists badge text;

create or replace function admin_set_badge(p_user_id uuid, p_badge text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from profiles where id = auth.uid() and is_admin = true) then
    raise exception 'not authorized';
  end if;
  update profiles set badge = nullif(trim(p_badge), '') where id = p_user_id;
end;
$$;

grant execute on function admin_set_badge(uuid, text) to authenticated;
