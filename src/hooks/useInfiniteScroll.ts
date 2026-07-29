import { useState, useEffect, useCallback, useRef } from 'react';

interface InfiniteScrollOptions<T> {
  fetchFn: (page: number, limit: number) => Promise<{
    data: T[];
    pagination?: { total?: number; pages?: number; next?: any };
    total?: number;
  }>;
  limit?: number;
  threshold?: number;
  deps?: any[];
}

export function useInfiniteScroll<T>({ fetchFn, limit = 20, threshold = 200, deps = [] }: InfiniteScrollOptions<T>) {
  const [items, setItems] = useState<T[]>([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const loaderRef = useRef<HTMLDivElement | null>(null);
  const fetchingRef = useRef(false);
  const requestVersionRef = useRef(0);

  const loadPage = useCallback(async (targetPage: number, isReset = false) => {
    if (fetchingRef.current && !isReset) return;

    fetchingRef.current = true;
    const currentVersion = ++requestVersionRef.current;

    setLoading(true);
    setError(null);

    try {
      const res = await fetchFn(targetPage, limit);

      // Ignore stale responses if a newer request was dispatched
      if (currentVersion !== requestVersionRef.current) {
        return;
      }

      const newItems = res.data || [];
      const getItemId = (item: any) => item?._id || item?.id;

      setItems(prev => {
        if (targetPage === 1 || isReset) {
          return newItems;
        }
        const existingIds = new Set(prev.map(getItemId).filter(Boolean));
        const uniqueNew = newItems.filter(item => {
          const id = getItemId(item);
          return !id || !existingIds.has(id);
        });
        return [...prev, ...uniqueNew];
      });

      let more = false;
      const resTotal = res.total ?? (res as any).count ?? res.pagination?.total;
      if (typeof res.pagination?.pages === 'number') {
        more = targetPage < res.pagination.pages;
      } else if (res.pagination?.next) {
        more = true;
      } else if (typeof resTotal === 'number') {
        more = targetPage * limit < resTotal;
      } else {
        more = newItems.length >= limit;
      }

      setHasMore(more);
      setPage(targetPage + 1);
    } catch (err: any) {
      if (currentVersion === requestVersionRef.current) {
        setError(err.message || 'Failed to load data');
      }
    } finally {
      if (currentVersion === requestVersionRef.current) {
        setLoading(false);
        fetchingRef.current = false;
      }
    }
  }, [fetchFn, limit]);

  // Re-fetch page 1 when deps change
  const depsKey = JSON.stringify(deps);
  useEffect(() => {
    setPage(1);
    setHasMore(true);
    setItems([]);
    loadPage(1, true);
  }, [depsKey, loadPage]);

  // Infinite scroll observer for loading subsequent pages (page > 1)
  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting && hasMore && !loading && !fetchingRef.current) {
          loadPage(page);
        }
      },
      { rootMargin: `${threshold}px` }
    );

    if (loaderRef.current) {
      observer.observe(loaderRef.current);
    }

    return () => observer.disconnect();
  }, [hasMore, loading, page, loadPage, threshold]);

  const reset = useCallback(() => {
    setPage(1);
    setHasMore(true);
    setItems([]);
    loadPage(1, true);
  }, [loadPage]);

  return { items, loading, hasMore, error, loaderRef, reset };
}
