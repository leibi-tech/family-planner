# ROADMAP – Family-Planner

Stand: 26.10.2026 · Version 0.15.0

## Aktueller Stand
- ✅ **Schritt 1 – Grundgerüst + Familie**: App ist installierbar und läuft offline. Seite «Familie»: Personen mit Portionenfaktor erfassen, ändern und löschen. Startwerte: Tobias 1.0, Frau 0.8, Kind 1 0.4, Kind 2 0.4.
- ✅ **Schritt 2 – Menüs**: fertig, auf dem Handy getestet.
- ✅ **Schritt 3 – Wochenplan**: fertig, auf dem Handy getestet.
- ✅ **Schritt 4 – Einkaufsliste aus dem Plan** (inkl. Vorrats-Check und Abhaken): fertig, getestet.
- 🎉 **Alle Grundfunktionen von Phase 1 laufen auf dem Handy.**
- ✅ **Schritt 5 – Artikel von Hand, wiederkehrende Artikel, Vorschläge, Erledigte ausblenden**: fertig, auf dem Handy getestet.
- ✅ **Online und getestet**: läuft unter https://leibi-tech.github.io/family-planner/, auf Tobias' Handy installiert, offline geprüft.
- ✅ **ToDos & Ämtli-Plan (v0.10.x)**: steht (26.10.2026).
- ✅ **Kalender K1 – Google verbinden & ansehen (v0.14.0)**: läuft, Tobias hat verbunden (26.10.2026). Nötig war zusätzlich: Rechte für service_role (in update-0.14.sql ergänzt), Datenschutzseite `docs/datenschutz.html` für Google «In Produktion».
- ✅ **Kalender K2 – Termine erfassen/ändern/löschen (v0.15.0)**: läuft auf dem Handy, von Tobias getestet (26.10.2026).
- ⏳ **Passwort ändern (v0.13.0)**: gebaut und getestet. Tobias: hochladen und ausprobieren (ANLEITUNG O). Kein Datenbank-Update nötig. «Passwort vergessen» folgt danach (E-Mail-Dienst nötig).
- ⏳ **Notizen & Listen (v0.11.0)**: gebaut und getestet, Tobias: hochladen und auf dem Handy ausprobieren (ANLEITUNG M). Kein Datenbank-Update nötig.

## Phase 1 – App lokal auf dem Handy (Ziel 1)
| Schritt | Inhalt | Status |
|---|---|---|
| 1 | Grundgerüst, Offline, Installierbar, Familie | ✅ fertig, getestet |
| 2 | Menüs: erstellen, bearbeiten, löschen. Zutaten mit Menge, Einheit und Sparte. Mengen «für ganze Familie» oder «für eine Person» | ✅ fertig, getestet |
| 3 | Wochenplan: Woche ab Montag, 3 Standard-Mahlzeiten pro Tag, Mahlzeit entfällt (ausgegraut) / Zwischenmahlzeit hinzufügen, mehrere Gerichte pro Mahlzeit, Menü wählen (passende zuerst) oder neu erstellen, Personen abwählen, Wochen wechseln und kopieren | ✅ fertig, getestet |
| 4 | Einkaufsliste aus dem Wochenplan: Mengen nach Faktor berechnen, runden, zusammenfassen, Herkunft anzeigen. Vorgezogen aus Schritt 5: Vorrats-Check mit Rückgängig, Abhaken im Laden | ✅ fertig |
| 5 | Einkaufsliste: Artikel von Hand (mit Vorschlägen aus früheren Einträgen, löschbar mit ✕), wiederkehrende Artikel (Intervall in Wochen), Erledigte ausblenden | ✅ fertig, getestet |
| 7 | Detail-Anpassungen (Wunschliste von Tobias, sammeln und am Schluss umsetzen) | offen |
| 6 | Datensicherung: Export/Import als Datei | zurückgestellt (siehe unten) |

