# Phase 0.1 — Hot-Reload Config Bus

**Audience:** backend agent (FastAPI/Mongo at `OpenClaw-MissionControl/backend/`)
**Owner:** Meg
**Priority:** P0 — enables Principle 1.2 Live config across the platform
**Sister doc:** `PHASE_0_3_BINDING_LAYER.md` (frontend side)

---

## 0. TL;DR

Every backend setting Meg can change must take effect immediately, with no restart. This phase builds the **bus** that makes that possible: a centralised, watched, hot-reloadable config store with WebSocket fan-out.

After this ships, any module reads config via `bus.get(key)` and never sees a stale value again.

---

## 0.5 Phase 0 Compliance

- [x] **Visual-first** — config changes emit events that the UI renders as visual feedback (toasts, status pills updating live)
- [x] **Live config** — this phase IS live config
- [x] **No-text-editing** — config edits go through API, never through file edits (file edits do work as a fallback but emit events too)
- [x] **Self-healing** — invalid config rejected before commit; previous value retained; UI shows reason
- [x] **In-UI extensibility** — new keys can be added at runtime via the bus; no code change required
- [x] **Real-time** — every set/delete pushes WS event within 100ms
- [x] **Visible** — every mutation logged to activity feed with actor + before/after

---

## 1. The problem this fixes

Today the backend reads `.env` / `config.yaml` / hardcoded module constants. Changes require:

1. Edit file
2. Restart server
3. Lose in-flight work
4. Cross fingers

The UI cannot meaningfully expose any of these. Every "settings page" in MC right now is decorative because the backend doesn't notice writes anyway.

---

## 2. Architecture

```
                  ┌─────────────────────────────┐
                  │         ConfigBus           │
                  │  (singleton, in-process)    │
                  └──────────────┬──────────────┘
                                 │
            ┌────────────────────┼────────────────────┐
            │                    │                    │
        Sources               Cache              Subscribers
            │                    │                    │
   ┌────────┴────────┐     ┌─────┴─────┐      ┌──────┴──────┐
   │ MongoDB         │     │ in-mem    │      │ WS fan-out  │
   │ collection:     │ →   │ TTL=∞     │  →   │ /api/ws/    │
   │   `config`      │     │ versioned │      │  config     │
   └─────────────────┘     └───────────┘      └─────────────┘
   ┌─────────────────┐                        ┌─────────────┐
   │ env vars (RO)   │ →                      │ in-process  │
   └─────────────────┘                        │ callbacks   │
   ┌─────────────────┐                        └─────────────┘
   │ defaults (code) │ →                      ┌─────────────┐
   └─────────────────┘                        │ activity    │
                                              │ feed        │
                                              └─────────────┘
```

