import { useEffect, useState, useCallback } from 'react';
import { getStore, type DataStore } from '@/data/store';

// ============================================================
// useDataStore — React hook that provides the data store
// ============================================================
// Components use this hook to access the data layer. The
// store implementation (in-memory now, Supabase later) is
// injected via getStore(). This keeps the UI decoupled from
// the persistence mechanism.
// ============================================================

export function useDataStore(): DataStore {
  return getStore();
}

export function useAsync<T>(
  factory: () => Promise<T>,
  deps: unknown[]
): { data: T | null; loading: boolean; error: string | null; refresh: () => void } {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [counter, setCounter] = useState(0);

  const refresh = useCallback(() => setCounter((c) => c + 1), []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    factory()
      .then((result) => {
        if (!cancelled) {
          setData(result);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, counter]);

  return { data, loading, error, refresh };
}
