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

> **Promoted to Phase E (read-only) — see queue section below.**

Frontend wants a left-pane directory tree + right-pane editor for backend
config (mirrors the Hermes "Files" page). Useful for live config tweaks
without touching a terminal.

---

## QUEUE — confirmed backend work

The items below are confirmed for backend implementation, ordered roughly
by dependency / when they'll ship. Each has acceptance criteria the
frontend can rely on once shipped.

---

### Phase E — Files-as-config browser (READ ONLY, v1)

**Owner:** backend
**Status:** queued
**Triggered by:** Meg's "files for adjustments" ask, May 6 2026

**Surface (v1, read-only):**

```
GET /api/v2/files/tree?root={data|prompts|memory|config}
GET /api/v2/files/read?path=...
```

`root` is a fixed enum mapping to allowlisted directories — no arbitrary
filesystem access:

| `root` value | Maps to                                                           |
|--------------|-------------------------------------------------------------------|
| `data`       | `~/backend/data/` (excluding `chat.db`, `*.db-shm`, `*.db-wal`)   |
| `prompts`    | `~/backend/data/agent_prompts/`                                   |
| `memory`     | `~/backend/data/memory/`                                          |
| `config`     | `~/backend/.env.example`, `model_capabilities.json`, `package.json` |

`path` on `/read` must resolve inside one of the allowlisted roots.
Path-traversal guards: resolve, then `path.relative(root, target)` must
not start with `..`. Same pattern Hermes uses in
`swarm-memory.ts:assertInside()`.

**Response shapes (v1):**

```jsonc
// /tree
{
  "root": "prompts",
  "entries": [
    { "name": "planner.md", "path": "data/agent_prompts/planner.md",
      "type": "file", "size": 482, "modified": 1730851234567 },
    { "name": "subdir",     "path": "data/agent_prompts/subdir",
      "type": "dir" }
  ]
}

// /read
{
  "path": "data/agent_prompts/planner.md",
  "mime": "text/markdown",
  "content_text": "...",      // OR content_base64 for binary
  "size": 482,
  "modified": 1730851234567
}
```

Text files (`md`, `json`, `yaml`, `txt`, `ts`, `js`, `env`) decode to
`content_text`. Binary files return `content_base64` with mime sniffed
from extension.

**Out of scope for v1 (deferred):**
- Layer 2 — write endpoints (PUT, DELETE). Defer until Meg has used the
  read-only browser and we know which paths she actually wants to edit.
- Layer 3 — per-tool permission toggles (the Desktop Commander screenshot
  pattern). Requires the skills system + a permission policy engine.
  Don't size yet.

**Estimated effort:** 2-3 hours v1.
**Prerequisite:** none.

---

### Phase E+ — Doctor Fix pattern

**Owner:** backend
**Status:** queued, schedule AFTER Sprint 6 (self-learning loop closure)
**Triggered by:** MC v2 reference screenshot, the "Run Doctor Fix" banner

**Surface:**

```
GET  /api/v2/system/doctor
POST /api/v2/system/doctor/fix?issue_id=...
```

`/doctor` returns `{ issues: [Issue], scanned_at, scan_duration_ms }`.
`/fix` returns `{ ok, issue_id, applied_action, before, after }`.

**`Issue` shape:**

```jsonc
{
  "id": "string",                // stable hash of (kind, target)
  "kind": "string",              // "orphan_task" | "stale_control" | ...
  "severity": "info" | "warn" | "error",
  "title": "string",
  "description": "string",
  "fixable": true,
  "fix_action": "Delete 47 task rows older than 30 days",  // human-readable
  "data": { /* kind-specific details */ }
}
```

**Initial scanners (v1):**

1. **Orphan task records** — `agent_tasks` with `status='running'` or
   `'pending'` older than 30 days
   *Fix:* mark failed with `reason='abandoned during doctor scan'`
2. **Stale agent control flags** — paused/stopped flags pointing to
   processes that no longer exist (deferred until Sprint 2 ships
   `agent_control` table)
3. **DB bloat** — `chat.db`, `model_catalog.json`, `gateway.out.log` over
   thresholds
   *Fix:* vacuum / rotate
4. **Missing/corrupt agent_prompts files** — files referenced by code but
   absent on disk
   *Fix:* rewrite from `DEFAULT_PROMPTS` in `agentRuntime.ts`