**Resolution order** for `bus.get("foo.bar")`:
1. Mongo `config.foo.bar` if set
2. ENV `FOO_BAR` if set (read-only fallback, can't be set from UI)
3. Default registered by code with `bus.register_default("foo.bar", value, schema)`
4. Raise `KeyError` if none of the above

---

## 3. Contract — locked

### 3.1 Mongo schema

Collection: `config`
```json
{
  "_id": "feature.flags.use_ollama_default",
  "value": true,
  "type": "boolean",
  "schema": {
    "type": "boolean",
    "title": "Use Ollama as default model",
    "description": "When true, new sessions default to Ollama Cloud models",
    "category": "models"
  },
  "secret": false,
  "updated_ts": 1714900000000,
  "updated_by": "user:meg",
  "version": 7
}
```

Field rules:
- `_id` is the dotted key (e.g. `feature.flags.use_ollama_default`)
- `value` is the actual current value
- `type` ∈ `boolean | integer | number | string | enum | array | object | secret`
- `schema` is JSON Schema (used by Phase 0.2 to render the form)
- `secret: true` → value never returned to UI in plaintext (use `***` placeholder); only mutation is allowed
- `version` increments on every write — used for optimistic concurrency

### 3.2 Endpoints

```
GET    /api/v2/config                      list all keys (values redacted if secret)
GET    /api/v2/config/:key                 get one key + schema
PUT    /api/v2/config/:key                 set value (body: {value, expected_version?})
DELETE /api/v2/config/:key                 reset to default (removes Mongo doc)
GET    /api/v2/config/categories           list categories with counts
POST   /api/v2/config/bulk                 atomic multi-set (body: {changes: [{key, value}], expected_versions?})
GET    /api/v2/config/schema/:key          full JSON schema for a key (for form rendering)
WS     /api/ws/config                      live event stream
```

### 3.3 WebSocket events

```json
{ "type": "config.set",     "key": "...", "value": ..., "version": 8, "actor": "user:meg", "ts": ... }
{ "type": "config.deleted", "key": "...", "version": 9, "actor": "user:meg", "ts": ... }
{ "type": "config.bulk",    "keys": ["...", "..."], "ts": ... }
{ "type": "config.error",   "key": "...", "reason": "validation_failed", "detail": "..." }
```

### 3.4 Error shape (all endpoints)

HTTP 200 with payload `{ error, available, detail }` rather than 5xx, except:
- 400 on validation failure (with field-level detail)
- 409 on version conflict
- 403 if a setting is marked `read_only_runtime`

---

## 4. Backend implementation tasks

### 4.1 New module: `backend/app/config_bus/`

```
backend/app/config_bus/
  __init__.py
  bus.py              # ConfigBus class (singleton)
  store.py            # Mongo persistence
  schema.py           # JSON Schema validation (jsonschema lib)
  defaults.py         # registry of defaults
  watchers.py         # in-process callback registry
  routes.py           # FastAPI router
  ws.py               # WebSocket endpoint
  events.py           # activity feed integration
  tests/
    test_bus.py
    test_routes.py
    test_ws.py
```

### 4.2 `ConfigBus` API (in-process)

```python
from app.config_bus import bus

# At module import time, modules register their defaults + schemas
bus.register_default(
  "models.default.provider",
  "ollama-cloud",
  schema={
    "type": "string",
    "enum": ["ollama-cloud", "openai", "anthropic", "venice"],
    "title": "Default provider",
    "category": "models",
  },
)

# Anywhere in code:
provider = bus.get("models.default.provider")

# Subscribe to changes:
@bus.on("models.default.provider")
async def reload_provider(new, old):
    await provider_registry.refresh()

# Multi-key subscribe:
@bus.on_prefix("feature.flags.")
async def flag_changed(key, new, old):
    ...

# Set (used by HTTP route + admin code):
await bus.set("models.default.provider", "openai", actor="user:meg")
```

### 4.3 Migration: replace direct config reads

For every existing module, find direct config reads and replace with `bus.get`. Sources to check:
- `os.environ.get(...)` calls — keep ENV as RO source layer 2
- `settings.something` (pydantic settings) — register each as a bus key
- Hardcoded constants that should be tunable — register with default

This is the largest part of the work. Inventory phase first; do not refactor blindly.

### 4.4 Activity feed integration

Every `bus.set` / `bus.delete` writes an `agent_events`-style entry (or whatever Sprint 4's `/api/v2/activities` uses):

```json
{
  "kind": "config.set",
  "summary": "models.default.provider: ollama-cloud → openai",
  "actor": "user:meg",
  "ts": ...
}
```

### 4.5 Bulk import / export

- `GET /api/v2/config/export` returns full snapshot as JSON (secrets redacted)
- `POST /api/v2/config/import` accepts a snapshot (atomic, validated, with diff preview)

This lets Meg back up her settings or move them between installations.

---

## 5. Catalog of keys to register on day one

This is the minimum bus catalog. Each phase adds more.

| Key | Default | Used by |
|---|---|---|
| `models.default.provider` | `ollama-cloud` | provider registry |
| `models.default.id` | `qwen3-coder:480b` | model picker |
| `models.cost_cap_per_day_usd` | `5.0` | quota tracker |
| `feature.flags.auto_pick` | `false` | Sprint 7/9 |
| `feature.flags.watcher_auto_spawn` | `true` | Phase 6.E |
| `feature.flags.qudos_enabled` | `false` | Phase G |
| `cron.watcher.interval_seconds` | `30` | cron manager |
| `cron.auditor.interval_seconds` | `300` | cron manager |
| `cron.supervisor.interval_seconds` | `600` | cron manager |
| `security.tailscale.required` | `true` | Phase B |
| `security.cors.allowlist` | `[]` | server.py CORS middleware |
| `ui.theme.default` | `dark` | Phase O |
| `ui.appearance.font_scale` | `1.0` | Phase O |
| `ui.appearance.density` | `comfortable` | Phase O |
| `ui.wallpaper.url` | `null` | Phase O |
| `agents.kill_after_minutes` | `15` | F7 |
| `agents.acceptance_timeout_seconds` | `60` | F7 |

Add as needed. Each new key requires schema + category.

---

## 6. Acceptance

- [ ] `curl PUT /api/v2/config/feature.flags.use_ollama_default -d '{"value": false}'` → next chat completion uses non-Ollama provider without restart
- [ ] Two browser tabs subscribed to `/api/ws/config` both receive `config.set` event within 1s of mutation
- [ ] Setting an invalid value (e.g. enum mismatch) returns 400 with field-level detail; previous value retained
- [ ] `DELETE /api/v2/config/some.key` removes the Mongo override and `bus.get` returns the default
- [ ] Secret values never appear in `GET /api/v2/config` responses (placeholder `***`)
- [ ] Bulk endpoint is atomic — partial failure rolls back all changes
- [ ] In-process subscribers receive callbacks before HTTP response returns
- [ ] Activity feed shows every config mutation with actor + diff
- [ ] `pytest backend/app/config_bus/tests/` green
- [ ] Backend restart with Mongo intact → all values restored exactly
- [ ] Backend restart with Mongo wiped → all defaults applied; service still works

---

## 7. Out of scope

- Per-user config (single-tenant for now). Multi-tenant deferred to Phase I Personas.
- Time-bounded settings ("on for 1 hour then revert") — deferred.
- Config history/rollback UI — only `version` is tracked in this phase. Restore-by-version added later.
- Encrypted-at-rest for non-secret values.
- Config diff in PR-style UI.

---

## 8. Why this phase first

Without it:
- Every "settings page" in the UI is fake
- Every backend setting requires a restart
- Phase O (theme), Customise (E3), F1 (cost caps), Sprint 9 (auto-pick toggle) cannot land properly

After it:
- Every UI control is wired in 5 lines: `bus.get(key)` on backend, schema-driven form on frontend (Phase 0.2 + 0.3)

---

End of Phase 0.1 handoff.
