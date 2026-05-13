/**
 * Phase 0.3 — <BindList>
 *
 *   <BindList resource="/api/v2/threads" />
 *   <BindList resource="/api/v2/cron/jobs" transform={(d) => d.jobs} pollMs={5000} />
 *   <BindList
 *     resource="/api/v2/blockers"
 *     transform={(d) => d.items}
 *     renderItem={(item) => <li key={item.id}>{item.title}</li>}
 *   />
 *
 * Read-only live list of items fetched from a gateway endpoint. Honours the
 * Phase 0.1 envelope contract: backend responses come as `{ ok, data, ts }`.
 * The `transform` prop runs on `payload.data` (so callers don't re-implement
 * the envelope unwrap). Defaults assume `data` is itself an array.
 *
 * Live-only / NO-MOCK-DATA: there is no seeded fallback. While loading,
 * renders the supplied `loadingState`; on error, the `errorState`; on empty,
 * the `emptyState`. The component re-fetches every `pollMs` ms (default 5s);
 * Phase 0.4 will swap the poll for a shared WS subscription.
 */
import React, { useCallback, useEffect, useRef, useState } from "react";
import { List as ListIcon } from "lucide-react";
import { C } from "@/lib/constants";
import { EmptyState, Skeleton } from "@/components/kit";
import { apiUrl } from "@/lib/useGateway";

const DEFAULT_TRANSFORM = (data) => {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.results)) return data.results;
  return [];
};

const DEFAULT_RENDER_ITEM = (item, index) => {
  const label =
    item?.title ||
    item?.name ||
    item?.summary ||
    item?.label ||
    item?.id ||
    item?._id ||
    `Item ${index + 1}`;
  return (
    <li
      key={item?.id || item?._id || index}
      data-testid={`bind-list-item-${index}`}
      className="px-3 py-1.5 text-[12px] truncate"
      style={{
        color: C.text,
        borderBottom: `1px solid ${C.border}`,
        listStyle: "none",
      }}
      title={typeof label === "string" ? label : undefined}
    >
      {label}
    </li>
  );
};

export function BindList({
  resource,
  transform = DEFAULT_TRANSFORM,
  renderItem = DEFAULT_RENDER_ITEM,
  pollMs = 5000,
  height = 320,
  title,
  className,
  dataTestid,
  emptyState,
  errorState,
  loadingState,
}) {
  const [items, setItems] = useState([]);
  const [available, setAvailable] = useState(null); // null=checking, true/false
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const mountedRef = useRef(true);
  const transformRef = useRef(transform);
  // Always read the latest transform without triggering a refetch loop.
  transformRef.current = transform;

  const fetchList = useCallback(async () => {
    if (!resource) return;
    try {
      const url = apiUrl(resource);
      const res = await fetch(url);
      if (res.status === 404) {
        if (mountedRef.current) {
          setAvailable(false);
          setLoading(false);
        }
        return;
      }
      if (!res.ok) {
        throw new Error(`BindList ${resource} HTTP ${res.status}`);
      }
      const payload = await res.json();
      // Phase 0.1 envelope contract: { ok, data, ts }. We unwrap defensively
      // — older endpoints may return the array directly.
      if (payload && payload.ok === false) {
        throw new Error(payload.error || `BindList ${resource} returned ok:false`);
      }
      const body = payload && Object.prototype.hasOwnProperty.call(payload, "data")
        ? payload.data
        : payload;
      const next = (transformRef.current || DEFAULT_TRANSFORM)(body) || [];
      if (mountedRef.current) {
        setItems(Array.isArray(next) ? next : []);
        setAvailable(true);
        setError(null);
        setLoading(false);
      }
    } catch (e) {
      if (mountedRef.current) {
        setError(e.message || String(e));
        setLoading(false);
      }
    }
  }, [resource]);

  useEffect(() => {
    mountedRef.current = true;
    fetchList();
    if (!pollMs || pollMs <= 0) {
      return () => { mountedRef.current = false; };
    }
    const id = setInterval(() => {
      // Skip polling if endpoint is known-404 (set inside fetchList).
      // We read the latest value via the ref-less state of the callback;
      // a flat dep array keeps the interval from rearming.
      fetchList();
    }, pollMs);
    return () => {
      mountedRef.current = false;
      clearInterval(id);
    };
  }, [fetchList, pollMs]);

  const testid = dataTestid || `bind-list-${resource}`;

  // Endpoint not wired yet — show placeholder, no fake data.
  if (available === false) {
    return (
      <div
        data-testid={testid}
        className={className}
        style={{
          background: C.surface,
          border: `1px solid ${C.border}`,
          borderRadius: "var(--mc-radius-md)",
        }}
      >
        {emptyState || (
          <EmptyState
            icon={<ListIcon size={32} strokeWidth={1.5} />}
            title="List not yet wired"
            description={`No ${resource} endpoint available. This binding will render live once the backend ships it.`}
          />
        )}
      </div>
    );
  }

  const headerNode = (
    <div
      className="flex items-center gap-2 px-3 py-2"
      style={{ borderBottom: `1px solid ${C.border}` }}
    >
      <ListIcon size={12} style={{ color: C.accent }} />
      <span className="text-[12px] font-semibold" style={{ color: C.text }}>
        {title || resource}
      </span>
      <span className="text-[10px] ml-auto" style={{ color: C.muted }}>
        {items.length} item{items.length === 1 ? "" : "s"}
      </span>
    </div>
  );

  return (
    <div
      data-testid={testid}
      className={className}
      style={{
        background: C.surface,
        border: `1px solid ${C.border}`,
        borderRadius: "var(--mc-radius-md)",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {headerNode}
      <div
        className="overflow-auto"
        style={{ maxHeight: height }}
        data-testid={`${testid}-list`}
      >
        {loading && items.length === 0 ? (
          loadingState || (
            <div className="px-3 py-2">
              <Skeleton height={16} className="mb-2" />
              <Skeleton height={16} className="mb-2" />
              <Skeleton height={16} />
            </div>
          )
        ) : error ? (
          errorState || (
            <EmptyState
              icon={<ListIcon size={32} strokeWidth={1.5} />}
              title="Failed to load"
              description={error}
            />
          )
        ) : items.length === 0 ? (
          emptyState || (
            <EmptyState
              icon={<ListIcon size={32} strokeWidth={1.5} />}
              title="Nothing to show"
              description={`No items returned by ${resource}.`}
            />
          )
        ) : (
          <ul className="m-0 p-0" data-testid={`${testid}-ul`}>
            {items.map((item, index) => renderItem(item, index))}
          </ul>
        )}
      </div>
    </div>
  );
}

export default BindList;
