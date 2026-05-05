# Mission Control API Contract

Last updated: 2026-05-04
Backend version: 0.7.1

## Backend (your bot at :7801)

### Health
- GET  /api/health

### Threads
- GET    /api/v2/threads
- GET    /api/v2/threads/:id/messages
- DELETE /api/v2/threads/:id

### Memory
- GET /api/v2/memory/global
- PUT /api/v2/memory/global

### Agents
- GET    /api/v2/agents/tasks?since=&limit=
- POST   /api/v2/agents/tasks
- POST   /api/v2/agents/pipeline
- GET    /api/v2/agents/pipelines
- GET    /api/v2/agents/pipelines/:id
- GET    /api/v2/agents/pick-model
- GET    /api/v2/agents/model-stats
- POST   /api/v2/agents/tasks/:id/outcome
- GET    /api/v2/agents/control
- POST   /api/v2/agents/control

#### POST /api/v2/agents/control
Runtime control for any of the 7 controllable agents (or all of them
at once). Persists to SQLite — survives gateway restart. Broadcasts
`agent.control` on `WS /api/ws/agents` after every state change.

Body:
```
{
  "agent":  "watcher" | "auditor" | "supervisor" |
            "planner" | "executor" | "builder" | "meta" | "all",
  "action": "start" | "stop" | "pause" | "resume"
}
```

Responses:
- `200 OK` — state changed:
  ```
  {
    "ok": true,
    "agent": string,
    "action": string,
    "previousState": "running" | "paused" | "stopped",
    "currentState":  "running" | "paused" | "stopped",
    "ts": number
  }
  ```
  When `agent: "all"`, response shape is:
  ```
  {
    "ok": true,
    "agent": "all",
    "action": string,
    "results": [
      { "agent": "watcher", "previousState": "...", "currentState": "...", "changed": bool },
      ...
    ],
    "ts": number
  }
  ```
- `400 Bad Request` — `unknown_agent` or `unknown_action`:
  ```
  { "ok": false, "error": "unknown_agent"|"unknown_action", "message": string }
  ```
- `409 Conflict` — `already_in_state`:
  ```
  { "ok": false, "error": "already_in_state", "currentState": string }
  ```
  Only fired for single-agent calls. `agent: "all"` always returns 200
  with per-agent `changed: bool`.

Semantics:
- `start` and `resume` are aliases — both set state to `running`.
- `stop` and `pause` both clear in-memory timers for loop agents
  (watcher, auditor, supervisor) and cause `submit()` to throw
  `AgentPausedError` for submit-only agents (planner, executor,
  builder, meta).
- `pause` is reserved as a distinct state from `stop` for the future
  cron jobs sprint, where pause will preserve the schedule and stop
  will disable it. Today they have identical effect.

#### GET /api/v2/agents/control
Read-only state snapshot of all 7 controllable agents.
```
{
  "agents": {
    "watcher": "running"|"paused"|"stopped",
    "auditor": ...,
    "supervisor": ...,
    "planner": ...,
    "executor": ...,
    "builder": ...,
    "meta": ...
  },
  "ts": number
}
```

#### Submit refusal — 503 on paused/stopped agents
`POST /api/v2/agents/tasks` returns `503 Service Unavailable` with
`Retry-After: 30` header when the requested agent is paused or stopped:
```
{
  "ok": false,
  "error": "agent_paused",
  "agent": string,
  "currentState": "paused" | "stopped",
  "message": string
}
```

#### WebSocket broadcast — agent.control
Every successful state change emits this frame on `/api/ws/agents`:
```
{
  "type": "agent.control",
  "payload": {
    "agent": string,
    "previousState": string,
    "currentState": string
  },
  "ts": number
}
```
Frontend should subscribe to keep multi-tab views in sync.

### Models
- GET  /api/v2/models
- GET  /api/v2/models/groups
- GET  /api/v2/models/providers
- POST /api/v2/models/refresh
- POST /api/v2/models/resolve
- GET  /api/v2/models/resolve/:model

