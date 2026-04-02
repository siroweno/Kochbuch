# Kochbuch

Private Familien-Kochbuch-App als statische GitHub-Pages-Seite mit Supabase als Backend.

## Was drin ist

- `index.html` ist die App-Shell.
- `src/` enthält Auth, Repository, Datenmodell und Rendering-Logik.
- `server.js` dient dem lokalen Browser-Test-Backend.
- `supabase/` enthält Migration, Policies, Seed und lokale Supabase-Config.
- `tests/kochbuch.smoke.spec.js` deckt Login, Rechte, Migration und Export/Import ab.

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
- Magic Links sind der einzige Login-Weg.
- `admin` darf Rezepte und Migrationen verwalten, `reader` darf lesen und persönlich planen.

## Wichtige Dateien

- [DEPLOYMENT.md](./DEPLOYMENT.md)
- [app-config.local.js](./app-config.local.js)
- [supabase/migrations/20260402110000_initial_family_cookbook.sql](./supabase/migrations/20260402110000_initial_family_cookbook.sql)
- [supabase/seed.sql](./supabase/seed.sql)
