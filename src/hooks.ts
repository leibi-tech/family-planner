import { useEffect, useState } from 'react';
import { getAll, onChange, type BaseRecord, type StoreName } from './db';

/** Liest alle Einträge einer Tabelle und aktualisiert sich bei Änderungen. */
export function useRecords<T extends BaseRecord>(store: StoreName): T[] | undefined {
  const [rows, setRows] = useState<T[] | undefined>(undefined);
  useEffect(() => {
    let alive = true;
    const load = () =>
      getAll<T>(store).then((r) => {
        if (alive) setRows(r);
      });
    load();
    const off = onChange(store, load);
    return () => {
      alive = false;
      off();
    };
  }, [store]);
  return rows;
}
