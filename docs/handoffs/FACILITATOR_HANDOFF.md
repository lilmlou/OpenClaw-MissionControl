# Facilitator Handoff — Mission Control / OpenClaw

**Audience:** facilitator / coordinator agent
**Owner:** Meg
**Date:** 2026-05-08 (updated — Wave 1 dispatched)
**Repo root:** `/Volumes/🦋• Drive   1/MC-CLAW/OpenClaw-MissionControl/`
**Reference builds:** `/Volumes/🦋• Drive   1/MC-CLAW/_Reference/`
**Sister handoffs in this folder:**
- `SYSTEM_V2_BACKEND.md` ✅
- `SYSTEM_V2_FRONTEND.md` ✅
- `BACKEND_BOUNDARY.md` ✅ (new — route ownership map)
- `CUSTOMISE_HANDOFF_OPENCODE.md` (in repo root)

---

## 0. Your job

You are the coordinator. You don't write code yourself. You:

1. Read the **current state** in §2 and the **dependency graph** in §4.
2. Pick the next unblocked piece of work.
3. Dispatch it to a coding sub-agent with the matching handoff doc.
4. Verify acceptance before marking done.
5. Refuse out-of-order work even if the user asks for it (politely, with the reason).

You do **not** redesign the app, rename phases, or add scope without writing a new handoff doc first.

**Spec-writing discipline (new):** use the Tier system in §7. Don't write 30-minute Tier-1 docs for 10-minute wiring jobs.

---

## 1. User context (do not skip)

- **User is Meg.** Not a coder. Wants working UI now.
- **Honest status only:** VERIFIED / CODED NOT TESTED / BLOCKED / STUB.
- **Small chunks.** Each PR runnable on its own.
- **Don't redesign.** Existing tabs, colour tokens, `data-testid`, British "Customise" spelling — all preserved.
- **Don't break working chat.** Phase 5 chat regression is a separate watch item.
- **Cost rule:** Qwen/Ollama or Sonnet 4.6 for routine wiring. Reserve Opus for novel architecture.
- **Two backends exist, stay parallel.** See `BACKEND_BOUNDARY.md` for the route-ownership map. FastAPI/Mongo at `OpenClaw-MissionControl/backend/` owns /system, /skills, /plugins, /connectors, /qudos, /design, /files, /preferences. Express/SQLite at `/Users/meg/backend` owns /agents, /cron, /activities, /usage, /learning, /quota, /models, /threads, /memory. Revisit convergence at end of Phase F.
- **Efficiency directive:** Meg wants things shipped, not polished specs. Use Tier 2 briefs for small work.

---

## 2. Current state (reconciled 2026-05-08, Wave 1 dispatched)

### 2.1 Done

| ID | Name | Status |
|---|---|---|
| Phase 1 | Decision Engine | ✅ |
| Phase 2 | Event Loop + Session Manager | ✅ |
| Phase 3 | Adapters via Venice | ✅ |
| Phase 4 | Tool Use Infrastructure | ✅ partial (wired, low usage) |
| Phase 5 | Frontend Streaming Chat | ✅ — **regression check IN FLIGHT (1a)** |
| Phase 5.5 | Cowork → Qudos rename | ✅ UI shell only |
| Phase 6.A–F | SQLite, isolation, memory, watcher, Ollama default | ✅ |
| Phase A | Provider Registry (640 models) | ✅ |
| Phase B | Security & Tailscale | ✅ |
| Sprint 2 | Agent Control | ✅ |
| Sprint 3 | Cron Management | ✅ |
| Sprint 4 | Activities Feed | ✅ |
| Sprint 5 | Token Tracking (backend) | ✅ |
| Sprint 6 | Self-Learning Loop | ✅ |
| Sprint 7 | Context Classifier + OpenCode providers | ✅ Express side shipped |
| Sprint 8 | Quota Tracking | ✅ |
| /system v1 | Hardware/Services/Apps tabs | ✅ |
| Footer status bar | everywhere | ✅ |

