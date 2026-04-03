# Kochbuch

Statische Kochbuch-App mit Vite-Build, GitHub Pages und Supabase.

## Was drin ist

- `index.html` ist die App-Shell.
- `dist/` ist das gebaute Artefakt für statisches Hosting.
- `src/` enthält Auth, Repository, Datenmodell und Rendering-Logik.
- `server.js` dient als lokaler Build-Host plus Browser-Test-Backend.
- `supabase/` enthält Migration, Policies, Seed und lokale Supabase-Config.
- `tests/kochbuch.smoke.spec.js` deckt Login, Rechte, Migration und Export/Import ab.
- `public/runtime-config.js` ist die öffentliche Laufzeitkonfiguration für GitHub Pages.

## Schnellstart

1. Dependencies installieren:

```bash
npm install
```

2. Lokale Entwicklung starten:

```bash
npm run dev
```

3. Produktionsartefakt bauen:

```bash
npm run build
```

4. Build lokal prüfen:

```bash
npm run preview
```

5. Browser-Smokes starten:

```bash
npm test
```

6. Supabase-Contract-Tests starten:

```bash
npm run test:supabase:contracts
```

7. Lokale Supabase-Integration vollständig gegen den Local-Stack prüfen:

```bash
npm run test:supabase:local:managed
```

8. Lokalen Build-Host mit Browser-Test-API direkt starten:

```bash
npm run serve
```

## Produktionsprinzip

- Die Live-App bleibt statisch und läuft über GitHub Pages.
- GitHub Pages oder anderes statisches Hosting liefert das gebaute `dist/`-Artefakt aus.
- Supabase liefert Auth, gemeinsame Rezeptdaten, persönliche Nutzerdaten und Storage.
- Google OAuth ist der einzige sichtbare Login-Weg.
- E-Mails aus `public.admin_emails` werden als `admin` synchronisiert, alle anderen erfolgreichen Logins als `reader`.
- `admin` darf Rezepte und Migrationen verwalten, `reader` darf lesen und persönlich planen.
- `browser-test` bleibt ein lokaler/CI-Testmodus und wird nur über `allowBrowserTest` in `runtime-config.js` aktiviert.

## Wichtige Dateien

- [DEPLOYMENT.md](./DEPLOYMENT.md)
- [public/runtime-config.js](./public/runtime-config.js)
- [.github/workflows/deploy-pages.yml](./.github/workflows/deploy-pages.yml)
- [supabase/migrations/20260402110000_initial_family_cookbook.sql](./supabase/migrations/20260402110000_initial_family_cookbook.sql)
- [supabase/migrations/20260402235900_google_auth_roles.sql](./supabase/migrations/20260402235900_google_auth_roles.sql)
- [supabase/migrations/20260403003000_admin_email_config.sql](./supabase/migrations/20260403003000_admin_email_config.sql)
- [supabase/seed.sql](./supabase/seed.sql)
- [supabase/seed.dev.sql](./supabase/seed.dev.sql)
