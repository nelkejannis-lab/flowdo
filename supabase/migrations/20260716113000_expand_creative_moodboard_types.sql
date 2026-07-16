alter table creative_moodboard_items
  add column if not exists metadata_title text,
  add column if not exists metadata_thumbnail text,
  add column if not exists metadata_host text;

alter table creative_moodboard_items
  drop constraint if exists creative_moodboard_items_type_check;

alter table creative_moodboard_items
  add constraint creative_moodboard_items_type_check
  check (type in ('note', 'image', 'link', 'video', 'social', 'website'));
