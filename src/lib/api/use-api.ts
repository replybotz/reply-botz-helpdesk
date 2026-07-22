'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiFetch, ApiError } from './client';

interface ApiResult<T> {
  /** Which fetch `version` this result belongs to. */
  version: number;
  /** Which path this result was fetched from. */
  path: string | null;
  data: T | null;
  error: string;
}

/**
 * Load data from the app's API with loading/error state and a `reload()`
 * for refreshing after mutations. Pass `null` to skip fetching.
 */
export function useApi<T>(path: string | null) {
  const [version, setVersion] = useState(0);
  const [result, setResult] = useState<ApiResult<T>>({ version: -1, path: null, data: null, error: '' });

  useEffect(() => {
    if (path === null) return;
    let cancelled = false;

    apiFetch<T>(path)
      .then((data) => {
        if (!cancelled) setResult({ version, path, data, error: '' });
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setResult({
            version,
            path,
            data: null,
            error: err instanceof ApiError ? err.message : 'Something went wrong',
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [path, version]);

  const reload = useCallback(() => setVersion((v) => v + 1), []);

  // Loading whenever the current (path, version) hasn't produced a result
  // yet — including after a path change, not just reload().
  const loading = path !== null && (result.version !== version || result.path !== path);

  return {
    data: loading ? null : result.data,
    error: loading ? '' : result.error,
    loading,
    reload,
  };
}