## Phase 2 – Gemeinsame Nutzung (Ziel 2)
Synchronisation über Supabase. Läuft: Konto, Haushalt mit Code, Rollen, automatischer Abgleich (offline-fähig). Jeder Eintrag hat eine eindeutige ID, einen Änderungszeitpunkt und beim Löschen eine Löschmarke.

## Phase 3 – Eigene Android-App (APK), kein Play Store
**Entscheid Tobias (26.10.2026):** Die App kommt **nie** in den Play Store (zu aufwendig, keine fremden Nutzer betreuen). Falls nötig eine APK (Capacitor) für die Familie und evtl. Kollegen, direkt installiert. Bis dahin bleibt die installierte Web-App die Hauptform.

## Nächste Schritte (Stand 26.10.2026, mit Tobias abgesprochen)
Neue Richtung: **Notizen/Listen und eine Startseite (Dashboard)**. Die Startseite zeigt auf einen Blick, was für die Familie heute wichtig ist.

1. ⏳ **v0.11.0 Gemeinsame Notizen & Listen** (neuer Menüpunkt «Notizen», 6. Knopf unten): gebaut und getestet (Handy-Format, zwei simulierte Handys).
   - **Notizen** (Titel + Text) und **Listen** (Punkte zum Abhaken, mit **Unterpunkten**, eine Ebene). Abgehakte rutschen nach unten, «Erledigte entfernen».
   - **Öffentlich** für die ganze Familie. Mit dem **Schloss oben rechts** auf **privat** umstellbar (nur die erfassende Person sieht es, in der Datenbank geschützt) und zurück.
   - **Anheften mit Pin** (📌): «Für mich anheften» oder «Für alle anheften» (📌📌). Jede Person kann bei sich selbst wieder lösen. Angeheftetes erscheint später auf der Startseite. Private Einträge können nur für mich angeheftet werden.
   - Zeigt «Zuletzt geändert von …, vor …» (Grundlage für «letzte Änderungen» auf der Startseite).
   - Gleichzeitiges Bearbeiten (z.B. einer im Laden, eine zuhause): Listenpunkte und Pins werden Punkt für Punkt zusammengeführt, nichts geht verloren. Bei Notizen-Text gewinnt die neuere Fassung.
   - **v0.11.1 «Als ToDo anheften»** (✅-Symbol oben in der Notiz): fragt «Nur für mich» oder «Für alle» (= offen, wer Zeit hat) und optional ein Fälligkeitsdatum. Bei einer privaten Notiz entfällt die Frage, das ToDo wird privat. Das ToDo zeigt 📝 und hat im ToDo-Fenster den Knopf «Notiz öffnen» / «Liste öffnen» (springt direkt zur Notiz).
   - Tobias: hochladen, ausprobieren (Notiz, Liste mit Unterpunkten, privat, Pin, als ToDo anheften), Rückmeldung.
2. ⏳ **v0.12.0 Startseite / Dashboard**: gebaut und getestet. Tobias: hochladen und ausprobieren (ANLEITUNG N). Kein Datenbank-Update nötig. Umgesetzt:
   - **Was kochen wir heute?** Menüs von heute (Frühstück/Mittag/Abend). Antippen öffnet direkt das Menü.
   - **Meine ToDos** (fällige und überfällige zuerst), Antippen öffnet das ToDo, Abhaken direkt möglich.
   - **Angeheftete Notizen/Listen** und **zuletzt geänderte** Einträge, mit Link.
   - **Später: Kalender** (Termine von heute/den nächsten Tagen), sobald der Kalender gebaut ist.
   - Menüleiste unten (mit Tobias geklärt): **5 Knöpfe** Start (hervorgehoben), Einkauf, ToDo, Notizen, Mehr. Unter «Mehr»: Wochenplan, Menüs, Familie (mit Zurück-Pfeil oben links). Die App startet immer auf der Startseite.
   - Angeheftete Listen zeigen die ersten 5 offenen Punkte zum direkten Abhaken; ✕ löst die Anheftung nur bei der eigenen Person. Antippen öffnet Menü / ToDo / Notiz direkt, «Zurück» führt wieder zur Startseite.
   - Noch nicht auf der Startseite: Einkaufsliste, Kalender (kommt mit dem Kalender).
