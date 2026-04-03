# Deployment und Supabase Setup

Diese App ist für GitHub Pages + Supabase gedacht. Kein Next.js, kein SSR, kein Middleware-Setup.

## 1. GitHub Pages

- Standard-Live-URL: `https://siroweno.github.io/Kochbuch/`
- Falls eine Custom Domain genutzt wird, ersetzt diese URL alle Supabase-Redirect-Einstellungen.
- Die Live-Seite soll das gebaute `dist/`-Artefakt ausliefern.
- GitHub Pages soll über `GitHub Actions` deployen, nicht direkt den Branch-Root ausliefern.
- Der Workflow dafür liegt in [.github/workflows/deploy-pages.yml](./.github/workflows/deploy-pages.yml).

## 2. Runtime-Config

- Die produktive Konfiguration läuft über `window.__KOCHBUCH_CONFIG__`.
- In diesem Repo liegt die öffentliche Live-Konfiguration in [public/runtime-config.js](./public/runtime-config.js).
- Der Dateiname bleibt bewusst produktiv und wird im Build unter derselben URL `runtime-config.js` ausgeliefert.
- Für die Live-Seite müssen folgende Werte gesetzt sein:
  - `backend: 'supabase'`
  - `supabaseUrl`
  - `supabaseAnonKey`
- `allowBrowserTest` bleibt in Live-Builds ungesetzt oder `false`.
- Der `anon`/`publishable` Key darf öffentlich im Frontend stehen.
- Ein `service_role` Key darf niemals ins Repo oder ins Frontend.

## 3. Supabase Auth

In Supabase müssen diese Werte gepflegt werden:

- `Site URL`: die exakte GitHub-Pages-URL
- `Redirect URLs`: dieselbe URL plus die `index.html`-Variante
- `Authentication > Providers > Google`: aktivieren und Google Client ID / Secret setzen

In Google Cloud muss ein Web OAuth Client angelegt werden:

- `Authorized JavaScript origins`: mindestens `https://siroweno.github.io`
- `Authorized redirect URI`: exakt die Supabase-Callback-URL aus dem Google-Provider-Screen des Projekts

Für lokale Tests sind diese Werte im Repo bereits auf `http://127.0.0.1:4173` und `http://localhost:4173` vorbereitet.

## 4. Datenbank und Storage

Führe im Supabase SQL Editor zuerst die Migration aus:

- [supabase/migrations/20260402110000_initial_family_cookbook.sql](./supabase/migrations/20260402110000_initial_family_cookbook.sql)
- [supabase/migrations/20260402235900_google_auth_roles.sql](./supabase/migrations/20260402235900_google_auth_roles.sql)
- [supabase/migrations/20260403003000_admin_email_config.sql](./supabase/migrations/20260403003000_admin_email_config.sql)

Danach Seed einspielen:

- [supabase/seed.sql](./supabase/seed.sql)
- Für lokale Demo-Daten nutzt die Supabase-CLI stattdessen automatisch [supabase/seed.dev.sql](./supabase/seed.dev.sql)

Verifiziere anschließend:

- Tabelle `profiles` wird durch Login und Trigger gefüllt.
- Deine Admin-Adresse steht in `public.admin_emails`.
- E-Mails aus `public.admin_emails` werden als `admin` geführt.
- Andere erfolgreiche Google-Logins werden als `reader` geführt.
- Bucket `recipe-images` existiert.
- RLS ist auf allen relevanten Tabellen aktiv.

## 5. Rollenbetrieb

- `admin` ist das einzige Konto mit Schreibrechten auf Rezepte.
- `reader`-Konten dürfen nur lesen und ihren persönlichen Zustand ändern.
- Admin-Rechte kommen aus der Tabelle `public.admin_emails`.
- Jeder andere erfolgreiche Google-Login wird automatisch als `reader` synchronisiert.
- `access_allowlist` bleibt im Schema erhalten, wird für den normalen Login aber nicht mehr genutzt.

## 6. Live-Rollout

1. Google Provider in Supabase konfigurieren.
2. Google OAuth Client in Google Cloud konfigurieren.
3. Deine Admin-Adresse in `public.admin_emails` eintragen.
4. Login mit einem beliebigen zweiten Google-Konto testen.
5. Legacy-Migration mit dem echten Admin prüfen.
6. Erst danach die Live-Seite als produktiv betrachten.

## 7. Manuelle Live-Abnahme

Prüfe auf der GitHub-Pages-URL:

- `admin` kann ein Rezept anlegen, bearbeiten und löschen.
- `reader` sieht die Rezepte und kann Favoriten setzen.
- `reader` kann Wochenplan, Portionswahl und „zuletzt gekocht“ nur für sich selbst ändern.
- Google-Login funktioniert auf Desktop sowie iPhone/iPad.
- Abmelden auf Gerät A meldet Gerät B nicht mit ab.
- Änderungen an zentralen Rezepten sind nach Reload für andere Nutzer sichtbar.
- Bilder lassen sich anzeigen.
- Legacy-Migration funktioniert genau einmal.

## 8. Lokale Entwicklung

- UI-Entwicklung: `npm run dev`
- Produktionsbuild: `npm run build`
- Build lokal prüfen: `npm run preview`
- Browser-Test-Modus gegen das gebaute Artefakt: `npm test`
- Lokales Browser-Test-Backend direkt: `npm run serve`
- Lokaler Supabase-Stack ist optional und nicht Voraussetzung für Phase 1.

## 9. Release-Check

Vor einem echten Rollout sollte Folgendes grün sein:

- Playwright-Suite komplett grün
- Google-Login für Admin
- Google-Login für einen beliebigen Reader
- Live-Storage-Upload geprüft
- Legacy-Migration geprüft
- Mobile-Ansicht kurz gegengeprüft
