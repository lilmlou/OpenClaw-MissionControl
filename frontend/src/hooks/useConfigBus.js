/**
 * Phase 0.2 — Config Bus Hooks
 *
 * useConfigSchema(key)     → { schema, ui, loading, error }
 * useConfigValue(key)      → { value, set, version, loading }
 * useConfigCategory(cat)   → { keys, schemas, values }
 * useConfigBulk(keys)      → { values, schemas, bulkSet }
 *
 * All hooks subscribe to /api/ws/config (via the existing gateway WS – NOT a
 * second socket) so changes from other tabs / agents push through < 1s.
 */
import { useState, useEffect, useCallback, useRef } from "react";
import { apiUrl, getApiBase } from "@/lib/useGateway";

// ─── Derive WS URL from API base ──────────────────────────────────────────────
function configWsUrl(path) {
  const base = getApiBase();
  if (base) {
    const wsBase = base.startsWith("https://")
      ? base.replace("https://", "wss://")
      : base.replace("http://", "ws://");
    return `${wsBase}${path}`;
  }
  const wsProto = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${wsProto}//${window.location.host}${path}`;
}

// ─── Shared WS singleton for config bus ──────────────────────────────────────
let configWs = null;
let configWsReady = false;
let configWsReconnectTimer = null;
const configWsListeners = new Set(); // (event) => void

function ensureConfigWs() {
  if (configWs && (configWs.readyState === WebSocket.OPEN || configWs.readyState === WebSocket.CONNECTING)) {
    return;
  }
  clearTimeout(configWsReconnectTimer);
  try {
    configWs = new WebSocket(configWsUrl("/api/ws/config"));
    configWs.onopen = () => {
      configWsReady = true;
    };
    configWs.onclose = () => {
      configWsReady = false;
      configWs = null;
      configWsReconnectTimer = setTimeout(ensureConfigWs, 3000);
    };
    configWs.onerror = () => {
      configWsReady = false;
    };
    configWs.onmessage = (ev) => {
      let msg;
      try { msg = JSON.parse(ev.data); } catch { return; }
      configWsListeners.forEach(fn => { try { fn(msg); } catch {} });
    };
  } catch {
    configWsReconnectTimer = setTimeout(ensureConfigWs, 5000);
  }
}

function subscribeConfigWs(fn) {
  configWsListeners.add(fn);
  ensureConfigWs();
  return () => configWsListeners.delete(fn);
}

// ─── API helpers ──────────────────────────────────────────────────────────────
async function fetchConfigValue(key) {
  const res = await fetch(apiUrl(`/api/v2/config/${encodeURIComponent(key)}`));
  if (!res.ok) throw new Error(`Config fetch failed: ${res.status}`);
  const payload = await res.json();
  if (payload && payload.ok === false) throw new Error(payload.error || "Config fetch failed");
  return payload.data;
}

async function fetchConfigSchema(key) {
  const res = await fetch(apiUrl(`/api/v2/config/schema/${encodeURIComponent(key)}`));
  if (!res.ok) throw new Error(`Schema fetch failed: ${res.status}`);
  const payload = await res.json();
  if (payload && payload.ok === false) throw new Error(payload.error || "Schema fetch failed");
  return payload.data;
}