3. **Kalender** in 5 Schritten (mit Tobias abgesprochen, 26.10.2026):
   - ✅ **K1 (v0.14.0) Verbinden & Ansehen:** Google-Konto verbinden (jede Person ihr eigenes), Kalender wählen («Mein Kalender» / «Familie» / nicht zeigen), Monatsraster + Tagesliste, Personen ein-/ausblenden, Termin-Details mit Link zu Google, offline lesbar. Unter «Mehr» → «Kalender». Tobias: ANLEITUNG P.
   - ✅ **K2 (v0.15.0)** Termine erfassen, ändern, löschen (nur eigene Kalender und Familienkalender, nur online). Wiederholungen einfach (täglich … jährlich, bis), «nur diesen» / «alle». Betroffene Personen im Titel «[Kind 1] …», auch bei eigenen Terminen. Erinnerungen = Google-Standard. Tobias: ANLEITUNG Q.
   - **K3** Übersicht nebeneinander: alle Personen im gleichen Zeitraster (Überschneidungen sehen).
   - **K4** Betreuungs-Warnung («Wer schaut auf die Kinder?») und Rückfrage bei fremden Terminen. Zusatzinfos in der eigenen Datenbank, mit dem Google-Termin verknüpft.
   - **K5** Termine auf der Startseite.
4. **Passwort** (mit Tobias abgesprochen, 26.10.2026): zuerst ✅ «Passwort ändern» (v0.13.0, ohne E-Mail-Dienst), dann «Passwort vergessen» mit kostenlosem E-Mail-Dienst (z.B. Brevo als SMTP in Supabase, Link in der Mail, Bildschirm «Neues Passwort»). Spätestens vor dem Play Store.
5. Kleinigkeiten, wenn Zeit: Export-Knopf (siehe Datensicherung).

### Zurückgestellt
- **Menü-Vorlagen** (eingebaute Sammlung typischer Familienmenüs): vorerst weggelassen, Tobias entscheidet später.
- **Datensicherung (Export/Import)**: Die Daten liegen ohnehin in der Supabase-Datenbank und auf beiden Handys. Eine Sicherungsdatei schützt nur vor Sonderfällen (versehentlich gelöscht und auf alle Geräte übertragen; Supabase-Gratisprojekt wird nach längerer Inaktivität pausiert; Fehler beim Update). Darum nicht dringend, aber vor dem Play Store sinnvoll.

## Frühere Arbeiten (Phase 2 und Folgeschritte)
- ✅ v0.8.1 (Rollen & Personen) eingespielt, Datenbank-Update in Supabase ausgeführt. Tipp: Im SQL Editor muss oben rechts «Database» stehen, nicht «Logs».
- ⏳ **v0.9.0 Menü-Import aus Text oder Link**: gebaut und getestet (Text-Import, Prüfen-Ansicht, Link-Import gegen nachgebaute Funktion). Tobias: hochladen, Supabase-Funktion «rezept-import» einrichten (ANLEITUNG Abschnitt I), mit echten Rezepten testen. Foto: Text mit Google Lens kopieren und einfügen. Stufe 2 (Foto mit KI) später nach Bedarf.
- ⏳ **v0.9.1 «Meine Portion»**: Bei importierten Menüs Portionsmenge der Hauptzutat direkt anpassen; Portionen gelten aus Sicht der erfassenden Person. Tobias: hochladen und testen.
- ⏳ **v0.9.2 Faktoren-Patch**: eigener Faktor nicht mehr änderbar, Eingabe per Tastatur, Rundung auf 0.05, einmalige Reparatur der verschobenen Faktoren. Tobias: hochladen, «Familie» öffnen, Faktoren prüfen.
- ✅ **v0.10.0 ToDos & Ämtli-Plan** (E28): neuer Menüpunkt «ToDo». ToDos erfassen, mehreren Personen zuweisen, Fälligkeitsdatum, Notiz, privat (in der Datenbank geschützt), Meine/Alle, Erledigte ausblenden/löschen, Zähler in der Menüleiste. Ämtli mit Intervall (1–8 Wochen) und fixer oder abwechselnder Zuweisung, automatisch als ToDo in der fälligen Woche, unerledigte bleiben «überfällig», Übersicht pro Person und Woche. Getestet: Sicherheitsregeln mit PostgreSQL, App mit Playwright inkl. Wochenwechsel und Rotation, Abgleich mit nachgebautem Supabase. `update-0.10.sql` in Supabase ausführen (ANLEITUNG K).
- ✅ **v0.10.1**: Ämtli-Zuweisung «Niemand» heisst jetzt «Offen» (wer Zeit hat), auch in Liste, Vorschau und Übersicht.
- ✅ **v0.10.2**: ToDos pro Person anzeigen (Knöpfe mit den anderen Personen unter «Meine / Alle», mit Zähler). Private ToDos erscheinen nur unter «Meine». Neues ToDo in der Personen-Ansicht ist dieser Person zugewiesen.

