insert into public.admin_emails (email, display_name)
values ('michael.schwessinger@gmail.com', 'Micha')
on conflict (email) do update set display_name = 'Micha', updated_at = now();

update public.profiles
set role = 'admin', is_active = true, updated_at = now()
where email = 'michael.schwessinger@gmail.com';
