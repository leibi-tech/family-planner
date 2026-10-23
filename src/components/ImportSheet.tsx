import { useState } from 'react';
import { newId } from '../db';
import { fetchRecipeFromUrl } from '../cloud';
import type { Menu } from '../model';
import { extractUrl, fromWebRecipe, parseRecipeText, type ParsedRecipe } from '../recipeImport';

export interface ImportResult {
  menu: Menu; // noch nicht gespeichert
  sources: Record<string, { text: string; unsure: boolean }>;
}

/** Erkanntes Rezept in ein (ungespeichertes) Menü umwandeln. */
export function toMenu(r: ParsedRecipe, familyFactor: number): ImportResult {
  const sources: ImportResult['sources'] = {};
  const ingredients = r.ingredients.map((i) => {
    const id = newId();
    sources[id] = { text: i.source, unsure: i.unsure };
    return { id, product: i.product, amount: i.amount, unit: i.unit, category: i.category };
  });
  const portions = r.servings && r.servings > 0 ? r.servings : 4;
  return {
    menu: {
      id: newId(),
      name: r.name,
      mealTypes: r.mealTypes,
      // Rezept-Mengen gelten für n Portionen à Faktor 1.0. Ohne Angabe nehmen wir 4 an.
      basis: { kind: 'portions', portions, baseFactor: portions },
      ingredients,
      note: r.note,
      updatedAt: 0,
      deleted: false,
    },
    sources,
  };
}

export function ImportSheet({
  text,
  onText,
  familyFactor,
  onDone,
  onClose,
}: {
  text: string;
  onText: (t: string) => void;
  familyFactor: number;
  onDone: (r: ImportResult) => void;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const url = extractUrl(text);

  const paste = async () => {
    setError('');
    try {
      const t = await navigator.clipboard.readText();
      if (t) onText(t);
      else setError('Die Zwischenablage ist leer.');
    } catch {
      setError('Einfügen ging nicht. Bitte lange ins Feld tippen und «Einfügen» wählen.');
    }
  };

  const go = async () => {
    setError('');
    if (url) {
      setBusy(true);
      try {
        const web = await fetchRecipeFromUrl(url);
        const r = fromWebRecipe(web);
        if (!r.ingredients.length) throw new Error('Auf dieser Seite wurden keine Zutaten gefunden. Bitte den Rezepttext kopieren.');
        onDone(toMenu(r, familyFactor));
      } catch (e: any) {
        setError(e?.message || 'Das hat nicht geklappt.');
      } finally {
        setBusy(false);
      }
      return;
    }
    const r = parseRecipeText(text);
    if (!r.ingredients.length) {
      setError('Keine Zutaten erkannt. Jede Zutat sollte auf einer eigenen Zeile stehen, z.B. «400 g Spaghetti».');
      return;
    }
    onDone(toMenu(r, familyFactor));
  };

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet sheet-tall" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <h2>Menü importieren</h2>
        <p className="hint">
          Füge einen <b>Link</b> zu einem Rezept ein (z.B. von Fooby, Betty Bossi, Migusto, Chefkoch) oder kopiere den
          <b> Rezepttext</b> hinein. Danach kannst du alles prüfen und anpassen, bevor es gespeichert wird.
        </p>

        <button className="btn btn-block import-paste" onClick={paste} disabled={busy}>
          📋 Aus Zwischenablage einfügen
        </button>

        <label className="field">
          <span>Link oder Rezepttext</span>
          <textarea
            className="import-text"
            value={text}
            onChange={(e) => onText(e.target.value)}
            rows={9}
            placeholder={'https://fooby.ch/…\n\noder:\nSpaghetti Bolognese\nfür 4 Personen\n400 g Spaghetti\n1 Zwiebel\n…'}
          />
        </label>
        {url && <small className="muted">Link erkannt – das Rezept wird von der Webseite geholt.</small>}
        {error && <p className="err">{error}</p>}

        <div className="sheet-actions">
          <button className="btn btn-primary btn-block" onClick={go} disabled={busy || !text.trim()}>
            {busy ? 'Rezept wird geholt …' : 'Weiter zum Prüfen'}
          </button>
          {text && (
            <button className="btn btn-block" onClick={() => onText('')} disabled={busy}>
              Feld leeren
            </button>
          )}
          <button className="btn btn-block" onClick={onClose} disabled={busy}>
            Abbrechen
          </button>
        </div>
      </div>
    </div>
  );
}
