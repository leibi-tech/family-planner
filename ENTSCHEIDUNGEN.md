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

## E23 – Nachkauf in der Einkaufsliste (22.10.2026)
Beim Abhaken merkt sich die App die gekaufte Menge. Braucht der Plan später mehr, z.B. weil am Donnerstag nochmals Beeren eingeplant werden, erscheint der Artikel wieder offen, aber nur mit der **zusätzlichen** Menge («+ 200 g») und dem Hinweis «Nachkauf · 200 g schon gekauft». Das gilt auch für ausgeblendete Artikel. Beim erneuten Abhaken wird die neue Gesamtmenge als gekauft gemerkt.

## E26 – Eigener Faktor fest, Eingabe per Tastatur (v0.9.2, 23.10.2026)
- **Eigener Faktor:** Man selbst ist immer 1.0 und kann den eigenen Faktor nicht ändern, nur den Namen. Grund: Bei der Anzeige «aus eigener Sicht» (E24) verschoben sich sonst alle anderen Faktoren.
- **Eingabe:** Faktor mit − / + (Schritt 0.05) oder direkt per Tastatur (Komma oder Punkt). Gerundet wird auf 0.05, erlaubt sind 0.05 bis 3.0.
- **Reparatur:** Hatte der Ersteller (Rolle «owner») seinen eigenen Faktor verändert, rechnet die App beim Öffnen von «Familie» einmal alles um: Ersteller = 1.0, die anderen auf 0.05 gerundet (z.B. 1.01 → 1.0, 0.61 → 0.6). Die Mengen-Bezüge aller Menüs werden im gleichen Verhältnis angepasst, damit die Rezepte stimmen. Andere Mitglieder lösen das nie aus, weil ihr gespeicherter Faktor normalerweise nicht 1.0 ist.

## E25 – Menü-Import aus Text oder Link (v0.9.0, 23.10.2026)
- **Ablauf:** Bei «Menüs» → «⤓ Importieren» einen Link oder den Rezepttext einfügen. Die App erkennt Titel, Personenzahl, Zutaten und Zubereitung und öffnet «Import prüfen». **Gespeichert wird erst mit «Speichern».** «Abbrechen» führt zurück zum eingefügten Text.
- **Kontrolle:** Unter jeder Zutat steht die Originalzeile. ⚠️ markiert, was unsicher ist (z.B. «1–2 Knoblauchzehen», «2 Zehen Knoblauch»).
- **Erkennung:** dl und cl werden in ml umgerechnet. Bei Bereichen («1–2») gilt die obere Zahl, damit es sicher reicht. Mengenwörter wie Zehe, Scheibe, Becher werden zu «Stk.», das Wort bleibt im Produktnamen. «(ca. 400 g)» wird nicht umgerechnet, die Stückzahl gilt. «Salz, Pfeffer» gibt zwei Zutaten ohne Menge. Backpapier, Alufolie, Zahnstocher usw. kommen in die Sparte «Anderes». Der Text wird nur auf dem Handy ausgewertet.
- **Mengen-Bezug «Portionen»:** Neuer dritter Bezug neben «Ganze Familie» und «1 Portion von …»: «Für n Portionen à meine Portion». Ohne Angabe im Rezept gelten 4 Portionen. Der Knopf erscheint nur bei importierten Menüs.
- **Portion aus eigener Sicht (v0.9.1):** Eine Portion entspricht dem Faktor der Person, die das Menü erfasst oder bearbeitet (wie bei den Faktoren, E24). Gespeichert wird `baseFactor = Portionen × eigener Faktor`. Beispiel: Thadea (0.8) übernimmt «500 g für 4 Portionen» → ihre Portion 125 g, Tobias bekommt 156 g (500 ÷ 3.2). Öffnet Thadea ein Menü von Tobias, sieht sie die Portionen und «Meine Portion» aus ihrer Sicht umgerechnet.
- **«Meine Portion» (v0.9.1):** Bei der Hauptzutat (oberste Zutat mit Menge) steht «Meine Portion Spaghetti: 125 g ✎». Gibt man dort z.B. 150 g ein, berechnet die App die Portionenzahl neu (500 ÷ 150 = 3.33). Die Mengen im Rezept bleiben stehen, alle Zutaten werden im gleichen Verhältnis für den Einkauf umgerechnet.
- **Link-Import:** Die App darf fremde Webseiten nicht selbst abrufen (Browser-Sperre). Darum holt eine kleine Supabase-Funktion (`supabase/functions/rezept-import`) die Seite und liest die maschinenlesbaren Rezeptangaben, die viele Rezeptseiten für Google enthalten (schema.org/Recipe). Nur angemeldete Konten dürfen die Funktion nutzen; die Prüfung macht die Funktion selbst, darum ist «Verify JWT» ausgeschaltet. Findet die Seite kein Rezept, kommt der Hinweis, den Text zu kopieren.
- **Nicht gemacht:** Keine ganze Rezept-Datenbank herunterladen (keine passende freie Quelle auf Deutsch, Nutzungsbedingungen von Fooby & Co.). Stattdessen später eigene Menü-Vorlagen.

## E24 – Rollen, Personen und Beitritt (v0.8.0, 23.10.2026)
- **Konto und Person:** Jedes Konto ist genau einer Person der Familie zugeordnet («Wer bist du?»). Eine Person kann nur zu einem Konto gehören.
- **Beitritt:** Nur mit Einladungscode **und** dem Vornamen einer erfassten, noch freien Person. Bei einem Fehler erscheint immer «Code oder Name falsch», damit niemand herausfinden kann, welcher Teil falsch war.
- **Rollen:** Der Ersteller ist Admin und bleibt es immer. Er kann weitere Admins ernennen. Nur Admins dürfen Personen und Faktoren ändern, den Einladungscode sehen oder neu erzeugen, Mitglieder mit E-Mail sehen, Personen zuordnen und Mitglieder entfernen. Das wird in der Datenbank erzwungen (Sicherheitsregeln und Funktionen), nicht nur in der App.
- **Faktoren aus eigener Sicht:** Gespeichert wird wie bisher ein Faktor pro Person. Angezeigt wird er geteilt durch den eigenen Faktor, so ist man selbst immer 1.0. Beispiel aus Thadeas Sicht: Tobias 1.25, Thadea 1.0, Kinder 0.5. An den Einkaufsmengen ändert das nichts, weil nur die Verhältnisse zählen.
- **Datenbank-Update:** `supabase/update-0.8.sql`, ist auch in `schema.sql` enthalten.

