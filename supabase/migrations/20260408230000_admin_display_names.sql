alter table public.admin_emails add column if not exists display_name text;

update public.admin_emails set display_name = 'Silvan' where email = 'silvan.schwessinger@gmail.com';
update public.admin_emails set display_name = 'Amrei' where email = 'osiewaczamrei@gmail.com';
update public.admin_emails set display_name = 'Anne-Sophie' where email = 'a.s.schwessinger@gmail.com';
update public.admin_emails set display_name = 'Steffi' where email = 'steffi.frank@yahoo.de';