5. **Unreachable provider endpoints** — Venice/OpenRouter/Ollama failed
   >5 times in last 24h
   *Fix:* emit a warning, no auto-action — tells Meg to log in

**Estimated effort:** ~1 day for the scanner framework + 5 scanners.
**Prerequisite:** Sprint 6 should ship first so token-tracking + outcomes
data is available — gives the "DB bloat" scanner real signal.

---

### Sprint 6 prerequisite — Token tracking on adapter responses

**Owner:** backend
**Status:** queued, ship as PART OF Sprint 6 (self-learning loop closure)
**Triggered by:** backend audit, May 5 — confirmed Costs dashboard has
no data source today

**Schema change (`model_choices` table):**

```sql
ALTER TABLE model_choices ADD COLUMN tokens_in INTEGER;
ALTER TABLE model_choices ADD COLUMN tokens_out INTEGER;
ALTER TABLE model_choices ADD COLUMN cost_estimate_usd REAL;
ALTER TABLE model_choices ADD COLUMN tokens_recorded_at INTEGER;
```

**Capture point:** `openclaw.ts` adapter, in the streaming completion
path. The OpenAI SDK exposes `usage` on the final non-stream chunk; for
streaming responses the usage field arrives in the last chunk when
`stream_options: { include_usage: true }` is requested. Add that option
when calling `chat.completions.create`, then update the `model_choices`
row on stream completion.

**Cost estimate:** multiply `tokens_in × costPerMTokIn / 1_000_000 +
tokens_out × costPerMTokOut / 1_000_000`, both pulled from
`model_capabilities.json` for the model that was *actually* used (not
the one requested — they can differ when fallback fires).

**Out of scope:** building the Costs dashboard endpoints
(`GET /api/v2/usage/totals`, `GET /api/v2/usage/by-agent`, etc).
Just instrument the data. Dashboard endpoints come after frontend
signals they want to build that screen.

**Estimated effort:** ~1 hour for instrumentation + tests.
**Prerequisite:** none — can ship before, during, or alongside Sprint 6.

---

## Sprint 7-10 — Self-learning context-aware model routing

Multi-sprint arc that turns the model picker from "score-based static
choice" into "context-aware, quota-aware, outcome-trained, multi-provider
choice across Meg's full subscription stack." Filed as a single block so
the arc is visible; sprints are independently shippable in order.

### Provider tier reference

The picker should be aware of these tiers when filtering candidates and
breaking score ties:

**TIER 1 — route freely (cost_score = 1.0):**
- Ollama Max (already routed via local 11434 proxy)
- OpenCode Go — $10/mo, 14 coding models, dollar-cap subscription
- Venice (already routed)
- HuggingFace Pro — $9/mo, $2 covered then pay-per-call

**TIER 2 — route cheap pay-per-call:**
- OpenCode Zen (MiniMax M2.5 Free, Big Pickle, Nemotron Free, etc.)
- OpenRouter cheap tier (DeepSeek, Qwen, Gemini Flash)

**TIER 3-4 — route only when needed (premium):**
- OpenCode Zen premium (Claude Opus, GPT 5.5)
- OpenRouter premium

**TIER 5 — bridge work, deferred to Sprint 10:**
- Anthropic Max (Claude Code CLI bridge)
- OpenAI ChatGPT Plus (OAuth bridge)
- Google AI / Gemini (depends on subscription type)
- Grok Max (API access TBD)
- Perplexity Max (skip unless API access changes)

---

### Sprint 7 — Context classifier + extended capabilities + 2 new providers

**Owner:** backend
**Status:** queued
**Prerequisite:** Sprints 2, 3, 4 ship first (control, cron, activities).

#### 7.1 Heuristic context classifier (free, instant)

New module `src/agents/contextClassifier.ts`. Pure function, zero LLM
calls, runs before pickModel:

```ts
classify(prompt: string, history?: ChatMessage[]): {
  contextType: "code" | "reasoning" | "creative" | "factual" | "vision" | "long",
  confidence: number,        // 0..1
  signals: string[],         // which heuristics fired, for debugging
}
```

