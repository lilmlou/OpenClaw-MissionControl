/**
 * F7 — Agent Live View hooks
 *
 *   useAgentRuns(statusFilter?)  → { runs, loading, error, reload, runningCount, claimsCount, wsDisconnected, reconnectWs }
 *   useAgentRunDetail(runId)     → { run, events, checks, diff, loading, error, reload, ... }
 *
 * Both subscribe to the shared Phase 0.1 config WS singleton (subscribeConfigWs)
 * which receives `agent.run.updated` and `agent.event` re-broadcasts from the
 * backend (`backend/app/agents/dispatch.py::_broadcast_config_update`). This
 * satisfies Phase 0.3 §7 acceptance "Dev tools show one WS connection
 * (gateway), not one per binding".
 *
 * No `done` vocabulary — runs are { running | claims_done | verified | failed | killed }.
 */
import { useState, useEffect, useCallback, useRef } from "react";
import { apiUrl } from "@/lib/useGateway";
import { subscribeConfigWs, ensureConfigWs } from "@/hooks/useConfigBus";

// ── REST helpers ──────────────────────────────────────────────────────────────

async function unwrap(res) {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const msg = body?.error?.message || body?.detail || `HTTP ${res.status}`;
    throw Object.assign(new Error(msg), { status: res.status, body });
  }
  const payload = await res.json();
  // Backend wraps as { ok: true, data: {...} } per BACKEND_PRINCIPLES_UPDATE.md §2.2
  if (payload && typeof payload === "object" && "ok" in payload) {
    if (payload.ok === false) {
      const e = payload.error || {};
      throw Object.assign(new Error(e.message || "request failed"), { code: e.code, fix: e.fix });
    }
    return payload.data ?? payload;
  }
  return payload;
}

async function fetchRuns({ status, since, limit = 100 } = {}) {
  const q = new URLSearchParams();
  if (status) q.set("status", status);
  if (since) q.set("since", String(since));
  if (limit) q.set("limit", String(limit));
  const url = `/api/v2/agents/runs${q.toString() ? `?${q}` : ""}`;
  const data = await unwrap(await fetch(apiUrl(url)));
  return Array.isArray(data?.items) ? data.items : Array.isArray(data) ? data : Array.isArray(data?.runs) ? data.runs : [];
}

async function fetchRunDetail(runId) {
  const data = await unwrap(await fetch(apiUrl(`/api/v2/agents/runs/${encodeURIComponent(runId)}`)));
  return {
    run: data?.run || null,
    checks: Array.isArray(data?.checks) ? data.checks : [],
    events: Array.isArray(data?.events) ? data.events : [],
  };
}

async function fetchRunEvents(runId, since) {
  const q = new URLSearchParams();
  if (since) q.set("since", String(since));
  const url = `/api/v2/agents/runs/${encodeURIComponent(runId)}/events${q.toString() ? `?${q}` : ""}`;
  const data = await unwrap(await fetch(apiUrl(url)));
  return Array.isArray(data?.items) ? data.items : [];
}

async function fetchRunDiff(runId) {
  try {
    return await unwrap(await fetch(apiUrl(`/api/v2/agents/runs/${encodeURIComponent(runId)}/diff`)));
  } catch (err) {
    return { available: false, error: err.message };
  }
}

export async function postRunVerify(runId, checkIds) {
  const body = checkIds && checkIds.length > 0 ? { check_ids: checkIds } : {};
  return unwrap(await fetch(apiUrl(`/api/v2/agents/runs/${encodeURIComponent(runId)}/verify`), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }));
}

export async function postRunKill(runId) {
  return unwrap(await fetch(apiUrl(`/api/v2/agents/runs/${encodeURIComponent(runId)}/kill`), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  }));
}

// ── WS disconnect tracking ────────────────────────────────────────────────────
// We track the config WS state so the page can show a polling fallback banner.

let wsDisconnectTimer = null;
const wsDisconnectListeners = new Set();

function notifyWsState(disconnected) {
  wsDisconnectListeners.forEach((fn) => { try { fn(disconnected); } catch {} });
}

function subscribeWsState(fn) {
  wsDisconnectListeners.add(fn);
  return () => wsDisconnectListeners.delete(fn);
}

// ── useAgentRuns ──────────────────────────────────────────────────────────────

