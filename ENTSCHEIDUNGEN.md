# ENTSCHEIDUNGEN – Family-Planner

## E1 – Progressive Web App (PWA) mit React + TypeScript (22.10.2026)
Eine PWA läuft im Handy-Browser, lässt sich auf den Startbildschirm legen und funktioniert offline. Es braucht keinen App-Store und keine Installation auf dem PC. Später kann man sie für den Play Store verpacken.

## E2 – Bauwerkzeug: esbuild statt Vite (22.10.2026)
**Abweichung vom ursprünglichen Plan.** In der Claude-Umgebung lassen sich keine zusätzlichen Pakete herunterladen. esbuild ist dort vorhanden; es ist auch das Werkzeug, das Vite intern verwendet. So kann Claude jede Version vor dem Hochladen selbst bauen und testen. Für Tobias ändert sich nichts. Ein Wechsel auf Vite ist später jederzeit möglich.

## E3 – Eigene kleine Datenbank-Schicht statt Dexie (22.10.2026)
Gespeichert wird wie geplant in IndexedDB, direkt über eine kleine eigene Schicht (`src/db.ts`) statt über Dexie. Grund: Dexie ist in der Claude-Umgebung nicht verfügbar (siehe E2), und für unsere Bedürfnisse genügen rund 100 Zeilen Code. Jeder Datensatz hat `id`, `updatedAt` und `deleted` (Löschmarke), damit später eine Synchronisation möglich ist.

## E4 – Fertige App liegt im Ordner `docs/` (22.10.2026)
Claude baut die App und legt das Ergebnis in `docs/`. GitHub Pages zeigt diesen Ordner direkt an. Es braucht keinen Bau-Prozess auf GitHub, und was Claude getestet hat, ist genau das, was online geht.

## E5 – Hochladen per Doppelklick (`hochladen.bat`) (22.10.2026)
Claude kann aus Sicherheitsgründen nicht direkt auf GitHub schreiben. Tobias lädt darum mit einem Doppelklick auf `hochladen.bat` hoch. Auf dem PC braucht es dafür nur Git.

## E6 – Daten dauerhaft speichern (22.10.2026)
Die App bittet den Browser beim Start, die Daten nicht automatisch zu löschen, wenn der Speicher knapp wird (`navigator.storage.persist`). Die installierte App bekommt das unter Android in der Regel. Eine Sicherung per Export kommt trotzdem noch (Roadmap Schritt 6).

## E7 – Offline-Verhalten (22.10.2026)
Ein Service Worker speichert alle App-Dateien. Ist das Handy online, wird die neuste Version geladen. Ist es offline, wird die gespeicherte Version verwendet. Nach einem Update lädt die App einmal neu.