async function putConfigValue(key, value, expectedVersion) {
  const body = { value };
  if (expectedVersion !== undefined) body.expected_version = expectedVersion;
  const res = await fetch(apiUrl(`/api/v2/config/${encodeURIComponent(key)}`), {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw Object.assign(new Error(err.detail || `PUT failed: ${res.status}`), { status: res.status, detail: err });
  }
  const payload = await res.json();
  if (payload && payload.ok === false) throw new Error(payload.error || "PUT failed");
  return payload.data;
}

async function deleteConfigValue(key) {
  const res = await fetch(apiUrl(`/api/v2/config/${encodeURIComponent(key)}`), { method: "DELETE" });
  if (!res.ok) throw new Error(`DELETE failed: ${res.status}`);
  const payload = await res.json();
  if (payload && payload.ok === false) throw new Error(payload.error || "DELETE failed");
  return payload.data;
}

async function fetchConfigCategories() {
  const res = await fetch(apiUrl("/api/v2/config/categories"));
  if (!res.ok) throw new Error(`Categories fetch failed: ${res.status}`);
  const payload = await res.json();
  if (payload && payload.ok === false) throw new Error(payload.error || "Categories fetch failed");
  return payload.data.categories;
}

async function fetchConfigByCategory(category) {
  const res = await fetch(apiUrl(`/api/v2/config?category=${encodeURIComponent(category)}`));
  if (!res.ok) throw new Error(`Category config fetch failed: ${res.status}`);
  const payload = await res.json();
  if (payload && payload.ok === false) throw new Error(payload.error || "Category config fetch failed");
  return payload.data;
}

// ─── useConfigSchema ─────────────────────────────────────────────────────────
export function useConfigSchema(key) {
  const [state, setState] = useState({ schema: null, ui: null, loading: !!key, error: null });

  useEffect(() => {
    if (!key) return;
    setState(s => ({ ...s, loading: true, error: null }));
    fetchConfigSchema(key)
      .then(data => setState({ schema: data.schema || data, ui: data.ui_schema || null, loading: false, error: null }))
      .catch(err => setState({ schema: null, ui: null, loading: false, error: err.message }));
  }, [key]);

  return state;
}

// ─── useConfigValue ──────────────────────────────────────────────────────────
export function useConfigValue(key) {
  const [state, setState] = useState({ value: undefined, version: undefined, loading: !!key, error: null });

  const reload = useCallback(async () => {
    if (!key) return;
    setState(s => ({ ...s, loading: true, error: null }));
    try {
      const data = await fetchConfigValue(key);
      setState({ value: data.value, version: data.version, loading: false, error: null });
    } catch (err) {
      setState(s => ({ ...s, loading: false, error: err.message }));
    }
  }, [key]);

  useEffect(() => { reload(); }, [reload]);

  // WS subscription — updates from other tabs or agents
  useEffect(() => {
    if (!key) return;
    return subscribeConfigWs((msg) => {
      if ((msg.type === "config.set" || msg.type === "config.deleted") && msg.key === key) {
        if (msg.type === "config.deleted") {
          reload();
        } else {
          setState(s => ({ ...s, value: msg.value, version: msg.version }));
        }
      }
      if (msg.type === "config.bulk" && msg.keys && msg.keys.includes(key)) {
        reload();
      }
    });
  }, [key, reload]);

  const set = useCallback(async (newValue) => {
    setState(s => ({ ...s, loading: true, error: null }));
    try {
      const data = await putConfigValue(key, newValue, state.version);
      setState({ value: data.value, version: data.version, loading: false, error: null });
      return data;
    } catch (err) {
      setState(s => ({ ...s, loading: false, error: err.message }));
      throw err;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, state.version]);

  const reset = useCallback(async () => {
    await deleteConfigValue(key);
    await reload();
  }, [key, reload]);

  return { ...state, set, reset, reload };
}

// ─── useConfigCategory ────────────────────────────────────────────────────────
export function useConfigCategory(category) {
  const [state, setState] = useState({ keys: [], schemas: {}, values: {}, loading: !!category, error: null });

  const reload = useCallback(async () => {
    if (!category) return;
    setState(s => ({ ...s, loading: true, error: null }));
    try {
      const data = await fetchConfigByCategory(category);
      const items = data.items || [];
      const keys = items.map(d => d.key || d._id);
      const schemas = {};
      const values = {};
      items.forEach(item => {
        const k = item.key || item._id;
        schemas[k] = item.schema;
        values[k] = item.value;
      });
      setState({ keys, schemas, values, loading: false, error: null });
    } catch (err) {
      setState(s => ({ ...s, loading: false, error: err.message }));
    }
  }, [category]);

  useEffect(() => { reload(); }, [reload]);

  useEffect(() => {
    if (!category) return;
    return subscribeConfigWs((msg) => {
      if (msg.type === "config.bulk") { reload(); return; }
      if (msg.type === "config.set" || msg.type === "config.deleted") {
        // re-fetch if key belongs to this category
        setState(s => {
          if (s.keys.includes(msg.key)) {
            if (msg.type === "config.set") {
              return { ...s, values: { ...s.values, [msg.key]: msg.value } };
            } else {
              reload();
            }
          }
          return s;
        });
      }
    });
  }, [category, reload]);

  return state;
}

// ─── useConfigBulk ───────────────────────────────────────────────────────────
export function useConfigBulk(keys) {
  const keysKey = (keys || []).slice().sort().join(",");
  const [state, setState] = useState({ values: {}, schemas: {}, loading: !!(keys && keys.length), error: null });

  const reload = useCallback(async () => {
    if (!keys || !keys.length) return;
    setState(s => ({ ...s, loading: true }));
    try {
      const results = await Promise.all(
        keys.map(k => fetchConfigValue(k).catch(err => ({ key: k, error: err.message })))
      );
      const values = {};
      const schemas = {};
      results.forEach((r, i) => {
        if (!r.error) {
          values[keys[i]] = r.value;
          schemas[keys[i]] = r.schema;
        }
      });
      setState({ values, schemas, loading: false, error: null });
    } catch (err) {
      setState(s => ({ ...s, loading: false, error: err.message }));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keysKey]);

  useEffect(() => { reload(); }, [reload]);

  useEffect(() => {
    if (!keys || !keys.length) return;
    return subscribeConfigWs((msg) => {
      if (msg.type === "config.set" && keys.includes(msg.key)) {
        setState(s => ({ ...s, values: { ...s.values, [msg.key]: msg.value } }));
      }
      if (msg.type === "config.bulk") { reload(); }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keysKey, reload]);

  const bulkSet = useCallback(async (changes) => {
    const res = await fetch(apiUrl("/api/v2/config/bulk"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ changes }),
    });
    if (!res.ok) throw new Error(`Bulk set failed: ${res.status}`);
    await reload();
  }, [reload]);

  return { ...state, bulkSet };
}

// ─── useConfigCategories ──────────────────────────────────────────────────────
export function useConfigCategories() {
  const [state, setState] = useState({ categories: [], loading: true, error: null });

  useEffect(() => {
    fetchConfigCategories()
      .then(data => setState({ categories: data, loading: false, error: null }))
      .catch(err => setState({ categories: [], loading: false, error: err.message }));
  }, []);

  // re-fetch on bulk changes (counts may have changed)
  useEffect(() => {
    return subscribeConfigWs((msg) => {
      if (msg.type === "config.bulk" || msg.type === "config.set" || msg.type === "config.deleted") {
        fetchConfigCategories()
          .then(data => setState({ categories: data, loading: false, error: null }))
          .catch(() => {});
      }
    });
  }, []);

  return state;
}

// ─── Cleanup export (for testing) ─────────────────────────────────────────────
export function closeConfigWs() {
  clearTimeout(configWsReconnectTimer);
  if (configWs) { configWs.close(); configWs = null; }
}

// ─── Phase 0.3 — additive export ──────────────────────────────────────────────
// Bind components (BindFeed in particular) attach to the same shared WS.
// This export is purely additive — no behaviour change. Keep this here
// so we never open a second socket per-binding (Phase 0.3 §7 acceptance:
// "Dev tools show one WS connection (gateway), not one per binding").
export { subscribeConfigWs, ensureConfigWs };
