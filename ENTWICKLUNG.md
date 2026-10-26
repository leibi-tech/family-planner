# ENTWICKLUNG – Notizen für Claude (technisch)

Diese Datei ist für Claude: So wird in einer neuen Sitzung weitergearbeitet. Tobias muss sie nicht lesen.

## Ablauf jeder Sitzung
1. ROADMAP.md lesen (Projekt-Dokument oder im verbundenen Ordner `C:\Users\tleibacher\Claude\Family-Planner`) und kurz vorschlagen, was als Nächstes kommt.
2. Code holen: Der Quellcode liegt im verbundenen Ordner. Mit `device_list_dir` auflisten und `src/`, `public/`, `scripts/`, `package.json`, `tsconfig.json` und `supabase/` per `device_stage_files` in den Container kopieren, z.B. nach `/home/claude/family-planner`. `docs/` muss nicht mit, das wird neu gebaut.
3. Bauen im Container:
   - `ln -sfn /opt/npm-tools/node_modules node_modules` (enthält esbuild, react, react-dom)
   - `node scripts/build.mjs` baut nach `docs/`
   - Version in `package.json` vor jedem Build erhöhen
   - npm, Supabase und github.io sind im Container gesperrt. Es gibt kein npm install.
4. Testen:
   - Playwright liegt in `/opt/npm-tools/node_modules/playwright/index.mjs`, Chromium ist vorinstalliert
   - Testbuild gegen einen Supabase-Nachbau: `SUPABASE_URL=http://localhost:8766 OUT_DIR=docs-test node scripts/build.mjs`, dann mit `python3 -m http.server` unter `/family-planner/` ausliefern
   - Den Nachbau (`mock-supabase`, Node, in-memory: Auth, `records` mit LWW, RPCs) bei Bedarf neu schreiben. Er muss das Verhalten von `supabase/schema.sql` nachbilden.
   - SQL lokal prüfen: PostgreSQL 16 ist installiert (`/usr/lib/postgresql/16/bin`). Datenverzeichnis unter `/var/tmp` als User `postgres` anlegen, Port 5433. Supabase-Teile nachbilden: `auth.users`, `auth.uid()` über `current_setting('request.jwt.claim.sub')`, Rolle `authenticated`.
5. Ausliefern:
   - Geänderte Dateien nach `/mnt/user-data/outputs/family-planner/<pfad>` kopieren und mit `device_commit_files` (force) in den Ordner schreiben
   - **Danach immer mit `md5sum` im Container und per `device_bash` auf dem Gerät vergleichen.** Am 22.10. kam einmal eine `app.js` nicht an.
   - `docs/*` immer vollständig mitschicken: app.js, app.css, index.html, sw.js
6. Tobias lädt mit GitHub Desktop hoch (Summary, «Commit to main», «Push origin»). GitHub Pages liefert aus `main` / `docs`.
7. ROADMAP.md, ENTSCHEIDUNGEN.md und ANLEITUNG.md aktualisieren: im Ordner **und** im Projekt (`project_write` auf `claude/…`).

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
- **Einkaufsliste:** wird immer frisch berechnet (`src/shopping.ts`). `ShopWeek` speichert removed, checked, hidden und bought (für Nachkauf).

## Stolpersteine
- In Bash `pkill -f`/`pgrep -f` nicht mit einem Muster verwenden, das im eigenen Befehl vorkommt, das beendet die eigene Shell (Exit 144). Für Hintergrundprozesse stattdessen eine PID-Datei verwenden.
- Playwright-Selektoren `:has-text("Kopieren")` treffen auch Knöpfe wie «Kopieren nach …». Lieber eindeutige Selektoren verwenden.
- Den Inhalt aus der Supabase-Dokumentation nicht ungeprüft übernehmen: Ohne eigenes SMTP lassen sich die E-Mail-Vorlagen nicht ändern. Deshalb ist «Confirm email» aus, Anmeldung mit Passwort.
