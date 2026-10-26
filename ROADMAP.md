# ROADMAP – Family-Planner

Stand: 23.10.2026 · Version 0.9.2

## Aktueller Stand
- ✅ **Schritt 1 – Grundgerüst + Familie**: App ist installierbar und läuft offline. Seite «Familie»: Personen mit Portionenfaktor erfassen, ändern und löschen. Startwerte: Tobias 1.0, Frau 0.8, Kind 1 0.4, Kind 2 0.4.
- ✅ **Schritt 2 – Menüs**: fertig, auf dem Handy getestet.
- ✅ **Schritt 3 – Wochenplan**: fertig, auf dem Handy getestet.
- ✅ **Schritt 4 – Einkaufsliste aus dem Plan** (inkl. Vorrats-Check und Abhaken): fertig, getestet.
- 🎉 **Alle Grundfunktionen von Phase 1 laufen auf dem Handy.**
- ✅ **Schritt 5 – Artikel von Hand, wiederkehrende Artikel, Vorschläge, Erledigte ausblenden**: fertig, auf dem Handy getestet.
- ✅ **Online und getestet**: läuft unter https://leibi-tech.github.io/family-planner/, auf Tobias' Handy installiert, offline geprüft.

## Phase 1 – App lokal auf dem Handy (Ziel 1)
| Schritt | Inhalt | Status |
|---|---|---|
| 1 | Grundgerüst, Offline, Installierbar, Familie | ✅ fertig, getestet |
| 2 | Menüs: erstellen, bearbeiten, löschen. Zutaten mit Menge, Einheit und Sparte. Mengen «für ganze Familie» oder «für eine Person» | ✅ fertig, getestet |
| 3 | Wochenplan: Woche ab Montag, 3 Standard-Mahlzeiten pro Tag, Mahlzeit entfällt (ausgegraut) / Zwischenmahlzeit hinzufügen, mehrere Gerichte pro Mahlzeit, Menü wählen (passende zuerst) oder neu erstellen, Personen abwählen, Wochen wechseln und kopieren | ✅ fertig, getestet |
| 4 | Einkaufsliste aus dem Wochenplan: Mengen nach Faktor berechnen, runden, zusammenfassen, Herkunft anzeigen. Vorgezogen aus Schritt 5: Vorrats-Check mit Rückgängig, Abhaken im Laden | ✅ fertig |
| 5 | Einkaufsliste: Artikel von Hand (mit Vorschlägen aus früheren Einträgen, löschbar mit ✕), wiederkehrende Artikel (Intervall in Wochen), Erledigte ausblenden | ✅ fertig, getestet |
| 7 | Detail-Anpassungen (Wunschliste von Tobias, sammeln und am Schluss umsetzen) | offen |
| 6 | Datensicherung: Export/Import als Datei | offen (Vorschlag, noch nicht bestätigt) |

## Phase 2 – Gemeinsame Nutzung (Ziel 2)
Synchronisation über Supabase oder Firebase. Vorbereitet ist schon: Jeder Eintrag hat eine eindeutige ID, einen Änderungszeitpunkt und beim Löschen eine Löschmarke.

## Phase 3 – Google Play Store (Ziel 3)
Die PWA wird als Android-App verpackt (TWA oder Capacitor).

## Nächster Schritt
**Phase 2 (Supabase, Zürich)**
1. ✅ Supabase eingerichtet (Projekt hkakelobqtbyliszrils, Region Zürich, «Confirm email» aus, schema.sql ausgeführt).
2. ✅ v0.7.0 gebaut: Konto (E-Mail + Passwort), Haushalt erstellen / mit Code beitreten, automatischer Abgleich (offline-fähig). Getestet mit einem Supabase-Nachbau und zwei simulierten Handys.
3. ⏳ Tobias: hochladen, Konto + Haushalt erstellen, Partnerin einladen, testen.
4. Danach: Wunschliste (Export-Knopf u.a.), später E-Mail-Dienst für «Passwort vergessen» (vor Play Store).

## Wunschliste Detail-Anpassungen (Schritt 7)
- [x] Tagesplanung kopieren: einzelne Tage (auf mehrere Tage, auch in andere Wochen) und ganze Wochen (beliebige Woche), jeweils «Kopieren nach …» oder «Übernehmen von …» (v0.6.0, auf dem Handy getestet ✅)
- [x] Einkaufsliste getrennt nach «Lebensmittel» und «Anderes» mit Umschalter oben; neue Artikel gehen in die gewählte Sparte (v0.6.0, auf dem Handy getestet ✅)
- [ ] Export-Knopf: Sicherungsdatei aller Daten erstellen und wieder einlesen

- [x] Nachkauf: Wird nach dem Einkauf im Plan mehr gebraucht, erscheint nur die zusätzliche Menge als offener Artikel («+ 200 g, Nachkauf · 200 g schon gekauft») (v0.7.1)

