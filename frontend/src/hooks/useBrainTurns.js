/**
 * P0-A FE-2 — Brain Turns hook
 *
 * GET /api/v1/brain/turns?limit=50 on mount with cursor pagination.
 * Filter by context_type locally (re-fetch on filter change).
 * Accepts optional thread_id for per-thread scope.
 *
 * NO MOCK DATA. Real HTTP against AgentRuntime gateway :7801.
 */

import { useState, useEffect, useCallback } from "react";
import { getApiBase } from "@/lib/useGateway";

const GATEWAY_BASE = getApiBase() || "http://127.0.0.1:7801";

async function fetchTurns({ threadId, limit = 50, cursor, contextType }) {
  const params = new URLSearchParams();
  params.set("limit", String(limit));
  if (threadId) params.set("thread_id", threadId);
  if (cursor) params.set("cursor", cursor);
  if (contextType) params.set("context_type", contextType);

  const res = await fetch(`${GATEWAY_BASE}/api/v1/brain/turns?${params}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Turns fetch failed: HTTP ${res.status}`);
  const payload = await res.json();
  return {
    items: payload.items || [],
    nextCursor: payload.next_cursor || null,
    total: payload.total || 0,
  };
}

export function useBrainTurns({ threadId, contextType, limit = 50 } = {}) {
  const [turns, setTurns] = useState([]);
  const [cursor, setCursor] = useState(null);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [loadingMore, setLoadingMore] = useState(false);

  const load = useCallback(async (isLoadMore = false) => {
    if (isLoadMore) setLoadingMore(true);
    else setLoading(true);

    try {
      const result = await fetchTurns({
        threadId,
        limit,
        cursor: isLoadMore ? cursor : null,
        contextType,
      });
      if (isLoadMore) {
        setTurns(prev => [...prev, ...result.items]);
      } else {
        setTurns(result.items);
      }
      setCursor(result.nextCursor);
      setTotal(result.total);
      setError(null);
    } catch (err) {
      setError(err.message || String(err));
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [threadId, limit, cursor, contextType]);

  useEffect(() => {
    setTurns([]);
    setCursor(null);
    load(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threadId, contextType]);

  const loadMore = useCallback(() => {
    if (cursor && !loadingMore) {
      load(true);
    }
  }, [cursor, loadingMore, load]);

  return { turns, total, loading, error, loadingMore, loadMore, hasMore: !!cursor, refresh: () => load(false) };
}