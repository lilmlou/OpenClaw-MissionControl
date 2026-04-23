# Single-App Runtime Switch Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Turn OpenClaw Mission Control into one app with a runtime switch between OpenClaw and Hermes, while preserving the current polished frontend shell and starting with OpenClaw as the first real integrated runtime.

**Architecture:** Keep the existing React frontend as the protected UI shell. Add a runtime abstraction layer in both frontend store and backend API so the app can route sessions, jobs, approvals, code execution, and cowork actions to either OpenClaw or Hermes. Implement OpenClaw first end-to-end, then add Hermes as a second runtime with its own theme profile and switchable interface identity.

**Tech Stack:** Existing React + Zustand frontend, FastAPI backend, WebSockets for events/streaming, runtime adapter abstraction, later macOS companion, later Expo mobile app.

---

## Non-Negotiables

- Preserve the existing frontend structure, route map, and interaction model.
- Do NOT rewrite the UI from scratch.
- Do NOT split into two user-facing apps.
- Start with OpenClaw as the first real runtime.
- Add Hermes as the second runtime through a switch interface.
- Theme differences must be cosmetic/configurable, not separate app forks.
- Expo comes after the web/mac architecture is stable.

---

## Product Decision

This project should be **one app with two runtimes**:
- `openclaw`
- `hermes`

The switch should control:
- visual identity/theme
- default model/provider list
- runtime adapter used by backend
- wording in headers/placeholders/status labels
- future capability surfacing (Cowork, Code, approvals, jobs)

The switch should NOT duplicate:
- routes
- page components
- settings structure
- approval system
- jobs system
- project/session model

---

## Target UX

### Header / Global Switch
A global segmented control or workspace switcher:
- OpenClaw
- Hermes
- Auto (optional later, not in MVP)

### Visual Identity
OpenClaw mode:
- keep current Mission Control / lobster aesthetic
- current dark tokens remain base profile

Hermes mode:
- alternate token set
- different icon/wording/title treatment
- same page layout and underlying components

### Runtime Scoping
Each conversation/session should store:
- `runtime: "openclaw" | "hermes"`
- `modelId`
- `spaceId`
- `approvalMode`

The active runtime switch sets defaults for new sessions, but existing sessions preserve their own runtime.

---

## MVP Build Order

1. Add runtime/theme abstraction to frontend
2. Add runtime field to session/thread model
3. Add backend runtime adapter interface
4. Implement OpenClaw adapter first
5. Wire chat/home to real OpenClaw runtime path
6. Add Hermes adapter skeleton and UI switch support
7. Add Hermes theme/profile support
8. Expand switch awareness into Code / Cowork / Approvals pages

Do NOT start with Expo.
Do NOT start with macOS native permissions.
Do NOT make Code/Cowork real before chat/runtime abstraction works.

---

## Task 1: Add a runtime domain model to the frontend store

**Objective:** Introduce `activeRuntime`, per-thread runtime persistence, and runtime-aware session creation without breaking the existing UI.

**Files:**
- Modify: `frontend/src/lib/useGateway.js`
- Test: manual verification via existing UI

**Step 1: Add runtime constants**

Add a small runtime enum-style structure near the top of `useGateway.js`:

```js
const RUNTIMES = {
  OPENCLAW: "openclaw",
  HERMES: "hermes",
};
```

Add runtime metadata for labels/themes:

```js
const RUNTIME_META = {
  openclaw: {
    id: "openclaw",
    label: "OpenClaw",
    title: "Mission Control",
    assistantName: "OpenClaw",
    placeholder: "Message OpenClaw...",
  },
  hermes: {
    id: "hermes",
    label: "Hermes",
    title: "Claw",
    assistantName: "Claw",
    placeholder: "Message Claw...",
  },
};
```

**Step 2: Add store state**

Add to Zustand state:

```js
activeRuntime: RUNTIMES.OPENCLAW,
runtimeMeta: RUNTIME_META,
```

