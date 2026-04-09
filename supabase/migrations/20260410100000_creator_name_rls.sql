-- Allow all active members to read profiles (needed for creator name lookup)
drop policy if exists "Users can read own profile or admins can read all" on public.profiles;
create policy "Active members can read all profiles"
on public.profiles
for select
using (public.is_active_member());

-- Allow all active members to read admin_emails (needed for display_name lookup)
drop policy if exists "Allow admins to inspect admin emails" on public.admin_emails;
create policy "Active members can read admin emails"
on public.admin_emails
for select
using (public.is_active_member());
