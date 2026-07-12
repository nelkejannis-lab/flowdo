-- Mooncrew: file attachments for tasks and projects (user-scoped storage paths)

alter table tasks add column if not exists attachments jsonb not null default '[]';
alter table boards add column if not exists attachments jsonb not null default '[]';

insert into storage.buckets (id, name, public)
values ('attachments', 'attachments', true)
on conflict (id) do nothing;

drop policy if exists "Authenticated can upload attachments" on storage.objects;
drop policy if exists "Authenticated can read attachments" on storage.objects;
drop policy if exists "Authenticated can delete attachments" on storage.objects;

create policy "Users upload own attachments"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'attachments' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Users read own attachments"
  on storage.objects for select to authenticated
  using (bucket_id = 'attachments' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Users delete own attachments"
  on storage.objects for delete to authenticated
  using (bucket_id = 'attachments' and (storage.foldername(name))[1] = auth.uid()::text);