## E28 – ToDos und Ämtli-Plan (v0.10.0, 26.10.2026)
- **Neuer Menüpunkt «ToDo»** (5. Knopf unten) mit zwei Teilen: «ToDos» und «Ämtli-Plan».
- **Zuweisen:** an alle Personen der Familie (auch Kinder ohne Konto), mehrere pro ToDo möglich. Erledigt, sobald jemand abhakt; angezeigt wird, wer abgehakt hat.
- **Meine / Alle:** «Meine» = mir zugewiesen, oder von mir erfasst und niemandem zugewiesen, oder privat. Ohne Haushalt gilt die erste Person der Familie als «ich».
- **Privat:** nur für die erfassende Person sichtbar, darum keine Zuweisung an andere. Geschützt wird in der Datenbank (Spalte `owner_id`, Sicherheitsregel), nicht nur in der App: Die anderen Handys bekommen private Einträge gar nie. Beim Umschalten privat ↔ Familie entsteht ein neuer Eintrag, der alte wird ohne Inhalt gelöscht, damit keine Kopie auf anderen Handys bleibt.
- **Ämtli:** Wiederholung «jede Woche» bis «alle 8 Wochen», Wochentag = Tag des ersten Termins. Zuweisung: offen (wer Zeit hat), fix (alle gewählten) oder abwechselnd (Reihenfolge beim Antippen). Zu Beginn der fälligen Woche wird das Ämtli automatisch als ToDo eröffnet (feste ID pro Ämtli und Woche, darum keine Doppelten mit zwei Handys; mit kleinem Zeitstempel, damit «erledigt» auf einem anderen Handy immer gewinnt). War die App länger zu, werden bis 3 Wochen nachgeholt.
- **Unerledigte Ämtli** bleiben offen und werden rot als «überfällig» markiert. Das nächste Mal kommt trotzdem normal.
- **Ämtli ändern** passt offene Ämtli-ToDos ab dieser Woche an; **Ämtli löschen** entfernt offene, erledigte bleiben in der Übersicht.
- **Übersicht pro Person:** pro Woche, wer welches Ämtli erledigt hat (z.B. fürs Sackgeld). Dort kann man auch abhaken.
- **Erledigte:** rutschen nach unten, «Erledigte ausblenden» (merkt sich das Handy) und «Erledigte löschen». Erledigte Ämtli-ToDos verschwinden dabei nur aus der Liste, nicht aus der Übersicht.
- **Pro Person (v0.10.2):** Unter «Meine / Alle» je ein Knopf pro andere Person. Gezeigt wird, was dieser Person zugewiesen ist, ohne private ToDos. Private der anderen sind ohnehin nicht auf dem Handy (Datenbank-Regel); eigene private erscheinen nur unter «Meine». Ein neues ToDo in dieser Ansicht wird der Person zugewiesen.
- **Zähler:** rote Zahl am ToDo-Knopf = meine offenen ToDos.

## E29 – Notizen und Listen (v0.11.0, 26.10.2026)
- **Eine Art «Notiz» mit zwei Formen:** Notiz (Titel + Text) und Liste (Punkte zum Abhaken, Unterpunkte nur eine Ebene tief). Neuer Menüpunkt «Notizen» (6. Knopf unten, «Wochenplan» heisst dort kurz «Plan»).
- **Öffentlich oder privat:** Standard ist für die Familie sichtbar. Das Schloss oben rechts stellt auf privat um. Gleiche Technik wie bei den ToDos (Spalte `owner_id`, Sicherheitsregel in der Datenbank), darum **kein neues Datenbank-Update**. Beim Wechsel entsteht ein neuer Eintrag, der alte wird ohne Inhalt gelöscht, damit nichts Privates bei den anderen oder nichts Geteiltes im alten Eintrag liegen bleibt.
- **Anheften:** pro Person gespeichert (`pins`: Person → an/aus mit Zeitpunkt). «Für alle anheften» setzt es für alle aktuell erfassten Personen; jede Person löst es nur bei sich. Später neu erfasste Personen sind nicht automatisch angeheftet. Private Einträge: nur für mich.
- **Zusammenführen statt überschreiben:** Eine Liste ist ein Datensatz. Würde die neuere Fassung die ältere ersetzen, ginge z.B. «Brot abgehakt» (im Laden) verloren, wenn zuhause gleichzeitig «Milch» ergänzt wird. Darum hat jeder Punkt eine eigene Änderungszeit; beim Abgleich werden beide Fassungen punktweise vereinigt (neuere Änderung pro Punkt gewinnt, Löschungen bleiben als Vermerk). Dasselbe pro Pin. Vor dem Hochladen holt die App die Serverfassung der geänderten Listen und führt zusammen (`fetchRecords`, `mergeNotesWithServer` in `sync.ts`), beim Herunterladen ebenfalls. Titel und Text einer Notiz: die neuere Fassung gewinnt (kein Zeichen-genaues Zusammenführen).
- **Speichern:** automatisch (Text nach 0.6 s Pause und beim Verlassen, Listenpunkte sofort). Änderungen werden nacheinander gespeichert und immer auf die neueste gespeicherte Fassung angewendet.
- **Editor als Seite, nicht als Fenster:** Die Menüleiste unten bleibt sichtbar (Regel für alle Seiten).
- **Als ToDo anheften (v0.11.1):** Eine Notiz/Liste kann als ToDo angeheftet werden (✅). Das ToDo hat den Titel der Notiz und `noteId` als Link zurück. «Nur für mich» = mir zugewiesen, «Für alle» = offen (wer Zeit hat); Datum optional; private Notiz = privates ToDo ohne Rückfrage. Die ToDos sind danach unabhängig: Erledigen des ToDos ändert die Liste nicht und umgekehrt. Wechselt die Notiz zwischen privat und geteilt (neue ID), wird `noteId` aller ToDos darauf nachgeführt. Ist die Notiz nicht mehr sichtbar (gelöscht oder für andere privat geworden), zeigt das ToDo «Notiz nicht mehr verfügbar».

## E30 – Startseite und Menüleiste (v0.12.0, 26.10.2026)
- **Startseite als erste Seite:** Die App öffnet immer auf «Start» (statt auf der zuletzt benutzten Seite). Inhalt nach Tobias' Wunsch: «Was kochen wir heute?» (Menü antippen öffnet es), Meine ToDos, angeheftete Notizen/Listen, zuletzt geänderte Notizen/Listen. Später kommt der Kalender dazu. Einkaufsliste bewusst nicht dabei (nicht gewünscht).
- **Menüleiste: 5 Knöpfe** (Start, Einkauf, ToDo, Notizen, Mehr). Start ist hervorgehoben (Pille hinter dem Symbol). Wochenplan, Menüs und Familie liegen unter «Mehr»; dort bleibt «Mehr» aktiv und oben links erscheint ein Zurück-Pfeil. 7 Knöpfe wären zu schmal zum Treffen gewesen. Der Wochenplan ist auch über «Plan ›» auf der Startseite erreichbar.
- **Direkt öffnen mit Rückweg (`src/nav.ts`):** Die Startseite (und das ToDo zu einer Notiz) bittet die App, ein Menü, ToDo oder eine Notiz zu öffnen. Die Zielseite holt die Anfrage ab, sobald ihre Daten geladen sind; nach dem Schliessen führt die App zur Ausgangsseite zurück. Zum Beispiel: Start → Menü → Schliessen → Start.
- **Angeheftete Listen:** erste 5 offene Punkte zum direkten Abhaken (Änderung wird wie in der Liste punktweise zusammengeführt, E29). Das ✕ setzt nur den eigenen Pin zurück («jeder nimmt es bei sich selbst weg»).

