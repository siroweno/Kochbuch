insert into public.admin_emails (email)
values ('osiewaczamrei@gmail.com')
on conflict (email) do nothing;

-- If she already has a profile, upgrade it to admin
update public.profiles
set role = 'admin',
    is_active = true,
    updated_at = now()
where email = 'osiewaczamrei@gmail.com';
