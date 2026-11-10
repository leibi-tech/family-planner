// Neuigkeiten (E55): Nur richtige Neuerungen (neue Funktion, etwas fällt weg oder geht anders),
// keine Kleinigkeiten wie «Knopf ist grösser». Neueste zuoberst.
// Auf der Startseite erscheint einmal eine Karte, ✕ blendet sie auf diesem Handy für immer aus.
// Alle Einträge stehen unter Einstellungen → Neuigkeiten.

export interface NewsItem {
  version: string; // App-Version, in der die Neuerung kam
  date: string; // TT.MM.JJJJ
  title: string;
  text: string;
}

export const NEWS: NewsItem[] = [
  {
    version: '0.33.0',
    date: '10.11.2026',
    title: 'Neuigkeiten',
    text: 'Kommt etwas Neues dazu, erscheint hier einmal ein kurzer Hinweis. Mit ✕ ist er weg. Alle Neuerungen kannst du unter Einstellungen → Neuigkeiten nachlesen.',
  },
  {
    version: '0.32.0',
    date: '10.11.2026',
    title: 'Teilen an die App',
    text: 'In Gmail, Drive oder der Galerie ein PDF oder Foto teilen → «myFam.» wählen. Es landet direkt bei den Dokumenten. In der Android-App ab Version 1.4.',
  },
  {
    version: '0.31.0',
    date: '10.11.2026',
    title: 'Datensicherung',
    text: 'Einstellungen → Datensicherung: eine Datei mit allen Einträgen und Dokumenten erstellen, z.B. in Google Drive ablegen. Gelöschtes lässt sich daraus zurückholen.',
  },
  {
    version: '0.30.0',
    date: '09.11.2026',
    title: 'Portionen in den Einstellungen',
    text: 'Die Portionenfaktoren pro Person stehen neu unter Einstellungen → Portionen pro Person. Die Seite Familie zeigt nur noch die Namen.',
  },
  {
    version: '0.28.0',
    date: '06.11.2026',
    title: 'Neuer Name «myFam.» und Einstellungen',
    text: 'Die App heisst jetzt myFam. Die Einstellungen sind eine eigene Seite, mit Datenschutzerklärung.',
  },
  {
    version: '0.26.0',
    date: '06.11.2026',
    title: 'Android-App',
    text: 'myFam. gibt es als Android-App. Zurück-Taste, Dokumente herunterladen und teilen. Ist eine neue Android-App bereit, steht ein Hinweis auf der Startseite.',
  },
  {
    version: '0.25.0',
    date: '03.11.2026',
    title: 'Einkaufsliste aus Menüs: «Fragen»',
    text: 'Einstellungen → Einkaufsliste aus Menüs: Aus, Fragen oder Ein. Bei «Fragen» kannst du die Zutaten nach dem Einplanen anpassen, bevor sie in die Liste kommen.',
  },
  {
    version: '0.23.0',
    date: '02.11.2026',
    title: 'Termine für andere mit Einladung',
    text: 'Wählst du beim Termin eine Person mit Gmail-Adresse, bekommt sie eine Einladung und hat den Termin auch in ihrem Kalender.',
  },
  {
    version: '0.21.0',
    date: '30.10.2026',
    title: 'Dokumente',
    text: 'Mehr → Dokumente: Versicherungen, Garantien, Quittungen scannen oder als PDF ablegen, mit Suche und Hinweis vor Ablauf. Privat (Schloss) oder für alle.',
  },
  {
    version: '0.20.0',
    date: '30.10.2026',
    title: 'Liebesgruss',
    text: 'Einen Text oder ein Foto auf den Startbildschirm des Partners schicken. Erst nach einer Reaktion geht die App auf.',
  },
  {
    version: '0.19.0',
    date: '30.10.2026',
    title: 'Neues Aussehen',
    text: 'Neue Farben und Symbole, Hell/Dunkel wählbar, die Menüleiste unten lässt sich selber einrichten.',
  },
  {
    version: '0.17.0',
    date: '28.10.2026',
    title: 'Wer schaut auf die Kinder?',
    text: 'Sind beide Eltern gleichzeitig weg, warnt die Startseite. Betreuung lässt sich direkt beim Termin festhalten.',
  },
  {
    version: '0.16.0',
    date: '28.10.2026',
    title: 'Kalender: Monat, Woche, Tag',
    text: 'In der Tagesansicht hat jede Person eine eigene Spalte, so sind Überschneidungen sofort sichtbar.',
  },
];

const KEY = 'fp-news-seen'; // höchste Version, deren Neuigkeit weggedrückt wurde

/** Versionen vergleichen: «0.33.0» > «0.9.2». */
export function cmpVersion(a: string, b: string): number {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d) return d;
  }
  return 0;
}

function seen(): string {
  try {
    const v = localStorage.getItem(KEY);
    // Noch nie etwas weggedrückt: nur die neueste Neuigkeit zeigen, nicht die ganze Liste
    if (v) return v;
  } catch {
    /* Speicher gesperrt */
  }
  return NEWS[1]?.version ?? '0';
}

/** Neuigkeiten, die auf diesem Handy noch nicht weggedrückt wurden (neueste zuerst). */
export function unseenNews(): NewsItem[] {
  const s = seen();
  return NEWS.filter((n) => cmpVersion(n.version, s) > 0);
}

/** ✕: alle angezeigten Neuigkeiten für immer ausblenden. */
export function dismissNews() {
  try {
    if (NEWS[0]) localStorage.setItem(KEY, NEWS[0].version);
  } catch {
    /* gilt dann nur bis zum Neuladen */
  }
}
