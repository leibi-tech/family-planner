import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { detectQuad, enhance, fullQuad, loadImage, makePdf, rotate90, thumbOf, toJpeg, warp, type Quad, type ScanFilter } from '../scan';

interface Page {
  jpeg: Uint8Array;
  width: number;
  height: number;
  url: string; // Vorschau
  thumb: string;
}

interface Edit {
  src: HTMLCanvasElement;
  quad: Quad;
  found: boolean; // Blatt automatisch gefunden
}

export interface ScanResult {
  blob: Blob;
  pages: number;
  thumb: string;
}

const FILTERS: Array<[ScanFilter, string]> = [
  ['farbe', 'Farbe'],
  ['sw', 'Schwarz-weiss'],
  ['original', 'Original'],
];
const FILTER_KEY = 'fp-scan-filter';
const readFilter = (): ScanFilter => {
  try {
    const v = localStorage.getItem(FILTER_KEY);
    if (v === 'farbe' || v === 'sw' || v === 'original') return v;
  } catch {
    /* egal */
  }
  return 'farbe';
};

/**
 * Scanner über den ganzen Bildschirm: Foto → Ecken des Blatts (automatisch gefunden, verschiebbar)
 * → gerade ziehen und aufhellen → weitere Seiten → ein PDF.
 */
export function Scanner({ first, onDone, onCancel }: { first: File; onDone: (r: ScanResult) => void; onCancel: () => void }) {
  const [pages, setPages] = useState<Page[]>([]);
  const [edit, setEdit] = useState<Edit | null>(null);
  const [filter, setFilterState] = useState<ScanFilter>(readFilter);
  const [busy, setBusy] = useState<string | null>('Foto wird geöffnet …');
  const [error, setError] = useState<string | null>(null);
  const camRef = useRef<HTMLInputElement>(null);
  const galRef = useRef<HTMLInputElement>(null);

  const setFilter = (f: ScanFilter) => {
    setFilterState(f);
    try {
      localStorage.setItem(FILTER_KEY, f);
    } catch {
      /* egal */
    }
  };

  const open = async (f: File | undefined) => {
    if (!f) return;
    setError(null);
    setBusy('Foto wird geöffnet …');
    // kurz warten, damit «Bitte warten» erscheint, bevor gerechnet wird
    await new Promise((r) => setTimeout(r, 30));
    try {
      const src = await loadImage(f);
      const q = detectQuad(src);
      setEdit({ src, quad: q ?? fullQuad(src.width, src.height), found: !!q });
    } catch {
      setError('Das Foto lässt sich nicht öffnen. Bitte nochmals versuchen.');
    }
    setBusy(null);
  };

  useEffect(() => {
    void open(first);
  }, []);

  // Vorschaubilder beim Schliessen freigeben
  const pagesRef = useRef(pages);
  pagesRef.current = pages;
  useEffect(() => () => pagesRef.current.forEach((p) => URL.revokeObjectURL(p.url)), []);

  const accept = async () => {
    if (!edit) return;
    setBusy('Seite wird bearbeitet …');
    await new Promise((r) => setTimeout(r, 30));
    try {
      const flat = enhance(warp(edit.src, edit.quad), filter);
      const blob = await toJpeg(flat, filter === 'original' ? 0.75 : 0.68);
      const page: Page = { jpeg: new Uint8Array(await blob.arrayBuffer()), width: flat.width, height: flat.height, url: URL.createObjectURL(blob), thumb: thumbOf(flat) };
      setPages((p) => [...p, page]);
      setEdit(null);
    } catch {
      setError('Die Seite konnte nicht bearbeitet werden.');
    }
    setBusy(null);
  };

  const rotate = () => {
    if (!edit) return;
    const src = rotate90(edit.src);
    const q = detectQuad(src);
    setEdit({ src, quad: q ?? fullQuad(src.width, src.height), found: !!q });
  };

  const finish = () => {
    const blob = makePdf(pages);
    onDone({ blob, pages: pages.length, thumb: pages[0].thumb });
  };

  const cancel = () => {
    if (pages.length && !confirm('Scan abbrechen? Die gescannten Seiten gehen verloren.')) return;
    onCancel();
  };

  return (
    <div className="scan" role="dialog" aria-modal="true" aria-label="Dokument scannen">
      <input ref={camRef} type="file" accept="image/*" capture="environment" hidden data-testid="scan-camera" onChange={(e) => { void open(e.target.files?.[0]); e.target.value = ''; }} />
      <input ref={galRef} type="file" accept="image/*" hidden data-testid="scan-gallery" onChange={(e) => { void open(e.target.files?.[0]); e.target.value = ''; }} />
      <div className="scan-head">
        <button className="btn btn-ghost" onClick={cancel}>
          Abbrechen
        </button>
        <span className="scan-title">{edit ? `Seite ${pages.length + 1}: Ecken prüfen` : `${pages.length} ${pages.length === 1 ? 'Seite' : 'Seiten'}`}</span>
      </div>

      {error && (
        <p className="warn" role="alert">
          {error}
        </p>
      )}
      {busy && <p className="scan-busy">{busy}</p>}

      {edit ? (
        <>
          <p className="hint scan-hint">
            {edit.found ? 'Blatt gefunden. Stimmen die Ecken nicht, die Punkte verschieben.' : 'Kein Blatt erkannt. Die vier Punkte an die Ecken des Blatts ziehen.'}
          </p>
          <CropView edit={edit} onQuad={(quad) => setEdit({ ...edit, quad })} />
          <div className="scan-tools">
            <button className="btn" onClick={rotate} disabled={!!busy}>
              ↻ Drehen
            </button>
            <button className="btn" onClick={() => setEdit({ ...edit, quad: fullQuad(edit.src.width, edit.src.height) })} disabled={!!busy}>
              Ganzes Bild
            </button>
          </div>
          <div className="seg seg3 scan-filter" role="group" aria-label="Filter">
            {FILTERS.map(([id, label]) => (
              <button key={id} className={filter === id ? 'on' : ''} onClick={() => setFilter(id)}>
                {label}
              </button>
            ))}
          </div>
          <div className="scan-actions">
            <button className="btn btn-primary btn-block" disabled={!!busy} onClick={() => void accept()}>
              Seite übernehmen
            </button>
            <button className="btn btn-ghost btn-block" disabled={!!busy} onClick={() => (pages.length ? setEdit(null) : onCancel())}>
              Foto verwerfen
            </button>
          </div>
        </>
      ) : (
        !busy && (
          <>
            <ul className="scan-pages">
              {pages.map((p, i) => (
                <li key={p.url}>
                  <img src={p.url} alt={`Seite ${i + 1}`} />
                  <span className="scan-num">{i + 1}</span>
                  <button className="scan-del" aria-label={`Seite ${i + 1} entfernen`} onClick={() => setPages(pages.filter((x) => x !== p))}>
                    ✕
                  </button>
                </li>
              ))}
            </ul>
            <div className="scan-actions">
              <button className="btn btn-block" onClick={() => camRef.current?.click()}>
                📷 Weitere Seite scannen
              </button>
              <button className="btn btn-ghost btn-block" onClick={() => galRef.current?.click()}>
                Weitere Seite aus der Galerie
              </button>
              <button className="btn btn-primary btn-block" disabled={!pages.length} onClick={finish}>
                Fertig ({pages.length} {pages.length === 1 ? 'Seite' : 'Seiten'})
              </button>
            </div>
          </>
        )
      )}
    </div>
  );
}

