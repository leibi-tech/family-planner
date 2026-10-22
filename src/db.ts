// Lokale Datenbank (IndexedDB) – bewusst schlank gehalten.
// Jeder Datensatz hat: id (weltweit eindeutig), updatedAt (Änderungszeitpunkt)
// und deleted (Löschmarke statt echtem Löschen). Das braucht es später für die
// Synchronisation zwischen zwei Handys (Ziel 2).

export interface BaseRecord {
  id: string;
  updatedAt: number;
  deleted: boolean;
}

export interface Person extends BaseRecord {
  name: string;
  factor: number; // Portionenfaktor, Tobias = 1.0
  sort: number;
}

const DB_NAME = 'family-planner';
const DB_VERSION = 4;
export const STORES = ['persons', 'menus', 'days', 'shopping'] as const;
export type StoreName = (typeof STORES)[number];

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('persons')) {
        const store = db.createObjectStore('persons', { keyPath: 'id' });
        const now = Date.now();
        const seed: Array<[string, number]> = [
          ['Tobias', 1.0],
          ['Frau', 0.8],
          ['Kind 1', 0.4],
          ['Kind 2', 0.4],
        ];
        seed.forEach(([name, factor], i) =>
          store.put({ id: newId(), name, factor, sort: i, updatedAt: now, deleted: false } satisfies Person),
        );
      }
      if (!db.objectStoreNames.contains('menus')) {
        db.createObjectStore('menus', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('days')) {
        db.createObjectStore('days', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('shopping')) {
        db.createObjectStore('shopping', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('meta')) {
        db.createObjectStore('meta');
      }
    };
    req.onsuccess = () => {
      const db = req.result;
      // Neue App-Version will die Datenbank erweitern → alte Verbindung schliessen.
      db.onversionchange = () => {
        db.close();
        location.reload();
      };
      resolve(db);
    };
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

export function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
}

// Einfache Benachrichtigung, damit die Anzeige nach jeder Änderung neu lädt.
const changes = new EventTarget();
export function onChange(store: StoreName, fn: () => void): () => void {
  const handler = () => fn();
  changes.addEventListener(store, handler);
  return () => changes.removeEventListener(store, handler);
}

export async function getAll<T extends BaseRecord>(store: StoreName): Promise<T[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const req = db.transaction(store, 'readonly').objectStore(store).getAll();
    req.onsuccess = () => resolve((req.result as T[]).filter((r) => !r.deleted));
    req.onerror = () => reject(req.error);
  });
}

export async function put<T extends BaseRecord>(store: StoreName, record: T): Promise<void> {
  const db = await openDb();
  const rec = { ...record, updatedAt: Date.now() };
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    tx.objectStore(store).put(rec);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  changes.dispatchEvent(new Event(store));
}

/** Löschen = Löschmarke setzen (für spätere Synchronisation). */
export async function remove<T extends BaseRecord>(store: StoreName, record: T): Promise<void> {
  await put(store, { ...record, deleted: true });
}

/** Bittet den Browser, die Daten nicht automatisch zu löschen (Speicher knapp). */
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    if (!navigator.storage?.persist) return false;
    if (await navigator.storage.persisted()) return true;
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}
