# ENTWICKLUNG – Notizen für Claude (technisch)

Diese Datei ist für Claude: So wird in einer neuen Sitzung weitergearbeitet. Tobias muss sie nicht lesen.

## Zwei Arbeitswege
- **Cowork am PC** (verbundener Ordner `C:\Users\tleibacher\Claude\Family-Planner`): Ablauf unten. Tobias lädt mit GitHub Desktop hoch.
- **Claude Code im Web / Handy** (Repository `leibi-tech/family-planner` direkt von GitHub): Regeln und Ablauf in `CLAUDE.md`. Claude pusht selbst auf einen Branch und macht einen Pull Request, Tobias merged ihn.
- Weil jetzt von beiden Seiten Änderungen kommen: **Vor jeder Cowork-Sitzung muss der Ordner auf dem PC den neusten Stand von GitHub haben.** Mit `device_bash` `git fetch && git status -sb` prüfen (falls Netzwerk erlaubt). Steht dort «behind» oder ist unklar: Tobias bitten, in GitHub Desktop **Fetch origin** und dann **Pull origin** zu klicken. Erst danach Dateien holen.
- Ideen von unterwegs stehen in `IDEEN.md` (Eingang). In der Planungssitzung besprechen und in die ROADMAP übernehmen.

## Ablauf jeder Sitzung (Cowork)
1. ROADMAP.md lesen (Projekt-Dokument oder im verbundenen Ordner `C:\Users\tleibacher\Claude\Family-Planner`) und kurz vorschlagen, was als Nächstes kommt.
2. Code holen (erst nach dem Abgleich mit GitHub, siehe oben): Der Quellcode liegt im verbundenen Ordner. Mit `device_list_dir` auflisten und `src/`, `public/`, `scripts/`, `package.json`, `tsconfig.json` und `supabase/` per `device_stage_files` in den Container kopieren, z.B. nach `/home/claude/family-planner`. `docs/` muss nicht mit, das wird neu gebaut.
3. Bauen im Container:
   - `ln -sfn /opt/npm-tools/node_modules node_modules` (enthält esbuild, react, react-dom)
   - `node scripts/build.mjs` baut nach `docs/`
   - Version in `package.json` vor jedem Build erhöhen
   - npm, Supabase und github.io sind im Cowork-Container gesperrt. Es gibt dort kein npm install. (In Claude Code im Web geht `npm install`.)
4. Testen:
   - Playwright: Die Tests laden es über `tests/pw.mjs` (zuerst `/opt/npm-tools/…`, sonst das npm-Paket `playwright`). In Cowork ist Chromium vorinstalliert. `tests/run-all.sh` verlinkt `/opt/npm-tools/node_modules`, wenn vorhanden, sonst `npm install`.
   - Testbuild gegen einen Supabase-Nachbau: `SUPABASE_URL=http://localhost:8766 OUT_DIR=docs-test node scripts/build.mjs`, dann mit `python3 -m http.server` unter `/family-planner/` ausliefern
   - Den Nachbau (`tests/mock-supabase.mjs`, Node, in-memory: `records` mit LWW und `owner_id`, `my_membership`) bei Bedarf erweitern. Er muss das Verhalten von `supabase/schema.sql` nachbilden.
   - **Alle automatischen Tests:** `bash tests/run-all.sh` (baut die Testversion, startet Nachbau und Webserver, lässt `ui-local`, `start-page`, `sync-two`, `todo-link` laufen). Vor jedem Ausliefern ausführen; für neue Funktionen einen Test ergänzen (siehe `tests/README.md`).
   - SQL lokal prüfen: PostgreSQL 16 ist installiert (`/usr/lib/postgresql/16/bin`). Datenverzeichnis unter `/var/tmp` als User `postgres` anlegen, Port 5433. Supabase-Teile nachbilden: `auth.users`, `auth.uid()` über `current_setting('request.jwt.claim.sub')`, Rolle `authenticated`.
5. Ausliefern:
   - Geänderte Dateien nach `/mnt/user-data/outputs/family-planner/<pfad>` kopieren und mit `device_commit_files` (force) in den Ordner schreiben
   - **Danach immer mit `md5sum` im Container und per `device_bash` auf dem Gerät vergleichen.** Am 22.10. kam einmal eine `app.js` nicht an.
   - `docs/*` immer vollständig mitschicken: app.js, app.css, index.html, sw.js
