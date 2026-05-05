# Backend Requests — Frontend → Gateway

Companion to `API_CONTRACT.md`. The contract document is what the backend
**ships today**; this file is what the frontend **wants next**, organized
by the page that needs it. Backend thread can pick items off in any order.

Last updated: 2026-05-05 (Phase C, after Hermes-removal commit)
Frontend at: `OpenClaw-MissionControl/frontend/`
Gateway at:  `~/backend` (port 7801)

---

## Conventions

- All paths under `/api/v2/*` unless noted.
- All non-loopback callers must send `X-Mission-Token`. Loopback bypass.
- Numeric timestamps are ms epoch unless noted.
- Empty arrays preferred over `null` for collection fields.
- 200 with empty body is acceptable for "service exists but has nothing to report".

---

## /system page (Phase C, PART 2) ── PRIORITY: HIGH

### `GET /api/v2/system/stats`

Server-side cache: **2 seconds**. Frontend polls every **3s** when the
System page is visible (paused via `document.visibilityState`).

```jsonc
{
  "cpu": {
    "pct": 0.0–100.0,        // overall %, never null
    "cores": 12,
    "load1": 1.42,
    "load5": 1.18,
    "load15": 0.97
  },
  "ram": {
    "usedGB": 6.2,
    "totalGB": 16.0
  },
  "disk": null,              // ←── may be null if `df` times out
  // ── or ──
  "disk": {
    "usedGB": 256.4,
    "totalGB": 931.0
  },
  "network": {
    "rxMBps": null,          // ←── null on first call after gateway boot
    "txMBps": null,          //     and any time rate is unavailable
    "sparkline": []          // optional, last ~60 sample points
  },
  "uptime_seconds": 12345
}
```

**Frontend rendering rules:**
- `network.rxMBps` / `txMBps` null → render `"—"` (em dash), never `0`.
  User must not infer "network is idle" from missing data.
- `disk` whole-object null → entire disk card shows `"—"` placeholder.
- `cpu.pct` always populated.

---

### `GET /api/v2/system/services`

Server-side cache: **5 seconds**. Frontend polls every **8s** when the
Services tab is visible.

```jsonc
[
  {
    "name": "Mission Control Gateway",
    "status": "connected",
    "detail": "13 models routable",      // free-form short string
    "lastCheck": 1730851234567,
    "url": "ws://127.0.0.1:7801",        // optional
    "restartable": false
  },
  {
    "name": "Venice",
    "status": "rate_limited",
    "detail": "429 from upstream — backing off 30s",
    "lastCheck": 1730851234123,
    "restartable": false
  },
  {
    "name": "Ollama",
    "status": "disconnected",
    "detail": "ECONNREFUSED 127.0.0.1:11434",
    "lastCheck": 1730851230000,
    "url": "http://127.0.0.1:11434",
    "restartable": true
  }
]
```

**Status enum (7 values) → frontend pill colour:**

| status         | colour | extra      |
|----------------|--------|------------|
| `connected`    | green  | —          |
| `disconnected` | red    | —          |
| `rate_limited` | yellow | —          |
| `auth_failed`  | orange | —          |
| `corrupted`    | red    | ⚠ warning icon |
| `locked`       | yellow | —          |
| `unknown`      | gray   | —          |

**Frontend rules:**
- Render whatever array the backend returns. Don't try to detect "is
  Venice configured?" client-side — backend already omits services
  whose env vars aren't set.
- `detail` string is rendered verbatim (truncate to ~60 chars in pill, full on hover).
- Restart button on each card opens a **confirm modal only** (no real restart yet).

---

### `POST /api/v2/system/services/:name/restart` ── DEFERRED

Not implemented. Frontend wires a confirm modal that just dismisses; no
HTTP call yet. Backend can implement when service-management work lands.

---

## /sessions page (Phase C, PART 3) ── PRIORITY: MEDIUM

### `GET /api/v2/threads`

Already exists per gateway boot log. Frontend will curl once and document
real shape into `API_CONTRACT.md` before locking code. Suggested shape:

```jsonc
{
  "threads": [
    {
      "id": "uuid",
      "title": "first user message snippet",
      "modelId": "venice/claude-opus-4-7",
      "runtime": "openclaw",
      "source": "main" | "cron" | "sub-agent" | "chat",  // ← see below
      "messageCount": 12,
      "tokenCount": 4521,                                  // optional, FE can estimate
      "createdAt": 1730851000000,
      "updatedAt": 1730851500000
    }
  ]
}
```

### Optional but useful — `source` field

Frontend will infer client-side **for now**:
- `source = 'cron'` if `prompt.startsWith('[auto-cron')` on any message
- `source = 'sub-agent'` if thread has a `parentTaskId`
- `source = 'chat'` otherwise

If backend wants to set this authoritatively at thread creation, it
saves the FE inference logic. Not blocking.

---

## /customize page (Phase C, PART 5) ── PRIORITY: MEDIUM

### Skills

```
GET    /api/v2/skills?tab=installed|marketplace|featured
       → [{ id, name, author, description, risk, tags, installed,
            enabled, version }]
       risk: "Benign" | "Caution" | "Restricted"
GET    /api/v2/skills/:id/readme            → markdown string
POST   /api/v2/skills/:id/install
POST   /api/v2/skills/:id/uninstall
PATCH  /api/v2/skills/:id { enabled: bool }
```

