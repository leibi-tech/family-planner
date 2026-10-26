# ROADMAP – Family-Planner

Stand: 26.10.2026 · Version 0.11.1

## Aktueller Stand
- ✅ **Schritt 1 – Grundgerüst + Familie**: App ist installierbar und läuft offline. Seite «Familie»: Personen mit Portionenfaktor erfassen, ändern und löschen. Startwerte: Tobias 1.0, Frau 0.8, Kind 1 0.4, Kind 2 0.4.
- ✅ **Schritt 2 – Menüs**: fertig, auf dem Handy getestet.
- ✅ **Schritt 3 – Wochenplan**: fertig, auf dem Handy getestet.
- ✅ **Schritt 4 – Einkaufsliste aus dem Plan** (inkl. Vorrats-Check und Abhaken): fertig, getestet.
- 🎉 **Alle Grundfunktionen von Phase 1 laufen auf dem Handy.**
- ✅ **Schritt 5 – Artikel von Hand, wiederkehrende Artikel, Vorschläge, Erledigte ausblenden**: fertig, auf dem Handy getestet.
- ✅ **Online und getestet**: läuft unter https://leibi-tech.github.io/family-planner/, auf Tobias' Handy installiert, offline geprüft.
- ✅ **ToDos & Ämtli-Plan (v0.10.x)**: steht (26.10.2026).
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

## Phase 3 – Google Play Store (Ziel 3)
Die PWA wird als Android-App verpackt (TWA oder Capacitor).

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
2. **v0.12 Startseite / Dashboard** (wird zur ersten Seite beim Öffnen)
   - **Was kochen wir heute?** Menüs von heute (Frühstück/Mittag/Abend). Antippen öffnet direkt das Menü.
   - **Meine ToDos** (fällige und überfällige zuerst), Antippen öffnet das ToDo, Abhaken direkt möglich.
   - **Angeheftete Notizen/Listen** und **zuletzt geänderte** Einträge, mit Link.
   - **Später: Kalender** (Termine von heute/den nächsten Tagen), sobald der Kalender gebaut ist.
   - Menüleiste unten bleibt wie überall angeheftet. Bei 7 Knöpfen (Start, Plan, Einkauf, ToDo, Notizen, Menüs, Familie) wird es eng: Vorschlag «Mehr»-Knopf für Menüs und Familie, mit Tobias klären.
3. **Kalender** (Konzept unten), danach im Dashboard einblenden.
4. Kleinigkeiten, wenn Zeit: «Passwort vergessen» (E-Mail-Dienst, spätestens vor dem Play Store), Export-Knopf (siehe Datensicherung).

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

## Kalender – Konzept in Abklärung (22.10.2026)
Ihr nutzt **Google Kalender** und **Outlook/Microsoft**. Tobias möchte noch überlegen, was gebraucht wird und was sinnvoll ist. Eigener Tab «Kalender» ist gewünscht. Termine von heute sollen später auch auf der Startseite erscheinen.
- **Bausteine:**
  - A) Private Kalender lesend einblenden (Google: geheimer iCal-Link; Outlook: Kalender veröffentlichen, evtl. nur «verfügbar/beschäftigt»)
  - B) Familien-Termine direkt in der App («betrifft auch», «isst nicht mit»)
  - C) Familienkalender als Abo in Google/Outlook anzeigen
  - D) Vorschlag im Wochenplan bei Abendterminen («Abendessen ohne Tobias?»)
- **Technik:** Für A und C braucht es eine kleine Server-Funktion bei Supabase (Edge Function), weil die App fremde Kalender nicht direkt abrufen darf. In Google/Outlook direkt schreiben (Einladungen verschicken) wäre deutlich aufwendiger (Google-/Microsoft-Freigaben, beim Geschäftskonto evtl. IT-Bewilligung) und ist vorerst nicht geplant.
- **Offene Fragen an Tobias und Thadea:** Wo erfasst ihr Termine heute, und soll das so bleiben? Was nervt heute am meisten? Braucht es Termine der Kinder? Braucht es Erinnerungen/Benachrichtigungen? Darf der Geschäftskalender rein, ganz oder nur «beschäftigt»?

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
