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

## E12 – Tage und Wochen kopieren (22.10.2026, erweitert in v0.6.0)
Beim Tag gibt es «⧉ Kopieren»: «Kopieren nach …» auf einen oder mehrere Tage, auch in anderen Wochen, oder «Übernehmen von …» einem anderen Tag. Ganze Wochen gehen in jede beliebige Woche, nach vorne oder hinten. Kopiert wird alles: Mahlzeiten, Gerichte, wer mitisst und was entfällt. Hat das Ziel schon Einträge, warnt die App (roter Knopf) und überschreibt erst nach Bestätigung.

## E13 – Einkaufsliste wird immer frisch berechnet (22.10.2026)
Die Artikel aus dem Wochenplan werden nicht gespeichert, sondern bei jedem Öffnen neu berechnet: Menge pro Faktor 1.0 × Summe der Faktoren der Mitessenden, für alle aktiven Mahlzeiten der Woche. Gespeichert werden nur deine Entscheide pro Woche und Artikel: «zu Hause vorhanden» und «abgehakt». Darum aktualisiert sich die Liste bei jeder Planänderung, und deine Entscheide bleiben trotzdem erhalten. Ein Artikel ist eindeutig durch Produktname (Gross-/Kleinschreibung egal) und Einheit. «500 g Mehl» und «1 kg Mehl» erscheinen darum getrennt.

## E14 – Rundung (22.10.2026)
Erst wird zusammengezählt, dann einmal aufgerundet: Stk., Dose, Pck., Bund und Prise auf ganze Zahlen; g und ml auf 10 (unter 10 auf 1); kg und l auf 0.1; EL und TL auf 0.5.

## E15 – Artikel von Hand und wiederkehrende Artikel (22.10.2026)
Artikel, die du von Hand erfasst, gehören zur angezeigten Woche. Wiederkehrende Artikel gelten ab der Woche, in der sie erfasst wurden, und erscheinen jede n-te Woche. Alle Quellen werden zusammengezählt, wenn Produkt und Einheit gleich sind. 1 l Milch von Hand plus 0.5 l aus dem Plan ergibt also 1.5 l. Die Liste ist alphabetisch sortiert, so fallen Doppelte mit verschiedener Einheit auf. Reine Hand-Artikel haben ein ✕ zum Löschen statt 🏠.

## E16 – Vorschläge beim Tippen (22.10.2026)
Jeder von Hand erfasste Artikel wird als Vorschlag gemerkt, mit der zuletzt verwendeten Menge, Einheit und Sparte. Beim Tippen erscheinen passende Vorschläge: zuerst die, die mit dem Getippten beginnen, dann die meistgenutzten. Mit ✕ wird ein Vorschlag gelöscht. Erfasst man das Produkt später wieder von Hand, wird es erneut als Vorschlag gemerkt.

## E17 – Erledigte ausblenden (22.10.2026)
«Erledigte ausblenden» blendet abgehakte Artikel dieser Woche aus. Artikel aus Plan und Wiederholung bleiben gespeichert, nur ausgeblendet; mit «Ausgeblendete wieder anzeigen» kommen sie zurück. Hand-Artikel werden dabei gelöscht.

## E18 – Widgets bedeuten: Phase 3 mit Capacitor statt TWA (22.10.2026, Vorentscheid)
Eine Web-App (PWA) kann unter Android keine Startbildschirm-Widgets anzeigen. Widgets sind nur mit einer echten Android-App möglich. Darum soll die App in Phase 3 mit **Capacitor** verpackt werden, nicht als TWA: Capacitor erlaubt es, zusätzlich ein kleines natives Widget zu bauen, das die Daten aus der Cloud (Phase 2) liest. Am bisherigen Aufbau muss dafür nichts geändert werden.

## E19 – Keine separate Datensicherung vor Phase 2 (22.10.2026)
Ab Phase 2 liegen die Daten zusätzlich in der Cloud. Eine Synchronisation schützt aber nicht vor versehentlichem Löschen. Darum kommt später ein einfacher Export-Knopf dazu (Wunschliste Schritt 7).

## E20 – Einkaufsliste nach Sparte getrennt (22.10.2026)
Oben in «Einkauf» schaltet man zwischen «Lebensmittel» und «Anderes» um. Die Zahl zeigt, wie viele Artikel dort noch offen sind. So kauft man im Laden nacheinander ein. Neue Artikel kommen automatisch in die gewählte Sparte. Die App merkt sich die zuletzt gewählte Sparte auf dem Gerät.

## E21 – Cloud: Supabase, mehrfamilienfähig von Anfang an (22.10.2026)
- **Dienst:** Supabase, Server in der Schweiz (Zürich), wegen Schweizer Datenschutzgesetz und DSGVO.
- **Haushalte:** Jede Familie ist ein «Haushalt». Beitreten geht nur mit einem 6-stelligen Einladungscode. Sicherheitsregeln in der Datenbank (Row Level Security) sorgen dafür, dass jedes Konto nur die Daten seines Haushalts sieht. Damit ist die App ohne Umbau bereit für den Play Store.
- **Eine Tabelle für alles:** Alle App-Daten liegen in einer einzigen Tabelle `records` (Haushalt, Art, ID, Inhalt, Änderungszeit, Löschmarke). So kommen neue Funktionen wie Kalender oder Aufgaben ohne Änderung an der Datenbank dazu.
- **Konflikte:** Die neuere Änderung gewinnt. Das prüft die Datenbank selbst, eine ältere Änderung überschreibt nie eine neuere.
- **Anmeldung:** Mit E-Mail und Passwort, ohne Bestätigungsmail («Confirm email» ausgeschaltet). Geändert am 22.10.2026: Ursprünglich war ein Code per E-Mail geplant. Supabase erlaubt eigene E-Mail-Vorlagen aber nur mit einem eigenen E-Mail-Dienst (SMTP), und der eingebaute Dienst verschickt nur wenige Mails und nur an Projekt-Mitglieder. Für die Veröffentlichung im Play Store wird später ein E-Mail-Dienst eingerichtet (z.B. Brevo, gratis), dann gibt es auch «Passwort vergessen» und Bestätigungsmails.
- **Ohne Zusatzpakete:** Die App spricht direkt mit der Supabase-Schnittstelle, ohne Supabase-Bibliothek. In der Claude-Umgebung lassen sich keine Pakete laden (siehe E2).

## E22 – So funktioniert der Abgleich (22.10.2026)
- Jede lokale Änderung wird als «noch hochzuladen» markiert. Beim Abgleich wird zuerst hochgeladen, dann werden die Änderungen der anderen geholt. Geholt wird nur, was seit dem letzten Abgleich auf dem Server geändert wurde.
- Abgeglichen wird automatisch: 1.5 Sekunden nach jeder Änderung, beim Öffnen der App, wenn das Internet zurückkommt und alle 30 Sekunden, solange die App offen ist. Echtzeit, also sofort ohne Warten, kann später dazukommen.
- Gibt es zwei Änderungen am selben Eintrag, gewinnt die neuere. Ein Plan-Tag zählt dabei als ein Eintrag.
- Beim **Erstellen** eines Haushalts werden die Daten des Handys hochgeladen. Beim **Beitreten** werden die Daten des Handys durch die des Haushalts ersetzt, damit keine doppelten Personen entstehen.
- Abmelden lässt die Daten auf dem Handy, beendet aber den Abgleich.