## Wunschliste Detail-Anpassungen (Schritt 7)
- [x] Tagesplanung kopieren: einzelne Tage (auf mehrere Tage, auch in andere Wochen) und ganze Wochen (beliebige Woche), jeweils «Kopieren nach …» oder «Übernehmen von …» (v0.6.0, auf dem Handy getestet ✅)
- [x] Einkaufsliste getrennt nach «Lebensmittel» und «Anderes» mit Umschalter oben; neue Artikel gehen in die gewählte Sparte (v0.6.0, auf dem Handy getestet ✅)
- [ ] Export-Knopf: Sicherungsdatei aller Daten erstellen und wieder einlesen (zurückgestellt, siehe oben)
- [x] Nachkauf: Wird nach dem Einkauf im Plan mehr gebraucht, erscheint nur die zusätzliche Menge als offener Artikel («+ 200 g, Nachkauf · 200 g schon gekauft») (v0.7.1)

## Ideen ToDo für später (nicht beschlossen)
Ämtli pausieren (Ferien), Erinnerungen/Push-Benachrichtigungen, Punkte/Sackgeld-Zähler, «Einkaufen» als ToDo mit Link zur Einkaufsliste.

## Kalender – Konzept (Stand 26.10.2026, beschlossen, Umsetzung in K1–K5)
**Vorgabe Tobias:** Kalender nur, wenn er **mit Google (Gmail) verbunden und in der App änderbar** ist, später evtl. auch Microsoft 365 (eigenes Geschäft). Nur lesend einblenden (iCal-Link) ist **gestrichen**, weil man sich nicht auf die Termine verlassen könnte.
- **Gewünschte Ansicht:** Monatsraster mit Tagesliste. Beim Öffnen sind immer alle Personen sichtbar, Auswahl pro Person möglich. Termine: Titel, von/bis (Datum und Uhrzeit), ganztägig, mehrere Personen, Wiederholung.
- **Technik (Vorschlag):** Anmeldung mit dem Google-Konto über eine Supabase-Funktion. Die Funktion speichert den Zugangsschlüssel geschützt in der Datenbank und liest/schreibt Termine über die Google-Kalender-Schnittstelle. Die App zeigt eine Kopie, damit die Termine auch offline sichtbar sind. Personen = Google-Kalender (eigene, von Thadea freigegebene und ein gemeinsamer Familienkalender).
- **Google-Regeln:** Eigenes Google-Cloud-Projekt (gratis), App «in Produktion», aber nicht von Google geprüft. Dann erscheint einmalig der Hinweis «Google hat diese App nicht überprüft», bis 100 Personen. Im Testmodus würde die Anmeldung nach 7 Tagen ablaufen, darum Produktion.
- **Wünsche Tobias (26.10.2026):**
  - Online alle Termine sehen; **nur eigene ändern**. Bei fremden Terminen eine **Rückfrage** schicken können («Dein Termin geht nicht, bitte besprechen»).
  - **Übersicht nebeneinander/übereinander:** Termine aller Personen im gleichen Zeitraster, damit Überschneidungen auffallen.
  - **Betreuungs-Warnung:** Haben beide Eltern gleichzeitig einen Termin (z.B. abends Hockey + Termin Thadea), erhalten beide eine Warnung «Wer schaut auf die Kinder?». Dort erfassen: wer, wann, wo, wie betreut oder wer die Kinder mitnimmt.
  - Diese Zusatzinfos nur in der eigenen Datenbank (nicht in Google), aber **mit dem Google-Termin verknüpft**: Wird der Termin verschoben oder gelöscht, merkt die App das und reagiert.
