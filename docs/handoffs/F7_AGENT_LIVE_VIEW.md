# F7 — Agent Live View Handoff

**Audience:** combined backend + frontend agents
**Owner:** Meg
**Repo root:** `/Volumes/🦋• Drive   1/MC-CLAW/OpenClaw-MissionControl/`
**Priority:** P0 — blocks meaningful use of every other phase
**Why this exists:** Right now the UI says "done" when an agent script exits 0. It doesn't show what files changed, what tools were called, or whether acceptance checks passed. Mission Control isn't controlling anything — it's a chat log with green ticks. This phase makes "done" mean done.

---

## 0. TL;DR

For every running and recently-finished agent task, the UI must show:

1. **Heartbeat** — is the agent alive
2. **Live tool stream** — what it is doing right now (file write, shell run, http call)
3. **Diff pane** — what files it has actually changed since dispatch
4. **Acceptance status** — did the handoff §6 checks pass

Without all four, the panel is decorative. Ship all four or nothing.

---

## 1. The lie we are fixing

Current behaviour:
- Agent runs to completion
- Agent emits `task.complete`
- UI flips to "✅ done"
- User trusts it
- Files don't exist on disk
- Trust broken

Fixed behaviour:
- Agent emits `task.complete`
- Backend runs handoff §6 acceptance checks
- Backend computes git diff since dispatch
- UI shows: "claims done • diff: 4 files +47/-3 • acceptance: 3/5 passing"
- User sees the truth

---

## 2. Data model

### 2.1 New tables (Mongo, FastAPI side) — or equivalent in Express/SQLite

`agent_runs` — one row per dispatched task
```
{
  "id": "run_<ulid>",
  "agent_id": "frontend-agent-1",
  "handoff_doc": "SYSTEM_V2_FRONTEND.md",
  "wave": "1c",
  "phase_id": "D1",
  "dispatched_ts": 1714900000000,
  "started_ts": 1714900003000,
  "ended_ts": null,
  "status": "running" | "claims_done" | "verified" | "failed" | "killed",
  "git_base_ref": "abc123",       // commit SHA at dispatch
  "files_touched": ["frontend/src/pages/system/SensorsTab.jsx"],
  "diff_added": 47,
  "diff_removed": 3,
  "acceptance_total": 5,
  "acceptance_passed": 3,
  "kill_switch_url": "/api/v2/agents/runs/<id>/kill"
}
```

`agent_events` — append-only log of everything the agent does
```
{
  "id": "evt_<ulid>",
  "run_id": "run_<ulid>",
  "ts": 1714900003123,
  "kind": "tool_call" | "file_write" | "shell" | "http" | "log" | "error" | "complete",
  "summary": "Write sensors.py",       // one-liner for UI
  "detail": { ... },                    // full payload, lazily loaded
  "duration_ms": 142
}
```

`acceptance_checks` — runnable checks parsed from handoff §6
```
{
  "id": "chk_<ulid>",
  "run_id": "run_<ulid>",
  "label": "curl /api/v2/system/sensors returns at least 1 temp",
  "command": "curl -fsS http://localhost:8000/api/v2/system/sensors | jq '.temps | length > 0'",
  "expected": "true",
  "actual": null,
  "status": "pending" | "pass" | "fail" | "error",
  "ran_ts": null
}
```

### 2.2 Endpoints

```
GET  /api/v2/agents/runs?status=&since=     list runs
GET  /api/v2/agents/runs/:id                detail (run + acceptance + last 50 events)
GET  /api/v2/agents/runs/:id/events?since=  paginated event log
GET  /api/v2/agents/runs/:id/diff           git diff text (or structured)
POST /api/v2/agents/runs/:id/verify         re-run acceptance checks
POST /api/v2/agents/runs/:id/kill           SIGTERM the agent process
WS   /api/ws/agents                         live stream of agent_events for all runs
```

---

## 3. Backend tasks

### 3.1 Instrument the dispatch path
Wherever the system spawns a coding agent today:
1. Record git HEAD SHA → `git_base_ref`.
2. Insert `agent_runs` row with `status: "running"`.
3. Stream agent's tool-call events into `agent_events`. Map provider events:
   - file write → `kind: "file_write"`, summary = path
   - shell exec → `kind: "shell"`, summary = command
   - http fetch → `kind: "http"`, summary = method + host
   - assistant text → `kind: "log"` (truncated to 200 chars)
4. On exit: status → `claims_done` (NOT `verified`).

### 3.2 Diff computation
On status change to `claims_done`:
- `git diff --name-only $git_base_ref HEAD` → `files_touched`
- `git diff --shortstat $git_base_ref HEAD` → `diff_added`, `diff_removed`
- If repo dirty (uncommitted), use `git diff --name-only $git_base_ref` against working tree.

