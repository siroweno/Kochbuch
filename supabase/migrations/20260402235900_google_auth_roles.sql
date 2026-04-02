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

create or replace function public.sync_profile_for_user(target_user_id uuid, target_user_email text)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_email text := public.normalize_email(coalesce(target_user_email, ''));
  next_role text;
  synced_profile public.profiles;
begin
  if target_user_id is null or normalized_email = '' then
    return null;
  end if;

  next_role := public.resolve_profile_role(normalized_email);

  delete from public.profiles
  where email = normalized_email
    and id <> target_user_id;

  insert into public.profiles (id, email, role, is_active)
  values (target_user_id, normalized_email, next_role, true)
  on conflict (id) do update
    set email = excluded.email,
        role = excluded.role,
        is_active = true,
        updated_at = now();

  select *
  into synced_profile
  from public.profiles
  where id = target_user_id;

  return synced_profile;
end;
$$;

create or replace function public.sync_profile_for_current_user()
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  auth_user auth.users;
begin
  if auth.uid() is null then
    return null;
  end if;

  select *
  into auth_user
  from auth.users
  where id = auth.uid();

  if auth_user.id is null then
    return null;
  end if;

  return public.sync_profile_for_user(auth_user.id, auth_user.email);
end;
$$;

create or replace function public.sync_profile_from_allowlist_for(target_user_id uuid, target_user_email text)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
begin
  return public.sync_profile_for_user(target_user_id, target_user_email);
end;
$$;

create or replace function public.sync_profile_from_allowlist()
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
begin
  return public.sync_profile_for_current_user();
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.sync_profile_for_user(new.id, new.email);
  return new;
end;
$$;

update public.profiles
set role = public.resolve_profile_role(email),
    is_active = true,
    updated_at = now()
where email is not null;

grant execute on function public.sync_profile_for_current_user() to authenticated;
grant execute on function public.sync_profile_for_user(uuid, text) to authenticated;
grant execute on function public.sync_profile_from_allowlist() to authenticated;

commit;
