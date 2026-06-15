-- Adds support for "Heute Abend", "Irgendwann" and wiederkehrende Aufgaben
alter table tasks add column if not exists evening boolean not null default false;
alter table tasks add column if not exists someday boolean not null default false;
alter table tasks add column if not exists recurrence text check (recurrence in ('daily', 'weekly', 'monthly'));
