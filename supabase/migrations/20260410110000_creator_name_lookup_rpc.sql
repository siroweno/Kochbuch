create or replace function public.get_creator_names()
returns table(user_id uuid, display_name text)
language sql
stable
security definer
set search_path = public
as $$
  select p.id as user_id, a.display_name
  from public.profiles p
  inner join public.admin_emails a on a.email = p.email
  where a.display_name is not null;
$$;

-- Allow authenticated users to call this function
grant execute on function public.get_creator_names() to authenticated;