6. Tobias lädt mit GitHub Desktop hoch (Summary, «Commit to main», «Push origin»; verlangt GitHub Desktop vorher «Pull origin», zuerst das). Alternative: `hochladen.bat`, holt zuerst den Stand von GitHub. GitHub Pages liefert aus `main` / `docs`.
7. ROADMAP.md, ENTSCHEIDUNGEN.md und ANLEITUNG.md aktualisieren: im Ordner **und** im Projekt (`project_write` auf `claude/…`). Massgebend ist die Fassung im Repository: Wurden die Dateien in Claude Code (Web) geändert, die Projekt-Dokumente in der nächsten Cowork-Sitzung aus dem Ordner nachführen.

## Architektur in Kürze
- **App:** PWA, React 19 und TypeScript, gebaut mit esbuild. Feste Dateinamen `app.js` und `app.css` mit `?v=hash`. Der Service Worker `sw.js` wird beim Build aus `public/sw.template.js` erzeugt.
- **Lokal:** IndexedDB über `src/db.ts`. Stores: persons, menus, days, shopping, manual, recurring, suggest, todos, chores, notes, meta (DB-Version 7). Jeder Datensatz hat `id`, `updatedAt`, `deleted` und `dirty`.
- **Cloud:** Supabase, Projekt `hkakelobqtbyliszrils` (Zürich), publishable key in `scripts/build.mjs`. Die App spricht direkt mit REST und Auth, ohne supabase-js (`src/cloud.ts`).
- **Abgleich:** `src/sync.ts`. Zuerst `dirty` hochladen (Upsert, merge-duplicates), dann ab `server_updated_at` herunterladen, die neuere Änderung gewinnt. Personen lädt nur ein Admin hoch.
- **Datenbank:** `supabase/schema.sql` ist komplett, inklusive Update 0.8. Updates kommen als eigene Datei `supabase/update-x.y.sql`; Tobias führt sie im SQL Editor aus (Feld oben rechts = «Database»!). Ans Ende immer `notify pgrst, 'reload schema';`.
- **Rollen (v0.8):**
  - `members.role` ist owner, admin oder member; `members.person_id` verknüpft das Konto mit einer Person.
  - RPCs: join_household(code, name), my_membership, claim_person, household_members, set_member_role, assign_person, remove_member, get_invite_code, new_invite_code.
  - Faktoren werden «aus eigener Sicht» angezeigt (geteilt durch den eigenen Faktor).
