# Deployment und Supabase Setup

Diese App ist für GitHub Pages + Supabase gedacht. Kein Next.js, kein SSR, kein Middleware-Setup.

## 1. GitHub Pages

- Standard-Live-URL: `https://siroweno.github.io/Kochbuch/`
- Falls eine Custom Domain genutzt wird, ersetzt diese URL alle Supabase-Redirect-Einstellungen.
- Die Live-Seite muss `index.html` direkt aus dem Repo ausliefern.

## 2. Runtime-Config

- Die produktive Konfiguration läuft über `window.__KOCHBUCH_CONFIG__`.
- In diesem Repo liegt die öffentliche Live-Konfiguration in [runtime-config.js](./runtime-config.js).
- Der Dateiname ist bewusst produktiv und nicht lokal: GitHub Pages lädt diese Datei direkt aus dem Repo.
- Für die Live-Seite müssen folgende Werte gesetzt sein:
  - `backend: 'supabase'`
  - `supabaseUrl`
  - `supabaseAnonKey`
- Der `anon`/`publishable` Key darf öffentlich im Frontend stehen.
- Ein `service_role` Key darf niemals ins Repo oder ins Frontend.

## 3. Supabase Auth

In Supabase müssen diese Werte gepflegt werden:

- `Site URL`: die exakte GitHub-Pages-URL
- `Redirect URLs`: dieselbe URL plus die `index.html`-Variante

Für lokale Tests sind diese Werte im Repo bereits auf `http://127.0.0.1:4173` und `http://localhost:4173` vorbereitet.

## 4. Datenbank und Storage

Führe im Supabase SQL Editor zuerst die Migration aus:

- [supabase/migrations/20260402110000_initial_family_cookbook.sql](./supabase/migrations/20260402110000_initial_family_cookbook.sql)

Danach Seed und Allowlist einspielen:

- [supabase/seed.sql](./supabase/seed.sql)
- Für lokale Demo-Daten nutzt die Supabase-CLI stattdessen automatisch [supabase/seed.dev.sql](./supabase/seed.dev.sql)

Verifiziere anschließend:

- Tabelle `access_allowlist` enthält die aktiven Leser und den Admin.
- Tabelle `profiles` wird durch Login und Trigger gefüllt.
- Bucket `recipe-images` existiert.
- RLS ist auf allen relevanten Tabellen aktiv.

## 5. Allowlist-Betrieb

- `admin` ist das einzige Konto mit Schreibrechten auf Rezepte.
- `reader`-Konten dürfen nur lesen und ihren persönlichen Zustand ändern.
- Neue Personen werden in Supabase über die Allowlist freigeschaltet.
- Wenn jemand keinen Zugriff haben soll, wird der Allowlist-Eintrag deaktiviert oder entfernt.

## 6. Live-Rollout

1. Echte Familien-E-Mails in die Allowlist eintragen.
2. Magic-Link-Login mit einem `admin`-Konto testen.
3. Magic-Link-Login mit einem `reader`-Konto testen.
4. Eine nicht freigeschaltete E-Mail testen.
5. Legacy-Migration mit dem echten Admin prüfen.
6. Erst danach die Live-Seite als produktiv betrachten.

## 7. Manuelle Live-Abnahme

Prüfe auf der GitHub-Pages-URL:

- `admin` kann ein Rezept anlegen, bearbeiten und löschen.
- `reader` sieht die Rezepte und kann Favoriten setzen.
- `reader` kann Wochenplan, Portionswahl und „zuletzt gekocht“ nur für sich selbst ändern.
- Änderungen an zentralen Rezepten sind nach Reload für andere Nutzer sichtbar.
- Bilder lassen sich anzeigen.
- Legacy-Migration funktioniert genau einmal.

## 8. Lokale Entwicklung

- Browser-Test-Modus: `npm test`
- Lokales Browser-Test-Backend: `npm run serve`
- Lokaler Supabase-Stack ist optional und nicht Voraussetzung für Phase 1.

## 9. Release-Check

Vor einem echten Rollout sollte Folgendes grün sein:

- Playwright-Suite komplett grün
- Magic-Link-Login für Admin und Reader
- Unknown-Mail ohne Zugriff
- Live-Storage-Upload geprüft
- Legacy-Migration geprüft
- Mobile-Ansicht kurz gegengeprüft