### 3.3 Acceptance check parser
Parse §6 of the handoff doc referenced in `agent_runs.handoff_doc`:
- Each `- [ ]` bullet becomes one `acceptance_checks` row.
- Recognise these patterns and auto-generate `command`:
  - `curl ...` → run literally
  - "endpoint X returns Y" → `curl localhost:PORT/X | jq ...`
  - "build passes" → `npm run build` in repo
  - "typecheck passes" → `npm run typecheck`
  - "tests pass" → `pytest` or `npm test`
- Bullets the parser can't auto-resolve → `status: "pending"`, manual mark required.

### 3.4 Verify endpoint
`POST /api/v2/agents/runs/:id/verify`:
- Run all `acceptance_checks.command` in subprocess (timeout 60s each).
- Update `actual`, `status`, `ran_ts`.
- If all pass → `agent_runs.status: "verified"`.
- If any fail → status stays `claims_done`.

### 3.5 Kill switch
`POST /api/v2/agents/runs/:id/kill`:
- SIGTERM the agent process. After 5s, SIGKILL.
- Insert `agent_events` row `kind: "killed"`.
- `agent_runs.status: "killed"`.

### 3.6 WebSocket broadcast
On every `agent_events` insert, push to `/api/ws/agents`:
```json
{
  "type": "agent.event",
  "run_id": "run_<ulid>",
  "event": { ...row... }
}
```

On status change:
```json
{
  "type": "agent.run.status",
  "run_id": "run_<ulid>",
  "status": "claims_done",
  "diff": { "files": 4, "added": 47, "removed": 3 },
  "acceptance": { "passed": 3, "total": 5 }
}
```

---

## 4. Frontend tasks

### 4.1 Live View page
New route: `/agents/live` (or surfaced as a global right drawer).

Layout:
```
+---------------------------------------------+
| Active runs (3)                             |
|   D1 backend  • running  • 4m elapsed       |
|   D1 frontend • claims_done • 2/5 ✅        |
|   F1 cost ui  • verified ✅                 |
+---------------------------------------------+
| [selected: D1 backend]                      |
|                                             |
| Heartbeat: ●●●●●  (last 5s)                 |
|                                             |
| Live stream:                                |
|   12:04:31  file_write  sensors.py +120     |
|   12:04:33  shell       pytest -k sensors   |
|   12:04:38  log         All tests passed    |
|                                             |
| Diff:  4 files  +47 −3   [view diff]        |
|                                             |
| Acceptance: 3/5                             |
|   ✅ /sensors returns temps                  |
|   ✅ /battery returns cycle_count            |
|   ❌ /bluetooth lists devices  [retry]       |
|   ⏳ build passes                            |
|   ⏳ tests pass                              |
|                                             |
| [Verify all] [Kill agent] [Open diff]       |
+---------------------------------------------+
```

### 4.2 Components
- `AgentRunsList` — left column, live-updates from WS
- `AgentRunDetail` — right column, selected run
- `AgentEventStream` — virtualised event list (handle 1000+ events)
- `AgentDiffPane` — collapsed-by-default file list, expand to see diff
- `AcceptanceList` — checkbox list, retry per check, retry all
- `AgentControls` — Verify / Kill / Open Diff buttons

### 4.3 Global indicator
Add to existing footer status bar:
```
●  3 agents running   1 awaiting verify   →  click → /agents/live
```

### 4.4 Override the lie
Anywhere the current UI shows "done" for an agent task, replace with the new status vocabulary:
- `running`
- `claims done`  (yellow — agent self-reported, not verified)
- `verified`     (green — acceptance passed)
- `failed`       (red — acceptance failed)
- `killed`       (grey)

`done` as a string is **banned** from the agent UI vocabulary going forward.

---

## 5. Acceptance (for this phase itself)

- [ ] Dispatch a known-failing agent → UI shows `claims_done` not `verified`
- [ ] Dispatch a known-good agent → UI shows `verified` with acceptance 5/5
- [ ] Live event stream shows file writes within 1s of happening on disk
- [ ] Kill switch terminates a running agent within 6s
- [ ] Footer indicator updates without refresh when a run completes
- [ ] Diff pane matches `git diff` output exactly
- [ ] Acceptance retry actually re-runs the command, doesn't return cached result
- [ ] Two browser tabs both update from WS
- [ ] No "done" string appears anywhere in the agent UI

---

## 6. Out of scope

- Replaying past runs (events table is append-only; UI just lists, doesn't re-execute)
- Cross-machine agent runs (assume single host for now)
- Cost tracking per run (already covered by Sprint 5 token tracking; link to it from run detail)
- Editing acceptance checks live (parser is one-way, edit the handoff doc and re-dispatch)

---

## 7. Why this is P0

Every other phase ships faster once this exists:
- Wave 1's "claims done but four files missing" — caught automatically
- Wave 2 onwards — Meg sees real progress, not green ticks
- Refusing the lie at the UI layer fixes the trust loop

Without this, every dispatched task needs a human disk-check. That's the actual time sink.

---

End of F7 handoff.