## E31 – Passwort ändern, danach «Passwort vergessen» (v0.13.0, 26.10.2026)
- **Zwei Schritte, auf Wunsch von Tobias:** Zuerst «Passwort ändern» (angemeldet, braucht keinen E-Mail-Dienst), danach «Passwort vergessen» mit E-Mail-Dienst. So kann man den ersten Teil sofort auf dem Handy testen.
- **Ablauf «ändern»:** Die App prüft zuerst das bisherige Passwort (Anmeldung im Hintergrund, die Sitzung wird dabei erneuert), setzt dann das neue (`PUT /auth/v1/user`). Warum die Rückfrage: Wer ein entsperrtes Handy findet, soll das Passwort nicht ändern können. Regeln: neues Passwort mind. 8 Zeichen (Supabase selbst verlangt nur 6), muss anders sein als das bisherige, zweimal eingeben. Die Anmeldung auf den anderen Handys bleibt bestehen.
- **Wo:** Karte «Gemeinsam nutzen» (Familie), unten, mit und ohne Haushalt.
- **Noch offen («vergessen»):** Supabase verschickt Mails nur über einen eigenen E-Mail-Dienst (SMTP) zuverlässig (siehe E21). Geplant: Brevo (gratis), Absenderadresse bestätigen, SMTP-Daten in Supabase eintragen, unter URL Configuration die App-Adresse als Weiterleitung erlauben. In der App: Link «Passwort vergessen?» beim Anmelden, Mail mit Link, Bildschirm «Neues Passwort».

## E32 – Kalender mit Google, Schritt K1: verbinden und ansehen (v0.14.0, 26.10.2026)
- **Entscheide Tobias:** Jede Person verbindet ihr **eigenes Google-Konto**. Kinder- und gemeinsame Termine liegen in einem **Google-Familienkalender**, den beide ändern dürfen. Ändern nur **mit Internet** (ansehen geht offline). Wiederkehrende Termine später mit «nur diesen» und «alle».
- **Aufbau:** Die Supabase-Funktion `google-kalender` erledigt alles mit Google. Sie tauscht nach der Google-Anmeldung den Code gegen einen dauerhaften Schlüssel (refresh_token) und speichert ihn in der Tabelle `google_accounts`. Diese Tabelle hat Sicherheitsregeln ohne Erlaubnis: Die App kann sie nie lesen, nur die Funktion mit dem Server-Schlüssel. Der Schlüssel verlässt den Server nie.
- **Rücksprung sicher:** Die Anmeldung trägt einen signierten Vermerk (Konto, Haushalt, Rücksprung-Adresse, 30 Minuten gültig). Zurück geht es nur auf die App-Adresse (GitHub Pages) oder localhost.
- **Termine nicht in der gemeinsamen Datenbank:** Jedes Handy holt die Termine aller verbundenen Konten des Haushalts direkt über die Funktion und legt eine Kopie auf dem Gerät ab (offline sichtbar). So ist Google immer die einzige Quelle, es gibt keine doppelten Stände. Geholt werden beim Öffnen 8 Monate (Vormonat bis +6), beim Blättern 3 Monate, aufgefrischt alle 5 Minuten.
- **Personen:** Ein Kalender «Mein Kalender» gehört der Person, der das Konto zugeordnet ist («Wer bist du?»). «Familie» = gemeinsamer Kalender; wird er von beiden gewählt, liest die Funktion ihn nur einmal, bevorzugt mit dem eigenen Zugang. Farben pro Person fest, Familie grün.
- **Google-Rechte:** nur «Termine sehen und bearbeiten» (`calendar.events`) und «Kalenderliste lesen» (`calendar.calendarlist.readonly`), nicht der volle Kalenderzugriff. App «in Produktion», nicht geprüft (Hinweis «nicht überprüft» einmalig, bis 100 Personen).
- **Platz in der App:** vorerst unter «Mehr» → «Kalender». Auf der Startseite kommt er in Schritt K5.
- **Läuft eine Verbindung ab** (z.B. Passwort bei Google geändert), sehen die anderen weiterhin ihre Termine und einen Hinweis «Verbindung … abgelaufen, bitte neu verbinden».

## E33 – Kalender K2: Termine erfassen, ändern, löschen (v0.15.0, 26.10.2026)
- **Entscheide Tobias:** einfache Wiederholungen (keine, täglich, wöchentlich, alle 2 Wochen, monatlich, jährlich, optional «bis»); betroffene Personen **im Titel** («[Kind 1] Turnen»); auch bei eigenen Terminen Kinder wählbar; Erinnerungen = Google-Standard.
- **Wer darf was:** Ändern nur in Kalendern aus der **eigenen** Auswahl (eigener Kalender, Familienkalender mit eigenem Zugang) und nur, wenn Google Schreibrechte gibt (Rolle owner/writer, beim Speichern der Auswahl gemerkt). Die Funktion prüft das selbst. Fremde Termine: Hinweis «kann nur … ändern» (Rückfrage folgt in K4). Nur online.
- **Personen im Titel:** Die App liest «[Name, Name] Titel» nur, wenn alle Namen bekannten Personen entsprechen; sonst bleibt der Titel unverändert. Eigener Kalender: Besitzer immer dabei (nicht im Titel). Familienkalender ohne Namen oder mit allen Personen = ganze Familie. Der Filter zeigt einen Termin, solange eine betroffene Person eingeblendet ist.
- **Zeiten:** Termine mit Zeit werden mit Zeitzone Europe/Zurich an Google geschickt (wichtig für Serien über die Zeitumstellung). Ganztägig: Ende in Google = Folgetag.
- **Serien:** «Nur diesen» ändert/löscht den einzelnen Termin (Google merkt sich die Ausnahme). «Alle» ändert die Vorlage der Serie: Die Verschiebung des angetippten Termins (in Tagen) wird auf den Serienbeginn übertragen, Uhrzeit und Dauer neu gesetzt; gelöschte Einzeltermine (EXDATE) bleiben erhalten. Kompliziertere Google-Regeln (mehrere Wochentage, Anzahl) zeigt die App als «Wie bisher» und ändert sie nicht, ausser man wählt eine neue.
- **Termine verschieben zwischen Kalendern** geht nicht (beim Ändern ist der Kalender fest); dafür löschen und neu erfassen.

