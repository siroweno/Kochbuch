begin;

create extension if not exists pgcrypto;

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.normalize_email(value text)
returns text
language sql
immutable
as $$
  select lower(trim(value));
$$;

create or replace function public.empty_week_plan()
returns jsonb
language sql
immutable
as $$
  select '{"Mo":[],"Di":[],"Mi":[],"Do":[],"Fr":[],"Sa":[],"So":[]}'::jsonb;
$$;

create table if not exists public.access_allowlist (
  email text primary key,
  role text not null check (role in ('admin', 'reader')),
  is_active boolean not null default true,
  added_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint access_allowlist_email_lowercase check (email = public.normalize_email(email))
);

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null unique,
  role text not null check (role in ('admin', 'reader')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_email_lowercase check (email = public.normalize_email(email))
);

create table if not exists public.recipes (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  title text not null,
  base_servings integer not null default 2 check (base_servings > 0),
  prep_time integer not null default 0 check (prep_time >= 0),
  cook_time integer not null default 0 check (cook_time >= 0),
  tags text[] not null default '{}'::text[],
  description text not null default '',
  raw_ingredients text not null default '',
  parsed_ingredients jsonb not null default '[]'::jsonb,
  instructions text not null default '',
  plating text not null default '',
  tips text not null default '',
  image_path text,
  external_image_url text,
  created_by uuid references auth.users (id) on delete set null,
  updated_by uuid references auth.users (id) on delete set null
);

create table if not exists public.user_recipe_state (
  user_id uuid not null references auth.users (id) on delete cascade,
  recipe_id uuid not null references public.recipes (id) on delete cascade,
  favorite boolean not null default false,
  last_cooked_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (user_id, recipe_id)
);

create table if not exists public.user_week_plan (
  user_id uuid primary key references auth.users (id) on delete cascade,
  plan jsonb not null default public.empty_week_plan(),
  updated_at timestamptz not null default now()
);

create index if not exists recipes_title_idx on public.recipes using btree (lower(title));
create index if not exists recipes_updated_at_idx on public.recipes (updated_at desc);
create index if not exists user_recipe_state_user_id_idx on public.user_recipe_state (user_id);

drop trigger if exists touch_access_allowlist_updated_at on public.access_allowlist;
create trigger touch_access_allowlist_updated_at
before update on public.access_allowlist
for each row execute function public.touch_updated_at();

drop trigger if exists touch_profiles_updated_at on public.profiles;
create trigger touch_profiles_updated_at
before update on public.profiles
for each row execute function public.touch_updated_at();

drop trigger if exists touch_recipes_updated_at on public.recipes;
create trigger touch_recipes_updated_at
before update on public.recipes
for each row execute function public.touch_updated_at();

drop trigger if exists touch_user_recipe_state_updated_at on public.user_recipe_state;
create trigger touch_user_recipe_state_updated_at
before update on public.user_recipe_state
for each row execute function public.touch_updated_at();

drop trigger if exists touch_user_week_plan_updated_at on public.user_week_plan;
create trigger touch_user_week_plan_updated_at
before update on public.user_week_plan
for each row execute function public.touch_updated_at();

create or replace function public.is_active_member()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.is_active
      and p.role in ('admin', 'reader')
  );
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.is_active
      and p.role = 'admin'
  );
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  synced_role text;
begin
  select role
  into synced_role
  from public.sync_profile_from_allowlist_for(new.id, new.email);

  return new;
end;
$$;

create or replace function public.sync_profile_from_allowlist_for(target_user_id uuid, target_user_email text)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  matched_role text;
  synced_profile public.profiles;
begin
  select a.role
  into matched_role
  from public.access_allowlist a
  where a.is_active
    and a.email = public.normalize_email(coalesce(target_user_email, ''))
  limit 1;

  if matched_role is null then
    delete from public.profiles
    where id = target_user_id;
    return null;
  end if;

  insert into public.profiles (id, email, role, is_active)
  values (target_user_id, public.normalize_email(target_user_email), matched_role, true)
  on conflict (id) do update
    set email = excluded.email,
        role = excluded.role,
        is_active = excluded.is_active,
        updated_at = now();

  select *
  into synced_profile
  from public.profiles
  where id = target_user_id;

  return synced_profile;