### 2.2 In flight (Wave 1)

| ID | Name | Track | Est |
|---|---|---|---|
| **1a** | Phase 5 chat regression diagnostic | single agent | 15–30 min |
| **1b** | F1 Cost UI frontend wire-up | frontend agent | 1.5–2 hrs |
| **1c** | D1 System v2 backend | FastAPI agent | 3–4 hrs |
| **1c** | D1 System v2 frontend | frontend agent | 3–4 hrs |
| Doc | `J_PLUGIN_SKILL_ENGINE.md` (Tier 1) | doc agent | 30–45 min |

### 2.3 Spec'd, ready to dispatch (after Wave 1)

| ID | Name | Handoff doc |
|---|---|---|
| **E3** | Customise rebuild (Skills/Plugins/Connectors real-time) | `CUSTOMISE_HANDOFF_OPENCODE.md` (blocked on J) |

### 2.4 Queued — needs handoff doc before dispatch

| ID | Name | Tier | Scope (confirmed with Meg) |
|---|---|---|---|
| Sprint 9 | Auto-Pick UI | T2 | frontend for Sprint 7 |
| **F1** | Cost & Usage Tracker UI | T2 | IN FLIGHT as 1b |
| F2 | Security Audit Page | T2 | "see/resolve errors directly" |
| F3 | Doctor Fix Pattern | T2 | "Run Doctor Fix" button in screenshots |
| F4 | Audit Trail Page | T2 | who-did-what visibility |
| F5 | Standup Report | T2 | daily/weekly summary |
| F6 | Inspector Right Drawer | T2 | Hermes-style live-feed side panel |
| **D2** | Dashboard v2 (Hermes Workspace style) | T2 | overview tiles + activity sparkline + recent sessions |
| **D3** | Sessions v2 (TenacitOS style) | T2 | filter chips Main/Cron/Sub-agents/Chats + token bar |
| **E1+E2** | Files browser (RO) + editor (RW), combined doc | T1 | Claude-Desktop-style tree + frontmatter header + conflict detection on save. No execute. |
| **J** | Plugin/Skill engine | T1 | Mongo collections (skills, custom_skills, plugins, custom_plugins, connectors, custom_connectors); seed from frontend DIRECTORY_* constants; CRUD per CUSTOMISE §3.2; WS broadcast customize.*; server IDs `custom-{uuid4().hex[:8]}`; unique id indices. **Unblocks E3.** |
| **O** | Appearance / theme engine | T2 | theme/accent/wallpaper/font/font-scale/layout-density/motion; server-persisted; CSS variables on :root; WS live update; useAppearance() hook. Cross-device when H1 lands. |
| G1–G5 | Real Qudos (capture, accessibility, vision, overlay) | T2 | G3 active-window done; rest stubbed |
| H1–H5 | Mobile (PWA, iPad, iPhone, voice, push) | T2 | biggest unknown; split per device when scoped |
| I | Persona System | T2 | |
| K | Tauri Desktop App | T2 | |
| L | Brand Rename | T2 | convergence review before this |
| M | Personalization LoRA | T2 | |
| N | Distribute to other devices | T2 | |

### 2.5 Watch items

- Phase 5 chat: reported broken earlier. 1a diagnostic running. If it comes back broken, **pause Wave 2 dispatch** until fixed (E3 touches chat surface indirectly via WS).
- Two-backend split: documented in `BACKEND_BOUNDARY.md`. No mirroring. Revisit end of Phase F.

---

## 3. Reference materials available

| Path | What it is | Use for |
|---|---|---|
| `_Reference/stats-master/` | exelban/stats Swift source | D1 System v2 — SMC keys, reader semantics (grep only, do not port) |
| `_Reference/mission-control/` | prior MC build | layout patterns, dashboards |
| `_Reference/openclaw-workspace/` | Hermes Workspace build | popups (theme/wallpaper), Workspace tile layout |
| Screenshots in chat history | TenacitOS Sessions/Costs, Hermes Overview, Claude Customise/Files/Settings | visual reference for D2, D3, E1, E3, O |

