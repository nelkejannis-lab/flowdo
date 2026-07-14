-- Grant App-Admin to primary owner account (highest global role)
update profiles
set app_role = 'admin', is_admin = true
where id = '6e6370e8-4dfc-4226-b5d5-8bcb6b9273f1';