## E34 – Arbeiten von unterwegs mit Claude Code (28.10.2026)
- **Wunsch Tobias:** Ideen und Änderungen auch vom Handy aus eingeben, ohne dass der PC läuft.
- **Lösung:** Claude Code im Web / in der Claude-App, direkt mit dem GitHub-Repository verbunden. Die Projekt-Regeln stehen neu in `CLAUDE.md` im Repository (die Anweisungen des claude.ai-Projekts sieht Claude Code nicht).
- **Ablauf:** Claude Code arbeitet auf einem eigenen Branch und macht einen Pull Request; Tobias merged ihn in der GitHub-App. Damit gibt es eine Kontrolle, bevor die App sich ändert. Immer nur ein offener Pull Request, weil `docs/` bei jedem Build neu entsteht.
- **Ideen-Eingang:** `IDEEN.md`. Ideen werden nur notiert, gebaut wird erst nach Zustimmung.
- **Gleichzeitig weiter mit Cowork am PC:** Vor jeder Cowork-Sitzung den Ordner mit GitHub abgleichen (Pull). `hochladen.bat` holt vor dem Hochladen den Stand von GitHub.
- **Tests:** `tests/pw.mjs` findet Playwright in beiden Umgebungen; `run-all.sh` holt die Abhängigkeiten per npm, wenn sie nicht vorinstalliert sind.
- **Massgebend** für ROADMAP, ENTSCHEIDUNGEN, ANLEITUNG ist das Repository; das claude.ai-Projekt wird in Cowork-Sitzungen nachgeführt.

## E35 – Kalender K3: Monat / Woche / Tag, Farben (v0.16.0, 28.10.2026)
- **Wunsch Tobias:** Termine mit mehreren Personen in allen Farben; mit allen Personen grün (Familie). Drei Ansichten Monat / Woche / Tag, jeder Tipp darauf springt auf heute.
- **Entscheide Tobias:** Woche als Liste (7 Tage untereinander, auf dem Handy lesbar statt 7 schmale Spalten); Tag als Zeitraster mit einer Spalte pro Person (= K3, Überschneidungen sehen); letzte Ansicht wird gemerkt (nur auf dem Gerät, `localStorage`).
- **Farben:** Eine Farbe pro betroffener Person, als harte Streifen (Balken im Monat: nebeneinander; Streifen in Listen: übereinander). Betrifft ein Termin niemand Bestimmten oder alle Personen der Familie → nur Familien-Grün; Anzeige «Familie (alle)».
- **Tagesansicht:** Spalten = eingeblendete Personen aus dem Filter (+ Familie). Ein Termin erscheint in der Spalte jeder betroffenen Person. Gleichzeitige Termine einer Person liegen nebeneinander. Ganztägige oben, Start beim ersten Termin bzw. 7 Uhr.
- **Tests:** Die Cloud-Umgebung hat Playwright fest unter `/opt/node-tools`; `run-all.sh` setzt die Zeitzone Europe/Zurich, damit Testzeiten und Browser übereinstimmen.

## E36 – Kalender K4 + K5: Betreuung, Rückfrage, Startseite (v0.17.0, 28.10.2026)
- **Entscheide Tobias (alle Vorschläge angenommen):** Eltern = Personen mit eigenem Google-Kalender, Kinder = alle anderen. Warnung, wenn beide Eltern gleichzeitig einen Termin mit Uhrzeit haben; ganztägige zählen nicht; keine Warnung, wenn alle Kinder bei einem der Termine dabei sind. Anzeige auf der Startseite (14 Tage) und im Kalender (⚠️/✅). Betreuung: «Jemand betreut» (Name) oder «Kinder gehen mit» (Elternteil) + Notiz. Rückfrage als ToDo. Startseite: Termine heute und morgen.
- **Technik:** Neue Tabelle `care` in der gemeinsamen Datenbank (gleiche Tabelle `records` in Supabase, darum kein Update nötig; IndexedDB Version 8). Schlüssel = die beteiligten Google-Termine (Kalender + Termin-ID, bei Serien die ID des einzelnen Termins). Gespeichert wird auch Beginn/Ende beim Erfassen: weicht das ab → «Termin geändert»; gibt es die Überschneidung nicht mehr → Hinweis «verschoben oder gelöscht», Betreuung löschen.
- **v0.17.1 (Rückmeldung Tobias):** Eltern = Personen mit eigenem **App-Konto** (Mitgliederliste, offline als Kopie) **oder** eigenem Google-Kalender. Vorher zählte nur der Google-Kalender, darum fehlte die Warnung, solange Thadea nicht verbunden war.
- Ein Termin mit beiden Eltern (z.B. «[Frau] Essen» im eigenen Kalender) zählt auch als «beide weg». Gilt vorerst für genau 2 Eltern.
- **Rückfrage:** ToDo «Rückfrage: Titel (Datum)» an die Besitzerin des Kalenders, mit `eventRef` → Knopf «Termin öffnen» (Tagesansicht + Termin). Keine Push-Nachricht; das ToDo erscheint beim Abgleich.