export function useAgentRuns(statusFilter, { pollIntervalMs = 30_000 } = {}) {
  const [state, setState] = useState({
    runs: [],
    loading: true,
    error: null,
    lastUpdated: null,
  });
  const [wsDisconnected, setWsDisconnected] = useState(false);
  // Track WS open/close via a heartbeat
  const wsAliveRef = useRef(true);
  const pollTimerRef = useRef(null);

  const reload = useCallback(async (filter) => {
    const sf = filter !== undefined ? filter : statusFilter;
    setState((s) => ({ ...s, loading: s.runs.length === 0, error: null }));
    try {
      const runs = await fetchRuns({ limit: 100, status: sf || undefined });
      // newest first
      const sorted = [...runs].sort((a, b) =>
        (b.dispatched_ts || b.started_ts || 0) - (a.dispatched_ts || a.started_ts || 0)
      );
      setState({ runs: sorted, loading: false, error: null, lastUpdated: Date.now() });
    } catch (err) {
      setState((s) => ({ ...s, loading: false, error: err.message }));
    }
  }, [statusFilter]);

  // Initial load + reload on filter change
  useEffect(() => { reload(statusFilter); }, [reload, statusFilter]);

  // Polling fallback: when WS is disconnected, poll
  useEffect(() => {
    clearInterval(pollTimerRef.current);
    if (wsDisconnected) {
      pollTimerRef.current = setInterval(() => {
        reload().catch(() => null);
      }, pollIntervalMs);
    }
    return () => clearInterval(pollTimerRef.current);
  }, [wsDisconnected, reload, pollIntervalMs]);

  // Track WS disconnect via a 15s heartbeat check
  useEffect(() => {
    const interval = setInterval(() => {
      // Check if config WS is alive by attempting to ensure it and then
      // checking if any recent WS messages came through.
      const alive = wsAliveRef.current;
      if (alive) {
        wsAliveRef.current = false; // will be reset by onmessage
        setWsDisconnected(false);
      } else {
        setWsDisconnected(true);
      }
    }, 15_000);
    return () => clearInterval(interval);
  }, []);

  // Live updates via shared config WS (singleton — no second socket).
  useEffect(() => {
    return subscribeConfigWs((msg) => {
      wsAliveRef.current = true; // heartbeat

      if (!msg) return;

      // ── replay frame (hard refresh) — §3.3 ──────────────────────────
      if (msg.type === "replay" && Array.isArray(msg.runs)) {
        const runs = msg.runs.map((r) => ({
          ...(r.run || {}),
          _replay_events: r.events || [],
        }));
        runs.sort((a, b) =>
          (b.dispatched_ts || b.started_ts || 0) - (a.dispatched_ts || a.started_ts || 0)
        );
        setState({ runs, loading: false, error: null, lastUpdated: Date.now() });
        return;
      }

      // ── new agent dispatch — §3.3 agent.run.created ────────────────
      if (msg.type === "agent.run.created" && msg.run) {
        setState((s) => {
          const exists = s.runs.some((r) => r.id === msg.run.id);
          if (exists) return { ...s, lastUpdated: Date.now() };
          const updated = [msg.run, ...s.runs];
          return { ...s, runs: updated, lastUpdated: Date.now() };
        });
        return;
      }

      // ── agent.run.updated — status / acceptance / diff / events ────
      if (msg.type !== "agent.run.updated") return;
      const runId = msg.run_id;
      if (!runId) return;

      if (msg.reason === "status" || msg.status) {
        // Merge the updated fields into the run row without a full reload
        setState((s) => {
          const idx = s.runs.findIndex((r) => r.id === runId);
          if (idx === -1) return { ...s, lastUpdated: Date.now() };
          const updated = [...s.runs];
          const run = { ...updated[idx] };
          if (msg.status) run.status = msg.status;
          if (msg.ended_ts != null) run.ended_ts = msg.ended_ts;
          if (msg.diff) {
            run.diff_added = msg.diff.added ?? run.diff_added;
            run.diff_removed = msg.diff.removed ?? run.diff_removed;
          }
          if (msg.acceptance) {
            run.acceptance_passed = msg.acceptance.passed ?? run.acceptance_passed;
            run.acceptance_total = msg.acceptance.total ?? run.acceptance_total;
          }
          if (msg.suggested_action != null) run.suggested_action = msg.suggested_action;
          updated[idx] = run;
          return { ...s, runs: updated, lastUpdated: Date.now() };
        });
        return;
      }

      // Event-only: bump lastUpdated
      setState((s) => ({ ...s, lastUpdated: Date.now() }));
    });
  }, [reload]);

  const reconnectWs = useCallback(() => {
    setWsDisconnected(false);
    wsAliveRef.current = true;
    // Re-ensure the config WS
    ensureConfigWs();
    reload();
  }, [reload]);

  const runningCount = state.runs.filter((r) => r.status === "running").length;
  const claimsCount  = state.runs.filter((r) => r.status === "claims_done").length;

  return { ...state, reload, runningCount, claimsCount, wsDisconnected, reconnectWs };
}

// ── useAgentRunDetail ─────────────────────────────────────────────────────────

const EVENT_CAP = 1000; // virtualisation safety net per F7 §4.2