end;
$$;

create or replace function public.sync_profile_from_allowlist()
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

  return public.sync_profile_from_allowlist_for(auth_user.id, auth_user.email);
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

grant execute on function public.sync_profile_from_allowlist() to authenticated;

alter table public.access_allowlist enable row level security;
alter table public.profiles enable row level security;
alter table public.recipes enable row level security;
alter table public.user_recipe_state enable row level security;
alter table public.user_week_plan enable row level security;
alter table storage.objects enable row level security;

drop policy if exists "Allow admins to inspect access allowlist" on public.access_allowlist;
create policy "Allow admins to inspect access allowlist"
on public.access_allowlist
for select
using (public.is_admin());

drop policy if exists "Profiles are visible to owners" on public.profiles;
create policy "Profiles are visible to owners"
on public.profiles
for select
using (auth.uid() = id);

drop policy if exists "Admins can inspect profiles" on public.profiles;
create policy "Admins can inspect profiles"
on public.profiles
for select
using (public.is_admin());

drop policy if exists "Admins can read recipes" on public.recipes;
create policy "Admins can read recipes"
on public.recipes
for select
using (public.is_active_member());

drop policy if exists "Admins can insert recipes" on public.recipes;
create policy "Admins can insert recipes"
on public.recipes
for insert
with check (public.is_admin());

drop policy if exists "Admins can update recipes" on public.recipes;
create policy "Admins can update recipes"
on public.recipes
for update
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Admins can delete recipes" on public.recipes;
create policy "Admins can delete recipes"
on public.recipes
for delete
using (public.is_admin());

drop policy if exists "Users can read their own recipe state" on public.user_recipe_state;
create policy "Users can read their own recipe state"
on public.user_recipe_state
for select
using (auth.uid() = user_id);

drop policy if exists "Users can insert their own recipe state" on public.user_recipe_state;
create policy "Users can insert their own recipe state"
on public.user_recipe_state
for insert
with check (auth.uid() = user_id);

drop policy if exists "Users can update their own recipe state" on public.user_recipe_state;
create policy "Users can update their own recipe state"
on public.user_recipe_state
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own recipe state" on public.user_recipe_state;
create policy "Users can delete their own recipe state"
on public.user_recipe_state
for delete
using (auth.uid() = user_id);

drop policy if exists "Users can read their own week plan" on public.user_week_plan;
create policy "Users can read their own week plan"
on public.user_week_plan
for select
using (auth.uid() = user_id);

drop policy if exists "Users can insert their own week plan" on public.user_week_plan;
create policy "Users can insert their own week plan"
on public.user_week_plan
for insert
with check (auth.uid() = user_id);

drop policy if exists "Users can update their own week plan" on public.user_week_plan;
create policy "Users can update their own week plan"
on public.user_week_plan
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own week plan" on public.user_week_plan;
create policy "Users can delete their own week plan"
on public.user_week_plan
for delete
using (auth.uid() = user_id);

insert into storage.buckets (id, name, public)
values ('recipe-images', 'recipe-images', false)
on conflict (id) do update
  set name = excluded.name,
      public = excluded.public;

drop policy if exists "Active members can read recipe images" on storage.objects;
create policy "Active members can read recipe images"
on storage.objects
for select
using (
  bucket_id = 'recipe-images'
  and public.is_active_member()
);

drop policy if exists "Admins can upload recipe images" on storage.objects;
create policy "Admins can upload recipe images"
on storage.objects
for insert
with check (
  bucket_id = 'recipe-images'
  and public.is_admin()
);

drop policy if exists "Admins can update recipe images" on storage.objects;
create policy "Admins can update recipe images"
on storage.objects
for update
using (
  bucket_id = 'recipe-images'
  and public.is_admin()
)
with check (
  bucket_id = 'recipe-images'
  and public.is_admin()
);

drop policy if exists "Admins can delete recipe images" on storage.objects;
create policy "Admins can delete recipe images"
on storage.objects
for delete
using (
  bucket_id = 'recipe-images'
  and public.is_admin()
);

commit;