When dispatching, always tell the sub-agent which `_Reference/` path is in scope and which is not.

---

## 4. Dependency graph

```
                 ┌──── 1a Phase 5 chat regression check ──── IN FLIGHT
                 │
                 ├──── 1b F1 Cost UI (frontend) ─────────── IN FLIGHT
                 │
 unblocked ──────┼──── 1c D1 System v2 (be+fe parallel) ── IN FLIGHT
                 │
                 ├──── Sprint 9 (auto-pick UI) ─── Sprint 7 done, FE queued
                 │
                 ├──── J (plugin/skill engine) ─── doc in flight
                 │           │
                 │           └──── E3 Customise rebuild
                 │
                 ├──── E1+E2 Files (combined T1 doc)
                 │
                 ├──── D2 Dashboard v2 ──┐
                 │                       ├── needs working backends already shipped
                 ├──── D3 Sessions v2 ───┘
                 │
                 ├──── F2 / F3 / F4 / F5 / F6  (parallel track)
                 │
                 ├──── G1 / G2 / G4 / G5  (Qudos real)
                 │
                 ├──── O Theme engine    (cross-device pending H1)
                 │
                 └──── H1–H5 Mobile      (largest unknown)
```

**Order locks:**
- J before E3
- E1 before E2 (combined doc, sequential build)
- D2/D3 after backends they depend on are verified alive
- If 1a returns BROKEN, pause Wave 2

---

## 5. Dispatch order (waves)

### ✅ Wave 1 — dispatched 2026-05-08, in flight
1a chat regression, 1b F1 Cost UI, 1c D1 System v2 (be+fe parallel), doc: J handoff

### Wave 2 — Customise track (sequential, do not parallelise)
- J Plugin/Skill engine build (after doc done)
- E3 Customise rebuild (dispatch `CUSTOMISE_HANDOFF_OPENCODE.md` once J ships)

### Wave 3 — Files track
- E1+E2 combined handoff written, then E1 build, then E2 build

### Wave 4 — Visual refresh (parallel after E)
- D2 Dashboard v2 (Tier 2 brief)
- D3 Sessions v2 (Tier 2 brief)

### Wave 5 — System visibility (parallel, can run alongside 2–4)
- F2, F3, F4, F5, F6 — batched Tier 2 briefs, ~30 min total

### Wave 6 — late
- G1/G2/G4/G5 (real Qudos), O Theme, H1–H5 (mobile), I, K, L, M, N

---

## 6. Handoff doc index

| Doc | Status |
|---|---|
| `FACILITATOR_HANDOFF.md` (this file) | ✅ |
| `BACKEND_BOUNDARY.md` | ✅ new |
| `SYSTEM_V2_BACKEND.md` | ✅ |
| `SYSTEM_V2_FRONTEND.md` | ✅ |
| `CUSTOMISE_HANDOFF_OPENCODE.md` | ✅ |
| `J_PLUGIN_SKILL_ENGINE.md` | 🔄 in flight (T1) |
| `E1_E2_FILES.md` | ❌ next (T1, combined) |
| `O_THEME_ENGINE.md` | ❌ (T2) |
| `D2_DASHBOARD_V2.md` | ❌ (T2) |
| `D3_SESSIONS_V2.md` | ❌ (T2) |
| `F1_COST_UI_FRONTEND.md` | verbal brief used for 1b; promote to T2 doc if shipped fine |
| `F2_SECURITY_AUDIT.md` | ❌ (T2) |
| `F3_DOCTOR_FIX.md` | ❌ (T2) |
| `F4_AUDIT_TRAIL.md` | ❌ (T2) |
| `F5_STANDUP_REPORT.md` | ❌ (T2) |
| `F6_INSPECTOR_DRAWER.md` | ❌ (T2) |
| `SPRINT_9_AUTOPICK_UI.md` | ❌ (T2) |
| `H_MOBILE.md` | ❌ split per device |
| G1–G5 docs | ❌ |

