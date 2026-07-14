-- v1.6.0: Organizations, roles, absence approvals

create table if not exists organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_id uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists organization_members (
  org_id uuid not null references organizations(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'admin', 'manager', 'member')),
  joined_at timestamptz not null default now(),
  primary key (org_id, user_id)
);

alter table profiles add column if not exists org_id uuid references organizations(id) on delete set null;
alter table teams add column if not exists org_id uuid references organizations(id) on delete set null;

alter table absence_periods add column if not exists status text not null default 'approved'
  check (status in ('pending', 'approved', 'rejected'));
alter table absence_periods add column if not exists reviewed_by uuid references profiles(id);
alter table absence_periods add column if not exists reviewed_at timestamptz;

alter table organizations enable row level security;
alter table organization_members enable row level security;

create policy "Org members can view their org"
  on organizations for select to authenticated
  using (exists (
    select 1 from organization_members om
    where om.org_id = organizations.id and om.user_id = auth.uid()
  ));

create policy "Authenticated users can create orgs"
  on organizations for insert to authenticated
  with check (auth.uid() = owner_id);

create policy "Org owners and admins can update org"
  on organizations for update to authenticated
  using (exists (
    select 1 from organization_members om
    where om.org_id = organizations.id and om.user_id = auth.uid()
      and om.role in ('owner', 'admin')
  ));

create policy "Org members can view membership"
  on organization_members for select to authenticated
  using (exists (
    select 1 from organization_members om
    where om.org_id = organization_members.org_id and om.user_id = auth.uid()
  ));

create policy "Org owners and admins manage members"
  on organization_members for all to authenticated
  using (exists (
    select 1 from organization_members om
    where om.org_id = organization_members.org_id and om.user_id = auth.uid()
      and om.role in ('owner', 'admin')
  ))
  with check (exists (
    select 1 from organization_members om
    where om.org_id = organization_members.org_id and om.user_id = auth.uid()
      and om.role in ('owner', 'admin')
  ));

create policy "Users can join org when invited via insert self"
  on organization_members for insert to authenticated
  with check (auth.uid() = user_id);

-- Managers/admins can view org member absences
drop policy if exists "Users manage own absence_periods" on absence_periods;

create policy "Users manage own absence_periods"
  on absence_periods for all to authenticated
  using (
    auth.uid() = user_id
    or exists (
      select 1 from organization_members om1
      join organization_members om2 on om1.org_id = om2.org_id
      where om1.user_id = auth.uid() and om1.role in ('owner', 'admin', 'manager')
        and om2.user_id = absence_periods.user_id
    )
    or exists (select 1 from profiles p where p.id = auth.uid() and p.is_admin = true)
  )
  with check (
    auth.uid() = user_id
    or exists (
      select 1 from organization_members om1
      join organization_members om2 on om1.org_id = om2.org_id
      where om1.user_id = auth.uid() and om1.role in ('owner', 'admin', 'manager')
        and om2.user_id = absence_periods.user_id
    )
    or exists (select 1 from profiles p where p.id = auth.uid() and p.is_admin = true)
  );