### Plugins

```
GET    /api/v2/plugins
       → [{ id, name, version, description, status, config }]
POST   /api/v2/plugins/:id/install
POST   /api/v2/plugins/:id/uninstall
PATCH  /api/v2/plugins/:id { enabled: bool, config: {...} }
```

### Desktop Apps (per-device)

```
GET    /api/v2/system/apps?device=mac|iphone|ipad
       → [{ name, bundleId, version, category, iconPath?, installed }]
       category: "Creative" | "Productivity" | "Communication" | "Dev" | "Other"

For Mac:        shell `system_profiler SPApplicationsDataType -json`
                (cache aggressively — system_profiler is slow)
For iPhone/iPad: return [] + { device_status: "not_paired" } header
                until a companion mobile agent ships.

Stub source for early dev:
  ~/backend/data/desktop_apps_stub.json   (Meg can hand-edit)
```

### Per-app Qudos permissions

```
PATCH  /api/v2/qudos/apps/:bundleId
       body: { allowReadTitle, allowScreenshot, allowKeyboard,
               allowMouse, allowClipboard }   (all bool, default OFF)
```

---

## /design page (Phase C, PART 6) ── PRIORITY: LOW (frontend ships stubbed first)

```
POST   /api/v2/design/generate
       body: { prompt, aspectRatio: '1:1'|'2:3'|'16:9'|'9:16'|'21:9',
               mode: 'image'|'video'|'agent',
               quality: 'speed'|'quality',
               references?: [imageId] }
       → { generationId, status: 'queued', estimatedSeconds }

WS     /api/ws/design/generations
       streams: { generationId, progress: 0-1, completed?: imageUrl[] }

GET    /api/v2/design/history?since=&limit=
       → [{ id, prompt, aspectRatio, generatedAt, imageUrls[] }]

POST   /api/v2/design/edit
       body: { imageId, instruction, mask?: base64-png }
       → { generationId }   (then via WS)
```

Backend routing target: Venice image models (and OpenAI gpt-image-1
once OpenAI image API is wired into the model router).

---

## Qudos backend bridge ── PRIORITY: LATER

Already documented in `frontend/src/lib/qudosApi.js` header comment:

```
GET    /api/v2/qudos/apps                          → supported app catalog
GET    /api/v2/qudos/apps/:id/capabilities         → per-app capabilities
POST   /api/v2/qudos/apps/:id/enable
POST   /api/v2/qudos/apps/:id/disable
POST   /api/v2/qudos/sessions { appId, task, agent, capabilities }
                              → { id, jobId, status }
POST   /api/v2/qudos/sessions/:id/pause
POST   /api/v2/qudos/sessions/:id/stop
WS     /api/ws/qudos/events                       ← step + suggestion stream
POST   /api/v2/qudos/suggestions/:id/approve
POST   /api/v2/qudos/suggestions/:id/dismiss
```

Plus macOS Screen Recording + Accessibility permission probes (via
`tccutil`-style API).

---

## Out of scope for Phase C

These are noted as future work, not asks for this phase:

- `/memory/*` extended endpoints (tree, file CRUD, health, process pipeline)
- `/cron/*` endpoints (jobs, runs, run-now, enable/disable)
- `/security/audit`, `/agents/evals`
- `/usage/totals`, `/by-agent`, `/by-model`
- `/standup`, `/standup/history`, `/standup/generate`
- Persistent `/events?since=&types=`
- WS chat-frame extensions for inline tool/thinking/artifact events

---

## Phase E backlog (post Phase D polish)

Captured from frontend conversations during Phase C; not actionable until
Phase D design rollout is complete.

### Customize functional rebuild — REQUIRES SPEC REWRITE

A handoff document `CUSTOMISE_HANDOFF_OPENCODE.md` was authored on
2026-05-05 describing real-time wiring for Skills / Plugins / Connectors
on the `/customize` page. The doc assumes **FastAPI + MongoDB**, which
does not match our actual gateway (**Node + SQLite at :7801**). The
backend endpoints it proposes (`/api/skills/custom`, `/api/plugins`,
`/api/connectors`) do not exist on our gateway.

Action: rewrite the handoff for the Node/SQLite stack before any
implementation. Item 5 from `BACKEND_REQUESTS.md` (`/customize page`
above) is the active spec for those endpoints.

### Files-as-config browser — NEW BACKEND WORK

Frontend wants a left-pane directory tree + right-pane editor for backend
config (mirrors the Hermes "Files" page). Useful for live config tweaks
without touching a terminal.

Phased asks (smallest first):

```
GET  /api/v2/files/tree?path=&depth=     → directory listing, depth-bounded
GET  /api/v2/files/read?path=            → text contents (UTF-8 only first pass)
                                           reject binary, reject paths outside an
                                           explicit allowlist (configs, prompts,
                                           knowledge-base, NOT secrets/state.db)
```

Edit-config (`PUT /api/v2/files/write`) and tool-permission toggles come
later — read-only first to derisk.

Path allowlist must be enforced server-side; never trust the frontend to
restrict scope.
