# Family-Planner

Familien-App (PWA): Familie, Menüs, Wochenplan, Einkaufsliste. Läuft offline, Daten lokal auf dem Gerät.

- App: https://leibi-tech.github.io/family-planner/
- Bedienung und Installation: [ANLEITUNG.md](ANLEITUNG.md)
- Stand und nächste Schritte: [ROADMAP.md](ROADMAP.md)
- Technische Entscheide: [ENTSCHEIDUNGEN.md](ENTSCHEIDUNGEN.md)

## Technik
- `src/`: Quellcode (React + TypeScript)
- `public/`: Vorlagen (HTML, Manifest, Service Worker, Icons)
- `scripts/build.mjs`: baut die App nach `docs/` (esbuild)
- `docs/`: fertige App, wird von GitHub Pages angezeigt
- `hochladen.bat`: lädt alles per Doppelklick auf GitHub hoch