## Als Nächstes
- ✅ v0.8.1 (Rollen & Personen) eingespielt, Datenbank-Update in Supabase ausgeführt. Tipp: Im SQL Editor muss oben rechts «Database» stehen, nicht «Logs».
- ⏳ **v0.9.0 Menü-Import aus Text oder Link**: gebaut und getestet (Text-Import, Prüfen-Ansicht, Link-Import gegen nachgebaute Funktion). Tobias: hochladen, Supabase-Funktion «rezept-import» einrichten (ANLEITUNG Abschnitt I), mit echten Rezepten testen. Foto: Text mit Google Lens kopieren und einfügen. Stufe 2 (Foto mit KI) später nach Bedarf.
- ⏳ **v0.9.1 «Meine Portion»**: Bei importierten Menüs Portionsmenge der Hauptzutat direkt anpassen; Portionen gelten aus Sicht der erfassenden Person. Tobias: hochladen und testen.
- ⏳ **v0.9.2 Faktoren-Patch**: eigener Faktor nicht mehr änderbar, Eingabe per Tastatur, Rundung auf 0.05, einmalige Reparatur der verschobenen Faktoren. Tobias: hochladen, «Familie» öffnen, Faktoren prüfen.
- ⏳ **v0.10.0 ToDos & Ämtli-Plan** (E28): neuer Menüpunkt «ToDo». ToDos erfassen, mehreren Personen zuweisen, Fälligkeitsdatum, Notiz, privat (in der Datenbank geschützt), Meine/Alle, Erledigte ausblenden/löschen, Zähler in der Menüleiste. Ämtli mit Intervall (1–8 Wochen) und fixer oder abwechselnder Zuweisung, automatisch als ToDo in der fälligen Woche, unerledigte bleiben «überfällig», Übersicht pro Person und Woche. Getestet: Sicherheitsregeln mit PostgreSQL (andere Konten sehen/ändern private Einträge nicht), App mit Playwright inkl. Wochenwechsel und Rotation, Abgleich mit nachgebautem Supabase. **Tobias: hochladen, `update-0.10.sql` in Supabase ausführen (ANLEITUNG K), testen.**
- ⏳ **v0.10.1**: Ämtli-Zuweisung «Niemand» heisst jetzt «Offen» (wer Zeit hat), auch in Liste, Vorschau und Übersicht. Tobias: hochladen.
- Ideen ToDo für später (nicht beschlossen): Ämtli pausieren (Ferien), Erinnerungen/Push-Benachrichtigungen, Punkte/Sackgeld-Zähler, «Einkaufen» als ToDo mit Link zur Einkaufsliste.
- Danach: **Menü-Vorlagen** (eingebaute Sammlung typischer Familienmenüs, «Aus Vorlage»). Tobias liefert eine Liste von Lieblingsmenüs.
- Danach: Kalender (Konzept unten).

## Kalender – Konzept in Abklärung (22.10.2026)
Ihr nutzt **Google Kalender** und **Outlook/Microsoft**. Tobias möchte noch überlegen, was gebraucht wird und was sinnvoll ist. Eigener Tab «Kalender» ist gewünscht.
- **Bausteine:**
  - A) Private Kalender lesend einblenden (Google: geheimer iCal-Link; Outlook: Kalender veröffentlichen, evtl. nur «verfügbar/beschäftigt»)
  - B) Familien-Termine direkt in der App («betrifft auch», «isst nicht mit»)
  - C) Familienkalender als Abo in Google/Outlook anzeigen
  - D) Vorschlag im Wochenplan bei Abendterminen («Abendessen ohne Tobias?»)
- **Technik:** Für A und C braucht es eine kleine Server-Funktion bei Supabase (Edge Function), weil die App fremde Kalender nicht direkt abrufen darf. In Google/Outlook direkt schreiben (Einladungen verschicken) wäre deutlich aufwendiger (Google-/Microsoft-Freigaben, beim Geschäftskonto evtl. IT-Bewilligung) und ist vorerst nicht geplant.
- **Offene Fragen an Tobias und Thadea:** Wo erfasst ihr Termine heute, und soll das so bleiben? Was nervt heute am meisten? Braucht es Termine der Kinder? Braucht es Erinnerungen/Benachrichtigungen? Darf der Geschäftskalender rein, ganz oder nur «beschäftigt»?

## Ideen für später (noch nicht entschieden)
- **Kalender-Integration**: Google-Kalender in der App anzeigen und/oder Menüplan als abonnierbaren Kalender. Braucht Phase 2 (Cloud) bzw. ein Google-Login.
- **Familienkalender** in der App (stand schon im Auftrag unter «Später»).
- **Widgets** auf dem Startbildschirm (Einkaufsliste, Menü heute, Familienkalender). Geht nur mit der verpackten Android-App (Phase 3, Capacitor), nicht als reine Web-App.

## Abmachung
Erst alle Grundfunktionen bauen, Detail-Anpassungen sammeln wir und machen sie am Schluss (Schritt 7).

## Sitzungsprotokoll
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
- **23.10.2026 (4)**: v0.9.2: Tobias hatte seinen eigenen Faktor geändert → alle anderen verschoben (1.01, 0.61). Patch: eigener Faktor fest, Tastatur-Eingabe, 0.05-Rundung, automatische Reparatur beim Ersteller.
- **23.10.2026 (3)**: v0.9.1: «Meine Portion» bei der Hauptzutat (oberste Zutat), Portionen aus eigener Sicht (Thadea 0.8 → ihre Portion ist 0.8 × Tobias). Getestet mit zwei simulierten Personen.
- **23.10.2026 (2)**: v0.9.0 Menü-Import: Knopf «⤓ Importieren» bei den Menüs. Link oder Rezepttext einfügen → «Import prüfen» (Originalzeile unter jeder Zutat, ⚠️ bei Unsicherem) → erst «Speichern» legt das Menü an. Mengen gelten für «n Portionen» laut Rezept. Link-Import über Supabase Edge Function `rezept-import`. Idee für später: Menü-Vorlagen.
- **23.10.2026**: v0.8.0 Rollen & Personen: Beitritt nur mit Code + Vorname, «Wer bist du?», Admin/Mitglied, Admin sieht Mitglieder mit E-Mail und verwaltet sie, Faktoren aus eigener Sicht. Datenbank-Funktionen lokal mit PostgreSQL getestet, App mit Supabase-Nachbau und zwei simulierten Handys.