Heuristic rules (first match wins, confidence 0.7+ when matched):
- `code` — fenced code blocks, file paths, "refactor"/"debug"/"implement"
- `vision` — image attachments OR "screenshot", "image", "picture"
- `long` — prompt + history token estimate > 32k
- `reasoning` — "why", "explain", "analyze", "compare", "design"
- `creative` — "write a", "draft", "story", "poem"
- `factual` — fall-through default, confidence 0.5

#### 7.2 Optional LLM classifier fallback

When heuristic confidence < 0.7, fire `gemma4:31b-cloud` (cheapest
Ollama Cloud model, already in the catalog) IN PARALLEL with the
default pick. Use whichever returns first; classifier result feeds the
NEXT call's picker, not this one. Prevents user-facing latency.

Gated by env flag `CONTEXT_CLASSIFIER_LLM_FALLBACK`, default off.

#### 7.3 Extended `model_capabilities.json` fields

Per-model additions:

```jsonc
{
  "id": "...",
  "provider": "...",
  // existing fields: context, costPerMTokIn/Out, speed, reasoning,
  //                  coding, structured, vision, tags, preferredFor

  // NEW Sprint 7 fields:
  "tier": 1,                    // 1-5, matches tier reference above
  "cost_score": 1.0,            // 0..1, picker bonus for free models
  "contextStrength": {          // 0..10 per context type
    "code": 9,
    "reasoning": 7,
    "creative": 6,
    "factual": 7,
    "vision": 0,
    "long": 8
  },
  "quotaPolicy": "free" | "pay_per_call" | "subscription_capped" | "free_then_paid"
}
```

Picker scoring change: `contextStrength[contextType]` replaces the
generic capability skill that currently dominates. Old skill fields
become tie-breakers.

#### 7.4 OpenCode Go provider integration

- Endpoint: `https://opencode.ai/zen/go/v1/chat/completions`
- Auth: `OPENCODE_GO_API_KEY` env var
- OpenAI-compatible — reuse the existing `providerClient.ts` pattern
  by adding an `opencode-go` branch returning the bearer-auth client
- Add 14 models to `model_capabilities.json` with `tier: 1`,
  `cost_score: 1.0`, `quotaPolicy: "subscription_capped"`
- Provider entry in `providerPolicy.ts` with `routeMode: 'direct_api'`,
  `liveFetch: true`

#### 7.5 OpenCode Zen provider integration

- Endpoint: `https://opencode.ai/zen/v1/chat/completions`
- Auth: `OPENCODE_ZEN_API_KEY` env var
- OpenAI-compatible
- Add free models with `tier: 2`, `cost_score: 1.0`,
  `quotaPolicy: "free"` (MiniMax M2.5 Free, Big Pickle, Nemotron Free)
- Add premium models with `tier: 3-4`, `cost_score` derived from
  published price, `quotaPolicy: "pay_per_call"` (Claude Opus,
  GPT 5.5 etc)

#### 7.6 Wire context → pick → adapter chain

In `chatSocket.ts`, before calling `pickModel`:
1. Run `classify(prompt, history)` (heuristic, sync)
2. Pass `contextType` to `pickModel` as a new hint field
3. If `confidence < 0.7` and LLM fallback enabled, fire fallback
   classification in parallel — DO NOT await for the current call;
   write result to a per-thread cache for next call
4. pickModel uses `contextStrength[contextType]` as its dominant
   scoring axis; ties broken by `cost_score`, then existing skill
   weights

**Estimated effort:** ~2 days. Largest single unit in the arc.

---

### Sprint 8 — Quota tracking with five quota types

**Owner:** backend
**Status:** queued
**Prerequisite:** Sprint 7 ships (needs `tier`, `quotaPolicy`,
`tokens_in/out` from Sprint 6 prereq).

#### 8.1 `quotaTracker.ts` module

Five quota types:

```ts
type QuotaType =
  | "rate_limit"           // requests/min, hard short-window
  | "daily_spend"          // $/day across all models in provider
  | "weekly_spend"         // $/week (OpenCode Go: $30)
  | "monthly_spend"        // $/month (OpenCode Go: $60, HF Pro overage: $2)
  | "subscription_cap";    // hard ceiling that, when hit, removes
                           // provider from candidate pool entirely
```

#### 8.2 Per-provider tracked state