**Step 3: Persist runtime on threads**

Update thread creation so each thread stores runtime:

```js
const currentRuntime = get().activeRuntime;
const thread = {
  id,
  title: title || "New thread",
  runtime: currentRuntime,
  messages: [],
  createdAt: now,
  updatedAt: now,
  spaceId: null,
  modelId: currentModel,
};
```

Also update any migration/rehydration logic so old threads default to `openclaw`.

**Step 4: Add setter helpers**

Add:

```js
setActiveRuntime: (activeRuntime) => set({ activeRuntime }),
getRuntimeForActiveThread: () => {
  const { activeThreadId, threads, activeRuntime } = get();
  const thread = activeThreadId ? threads.find(t => t.id === activeThreadId) : null;
  return thread?.runtime || activeRuntime;
},
```

**Step 5: Verify manually**

Run the frontend and verify:
- app still loads
- new thread creation still works
- no persistence crash from old localStorage

Expected: UI unchanged, but runtime data exists in state.

---

## Task 2: Extract theme/design tokens into switchable runtime profiles

**Objective:** Keep the existing look for OpenClaw while enabling a Hermes theme profile without duplicating components.

**Files:**
- Modify: `frontend/src/lib/constants.js`
- Modify: `frontend/src/components/layout/Layout.js`
- Modify: `frontend/src/pages/HomePage.js`
- Test: manual verification

**Step 1: Replace single `C` token object with runtime-aware themes**

Refactor `constants.js` from one exported token object into:

```js
export const THEMES = {
  openclaw: {
    bg: "#0a0a0a",
    surface: "#141414",
    surface2: "#1b1b1b",
    text: "#f5f5f5",
    muted: "#8b8b8b",
    border: "#2a2a2a",
    accent: "#1d8cf8",
    green: "#22c55e",
    yellow: "#fbbf24",
  },
  hermes: {
    bg: "#0b0a12",
    surface: "#151222",
    surface2: "#1d1830",
    text: "#f3f0ff",
    muted: "#9d95b8",
    border: "#31284b",
    accent: "#8b5cf6",
    green: "#34d399",
    yellow: "#f59e0b",
  },
};
```

Keep a compatibility export temporarily:

```js
export const C = THEMES.openclaw;
```

**Step 2: Add a `useThemeTokens` helper**

Create a small helper in `constants.js` or `useGateway.js` usage pattern so components can select the active theme based on runtime.

**Step 3: Update Layout and HomePage first**

Start with only these components using runtime-aware tokens and runtime labels.

Layout should show the active runtime in the header/switch zone.
HomePage should swap branding text:
- OpenClaw + Mission Control
- Claw / Hermes mode label

**Step 4: Verify manually**

Expected:
- OpenClaw mode looks unchanged or nearly unchanged
- Hermes mode uses alternate colors and labels
- no component duplication

---

## Task 3: Add the runtime switch interface to the shell

**Objective:** Add a visible switch in the main layout that changes active runtime defaults and theme without breaking navigation.

**Files:**
- Modify: `frontend/src/components/layout/Layout.js`
- Modify: `frontend/src/lib/useGateway.js`
- Test: manual verification

**Step 1: Add switch UI to header or sidebar top area**

Use a simple segmented control:

```jsx
<div className="flex items-center rounded-lg p-1" style={{ background: theme.surface2, border: `1px solid ${theme.border}` }}>
  {[
    { id: "openclaw", label: "OpenClaw" },
    { id: "hermes", label: "Hermes" },
  ].map(opt => (
    <button
      key={opt.id}
      onClick={() => setActiveRuntime(opt.id)}
      className="px-3 py-1.5 rounded-md text-xs font-medium"
      style={{
        background: activeRuntime === opt.id ? theme.accent : "transparent",
        color: activeRuntime === opt.id ? "#fff" : theme.muted,
      }}
    >
      {opt.label}
    </button>
  ))}
</div>
```