- **Entscheide Tobias (26.10.2026, Sitzung 9):** Jede Person verbindet ihr eigenes Google-Konto; Kinder-/Familientermine in einem gemeinsamen Google-Familienkalender; ändern nur mit Internet; Wiederholungen «nur diesen» und «alle».

## Ideen für später (noch nicht entschieden)
- **Preisvergleich über KI** (Idee von Tobias, 26.10.2026): Preise der Einkaufsliste bei verschiedenen Läden vergleichen. Steht als Idee, wird nicht weiterverfolgt.
- **Menü-Vorlagen** (siehe «Zurückgestellt»).
- **Menü-Wünsche der Kinder**: Lieblingsgerichte markieren, Vorschlag beim Planen, wenn lange nicht mehr dran.
- **Notizen/Listen**: Punkte per Hand umsortieren, Listen als Vorlage kopieren (z.B. Packliste jedes Jahr), Datei/Foto anhängen.
- **Kalender-Integration**: Google-Kalender in der App anzeigen und/oder Menüplan als abonnierbaren Kalender. Braucht Phase 2 (Cloud) bzw. ein Google-Login.
- **Widgets** auf dem Startbildschirm (Einkaufsliste, Menü heute, Familienkalender). Geht nur mit der verpackten Android-App (Phase 3, Capacitor), nicht als reine Web-App.

## Abmachung
Erst alle Grundfunktionen bauen, Detail-Anpassungen sammeln wir und machen sie am Schluss (Schritt 7).