export function useAgentRunDetail(runId) {
  const [state, setState] = useState({
    run: null,
    events: [],
    checks: [],
    diff: null,
    loading: !!runId,
    error: null,
    lastEventTs: 0,
    lastHeartbeat: null,
  });
  const pollTimerRef = useRef(null);

  const eventsRef = useRef(state.events);
  eventsRef.current = state.events;

  const reload = useCallback(async () => {
    if (!runId) return;
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const [{ run, checks, events }, diff] = await Promise.all([
        fetchRunDetail(runId),
        fetchRunDiff(runId),
      ]);
      const last = events.length ? events[events.length - 1] : null;
      // Merge with existing events (WS may have delivered newer ones during fetch)
      setState((s) => {
        const existingIds = new Set(s.events.map((e) => e.id));
        const newEvents = events.filter((e) => !existingIds.has(e.id));
        const merged = [...s.events, ...newEvents].sort((a, b) => (a.ts || 0) - (b.ts || 0));
        const trimmed = merged.length > EVENT_CAP ? merged.slice(-EVENT_CAP) : merged;
        return {
          run,
          events: trimmed,
          checks,
          diff,
          loading: false,
          error: null,
          lastEventTs: last ? last.ts || 0 : s.lastEventTs,
          lastHeartbeat: trimmed.length ? trimmed[trimmed.length - 1].ts : (last?.ts || s.lastHeartbeat),
        };
      });
    } catch (err) {
      setState((s) => ({ ...s, loading: false, error: err.message }));
    }
  }, [runId]);

  useEffect(() => { reload(); }, [reload]);

  // Polling fallback for detail: when WS is disconnected, poll every 10s
  useEffect(() => {
    clearInterval(pollTimerRef.current);
    // Always set up a slow poll as safety net (every 15s)
    // The WS will update much faster; this is just the fallback.
    pollTimerRef.current = setInterval(() => {
      if (runId) {
        reload().catch(() => null);
      }
    }, 15_000);
    return () => clearInterval(pollTimerRef.current);
  }, [runId, reload]);

  // Live patch via shared config WS — append event, refetch row on status flips.
  useEffect(() => {
    if (!runId) return;
    return subscribeConfigWs((msg) => {
      if (!msg) return;

      // ── replay frame — populate initial data ───────────────────────
      if (msg.type === "replay" && Array.isArray(msg.runs)) {
        const match = msg.runs.find((r) => r.run_id === runId || r.run?.id === runId);
        if (match && match.run) {
          setState((s) => {
            const existingIds = new Set(s.events.map((e) => e.id));
            const replayEvents = (match.events || []).filter((e) => !existingIds.has(e.id));
            const merged = [...s.events, ...replayEvents].sort((a, b) => (a.ts || 0) - (b.ts || 0));
            const trimmed = merged.length > EVENT_CAP ? merged.slice(-EVENT_CAP) : merged;
            return {
              ...s,
              run: { ...(match.run || s.run), suggested_action: match.run?.suggested_action ?? s.run?.suggested_action },
              events: trimmed,
              lastHeartbeat: trimmed.length ? trimmed[trimmed.length - 1].ts : s.lastHeartbeat,
            };
          });
        }
        return;
      }

      // ── agent.run.updated — §3.3 ───────────────────────────────────
      if (msg.type !== "agent.run.updated") return;
      if (msg.run_id !== runId) return;

      // Append new event if present (deduped by id)
      if (msg.event) {
        setState((s) => {
          const exists = s.events.some((e) => e.id === msg.event.id);
          if (exists) return s;
          const merged = [...s.events, msg.event];
          const trimmed = merged.length > EVENT_CAP ? merged.slice(-EVENT_CAP) : merged;
          return {
            ...s,
            events: trimmed,
            lastEventTs: msg.event.ts || s.lastEventTs,
            lastHeartbeat: msg.event.ts || s.lastHeartbeat,
          };
        });
      }

      // On status / acceptance / diff updates, merge into run state.
      if (msg.reason === "status" || msg.status || msg.acceptance || msg.diff) {
        setState((s) => {
          const next = { ...s };
          if (s.run) {
            next.run = { ...s.run };
            if (msg.status) next.run.status = msg.status;
            if (msg.ended_ts != null) next.run.ended_ts = msg.ended_ts;
            if (msg.diff) {
              next.run.files_touched = msg.diff.files_touched || s.run?.files_touched || [];
              next.run.diff_added = msg.diff.added ?? s.run.diff_added;
              next.run.diff_removed = msg.diff.removed ?? s.run.diff_removed;
            }
            if (msg.acceptance) {
              next.run.acceptance_passed = msg.acceptance.passed ?? s.run.acceptance_passed;
              next.run.acceptance_total = msg.acceptance.total ?? s.run.acceptance_total;
            }
            if (msg.suggested_action != null) next.run.suggested_action = msg.suggested_action;
          }
          return next;
        });
      }
    });
  }, [runId, reload]);

  return { ...state, reload };
}