- **Menü-Import (v0.9):** `src/recipeImport.ts` zerlegt Text (parseRecipeText, parseIngredientLine), `src/components/ImportSheet.tsx` ist das Fenster, `MenuEditor` zeigt mit `sources` die Originalzeilen. Link-Import: `cloud.fetchRecipeFromUrl` → Edge Function `supabase/functions/rezept-import/index.ts` (Deno, JSON-LD und Microdata, Auth-Prüfung über `/auth/v1/user`, Verify JWT aus). Die Funktion exportiert `handler` und `extractRecipe` und lässt sich mit esbuild für Node bündeln und mit gefälschtem `fetch` testen. Im Playwright-Test die Supabase-Adresse per `page.route` abfangen.
- **ToDos (v0.10):** `src/todos.ts` (Typen, `occurrenceIn`, `generateChoreTodos`, `isMine`), `src/pages/TodoPage.tsx`. Ämtli-ToDos haben die ID `chore-<choreId>-<Montag>` und werden mit `putGenerated` (updatedAt = 1, dirty) gespeichert, damit echte Änderungen beim Abgleich immer gewinnen. Erzeugt wird in `App.tsx` (Start, Änderung an chores/persons, Sichtbarkeit, alle 30 min). Private ToDos: `sync.ts` lädt sie in einem eigenen Paket mit `owner_id` = Konto hoch (PostgREST verlangt gleiche Spalten pro Paket); RLS in `update-0.10.sql`. Wechsel privat ↔ Familie = neue ID + leerer Löschvermerk.
- **Notizen & Listen (v0.11):** `src/notes.ts` (Typen, `mergeNote`, Hilfen, `updateNote`), `src/pages/NotesPage.tsx` (Übersicht + Editor als Seite, nicht als Fenster). Store `notes`, keine SQL-Änderung: private Notizen gehen wie private ToDos mit `owner_id` hoch (`private`-Feld). Listenpunkte haben `at` und `deleted`, Pins `{on, at}`; `mergeNote` vereinigt beide Fassungen. `sync.ts`: vor dem Hochladen `mergeNotesWithServer` (holt die Serverfassung per `cloud.fetchRecords`), beim Herunterladen Zusammenführen statt Verwerfen, wenn die lokale Fassung geändert ist. Test mit zwei Browser-Kontexten gegen den Supabase-Nachbau: gleichzeitige Änderung (einer offline), Pin für alle, privat, geteilt→privat ohne Inhaltsrest.
- **Startseite & Navigation (v0.12):** `src/pages/StartPage.tsx`, Menüleiste und «Mehr» in `src/App.tsx` (Tab-Typ: start, plan, einkauf, todo, notizen, mehr, menues, familie; Wochenplan/Menüs/Familie sind Unterseiten von «Mehr»). `src/nav.ts`: `requestOpen(kind, id, from)` → App wechselt den Tab (`TAB_FOR`), die Zielseite (`NotesPage`, `TodoPage`, `MenusPage`) holt `takePending(kind)` ab, sobald ihre Daten geladen sind, und ruft beim Schliessen `navBack(from)` auf. Neue Seiten, die so geöffnet werden sollen, brauchen dasselbe Muster. Die App startet immer mit `start` (nicht mehr gemerkt).
- **Kalender (v0.14, K1):** Edge Function `supabase/functions/google-kalender/index.ts` (Aktionen per POST `{action}`: connect, status, calendars, select, disconnect, events; GET = Rücksprung von Google mit `code`/`state`). State = HMAC-signiert mit GOOGLE_CLIENT_SECRET. Tabelle `google_accounts` (update-0.14.sql, RLS ohne Policies, Zugriff nur mit Service-Key: `FP_SECRET_KEY` oder `SUPABASE_SERVICE_ROLE_KEY`). Scopes: openid, email, calendar.events, calendar.calendarlist.readonly. App: `src/calendar.ts` (Kopie in `meta`: `calendarCache` pro Monat, `calendarStatus`; `readReturnFromGoogle` liest `#kalender=ok|abgebrochen|rechte|fehler` beim Start in `App.tsx`), `src/pages/CalendarPage.tsx`, `cloud.calendarCall`. Tests: `node tests/google-function.mjs` (bündelt die Funktion für Node, fälscht Google/Supabase per `fetch`), `tests/calendar.mjs` (Nachbau der Funktion in `mock-supabase.mjs`, `/__control/gcal`). Nach Änderungen an der Funktion `index-zum-kopieren.txt` neu kopieren. K2 (v0.15): Aktionen create, update (scope one/all, `origStartDate`), delete, master (Wiederholung der Serie lesen, `ruleToRepeat`); Schreibrechte über `writableAccount` (Kalender in eigener Auswahl, `access` owner/writer). App: `EventEditor`/`EventSheet` in `CalendarPage.tsx`, `parseTitle`/`buildTitle`/`eventPersons` in `calendar.ts`. Supabase-Projekt: service_role hat keine Standardrechte, neue Tabellen brauchen explizites `grant … to service_role`. Nächste Schritte K3–K5 siehe ROADMAP.
- **Einkaufsliste:** wird immer frisch berechnet (`src/shopping.ts`). `ShopWeek` speichert removed, checked, hidden und bought (für Nachkauf).

## Stolpersteine
- In Bash `pkill -f`/`pgrep -f` nicht mit einem Muster verwenden, das im eigenen Befehl vorkommt, das beendet die eigene Shell (Exit 144). Für Hintergrundprozesse stattdessen eine PID-Datei verwenden.
- Playwright-Selektoren `:has-text("Kopieren")` treffen auch Knöpfe wie «Kopieren nach …». Lieber eindeutige Selektoren verwenden.
- Den Inhalt aus der Supabase-Dokumentation nicht ungeprüft übernehmen: Ohne eigenes SMTP lassen sich die E-Mail-Vorlagen nicht ändern. Deshalb ist «Confirm email» aus, Anmeldung mit Passwort.
