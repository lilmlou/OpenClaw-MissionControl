/**
 * qudosApi.js
 * ---------------------------------------------------------------------------
 * Thin API layer for the Qudos co-pilot. Today every function delegates to
 * the local Zustand store (see useGateway.js qudos* slice). When the backend
 * ships, swap the body of each function with the matching fetch() call below
 * and the UI keeps working unchanged.
 *
 * Backend contract (TODO — to be implemented by the OpenClaw gateway):
 *
 *   GET    /api/v2/qudos/apps                          → supported app catalog
 *   GET    /api/v2/qudos/apps/:id/capabilities         → per-app capabilities
 *   POST   /api/v2/qudos/apps/:id/enable
 *   POST   /api/v2/qudos/apps/:id/disable
 *
 *   GET    /api/v2/qudos/permissions                   → current macOS perms
 *   POST   /api/v2/qudos/permissions/request           → trigger system prompt
 *
 *   POST   /api/v2/qudos/sessions  { appId, task, agent, capabilities }
 *      →  { id, jobId, status }
 *   GET    /api/v2/qudos/sessions
 *   POST   /api/v2/qudos/sessions/:id/pause
 *   POST   /api/v2/qudos/sessions/:id/stop
 *   GET    /api/v2/qudos/sessions/:id/events           → SSE stream
 *
 *   POST   /api/v2/qudos/capture                       → push screenshot
 *   WS     /api/ws/qudos/overlay                       → overlay state
 *
 *   GET    /api/v2/qudos/suggestions                   → paginated feed
 *   POST   /api/v2/qudos/suggestions/:id/approve
 *   POST   /api/v2/qudos/suggestions/:id/dismiss
 *
 * Frontend contract:
 *   - Each function returns the same shape regardless of whether it hits
 *     the network or just mutates the store, so callers don't need to care.
 *   - Errors are reported as `{ ok: false, error }`. Successful calls return
 *     the canonical record, e.g. `{ ok: true, session }` or `{ ok: true, suggestion }`.
 */

import { useGateway } from "@/lib/useGateway";

const store = () => useGateway.getState();

// ─── Apps & capabilities ────────────────────────────────────────────────────
export async function listApps() {
  // TODO: const res = await fetch(apiUrl("/api/v2/qudos/apps"));
  // For now, the static catalog lives in constants.DESKTOP_APP_GROUPS.
  return { ok: true, apps: [] };
}

export async function setAppEnabled(appId, on) {
  // TODO: POST /api/v2/qudos/apps/:id/enable | /disable
  const s = store();
  if (!!s.qudosEnabledApps?.[appId] === !!on) return { ok: true, appId, enabled: !!on };
  s.toggleQudosApp(appId);
  return { ok: true, appId, enabled: !!on };
}

export async function setAppCapability(appId, capabilityKey, on) {
  // TODO: PATCH /api/v2/qudos/apps/:id/capabilities { [key]: on }
  store().setQudosCapability(appId, capabilityKey, on);
  return { ok: true, appId, capabilityKey, on };
}

// ─── Permissions ────────────────────────────────────────────────────────────
export async function getPermissions() {
  // TODO: GET /api/v2/qudos/permissions
  return { ok: true, permissions: store().qudosPermissions };
}

export async function requestPermission(key) {
  // TODO: POST /api/v2/qudos/permissions/request → opens System Settings deep link
  store().setQudosPermission(key, true);
  return { ok: true, key, granted: true };
}

// ─── Sessions ───────────────────────────────────────────────────────────────
export async function startSession({ appId, task, agent, capabilities }) {
  // TODO: POST /api/v2/qudos/sessions
  // The local handler also creates a Job + emits Events for cross-page wiring.
  const { sessionId, jobId } = store().startQudosSession(appId, task, { agent, capabilities });
  const session = store().qudosSessions.find((s) => s.id === sessionId);
  return { ok: true, session, jobId };
}

export async function listSessions() {
  // TODO: GET /api/v2/qudos/sessions
  return { ok: true, sessions: store().qudosSessions };
}

export async function pauseSession(id) {
  // TODO: POST /api/v2/qudos/sessions/:id/pause
  store().pauseQudosSession(id);
  return { ok: true, id };
}

export async function stopSession(id) {
  // TODO: POST /api/v2/qudos/sessions/:id/stop
  store().stopQudosSession(id);
  return { ok: true, id };
}

export async function appendSessionStep(id, label) {
  // TODO: POST /api/v2/qudos/sessions/:id/events { type: "step", label }
  store().appendQudosStep(id, label);
  return { ok: true, id, label };
}

// ─── Suggestions ────────────────────────────────────────────────────────────
export async function listSuggestions() {
  // TODO: GET /api/v2/qudos/suggestions
  return { ok: true, suggestions: store().qudosSuggestions };
}

export async function pushSuggestion(suggestion) {
  // TODO: WS /api/ws/qudos/suggestions push from server
  const id = store().addQudosSuggestion(suggestion);
  return { ok: true, id };
}

export async function approveSuggestion(id) {
  // TODO: POST /api/v2/qudos/suggestions/:id/approve
  store().resolveQudosSuggestion(id, "approved");
  return { ok: true, id, decision: "approved" };
}

export async function dismissSuggestion(id) {
  // TODO: POST /api/v2/qudos/suggestions/:id/dismiss
  store().resolveQudosSuggestion(id, "dismissed");
  return { ok: true, id, decision: "dismissed" };
}

// ─── Capture / overlay ──────────────────────────────────────────────────────
export async function pushCapture(_payload) {
  // TODO: POST /api/v2/qudos/capture { png, app, ts }
  return { ok: false, error: "Capture bridge pending — Mac helper app not yet shipped." };
}

export function connectOverlayWebSocket() {
  // TODO: new WebSocket(wsUrl("/api/ws/qudos/overlay"))
  return { close: () => {}, send: () => {} };
}

// ─── Privacy ────────────────────────────────────────────────────────────────
export async function setRetention(retention) {
  // TODO: PATCH /api/v2/qudos/privacy { retention }
  store().updateQudosPrivacy({ retention });
  return { ok: true, retention };
}

export async function toggleAppExclusion(appId) {
  // TODO: POST /api/v2/qudos/privacy/excluded { appId, on }
  store().excludeQudosApp(appId);
  return { ok: true, appId };
}

export async function setPaused(paused) {
  // TODO: POST /api/v2/qudos/privacy/pause { paused }
  store().pauseQudos(!!paused);
  return { ok: true, paused: !!paused };
}
