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

### Activities (Sprint 4 — unified event stream)
- GET /api/v2/activities?since=&until=&categories=&severities=&actor=&entity_id=&type_prefix=&limit=&offset=
- GET /api/v2/activities/:id
- GET /api/v2/activities/stats?since=
- WS  /api/ws/activities (with optional ?backlog=1)

#### Activity record shape
```
{
  "id": string,
  "type": string,             // e.g. "agent.task.completed", "cron.run.fired", "model.usage"
  "category": "agent" | "cron" | "approval" | "chat" |
              "system" | "security" | "watcher" | "model",
  "severity": "info" | "warn" | "error" | "critical",
  "actor": string | null,     // agent name, "user", "system", "scheduler"
  "entity_type": string | null,
  "entity_id": string | null, // FK to relevant table row
  "description": string,
  "data": object | null,      // type-specific blob
  "created_at": number
}
```

#### GET /api/v2/activities
Default lookback: last 24 hours. Default limit: 100. Max limit: 500.

Response:
```
{
  "activities": Activity[],
  "total": number,
  "has_more": boolean,
  "oldest_timestamp": number | null,
  "newest_timestamp": number | null
}
```

Filter parameters:
- `since` / `until` — ms epoch bounds
- `categories` — CSV of categories
- `severities` — CSV of severities
- `actor` — exact match
- `entity_id` — exact match (e.g., one cron job's history)
- `type_prefix` — e.g. `agent.` matches all `agent.*` types

#### GET /api/v2/activities/stats
Default window: last hour. Pass `since` to widen.

```
{
  "by_category": { agent: 234, cron: 56, ... },
  "by_severity": { info: 250, warn: 12, error: 3 },
  "by_actor":    { watcher: 100, planner: 40, ... },
  "total": number,
  "rate_per_minute": number,
  "window_minutes": number
}
```

#### WS /api/ws/activities
On connect: server sends `{ type: "hello", serverTime }`.
Pass `?backlog=1` in URL to also receive a `{ type: "backlog",
activities: [...50 most recent] }` frame.

After connect, server streams `{ type: "activity", activity: <Activity> }`
frames as they fire. Client may filter server-side:

```
// Subscribe with filters
ws.send(JSON.stringify({
  type: "subscribe",
  filters: {
    categories: ["agent", "cron"],
    severities: ["warn", "error", "critical"]
  }
}));
// → server replies { type: "subscribed", filters: {...} }
//   subsequent activity frames pre-filtered server-side

// Unsubscribe (no filters = all activities)
ws.send(JSON.stringify({ type: "unsubscribe" }));
```

#### Retention
Configurable via env:
- `ACTIVITIES_RETAIN_DAYS` (default 30) — non-error/critical rows
- `ACTIVITIES_RETAIN_DAYS_ERROR` (default 90) — error/critical rows

Prune runs at gateway boot and every 24 hours thereafter.

#### Note on existing channels
This stream is **additive** — `/api/ws/agents` and `/api/ws/approvals`
continue to broadcast their domain-specific frames unchanged. Activities
is a parallel rollup view for the Inspector / activity-feed pane that
wants every-event-in-one-place.

### Usage (Sprint 5 — token tracking)
- GET /api/v2/usage/totals?since=&until=
- GET /api/v2/usage/by-agent?since=&until=
- GET /api/v2/usage/by-model?since=&until=
- GET /api/v2/usage/projections

#### Token tracking schema (Sprint 5 additions)
The following columns were added at boot via idempotent ensureColumn():

`model_choices`:
  tokens_in, tokens_out, tokens_total INTEGER
  cost_estimate_usd REAL
  response_latency_ms INTEGER

`agent_tasks`:
  tokens_in, tokens_out INTEGER
  cost_estimate_usd REAL

`messages`:
  tokens_in, tokens_out INTEGER
  cost_estimate_usd REAL
  response_latency_ms INTEGER

Cost is estimated from `data/model_capabilities.json` `costPerMTokIn` /
`costPerMTokOut` fields. Free models (Ollama Cloud :cloud variants,
Venice subscription tier) report `cost_estimate_usd: 0`.

#### GET /api/v2/usage/totals
Hero-level rollup: cost, tokens, calls across all metered activity in
the window. Defaults to last 24 hours.

```
{
  "total_cost_usd": number,
  "total_tokens_in": number,
  "total_tokens_out": number,
  "total_calls": number,
  "breakdown": [
    { "key": "chat" | "agent",
      "cost": number, "tokens_in": number,
      "tokens_out": number, "calls": number }
  ],
  "since": number,
  "until": number
}
```

#### GET /api/v2/usage/by-agent
Per-agent rollup (agent_tasks only, chat is excluded since chat doesn't
have an agent attribution). Sorted by cost descending.

```
{
  "by_agent": [
    { "agent": string, "cost_usd": number,
      "tokens_in": number, "tokens_out": number, "calls": number }
  ],
  "since": number,
  "until": number
}
```

#### GET /api/v2/usage/by-model
Per-model rollup (chat + agent unioned). Sorted by cost descending.

```
{
  "by_model": [
    { "model": string, "provider": string,
      "cost_usd": number, "tokens_in": number,
      "tokens_out": number, "calls": number }
  ],
  "since": number,
  "until": number
}
```

#### GET /api/v2/usage/projections
Monthly cost projection from the last 7 days of activity.

```
{
  "projected_monthly_usd": number,
  "confidence": "low" | "medium" | "high",
                                // <100 calls = low, <500 = medium, else high
  "based_on_days": 7,
  "daily_avg_usd": number,
  "sample_size_calls": number
}
```

### Cron (Sprint 3)
- GET    /api/v2/cron/jobs?enabled=&is_system=&agent=
- GET    /api/v2/cron/jobs/:id
- POST   /api/v2/cron/jobs
- PATCH  /api/v2/cron/jobs/:id
- DELETE /api/v2/cron/jobs/:id
- POST   /api/v2/cron/jobs/:id/run-now
- GET    /api/v2/cron/runs?since=&cron_job_id=&status=&limit=
- GET    /api/v2/cron/runs/:id

#### Cron job shape
```
{
  "id": string,                       // 'sys-*' for system, 'usr-{8hex}' for user
  "name": string,
  "description": string | null,
  "schedule": string,                 // standard cron expression
  "agent": "watcher"|"auditor"|"supervisor"|"planner"|"executor"|"builder"|"meta",
  "prompt": string,                   // 10-4000 chars
  "enabled": boolean,
  "is_system": boolean,               // user jobs are mutable, system jobs are 'enabled'-only
  "last_run_at": number | null,
  "next_run_at": number | null,
  "run_count": number,
  "failure_count": number,
  "created_at": number,
  "updated_at": number
}
```

#### Cron run shape
```
{
  "id": string,                       // uuid
  "cron_job_id": string,
  "agent_task_id": string | null,    // populated once submit() returns
  "fired_at": number,
  "completed_at": number | null,
  "status": "running" | "done" | "failed" | "skipped",
                                     // 'skipped' = agent paused/stopped via /agents/control
  "error_message": string | null,
  "manual": boolean                   // true if fired via /run-now
}
```

#### POST /api/v2/cron/jobs
Creates a user cron job. System jobs (is_system=1) cannot be created via API.

Body:
```
{
  "name": string,                     // unique among user jobs
  "description": string | null,       // optional
  "schedule": string,                 // valid cron expression
  "agent": CronAgent,                 // see enum above
  "prompt": string,                   // 10-4000 chars
  "enabled": boolean                  // default true
}
```

Responses:
- `201 Created` — `{ ok: true, job }`
- `400 Bad Request` — `{ ok: false, error: 'invalid_<field>', message }`
- `403 Forbidden` — when body sets `is_system: true`
- `409 Conflict` — `{ ok: false, error: 'name_conflict' }`

#### PATCH /api/v2/cron/jobs/:id
Modifies a job. System jobs accept ONLY `enabled` field; other fields
return `403 system_field_locked`. User jobs accept any subset of
`{ name, description, schedule, agent, prompt, enabled }`.

Triggers `cronScheduler.reload()` so changes take effect immediately.

#### DELETE /api/v2/cron/jobs/:id
Returns `204 No Content` on success. Returns `403 system_jobs_immutable`
for system jobs (use PATCH `enabled=false` to silence them instead).
Cascades to delete linked `cron_runs` rows.

#### POST /api/v2/cron/jobs/:id/run-now
Manually fires the job, ignoring its schedule. Creates a `cron_runs`
row with `manual: true`. Does NOT update `next_run_at`.

Returns:
```
{
  "ok": true,
  "run_id": string,
  "agent_task_id": string | null    // null if submit refused (paused agent)
}
```

#### GET /api/v2/cron/runs
History of cron fires. Default lookback is 24 hours.

Query params:
- `since`: ms epoch lower bound (default: now − 24h)
- `cron_job_id`: filter to one job's history
- `status`: filter to `running` | `done` | `failed` | `skipped`
- `limit`: 1-500 (default 100)

Returns: `{ runs: CronRun[], total: number }`

#### WS broadcasts on /api/ws/agents (Sprint 3)
Every cron lifecycle event emits a frame on the existing agents socket:

```
{ type: "cron.created",            payload: { job }, ts }
{ type: "cron.updated",            payload: { job }, ts }
{ type: "cron.deleted",            payload: { id }, ts }
{ type: "cron.enabled",            payload: { id, enabled }, ts }
{ type: "cron.fired",              payload: { job_id, run_id,
                                              agent_task_id, manual }, ts }
{ type: "cron.completed",          payload: { job_id, run_id, status,
                                              error_message }, ts }
{ type: "cron.scheduler.reloaded", payload: { active: number }, ts }
```

`cron.fired` is emitted twice per fire — first when the run row is
created (`agent_task_id: null`), then again after submit() returns with
the linked id. Frontend should de-dupe on `run_id`.

#### System cron seeds (first-boot only)
On first gateway boot with an empty `cron_jobs` table, these 5 system
jobs are seeded automatically. They cannot be deleted but their
`enabled` flag can be flipped via PATCH:

| id | schedule | agent | purpose |
|---|---|---|---|
| `sys-watcher` | `*/5 * * * *` | watcher | Health check (preserves the b6d946d cadence; PATCH to change) |
| `sys-auditor` | `*/30 * * * *` | auditor | 30-min activity digest |
| `sys-supervisor` | `0 * * * *` | supervisor | Hourly pipeline review |
| `sys-selfimprove-daily` | `0 3 * * *` | auditor | Daily 24h digest written to `data/memory/audits/` |
| `sys-selfimprove-weekly` | `30 3 * * 0` | meta | Weekly meta-review of trends |

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
