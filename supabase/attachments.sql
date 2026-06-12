-- Mooncrew: file attachments for tasks and projects

alter table tasks add column if not exists attachments jsonb not null default '[]';
alter table boards add column if not exists attachments jsonb not null default '[]';

insert into storage.buckets (id, name, public)
values ('attachments', 'attachments', true)
on conflict (id) do nothing;

create policy "Authenticated can upload attachments"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'attachments');

create policy "Authenticated can read attachments"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'attachments');

create policy "Authenticated can delete attachments"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'attachments');
