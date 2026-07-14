-- Fix infinite RLS recursion on organization_members (self-referential policies).

-- Helper functions bypass RLS when checking membership / admin status.
create or replace function public.is_app_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and (app_role = 'admin' or is_admin = true)
  );
$$;

create or replace function public.is_org_member(p_org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.organization_members
    where org_id = p_org_id and user_id = auth.uid()
  );
$$;

create or replace function public.is_org_manager_or_above(p_org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.organization_members
    where org_id = p_org_id
      and user_id = auth.uid()
      and role in ('owner', 'admin', 'manager')
  );
$$;

create or replace function public.is_org_owner_or_admin(p_org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.organization_members
    where org_id = p_org_id
      and user_id = auth.uid()
      and role in ('owner', 'admin')
  );
$$;

create or replace function public.is_org_manager_of_user(p_target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.organization_members om1
    join public.organization_members om2 on om1.org_id = om2.org_id
    where om1.user_id = auth.uid()
      and om1.role in ('owner', 'admin', 'manager')
      and om2.user_id = p_target_user_id
  );
$$;

create or replace function public.is_org_member_for_department(p_department_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.org_departments d
    join public.organization_members om on om.org_id = d.org_id
    where d.id = p_department_id and om.user_id = auth.uid()
  );
$$;

grant execute on function public.is_app_admin() to authenticated;
grant execute on function public.is_org_member(uuid) to authenticated;
grant execute on function public.is_org_manager_or_above(uuid) to authenticated;
grant execute on function public.is_org_owner_or_admin(uuid) to authenticated;
grant execute on function public.is_org_manager_of_user(uuid) to authenticated;
grant execute on function public.is_org_member_for_department(uuid) to authenticated;

-- organizations
drop policy if exists "Org members can view their org" on public.organizations;
drop policy if exists "Authenticated users can create orgs" on public.organizations;
drop policy if exists "Org owners and admins can update org" on public.organizations;

create policy "Org members can view their org"
  on public.organizations for select to authenticated
  using (
    public.is_org_member(id)
    or owner_id = auth.uid()
    or public.is_app_admin()
  );

create policy "Authenticated users can create orgs"
  on public.organizations for insert to authenticated
  with check (auth.uid() = owner_id);

create policy "Org owners and admins can update org"
  on public.organizations for update to authenticated
  using (public.is_org_owner_or_admin(id) or public.is_app_admin())
  with check (public.is_org_owner_or_admin(id) or public.is_app_admin());

-- organization_members
drop policy if exists "Org members can view membership" on public.organization_members;
drop policy if exists "Org owners and admins manage members" on public.organization_members;
drop policy if exists "Users can join org when invited via insert self" on public.organization_members;

create policy "Org members can view membership"
  on public.organization_members for select to authenticated
  using (public.is_org_member(org_id) or public.is_app_admin());

create policy "Users can insert own membership"
  on public.organization_members for insert to authenticated
  with check (
    auth.uid() = user_id
    or public.is_org_owner_or_admin(org_id)
    or public.is_app_admin()
  );

create policy "Org owners and admins update members"
  on public.organization_members for update to authenticated
  using (public.is_org_owner_or_admin(org_id) or public.is_app_admin())
  with check (public.is_org_owner_or_admin(org_id) or public.is_app_admin());

create policy "Org owners and admins delete members"
  on public.organization_members for delete to authenticated
  using (public.is_org_owner_or_admin(org_id) or public.is_app_admin());

-- org_departments (avoid organization_members in policy expressions)
drop policy if exists "Org members view departments" on public.org_departments;
drop policy if exists "Org admins manage departments" on public.org_departments;

create policy "Org members view departments"
  on public.org_departments for select to authenticated
  using (public.is_org_member(org_id) or public.is_app_admin());

create policy "Org admins manage departments"
  on public.org_departments for all to authenticated
  using (public.is_org_owner_or_admin(org_id) or public.is_app_admin())
  with check (public.is_org_owner_or_admin(org_id) or public.is_app_admin());

-- department_members
drop policy if exists "Org members view department membership" on public.department_members;
drop policy if exists "Org admins manage department membership" on public.department_members;

create policy "Org members view department membership"
  on public.department_members for select to authenticated
  using (
    public.is_org_member_for_department(department_id)
    or public.is_app_admin()
  );

create policy "Org admins manage department membership"
  on public.department_members for all to authenticated
  using (
    public.is_org_manager_or_above(
      (select d.org_id from public.org_departments d where d.id = department_id)
    )
    or public.is_app_admin()
  )
  with check (
    public.is_org_manager_or_above(
      (select d.org_id from public.org_departments d where d.id = department_id)
    )
    or public.is_app_admin()
  );

-- absence_periods
drop policy if exists "Users manage own absence_periods" on public.absence_periods;

create policy "Users manage own absence_periods"
  on public.absence_periods for all to authenticated
  using (
    auth.uid() = user_id
    or public.is_org_manager_of_user(user_id)
    or public.is_app_admin()
  )
  with check (
    auth.uid() = user_id
    or public.is_org_manager_of_user(user_id)
    or public.is_app_admin()
  );

-- admin_set_org_role: use helpers instead of direct membership reads under RLS
create or replace function public.admin_set_org_role(p_org_id uuid, p_user_id uuid, p_role text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_role not in ('owner', 'admin', 'manager', 'member') then
    raise exception 'Invalid org role';
  end if;
  if not public.is_app_admin() and not public.is_org_owner_or_admin(p_org_id) then
    raise exception 'Not authorized';
  end if;
  insert into public.organization_members (org_id, user_id, role)
  values (p_org_id, p_user_id, p_role)
  on conflict (org_id, user_id) do update set role = excluded.role;
  update public.profiles set org_id = p_org_id where id = p_user_id;
end;
$$;
