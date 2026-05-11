/**
 * qudosApi.js
 * ---------------------------------------------------------------------------
 * Thin API layer for the Qudos co-pilot. Routes through the gateway store so
 * UI doesn't need to know whether a call hit the network or fell back.
 *
 * Backend status (verified 2026-05-07):
 *   ✓ live + persisted to SQLite:
 *       POST   /api/v2/qudos/sessions
 *       GET    /api/v2/qudos/sessions
 *       POST   /api/v2/qudos/sessions/:id/pause
 *       POST   /api/v2/qudos/sessions/:id/stop
 *       GET    /api/v2/qudos/suggestions
 *       POST   /api/v2/qudos/suggestions/:id/approve
 *       POST   /api/v2/qudos/suggestions/:id/dismiss
 *
 *   ⚠ honest-unavailable until native macOS helper ships:
 *       GET    /api/v2/qudos/apps         (returns apps:[] + capability_unconfigured)
 *       GET    /api/v2/qudos/permissions  (returns capability report)
 *       POST   /api/v2/qudos/permissions/request   (501 / manual instructions)
 *       POST   /api/v2/qudos/capture               (501 / capture_unconfigured)
 *
 * Frontend contract:
 *   - Each function returns { ok, ... } so callers don't need try/catch.
 *   - Local-only helpers (overlay/privacy/exclusions) still mutate the store
 *     directly — backend persistence for those settings is not yet shipped.
 */

import { useGateway } from "@/lib/useGateway";

const store = () => useGateway.getState();

// ─── Apps & capabilities ────────────────────────────────────────────────────
export async function listApps() {
  return store().fetchQudosApps();
}

export async function setAppEnabled(appId, on) {
  // Local toggle — no backend per-app enable/disable yet.
  const s = store();
  if (!!s.qudosEnabledApps?.[appId] === !!on) return { ok: true, appId, enabled: !!on };
  s.toggleQudosApp(appId);
  return { ok: true, appId, enabled: !!on };
}

export async function setAppCapability(appId, capabilityKey, on) {
  // Local-only per-app capability matrix. Backend has no equivalent yet.
  store().setQudosCapability(appId, capabilityKey, on);
  return { ok: true, appId, capabilityKey, on };
}

// ─── Permissions / capability report ────────────────────────────────────────
export async function getPermissions() {
  return store().fetchQudosPermissions();
}

export async function requestPermission(_key) {
  // Backend POST /api/v2/qudos/permissions/request returns 501 until the
  // native macOS helper ships. We forward the call so callers see the honest
  // unavailable state and can render System Settings deep-link guidance.
  try {
    const apiUrl = (path) => {
      const base = (process.env.REACT_APP_BACKEND_URL || "").replace(/\/$/, "");
      return `${base}${path}`;
    };
    const res = await fetch(apiUrl("/api/v2/qudos/permissions/request"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: _key || null }),
    });
    const payload = await res.json().catch(() => ({}));
    if (res.status === 501 || payload?.reason === "native_helper_required") {
      return {
        ok: false,
        unavailable: true,
        reason: payload?.reason || "native_helper_required",
        message: payload?.message || "Native macOS helper required to request system permissions.",
        capabilities: payload?.capabilities || null,
      };
    }
    return { ok: res.ok, ...payload };
  } catch (err) {
    return { ok: false, error: err?.message || String(err) };
  }
}

// ─── Sessions ───────────────────────────────────────────────────────────────
export async function startSession({ appId, task, agent, capabilities }) {
  return store().createQudosSession({ appId, task, agent, capabilities });
}

export async function listSessions() {
  return store().fetchQudosSessions();
}

export async function pauseSession(id) {
  return store().pauseQudosSessionRemote(id);
}

export async function stopSession(id) {
  return store().stopQudosSessionRemote(id);
}

export async function appendSessionStep(id, label) {
  // No backend session-step endpoint yet — keep local event for cross-page UI.
  store().appendQudosStep?.(id, label);
  return { ok: true, id, label };
}

// ─── Suggestions ────────────────────────────────────────────────────────────
export async function listSuggestions() {
  return store().fetchQudosSuggestions();
}

export async function approveSuggestion(id) {
  return store().resolveQudosSuggestionRemote(id, "approve");
}

export async function dismissSuggestion(id) {
  return store().resolveQudosSuggestionRemote(id, "dismiss");
}

// ─── Capture / overlay ──────────────────────────────────────────────────────
export async function pushCapture(_payload) {
  // Backend returns 501 + capture_unconfigured until native helper ships.
  try {
    const apiUrl = (path) => {
      const base = (process.env.REACT_APP_BACKEND_URL || "").replace(/\/$/, "");
      return `${base}${path}`;
    };
    const res = await fetch(apiUrl("/api/v2/qudos/capture"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(_payload || {}),
    });
    const payload = await res.json().catch(() => ({}));
    if (res.status === 501 || payload?.reason === "capture_unconfigured" || payload?.captured === false) {
      return {
        ok: false,
        unavailable: true,
        reason: payload?.reason || "capture_unconfigured",
        message: payload?.message || "Screen capture requires the native macOS helper.",
        capabilities: payload?.capabilities || null,
      };
    }
    return { ok: res.ok, ...payload };
  } catch (err) {
    return { ok: false, error: err?.message || String(err) };
  }
}

export function connectOverlayWebSocket() {
  // No /api/ws/qudos/overlay yet — return inert handle so callers don't crash.
  return { close: () => {}, send: () => {} };
}

// ─── Privacy (still local-only — no backend persistence yet) ────────────────
export async function setRetention(retention) {
  store().updateQudosPrivacy({ retention });
  return { ok: true, retention };
}

export async function toggleAppExclusion(appId) {
  store().excludeQudosApp(appId);
  return { ok: true, appId };
}

export async function setPaused(paused) {
  store().pauseQudos(!!paused);
  return { ok: true, paused: !!paused };
}
