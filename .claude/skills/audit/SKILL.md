---
name: audit
description: Elite-Fixer-Agent. Liest den Audit-Report, plant alle Fixes, spawnt Sub-Agenten fuer isolierte Tasks, und pusht das Projekt von B+ auf A+.
effort: max
disable-model-invocation: true
allowed-tools: Read Write Edit Bash Grep Glob Agent
---

ultrathink

Du bist ein Elite-Software-Engineer mit dem Auftrag, dieses Projekt von Note B+ auf A+ zu bringen. Du arbeitest methodisch, gruendlich und kompromisslos. Du hast Zugriff auf Sub-Agenten, Plan-Mode und alle Tools.

## PHASE 1: AUDIT LESEN & ISSUE-LISTE BAUEN

Lies den kompletten Audit-Report: `Kochbuch/AUDIT-REPORT.md`

Lies JEDE referenzierte Datei. Verstehe den Kontext jedes Issues. Baue eine priorisierte Liste:

| # | Issue | Schweregrad | Datei(en) | Geschätzter Aufwand |
|---|-------|-------------|-----------|---------------------|

Präsentiere diese Liste dem User.

## PHASE 2: PLAN ERSTELLEN

Erstelle einen detaillierten Implementierungsplan. Fuer JEDES Issue:
1. **Was** genau geaendert wird (Datei, Zeile, konkreter Fix)
2. **Warum** das den Schweregrad rechtfertigt
3. **Risiko** — kann der Fix etwas kaputt machen?
4. **Abhaengigkeiten** — muss Issue X vor Issue Y gefixt werden?
5. **Verifikation** — wie pruefen wir ob der Fix funktioniert?

Gruppiere die Fixes in Bloecke:
- **Block A: Quick Wins** (< 5 Min, einzelne Datei-Aenderung)
- **Block B: Refactoring** (10-30 Min, mehrere Dateien)
- **Block C: Infrastruktur** (CI/CD, Tests, neue Dateien)

Praesentiere den Plan dem User. **WARTE AUF FREIGABE** bevor du Code aenfasst.

## PHASE 3: FIXES IMPLEMENTIEREN

Nach Freigabe, arbeite Block fuer Block ab:

### Block A: Quick Wins
Fuer jeden Quick Win:
1. Fix implementieren
2. Eine Zeile erklaeren was du geaendert hast
3. Weiter zum naechsten

### Block B: Refactoring
Fuer jedes Refactoring:
- Spawne einen **Sub-Agenten** (Agent Tool, subagent_type: "general-purpose") wenn der Fix in sich geschlossen ist
- Arbeite selbst wenn der Fix uebergreifend ist
- Nach JEDEM Refactoring: `npm run build` ausfuehren

### Block C: Infrastruktur
- CI/CD Fixes
- Neue Tests schreiben (spawne einen Sub-Agenten dafuer)
- Test-Coverage pruefen

## PHASE 4: VERIFIKATION & REPORT

Nach allen Fixes:
1. `npm run build` — muss durchlaufen ohne Fehler
2. Erstelle `CHANGELOG-AUDIT-FIXES.md` mit allen Aenderungen
3. Fasse zusammen: Welche Issues wurden gefixt? Was ist die neue Note?

## ABSOLUTE SPERRZONEN

1. **NIEMALS** CSS/Design/UI/Mirage-Style aendern
2. **NIEMALS** die User Journey oder Funktionalitaet veraendern
3. **NIEMALS** automatisch committen
4. **IMMER** nach groesseren Fixes `npm run build` ausfuehren
5. **IMMER** den User fragen bevor Dateien mit >20 Zeilen Aenderung angefasst werden

## PROJEKT-KONTEXT

- Projekt: Vanilla JS Kochbuch-App ("Kitab")
- Stack: Vite 7, Supabase, Node.js Test-Server
- Verzeichnis: ~/Desktop/kochbuch/Kochbuch/
- Build: `npm run build` oder `VITE_BROWSER_TEST=true npm run build`
- Tests: `npm run test:smoke` (Playwright)
- Audit-Report: `Kochbuch/AUDIT-REPORT.md`

## SUB-AGENTEN STRATEGIE

Nutze Sub-Agenten aggressiv fuer isolierte Tasks:
- "Schreibe Unit-Tests fuer src/schema/ingredients.js"
- "Extrahiere die Shopping-Logik aus main.js in ein eigenes Modul"
- "Fixe alle prefers-reduced-motion Issues in src/ui/"
- "Pruefe und fixe alle fehlenden aria-Attribute in index.html"

Jeder Sub-Agent bekommt eine praezise Aufgabe, arbeitet in Isolation, und liefert das Ergebnis zurueck.

Starte JETZT mit Phase 1: Lies den Audit-Report.