**Step 2: Scope behavior correctly**

Switch changes:
- default runtime for new thread
- theme tokens
- global shell labels

Switch does NOT forcibly rewrite existing thread runtime.

**Step 3: Optional nice touch**

If an existing thread is active, show thread runtime badge somewhere subtle.

**Step 4: Verify manually**

Expected:
- switching changes visual identity
- new threads inherit selected runtime
- old threads remain stable

---

## Task 4: Create a backend runtime adapter interface

**Objective:** Stop hardcoding runtime behavior in endpoints and create one adapter contract for OpenClaw/Hermes.

**Files:**
- Create: `backend/runtime_adapters/base.py`
- Create: `backend/runtime_adapters/openclaw.py`
- Create: `backend/runtime_adapters/hermes.py`
- Create: `backend/runtime_adapters/registry.py`
- Modify: `backend/server.py`
- Test: lightweight backend import/run verification

**Step 1: Create base adapter interface**

```python
from typing import AsyncIterator, Dict, Any

class RuntimeAdapter:
    runtime_name: str

    async def send_message(self, session_id: str, message: str, context: Dict[str, Any]) -> Dict[str, Any]:
        raise NotImplementedError

    async def stream_message(self, session_id: str, message: str, context: Dict[str, Any]) -> AsyncIterator[Dict[str, Any]]:
        raise NotImplementedError
```

**Step 2: Implement OpenClaw adapter first**

Even if initially stubbed, it should be the first real target.

**Step 3: Add Hermes adapter skeleton**

Hermes adapter can initially return placeholder/not-implemented responses if needed, but the interface must exist.

**Step 4: Add registry**

```python
from .openclaw import OpenClawAdapter
from .hermes import HermesAdapter

RUNTIME_REGISTRY = {
    "openclaw": OpenClawAdapter(),
    "hermes": HermesAdapter(),
}

def get_runtime_adapter(runtime: str):
    return RUNTIME_REGISTRY.get(runtime, RUNTIME_REGISTRY["openclaw"])
```

**Step 5: Verify imports**

Run backend import/start check and confirm no syntax/import errors.

---

## Task 5: Add runtime-awareness to conversation/session APIs

**Objective:** Persist runtime choice in backend conversation/session data.

**Files:**
- Modify: `backend/server.py`
- Test: manual API verification

**Step 1: Add runtime field to conversation models**

Update `Conversation` and `ConversationCreate`:

```python
runtime: str = "openclaw"
```

**Step 2: Ensure create/read APIs preserve runtime**

When creating a conversation, runtime must be stored and returned.

**Step 3: Backfill old records safely**

When reading older conversations without runtime, treat them as `openclaw`.

**Step 4: Verify**

Expected:
- new conversations can store runtime
- old conversations still load

---

## Task 6: Make chat/home use the selected runtime

**Objective:** Wire the main chat path so sending a message uses the current thread runtime, not a hardcoded mock response path.

**Files:**
- Modify: `backend/server.py`
- Modify: `frontend/src/lib/useGateway.js`
- Modify: `frontend/src/pages/HomePage.js`
- Test: manual end-to-end verification

**Step 1: Include runtime in send payloads**

Frontend should send runtime alongside conversation/session identifiers.

**Step 2: Route backend message handling through adapter registry**

Instead of fixed placeholder response logic, use:

```python
adapter = get_runtime_adapter(conversation.runtime)
```

**Step 3: Keep OpenClaw as first real path**

If only OpenClaw is fully implemented initially, Hermes can return a clear placeholder like:
- `Hermes runtime adapter not wired yet`

That is acceptable temporarily, as long as the switch/UI works.

**Step 4: Verify**

Expected:
- OpenClaw runtime works from chat
- runtime selection is respected
- no regression to thread handling

---

## Task 7: Add runtime identity to InputBar / ModelSelector / key labels

**Objective:** Make the switch feel real through labels and defaults without forking components.

