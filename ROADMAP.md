# ROADMAP – Family-Planner

Stand: 22.10.2026 · Version 0.5.0

## Aktueller Stand
- ✅ **Schritt 1 – Grundgerüst + Familie**: App ist installierbar und läuft offline. Seite «Familie»: Personen mit Portionenfaktor erfassen, ändern und löschen. Startwerte: Tobias 1.0, Frau 0.8, Kind 1 0.4, Kind 2 0.4.
- ✅ **Schritt 2 – Menüs**: fertig, auf dem Handy getestet.
- ✅ **Schritt 3 – Wochenplan**: fertig, auf dem Handy getestet.
- ✅ **Schritt 4 – Einkaufsliste aus dem Plan** (inkl. Vorrats-Check und Abhaken): fertig.
- ✅ **Schritt 5 – Artikel von Hand, wiederkehrende Artikel, Vorschläge, Erledigte ausblenden**: gebaut und getestet, wartet auf Test auf dem Handy.
- ✅ **Online und getestet**: läuft unter https://leibi-tech.github.io/family-planner/, auf Tobias' Handy installiert, offline geprüft.

## Phase 1 – App lokal auf dem Handy (Ziel 1)
| Schritt | Inhalt | Status |
|---|---|---|
| 1 | Grundgerüst, Offline, Installierbar, Familie | ✅ fertig, getestet |
| 2 | Menüs: erstellen, bearbeiten, löschen. Zutaten mit Menge, Einheit und Sparte. Mengen «für ganze Familie» oder «für eine Person» | ✅ fertig, getestet |
| 3 | Wochenplan: Woche ab Montag, 3 Standard-Mahlzeiten pro Tag, Mahlzeit entfällt (ausgegraut) / Zwischenmahlzeit hinzufügen, mehrere Gerichte pro Mahlzeit, Menü wählen (passende zuerst) oder neu erstellen, Personen abwählen, Wochen wechseln und kopieren | ✅ fertig, getestet |
| 4 | Einkaufsliste aus dem Wochenplan: Mengen nach Faktor berechnen, runden, zusammenfassen, Herkunft anzeigen. Vorgezogen aus Schritt 5: Vorrats-Check mit Rückgängig, Abhaken im Laden | ✅ fertig |
| 5 | Einkaufsliste: Artikel von Hand (mit Vorschlägen aus früheren Einträgen, löschbar mit ✕), wiederkehrende Artikel (Intervall in Wochen), Erledigte ausblenden | ✅ gebaut, Handy-Test offen |
| 7 | Detail-Anpassungen (Wunschliste von Tobias, sammeln und am Schluss umsetzen) | offen |
| 6 | Datensicherung: Export/Import als Datei | offen (Vorschlag, noch nicht bestätigt) |

## Phase 2 – Gemeinsame Nutzung (Ziel 2)
Synchronisation über Supabase oder Firebase. Vorbereitet ist schon: Jeder Eintrag hat eine eindeutige ID, einen Änderungszeitpunkt und beim Löschen eine Löschmarke.

## Phase 3 – Google Play Store (Ziel 3)
Die PWA wird als Android-App verpackt (TWA oder Capacitor).

## Nächster Schritt
Damit sind alle Funktionen aus Phase 1 gebaut. Vorschlag für die Reihenfolge:
1. **Schritt 6 – Datensicherung** (Export/Import als Datei), damit keine Daten verloren gehen. Noch nicht bestätigt.
2. **Schritt 7 – Detail-Anpassungen** aus Tobias' Wunschliste.
3. Danach **Phase 2** (gemeinsame Nutzung mit der Frau).

## Abmachung
Erst alle Grundfunktionen bauen, Detail-Anpassungen sammeln wir und machen sie am Schluss (Schritt 7).

## Sitzungsprotokoll
- **22.10.2026**: Projekt gestartet. Schritt 1 gebaut und getestet (Familie anlegen, ändern, löschen; Neuladen offline). Claude kann nicht direkt auf GitHub hochladen, darum lädt Tobias mit GitHub Desktop hoch. Build mit esbuild statt Vite (siehe ENTSCHEIDUNGEN.md). GitHub Pages eingeschaltet, Test auf dem Handy erfolgreich (inkl. offline).
- **22.10.2026 (2)**: Schritt 2 Menüs gebaut: Einheiten g, kg, ml, l, Stk., Pck., Dose, Bund, EL, TL, Prise. Neue Zutaten sind automatisch «Lebensmittel». Mengen gelten standardmässig für die ganze Familie, umschaltbar auf «1 Portion von …». Datenbank auf Version 2 erweitert, bestehende Personen bleiben erhalten.
- **22.10.2026 (3)**: Schritt 3 Wochenplan gebaut nach Tobias' Vorgaben: Woche beginnt Montag; passende Menüs zuerst; Mahlzeiten pro Tag hinzufügen (Zwischenmahlzeit, z.B. Znüni/Zvieri) oder entfallen lassen (ausgegraut, wieder aktivierbar); mehrere Gerichte pro Mahlzeit; pro Mahlzeit Personen abwählen. Datenbank Version 3.
- **22.10.2026 (4)**: Schritt 4 Einkaufsliste gebaut: Zeitraum ist die angezeigte Woche (Mo–So). Rundung: Stk./Dose/Pck./Bund/Prise auf ganze Zahl, g/ml auf 10 (unter 10 auf 1), kg/l auf 0.1, EL/TL auf 0.5. Vorrats-Check (🏠) und Abhaken vorgezogen. Datenbank Version 4.
- **22.10.2026 (5)**: Schritt 5 gebaut: Artikel von Hand erfassen (Menge, Einheit optional, Sparte), alphabetisch sortiert, Vorschläge beim Tippen aus früheren Einträgen (mit ✕ dauerhaft löschbar), wiederkehrende Artikel mit Wochen-Intervall, «Erledigte ausblenden» (wieder einblendbar). Datenbank Version 5.