/** Foto mit vier verschiebbaren Eckpunkten. */
function CropView({ edit, onQuad }: { edit: Edit; onQuad: (q: Quad) => void }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [boxW, setBoxW] = useState(340);
  const drag = useRef<number | null>(null);
  const { src, quad } = edit;

  useLayoutEffect(() => {
    const m = () => setBoxW(boxRef.current?.clientWidth || 340);
    m();
    window.addEventListener('resize', m);
    return () => window.removeEventListener('resize', m);
  }, []);

  const maxH = Math.max(240, window.innerHeight * 0.56);
  const scale = Math.min(boxW / src.width, maxH / src.height);
  const dw = Math.round(src.width * scale);
  const dh = Math.round(src.height * scale);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    c.width = Math.round(dw * dpr);
    c.height = Math.round(dh * dpr);
    c.getContext('2d')!.drawImage(src, 0, 0, c.width, c.height);
  }, [src, dw, dh]);

  const move = (e: React.PointerEvent) => {
    if (drag.current === null || !svgRef.current) return;
    const r = svgRef.current.getBoundingClientRect();
    const x = Math.min(src.width, Math.max(0, (e.clientX - r.left) / scale));
    const y = Math.min(src.height, Math.max(0, (e.clientY - r.top) / scale));
    const q = [...quad] as Quad;
    q[drag.current] = { x, y };
    onQuad(q);
  };

  const pts = quad.map((p) => `${p.x * scale},${p.y * scale}`).join(' ');
  return (
    <div className="scan-crop" ref={boxRef}>
      <div className="scan-stage" style={{ width: dw, height: dh }}>
        <canvas ref={canvasRef} style={{ width: dw, height: dh }} />
        <svg
          ref={svgRef}
          width={dw}
          height={dh}
          className="scan-svg"
          onPointerMove={move}
          onPointerUp={() => (drag.current = null)}
          onPointerCancel={() => (drag.current = null)}
        >
          <polygon points={pts} className="scan-poly" />
          {quad.map((p, i) => (
            <g
              key={i}
              data-testid={'corner-' + i}
              data-x={Math.round(p.x)}
              data-y={Math.round(p.y)}
              onPointerDown={(e) => {
                drag.current = i;
                svgRef.current?.setPointerCapture(e.pointerId);
                e.preventDefault();
              }}
            >
              <circle cx={p.x * scale} cy={p.y * scale} r={26} className="scan-hit" />
              <circle cx={p.x * scale} cy={p.y * scale} r={13} className="scan-dot" />
            </g>
          ))}
        </svg>
      </div>
    </div>
  );
}
