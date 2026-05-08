# Backend Boundary — Mission Control / OpenClaw

**Date:** 2026-05-08
**Owner:** Meg
**Decision:** Stay parallel. Revisit at end of Phase F; plan consolidation before Phase L if still clean.

---

## 0. Why this file exists

Two backends run side by side. Agents keep asking "which one does this go in?" and sometimes mirror endpoints by accident. This file is the single source of truth for where each route lives. No agent writes to a repo not listed against their route.

---

## 1. The two backends

| Name | Stack | Path | Role |
|---|---|---|---|
| **Agent Runtime** | Express + TypeScript + better-sqlite3 | `/Users/meg/backend` | Agent chat, sprints, picker, quota, learning loop, cron, activities |
| **Mission Control v2** | FastAPI + Motor + MongoDB | `/Volumes/🦋• Drive   1/MC-CLAW/OpenClaw-MissionControl/backend/` | System v2, Customise, Qudos, Design, Files, Preferences |

Port: both bind different ports. Frontend reads the map below to decide which host to call.

---

## 2. Route ownership (authoritative)

### Agent Runtime (Express/SQLite) — `/Users/meg/backend`

Owns:
- `/api/v2/agents/*` — tasks, control, pipelines, pick-model, model-stats
- `/api/v2/cron/*` — jobs, runs, schedules
- `/api/v2/activities*` — unified event stream + WS `/api/ws/activities`
- `/api/v2/usage/*` — totals, by-agent, by-model, projections, daily
- `/api/v2/learning/*` — insights, scores, picker-bonus, override
- `/api/v2/quota*` — provider quotas
- `/api/v2/models/*` — catalog, groups, providers, classify (Sprint 7), roles
- `/api/v2/threads` + `/api/v2/memory/global` — chat history + memory
- `/api/v2/frontend/bootstrap` + `/api/v2/capabilities` — frontend_states contract
- `/api/health`
- `/api/ws/chat`, `/api/ws/approvals`, `/api/ws/agents`

### Mission Control v2 (FastAPI/Mongo) — `MC-CLAW/OpenClaw-MissionControl/backend/`

Owns:
- `/api/v2/system/*` — stats, services, apps, sensors, battery, bluetooth, processes (Phase D1)
- `/api/skills`, `/api/plugins`, `/api/connectors` — Customise engine (Phase J, E3)
- `/api/v2/qudos/*` — sessions, suggestions, apps, permissions, capture, action (Phase G)
- `/api/v2/design/*` — generate, generations, variations
- `/api/v2/files/*` — tree, read, write (Phase E1, E2)
- `/api/v2/preferences/*` — theme, wallpaper, font, layout (Phase O)

---

## 3. Hard rules

1. **No mirroring.** If a route is listed above, only that repo implements it. The other backend returns 404 for those paths.
2. **No cross-writes.** Agent working in one repo does not touch files in the other.
3. **Contract drift is forbidden.** If a frontend needs the same shape from both, that's a convergence bug — flag it, don't paper over it with a duplicate endpoint.
4. **Frontend owns routing.** `frontend/src/lib/useGateway.js` (or equivalent) picks host per route family. Do not hardcode hosts in pages.
5. **Shared auth.** Mission token + CORS allowlist + WS upgrade auth are identical across both. If one changes, both change in the same week.

---

## 4. Convergence review

Schedule: end of Phase F.

Trigger early merge planning if any of:
- Same shape needed from both backends
- Auth divergence (different token schemes)
- Frontend routing complexity exceeds 1 file
- Latency across backends causes UX issues

Otherwise: leave them. Plan Phase K' (infra consolidation) before Phase L (Brand Rename) if merge is required.

---

## 5. New agent onboarding

Before your first commit, confirm:
1. Your repo path matches the route you're implementing (§2).
2. You have not pulled config from the other repo.
3. Your PR description names the repo explicitly.

If unsure, ask the facilitator. Do not guess.
