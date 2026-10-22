# ENTSCHEIDUNGEN – Family-Planner

## E1 – Progressive Web App (PWA) mit React + TypeScript (22.10.2026)
Eine PWA läuft im Handy-Browser, lässt sich auf den Startbildschirm legen und funktioniert offline. Es braucht keinen App-Store und keine Installation auf dem PC. Später kann man sie für den Play Store verpacken.

## E2 – Bauwerkzeug: esbuild statt Vite (22.10.2026)
**Abweichung vom ursprünglichen Plan.** In der Claude-Umgebung lassen sich keine zusätzlichen Pakete herunterladen. esbuild ist dort vorhanden; es ist auch das Werkzeug, das Vite intern verwendet. So kann Claude jede Version vor dem Hochladen selbst bauen und testen. Für Tobias ändert sich nichts. Ein Wechsel auf Vite ist später jederzeit möglich.

## E3 – Eigene kleine Datenbank-Schicht statt Dexie (22.10.2026)
Gespeichert wird wie geplant in IndexedDB, direkt über eine kleine eigene Schicht (`src/db.ts`) statt über Dexie. Grund: Dexie ist in der Claude-Umgebung nicht verfügbar (siehe E2), und für unsere Bedürfnisse genügen rund 100 Zeilen Code. Jeder Datensatz hat `id`, `updatedAt` und `deleted` (Löschmarke), damit später eine Synchronisation möglich ist.

## E4 – Fertige App liegt im Ordner `docs/` (22.10.2026)
Claude baut die App und legt das Ergebnis in `docs/`. GitHub Pages zeigt diesen Ordner direkt an. Es braucht keinen Bau-Prozess auf GitHub, und was Claude getestet hat, ist genau das, was online geht.

## E5 – Hochladen mit GitHub Desktop (22.10.2026)
Claude kann aus Sicherheitsgründen nicht direkt auf GitHub schreiben. Tobias lädt darum mit **GitHub Desktop** hoch: «Commit to main» und dann «Push origin». Das ist ein Programm mit Knöpfen statt Befehlen. Die Datei `hochladen.bat` ist nur noch eine Reserve und funktioniert nur, wenn zusätzlich Git installiert ist.

## E6 – Daten dauerhaft speichern (22.10.2026)
Die App bittet den Browser beim Start, die Daten nicht automatisch zu löschen, wenn der Speicher knapp wird (`navigator.storage.persist`). Die installierte App bekommt das unter Android in der Regel. Eine Sicherung per Export kommt trotzdem noch (Roadmap Schritt 6).

## E7 – Offline-Verhalten (22.10.2026)
Ein Service Worker speichert alle App-Dateien. Ist das Handy online, wird die neuste Version geladen. Ist es offline, wird die gespeicherte Version verwendet. Nach einem Update lädt die App einmal neu.

## E8 – Menü-Mengen werden so gespeichert, wie sie eingegeben wurden (22.10.2026)
Jedes Menü merkt sich die eingegebenen Mengen und dazu den «Bezugsfaktor»: entweder die Summe der Familienfaktoren beim Erstellen (z.B. 2.6) oder den Faktor der gewählten Person (z.B. 0.8). Die Menge pro Faktor 1.0 wird daraus berechnet (Menge ÷ Bezugsfaktor). Vorteil: Beim Bearbeiten siehst du wieder genau deine Zahlen. Ändern sich später die Faktoren in der Familie, bleibt das Rezept trotzdem richtig.

## E9 – Menge darf leer bleiben (22.10.2026)
Zutaten ohne Menge (z.B. Salz, Pfeffer) sind erlaubt und gelten als «nach Bedarf». In der Einkaufsliste erscheinen sie später ohne Mengenangabe.

## E10 – Wochenplan: ein Datensatz pro Tag (22.10.2026)
Jeder geplante Tag wird als eigener Eintrag gespeichert (ID = Datum, z.B. 2026-10-19). Darin stehen die Mahlzeiten mit Gerichten, ob sie entfallen und wer nicht mitisst. Tage ohne Einträge werden nicht gespeichert und zeigen einfach die 3 Standard-Mahlzeiten. Gespeichert wird, wer **nicht** mitisst. So isst eine neu erfasste Person automatisch überall mit.

## E11 – Zwischenmahlzeiten und mehrere Gerichte (22.10.2026)
Mit «+ Mahlzeit» kommt eine zusätzliche Mahlzeit mit eigenem Namen dazu. Znüni wird nach dem Frühstück eingereiht, Zvieri nach dem Mittagessen, alles andere am Ende. Eine Mahlzeit kann mehrere Gerichte haben (z.B. Salat und Hauptgang). Entfällt eine Mahlzeit, bleiben ihre Gerichte gemerkt, zählen aber nicht für den Einkauf.

## E12 – Woche kopieren (22.10.2026)
Eine Woche kann in eine der nächsten 4 Wochen kopiert werden. Hat die Zielwoche schon Einträge, warnt die App und überschreibt erst nach Bestätigung.

