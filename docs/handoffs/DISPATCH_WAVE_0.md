# Dispatch — Wave 0

**To:** Facilitator
**From:** Meg
**Date:** 2026-05-08
**Status:** ACTIVE — start now

---

## Required reading (in this order)

1. `PHASE_0_PRINCIPLES.md` — the contract
2. `BACKEND_PRINCIPLES_UPDATE.md` — backend obligations
3. `BACKEND_BOUNDARY.md` — which backend gets what
4. `FACILITATOR_HANDOFF.md` — your job spec
5. The four Wave 0 handoff docs:
   - `F7_AGENT_LIVE_VIEW.md`
   - `PHASE_0_1_HOT_RELOAD_CONFIG_BUS.md`
   - `PHASE_0_2_SCHEMA_DRIVEN_FORMS.md`
   - `PHASE_0_3_BINDING_LAYER.md`

Do not skip the principles doc. Every dispatch you make from now on includes it as required reading for the sub-agent.

---

## Why we're doing this

Previous waves shipped pages that lied about being "done" and weren't user-configurable from the UI. Wave 0 fixes the platform underneath so every future page:

- Can be controlled from the UI without text editing
- Updates live without restart
- Shows real verification status, not green ticks
- Adds new toggles in 1 line of code on each side

This is 1–2 days that saves 30+ days downstream.

---

## Dispatch sequence

### Step 1 — F7 Agent Live View (dispatch now, single agent)

**Why first:** every subsequent dispatch needs honest verification. Until F7 ships, "claims done" continues to mean "agent exited 0" and you'll keep eating cleanup.

**Agent:** combined backend + frontend (FastAPI/Mongo + React).

**Doc:** `F7_AGENT_LIVE_VIEW.md`

**Acceptance gate before proceeding to Step 2:**
- [ ] §6 acceptance checks all pass
- [ ] §0.5 compliance checked off
- [ ] Dispatch a known-failing test agent → UI shows `claims_done` not `verified`
- [ ] Footer shows `● N running · M awaiting verify` indicator
- [ ] No "done" string anywhere in the new agent UI

If F7 itself ships with hand-coded React for its own settings, bounce it back. F7's own UI must use the binding layer once 0.3 lands; for the F7 build itself, hand-coding is allowed only because 0.3 doesn't exist yet.

---

### Step 2 — Phase 0.1 + 0.2 in parallel (dispatch immediately after F7 verifies)

**Why parallel:** §3 of 0.1 is the contract. Once it's locked (within first 30 min of 0.1 work), 0.2 can start using it.

**0.1 agent:** backend (FastAPI/Mongo). Doc: `PHASE_0_1_HOT_RELOAD_CONFIG_BUS.md`.
**0.2 agent:** frontend (React). Doc: `PHASE_0_2_SCHEMA_DRIVEN_FORMS.md`.

**Synchronisation rule:**
- 0.1 agent locks §3 (Mongo schema + endpoints + WS event shapes) in their first commit
- 0.2 agent treats that §3 as immutable contract
- Any field-level change after lock requires both agents to agree and commit together

**Acceptance gate before proceeding to Step 3:**
- [ ] 0.1: §6 + §0.5 pass
- [ ] 0.2: §6 + §0.5 pass
- [ ] `curl PUT /api/v2/config/feature.flags.use_ollama_default` flips behaviour without restart
- [ ] `<SchemaForm>` renders a working dropdown given a JSON Schema
- [ ] Two browser tabs subscribed to a config key both update within 1s

---

### Step 3 — Phase 0.3 Binding Layer

**Why last in Wave 0:** depends on 0.1 + 0.2.

**Agent:** combined backend + frontend (small backend additions for actions; main work is frontend `<Bind>` family).

**Doc:** `PHASE_0_3_BINDING_LAYER.md`

**Acceptance gate — this is the Wave 0 dogfooding test:**
- [ ] §6 acceptance + §0.5 compliance pass
- [ ] **Dogfooding test**: add a new toggle to the platform in under 5 minutes using only:
  ```python
  # backend
  bus.register_default("feature.flags.test_dogfood", False, schema={
      "type": "boolean",
      "title": "Test dogfood",
      "category": "feature.flags"
  })
  ```
  ```jsx
  // frontend
  <Bind to="feature.flags.test_dogfood" />
  ```
  - Toggle appears on `/settings`
  - Click flips backend value live
  - Activity feed shows the change
  - Two tabs sync within 1s

