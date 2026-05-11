/**
 * Phase 0.3 — <BindGroup>
 *
 *   <BindGroup prefix="ui.appearance." title="Appearance" />
 *
 * Renders every config key whose name starts with `prefix` as a vertical
 * stack of <Bind>s. Subscribes to /api/ws/config so newly-registered keys
 * appear without reload.
 */
import React, { useCallback, useEffect, useState } from "react";
import { C } from "@/lib/constants";
import { EmptyState, Skeleton } from "@/components/kit";
import { apiUrl } from "@/lib/useGateway";
import { subscribeConfigWs } from "@/hooks/useConfigBus";
import { Bind } from "./Bind";

async function fetchAllKeys() {
  const res = await fetch(apiUrl("/api/v2/config"));
  if (!res.ok) throw new Error(`Config list failed: ${res.status}`);
  const data = await res.json();
  // Backend may return {ok:true, data:{items: [...]}} or {items:[...]} or [...]
  const payload = data?.data || data;
  const items = payload?.items || payload || [];
  return Array.isArray(items)
    ? items.map((it) => it.key || it._id).filter(Boolean)
    : [];
}

export function BindGroup({ prefix, title, description, dataTestid }) {
  const [keys, setKeys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const all = await fetchAllKeys();
      const filtered = all.filter((k) => k.startsWith(prefix));
      filtered.sort();
      setKeys(filtered);
      setError(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [prefix]);

  useEffect(() => {
    reload();
  }, [reload]);

  // Re-fetch when keys are added/removed in this prefix
  useEffect(() => {
    return subscribeConfigWs((msg) => {
      if (
        msg.type === "config.bulk" ||
        ((msg.type === "config.set" || msg.type === "config.deleted") &&
          typeof msg.key === "string" && msg.key.startsWith(prefix))
      ) {
        reload();
      }
    });
  }, [prefix, reload]);

  const testid = dataTestid || `bind-group-${prefix}`;

  return (
    <div data-testid={testid} className="space-y-3">
      {title && (
        <div>
          <h2 className="text-[14px] font-semibold" style={{ color: C.text }}>
            {title}
          </h2>
          {description && (
            <p className="text-[12px]" style={{ color: C.muted }}>
              {description}
            </p>
          )}
        </div>
      )}

      {loading && keys.length === 0 ? (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div
              key={i}
              className="p-4 rounded-[var(--mc-radius-md)] space-y-2"
              style={{ background: C.surface, border: `1px solid ${C.border}` }}
            >
              <Skeleton height={14} width="40%" />
              <Skeleton height={32} width="100%" />
            </div>
          ))}
        </div>
      ) : error ? (
        <div
          className="p-3 rounded-[var(--mc-radius-md)] text-[12px]"
          style={{ background: C.errSoft, color: C.red }}
          data-testid={`${testid}-error`}
        >
          {error}
          <button
            type="button"
            onClick={reload}
            className="ml-2 px-2 py-0.5 rounded text-[11px]"
            style={{ background: C.surface2, color: C.muted }}
          >
            Retry
          </button>
        </div>
      ) : keys.length === 0 ? (
        <EmptyState
          title="No keys match this prefix"
          description={`No config keys begin with "${prefix}". Add one with <Bind to="${prefix}…" defaultSchema={…} /> to see it appear here.`}
        />
      ) : (
        <div className="space-y-3">
          {keys.map((k) => (
            <Bind key={k} to={k} />
          ))}
        </div>
      )}
    </div>
  );
}

export default BindGroup;