## E37 – Dokumente auf dem eigenen NAS (Machbarkeitstest v0.18.0, 30.10.2026)
- **Wunsch Tobias:** Versicherungsdokumente, Garantiescheine, Quittungen in der App. Heikle Daten sollen beim eigenen Synology NAS (DS220j, 512 MB) bleiben. Die App soll Fotos/PDFs direkt hochladen und anzeigen (Variante B). Anmeldung beim NAS wie beim Kalender.
- **Lösung:** Die App spricht direkt mit der DSM Web API (SYNO.API.Auth, SYNO.FileStation.*), angemeldet mit einem eigenen NAS-Konto (nur File Station, nur Ordner `Familien-Dokumente`, 2-Faktor mit OTP). Sitzung (`sid`) und Gerätekennung (`did`, damit der Code nur einmal nötig ist) bleiben im `localStorage` des Handys. Passwort wird nicht gespeichert. Nichts davon geht an Supabase.
- **Warum ein Hilfsprogramm:** Der Browser lässt die App (github.io) nur auf den NAS zugreifen, wenn dieser eine Freigabe (CORS-Header) mitschickt. DSM kann das nicht von sich aus, auch der DSM-Reverse-Proxy setzt nur Header zur Anfrage, nicht zur Antwort. Darum ein nginx-Container (`nas/`, ca. 5–10 MB): leitet nur `/webapi/entry.cgi` an DSM (https://nas:5001) weiter und ergänzt die Freigabe nur für `https://leibi-tech.github.io`. DSM-Oberfläche ist darüber nicht erreichbar. Erreichbar über DSM-Reverse-Proxy (HTTPS, Let's Encrypt, Port 8443) und Portweiterleitung. QuickConnect geht dafür nicht.
- Alle Anfragen sind «einfache» Anfragen (GET, POST mit Formular/Multipart, `_sid` in der Adresse), damit der Browser keine OPTIONS-Vorabprüfung schickt. Vorschaubilder und Öffnen laufen über normale Links (`<img>`, `<a>`), brauchen keine Freigabe.
- **Verworfen:** Supabase-Funktion als Umweg (Dateien liefen durch Supabase); eigenes Programm mit Supabase-Anmeldung (Tobias wollte die NAS-Anmeldung); Supabase Storage.
- **Test:** `tests/mock-nas.mjs` (Nachbau DSM) hinter dem echten `nas/nginx.conf` (`tests/nas-proxy.sh`). Am echten NAS ungeprüft, darum zuerst Machbarkeitstest. Nächster Schritt nach Erfolg: richtige Dokumenten-Seite (Kategorien, Garantie bis, Erinnerung; Angaben in Supabase, Datei auf dem NAS).

## E40 – Neues App-Symbol (v0.20.2, 30.10.2026)
- **Wunsch Tobias:** Familie mit 4 Personen, passend zu den App-Farben, Farben wie im Kalender mit Verlauf. Erster Entwurf (runde Köpfe mit Glanz, Körper als Balken) gefiel nicht («Wasserballone»).
- **Skizze Tobias:** grosses Herz; darin die Eltern (zwei Köpfe, Schultern), deren Arme wie ein Herz um die zwei Kinder laufen. Daraus 4 Vorschläge: Linie, Silhouette mit farbigen Köpfen, Herz gefüllt, Bunt auf Violett. **Entscheid Tobias: 4 «Bunt auf Violett».**
- **Umsetzung:** Violetter Hintergrund (App-Farbe, Verlauf), Herz als zarte weisse Linie. Eltern mit Verlauf blau (Tobias, links) → rosa (Thadea, rechts), Kinder orange (Kind 1) → violett (Kind 2), Köpfe in der jeweiligen Farbe. Die Kinder sind aus den Eltern ausgespart (mit Abstand), unten offen, damit die Arme sie umarmen.
- **Technik:** `scripts/make-icons.mjs` zeichnet das Symbol als SVG (`public/icon.svg`) und erzeugt die PNG-Dateien (192, 512, maskable 512 mit Inhalt in der sicheren Mitte, apple-touch-icon 180). Farben oder Formen dort ändern und neu erzeugen.
- **v0.20.3:** Das neue Symbol kam auf Tobias' Handy nicht an. Android (Chrome) prüft das Manifest einer installierten App nur selten (höchstens einmal pro Tag beim Öffnen) und übernimmt ein geändertes Symbol unter gleichem Dateinamen unzuverlässig. Darum tragen die PNG-Dateien jetzt eine Kennung im Namen (aus dem Inhalt berechnet); bei jeder Änderung ändert sich die Adresse im Manifest. Sicherster Weg bleibt: App deinstallieren und neu installieren (Daten bleiben).

## E39 – Liebesgruss (v0.20.0, 30.10.2026)
- **Wunsch Tobias:** Einem Familienmitglied einen Text oder ein Foto auf den Startbildschirm schicken. Die Person muss zuerst mit einem Emoji reagieren (❤️ 😘 😂 👍), vorher geht die App nicht. Die Reaktion erscheint beim Absender auf der Startseite. Nicht zum Nerven, sondern als liebliche Spielerei.
- **Entscheide Tobias:** Nur zwischen Personen mit App-Konto (1a). Album «Unsere Grüsse» mit höchstens 100 Grüssen; darüber wird bei den älteren jeder zweite gelöscht, damit auch ein paar alte bleiben (2b). Pro Person nur ein offener Gruss; Senden erst wieder, wenn reagiert wurde (3b, 2).
- **Technik:** Neue Tabelle `greetings` (IndexedDB Version 9) in der gemeinsamen Tabelle `records` → kein Supabase-Update. Foto im Gerät auf 1080 px verkleinert (JPEG, ca. 100–200 KB) und als data-URL im Eintrag gespeichert, statt Supabase Storage (bräuchte Bucket und Regeln). 100 Fotos = ca. 10–20 MB, gut im Gratis-Kontingent.
- **Ausdünnen:** Sind es mehr als 100, wird von allen ausser den neusten 50 jeder zweite (mit Reaktion) gelöscht, bis es höchstens 100 sind. Offene Grüsse nie. Gelöschte Einträge verlieren Text und Foto. Jedes Handy rechnet gleich.
- **Keine Push-Meldung:** Der Gruss erscheint beim nächsten Öffnen bzw. beim Abgleich (alle 30 s, solange die App offen ist). Push wäre viel aufwendiger und passt nicht zur «Überraschung beim Öffnen».
- Für alle Konten des Haushalts sichtbar (wie andere Einträge). Mit nur zwei Konten unproblematisch.

## E38 – Neues Aussehen und eigene Menüleiste (v0.19.0, 30.10.2026)
- **Wunsch Tobias:** Die App wirkte karg, dunkel und altbacken. Gewünscht: frisch, modern, familienfreundlich, intuitiv. Jede Person soll selber festlegen, welche Seiten in der Menüleiste angeheftet sind und in welcher Reihenfolge. Start bleibt in der Mitte, Mehr rechts.
- **Vorgehen:** Zuerst drei Entwürfe als Vorschau-Seite (A «Sonnenschein», B «Frische Brise», C «Familienfarben»), dann ein Mix-Entwurf über vier Seiten. **Entscheid Tobias:** Kacheln und Farben von C, Menüleiste von A (in den Farben von C), einheitliche Symbole statt Emojis, hell als Standard, dunkel nur auf Wunsch, 3 freie Plätze.
- **Farben:** Violett als Hauptfarbe, hell-lavendel Kopfzeile mit runden Ecken, weisse Karten auf sehr hellem Lavendel. Kachelfarben Orange / Grün / Blau / Rosa / Violett. Dunkel = dunkles Violett-Blau statt Schwarz. Personen erhalten später eigene Farben (Schritt 2).
- **Schrift:** Fredoka (Überschriften) und Nunito Sans (Text), als Dateien in der App (offline, SIL Open Font License).
- **Hell/Dunkel:** folgt nicht mehr dem Handy. Gesteuert über `data-theme` auf `<html>`; die Einstellung liegt im `localStorage` (`fp-theme`).
- **Menüleiste:** 5 Knöpfe: Platz 1, Platz 2, Start, Platz 3, Mehr. Nur so liegt Start genau in der Mitte; 7 Knöpfe wären auf dem Handy zu eng. Anheftbar: Einkauf, ToDo, Notizen, Kalender, Wochenplan, Menüs, Dokumente, Familie. Nicht Angeheftetes steht unter «Mehr» (Kacheln). Standard wie bisher: Einkauf, ToDo, Notizen. Gespeichert pro Gerät im `localStorage` (`fp-nav`), nicht in Supabase: Jede Person hat ihr eigenes Handy, so braucht es kein Datenbank-Update.
- **Umsetzung in 3 Schritten:** (1) v0.19.0 Farben, Schrift, Symbole, Menüleiste, Mehr, Hell/Dunkel. (2) Startseite mit Kacheln und Personenfarben. (3) Übrige Seiten (Emojis durch Symbole ersetzen, Listen im neuen Stil).

## E41 – Dokumente in der App-Cloud mit eigenem Scanner (v0.21.0, 30.10.2026)
- **Entscheid Tobias:** Dokumente vorerst über die App mit Speicherung in der App-Cloud (Supabase), **nicht auf dem NAS**. Der NAS-Test (E37, v0.18) wird entfernt (Code in der Git-Geschichte bis v0.20.3). Scannen statt nur Fotos.
- **Ablage:** Supabase Storage, Bucket `dokumente` (privat, max. 20 MB, PDF/JPEG/PNG/WebP). Pfad `<haushalt-id>/<dokument-id>.pdf`; Regeln auf `storage.objects` über `my_household_ids()` (update-0.21.sql, lokal mit PostgreSQL geprüft). Gratis 1 GB.
- **Angaben** (Titel, Art, Datum, gültig/Garantie bis, Notiz, kleines Vorschaubild) in der Tabelle `docs` über den normalen Abgleich (`records`), IndexedDB Version 10. Die Datei selbst liegt zusätzlich lokal im Store `files` (nicht im Abgleich): neue Scans warten dort, bis Internet und Haushalt da sind (`uploadPending`), geöffnete bleiben als Kopie für offline. Löschen in der Ablage macht das Handy, das löscht (Warteschlange `docDeletes` in `meta`).
- **Scanner-App einbinden?** Der gute Google-Scanner (ML Kit, wie in Google Drive) ist nur für echte Android-Apps verfügbar, nicht für eine Web-App. Darum zwei Wege: (1) **eigener Scanner** in der App: Blatt finden (Otsu-Schwelle, grösste helle Fläche, äusserste Punkte als Ecken, muss sich vom Untergrund abheben), Ecken von Hand verschiebbar, perspektivisch gerade ziehen, Papierhelligkeit herausrechnen (Schatten weg), Filter Farbe / Schwarz-weiss / Original, mehrere Seiten → eigenes kleines PDF (JPEG-Seiten, ohne Bibliothek). (2) **«Teilen» an die App** (Web Share Target im Manifest, Service Worker nimmt die Datei an): Scans aus Google Drive, Adobe Scan, Microsoft Lens usw. landen direkt in «Neues Dokument». Kommt später eine APK (Phase 3), kann dort der Google-Scanner direkt eingebaut werden.
- **Ansehen:** Seitenbilder werden aus dem PDF gelesen (eigene Scans und die meisten Scanner-PDFs), sonst Herunterladen/Teilen. Kein pdf.js (zu gross).
- **Noch nicht gebaut (nicht beschlossen):** Erinnerung vor Ablauf als ToDo, Texterkennung/Suche im Inhalt. (Privat und Personen: siehe E42.)

## E42 – Dokumente privat und «Betrifft» (v0.22.0, 30.10.2026)
- **Wunsch Tobias:** Beim Erfassen wählen: privat (nur ich) oder für alle. Standard für alle; privat mit dem Schloss oben rechts wie bei den Notizen. Bei «für alle» angeben, wen es betrifft (z.B. Police von Thadea), um nach Person zu filtern, ohne es privat zu machen. Private Dokumente haben keine Personen (nur für einen selbst).
- **Umsetzung:** `private` und `persons` im Eintrag `docs`. Private Einträge gehen wie private Notizen/ToDos mit `owner_id` hoch (bestehende Regeln aus update-0.10). Die Datei liegt bei privat unter `<haushalt>/privat/<konto-id>/…`; `update-0.22.sql` ersetzt die Ablage-Regeln durch `dokument_erlaubt(name)`: Haushaltsmitglied **und** (kein Privatordner **oder** eigener Privatordner).
- **Wechsel privat ↔ für alle:** neues Dokument mit neuer ID und neuem Ablageort, das alte bekommt einen leeren Löschvermerk (wie bei Notizen), damit bei den anderen nichts Privates liegen bleibt. Braucht die Datei: liegt sie nicht auf dem Handy, ist Internet nötig.
- **Filter:** zweite Chip-Reihe mit Personen (nur solche mit Dokumenten). Private Dokumente zählen bei der Person, die sie erfasst hat.

## E43 – Termine für andere mit automatischer Einladung (v0.23.0, 02.11.2026)
- **Wunsch Tobias:** Termin für Thadea erfassen, der auch in ihrem Gmail-Kalender steht, ohne Kalender-Freigaben. In der App nicht doppelt.
- **Entscheide Tobias (1b, 2a):** Die Einladung geht **automatisch**, sobald man im **eigenen** Kalender eine Person mit E-Mail-Adresse wählt (kein eigenes Häkchen). Ändern/Löschen nur, wer eingeladen hat; die Eingeladene kann zu-/absagen. Man kann sich selbst abwählen: Titel «(Thadea) Zahnarzt» (runde Klammern = Besitzer des Kalenders nicht betroffen), in der App nur Thadeas Farbe.
- **Adresse:** neues Feld `email` bei der Person (Familie, wird mit den Personen abgeglichen, kein Datenbank-Update). Fehlt es, nimmt die App die Adresse des verbundenen Google-Kontos dieser Person.
- **Google:** `attendees` mit `sendUpdates=all` (Google verschickt Einladung, Änderungen, Absage). Beim Ändern schickt die App die gewünschten (`invite`) und alle Familien-Adressen (`inviteKnown`); die Funktion trägt nur Familienmitglieder ein/aus, andere Gäste und Antworten bleiben. Im Familienkalender keine Einladungen.
- **Nicht doppelt:** Die Funktion liefert pro Termin `uid` (iCalUID), `invitedBy` (Kopie einer Einladung) und `guests`. Die App zeigt pro `uid` + Beginn nur einen Termin, bevorzugt die Fassung der einladenden Person. Kopien einer Einladung sind in der App nicht änderbar.
- Tobias muss die Funktion `google-kalender` in Supabase neu einspielen (ANLEITUNG Z).

## E44 – Einkaufsliste aus Menüs abschaltbar, neue Standard-Menüleiste (v0.24.0, 02.11.2026)
- **Wunsch Tobias:** Das automatische Füllen der Einkaufsliste aus den Menüs im Wochenplan soll man ausschalten können, **Standard aus**. Beim Ausschalten bleibt, was schon in der Liste ist; beim Einschalten kommen nur Menüs dazu, die **danach** eingeplant werden.
- **Umsetzung:** Jedes eingeplante Gericht merkt sich beim Einplanen (auch beim Kopieren von Tag/Woche), ob die Einstellung gerade an war (`shop`). Ältere Gerichte ohne Vermerk zählen weiter (sie wurden ja mit «an» geplant). Von Hand erfasste und wiederkehrende Artikel sind nicht betroffen.
- **Gilt für die ganze Familie** (die Einkaufsliste ist gemeinsam), gespeichert als Eintrag im Einkaufs-Speicher und mit abgeglichen. Kein Datenbank-Update.
- **Menüleiste:** Standard neu Einkauf, ToDo, Start, Kalender, Mehr (Notizen unter Mehr). Wer die Leiste schon selbst eingerichtet hat, behält seine Einstellung.

## E45 – Einkaufsliste: «Fragen» beim Einplanen (v0.25.0, 03.11.2026)
- **Wunsch Tobias:** Neben Aus/Ein eine Wahl «jedes Mal fragen». Beim Einfügen eines Menüs fragt die App, ob die Einkaufsliste ergänzt wird, und man kann die Artikel vorher bearbeiten.
- **Umsetzung:** Fenster «Einkaufsliste ergänzen?» mit den Zutaten (Menge nach den Personen, die mitessen). Abwählen, Name/Menge/Einheit ändern, Artikel dazufügen. Übernommen wird als Artikel der Woche mit Herkunft («Pizza (Do Mittagessen)»), löschbar mit ✕ wie Artikel von Hand.
- **Folge:** Diese Artikel sind fest. Wird das Menü später aus dem Plan genommen oder ändern die Personen, die mitessen, bleibt die Liste unverändert (anders als bei «Ein»).
- Beim Kopieren von Tag/Woche wird nicht gefragt (bei «Fragen» kommt dann nichts in die Liste).

## E46 – Android-App (APK) als Hülle, App kommt weiter von GitHub Pages (APK 1.0, 06.11.2026)
- **Wunsch Tobias:** APK, damit später Widgets möglich sind. Thadea hat auch Android. Zuerst nur die APK ohne Widget.
- **Umsetzung:** Capacitor 8 (E18). Die APK lädt die App von `https://leibi-tech.github.io/family-planner/` (`server.url`). Vorteil: normale Updates kommen automatisch, ohne neue APK. Offline: Capacitor holt die Seite selbst; ohne Netz übernimmt der Service Worker die gespeicherte Kopie. Nur beim allerersten Start ohne Netz erscheint «Keine Verbindung» (`android-start/fehler.html`).
- **Bauen:** GitHub Actions (`.github/workflows/android.yml`), weil die Android-Werkzeuge in der Claude-Cloud gesperrt sind. Läuft nur bei Änderungen am Android-Teil oder von Hand. Auf `main` landet die APK unter Releases → Tag `android` (fester Download-Link). Auf `claude/…`-Branches nur Test-APK (Artifact, Test-Schlüssel).
- **Unterschrift:** Schlüssel `android/familyplanner.p12`, beim ersten Lauf auf `main` erzeugt und eingecheckt, geschützt mit dem Passwort im GitHub-Geheimnis `ANDROID_PASSWORT` (nur Tobias kennt es). Ohne gleichen Schlüssel kein Update. Geht das Geheimnis verloren: neuer Schlüssel, App einmal deinstallieren und neu installieren (Daten kommen aus der Cloud).
- **Version:** `apkVersion` in `package.json` + Build-Nummer von GitHub (versionCode).
- **Bekannte Lücken (nächster Schritt):** Teilen an die App (Web Share Target) gibt es in der APK nicht; Herunterladen/Teilen von Dokumenten (blob-Download, `navigator.share`) geht in der Android-WebView nicht. Google verbinden öffnet Chrome (Google erlaubt keine Anmeldung in eingebetteten Ansichten); der Schlüssel landet trotzdem in Supabase. Lösung später mit Capacitor-Plugins (die Bridge wird auch in die entfernte Seite eingespielt).

## E47 – Zurück-Taste und Speichern/Teilen in der APK (v0.26.0, APK 1.1, 06.11.2026)
- **Rückmeldung Tobias:** APK läuft, Kalender und Scannen gehen; Zurück-Taste und Herunterladen nicht.
- **Zurück-Taste:** Die App hat keine Browser-Verlaufsschritte, darum fragt die Hülle die App (`window.fpBack()`). Reihenfolge: offenes Fenster (zuerst ein Knopf mit `data-back`, sonst wie neben das Fenster tippen) → Zurück-Knopf der Seite (`data-back`) → Startseite. Auf der Startseite: App in den Hintergrund. Gruss-Sperre und «Wer bist du?» lassen sich so nicht wegdrücken.
- **Speichern/Teilen:** Eigene kleine Verbindung `window.FPAndroid` (JavascriptInterface) statt Capacitor-Plugins, weil diese offline (Seite aus dem Service Worker) nicht verfügbar wären. Herunterladen → Ordner «Download» (MediaStore) und gleich öffnen. Teilen → Android-Teilen-Fenster. Nur erlaubt, wenn die eigene App-Adresse angezeigt wird.

## E48 – Hinweis «Neue Android-App bereit» (v0.27.0, APK 1.2, 06.11.2026)
- **Frage Tobias:** Muss jedes Update neu installiert werden? Antwort: nein, nur Änderungen am Android-Teil. Wunsch: Die App meldet eine neue APK selbst.
- **Umsetzung:** Die App fragt (nur in der APK, höchstens alle 10 Minuten; bis v0.34.0 alle 3 Stunden, dann kam der Hinweis zu spät) die GitHub-Seite «Android-App» (Release `android`) ab und liest «Version 1.2 (Build 7)» aus dem Text. Ist die Build-Nummer höher als die installierte (`FPAndroid.versionCode()`, APK 1.1 ohne diese Funktion = Build 5), erscheint auf der Startseite ein Hinweis mit Download-Knopf. Installieren muss man immer selbst bestätigen (Android).
- Der Release-Text wird vom Workflow geschrieben; das Muster «Version … (Build N)» darf sich nicht ändern.

## E49 – Neuer Name «myFam.» (v0.28.0, APK 1.3, 06.11.2026)
- **Wunsch Tobias:** Die App heisst neu **myFam.** (klein m, mit Punkt). Kurz genug, dass Android den Namen unter dem Symbol nicht abschneidet.
- Geändert: Name unter dem Symbol (APK und Web-App), Fenstertitel, Einladungstext.
- **Bleibt:** Repository und Adresse `leibi-tech.github.io/family-planner` (sonst zeigt die APK ins Leere), Android-Kennung `ch.leibitech.familyplanner` (sonst gehen Updates nicht), Datenschutzseite «Family-Planner» (passt zum Namen bei der Google-Anmeldung; erst ändern, wenn auch der Name in der Google Cloud Console geändert wird).

## E50 – Einstellungen als eigene Seite, Datenschutz und Copyright (v0.28.0, 06.11.2026)
- **Wunsch Tobias:** Einstellungen als eigenes Menü wie ToDo, dort Datenschutzerklärung und Copyright. Datenschutzerklärung ergänzen.
- **Umsetzung:** Seite `einstellungen` (anheftbar, unter Mehr als Kachel) mit Menüleiste, Einkaufsliste aus Menüs, Aussehen, Datenschutzerklärung, Version und «© 2026 Tobias Leibacher. Alle Rechte vorbehalten.». Unterseiten «Menüleiste» und «Datenschutz» führen mit Zurück zu den Einstellungen.
- **Datenschutz:** eine Quelle, `public/datenschutz.html` (für Google und Web). Die App lädt dieselbe Datei und zeigt den Inhalt an (offline über den Service Worker). Ergänzt: Grundsätze, Familie/Gmail-Adresse, Dokumente, Grüsse, Betreuung, Termine bearbeiten und Einladungen, Dienste (Supabase, GitHub Pages, Google, Rezept-Import), Android-App, Rechte nach Schweizer DSG. Name «myFam. (früher Family-Planner)», damit es zur Google-Anmeldung passt.

## E51 – Erster Start: Name erfragen statt «Tobias» (v0.29.0, 09.11.2026)
- **Anlass:** Tobias' Bruder hat die App installiert und wurde mit «Guten Abend, Tobias» begrüsst. Grund: Startwerte Tobias / Frau / Kind 1 / Kind 2 waren fest eingebaut, ohne Haushalt gilt die erste Person als «ich».
- **Entscheid Tobias (Variante 2):** Neue Installationen legen keine Personen mehr an. Ein Willkommensfenster fragt «Wie heisst du?» und legt diese Person mit Faktor 1.0 an. Weitere Personen unter Mehr → Familie. Knopf «Ich trete einer bestehenden Familie bei» führt direkt zu Familie / Gemeinsam nutzen.
- Das Fenster erscheint nur, solange keine Person erfasst und das Handy mit keiner Familie verbunden ist, und nur einmal (Merker im Browser). Bestehende Installationen merken nichts.
- **Tests:** Die Testversion legt die alten Startwerte weiter an (Schalter `__TEST_SEED__` im Build), damit die bestehenden Tests gleich bleiben. `tests/welcome.mjs` prüft den ersten Start ohne Startwerte.

## E56 – Widget «Termine · 7 Tage» (v0.34.0, APK 1.5, 10.11.2026)
- **Entscheid Tobias:** erstes Widget = Termine, 7 Tage ab heute.
- **Inhalt:** pro Tag eine Überschrift (Heute · Mo 10.11., Morgen · …, dann Wochentag), darunter die Termine mit Titel (ohne [Namen]), Zeit und Personen, links Farbstreifen der Personen (wie im Kalender). Tage ohne Termin: «frei». Oben «Stand hh:mm». Hell/Dunkel folgt dem Handy.
- **Woher die Termine kommen:** Das Widget holt nichts selbst (Anmeldung und Google laufen über die App). Die App gibt der Hülle jedes Mal, wenn sie Termine holt (Startseite, Kalender), beim Start und beim Verlassen die Termine der nächsten **14 Tage** (`FPAndroid.setWidget`). So stimmt das Widget auch ein paar Tage ohne App-Öffnen; Tage nach dem gelieferten Zeitraum zeigen «noch unbekannt». Android zeichnet das Widget alle 30 Min. neu (Tageswechsel).
- **Antippen:** Zeile → Kalender, Tagesansicht dieses Tages. Kopf → Kalender.
- Termine, die nach dem letzten Öffnen der App dazukamen (z.B. von Thadea), erscheinen erst, wenn die App wieder Termine geholt hat.

## E55 – Neuigkeiten auf der Startseite (v0.33.0, 10.11.2026)
- **Wunsch Tobias:** Bei jeder richtigen Neuerung (etwas kommt dazu, fällt weg oder geht anders) einmal eine kurze Meldung auf der Startseite. Wegdrücken mit ✕, dann für immer weg. Alle Änderungen in den Einstellungen nachlesen. **Keine** Meldung für Kleinigkeiten (z.B. «Knopf ist grösser»).
- **Umsetzung:** Liste `NEWS` in `src/news.ts` (Version, Datum, Titel, kurzer Text). Karte «✨ Neu in myFam.» zeigt alle Einträge, die neuer sind als der Merker `fp-news-seen` (pro Handy, im Browser-Speicher). ✕ setzt den Merker auf die neueste Version. Ohne Merker (erstes Mal) nur die neueste Neuigkeit, nicht die ganze Liste.
- **Seite:** Einstellungen → Neuigkeiten, alle Einträge neueste zuoberst. Rückwirkend ab v0.16.0 nachgetragen.
- **Regel für Claude:** Bei jeder richtigen Neuerung einen Eintrag zuoberst in `NEWS` ergänzen (gleiche Version wie `package.json`). Bei Kleinigkeiten und reinen Fehlerkorrekturen nicht.

## E54 – «Teilen» an die Android-App (v0.32.0, APK 1.4, 10.11.2026)
- **Entscheid Tobias:** vor dem ersten Widget zuerst «Teilen an die App».
- **Was:** PDF oder Foto aus einer anderen App teilen → «myFam.» → Seite Dokumente mit «Neues Dokument» (PDF) oder dem Scanner (Foto). Nur eine Datei pro Mal, höchstens 20 MB (wie beim Wählen).
- **Wie:** Die Web-App nutzt dafür den Service Worker (`share_target`), das geht in der APK nicht. Darum liest die Hülle die Datei selbst (`MainActivity.receiveShare`), hält sie bereit und öffnet die App mit `?teilen=1`. Die App holt sie mit `FPAndroid.takeShared()` ab (nur einmal, nur wenn die eigene App angezeigt wird). Geht auch offline.

## E53 – Datensicherung als ZIP-Datei (v0.31.0, 10.11.2026)
- **Frage Tobias:** Haben wir ein Backup, falls Datenbank, KI oder sonst was umziehen muss? Bisher nicht (Supabase gratis bietet keine herunterladbaren Sicherungen). Entscheid Tobias: Sicherung **mit** Dokumenten.
- **Ort:** Mehr → Einstellungen → Datensicherung. Jede Person kann sichern und einlesen.
- **Inhalt:** eine ZIP-Datei `myFam-Sicherung-JJJJ-MM-TT.zip` mit `daten.json` (alle Einträge dieses Handys: Personen, Menüs, Wochenplan, Einkauf, ToDos, Ämtli, Notizen, Betreuung, Grüsse, Angaben zu den Dokumenten), `dokumente/` (die Dateien unter ihrem Namen, am PC direkt lesbar) und `LIESMICH.txt`. Dokumente, die nicht auf dem Handy sind, holt die App für die Sicherung aus der Ablage (ohne Kopie aufs Handy). Private Einträge anderer Personen sind nicht dabei (das Handy kennt sie nicht). Termine bleiben bei Google.
- **Einlesen:** zeigt zuerst, was fehlt. Zurück kommt nur, was fehlt oder gelöscht ist; was in der App steht, bleibt (auch wenn es seit der Sicherung geändert wurde). Zurückgeholtes bekommt einen neuen Zeitstempel und geht beim Abgleich an alle Handys; Dokumente werden neu in die Ablage geladen.
- **Umzug:** Neue Datenbank → neue Familie einrichten → Sicherung einlesen. Eine neu erfasste Person mit gleichem Namen wird durch die gesicherte ersetzt (keine Doppelten).
- **Format:** ZIP ohne Komprimierung, eigene kleine Hilfe `src/zip.ts` (keine neue Bibliothek). Lesen kann auch komprimierte ZIP-Dateien.
- Keine automatische Sicherung (bräuchte einen Server-Dienst). Erinnerung zum regelmässigen Sichern: später, falls gewünscht.

## E52 – Portionenfaktoren in die Einstellungen (v0.30.0, 09.11.2026)
- **Wunsch Tobias:** «Essensfaktoren in Einstellungen versorgen, das sieht blöd aus so und will längst nicht jeder.»
- **Umsetzung:** Seite Familie zeigt nur Namen (ohne × 1.0, ohne Summe, ohne Erklärung); Person bearbeiten = Name, Gmail-Adresse, Löschen. Neue Unterseite Einstellungen → «Portionen pro Person» (Tab `portionen`, gleiche Komponente `FamilyPage portions`): Erklärung, Faktoren, Summe, Faktor ändern. Personen hinzufügen nur auf Familie.
- Neue Personen bekommen weiterhin den eigenen Faktor (1.0). Die Einkaufsmengen rechnen unverändert mit den Faktoren; wer sie nie anpasst, hat überall 1.0.
