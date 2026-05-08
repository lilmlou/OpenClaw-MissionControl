# Backend Principles Update

**Audience:** every backend agent, both stacks (FastAPI/Mongo + Express/SQLite)
**Owner:** Meg
**Date:** 2026-05-08
**Companion to:** `PHASE_0_PRINCIPLES.md`
**Status:** binding — applies to all new work and all touched modules

---

## 0. Why this exists

Phase 0 is mostly written for the frontend ("buttons must visually do things"). The backend has its own version of the same contract: every state-changing thing the backend does must be **observable, mutable from outside, and reversible — without restart.**

If the backend doesn't comply, no UI can deliver Meg's vision regardless of how nice the React looks.

---

## 1. The Seven Backend Properties

Mirror of frontend principles, but expressed as backend obligations.

### 1.1 Observable
Every state-changing operation emits an event.

- Mutations to Mongo / SQLite → activity event
- Config bus set/delete → activity event (Phase 0.1)
- Agent run lifecycle → events (F7)
- Cron fire → event
- Errors → event with severity + suggested fix

No silent writes. If a thing changed, the platform announces it.

### 1.2 Externally mutable
Everything that can be tweaked has an API.

- No "edit `config.yaml`" — the API of record is HTTP + bus
- File-based settings (env, yaml) are read-only fallbacks; they don't override the bus
- Every long-running loop accepts runtime parameter changes

### 1.3 Reversible
Every mutation has an inverse and the platform knows it.

- `bus.set` ↔ `bus.delete` (revert to default)
- `cron.create` ↔ `cron.delete`
- `agent.spawn` ↔ `agent.kill`
- File writes via UI: undo to last version (with a server-side history; out of scope to fully spec here, but the obligation is named)

### 1.4 Hot-reloadable
No setting requires a restart.

- All config goes through the bus (Phase 0.1)
- Provider registry, cron schedules, model picker, security allowlists — every one of these subscribes to bus changes
- If a module needs a "warm-up", it provides a `reload()` method called by a bus subscription

### 1.5 Self-describing
Every endpoint, action, and config key carries enough metadata to be auto-rendered.

- All config keys ship with JSON Schema (Phase 0.1)
- All actions ship with input + result schemas (Phase 0.3)
- All collections ship with item schema (used by `<BindList>`)
- OpenAPI is auto-generated and accurate (FastAPI handles this — keep it accurate)

### 1.6 Real-time
WebSocket fan-out for every mutation.

- One WS endpoint per topic family: `/api/ws/config`, `/api/ws/agents`, `/api/ws/activities`, `/api/ws/system`
- Reconnect handled by client; backend just publishes
- No polling-only state — polling is a fallback, never the primary path

### 1.7 Verifiable
Every claim of "done" is testable from outside.

- Every endpoint has an acceptance check the F7 agent runner can execute
- Every module has a `health()` returning structured status (not just 200)
- Every long-running task surfaces progress via WS

---

## 2. Conventions

### 2.1 Endpoint structure

```
/api/v2/<domain>/...           HTTP REST
/api/ws/<domain>               WebSocket per domain
/api/v2/actions/<key>          Action invocations (Phase 0.3)
/api/v2/config/<key>           Config R/W (Phase 0.1)
```

`v2` namespace is locked. New work goes here. `v1` deprecated (existing routes stay until rewritten).

### 2.2 Response shape (success)

```json
{ "ok": true, "data": { ... }, "ts": 1714900000000 }
```

For collection endpoints, payload at root with cursor:
```json
{ "items": [...], "next_cursor": "...", "total": 1234, "ts": ... }
```

### 2.3 Response shape (failure)

HTTP 200 with:
```json
{ "ok": false, "error": "human readable", "code": "SHORT_CODE", "detail": {...}, "available": false, "ts": ... }
```

Reserved 4xx / 5xx for genuinely unhandleable: 400 validation, 401 auth, 403 forbidden, 404 not found, 409 conflict, 429 rate, 500 unhandled exception.

The frontend hides UI on `available: false`. Don't return null with 200 OK.

### 2.4 Activity event shape (canonical)

```json
{
  "id": "evt_<ulid>",
  "ts": 1714900000000,
  "kind": "config.set" | "agent.event" | "cron.fired" | "error" | ...,
  "summary": "models.default.provider: ollama-cloud → openai",
  "actor": "user:meg" | "system" | "agent:<id>" | "cron:<id>",
  "subject": "<resource id if any>",
  "severity": "info" | "warn" | "error" | "critical",
  "detail": { ... },
  "fix": [{ "label": "Switch provider", "action": "models.set_provider", "args": {...} }]
}
```

