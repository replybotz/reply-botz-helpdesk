'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiFetch, ApiError } from './client';

interface ApiResult<T> {
  /** Which fetch `version` this result belongs to. */
  version: number;
  data: T | null;
  error: string;
}

/**
 * Load data from the app's API with loading/error state and a `reload()`
 * for refreshing after mutations. Pass `null` to skip fetching.
 */
export function useApi<T>(path: string | null) {
  const [version, setVersion] = useState(0);
  const [result, setResult] = useState<ApiResult<T>>({ version: -1, data: null, error: '' });

  useEffect(() => {
    if (path === null) return;
    let cancelled = false;

    apiFetch<T>(path)
      .then((data) => {
        if (!cancelled) setResult({ version, data, error: '' });
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setResult({
            version,
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

  return {
    data: result.data,
    error: result.error,
    loading: path !== null && result.version !== version,
    reload,
  };
}
