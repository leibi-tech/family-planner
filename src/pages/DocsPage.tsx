import { useEffect, useRef, useState } from 'react';
import { useRecords } from '../hooks';
import type { Person } from '../db';
import { useSync } from '../components/CloudCard';
import { useMe } from './TodoPage';
import { Scanner, type ScanResult } from '../components/Scanner';
import { extractJpegs, thumbOf, loadImage } from '../scan';
import {
  CATEGORIES,
  catLabel,
  deleteDoc,
  fmtDate,
  fmtSize,
  loadDocFile,
  MAX_SIZE,
  saveNewDoc,
  takeSharedFiles,
  untilState,
  updateDoc,
  usePendingFiles,
  type Category,
  type Doc,
} from '../docs';

interface Draft {
  blob: Blob;
  pages: number;
  thumb: string | null;
}

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** Dokumente: scannen oder Datei wählen, Angaben erfassen, ansehen, teilen. Dateien in der Cloud. */
export function DocsPage({ shared }: { shared?: boolean }) {
  const docs = useRecords<Doc>('docs');
  const persons = useRecords<Person>('persons');
  const me = useMe(persons);
  const sync = useSync();
  const { pending, error: upError } = usePendingFiles();
  const [scanFile, setScanFile] = useState<File | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [editing, setEditing] = useState<Doc | null>(null);
  const [viewId, setViewId] = useState<string | null>(null);
  const [cat, setCat] = useState<Category | 'alle'>('alle');
  const [q, setQ] = useState('');
  const [error, setError] = useState<string | null>(null);
  const camRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Alte Anmeldung vom NAS-Test (v0.18) entfernen
  useEffect(() => {
    try {
      ['fp-nas', 'fp-nas-did', 'fp-nas-last'].forEach((k) => localStorage.removeItem(k));
    } catch {
      /* egal */
    }
  }, []);

  /** Gewählte oder geteilte Datei: Foto → Scanner, PDF → direkt zu den Angaben. */
  const take = async (f: File | undefined) => {
    setError(null);
    if (!f) return;
    if (f.size > MAX_SIZE) return setError('Die Datei ist zu gross (höchstens 20 MB).');
    if (f.type === 'application/pdf' || /\.pdf$/i.test(f.name)) {
      const bytes = new Uint8Array(await f.arrayBuffer());
      const imgs = extractJpegs(bytes, 1);
      let thumb: string | null = null;
      if (imgs[0]) {
        try {
          thumb = thumbOf(await loadImage(imgs[0], 600));
        } catch {
          /* ohne Vorschau */
        }
      }
      const pages = (new TextDecoder('latin1').decode(bytes).match(/\/Type\s*\/Page(?!s)/g) ?? []).length || 1;
      setDraft({ blob: new Blob([bytes], { type: 'application/pdf' }), pages, thumb });
    } else if (f.type.startsWith('image/') || /\.(jpe?g|png|webp)$/i.test(f.name)) setScanFile(f);
    else setError('Diese Art Datei geht nicht. Bitte ein PDF oder ein Foto wählen.');
  };

  // Über «Teilen» aus einer anderen App geöffnet (z.B. Scan aus Google Drive)
  useEffect(() => {
    if (!shared) return;
    void takeSharedFiles().then((files) => {
      if (files.length) void take(files[0]);
    });
  }, [shared]);

  if (!docs || !persons) return <p className="muted center">Lade …</p>;

  if (scanFile)
    return (
      <Scanner
        first={scanFile}
        onCancel={() => setScanFile(null)}
        onDone={(r: ScanResult) => {
          setScanFile(null);
          setDraft({ blob: r.blob, pages: r.pages, thumb: r.thumb });
        }}
      />
    );

  if (draft || editing)
    return (
      <DocForm
        doc={editing}
        draft={draft}
        onCancel={() => {
          setDraft(null);
          setEditing(null);
        }}
        onSave={async (meta) => {
          if (editing) {
            await updateDoc(editing, meta);
            setEditing(null);
          } else if (draft) {
            const d = await saveNewDoc({ ...meta, thumb: draft.thumb, by: me }, draft.blob, draft.pages);
            setDraft(null);
            setViewId(d.id);
          }
        }}
      />
    );

  const view = viewId ? docs.find((d) => d.id === viewId) : undefined;
  if (view)
    return (
      <DocView
        doc={view}
        persons={persons}
        pending={pending.has(view.id)}
        cloud={!!sync.household}
        onClose={() => setViewId(null)}
        onEdit={() => setEditing(view)}
        onDelete={async () => {
          if (!confirm(`«${view.title}» löschen? Die Datei wird für alle gelöscht.`)) return;
          await deleteDoc(view);
          setViewId(null);
        }}
      />
    );

  const needle = q.trim().toLowerCase();
  const counts = new Map<string, number>();
  docs.forEach((d) => counts.set(d.category, (counts.get(d.category) ?? 0) + 1));
  const list = docs
    .filter((d) => cat === 'alle' || d.category === cat)
    .filter((d) => !needle || `${d.title} ${d.note} ${catLabel(d.category)}`.toLowerCase().includes(needle))
    .sort((a, b) => (b.date ?? '').localeCompare(a.date ?? '') || b.createdAt - a.createdAt);
  const soon = docs.filter((d) => untilState(d.until) === 'bald');

  return (
    <section className="docs">
      <input ref={camRef} type="file" accept="image/*" capture="environment" hidden data-testid="docs-camera" onChange={(e) => { void take(e.target.files?.[0]); e.target.value = ''; }} />
      <input ref={fileRef} type="file" accept="application/pdf,image/*" hidden data-testid="docs-file" onChange={(e) => { void take(e.target.files?.[0]); e.target.value = ''; }} />
      <div className="docs-add">
        <button className="docs-add-btn primary" onClick={() => camRef.current?.click()}>
          <ScanIcon />
          <span>Scannen</span>
        </button>
        <button className="docs-add-btn" onClick={() => fileRef.current?.click()}>
          <FileIcon />
          <span>PDF oder Foto wählen</span>
        </button>
      </div>
      {!sync.household && <p className="hint">Ohne «Gemeinsam nutzen» (unter Familie) bleiben die Dokumente nur auf diesem Handy.</p>}
      {error && (
        <p className="warn" role="alert">
          {error}
        </p>
      )}
      {sync.household && upError && pending.size > 0 && (
        <p className="warn" role="alert">
          Hochladen klappt nicht: {upError}
        </p>
      )}
      {soon.length > 0 && (
        <p className="docs-soon">
          Läuft bald ab: {soon.map((d) => `${d.title} (${fmtDate(d.until)})`).join(', ')}
        </p>
      )}

      {docs.length > 0 && (
        <>
          <input className="docs-search" type="search" placeholder="Suchen …" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Dokumente suchen" />
          <div className="chips docs-chips">
            <button className={'chip small' + (cat === 'alle' ? ' on' : '')} onClick={() => setCat('alle')}>
              Alle <span className="chip-count">{docs.length}</span>
            </button>
            {CATEGORIES.filter((c) => counts.has(c.id)).map((c) => (
              <button key={c.id} className={'chip small' + (cat === c.id ? ' on' : '')} onClick={() => setCat(c.id)}>
                {c.label} <span className="chip-count">{counts.get(c.id)}</span>
              </button>
            ))}
          </div>
        </>
      )}

      {docs.length === 0 ? (
        <p className="muted center docs-empty">Noch keine Dokumente. Scanne z.B. eine Quittung oder einen Garantieschein.</p>
      ) : list.length === 0 ? (
        <p className="muted center">Nichts gefunden.</p>
      ) : (
        <ul className="docs-list">
          {list.map((d) => {
            const st = untilState(d.until);
            return (
              <li key={d.id}>
                <button className="docs-row" onClick={() => setViewId(d.id)}>
                  <span className="docs-thumb">{d.thumb ? <img src={d.thumb} alt="" /> : <span className="docs-pdf">{d.file.type === 'application/pdf' ? 'PDF' : 'Bild'}</span>}</span>
                  <span className="docs-main">
                    <span className="docs-title">{d.title}</span>
                    <span className="docs-sub">
                      {catLabel(d.category)}
                      {d.date ? ' · ' + fmtDate(d.date) : ''}
                    </span>
                    {d.until && (
                      <span className={'docs-until' + (st ? ' ' + st : '')}>
                        {st === 'abgelaufen' ? 'abgelaufen ' : d.category === 'garantie' ? 'Garantie bis ' : 'gültig bis '}
                        {fmtDate(d.until)}
                      </span>
                    )}
                    {pending.has(d.id) && sync.household && <span className="docs-up">wird hochgeladen …</span>}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function DocForm({ doc, draft, onSave, onCancel }: { doc: Doc | null; draft: Draft | null; onSave: (m: Pick<Doc, 'title' | 'category' | 'date' | 'until' | 'note'>) => Promise<void>; onCancel: () => void }) {
  const [title, setTitle] = useState(doc?.title ?? '');
  const [category, setCategory] = useState<Category>(doc?.category ?? 'rechnung');
  const [date, setDate] = useState(doc ? doc.date ?? '' : today());
  const [until, setUntil] = useState(doc?.until ?? '');
  const [note, setNote] = useState(doc?.note ?? '');
  const [busy, setBusy] = useState(false);
  const thumb = doc?.thumb ?? draft?.thumb ?? null;
  const pages = doc?.file.pages ?? draft?.pages ?? 1;
  const size = doc?.file.size ?? draft?.blob.size ?? 0;
  return (
    <section className="docs-form">
      <h2>{doc ? 'Dokument bearbeiten' : 'Neues Dokument'}</h2>
      <div className="docs-form-file">
        {thumb ? <img src={thumb} alt="Vorschau" /> : <span className="docs-pdf">PDF</span>}
        <span className="muted">
          {pages} {pages === 1 ? 'Seite' : 'Seiten'} · {fmtSize(size)}
        </span>
      </div>
      <label className="field">
        <span>Titel</span>
        <input value={title} maxLength={120} placeholder="z.B. Waschmaschine Garantie" onChange={(e) => setTitle(e.target.value)} autoFocus={!doc} />
      </label>
      <div className="field">
        <span>Art</span>
        <div className="chips">
          {CATEGORIES.map((c) => (
            <button key={c.id} type="button" className={'chip small' + (category === c.id ? ' on' : '')} onClick={() => setCategory(c.id)}>
              {c.label}
            </button>
          ))}
        </div>
      </div>
      <label className="field">
        <span>{category === 'rechnung' || category === 'garantie' ? 'Kaufdatum / Datum' : 'Datum'}</span>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </label>
      <label className="field">
        <span>{category === 'garantie' ? 'Garantie bis' : 'Gültig bis'} (freiwillig)</span>
        <input type="date" value={until} onChange={(e) => setUntil(e.target.value)} />
      </label>
      <label className="field">
        <span>Notiz (freiwillig)</span>
        <textarea rows={3} value={note} maxLength={2000} onChange={(e) => setNote(e.target.value)} placeholder="z.B. Policen-Nr., Händler, Seriennummer" />
      </label>
      <div className="sheet-actions">
        <button
          className="btn btn-primary"
          disabled={busy || !title.trim()}
          onClick={async () => {
            setBusy(true);
            await onSave({ title: title.trim(), category, date: date || null, until: until || null, note: note.trim() });
          }}
        >
          Speichern
        </button>
        <button
          className="btn btn-ghost"
          onClick={() => {
            if (!doc && !confirm('Ohne Speichern zurück? Der Scan geht verloren.')) return;
            onCancel();
          }}
        >
          Abbrechen
        </button>
      </div>
    </section>
  );
}

function DocView({ doc, persons, pending, cloud, onClose, onEdit, onDelete }: { doc: Doc; persons: Person[]; pending: boolean; cloud: boolean; onClose: () => void; onEdit: () => void; onDelete: () => void }) {
  const [blob, setBlob] = useState<Blob | null>(null);
  const [urls, setUrls] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let alive = true;
    let made: string[] = [];
    setError(null);
    loadDocFile(doc)
      .then(async (b) => {
        if (!alive) return;
        setBlob(b);
        const imgs = b.type === 'application/pdf' ? extractJpegs(new Uint8Array(await b.arrayBuffer())) : [b];
        made = imgs.map((i) => URL.createObjectURL(i));
        if (alive) setUrls(made);
      })
      .catch((e) => alive && setError(e?.message || 'Die Datei lässt sich nicht laden.'));
    return () => {
      alive = false;
      made.forEach((u) => URL.revokeObjectURL(u));
    };
  }, [doc.id, doc.file.path, retry]);

  const file = () => new File([blob!], doc.file.name, { type: doc.file.type });
  const canShare = !!blob && typeof navigator.share === 'function' && (navigator.canShare?.({ files: [file()] }) ?? false);
  const download = () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob!);
    a.download = doc.file.name;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      URL.revokeObjectURL(a.href);
      a.remove();
    }, 1000);
  };
  const by = persons.find((p) => p.id === doc.by)?.name;
  const st = untilState(doc.until);

  return (
    <section className="docs-view">
      <button className="btn btn-ghost docs-back" onClick={onClose}>
        ‹ Alle Dokumente
      </button>
      <h2>{doc.title}</h2>
      <p className="docs-sub">
        {catLabel(doc.category)}
        {doc.date ? ' · ' + fmtDate(doc.date) : ''} · {doc.file.pages} {doc.file.pages === 1 ? 'Seite' : 'Seiten'} · {fmtSize(doc.file.size)}
      </p>
      {doc.until && (
        <p className={'docs-until' + (st ? ' ' + st : '')}>
          {st === 'abgelaufen' ? 'Abgelaufen am ' : doc.category === 'garantie' ? 'Garantie bis ' : 'Gültig bis '}
          {fmtDate(doc.until)}
        </p>
      )}
      {doc.note && <p className="docs-note">{doc.note}</p>}
      <p className="muted docs-by">
        {by ? `Erfasst von ${by}` : 'Erfasst'} am {new Date(doc.createdAt).toLocaleDateString('de-CH')}
        {pending ? (cloud ? ' · wird hochgeladen …' : ' · nur auf diesem Handy') : doc.file.path ? ' · in der Cloud gespeichert ✓' : ''}
      </p>

      <div className="docs-actions">
        {canShare && (
          <button className="btn btn-primary" onClick={() => void navigator.share({ files: [file()], title: doc.title }).catch(() => {})}>
            Teilen / öffnen mit …
          </button>
        )}
        <button className="btn" disabled={!blob} onClick={download}>
          Herunterladen
        </button>
      </div>

      {error ? (
        <div className="warn" role="alert">
          {error}
          <button className="btn btn-block" style={{ marginTop: 10 }} onClick={() => setRetry(retry + 1)}>
            Nochmals versuchen
          </button>
        </div>
      ) : !urls ? (
        <p className="muted center">Lade …</p>
      ) : urls.length === 0 ? (
        <p className="hint">Für dieses PDF gibt es in der App keine Vorschau. Mit «Herunterladen» oder «Teilen» öffnen.</p>
      ) : (
        <div className="docs-pages">
          {urls.map((u, i) => (
            <img key={u} src={u} alt={`Seite ${i + 1}`} />
          ))}
        </div>
      )}

      <div className="sheet-actions">
        <button className="btn" onClick={onEdit}>
          Angaben bearbeiten
        </button>
        <button className="btn btn-ghost-danger" onClick={onDelete}>
          Löschen
        </button>
      </div>
    </section>
  );
}

const ScanIcon = () => (
  <svg className="ico" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M4 8V5a1 1 0 011-1h3M16 4h3a1 1 0 011 1v3M20 16v3a1 1 0 01-1 1h-3M8 20H5a1 1 0 01-1-1v-3" />
    <path d="M8 9h8M8 12h8M8 15h5" />
  </svg>
);
const FileIcon = () => (
  <svg className="ico" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M7 3h7l5 5v13H7z" />
    <path d="M14 3v5h5M12 11v6M9 14l3-3 3 3" />
  </svg>
);
