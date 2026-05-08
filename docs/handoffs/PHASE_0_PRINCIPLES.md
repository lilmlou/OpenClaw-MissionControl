# Phase 0 — Platform Operating Principles

**Audience:** every agent (backend, frontend, facilitator, doc-writer, reviewer)
**Owner:** Meg
**Date:** 2026-05-08
**Status:** binding contract — not a sprint

---

## 0. Why this exists

Meg is not a coder. The platform must be usable end-to-end without touching code. Every other handoff doc is a *place* (Files, Customise, Sensors). This doc is the *contract every place must obey.*

If a feature passes its own §6 acceptance but fails this contract, **it is not done.**

---

## 1. The Seven Principles

Every shipped feature must satisfy all seven. Bounce back work that doesn't.

### 1.1 Visual-first
Every state must have a graphic representation. No raw text logs as the primary surface.

- Counts shown as numbers + bar/donut/sparkline
- Status shown as coloured pill, not just text
- Lists with > 5 items get filter chips
- Errors get an icon, a colour, and a short label — not a stack trace as the user-facing message
- Stack traces live in an expandable "Details" drawer

### 1.2 Live config
Settings change behaviour immediately. No restart. No redeploy.

- Toggle a switch → backend behaviour changes within 1s
- Edit a value → next request uses it
- If a setting cannot hot-reload, it is not a setting — it is a deploy variable, and it lives in `BACKEND_BOUNDARY.md` not in the UI

### 1.3 No-text-editing
If a config file exists, the UI has a structured form for it. Meg never opens `.json`, `.yaml`, `.env`, `.toml` to change platform behaviour.

- Every config object → JSON Schema → auto-rendered form (Phase 0.2)
- Read-only files (logs, lockfiles) may be displayed as text but with syntax highlighting and search
- Free-form prompt/markdown editing is allowed, but always inside a UI editor with preview

### 1.4 Self-healing
Every error message in the UI ships with one or more action buttons that actually fix it.

- "Doctor Fix" pattern (Phase F3): banner with a button that runs the repair
- "Quota exceeded" → "Switch provider" button
- "Service offline" → "Restart service" button
- Generic "view logs" is never the only action

### 1.5 In-UI extensibility
Adding a new item, field, skill, plugin, connector, agent, schedule, etc. is a button.

- Every list has an "Add custom" affordance
- Every detail view has "Edit" → form
- Every form supports adding optional fields (key/value pairs at minimum)
- Custom items persist server-side (no localStorage-only)

### 1.6 Real-time
State changes propagate to all open UI surfaces within 1s without refresh.

- WebSocket fan-out is mandatory for any mutation
- Multi-tab consistency: change in tab A → tab B updates without reload
- Polling is allowed only as a fallback when WS is down

### 1.7 Visible
Every action the platform takes shows up in the activity feed.

- Agent runs, cron fires, model swaps, config edits, file writes, errors — all logged
- Activity feed is global (footer ticker) and detailed (Activities page, F6 Inspector Drawer)
- "Done" / "claims done" / "verified" distinction enforced (see F7)

---

## 2. The §0.5 Compliance Checklist

Every handoff doc must include this section between §0 (TL;DR) and §1 (Reference). Every reviewer must check it before marking work complete.

```
## 0.5 Phase 0 Compliance

- [ ] Visual-first: every state has a graphic, not just text
- [ ] Live config: settings hot-reload, no restart needed
- [ ] No-text-editing: config files have UI forms (or N/A — explain)
- [ ] Self-healing: errors include a Fix button (or N/A — explain)
- [ ] In-UI extensibility: new fields/items added via UI (or N/A — explain)
- [ ] Real-time: state changes propagate within 1s via WS
- [ ] Visible: every state-changing action emits an activity event
```

N/A is allowed but must be justified in one sentence. "N/A because read-only display" is fine. "N/A because we ran out of time" is not.

---

## 3. The "It Counts as Done" Rule

A piece of work is done when **all three** are true:

1. §6 acceptance checks of its own handoff pass
2. §0.5 Phase 0 compliance is signed off
3. F7 Agent Live View shows `verified` status

If any are missing, the status is `claims_done`, not `done`. The word `done` is reserved.

---

## 4. Anti-patterns (auto-bounce on sight)

Reviewers must reject work containing any of these:

| Anti-pattern | Why it's banned |
|---|---|
| "Edit `config.yaml` to change X" | Violates 1.3 No-text-editing |
| "Restart the backend to apply" | Violates 1.2 Live config |
| Raw JSON dumps as primary UI | Violates 1.1 Visual-first |
| "View logs to diagnose" with no other action | Violates 1.4 Self-healing |
| Hardcoded directory lists in frontend constants | Violates 1.5 In-UI extensibility |
| `localStorage`-only persistence for cross-device data | Violates 1.5 + 1.6 |
| `window.location.reload()` after mutation | Violates 1.6 Real-time |
| Silent backend mutations with no event | Violates 1.7 Visible |
| "Done" status before F7 acceptance run | Violates §3 It Counts as Done |
| "Trust me bro" PR descriptions | Always banned |

---

## 5. Backwards-compat retrofit

Existing pages may not satisfy all seven principles. They are **grandfathered**, but every time an agent touches a page for any reason, it must bring that page closer to compliance. Tracking:

| Page | 1.1 V | 1.2 L | 1.3 N | 1.4 S | 1.5 E | 1.6 R | 1.7 V |
|---|---|---|---|---|---|---|---|
| /system v1 | ✅ | n/a | n/a | ❌ | ❌ | ⚠️ poll | ❌ |
| /customize | ✅ | ❌ | ❌ | ❌ | ⚠️ local | ❌ | ❌ |
| /agents | ✅ | ⚠️ | ❌ | ❌ | ❌ | ✅ | ✅ |
| /cron | ✅ | ✅ | ❌ | ❌ | ✅ | ✅ | ✅ |
| /costs | ✅ | n/a | n/a | ❌ | n/a | ✅ | ✅ |
| /design | ⚠️ | ⚠️ | n/a | ⚠️ | n/a | ⚠️ | ✅ |
| /qudos | ❌ shell | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| /sessions | ✅ | n/a | n/a | n/a | n/a | ⚠️ | ✅ |
| /dashboard | ✅ | n/a | n/a | ❌ | n/a | ⚠️ | ✅ |
| /files | does not exist yet (Phase E1) |
| /settings | basic, partial |

Every red ❌ is a follow-up ticket. Track them in `PHASE_0_RETROFIT.md` (created when work starts).

---

## 6. Enabling phases

These phases exist to **make compliance possible.** They are P0 and ship before any new feature work:

1. **F7 Agent Live View** — enforces 1.6 + 1.7 for agent runs (spec'd, ready)
2. **Phase 0.1 Hot-Reload Config Bus** — enables 1.2 (spec: `PHASE_0_1_HOT_RELOAD_CONFIG_BUS.md`)
3. **Phase 0.2 Schema-Driven Forms** — enables 1.3 + 1.5 (spec: `PHASE_0_2_SCHEMA_DRIVEN_FORMS.md`)
4. **Phase 0.3 Binding Layer** — wires 0.1 to 0.2 (spec: `PHASE_0_3_BINDING_LAYER.md`)
5. **F3 Doctor Fix Pattern** — enables 1.4 (spec: TBD)

After these five ship, every existing and future page can comply by using them.

---

## 7. How to use this doc

- **Doc writers:** copy §2 into every new handoff between §0 and §1.
- **Coding agents:** read this before starting; if your work violates a principle, raise it before coding.
- **Facilitator:** auto-bounce on §4 anti-patterns.
- **Reviewers:** check §2 + §3 before marking verified.
- **Meg:** if a feature feels like it's making you do "developer work," it's failing this doc — flag it.

---

End of Phase 0 Principles.
