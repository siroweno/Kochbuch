# Kitab / Kochbuch — Vollstaendiges Projekt-Audit (Rev. 2)

**Datum:** 2026-04-11
**Auditor:** Claude Opus 4.6 (automatisiert, jede Datei gelesen — zwei Durchgaenge)
**Scope:** Alle Source-Dateien, Migrations, Tests, Styles, Configs, Edge Functions

---

## Inhaltsverzeichnis

1. [Architektur-Review](#teil-1-architektur-review)
2. [Security Deep-Dive](#teil-2-security-deep-dive)
3. [Performance-Analyse](#teil-3-performance-analyse)
4. [Code-Qualitaet](#teil-4-code-qualitaet)
5. [Datenbank & Schema](#teil-5-datenbank--schema)
6. [UX & Accessibility](#teil-6-ux--accessibility)
7. [Testing & CI/CD](#teil-7-testing--cicd)
8. [Priorisierter Massnahmenkatalog](#teil-8-priorisierter-massnahmenkatalog)
9. [Strategische Empfehlungen](#teil-9-strategische-empfehlungen)

---

## TEIL 1: Architektur-Review

### 1.1 Projektueberblick

Kitab ist eine Familien-Kochbuch-App als statische Single-Page-Application (SPA) mit:

- **Frontend:** Vanilla JS (ES Modules), Vite als Bundler, kein Framework
- **Backend:** Supabase (PostgreSQL, Auth, Storage, Edge Functions)
- **Hosting:** GitHub Pages (statisch) + Supabase-Cloud-Dienste
- **Test-Modus:** Eigener Node.js-Server (`server.js`) mit In-Memory-Backend fuer Playwright-Tests

### 1.2 Modul-Uebersicht

```
src/
  main.js                     <- Zentraler Einstiegspunkt, orchestriert alles (890 Zeilen)
  app-config.js               <- Liest Runtime-Config, baut Backend-Auswahl
  auth.js                     <- Auth-Service (Mediator-Pattern)
  repository.js               <- Daten-Repository (CRUD, Import/Export)
  cookbook-schema.js           <- Re-Export aus schema/

  bootstrap/
    app.js                    <- Factory: Config + Auth + Repository zusammenbauen
    runtime-config.js         <- Dynamisches Script-Loading fuer Supabase-Config

  auth-backends/
    browser-test-auth-backend.js   <- Test-Backend (In-Memory Sessions)
    supabase-auth-backend.js       <- Produktions-Backend (Supabase Auth)

  repository-drivers/
    browser-test-driver.js    <- Test-Driver (HTTP gegen server.js)
    supabase-driver.js        <- Produktions-Driver (Supabase Client SDK)

  schema/                     <- Pure Functions: Validierung, Normalisierung, ID-Generierung
    constants.js, date-utils.js, id-generation.js, import-export.js,
    ingredient-categories.js, ingredients.js, meal-slots.js,
    normalize.js, recipe.js, week-plan.js

  ui/                         <- UI-Controller und Views (30+ Dateien)
    state-controller.js       <- Zentrales State-Objekt (mutierbar)
    data-controller.js        <- Lade-Logik, Cache, Refresh
    auth-shell.js             <- Login/Logout-UI, Mirage-Overlay
    recipes-controller.js     <- Rezept-Grid Rendering-Steuerung
    recipes-view.js           <- HTML-Rendering fuer Rezeptkarten + Modal
    planner-controller.js     <- Wochenplaner Rendering
    planner-view.js           <- HTML-Rendering fuer Planer
    planner-actions.js        <- Planer-Business-Logik
    plan-operations.js        <- Pure Planer-Operationen
    modal-recipe-controller.js<- Rezept-Modal Rendering
    recipe-modal-actions.js   <- Modal Business-Logik
    recipe-form.js            <- Rezept-Formular Controller
    drag-drop-controller.js   <- Drag & Drop fuer Planer
    shopping-list.js          <- Einkaufsliste Controller
    tag-bar-controller.js     <- Tag-Filter-Leiste
    favorite-controller.js    <- Favoriten-Toggle mit Effekten
    focus-manager.js          <- Focus-Wiederherstellung
    effects-layer.js          <- Visuelle Effekte (Herzen, Wort-Burst)
    bg-particles.js           <- Canvas-Hintergrundpartikel
    cursor-effects.js         <- Cursor-Effekte (Klick-Partikel, Glow)
    notifications.js, modals.js, import-export.js, user-menu.js,
    header-scroll.js, view-helpers.js, app-dom.js, events.js,
    serving-options.js, loading-controller.js
    handlers/                 <- Event-Handler Module (11 Dateien)
```

### 1.3 Datenfluss

```
Login -> auth-shell.js zeigt Login-Panel
  |
Google OAuth / Browser-Test -> auth-backends/*.js
  |
auth.js setzt Snapshot -> auth-shell.js blendet App-Shell ein
  |
data-controller.js -> repository.js -> repository-drivers/*.js -> Supabase/Test-API
  |
recipes, weekPlan, personalState -> state-controller.js (mutables Objekt)
  |
recipes-controller.js -> recipes-view.js -> recipeGrid.innerHTML
planner-controller.js -> planner-view.js -> daysGrid.innerHTML
tag-bar-controller.js -> tagBarList.innerHTML
  |
User-Interaktion -> handlers/*.js -> Controller -> Repository -> Reload
```

### 1.4 Architektur-Bewertung

| Aspekt | Bewertung | Kommentar |
|--------|-----------|-----------|
| Modularitaet | **Gut** | Klare Trennung: Schema (pure), UI (DOM), Backend (Drivers), Bootstrap |
| Kopplung | **Akzeptabel** | `main.js` ist ein massiver Orchestrator (890 Zeilen), aber Controller selbst sind entkoppelt. `lazy`-Pattern fuer zirkulaere Deps ist clever |
| Gott-Objekte | **state-controller.js** | Das `state`-Objekt ist ein mutables Bag of Properties ohne Validierung |
| Backend-Abstraktion | **Sehr gut** | Driver-Pattern macht Test/Prod komplett austauschbar |
| Schema-Layer | **Sehr gut** | Pure Functions, keine Seiteneffekte |

### 1.5 Technische Schulden

| Schuld | Schweregrad | Beschreibung |
|--------|-------------|--------------|
| `main.js` Gott-Datei | MITTEL | 890 Zeilen die alles zusammenstecken inkl. Shopping-Logik (Z. 700-830) |
| Mutables State-Objekt | MITTEL | Kein Proxy, keine Validierung, keine Change-Events |
| Monkey-Patch `plannerController.updateShoppingList` | MITTEL | `main.js:824-828`: originale Methode wird zur Laufzeit ueberschrieben |
| Duplikation `runtime-config.js` | NIEDRIG | Existiert sowohl in `/` als auch `/public/` mit identischem Inhalt |

---

## TEIL 2: Security Deep-Dive

### 2.1 XSS-Analyse — Jeder innerHTML-Aufruf

18 `innerHTML`-Zuweisungen im gesamten Projekt gefunden. Jede einzeln geprueft:

| # | Datei:Zeile | Inhalt | Escaped? | Risiko |
|---|-------------|--------|----------|--------|
| 1 | `recipes-controller.js:20` | Favorites-Icon (`&#9829;`/`&#9825;`) | Statisch | Sicher |
| 2 | `recipes-view.js:123` | Empty-State-Meldung | Statisch | Sicher |
| 3 | `recipes-view.js:158` | Rezeptkarten-Grid | `escapeHtml()` + `escapeAttribute()` | Sicher |
| 4 | `recipes-view.js:252` | Modal Header Meta (Tags, Zeit) | `escapeHtml()` | Sicher |
| 5 | `recipes-view.js:260` | Modal Servings Select | Numerische Werte | Sicher |
| 6 | `recipes-view.js:278` | Modal Ingredients | `escapeHtml()` | Sicher |
| 7 | `recipes-view.js:290` | Modal Instructions | `escapeHtml()` | Sicher |
| 8 | `recipes-view.js:328` | Skeleton Cards | Statisch | Sicher |
| 9 | `tag-bar-controller.js:21` | Tag-Bar | `escapeHtml()` + `encodeURIComponent()` | Sicher |
| 10 | `planner-view.js:220` | Wochenplaner | `escapeHtml()` + `escapeAttribute()` | Sicher |
| 11 | `planner-view.js:55` | Day-Picker Items | `escapeHtml()` + `escapeAttribute()` | Sicher |
| 12 | `planner-view.js:106` | Slot Rows | `escapeHtml()` + `escapeAttribute()` | Sicher |
| 13 | `planner-actions.js:103` | Day-Picker Filter | via `renderDayPickerItems()` | Sicher |
| 14 | `shopping-list.js:136` | Leere Shopping-Liste | Statisch | Sicher |
| 15 | `shopping-list.js:140` | Shopping-Items (Text) | `escapeHtml()` | Sicher |
| **16** | **`shopping-list.js:146`** | **Shopping-Items (data-Attribut)** | **`escapeHtml()` statt `escapeAttribute()`** | **XSS-Risiko** |
| 17 | `effects-layer.js:53` | CSS via `textContent` | N/A | Sicher |
| 18 | Diverse `textContent`-Zuweisungen | N/A | textContent ist immer sicher | Sicher |

**Einzige XSS-Schwachstelle gefunden:**

```javascript
// shopping-list.js:146 — UNSICHER
data-shopping-key="${escapeHtml(item.key)}"
// SOLLTE SEIN:
data-shopping-key="${escapeAttribute(item.key)}"
```

`escapeHtml()` escaped keine Anfuehrungszeichen (`"`) zu `&quot;`. Wenn ein Zutaten-Name ein `"` enthaelt, kann ein Attribute-Breakout stattfinden. **Risiko: NIEDRIG** — erfordert Zutat mit `"` im Namen, und die Daten kommen aus dem eigenen Backend. Trotzdem ein Fix-Kandidat.

### 2.2 Auth-Flow & Test-Backend-Guard

```javascript
// vite.config.mjs — Build-Time Define
define: { __BROWSER_TEST_ENABLED__: JSON.stringify(process.env.VITE_BROWSER_TEST === 'true') }

// app-config.js — Runtime Double-Check
const buildAllowsBrowserTest = typeof __BROWSER_TEST_ENABLED__ !== 'undefined' && __BROWSER_TEST_ENABLED__;
const allowBrowserTest = buildAllowsBrowserTest && runtime.allowBrowserTest === true;
```

| Pruefpunkt | Ergebnis |
|------------|----------|
| Kann Test-Backend in Production aktiviert werden? | **Nein.** Doppelte Absicherung: Build-Flag + Runtime-Config |
| GitHub Pages Workflow | Nutzt `npm run build` (nicht `build:test`) |
| Dead-Code-Elimination | Vite entfernt Test-Pfad im Prod-Build |

**Urteil: Wasserdicht.**

### 2.3 Supabase RLS-Policies

| Tabelle | SELECT | INSERT | UPDATE | DELETE | Bewertung |
|---------|--------|--------|--------|--------|-----------|
| `recipes` | `is_active_member()` | `is_admin()` | `is_admin()` | `is_admin()` | Korrekt |
| `user_recipe_state` | `uid = user_id` | `uid = user_id` | `uid = user_id` | `uid = user_id` | Korrekt |
| `user_week_plan` | `uid = user_id` | `uid = user_id` | `uid = user_id` | `uid = user_id` | Korrekt |
| `profiles` | `is_active_member()` | — (nur via DEFINER) | — | — | Korrekt |
| `admin_emails` | `is_active_member()` | **Keine Policy (=DENY)** | **Keine (=DENY)** | **Keine (=DENY)** | Korrekt |
| `storage.objects` | `is_active_member()` | `is_admin()` | `is_admin()` | `is_admin()` | Korrekt |

**Kann ein Reader Admin-Daten sehen?** Nein. Reader kann `recipes` lesen (beabsichtigt), aber nicht aendern. Reader kann `profiles` und `admin_emails` lesen (beabsichtigt fuer Creator-Name-Lookup), aber nicht aendern.

**Kann ein User Daten anderer User manipulieren?** Nein. Alle personal-state Policies pruefen `auth.uid() = user_id`.

### 2.4 Edge Function `add-recipe` — Neue Befunde

| Pruefpunkt | Ergebnis |
|------------|----------|
| SQL-Injection | **Sicher:** `postgresjs` Tagged Templates sind parametrisiert |
| Secret-Validation | **Timing-Attack-Risiko:** `secret !== expectedSecret` ist nicht constant-time |
| CORS | `Access-Control-Allow-Origin: *` + Timing-Side-Channel = theoretisch exploitbar |
| Rate-Limiting | **Fehlt** — bei Secret-Kompromittierung unbegrenzte Inserts moeglich |
| Postgres-Version | Gepinnt auf `v3.4.5` — sicher |
| RLS-Bypass | **Bewusst:** Direkte DB-Verbindung via `SUPABASE_DB_URL` |

**Timing-Attack Detail:** JavaScript's `!==` Operator vergleicht Strings zeichenweise und bricht beim ersten Unterschied ab. Ein Angreifer koennte Response-Zeiten messen, um das Secret Zeichen fuer Zeichen zu erraten. Fix:

```typescript
// Empfohlen:
const encoder = new TextEncoder();
const secretBytes = encoder.encode(secret);
const expectedBytes = encoder.encode(expectedSecret);
if (secretBytes.byteLength !== expectedBytes.byteLength) { /* reject */ }
const isValid = crypto.subtle.timingSafeEqual(secretBytes, expectedBytes);
```

### 2.5 server.js Security

| Pruefpunkt | Ergebnis |
|------------|----------|
| Path Traversal | **Geschuetzt:** `path.resolve()` + `startsWith(allowedRoot)` Check |
| Body-Size-Limit | **Ja:** `MAX_BODY_SIZE = 5 MB` |
| Security Headers | `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY` |
| Missing Headers | Kein CSP, kein HSTS — OK fuer reinen Test-Server |

### 2.6 localStorage & API-Keys

- Keine sensitiven Daten im localStorage in Produktion
- Supabase Anon Key ist designiert public (publishable key) — korrekt
- Service-Role-Key nirgends im Frontend — korrekt

### 2.7 Session-Persistence nach Deaktivierung

**Befund:** Wenn ein Admin einen User deaktiviert (`is_active = false`), bleibt die JWT-Session bis zu 3600s (JWT-Expiry laut `config.toml`) gueltig. Die RLS-Policies pruefen `is_active_member()` bei jeder DB-Query, daher werden deaktivierte User sofort von neuen Queries ausgeschlossen. Gecachte Daten im Browser bleiben aber sichtbar.

**Risiko: NIEDRIG** — fuer ein Familien-Kochbuch akzeptabel.

---

## TEIL 3: Performance-Analyse

### 3.1 Bundle-Groesse

- Eigener Code: ~50-80 KB JS (geschaetzt, Vanilla JS ohne Framework)
- Supabase SDK: ~120 KB via CDN Import-Map
- Keine Framework-Runtime — hervorragend fuer eine SPA

### 3.2 Render-Performance

Kitab nutzt `innerHTML` fuer komplettes Re-Rendering. **DOM-Thrashing-Analyse:**

| Stelle | Methode | Optimiert? |
|--------|---------|------------|
| `filterDayPicker()` | `requestAnimationFrame` Batching | **Ja** |
| `header-scroll.js` | Synchrone Layout-Reads + Style-Writes im Scroll-Event | **Nein — Layout Thrashing** |
| `shopping-list.js:toggleItem()` | Punktuelles DOM-Update via `querySelector` | **Ja** |
| Rezept-Grid | Volles Re-Render | OK fuer <200 Items |

### 3.3 Netzwerk-Performance (App-Start)

```
1. auth.getSession()                          <- 1 Request
2. syncProfileForCurrentUser() (RPC)          <- 1 Request
3. fetchProfileForCurrentUser()               <- 1 Request
4. loadBundle():
   a. recipes SELECT *                        <- 1 Request  ─┐
   b. user_recipe_state SELECT               <- 1 Request   ├ Promise.all (parallelisiert)
   c. user_week_plan SELECT                  <- 1 Request   │
   d. get_creator_names() RPC                <- 1 Request  ─┘
5. resolveSupabaseImageUrls()                 <- N Requests (1 pro Rezept mit Bild!)
```

**Groesster Bottleneck:** Schritt 5 — N parallele `createSignedUrl()` Calls. Bei 50 Rezepten mit Bildern = 50 API-Calls beim Start.

### 3.4 Animation-Performance

| Effekt | Technik | CPU-Impact | Reduced-Motion? |
|--------|---------|------------|-----------------|
| `bg-particles.js` | Canvas, rAF-Loop | Mittel (80-100 Partikel) | **Ja** — kein Canvas bei `reduce` |
| `cursor-effects.js` Glow | rAF-optimiert | Niedrig | **Ja** |
| `cursor-effects.js` Ripple | DOM-Element + Timeout | Niedrig | **Ja** |
| `cursor-effects.js` Partikel-Burst | 6 DOM-Elemente pro Klick | Niedrig | **NEIN — fehlt!** |
| `effects-layer.js` | CSS-Animationen | Niedrig | **Ja** — CSS `@media` |
| `header-scroll.js` | JS-Scroll-Animation | Niedrig-Mittel | **NEIN — fehlt!** |

### 3.5 Bild-Strategie

| Aspekt | Status |
|--------|--------|
| Signed URLs | 1h Gueltigkeit, kein Client-Cache moeglich |
| Lazy Loading | `loading="lazy"` auf `<img>` — korrekt |
| Error Handling | `onerror="this.style.display='none'"` — funktional, aber Inline-Handler |
| Upload | Client-seitiges Resize — gut |

---

## TEIL 4: Code-Qualitaet

### 4.1 Race Conditions & Concurrency Bugs

| # | Datei:Zeile | Bug | Schweregrad |
|---|-------------|-----|-------------|
| RC1 | `planner-actions.js:158-175` | `updatePlanEntryServings`/`updatePlanEntrySlot` haben **kein Rollback** bei API-Fehler. State wird optimistisch geaendert, bei Netzwerkfehler bleibt die falsche Portionszahl | HOCH |
| RC2 | `import-export.js:58-113` | **Kein Double-Submit-Guard** auf Rezept-Formular. Submit-Button wird nicht disabled waehrend der Speicherung. Schneller Doppelklick = doppeltes Rezept | HOCH |
| RC3 | `data-controller.js:35-63` | **Auth-Flicker bei Logout:** Wenn `refreshAppData()` inflight ist und User ausloggt, kann `applyLoadResult()` nach dem Logout feuern und die App kurz zurueck in den Eingeloggt-Zustand bringen | MITTEL |
| RC4 | `planner-actions.js:113-137` | **Stille Fehler bei geschlossenem Planer:** Wenn User nach `addToDay()` den Planer schliesst bevor der API-Call zurueckkommt und dieser fehlschlaegt, sieht User weder Rollback noch Error-Toast | MITTEL |
| RC5 | `main.js:815` | **Event-Listener-Leak auf Shopping-Overlay:** Click-Listener auf `shoppingOverlayBody` wird einmal angebunden und nie entfernt. Bei haeufigem Oeffnen/Schliessen kein Problem, aber unclean | NIEDRIG |

### 4.2 Fehlerbehandlung

| Stelle | Verhalten | Bewertung |
|--------|-----------|-----------|
| `planner-actions.js:131-136` | `persistWeekPlan().catch()` — Rollback + Error-Toast | **Gut** |
| `planner-actions.js:158-165` | `persistWeekPlan()` ohne catch — Error bubbelt, kein Rollback | **Schlecht** |
| `data-controller.js:49` | `repository.loadAppData()` Error bubbelt zu `initializeApp()` | **OK** — User sieht Meldung |
| `repository.js:127-129` | Image-Fetch-Fehler still verschluckt | **Akzeptabel** — Export bleibt benutzbar |
| `shopping-list.js:18` | localStorage-Fehler still verschluckt | **Akzeptabel** |
| `main.js:805` | Shopping-Save Error: Button-Text aendert sich | **Gut** |

### 4.3 Toter Code

| Datei | Stelle | Beschreibung |
|-------|--------|--------------|
| `auth.js:67-80` | `requestMagicLink()`, `signInWithPassword()`, `requestPasswordReset()`, `updatePassword()` | Werden nirgends im UI aufgerufen |
| `main.js:862-863` | `_bgParticles`, `_cursorEffects` Rueckgabewerte nie fuer `destroy()` genutzt |
| `planner-view.js:228-263` | `buildShoppingListText()` — moeglicherweise Legacy, neue Shopping-Logik in `shopping-list.js` |
| `index.html:174-176` | `shoppingList`, `shoppingSearchInput`, `exportShoppingBtn` — alte Hidden-Elemente |

### 4.4 prefers-reduced-motion

| Datei | Respektiert? | Detail |
|-------|-------------|--------|
| `bg-particles.js:3` | **Ja** | Kein Canvas bei `reduce` |
| `cursor-effects.js:33,51` | **Ja** | Kein Ripple/Glow bei `reduce` |
| **`cursor-effects.js:10-24`** | **NEIN** | `onMouseDown` Partikel-Burst immer aktiv |
| `effects-layer.js` | **Ja** | CSS `@media` Block |
| CSS `animations.css` | **Ja** | `@media` Block |
| **`header-scroll.js`** | **NEIN** | Scroll-Animationen ohne reduced-motion Check |

---

## TEIL 5: Datenbank & Schema

### 5.1 Tabellen-Struktur & Indizes

**Vorhandene Indizes:**

| Index | Sinnvoll? |
|-------|-----------|
| `recipes_title_idx` (lower(title)) | Ja |
| `recipes_updated_at_idx` | Ja |
| `user_recipe_state_user_id_idx` | Ja |

**Fehlende Indizes:**

| Tabelle | Spalte | Grund |
|---------|--------|-------|
| `recipes` | `created_at DESC` | Standard-Sortierung im `loadBundle()`, aktuell kein Index. Bei kleiner Datenmenge irrelevant |

### 5.2 RLS-Policies — Vollstaendigkeitscheck

Alle Policies sind lueckenlos. Kein INSERT/UPDATE/DELETE auf `admin_emails` (=DENY by default). `sync_profile_for_user_internal()` korrekt per REVOKE von public/anon/authenticated geschuetzt. Nur `sync_profile_for_current_user()` ist fuer authenticated zugelassen.

### 5.3 Security-Definer-Functions

| Function | SECURITY DEFINER? | search_path? | Missbrauchbar? |
|----------|-------------------|--------------|----------------|
| `is_active_member()` | Ja | `public` | Nein — read-only |
| `is_admin()` | Ja | `public` | Nein — read-only |
| `sync_profile_for_user_internal()` | Ja | `public` | Nein — REVOKE von allen Rollen |
| `sync_profile_for_current_user()` | Ja | `public` | Nein — nutzt `auth.uid()` |
| `handle_new_user()` | Ja | `public` | Nein — nur Trigger auf `auth.users` |
| `get_creator_names()` | Ja | `public` | **Info-Disclosure** — exponiert alle Admin-User-IDs + Display-Names. Beabsichtigt fuer Creator-Anzeige |
| `resolve_profile_role()` | **Nein** | — | Korrekt: Interne Helper-Function, nur von DEFINER-Functions aufgerufen |

### 5.4 admin_emails + display_name Architektur

- Admin-Status wird migrationsbasiert verwaltet — fuer <10 User akzeptabel
- `display_name` lebt in `admin_emails` — nur Admins haben Display-Names
- Reader haben keinen Display-Name (kein `createdByName` bei ihren Rezepten)
- Fuer Skalierung muesste Admin-UI + separate `display_names`-Tabelle her

### 5.5 checked_items JSONB in user_week_plan

JSONB-Spalte ist fuer kleine Einkaufslisten angemessen. Ganzes Array wird per `saveCheckedItems()` ueberschrieben (kein inkrementelles Update). Bei concurrenten Aenderungen (zwei Browser gleichzeitig) gewinnt der letzte Schreiber (Lost Update). Fuer Familien-Kontext akzeptabel.

### 5.6 Edge Function Timing-Attack

```typescript
// add-recipe/index.ts:22 — UNSICHER
if (!expectedSecret || secret !== expectedSecret) { ... }
```

JavaScript's `!==` auf Strings ist **nicht constant-time**. Bei CORS `*` kann ein Angreifer von beliebiger Origin Timing-Messungen durchfuehren. Theoretisch koennte das Secret zeichenweise erraten werden.

**Praktische Exploitability:** Gering — Netzwerk-Jitter ueberlagert die Timing-Differenz in den meisten Faellen. Aber ein Fix ist trivial.

---

## TEIL 6: UX & Accessibility

### 6.1 ARIA-Attribute

Gut umgesetzt fuer die meisten Elemente:
- Dialoge: `role="dialog"`, `aria-modal="true"`, `aria-labelledby`/`aria-label`
- Buttons: `aria-pressed`, `aria-label`, `aria-expanded`
- Live Regions: `aria-live="polite"`, `aria-atomic="true"`
- Day Picker: `aria-describedby`, `aria-label`

**Fehlend:** `searchInput` hat kein `<label>` — nur `placeholder`.

### 6.2 Focus-Styles — Kritische Luecke

**20+ interaktive Elemente haben `:hover`-Styles aber KEINE `:focus-visible`-Styles:**

| Element | Datei | Hat :hover | Hat :focus-visible |
|---------|-------|-----------|-------------------|
| `.modal-close` | `modal.css:67` | Ja | **Nein** |
| `.modal-favorite` | `modal.css:118` | Ja | **Nein** |
| `.modal-edit` | `modal.css:86` | Ja | **Nein** |
| `.modal-cooked` | `modal.css:103` | Ja | **Nein** |
| `.modal-planner-toggle` | `modal.css:228` | Ja | **Nein** |
| `.modal-section-toggle` | `modal.css:369` | Ja | **Nein** |
| `.shopping-item` | `shopping.css:130` | Ja | **Nein** |
| `.planner-entry-title` | `planner.css:192` | Ja | **Nein** |
| `.planner-entry-remove` | `planner.css:222` | Ja | **Nein** |
| `.planner-drag-handle` | `planner.css:261` | Ja | **Nein** |
| `.day-add-btn` | `planner.css:125` | Ja | **Nein** |
| `.tag` (recipe-grid) | `recipe-grid.css:137` | Ja | **Nein** |
| `.user-menu-trigger` | `user-menu.css:31` | Ja | **Nein** |
| `.user-menu-logout` | `user-menu.css:97` | Ja | **Nein** |
| `.shopping-close` | `shopping.css:59` | Ja | **Nein** |
| `.shopping-header-btn` | `shopping.css:59` | Ja | **Nein** |
| `.toolbar-toggle` | `toolbar.css:48` | Ja | **Nein** |
| `.toolbar-close` | `toolbar.css:22` | Ja | **Nein** |

**Positiv:** Buttons (`controls.css:90-92`) und Recipe Cards (`recipe-grid.css:78-81`) HABEN `:focus-visible`. Inputs haben Box-Shadow-Replacement fuer `outline: none`.

### 6.3 Touch-Targets

**Unter 44x44px (WCAG AAA Minimum):**

| Element | Groesse | Datei |
|---------|---------|-------|
| `.shopping-check` | **24x24px** | `shopping.css:161` |
| `.shopping-header-btn` | 36x36px | `shopping.css:65` |
| `.shopping-close` | 36x36px | `shopping.css:65` |
| `.modal-close` | 38x38px | `modal.css:76` |
| `.modal-favorite` | 38x38px | `modal.css:124` |
| `.user-menu-trigger` | 40x40px | `user-menu.css:35` |
| `.toolbar-toggle` | 40x40px | `toolbar.css:57` |
| `.toolbar-close` | 40x40px | `toolbar.css:30` |
| `.modal-section-toggle` | `min-height: unset` | `modal.css:381` — entfernt 44px Default! |

### 6.4 Lade-Zustaende

| Zustand | Feedback | Bewertung |
|---------|----------|-----------|
| App-Start | Mirage-Overlay + Stern-Animation | **Sehr gut** |
| Rezepte laden | 8 Skeleton-Cards | **Sehr gut** |
| Login | Button disabled + Text | OK |
| **Rezept speichern** | **Kein Loading-State auf Submit-Button** | **Schlecht** — zusammen mit fehlendem Double-Submit-Guard (RC2) |
| Shopping speichern | Button-Text wechselt | Gut |
| **Wochenplan speichern** | **Kein sichtbarer State** | **Akzeptabel** — Optimistic Update |

### 6.5 Farb-Kontrast (WCAG AA: 4.5:1 fuer Text)

| Kombination | Geschaetztes Verhaeltnis | Bewertung |
|-------------|--------------------------|-----------|
| `#9AA5B8` auf `#0D1B2A` (sekundaerer Text) | ~4.8:1 | Knapp bestanden |
| `#C9A84C` auf `#1B2D4A` (Gold auf Lapis) | ~4.2:1 | **Knapp unter AA** |
| `#B87333` auf `#0D1B2A` (Copper auf Midnight) | ~3.8:1 | **Unter AA** fuer normalen Text |

---

## TEIL 7: Testing & CI/CD

### 7.1 Bestehende Tests

**Smoke Tests:** Admin CRUD, Reader Isolation, Personal State, Legacy Migration, Import/Export (Schema v4), Modal Planning, Drag & Drop — **solide Basis**.

**Supabase Tests:** RPC Hardening, RLS Separation, Import/Export mit echtem Backend.

### 7.2 Fehlende Tests — Priorisiert

| Bereich | Prioritaet | Begruendung |
|---------|-----------|-------------|
| Ingredient-Parsing Unit-Tests | **HOCH** | `parseIngredient()` hat viele Edge-Cases (Brueche, Unicode, Umlaute) |
| Einkaufsliste E2E | **HOCH** | Neues Feature, komplett ungetestet |
| Rezept-Suche/Filter E2E | **HOCH** | Kern-Feature, ungetestet |
| Serving-Skalierung Unit-Tests | MITTEL | `scaleIngredient()` hat Rundungs-Edge-Cases |
| Tag-Filtering E2E | MITTEL | |
| Sortierung E2E | MITTEL | |
| Keyboard-Navigation E2E | MITTEL | |
| Error/Offline-Handling E2E | NIEDRIG | |

### 7.3 CI/CD

**KRITISCHER BEFUND: Tests laufen nicht im CI!**

```yaml
# .github/workflows/deploy-pages.yml
- name: Build app
  run: npm run build    # <-- Kein Test-Step davor!
```

Ein kaputter Build geht direkt auf GitHub Pages. Kein PR-Review, keine Test-Validierung.

---

## TEIL 8: Priorisierter Massnahmenkatalog

### HOCH

| # | Datei:Zeile | Problem | Fix | Aufwand |
|---|-------------|---------|-----|---------|
| H1 | `deploy-pages.yml` | **Tests laufen nicht im CI** | `npm run build:test && npm run serve:test & npm run test:smoke` Step vor Deploy | 1-2h |
| H2 | `supabase-driver.js:71-83` | **N Signed-URL-Requests beim App-Start** | Batch-Signing, Public Bucket oder LRU-Cache mit TTL | 2-4h |
| H3 | `import-export.js:58-113` | **Kein Double-Submit-Guard** auf Rezept-Formular | Submit-Button disablen + `isSubmitting`-Flag | 30min |
| H4 | `planner-actions.js:158-175` | **Kein Rollback** bei `updatePlanEntryServings`/`updatePlanEntrySlot` | `previousWeekPlan` Backup + `.catch()` Rollback wie bei `addToDay` | 30min |
| H5 | Tests fehlen | **Keine Unit-Tests fuer Ingredient-Parsing** | Jest/Vitest Setup + Tests fuer `parseIngredient()`, `scaleIngredient()` | 2-3h |
| H6 | Tests fehlen | **Einkaufsliste + Suche ungetestet** | E2E-Tests ergaenzen | 2-3h |

### MITTEL

| # | Datei:Zeile | Problem | Fix | Aufwand |
|---|-------------|---------|-----|---------|
| M1 | `shopping-list.js:146` | `escapeHtml()` statt `escapeAttribute()` in data-Attribut | Funktion ersetzen | 5min |
| M2 | `cursor-effects.js:10` | Partikel-Burst ignoriert `prefers-reduced-motion` | `if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;` | 5min |
| M3 | `header-scroll.js` | Keine rAF-Optimierung + kein reduced-motion Check | Scroll-Handler in rAF wrappen + Media-Query pruefen | 30min |
| M4 | `data-controller.js:52` | Auth-Flicker bei Logout waehrend Refresh | `if (authService.getSnapshot().accessState !== 'signed_in') return;` vor `applyLoadResult()` | 10min |
| M5 | `main.js` | 890 Zeilen Gott-Datei mit Shopping-Logik | Shopping-Controller-Verdrahtung extrahieren | 2-3h |
| M6 | `main.js:824-828` | Monkey-Patch auf `plannerController.updateShoppingList` | Callback-Injection statt Monkey-Patch | 1h |
| M7 | 20+ CSS-Dateien | **Fehlende `:focus-visible`-Styles** auf 20+ Buttons | Globale Focus-Visible-Regel + spezifische Overrides | 1-2h |
| M8 | `add-recipe/index.ts:22` | Timing-Attack auf Secret-Vergleich | `crypto.subtle.timingSafeEqual()` nutzen | 15min |
| M9 | Diverse CSS | Touch-Targets unter 44x44px | `min-width`/`min-height` auf 44px setzen | 1h |

### NIEDRIG

| # | Datei:Zeile | Problem | Fix | Aufwand |
|---|-------------|---------|-----|---------|
| N1 | `index.html:111` | `searchInput` hat kein `<label>` | `<label class="sr-only" for="searchInput">` | 5min |
| N2 | `index.html:174-176` | Tote Hidden-Elemente | Entfernen | 10min |
| N3 | `auth.js:67-80` | Tote Methoden (requestMagicLink etc.) | Entfernen oder dokumentieren | 15min |
| N4 | `runtime-config.js` | Duplikat in `/` und `/public/` | Eines entfernen | 15min |
| N5 | `planner-view.js:228` | `buildShoppingListText()` moeglicherweise Legacy | Pruefen, ggf. entfernen | 15min |
| N6 | `add-recipe/index.ts` | Kein Rate-Limiting | Supabase Rate-Limit oder Middleware | 1-2h |
| N7 | CSS-Variablen | Farb-Kontrast unter WCAG AA bei Copper/Gold | Farben anpassen | 1h |
| N8 | `main.js:862-863` | `_bgParticles`/`_cursorEffects` destroy nie genutzt | Dokumentieren | 5min |

---

## TEIL 9: Strategische Empfehlungen

### 9.1 Architektonischer Stand

Das Projekt ist **bemerkenswert gut strukturiert** fuer eine Vanilla-JS-App. Die Architektur-Entscheidungen — Driver-Pattern, Controller-Pattern, Schema-Layer mit Pure Functions, konsequentes XSS-Escaping, wasserdichtes RLS — zeugen von durchdachtem Software-Engineering.

Die App ist fuer ihren Anwendungsfall (Familien-Kochbuch, <10 User, <500 Rezepte) **angemessen skalierbar**. Der Hauptengpass ist die N+1 Signed-URL-Generierung.

### 9.2 Was ich SOFORT aendern wuerde

1. **Tests im CI** (H1) — Der groesste Gap. Ein kaputter Build geht ungetestet live.
2. **Double-Submit-Guard** (H3) — 30 Minuten Fix, verhindert doppelte Rezepte.
3. **`escapeAttribute()` in shopping-list.js** (M1) — 5 Minuten Fix fuer XSS.

### 9.3 Top 3 Verbesserungen mit groesstem Impact

| # | Verbesserung | Impact | Aufwand |
|---|-------------|--------|---------|
| 1 | **CI mit Test-Gate** | Verhindert kaputte Deploys. Grundlage fuer alles | 2h |
| 2 | **Unit-Tests fuer Schema-Layer** | `parseIngredient`, `scaleIngredient` — fehleranfaelligste Funktionen, Unit-Tests sind schnell und hochwertig | 3h |
| 3 | **Focus-Visible-Styles global** | Eine CSS-Regel (`button:focus-visible { outline: 2px solid var(--mirage-gold); outline-offset: 2px; }`) fixt 20+ Elemente auf einmal | 30min |

### 9.4 Fundamentale Design-Entscheidungen

| Entscheidung | Bewertung |
|-------------|-----------|
| Vanilla JS statt Framework | **Richtig.** App ist klein genug. Framework wuerde Bundle aufblaehn |
| Supabase als Backend | **Sehr gut.** Auth + DB + Storage + Edge Functions aus einer Hand. RLS maechtiger als Custom-Backends |
| Mutables State-Objekt | **Akzeptabel jetzt, Risiko bei Wachstum.** Kein reaktives System = manuelles Rendern nach jeder Aenderung |
| GitHub Pages | **OK aber limitiert.** Kein Server-Side, kein Edge-Caching, keine Custom Headers |

### 9.5 Tech-Stack Zukunftssicherheit

| Technologie | Zukunft |
|-------------|---------|
| Vanilla JS (ES Modules) | **Sehr zukunftssicher.** Browser-native, kein Lock-in |
| Vite | **Branchenstandard.** Aktiv maintained |
| Supabase | **Gut.** Open Source, wachsend. Postgres-Migration moeglich |
| Playwright | **Branchenstandard** |

---

## Gesamtnote: B+

### Begruendung

**Staerken:**
- Exzellente Security: Konsistentes XSS-Escaping (17/18 Stellen korrekt), wasserdichtes RLS, Build-Guard
- Saubere Architektur: Driver-Pattern, Controller-Pattern, Schema-Layer
- Durchdachte UX: Mirage-Overlay, Skeleton-Loading, Optimistic Updates mit Rollback
- Gute A11y-Grundlagen: ARIA, Focus Trapping, Live Regions, reduced-motion (meistens)

**Schwaechen:**
- Keine Tests im CI (groesster Gap)
- Fehlende Unit-Tests fuer kritische Business-Logik
- Race Conditions bei Double-Submit und Servings-Updates ohne Rollback
- 20+ Buttons ohne Focus-Visible-Styles
- Touch-Targets teilweise unter 44px
- N+1 Signed-URL-Queries beim Start

**Warum nicht A:** Die fehlende CI-Integration und die Race Conditions (Double-Submit, kein Rollback bei Servings) sind fuer ein Produktionsprojekt problematisch.

**Warum nicht B:** Die Security-Arbeit (RLS, XSS-Escaping, Auth-Guard), die Architektur-Qualitaet und die durchdachte UX heben das Projekt deutlich ueber den Durchschnitt.
