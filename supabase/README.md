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

These addresses are local demo identities for testing. They are not meant for production.

## Managed local integration test

If Docker and the Supabase CLI are available, you can run the full local integration flow in one step:

```bash
npm run test:supabase:local:managed
```

That command will:

- start the local Supabase stack
- run `supabase db reset --yes`
- read `API_URL`, `ANON_KEY` and `SERVICE_ROLE_KEY` from `supabase status -o env`
- execute `tests/supabase/kochbuch.local.spec.js` with the required environment variables

If you prefer to run the suite manually, export the local values from `supabase status -o env` first and then run:

```bash
npm run test:supabase:local
```

## Production bootstrap

Recommended approach:

1. Apply migrations only.
2. Do not run `seed.dev.sql`.
3. Add the real admin email to `public.admin_emails`.
4. Let that admin sign in once via Google so `sync_profile_for_current_user()` can create or refresh `public.profiles`.
5. Import or migrate the real cookbook data through the app.

Minimal production SQL example:

```sql
insert into public.admin_emails (email)
values ('you@example.com')
on conflict (email) do update
  set updated_at = now();
```

If you still keep `access_allowlist` for legacy reasons, it is no longer required for the normal Google login flow.

## Notes on profile sync

- New `auth.users` rows are handled by the trigger in the migration.
- Existing users are covered by `sync_profile_for_current_user()`.
- Users listed in `public.admin_emails` become `admin`.
- All other successful Google logins become `reader`.