## Sitzungsprotokoll
- **26.10.2026 (10)**: K1 bei Tobias eingerichtet und läuft (Google «In Produktion» mit Datenschutzseite; 403 behoben mit Rechten für service_role). K2 (v0.15.0) gebaut nach Tobias' Antworten: Erfassen/Ändern/Löschen, Serien «nur diesen/alle», Personen im Titel. Neue Tests `tests/calendar-edit.mjs`, Funktionstests für Schreiben.
- **26.10.2026 (9)**: Kalender K1 (v0.14.0) gebaut: Supabase-Funktion `google-kalender` (Verbinden über Google, Schlüssel geschützt in `google_accounts`, Termine aller Konten des Haushalts), `update-0.14.sql`, Seite «Kalender» unter «Mehr» (Monatsraster, Tagesliste, Filter pro Person, Details, offline-Kopie). Tests: `tests/google-function.mjs` (Funktion gegen gefälschtes Google) und `tests/calendar.mjs`. Offene Fragen von Tobias beantwortet (siehe Konzept).
- **26.10.2026 (8)**: Kalender abgeklärt. Entscheide Tobias: kein Play Store (höchstens APK für Familie/Kollegen); Kalender nur mit echter Google-Verbindung und Bearbeiten in der App, iCal-Lesen gestrichen. Noch nichts gebaut.
- **26.10.2026 (7)**: v0.13.0 «Passwort ändern» (Karte «Gemeinsam nutzen»: bisheriges Passwort wird geprüft, neues mind. 8 Zeichen und anders, Wiederholung). Neuer Test `tests/password.mjs`. Reihenfolge mit Tobias: erst «ändern», dann «vergessen» mit E-Mail-Dienst.
- **26.10.2026 (6)**: v0.12.1 Menüleiste: Start-Knopf jetzt in der Mitte (Reihenfolge Einkauf, ToDo, Start, Notizen, Mehr), grösseres Symbol, in der Trennlinie ein Bogen nach oben um das Symbol. Nur Darstellung, keine Datenbank-Änderung.
- **26.10.2026 (5)**: v0.12.0 Startseite nach Tobias' Wünschen (Menü heute mit Link zum Menü, Meine ToDos, angeheftete und zuletzt geänderte Notizen/Listen). Menüleiste: 5 Knöpfe + «Mehr», Start hervorgehoben, App startet immer auf Start. Neu `nav.ts` (seitenübergreifendes Öffnen mit Rückweg). Automatische Tests jetzt im Ordner `tests/` (`bash tests/run-all.sh`).
- **26.10.2026 (4)**: v0.11.1: Notiz/Liste als ToDo anheften (✅ oben in der Notiz). Antworten von Tobias: «Für alle» = offen; Datum optional. Privat wird übernommen. ToDo trägt `noteId`; bei Wechsel der Notiz auf privat/geteilt (neue ID) folgt `noteId` mit. Neu: «Notiz öffnen» von anderen Seiten (`requestOpenNote` in `notes.ts`), später auch für die Startseite nutzbar.
- **26.10.2026 (3)**: v0.11.0 Notizen & Listen gebaut nach Tobias' Vorgaben (öffentlich, Schloss oben rechts für privat; Listen mit Unterpunkten; Pin = für mich, mehrere Pins = für alle, jede Person löst bei sich). Kein Datenbank-Update nötig (gleiche Tabelle `records`, Art `notes`, private über `owner_id` wie bei den ToDos). Neu: Listen/Pins werden beim Abgleich Punkt für Punkt zusammengeführt (E29). IndexedDB Version 7. Menüleiste jetzt mit 6 Knöpfen («Plan» statt «Wochenplan» als Knopfbeschriftung).
- **26.10.2026 (2)**: ToDo & Ämtli stehen. Neue Richtung beschlossen: gemeinsame Notizen/Listen (v0.11) und Startseite/Dashboard (v0.12) mit «Was kochen wir heute?» (Link zum Menü), eigenen ToDos und zuletzt geänderten Notizen/Listen; Kalender kommt später dazu. Menü-Vorlagen zurückgestellt, Datensicherung nicht dringend, Preisvergleich per KI nur als Idee.
- **26.10.2026**: v0.10.0 ToDos & Ämtli-Plan nach Tobias' Vorgaben (Zuweisung an alle Personen, auch mehrere; Ämtli mit Intervall + Rotation; Unerledigtes bleibt überfällig; dazu Fälligkeitsdatum/Notiz, Zähler, Übersicht pro Person, Erledigte ausblenden/löschen). Datenbank-Update `update-0.10.sql` (owner_id). IndexedDB Version 6 (Stores todos, chores).
- **22.10.2026**: Projekt gestartet. Schritt 1 gebaut und getestet (Familie anlegen, ändern, löschen; Neuladen offline). Claude kann nicht direkt auf GitHub hochladen, darum lädt Tobias mit GitHub Desktop hoch. Build mit esbuild statt Vite (siehe ENTSCHEIDUNGEN.md). GitHub Pages eingeschaltet, Test auf dem Handy erfolgreich (inkl. offline).
- **22.10.2026 (2)**: Schritt 2 Menüs gebaut: Einheiten g, kg, ml, l, Stk., Pck., Dose, Bund, EL, TL, Prise. Neue Zutaten sind automatisch «Lebensmittel». Mengen gelten standardmässig für die ganze Familie, umschaltbar auf «1 Portion von …». Datenbank auf Version 2 erweitert, bestehende Personen bleiben erhalten.
- **22.10.2026 (3)**: Schritt 3 Wochenplan gebaut nach Tobias' Vorgaben: Woche beginnt Montag; passende Menüs zuerst; Mahlzeiten pro Tag hinzufügen (Zwischenmahlzeit, z.B. Znüni/Zvieri) oder entfallen lassen (ausgegraut, wieder aktivierbar); mehrere Gerichte pro Mahlzeit; pro Mahlzeit Personen abwählen. Datenbank Version 3.
- **22.10.2026 (4)**: Schritt 4 Einkaufsliste gebaut: Zeitraum ist die angezeigte Woche (Mo–So). Rundung: Stk./Dose/Pck./Bund/Prise auf ganze Zahl, g/ml auf 10 (unter 10 auf 1), kg/l auf 0.1, EL/TL auf 0.5. Vorrats-Check (🏠) und Abhaken vorgezogen. Datenbank Version 4.
- **22.10.2026 (5)**: Schritt 5 gebaut: Artikel von Hand erfassen (Menge, Einheit optional, Sparte), alphabetisch sortiert, Vorschläge beim Tippen aus früheren Einträgen (mit ✕ dauerhaft löschbar), wiederkehrende Artikel mit Wochen-Intervall, «Erledigte ausblenden» (wieder einblendbar). Datenbank Version 5.
- **22.10.2026 (6)**: Detail-Anpassungen: Tage und Wochen kopieren / übernehmen; Einkaufsliste mit Umschalter Lebensmittel / Anderes (getrennt, weil man im Laden nacheinander einkauft).
- **22.10.2026 (7)**: Phase 2 beschlossen: Supabase. Datenbank-Aufbau (supabase/schema.sql) erstellt und lokal mit PostgreSQL getestet: Sicherheitsregeln (fremde Konten sehen nichts), Beitritt per Code, neuere Änderung gewinnt.
- **22.10.2026 (8)**: Phase 2 umgesetzt (v0.7.0): Anmeldung, Haushalt mit Einladungscode, Abgleich. Secret key wurde versehentlich im Chat geteilt – Tobias soll ihn in Supabase löschen/ersetzen.
- **22.10.2026 (9)**: Familie nutzt die App gemeinsam. v0.7.1: Nachkauf-Logik in der Einkaufsliste. Nächstes Thema: Familienkalender (Konzept in Abklärung).
- **22.10.2026 (10)**: v0.7.2: Nachkauf funktionierte nicht für Artikel, die noch mit v0.7.0 abgehakt wurden (keine gespeicherte Kaufmenge). Jetzt wird diese beim ersten Öffnen nachgetragen.
- **23.10.2026**: v0.8.0 Rollen & Personen: Beitritt nur mit Code + Vorname, «Wer bist du?», Admin/Mitglied, Admin sieht Mitglieder mit E-Mail und verwaltet sie, Faktoren aus eigener Sicht. Datenbank-Funktionen lokal mit PostgreSQL getestet, App mit Supabase-Nachbau und zwei simulierten Handys.
- **23.10.2026 (2)**: v0.9.0 Menü-Import: Knopf «⤓ Importieren» bei den Menüs. Link oder Rezepttext einfügen → «Import prüfen» (Originalzeile unter jeder Zutat, ⚠️ bei Unsicherem) → erst «Speichern» legt das Menü an. Mengen gelten für «n Portionen» laut Rezept. Link-Import über Supabase Edge Function `rezept-import`. Idee für später: Menü-Vorlagen.
- **23.10.2026 (3)**: v0.9.1: «Meine Portion» bei der Hauptzutat (oberste Zutat), Portionen aus eigener Sicht (Thadea 0.8 → ihre Portion ist 0.8 × Tobias). Getestet mit zwei simulierten Personen.
- **23.10.2026 (4)**: v0.9.2: Tobias hatte seinen eigenen Faktor geändert → alle anderen verschoben (1.01, 0.61). Patch: eigener Faktor fest, Tastatur-Eingabe, 0.05-Rundung, automatische Reparatur beim Ersteller.
