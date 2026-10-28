# Family-Planner – Anweisungen für Claude

Diese Datei liest Claude automatisch, wenn das Repository in **Claude Code** (Web, Handy-App) geöffnet wird.
Sie enthält die Projekt-Regeln. Technische Details stehen in `ENTWICKLUNG.md`.

## Rolle & Zusammenarbeit
- Tobias ist kein Programmierer. Claude plant, programmiert und dokumentiert alles. Tobias testet auf seinem Android-Handy und gibt Feedback.
- Entscheidungen kurz und in einfacher Sprache erklären, ohne Fachjargon. Wenn Tobias etwas tun muss (klicken, Konto, Supabase), eine nummerierte Schritt-für-Schritt-Anleitung geben.
- In kleinen, testbaren Schritten arbeiten. Nach jedem Schritt muss Tobias etwas auf dem Handy ausprobieren können.
- Deutsch, Schweizer Schreibweise («ss» statt «ß»). Einheiten metrisch (g, kg, ml, l, Stk.).
- Bei Unklarheiten zuerst fragen, dann bauen. **Kein Feature einbauen, das nicht in ROADMAP.md beschlossen ist, ohne vorher nachzufragen.**
- Tobias schreibt oft vom Handy: Antworten kurz halten, Rückfragen als nummerierte Auswahl stellen, damit er mit «1» oder «2» antworten kann.

## Ziele
1. App läuft offline auf dem Android-Handy, Daten lokal (IndexedDB). ✅
2. Gemeinsame Nutzung über Supabase (Tobias und Thadea). ✅ läuft
3. Kein Play Store (Entscheid 26.10.2026). Falls nötig später eine APK (Capacitor) für die Familie.

## Jede Sitzung
1. `ROADMAP.md` lesen und kurz vorschlagen, was als Nächstes kommt. `IDEEN.md` anschauen (neue Einträge erwähnen).
2. **Nur eine Idee festhalten?** Wenn Tobias eine Idee schickt und nicht ausdrücklich «bauen» sagt: in `IDEEN.md` unter «Eingang» eintragen (Datum, Idee in seinen Worten, evtl. 1–2 Rückfragen), committen, fertig. Nichts bauen.
3. **Bauen:** erst wenn Tobias zustimmt. Ablauf siehe unten.
4. Am Schluss `ROADMAP.md` (Stand, nächste Schritte, Verlauf), bei Bedarf `ENTSCHEIDUNGEN.md` (neuer Eintrag E…) und `ANLEITUNG.md` (neuer Abschnitt, falls Tobias etwas tun muss) nachführen.

## Bauen und testen (Claude Code in der Cloud)
- Abhängigkeiten: `npm install` (react, react-dom, esbuild, typescript).
- Version in `package.json` **vor jedem Build** erhöhen (z.B. 0.15.0 → 0.15.1 / 0.16.0).
- Bauen: `node scripts/build.mjs` → schreibt die fertige App nach `docs/`. **`docs/` gehört ins Repository**, GitHub Pages zeigt die App von dort (`main` / `docs`).
- Tests: `bash tests/run-all.sh` (baut eine Testversion gegen den Supabase-Nachbau `tests/mock-supabase.mjs`, Playwright im Handy-Format).
  Falls Playwright fehlt: `npm i --no-save playwright && npx playwright install chromium`. Klappt das nicht (Netzwerk gesperrt), Tobias sagen, dass die automatischen Tests nicht laufen konnten, und nichts ausliefern ohne sein OK.
- Für neue Funktionen einen Test ergänzen (siehe `tests/README.md`).
- Die echte Supabase-Datenbank und Google sind aus der Cloud nicht erreichbar und werden nie direkt verändert.

## Ausliefern
- Änderungen inklusive neu gebautem `docs/` committen und pushen. Commit-Nachricht auf Deutsch, kurz.
- Claude Code arbeitet auf einem eigenen Branch (`claude/…`). Dann einen **Pull Request** auf `main` erstellen und Tobias in einfachen Worten sagen, was er tun muss:
  1. Den Link zum Pull Request öffnen (oder GitHub-App → Repository family-planner → Pull requests).
  2. **«Merge pull request»** → **«Confirm merge»**.
  3. 1–2 Minuten warten, App auf dem Handy schliessen und neu öffnen, Version prüfen (Mehr → unten).
- Darf Claude direkt auf `main` pushen (Tobias hat es erlaubt und es funktioniert), entfällt der Pull Request.
- **Immer nur einen offenen Pull Request gleichzeitig.** Weil `docs/` bei jedem Build neu entsteht, gibt es sonst Konflikte. Vor neuer Arbeit sicherstellen, dass der letzte gemergt ist und vom aktuellen `main` aus arbeiten.
- Braucht es ein Datenbank-Update (`supabase/update-x.y.sql`) oder eine geänderte Edge Function, das in `ANLEITUNG.md` beschreiben und Tobias klar sagen, dass er das selbst in Supabase machen muss (geht auch im Handy-Browser, am PC einfacher).

## Wo was liegt
- `src/` Quellcode (React 19 + TypeScript), `public/` Vorlagen, `scripts/build.mjs` Build, `docs/` fertige App
- `supabase/` Datenbank-Schema, Updates, Edge Functions
- `tests/` automatische Tests
- `ROADMAP.md` Stand und Plan · `IDEEN.md` Ideen-Eingang · `ENTSCHEIDUNGEN.md` Entscheide · `ANLEITUNG.md` für Tobias · `ENTWICKLUNG.md` Technik für Claude
- Die Dokumente gibt es zusätzlich im claude.ai-Projekt «Family-Planner». **Massgebend ist die Fassung im Repository.** Das Projekt wird bei der nächsten Cowork-Sitzung am PC nachgeführt.
