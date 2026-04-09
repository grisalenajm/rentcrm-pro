import { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '../lib/api';

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface UseInfiniteListResult<T> {
  items: T[];
  total: number;
  hasMore: boolean;
  loading: boolean;
  loadingMore: boolean;
  sentinelRef: (el: HTMLDivElement | null) => void;
  reload: () => void;
}

export function useInfiniteList<T = any>({
  url,
  filters,
  limit,
}: {
  url: string;
  filters: Record<string, any>;
  limit: number;
}): UseInfiniteListResult<T> {
  const [items, setItems]             = useState<T[]>([]);
  const [total, setTotal]             = useState(0);
  const [hasMore, setHasMore]         = useState(true);
  const [loading, setLoading]         = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  // Refs for use inside stable callbacks (avoid stale closures)
  const pageRef     = useRef(0);
  const hasMoreRef  = useRef(true);
  const busyRef     = useRef(false);
  const urlRef      = useRef(url);
  const filtersRef  = useRef(filters);
  const limitRef    = useRef(limit);
  const observerRef = useRef<IntersectionObserver | null>(null);

  // Sentinel element ref — needed to post-load auto-fill check
  const sentinelElRef = useRef<HTMLElement | null>(null);

  // Cooldown: blocks observer fires immediately after a page load.
  // After the cooldown expires we check if the scroll container still has
  // room and auto-fill if so (handles the "items don't fill screen" case).
  const cooldownRef      = useRef(false);
  const cooldownTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep refs in sync
  useEffect(() => { urlRef.current     = url;     }, [url]);
  useEffect(() => { filtersRef.current = filters; }, [filters]);
  useEffect(() => { limitRef.current   = limit;   }, [limit]);

  // Stable fetch function — reads from refs to stay current
  const fetchPage = useCallback(async (pageNum: number, append: boolean) => {
    if (busyRef.current) return;
    busyRef.current = true;
    if (!append) setLoading(true); else setLoadingMore(true);

    try {
      const params: Record<string, any> = { page: pageNum, limit: limitRef.current };
      for (const [k, v] of Object.entries(filtersRef.current)) {
        if (v !== '' && v !== null && v !== undefined) params[k] = v;
      }
      const res = await api.get<PaginatedResponse<T>>(urlRef.current, { params });
      const result = res.data;

      pageRef.current    = pageNum;
      hasMoreRef.current = result.hasMore;
      setTotal(result.total);
      setHasMore(result.hasMore);
      if (append) {
        setItems(prev => [...prev, ...result.data]);
      } else {
        setItems(result.data);
      }
    } catch {
      hasMoreRef.current = false;
      setHasMore(false);
    } finally {
      busyRef.current = false;
      if (!append) setLoading(false); else setLoadingMore(false);

      // ── Cooldown + auto-fill ───────────────────────────────────────
      // Block the observer for a short window so DOM reflows triggered by
      // the new items don't cascade into immediate next-page fetches.
      // After the cooldown, if the scroll container still isn't scrollable
      // (content fits entirely on screen), load the next page automatically
      // until the container becomes scrollable or there's no more data.
      cooldownRef.current = true;
      if (cooldownTimerRef.current) clearTimeout(cooldownTimerRef.current);
      cooldownTimerRef.current = setTimeout(() => {
        cooldownRef.current = false;
        if (hasMoreRef.current && !busyRef.current && sentinelElRef.current) {
          const container = sentinelElRef.current.closest('main') as HTMLElement | null;
          if (container && container.scrollHeight <= container.clientHeight) {
            // Content doesn't yet fill the scroll container — auto-load more.
            loadMoreRef.current();
          }
        }
      }, 150);
    }
  }, []); // stable — no deps, uses refs

  // Stable loadMore — called by IntersectionObserver
  const loadMoreRef = useRef<() => void>(() => {});
  loadMoreRef.current = () => {
    if (!hasMoreRef.current || busyRef.current || cooldownRef.current) return;
    fetchPage(pageRef.current + 1, true);
  };

  // Reset + initial fetch whenever url / filters / limit change
  const filtersJson = JSON.stringify(filters);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    pageRef.current    = 0;
    hasMoreRef.current = true;
    busyRef.current    = false;
    cooldownRef.current = false;
    if (cooldownTimerRef.current) clearTimeout(cooldownTimerRef.current);
    setItems([]);
    setTotal(0);
    setHasMore(true);
    fetchPage(1, false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, filtersJson, limit]);

  // Sentinel callback — creates observer once per element mount.
  // Uses the nearest <main> as root so intersection is measured against
  // the actual scroll container, not the browser viewport.
  const sentinelRef = useCallback((el: HTMLDivElement | null) => {
    sentinelElRef.current = el;
    if (observerRef.current) {
      observerRef.current.disconnect();
      observerRef.current = null;
    }
    if (!el) return;
    const scrollParent = el.closest('main') as HTMLElement | null;
    observerRef.current = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && !cooldownRef.current) {
        loadMoreRef.current();
      }
    }, { root: scrollParent, threshold: 0 });
    observerRef.current.observe(el);
  }, []); // stable

  useEffect(() => {
    return () => {
      observerRef.current?.disconnect();
      if (cooldownTimerRef.current) clearTimeout(cooldownTimerRef.current);
    };
  }, []);

  const reload = useCallback(() => {
    pageRef.current     = 0;
    hasMoreRef.current  = true;
    busyRef.current     = false;
    cooldownRef.current = false;
    if (cooldownTimerRef.current) clearTimeout(cooldownTimerRef.current);
    setItems([]);
    setTotal(0);
    setHasMore(true);
    fetchPage(1, false);
  }, [fetchPage]);

  return { items, total, hasMore, loading, loadingMore, sentinelRef, reload };
}
