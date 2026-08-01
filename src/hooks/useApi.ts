import { useState, useEffect, useCallback, useRef } from 'react';
import type { ApiResponse } from '@/lib/api';

interface UseApiOptions {
  immediate?: boolean;
}

export function useApi<T>(
  fetcher: () => Promise<ApiResponse<T>>,
  deps: unknown[] = [],
  options: UseApiOptions = { immediate: true }
) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(options.immediate !== false);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  const execute = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetcher();
      if (mountedRef.current) setData(res.data);
      return res;
    } catch (e) {
      if (mountedRef.current) setError(e instanceof Error ? e.message : 'Unknown error');
      return null;
    } finally {
      if (mountedRef.current) setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    mountedRef.current = true;
    if (options.immediate !== false) execute();
    return () => { mountedRef.current = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [execute]);

  return { data, loading, error, execute, setData };
}

interface UsePaginatedOptions {
  limit?: number;
  initialPage?: number;
}

export function usePaginated<T>(
  fetcher: (params: Record<string, string | number | undefined>) => Promise<ApiResponse<T[]>>,
  filters: Record<string, string | number | undefined> = {},
  options: UsePaginatedOptions = {}
) {
  const { limit = 25, initialPage = 1 } = options;
  const [data, setData] = useState<T[]>([]);
  const [page, setPage] = useState(initialPage);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasNext, setHasNext] = useState(false);
  const [hasPrev, setHasPrev] = useState(false);
  const [total, setTotal] = useState(0);
  const mountedRef = useRef(true);

  const filtersKey = JSON.stringify(filters);

  const fetchPage = useCallback(async (p: number) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetcher({ ...filters, page: p, limit });
      if (mountedRef.current) {
        setData(res.data);
        setTotal(res.total !== undefined ? res.total : (res.count || 0));
        setHasNext(!!res.pagination?.next);
        setHasPrev(!!res.pagination?.prev);
        setPage(p);
      }
    } catch (e) {
      if (mountedRef.current) setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      if (mountedRef.current) setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtersKey, limit]);

  useEffect(() => {
    mountedRef.current = true;
    fetchPage(1);
    return () => { mountedRef.current = false; };
  }, [fetchPage]);

  const nextPage = () => { if (hasNext) fetchPage(page + 1); };
  const prevPage = () => { if (hasPrev) fetchPage(page - 1); };
  const goToPage = (p: number) => fetchPage(p);
  const refresh = () => fetchPage(page);

  return { data, page, loading, error, hasNext, hasPrev, total, nextPage, prevPage, goToPage, refresh, setData };
}
