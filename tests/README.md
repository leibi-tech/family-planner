# Automatische Tests (für Claude)

Laufen in der Cloud-Umgebung, nicht auf dem PC. Aufruf im Projektordner: `bash tests/run-all.sh`

- `mock-supabase.mjs` – Nachbau von Supabase (Anmeldung, Tabelle `records` mit «neuere Änderung gewinnt», private Einträge über `owner_id`, Mitgliedschaft).
- `ui-local.mjs` – Notizen und Listen ohne Haushalt (Handy-Format): erfassen, Unterpunkte, abhaken, privat, Pin, löschen.
- `start-page.mjs` – Startseite: Menü heute, ToDos, Angeheftetes, Zuletzt geändert, «Mehr», Zurück-Wege, immer Start beim Öffnen.
- `sync-two.mjs` – zwei simulierte Handys: Liste gleichzeitig ändern (eines offline), Pin für alle, privat bleibt privat.
- `todo-link.mjs` – Notiz/Liste als ToDo anheften, «Notiz öffnen», private ToDos.
- `password.mjs` – «Passwort ändern»: bisheriges Passwort prüfen, zu kurz, ungleich, gleich wie bisher, Erfolg.

Neue Funktionen: passenden Test ergänzen und vor dem Ausliefern alles laufen lassen.
