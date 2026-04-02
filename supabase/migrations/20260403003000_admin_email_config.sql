begin;

create table if not exists public.admin_emails (
  email text primary key,
  added_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint admin_emails_email_lowercase check (email = public.normalize_email(email))
);

drop trigger if exists touch_admin_emails_updated_at on public.admin_emails;
create trigger touch_admin_emails_updated_at
before update on public.admin_emails
for each row execute function public.touch_updated_at();

alter table public.admin_emails enable row level security;

drop policy if exists "Allow admins to inspect admin emails" on public.admin_emails;
create policy "Allow admins to inspect admin emails"
on public.admin_emails
for select
using (public.is_admin());

insert into public.admin_emails (email)
select distinct public.normalize_email(email)
from public.profiles
where role = 'admin'
  and is_active
  and email is not null
on conflict (email) do update
  set updated_at = now();

insert into public.admin_emails (email)
select distinct public.normalize_email(email)
from public.access_allowlist
where role = 'admin'
  and is_active
  and email is not null
on conflict (email) do update
  set updated_at = now();

create or replace function public.resolve_profile_role(target_user_email text)
returns text
language sql
stable
as $$
  select case
    when public.normalize_email(coalesce(target_user_email, '')) = '' then null
    when exists (
      select 1
      from public.admin_emails a
      where a.email = public.normalize_email(coalesce(target_user_email, ''))
    ) then 'admin'
    else 'reader'
  end;
$$;

update public.profiles
set role = public.resolve_profile_role(email),
    is_active = true,
    updated_at = now()
where email is not null;

commit;
