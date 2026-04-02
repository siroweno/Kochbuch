# Supabase Bootstrapping

## Split between local demo data and production bootstrap

- `seed.dev.sql` is for local development and demos only.
- `seed.sql` is production-safe by default and intentionally does not create `.local` users or example recipes.
- `config.toml` points local CLI seeding to `seed.dev.sql`, so `supabase db reset` keeps the convenient demo setup without polluting production bootstrap files.

## Local workflow

Run a local reset as usual:

```bash
supabase db reset
```

That will:

- apply `supabase/migrations/*`
- run `supabase/seed.dev.sql`

Local demo access after reset:

- `admin@kochbuch.local`
- `reader@kochbuch.local`

These addresses are only allowlisted seed entries for local testing. They are not meant for production.

## Production bootstrap

Recommended approach:

1. Apply migrations only.
2. Do not run `seed.dev.sql`.
3. Add the real admin email to `public.access_allowlist`.
4. Let that admin sign in once via Magic Link so `sync_profile_from_allowlist()` can create or refresh `public.profiles`.
5. Import or migrate the real cookbook data through the app.

Minimal production SQL example:

```sql
insert into public.access_allowlist (email, role, is_active)
values ('you@example.com', 'admin', true)
on conflict (email) do update
  set role = excluded.role,
      is_active = excluded.is_active,
      updated_at = now();
```

## Notes on profile sync

- New `auth.users` rows are handled by the trigger in the migration.
- Existing users that get allowlisted later are covered by `sync_profile_from_allowlist()`.
- The client should call that RPC during login/init and fall back gracefully if the profile is still missing.
