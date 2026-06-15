-- Allows a logged-in user to permanently delete their own account and all
-- associated data (DSGVO Art. 17 "Recht auf Loeschung"). Deleting the row in
-- auth.users cascades to profiles and from there to tasks, boards, comments,
-- work_time_entries, calendar_entries, etc. via "on delete cascade" foreign keys.
create or replace function delete_my_account()
returns void as $$
begin
  delete from auth.users where id = auth.uid();
end;
$$ language plpgsql security definer;

revoke all on function delete_my_account() from public;
grant execute on function delete_my_account() to authenticated;