---

## 7. Tiered handoff system (new)

Not every piece of work needs the full template. Match tier to scope.

### Tier 1 — Full handoff doc (30–45 min to write)
Use when: backend + frontend split, large surface, or locked contract needed across agents.
Candidates: D1 (done), E3 (done), J, E1+E2.
Format: full template in §8.

### Tier 2 — One-page brief (10 min to write)
Use when: small surface, one agent, contract unlikely to drift.
Format:
```
# {ID} — {Name} Brief

**Agent:** {frontend | backend | doc}
**Repo:** {path}
**Estimate:** {time}

## Endpoints / UI
- bullet list

## Acceptance
- [ ] verifiable checks

## Out of scope
- explicit list
```
Candidates: F1, F2–F6, D2, D3, O, Sprint 9.

### Tier 3 — Verbal brief only (in dispatch message)
Use when: single-shot diagnostic or trivial addition.
Candidates: 1a chat regression, G3 (already done).

---

## 8. Tier 1 template (unchanged, for reference)

```
# {ID} — {Name} {Backend|Frontend|Combined} Handoff

**Audience:** {agent type}
**Owner:** Meg
**Repo root:** /Volumes/🦋• Drive   1/MC-CLAW/OpenClaw-MissionControl/{backend|frontend}/
**Reference (read-only):** _Reference/{path}/
**Sister doc:** {if split}

## 0. TL;DR
## 1. Reference / current state
## 2. Strategy / page structure
## 3. Contract  ← lock this (verbatim across sister doc if split)
## 4. Polling / cost rules (backend) OR per-tab spec (frontend)
## 5. Implementation tasks
## 6. Acceptance
## 7. Out of scope
```

§3 is always the locked contract. If an agent needs to change it, both sister docs change in the same commit.

---

## 9. Anti-patterns to refuse

- "Just rebuild the whole thing" — refuse, point at small-chunk rule.
- "Use Redux instead of Zustand" — refuse.
- "Add a new design system" — refuse, point at existing tokens.
- "Skip the handoff doc, just code it" — allow ONLY for Tier 3; otherwise refuse.
- "Mirror endpoints in the other backend" — refuse, point at `BACKEND_BOUNDARY.md`.
- "Add Opus for routine wiring" — refuse, cost rule.
- "Trust me, the chat works fine" — verify via 1a first.
- "Let's write a full Tier 1 for this small wiring job" — refuse, use Tier 2.

---

## 10. Status reporting

After each dispatch result, report to Meg in this shape:

```
## {ID} {Name}

Status: {VERIFIED | CODED NOT TESTED | BLOCKED | STUB}
Files touched: {list}
Acceptance results: {checkbox results}
Next: {what's unblocked now}
Watch: {anything still flaky}
```

No essays. No "I have successfully completed…" phrasing. Plain status.

---

## 11. Check-in cadence (new)

Meg wants this shipped fast. Don't wait passively.

- **2-hour mark** on any in-flight track with no update → ping the agent for status.
- **4-hour mark** on any track → surface to Meg with blocker summary.
- Doc-track work runs between dispatches — never idle time.
- If an agent returns with questions that are already answered in this doc or sister docs, bounce back the specific section, don't re-explain.

---

## 12. Current first action

**Wave 1 is dispatched.** Your active job:

1. Monitor 1a / 1b / 1c / J doc track.
2. At 2h mark, ping any silent track.
3. When J doc lands → write E1+E2 combined doc next.
4. When 1a returns clean → Wave 2 is green (J build, then E3).
5. When 1c lands → frontend has real /system v2 data; D2/D3 unblocked for draft.
6. Report to Meg in §10 format as each track reports.

---

End of facilitator handoff.
