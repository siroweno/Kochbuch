insert into public.admin_emails (email)
values ('a.s.schwessinger@gmail.com'), ('steffi.frank@yahoo.de')
on conflict (email) do nothing;

update public.profiles
set role = 'admin', is_active = true, updated_at = now()
where email in ('a.s.schwessinger@gmail.com', 'steffi.frank@yahoo.de');
