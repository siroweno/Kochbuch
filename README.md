# Kochbuch

Statische Kochbuch-App mit GitHub Pages und Supabase.

## Was drin ist

- `index.html` ist die App-Shell.
- `src/` enthält Auth, Repository, Datenmodell und Rendering-Logik.
- `server.js` dient dem lokalen Browser-Test-Backend.
- `supabase/` enthält Migration, Policies, Seed und lokale Supabase-Config.
- `tests/kochbuch.smoke.spec.js` deckt Login, Rechte, Migration und Export/Import ab.
- `runtime-config.js` ist die öffentliche Laufzeitkonfiguration für GitHub Pages.

## Schnellstart

1. Dependencies installieren:

```bash
npm install
```

2. Browser-Tests starten:

```bash
npm test
```

3. Lokales Test-Backend starten:

```bash
npm run serve
```

## Produktionsprinzip

- Die Live-App bleibt statisch und läuft über GitHub Pages.
- Supabase liefert Auth, gemeinsame Rezeptdaten, persönliche Nutzerdaten und Storage.
- Google OAuth ist der einzige sichtbare Login-Weg.
- E-Mails aus `public.admin_emails` werden als `admin` synchronisiert, alle anderen erfolgreichen Logins als `reader`.
- `admin` darf Rezepte und Migrationen verwalten, `reader` darf lesen und persönlich planen.
- `browser-test` bleibt ein lokaler/CI-Testmodus und ist kein Live-Backend.

## Wichtige Dateien

- [DEPLOYMENT.md](./DEPLOYMENT.md)
- [runtime-config.js](./runtime-config.js)
- [supabase/migrations/20260402110000_initial_family_cookbook.sql](./supabase/migrations/20260402110000_initial_family_cookbook.sql)
- [supabase/migrations/20260402235900_google_auth_roles.sql](./supabase/migrations/20260402235900_google_auth_roles.sql)
- [supabase/migrations/20260403003000_admin_email_config.sql](./supabase/migrations/20260403003000_admin_email_config.sql)
- [supabase/seed.sql](./supabase/seed.sql)
- [supabase/seed.dev.sql](./supabase/seed.dev.sql)
