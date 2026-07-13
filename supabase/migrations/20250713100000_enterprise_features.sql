-- v1.4.0 enterprise features: absences, multi-assignee, task time, templates, brain metadata

-- Absence periods (vacation, sick, overtime compensation)
create table if not exists absence_periods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  type text not null check (type in ('vacation', 'sick', 'overtime')),
  start_date date not null,
  end_date date not null,
  note text,
  created_at timestamptz not null default now(),
  check (end_date >= start_date)
);
alter table absence_periods enable row level security;
create policy "Users manage own absence_periods"
  on absence_periods for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Multi-assignee support
create table if not exists task_assignees (
  task_id uuid not null references tasks(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  primary key (task_id, user_id)
);
alter table task_assignees enable row level security;
create policy "Board members can view task assignees"
  on task_assignees for select to authenticated
  using (exists (
    select 1 from tasks t
    join board_members bm on bm.board_id = t.board_id
    where t.id = task_assignees.task_id and bm.user_id = auth.uid()
  ) or exists (
    select 1 from tasks t where t.id = task_assignees.task_id and t.owner_id = auth.uid()
  ));
create policy "Board members can manage task assignees"
  on task_assignees for all to authenticated
  using (exists (
    select 1 from tasks t
    join board_members bm on bm.board_id = t.board_id
    where t.id = task_assignees.task_id and bm.user_id = auth.uid()
  ) or exists (
    select 1 from tasks t where t.id = task_assignees.task_id and t.owner_id = auth.uid()
  ))
  with check (exists (
    select 1 from tasks t
    join board_members bm on bm.board_id = t.board_id
    where t.id = task_assignees.task_id and bm.user_id = auth.uid()
  ) or exists (
    select 1 from tasks t where t.id = task_assignees.task_id and t.owner_id = auth.uid()
  ));

-- Task time entries per project
create table if not exists task_time_entries (
  id uuid primary key default gen_random_uuid(),
  task_id uuid references tasks(id) on delete set null,
  board_id uuid not null references boards(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  minutes int not null check (minutes > 0),
  date date not null,
  note text,
  created_at timestamptz not null default now()
);
alter table task_time_entries enable row level security;
create policy "Board members manage task time"
  on task_time_entries for all to authenticated
  using (exists (
    select 1 from board_members bm
    where bm.board_id = task_time_entries.board_id and bm.user_id = auth.uid()
  ) or exists (
    select 1 from boards b where b.id = task_time_entries.board_id and b.owner_id = auth.uid()
  ))
  with check (exists (
    select 1 from board_members bm
    where bm.board_id = task_time_entries.board_id and bm.user_id = auth.uid()
  ) or exists (
    select 1 from boards b where b.id = task_time_entries.board_id and b.owner_id = auth.uid()
  ));

-- Board templates
create table if not exists board_templates (
  id text primary key,
  title text not null,
  description text,
  color text not null default '#6366f1',
  is_public boolean not null default true,
  owner_id uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create table if not exists board_template_tasks (
  id uuid primary key default gen_random_uuid(),
  template_id text not null references board_templates(id) on delete cascade,
  title text not null,
  column_index int not null default 0,
  position int not null default 0
);
alter table board_templates enable row level security;
alter table board_template_tasks enable row level security;
create policy "Anyone can read public templates"
  on board_templates for select to authenticated
  using (is_public = true or owner_id = auth.uid());
create policy "Owners manage templates"
  on board_templates for all to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "Read template tasks"
  on board_template_tasks for select to authenticated
  using (exists (select 1 from board_templates bt where bt.id = template_id and (bt.is_public or bt.owner_id = auth.uid())));
create policy "Owners manage template tasks"
  on board_template_tasks for all to authenticated
  using (exists (select 1 from board_templates bt where bt.id = template_id and bt.owner_id = auth.uid()))
  with check (exists (select 1 from board_templates bt where bt.id = template_id and bt.owner_id = auth.uid()));

-- Seed default templates
insert into board_templates (id, title, description, color, is_public) values
  ('marketing-campaign', 'Marketing-Kampagne', 'Launch-Checkliste für Kampagnen', '#8B5CF6', true),
  ('product-launch', 'Produkt-Launch', 'Go-to-Market Vorlage', '#10B981', true)
on conflict (id) do nothing;
insert into board_template_tasks (template_id, title, column_index, position) values
  ('marketing-campaign', 'Briefing erstellen', 0, 0),
  ('marketing-campaign', 'Zielgruppe definieren', 0, 1),
  ('marketing-campaign', 'Content planen', 1, 0),
  ('marketing-campaign', 'Assets produzieren', 1, 1),
  ('marketing-campaign', 'Kampagne live schalten', 2, 0),
  ('product-launch', 'Feature-Liste finalisieren', 0, 0),
  ('product-launch', 'QA & Testing', 1, 0),
  ('product-launch', 'Launch-Kommunikation', 1, 1),
  ('product-launch', 'Go-Live', 2, 0)
on conflict do nothing;

-- Second Brain metadata
alter table brain_pages add column if not exists tags text[] not null default '{}';
alter table brain_pages add column if not exists people jsonb not null default '[]';
alter table brain_pages add column if not exists linked_board_id uuid references boards(id) on delete set null;