### System (token-gated)
- GET  /api/v2/system/state
- GET  /api/v2/system/stats
- GET  /api/v2/system/services
- GET  /api/v2/system/apps?device=mac
- POST /api/v2/system/active-window
- POST /api/v2/system/screenshot
- POST /api/v2/desktop/action

#### GET /api/v2/system/stats
Host hardware snapshot. Cached for 2 s; safe to poll.
Response shape:
```
{
  uptime: number,                    // seconds
  cpu: {
    cores: number,
    model: string | null,
    loadAvg: { "1": number, "5": number, "15": number },
    utilisation1m: number            // 0..1, loadAvg[0]/cores clamped
  },
  memory: {
    totalBytes, freeBytes, usedBytes: number,
    usedPercent: number              // one decimal, e.g. 73.4
  },
  disk: {                            // null if df failed/timed out
    mount: "/",
    totalBytes, usedBytes, availableBytes: number,
    usedPercent: number
  } | null,
  network: {
    interfaces: [
      {
        name: string,                // e.g. "en0", "lo0", "utun4"
        rxBytes: number,             // counter since boot
        txBytes: number,
        rxBytesPerSec: number | null,// null on first call after boot
        txBytesPerSec: number | null
      }
    ]
  },
  takenAt: number                    // ms epoch
}
```
Notes:
- `rxBytesPerSec`/`txBytesPerSec` are `null` for the first call after gateway
  boot (no baseline yet). Subsequent calls report bytes/sec since the last
  cached sample.
- All shell-outs (`df`, `netstat`) have a 2 s timeout. If one fails the
  affected field reports `null` or an empty array; the rest of the response
  still returns 200.

#### GET /api/v2/system/services
Connection status for the things the bot depends on. Cached 5 s.
Probes run in parallel — total cold-cache latency ~3-4 s on the worst
service. Frontend should render a per-service loading spinner on first
paint, not block.

Response:
```
{
  services: ServiceStatus[],
  takenAt: number
}
```

`ServiceStatus`:
```
{
  name: string,            // "gateway" | "ollama" | "tailscale" | "sqlite"
                           // | "venice" | "openrouter" | "huggingface"
  status: string,          // see status-per-service table below
  url?: string,
  detail?: string,         // short human-readable summary for the badge
  lastCheck: number,       // ms epoch
  meta?: object            // provider-specific extras; see below
}
```

**Always present**: `gateway`, `ollama`, `tailscale`, `sqlite`.
**Conditional**: `venice` / `openrouter` / `huggingface` appear only when
their API key is set in `.env`. Omitted entirely otherwise (cleaner UI
than a "no key configured" card).

Status values per service:
| service | possible status values |
|---|---|
| gateway | `connected` (always — request hit it) |
| ollama | `connected`, `disconnected` |
| tailscale | `connected`, `disconnected` |
| sqlite | `connected`, `locked`, `corrupted`, `disconnected` |
| venice | `connected`, `rate_limited`, `disconnected` |
| openrouter | `connected`, `rate_limited`, `disconnected` |
| huggingface | `connected`, `auth_failed`, `rate_limited`, `disconnected` |

**Important caveat — `connected` does NOT always mean "auth is valid":**
- Venice and OpenRouter `/v1/models` are PUBLIC endpoints; they return
  200 even with a bogus API key. A `connected` status here means "the
  host is reachable from this machine," not "your key works." Auth
  failures for these providers surface at chat-completion time.
- HuggingFace `/api/whoami-v2` does validate the key, so its
  `auth_failed` status is meaningful.
- The frontend can read `meta.auth_checked` (boolean) on Venice /
  OpenRouter / HuggingFace entries to know which interpretation applies.

Per-service `meta` shapes:

`gateway`:
```
{
  uptime_seconds: number,
  version: string,
  connected_ws_clients: number,    // sum across chat/approvals/agents WS
  active_agents: number,           // count of running cron loops
  agent_loops: [{ name, running }],
  last_error_at: number | null,    // most recent task failure timestamp
  last_error_detail: string | null
}
```

`ollama`:
```
{ model_count: number, response_time_ms: number }
```

`tailscale`:
```
{
  backend_state: string,           // "Running" | "Stopped" | "NeedsLogin" | ...
  tailscale_ip: string | null,
  hostname: string | null,
  magic_dns_suffix: string | null
}
```

`sqlite`:
```
{ size_bytes: number, size_mb: number }
```

`venice` / `openrouter` / `huggingface`:
```
{
  response_time_ms: number,
  http_status?: number,            // present when probe got a response
  auth_checked: boolean            // see caveat above
}
```

#### GET /api/v2/system/apps?device=mac
Installed-application catalog. Mac only for now (`device=mac` required).
Cached 5 minutes. Response is gzipped when the client sends
`Accept-Encoding: gzip` (~90% compression on a 379-app payload).

Response:
```
{
  device: "mac",
  apps: InstalledApp[],
  count: number,
  byCategory: { System, Creative, Productivity, Communication, Browser, Developer, Other: number },
  takenAt: number
}
```

`InstalledApp`:
```
{
  name: string,
  bundleId: string | null,         // ALWAYS null on mac — see note below
  version: string | null,
  path: string,                    // absolute path to .app bundle
  lastModified: string | null,     // ISO-8601 from system_profiler
  category: "System" | "Creative" | "Productivity" |
            "Communication" | "Browser" | "Developer" | "Other",
  obtainedFrom: string | null      // apple | mac_app_store |
                                   // identified_developer | safari | unknown
}
```

Notes:
- **bundleId is null on Mac.** macOS `system_profiler SPApplicationsDataType
  -json` does not emit bundleId. Categorisation is path + name based.
  If a downstream consumer truly needs bundleId per app, the gateway
  could read each app's `Info.plist` (~5-10 s extra for 200 apps) — defer
  until requested.
- Categorisation order (first match wins): Browser → Communication →
  Creative → Developer → Productivity → System (path-fallback) → Other.
  First-party Apple apps that live under `/System/Applications/` (Mail,
  Messages, Calendar, Notes, etc.) are correctly bucketed by purpose, not
  lost in the System pile.
- Background daemons under `/System/Library/` that don't match any known
  app name fall through to `System`.
- Apps sorted by `(category, name)` ascending. Frontend can re-sort.
- 400 returned when `device` is anything other than `mac`.
- Cold cache latency ~2 s (system_profiler is slow). Warm cache ~0 ms.

### Sync (mobile)
- GET /api/v2/sync/snapshot

### WebSocket
- WS /api/ws/chat?token=MISSION_TOKEN
- WS /api/ws/approvals
- WS /api/ws/agents

## Frontend expectations
The frontend expects these endpoints with these shapes.
Whenever a thread changes one, BOTH threads update this file.

## Environment flags (backend)

- `WATCHER_AUTO_SPAWN` — set to `1` to allow the watcher agent to auto-spawn a
  planner pipeline when health severity transitions ok → warn|critical.
  Default: disabled. When enabled, a 30-minute cooldown gates re-spawns to
  prevent burning provider credits when severity oscillates.

- `GATEWAY_HOST` — bind address. Default `127.0.0.1` (loopback only).
  Set to `0.0.0.0` to expose over Tailscale (and any other interface).
  Currently set to `0.0.0.0` for iPhone/iPad access.

- `TAILNET_TOKEN_BYPASS` — defaults to enabled. Requests from peer IPs in
  the Tailscale CGNAT range (`100.x.x.x`) skip the X-Mission-Token check,
  on the assumption the tailnet is single-user and private. Set to `0`
  in `.env` to disable the bypass (require a token even from tailnet
  peers) — do this if you ever share-out a tailnet node or invite another
  user to your tailnet.