**Files:**
- Modify: `frontend/src/components/InputBar.js`
- Modify: `frontend/src/components/ModelSelector.js`
- Modify: `frontend/src/pages/HomePage.js`
- Modify: `frontend/src/pages/CodePage.js`
- Modify: `frontend/src/pages/CoworkPage.js`
- Test: manual verification

**Step 1: Runtime-aware placeholders**

Examples:
- OpenClaw: `Message OpenClaw...`
- Hermes: `Message Claw...`

**Step 2: Runtime-aware headings**

Examples:
- OpenClaw mode keeps current Mission Control language
- Hermes mode uses softer/personal wording but same structure

**Step 3: Runtime-aware default model lists (optional MVP-lite)**

Initially just filter/sort the model list differently by runtime rather than maintaining two entirely separate selectors.

---

## Task 8: Expand runtime switch into Code/Cowork/Approvals semantics

**Objective:** Make the rest of the shell aware of runtime identity, while keeping real OpenClaw implementation first.

**Files:**
- Modify: `frontend/src/pages/CodePage.js`
- Modify: `frontend/src/pages/CoworkPage.js`
- Modify: `frontend/src/pages/ApprovalsPage.js`
- Modify: `frontend/src/components/layout/Layout.js`

**Step 1: Add runtime badges**

Each page should know the active runtime or active-thread runtime.

**Step 2: Adjust wording only**

Examples:
- Code page badge: `OpenClaw Sandbox` vs `Hermes Workspace`
- Cowork headline: `Delegate to OpenClaw` vs `Work with Claw`

**Step 3: Keep implementation scope constrained**

Do NOT make Cowork or Code fully real in this task.
Only make them runtime-aware at the shell level.

---

## Task 9: Add Hermes adapter as the second runtime path

**Objective:** After OpenClaw path is stable, add a working Hermes adapter using the same runtime abstraction.

**Files:**
- Modify: `backend/runtime_adapters/hermes.py`
- Modify: `backend/runtime_adapters/registry.py`
- Modify: relevant websocket/event plumbing

**Step 1: Implement Hermes message handling**

Hook Hermes runtime into the same adapter contract.

**Step 2: Reuse approvals/jobs/event systems**

Do not create Hermes-only pages.
Use the same app systems with runtime labels.

**Step 3: Verify switching works**

Expected:
- OpenClaw and Hermes can both be selected
- each new thread stays pinned to the runtime it was created with
- same shell, same routes, different runtime behavior

---

## What Not To Do Yet

Do NOT do these before Tasks 1–9 are stable:
- Expo mobile app
- macOS native permission bridge
- accessibility automation
- screen recording integration
- full cowork live-screen mode
- full real terminal sandbox for both runtimes
- deep provider/model complexity split per runtime

These come after the runtime switch architecture is real.

---

## Verification Checklist

Before moving beyond this plan, verify:
- [ ] Existing frontend shell is preserved
- [ ] One app contains both OpenClaw and Hermes
- [ ] Runtime switch exists and changes theme/labels
- [ ] New threads inherit selected runtime
- [ ] Existing threads preserve runtime
- [ ] Backend conversation model stores runtime
- [ ] OpenClaw path works first end-to-end
- [ ] Hermes path is scaffolded, then implemented second
- [ ] No duplicated page tree
- [ ] No second app fork introduced

---

## Fastest Recommended Starting Order

1. Task 1 — runtime state in store
2. Task 2 — switchable theme tokens
3. Task 3 — visible switch UI
4. Task 4 — backend adapter abstraction
5. Task 5 — runtime field in conversation/session model
6. Task 6 — OpenClaw real chat path
7. Task 7 — runtime-aware labels/components
8. Task 8 — runtime-aware Code/Cowork shell
9. Task 9 — Hermes adapter

This gives the fastest route to:
- one app
- protected frontend
- OpenClaw first
- Hermes second
- no rewrite