If the dogfooding test fails, Wave 0 is incomplete regardless of what 0.1/0.2/0.3 individually claim. Do not start Wave 1.

---

## What you tell each sub-agent in the dispatch message

Use this template:

```
You are <agent role> for <ID> <Name>.

Required reading (read all before coding):
- /Volumes/🦋• Drive   1/MC-CLAW/PHASE_0_PRINCIPLES.md
- /Volumes/🦋• Drive   1/MC-CLAW/BACKEND_PRINCIPLES_UPDATE.md   (backend agents only)
- /Volumes/🦋• Drive   1/MC-CLAW/BACKEND_BOUNDARY.md            (if touching backend)
- /Volumes/🦋• Drive   1/MC-CLAW/<the specific handoff doc>
- /Volumes/🦋• Drive   1/MC-CLAW/<sister handoff if split>

Repo: /Volumes/🦋• Drive   1/MC-CLAW/OpenClaw-MissionControl/<backend|frontend>/

Hard rules:
- Comply with all 7 principles in PHASE_0_PRINCIPLES.md
- Fill in the §0.5 checklist in your handoff before declaring complete
- "Done" is reserved — your status is "claims done" until F7 verifies
- §3 of your handoff is a locked contract; do not mutate without coordinating with the sister agent
- Cost rule: Qwen/Ollama or Sonnet 4.6. No Opus for routine wiring.

Acceptance:
- Run §6 acceptance checks yourself before reporting back
- Paste curl outputs / screenshots / build logs proving each check
- If F7 already exists, your run will appear in /agents/live — make sure it shows verified

Report back format (mandatory):
## <ID> <Name>
Status: VERIFIED | CODED NOT TESTED | BLOCKED | STUB
Files touched: <list>
§6 acceptance: <X/N passed, list which failed>
§0.5 compliance: <each principle: ✅/❌/N/A with one-line justification>
F7 verification: <pasted /agents/live status if F7 is up>
Next: <what's unblocked now>
Watch: <any flakiness>
```

---

## What to refuse

- Sub-agent skipping §0.5 — bounce, even if §6 passes
- Sub-agent declaring "done" without F7 verification (after F7 ships)
- Sub-agent hardcoding new settings UI when `<Bind>` would work (after 0.3 ships)
- Sub-agent editing config files instead of going through the bus (after 0.1 ships)
- Sub-agent silent mutations with no WS event
- Sub-agent expanding scope: "while I was in here, I also..." — refuse, file as separate work

Reference §8 of `FACILITATOR_HANDOFF.md` for the full anti-pattern list.

---

## Status reporting to Meg

After each step (F7, 0.1+0.2, 0.3), report back to Meg in this shape:

```
Wave 0 — Step <N>: <name>

Status: <verified | claims_done | failed | blocked>
Time: <duration>
What works:
- ...
What's flaky:
- ...
Next gate: <what's required to advance>
```

No essays. No hype. If something failed, say so.

---

## After Wave 0 verifies

You announce:
- Dogfooding test result
- Summary of which existing pages are now Phase-0-compliant (likely zero — that's fine)
- Recommended Wave 1 first dispatch (probably D1 re-dispatch since it's already partly built)

Then wait for Meg's go before starting Wave 1.

---

## Time expectation

- F7: ~4–6 hours
- 0.1 + 0.2 in parallel: ~6–8 hours each, finishing roughly together
- 0.3: ~3–4 hours
- Dogfooding verification: ~30 min

**Wave 0 total: ~1.5–2 working days.**

If any single step takes more than 2× the estimate, escalate to Meg before continuing.

---

## Confirmation needed before you start

Reply with:
1. ✅ I have read PHASE_0_PRINCIPLES.md
2. ✅ I confirm F7 is the first dispatch
3. ✅ I will include the principles doc in every sub-agent dispatch
4. ✅ I will not advance past the dogfooding test until it passes

Then dispatch F7 and report back when its acceptance gate is met.

---

End of Wave 0 dispatch.
