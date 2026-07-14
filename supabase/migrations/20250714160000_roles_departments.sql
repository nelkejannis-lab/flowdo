-- v1.6.1: App roles, departments (Bereiche), role descriptions

alter table profiles add column if not exists app_role text not null default 'user'
  check (app_role in ('user', 'admin'));
alter table profiles add column if not exists role_description text;

update profiles set app_role = 'admin' where is_admin = true and app_role = 'user';

create table if not exists org_departments (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  description text,
  parent_id uuid references org_departments(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists department_members (
  department_id uuid not null references org_departments(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  role text not null default 'member' check (role in ('head', 'member')),
  primary key (department_id, user_id)
);

alter table organization_members add column if not exists department_id uuid
  references org_departments(id) on delete set null;
alter table teams add column if not exists department_id uuid
  references org_departments(id) on delete set null;

alter table org_departments enable row level security;
alter table department_members enable row level security;

create policy "Org members view departments"
  on org_departments for select to authenticated
  using (
    exists (select 1 from organization_members om where om.org_id = org_departments.org_id and om.user_id = auth.uid())
    or exists (select 1 from profiles p where p.id = auth.uid() and p.app_role = 'admin')
  );

create policy "Org admins manage departments"
  on org_departments for all to authenticated
  using (
    exists (
      select 1 from organization_members om
      where om.org_id = org_departments.org_id and om.user_id = auth.uid()
        and om.role in ('owner', 'admin')
    )
    or exists (select 1 from profiles p where p.id = auth.uid() and p.app_role = 'admin')
  )
  with check (
    exists (
      select 1 from organization_members om
      where om.org_id = org_departments.org_id and om.user_id = auth.uid()
        and om.role in ('owner', 'admin')
    )
    or exists (select 1 from profiles p where p.id = auth.uid() and p.app_role = 'admin')
  );

create policy "Org members view department membership"
  on department_members for select to authenticated
  using (
    exists (
      select 1 from org_departments d
      join organization_members om on om.org_id = d.org_id
      where d.id = department_members.department_id and om.user_id = auth.uid()
    )
    or exists (select 1 from profiles p where p.id = auth.uid() and p.app_role = 'admin')
  );

create policy "Org admins manage department membership"
  on department_members for all to authenticated
  using (
    exists (
      select 1 from org_departments d
      join organization_members om on om.org_id = d.org_id
      where d.id = department_members.department_id and om.user_id = auth.uid()
        and om.role in ('owner', 'admin', 'manager')
    )
    or exists (select 1 from profiles p where p.id = auth.uid() and p.app_role = 'admin')
  )
  with check (
    exists (
      select 1 from org_departments d
      join organization_members om on om.org_id = d.org_id
      where d.id = department_members.department_id and om.user_id = auth.uid()
        and om.role in ('owner', 'admin', 'manager')
    )
    or exists (select 1 from profiles p where p.id = auth.uid() and p.app_role = 'admin')
  );

-- Super admins can view all organizations
drop policy if exists "Org members can view their org" on organizations;
create policy "Org members can view their org"
  on organizations for select to authenticated
  using (
    exists (select 1 from organization_members om where om.org_id = organizations.id and om.user_id = auth.uid())
    or exists (select 1 from profiles p where p.id = auth.uid() and p.app_role = 'admin')
  );

create or replace function admin_set_app_role(p_user_id uuid, p_role text)
returns void language plpgsql security definer as $$
begin
  if p_role not in ('user', 'admin') then
    raise exception 'Invalid app role';
  end if;
  if not exists (select 1 from profiles where id = auth.uid() and app_role = 'admin') then
    raise exception 'Not authorized';
  end if;
  update profiles set app_role = p_role, is_admin = (p_role = 'admin') where id = p_user_id;
end;
$$;

create or replace function admin_set_org_role(p_org_id uuid, p_user_id uuid, p_role text)
returns void language plpgsql security definer as $$
begin
  if p_role not in ('owner', 'admin', 'manager', 'member') then
    raise exception 'Invalid org role';
  end if;
  if not exists (
    select 1 from profiles where id = auth.uid() and app_role = 'admin'
  ) and not exists (
    select 1 from organization_members
    where org_id = p_org_id and user_id = auth.uid() and role in ('owner', 'admin')
  ) then
    raise exception 'Not authorized';
  end if;
  insert into organization_members (org_id, user_id, role)
  values (p_org_id, p_user_id, p_role)
  on conflict (org_id, user_id) do update set role = excluded.role;
  update profiles set org_id = p_org_id where id = p_user_id;
end;
$$;

grant execute on function admin_set_app_role(uuid, text) to authenticated;
grant execute on function admin_set_org_role(uuid, uuid, text) to authenticated;

create or replace function handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, username, display_name, role_description)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)),
    nullif(new.raw_user_meta_data->>'role_description', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;
