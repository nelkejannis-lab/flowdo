-- Mooncrew: add a structured checklist (todos/Stichpunkte) to brain notes,
-- alongside the existing freeform content text.
alter table brain_pages add column if not exists checklist jsonb not null default '[]'::jsonb;