```jsonc
{
  "provider": "opencode-go",
  "spend": {
    "today_usd": 0.43,
    "week_usd": 4.10,
    "month_usd": 12.50
  },
  "rate_limit": {
    "rpm_observed": 12,         // last 60s
    "rpm_limit": 60,            // from provider docs / 429 responses
    "consecutive_429s": 0,
    "cooldown_until_ms": null   // populated when 429 hit
  },
  "cap_proximity": {
    "monthly_cap_usd": 60,
    "monthly_used_pct": 20.8,
    "exhausted": false
  },
  "last_updated": 1730851234567
}
```

Spend computed from `model_choices.tokens_in × tokens_out × cost`
(Sprint 6 prereq). Rate-limit state observed from response headers
(`X-RateLimit-*`) and 429 responses. Cap proximity for OpenCode Go
($30/wk, $60/mo) and HuggingFace Pro ($2/mo overage).

#### 8.3 Picker integration

`pickModel` receives a `quotaSnapshot` and filters candidates:

- Provider in `cooldown_until_ms` future → excluded
- Provider with `cap_proximity.exhausted=true` → excluded
- Provider with `monthly_used_pct > 90` → score penalty -0.30
- Provider with `weekly_used_pct > 80` → score penalty -0.15

#### 8.4 New endpoint

```
GET /api/v2/quota
```

Returns the per-provider state above for every active provider. Cached
30 seconds. Frontend can render a quota dashboard from a single call.

**Estimated effort:** ~1 day.

---

### Sprint 9 — Outcome learning loop

**Owner:** backend
**Status:** queued
**Prerequisite:** Sprints 6 prereq (token tracking) + 7 (context type
in `model_choices`) ship first.

Closes the self-learning loop. Per `(agent, model, context_type)`
triple, compute a rolling 7-day quality score from `task_outcomes` and
feed it back into `pickModel` as a context-aware bonus.

New table `model_performance`:

```sql
CREATE TABLE model_performance (
  agent         TEXT,
  model         TEXT,
  context_type  TEXT,           -- new dimension vs. Sprint 6 sketch
  window_start  INTEGER,
  window_end    INTEGER,
  task_count    INTEGER,
  success_rate  REAL,
  avg_quality   REAL,            -- from task_outcomes.quality_rating (1-5)
  PRIMARY KEY (agent, model, context_type, window_start)
);
```

Nightly cron (uses Sprint 3's cron jobs table) recomputes the rolling
7-day window per triple. Picker reads it as a bonus modifier:

- `avg_quality > 4.0` → +0.15 boost
- `avg_quality < 2.0` → -0.30 penalty
- `task_count < 10` → no modifier (insufficient data)

Gated behind env flag `PICKER_OUTCOME_FEEDBACK`, default off for the
first week to A/B compare pick stability.

**Estimated effort:** ~1 day.

---

### Sprint 10 — Tier 5 bridges (queue only)

**Owner:** backend
**Status:** queued, NOT scheduled — researching feasibility per provider
**Prerequisite:** Sprints 7, 8, 9 ship first.

Subscription-link integration for the four providers that don't expose
direct API access under Meg's current plan tier. Reuses the existing
`subscriptionBridge.ts` pattern (CLI subprocess, stdin prompt, stdout
text) where possible.

| Provider          | Bridge approach                  | Status              |
|-------------------|----------------------------------|---------------------|
| Anthropic Max     | `claude -p` CLI (already wired)  | needs auth verify   |
| OpenAI ChatGPT+   | `codex exec` OAuth bridge        | needs auth verify   |
| Google Gemini     | `gemini --prompt` CLI            | depends on plan tier|
| Grok Max          | API key route (xAI dev access)   | API access TBD      |
| Perplexity Max    | NONE — no Max-tier API           | skip unless changes |

**Action items per provider:**

1. Verify which subscription tier Meg actually has and whether it grants
   programmatic access (CLI or API).
2. For CLI bridges: confirm `subscriptionBridge.ts:bridgeFor()` mapping.
3. Add to `providerPolicy.ts` with `routeMode: 'subscription_link'`.
4. Add models to `model_capabilities.json` with `tier: 5`,
   `cost_score: 1.0` (subscription absorbs cost) but
   `quotaPolicy: "subscription_capped"` so the quota tracker watches
   for rate-limit signals from CLI exit codes.

**Estimated effort:** ~3-5 days, mostly auth/research, not code.

---