`fix[]` enables Principle 1.4 Self-healing on the frontend — error events ship with their own remediation buttons.

### 2.5 Logging vs activity

| Logging (file/stderr) | Activity feed (Mongo/SQLite + WS) |
|---|---|
| Internal diagnostics | User-visible state changes |
| Stack traces | Errors with `fix[]` |
| Verbose by default | Curated, low-volume |
| Not shown in UI | Primary UI surface |

A user-visible activity event MAY also log; but logs are not promoted to activity events.

---

## 3. Mandatory module wiring

For every backend module:

1. **Register defaults to the bus** at import time (Phase 0.1)
2. **Subscribe to bus changes** for any setting the module reads
3. **Emit activity events** on every mutation
4. **Expose a `health()` callable** returning `{status, latency_ms, last_error, capabilities}`
5. **Provide an `OpenAPI tag`** so docs are categorised

Skeleton:

```python
from app.config_bus import bus
from app.activity import emit
from app.health import register_health

bus.register_default("foo.bar", "default", schema={...})

@bus.on("foo.bar")
async def reload_foo(new, old):
    await foo.reload()
    emit(kind="foo.config.reloaded", actor="system", summary=f"foo.bar: {old} → {new}")

@register_health("foo")
async def health():
    return {"status": "ok", "latency_ms": ..., "capabilities": [...]}
```

---

## 4. Migration order (existing modules)

Existing modules are non-compliant. Retrofit in this order:

| Module | Priority | Notes |
|---|---|---|
| Provider registry (Phase A) | P0 | already big, lots of consumers |
| Cron manager (Sprint 3) | P0 | UI relies on hot-edit |
| Activities feed (Sprint 4) | P0 | already partly compliant |
| Token tracking (Sprint 5) | P1 | mostly read-only, easy |
| Quota tracking (Sprint 8) | P1 | |
| Self-learning (Sprint 6) | P2 | |
| Skills routes (existing) | P0 | needed by E3 |
| System v2 (D1, in flight) | P0 | bake in compliance during build |
| Approval engine (Phase 4) | P1 | |
| Memory (Phase 6.D) | P2 | |

Each migration is its own PR. Mark with `compliance: phase-0` label.

---

## 5. New code rules

After this doc lands:

- **No new endpoint** without OpenAPI tag, `available` field, and activity emission
- **No new module** that reads config from `os.environ` directly — go through bus
- **No new mutation** without WS broadcast
- **No new error message** without a `fix[]` array (even if `[]`)
- **No new module** without a `health()` callable
- **No new state** stored in module-level globals — use bus, Mongo, or SQLite

Reviewers auto-bounce on any of these.

---

## 6. Two-backend split (reminder)

Per `BACKEND_BOUNDARY.md`:

- **FastAPI/Mongo** at `OpenClaw-MissionControl/backend/`: Mission Control v2 routes (`/api/v2/system/*`, `/api/skills`, `/api/plugins`, `/api/connectors`, design, qudos, config bus, actions)
- **Express/SQLite** at `/Users/meg/backend`: agent runtime, chat, sprint routes (Sprints 2–9)

Both must comply with this principles doc. The bus is per-stack (each backend has its own bus singleton). UI may bind to either via routing rules in the gateway.

Convergence revisited at Phase L.

---

## 7. Acceptance for backend Phase 0 compliance audit

A backend is compliant when:

- [ ] `GET /api/v2/config` lists at least 20 keys with schemas
- [ ] `GET /api/v2/actions` lists at least 5 actions with schemas
- [ ] `GET /api/v2/health` returns per-module statuses
- [ ] WS endpoints publish events within 1s of mutation
- [ ] All `/api/v2/*` endpoints return `{ok, ts, ...}` shape (or documented exception)
- [ ] All errors include `code` and `fix[]`
- [ ] Activity feed shows config sets, action invocations, agent events, cron fires
- [ ] Restarting the backend with intact Mongo restores all settings exactly
- [ ] Restarting with wiped Mongo applies defaults; service still works
- [ ] No `os.environ.get()` calls in business logic (only in bus loader)

Audit script lives at `backend/tools/compliance_audit.py` (TBD).

---

## 8. What this doc does NOT do

- Doesn't tell you which features to build
- Doesn't change `BACKEND_BOUNDARY.md`
- Doesn't redefine §3 contracts in existing handoffs
- Doesn't introduce a new persistence layer
- Doesn't mandate breaking changes — additive only

---

End of Backend Principles Update.
