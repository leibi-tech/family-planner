# ROADMAP – Family-Planner

Stand: 22.10.2026 · Version 0.1.0

## Aktueller Stand
- ✅ **Schritt 1 – Grundgerüst + Familie**: App ist installierbar und läuft offline. Seite «Familie»: Personen mit Portionenfaktor erfassen, ändern und löschen. Startwerte: Tobias 1.0, Frau 0.8, Kind 1 0.4, Kind 2 0.4.
- ⏳ **Wartet auf Tobias**: Git installieren, erstes Hochladen, GitHub Pages einschalten, auf dem Handy testen (siehe ANLEITUNG.md).

## Phase 1 – App lokal auf dem Handy (Ziel 1)
| Schritt | Inhalt | Status |
|---|---|---|
| 1 | Grundgerüst, Offline, Installierbar, Familie | ✅ gebaut, Test offen |
| 2 | Menüs: erstellen, bearbeiten, löschen. Zutaten mit Menge, Einheit und Sparte. Mengen «für ganze Familie» oder «für eine Person» | offen |
| 3 | Wochenplan: 7 Tage × 3 Mahlzeiten, Menü wählen oder neu erstellen, wer isst mit, Wochen wechseln und kopieren | offen |
| 4 | Einkaufsliste aus dem Wochenplan: Mengen nach Faktor berechnen, runden, zusammenfassen, Herkunft anzeigen | offen |
| 5 | Einkaufsliste: manuelle Artikel, wiederkehrende Artikel, Vorrats-Check mit Rückgängig, Abhaken im Laden, Erledigte löschen | offen |
| 6 | Datensicherung: Export/Import als Datei | offen (Vorschlag, noch nicht bestätigt) |

## Phase 2 – Gemeinsame Nutzung (Ziel 2)
Synchronisation über Supabase oder Firebase. Vorbereitet ist schon: Jeder Eintrag hat eine eindeutige ID, einen Änderungszeitpunkt und beim Löschen eine Löschmarke.

## Phase 3 – Google Play Store (Ziel 3)
Die PWA wird als Android-App verpackt (TWA oder Capacitor).

## Nächster Schritt
Sobald Schritt 1 auf dem Handy läuft, kommt **Schritt 2: Menüs**. Vorher klären:
- Welche Einheiten brauchst du? Vorschlag: g, kg, ml, l, Stk., Pck., EL, TL, Prise.
- Sollen Menüs auch ein Foto haben? Das steht noch nicht im Auftrag.

## Sitzungsprotokoll
- **22.10.2026**: Projekt gestartet. Schritt 1 gebaut und getestet (Familie anlegen, ändern, löschen; Neuladen offline). Claude kann nicht direkt auf GitHub hochladen, darum lädt Tobias mit `hochladen.bat` hoch. Build mit esbuild statt Vite (siehe ENTSCHEIDUNGEN.md).
