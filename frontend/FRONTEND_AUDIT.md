# FRONTEND_AUDIT.md

**Phase 5.5 — Goal 1 Audit (READ-ONLY, no edits)**
**Working dir:** `/Users/meg/Documents/MC-CLAW/OpenClaw-MissionControl/frontend`
**Date:** 2026-04-27
**Scope:** `src/pages/**`, `src/components/**`, `src/App.js`, `src/components/layout/Layout.js`, `src/lib/constants.js`. `src/lib/useGateway.js` was *read* (not modified) to trace data flow.
**Backend target:** `http://127.0.0.1:7801` (TypeScript meta-gateway, runs `npx tsx src/gateway.ts`)

---

## A. Routes Inventory

| Path | Page Component | File exists? | Renders real content? | Backend endpoints called | Issues |
|---|---|---|---|---|---|
| `/` | `HomePage` (`src/pages/HomePage.js`) | ✅ | ✅ Real chat | `WS /api/ws/chat` (via `connectGateway` → `sendMessage`) | Streaming visually scoped to `activeThreadId`, but underlying `streamingMessage`/`pendingRunId` in store are global → known P0 thread-isolation bug. |
| `/projects` | `SpacesPage` (`src/pages/SpacesPage.js`) | ✅ | ✅ Real (local store + localStorage) | None | No backend persistence — survives reload via Zustand `persist` only. |
| `/dashboard` | `DashboardPage` (`src/pages/DashboardPage.js`) | ✅ | ⚠️ Half real | None | `Gateway` tile hardcodes `v847`; `Exec Policy` card is a static object literal `{ security: "allowlist", askMode: "on-miss", fallback: "deny" }`; `Active Jobs` reads `MOCK_JOBS`. |
| `/jobs` | `JobsPage` (`src/pages/JobsPage.js`) | ✅ | ❌ Mock-only | None | `jobs` initialized from `MOCK_JOBS` (4 hardcoded entries in `useGateway.js`). `cancelJob` only mutates local store. |
| `/approvals` | `ApprovalsPage` (`src/pages/ApprovalsPage.js`) | ✅ | ✅ Real (v2 + legacy fallback + mock) | `GET /api/v2/approvals/pending`, `GET /api/v2/approvals/history`, `POST /api/v2/approvals/:id/respond`, `GET /api/v2/approvals/sessions/:id/state`, `PUT /api/v2/approvals/sessions/:id/mode`, `WS /api/ws/approvals`, plus legacy `GET /api/approvals`, `PUT /api/approvals/:id/{approve,reject}` | **Two backend gaps:** (1) frontend calls `GET /api/v2/approvals/sessions/:id/state` — not in documented backend route list. (2) frontend uses `PUT` on `/sessions/:id/mode` but brief lists it as `POST`. Verify. |
| `/events` | `EventsPage` (`src/pages/EventsPage.js`) | ✅ | ✅ Real (in-memory) | None directly — events stream in via chat WS as `addEvent` calls | No persistence. Filter pills work. |
| `/agents` | `AgentsPage` (`src/pages/AgentsPage.js`) | ✅ | ❌ Mostly stub | None | `AGENT_CARDS` and `PAIRED_NODES` are module-level constants. Only `ModelSelector` is real. "Revoke" button on paired nodes has no `onClick`. |
| `/sessions` | `SessionsPage` (`src/pages/SessionsPage.js`) | ✅ | ✅ Real-ish (reads `threads`) | None | `RotateCcw` and `Archive` icons rendered with no handlers. `inferChannel` is string heuristics. `estimateContextUsage` defined but unused. |
| `/cowork` | `CoworkPage` (`src/pages/CoworkPage.js`) | ✅ | ❌ Simulated | None | `handleTaskClick` and `handleReply` use `setTimeout` to fake assistant replies. Does **not** call `sendMessage`. Progress steps are 3-step hardcoded mock. Right rail ("Working folder", "Context") is decorative. |
| `/code` | `CodePage` (`src/pages/CodePage.js`) | ✅ | ❌ Simulated | None | `executeCommand` (in `useGateway.js` ~L1083) string-prefix-branches: `ls`/`pwd`/`echo`/`cat` → hardcoded responses; everything else echoed. Page even self-labels "Desktop operations are placeholders in this step". URL `?cmd=...` bridge dispatches to same fake. |
| `/settings` | `SettingsPage` (`src/pages/SettingsPage.js`) | ✅ | ✅ Real (local) | None | `Active sessions` list hardcoded (2 entries). "Revoke" on non-current session no handler. All toggles persist via Zustand. |
| `/customize` | `CustomizePage` (`src/pages/CustomizePage.js`) | ✅ | ✅ Real (local) | None | All add/remove/toggle wired to store. Supports `?tab=desktop|skills|connectors|plugins`. `desktop` tab is explicitly placeholder. |
| `/design` | `AgentPage` (`src/pages/AgentPage.js`) | ✅ | ❌ Stub | None | `handleSend` uses `setTimeout` + canned string *"Design placeholder active with N capability settings enabled. Live image generation wiring will be connected later."* Capability toggles are local `useState`. |
| `/spaces` | redirect → `/projects` | n/a | ✅ | None | OK |
| `/agent` | redirect → `/design` | n/a | ✅ | None | OK |
| `*` | redirect → `/` | n/a | ✅ | None | Catch-all. |

---

## B. Sidebar / Navigation

Source of truth: `src/lib/constants.js` → `NAV` constant. Layout: `src/components/layout/Layout.js`.

`NAV` array contains 9 items. `Layout` renders them grouped into three sections (`interfaceTabs`, `operationsTabs`, `configureTabs`) plus a separate `Settings` link, plus `New thread` button, plus thread Recents list, plus runtime toggle (OpenClaw/Hermes), plus header tab strip (Chat/Cowork/Code).

| Nav Item | Route | Click handler wired? | Page renders? | Notes |
|---|---|---|---|---|
| Chat | `/` | ✅ `<Link to="/">` | ✅ | In `interfaceTabs` group. |
| Design | `/design` | ✅ `<Link to="/design">` | ✅ stub | Renders `AgentPage` (stub). |
| Projects | `/projects` | ✅ | ✅ | Renders `SpacesPage`. |
| Dashboard | `/dashboard` | ✅ | ✅ partial | In `operationsTabs`. |
| Jobs | `/jobs` | ✅ | ✅ mock | Badge shows `activeJobs` (running count from `MOCK_JOBS`). |
| Approvals | `/approvals` | ✅ | ✅ | Real backend. |
| Events | `/events` | ✅ | ✅ | Real (in-memory). |
| Agents | `/agents` | ✅ | ✅ stub | Hardcoded cards. |
| Sessions | `/sessions` | ✅ (synthesized in Layout — not in `NAV`) | ✅ | `Layout.js` injects a synthetic nav item: `if (href === "/sessions") { item = { href, label: "Sessions", icon: Layers } }`. **Not present in `NAV` constant.** |
| Customize | `/customize` | ✅ | ✅ | In `configureTabs` group. |
| Settings | `/settings` | ✅ (separate link) | ✅ | Rendered outside the grouped lists in a footer slot. |
| New thread (button) | n/a | ✅ | n/a | Calls `useGateway.getState().saveThreadMessages()` then `useGateway.setState({ activeThreadId: null, activeModel: null, messages: [] })`, then `navigate("/")`. ⚠️ Bypasses store action — direct `setState`. |
| Runtime toggle: OpenClaw/Hermes | n/a | ✅ | n/a | `setActiveRuntime(opt.id)`. Persisted? — see store partialize: **NOT** in `partialize` list, so `activeRuntime` resets to default on reload. |
| Header tab: Chat / Cowork / Code | `/`, `/cowork`, `/code` | ✅ | ✅/stub/stub | Top-bar tabs above main content. |
| Thread "Recents" buttons | n/a | ✅ | n/a | `handleThreadClick(threadId)` → `setActiveThread` + `navigate("/")`. Delete (X) icon stops propagation and calls `deleteThread`. |
| Personal workspace selector (`Personal` ▾) | n/a | ❌ | n/a | Decorative — no `onClick`. Looks interactive (cursor-pointer + hover) but does nothing. |

**Gaps:**
- `Sessions` is reachable via `/sessions` but **not declared in `NAV`** — added by hand inside `Layout.renderNavLink`. Easy to miss when refactoring.
- `/customize` is in `configureTabs` array but check: `configureTabs = ["/agents", "/customize"]` — yes, present. ✅
- "Personal" workspace switcher in top of sidebar is purely cosmetic.

---

## C. Toggles / Buttons / Switches Throughout

Format: `Page → Component / Location → Element → Issue`

### Critical (no handler, dead in UI)

- `Layout` → header → `<button>` "hamburger" with `display: "none"` inline style, sets `setSidebarOpen` — wired, but only visible via CSS class `hamburger-btn` which probably has responsive override. Functional on mobile breakpoint. ✅ Wired.
- `Layout` → sidebar header → `<div>` "Personal ▾" with `cursor-pointer` and `hover:bg-white/5` — **no `onClick`**. Looks like a workspace switcher. Dead.
- `AgentsPage` → Paired Nodes card → "Revoke" button — **no `onClick`**. Dead.
- `SettingsPage` → Security tab → Active Sessions row → "Revoke" button — **no `onClick`** for non-current sessions. Dead.
- `SessionsPage` → each session row → `RotateCcw` icon — **no `onClick`**. Dead. (Likely "restart session".)
- `SessionsPage` → each session row → `Archive` icon — **no `onClick`**. Dead.
- `SessionsPage` → each session row → "Open" pill — **no `onClick`** (the entire row is clickable, but the pill duplicates intent without its own handler). Cosmetic.
- `CoworkPage` → task chat header → `ChevronDown` at end of row — **no `onClick`**. Decorative.
- `CoworkPage` → right rail → "Working folder" header `ChevronRight` — **no `onClick`**. Decorative.
- `CoworkPage` → right rail → "Context" `ChevronDown` and `+` tile — **no `onClick`** on the `+` tile. Dead.
- `CoworkPage` → right rail → "Progress" `ChevronDown` — **no `onClick`**. Decorative.
- `CodePage` → "Local/Remote" toggle — wired (`setIsLocal`) but `isLocal` value isn't sent anywhere — no actual remote/local routing. Cosmetic toggle.
- `CodePage` → `Mic` icon — **no `onClick`**. Dead.
- `CoworkPage` → bottom bar (no active task) → `Mic` icon — **no `onClick`**. Dead.
- `InputBar` → `Mic` button — **no `onClick`**. Dead.

### Stubbed handlers (`setTimeout` fakery / no-op)

- `CoworkPage` → task tile click → `handleTaskClick` — sets local messages, fires `setTimeout(2000ms)` and pushes canned `"Got it. I'll work on..."` reply. **Does not call `sendMessage` / does not hit backend.**
- `CoworkPage` → reply input → "Queue" button (`handleReply`) — `setTimeout(1500ms)` → canned `"Understood. I'm processing that now..."`.
- `AgentPage` (`/design`) → `handleSend` — `setTimeout(2000ms)` → canned `"Design placeholder active with N capability settings enabled. Live image generation wiring will be connected later."`
- `AgentPage` → 4 capability toggle buttons (`imageGen`, `styleRef`, `variations`, `promptAssist`) — local `useState`. Toggling has zero effect on outgoing payload (which doesn't exist anyway).
- `InputBar` → "Agent / Research" mode toggle button — local `useState` only. `sendMessage` does **not** include this in the WS payload. Silently dropped.
- `JobsPage` → "Cancel" (Square icon) — calls `cancelJob` which only mutates local mock state.
- `CodePage` terminal → command submit — calls `executeCommand` from store, which is hardcoded prefix-matching (`useGateway.js` L1083). No backend call.
- `PlusMenu` → "Add from GitHub" — fills input with prefix `"Pull from GitHub repo: "`. No real GitHub integration.

### References to undefined/uncertain backend endpoints

- `useGateway.fetchSessionPermissionState` → `GET /api/v2/approvals/sessions/:id/state` — **not in documented backend route list**. Silently fails on error.
- `useGateway.setSessionPermissionMode` → `PUT /api/v2/approvals/sessions/:id/mode` — brief documents it as `POST`. Method mismatch possible.
- `useGateway.approveRequest` / `rejectRequest` legacy fallback → `PUT /api/approvals/:id/approve`, `PUT /api/approvals/:id/reject` — unclear if backend serves legacy.
- `useGateway.fetchPendingApprovals` legacy fallback → `GET /api/approvals` — same.

### Hardcoded mock data feeding live tiles

- `DashboardPage` → `cards[0]` Gateway version → hardcoded `"v847"`. Should call `GET /api/health` (which exists).
- `DashboardPage` → `Exec Policy` card → static object literal. Renders as if live state.
- `DashboardPage` → `Active Jobs` / `Sessions` (jobs total) → reads `MOCK_JOBS`.
- `DashboardPage` → `Nodes` card → derived from `connectors.mac || connectors.desktop` toggles (not real pairing).
- `JobsPage` → entire list → `MOCK_JOBS`.
- `AgentsPage` → `AGENT_CARDS`, `PAIRED_NODES` → module constants.
- `SettingsPage` → Security → `sessions` → `useState([{...hardcoded...}])`.
- `useGateway` initial state → `approvals: MOCK_APPROVALS` with `approvalsBackend: "mock"`. If both v2 and legacy fetches fail, mocks leak through.

---

## D. Plugins / Skills / Connectors / MCP Servers

### Skills

- **List source:** `DIRECTORY_SKILLS` in `src/lib/constants.js` (16 hardcoded entries with fake download counts like `"134.7K"`).
- **User extension:** `customSkills` in store (Zustand), populated via `addCustomSkill(name, desc)`.
- **Enabled state:** `enabledSkills: []` array of skill ids in store, toggled via `toggleSkill(id)`.
- **UI surfaces:**
  - `CustomizePage` "Skills" tab → cards for each `DIRECTORY_SKILLS` + custom skills, with toggle button (Plus/Settings icons).
  - `PlusMenu` → "Skills" submenu → renders `SKILLS` constant (not `DIRECTORY_SKILLS`!) — **two parallel skill lists** that don't agree. `SKILLS = ["deep-research", "code-review", "web-scraper", "file-manager", "task-scheduler", "mcp-builder", "slack-gif-creator", "canvas-design"]`.
- **"Add" / "Install":** `Plus` button in `CustomizePage` adds via `addCustomSkill`. `enabledSkills` toggles via `toggleSkill`. Both purely local.
- **Persistence:** `enabledSkills`, `customSkills` are in store `partialize` → persist to localStorage. ✅ Survives reload.
- **Backend wiring:** None. No `/api/v2/skills` or similar.

### Connectors

- **List source:** `CONNECTORS` (12 service entries, used by `PlusMenu` and `CoworkPage`) and `DIRECTORY_CONNECTORS` (used by `CustomizePage`, ~10 entries with marketing copy and categories) and `DESKTOP_APP_GROUPS` (4 groups: Adobe / Microsoft / Google / Other Apps with ~25 child apps total). All in `constants.js`.
- **State:** `connectors: { mac: false, desktop: false, files: false, web: false, ... }` — pre-defined keys plus dynamic ids from `DESKTOP_APP_GROUPS` (e.g. `adobe-photoshop`).
- **User extension:** `customConnectors` in store via `addCustomConnector(name, desc)`.
- **UI surfaces:**
  - `CustomizePage` "Connectors" tab → cards from `DIRECTORY_CONNECTORS`. Toggle: `toggleConnector(id)`.
  - `PlusMenu` → "Connectors" submenu → service-level only (uses `CONNECTORS` array).
  - `CoworkPage` → "Connectors & Desktop Apps" expandable panel → both `CONNECTORS` and `DESKTOP_APP_GROUPS`. Desktop apps render with **"Placeholder" badge** (no toggle — intentionally non-functional UI).
- **"Add" / "Authorize":** No real OAuth/auth flow. Toggle is just boolean flip in store.
- **Persistence:** `connectors`, `customConnectors` → in `partialize`. ✅ Survives reload.
- **Backend wiring:** None.

### Plugins

- **List source:** `DIRECTORY_PLUGINS` in `constants.js` (~12 entries with download counts). Also `plugins` array in store — pre-populated with **18 hardcoded plugin objects** at `useGateway.js` L379-398, with `installed: false` defaults.
- **Two parallel lists** again: store `plugins[]` vs `DIRECTORY_PLUGINS` constant. `CustomizePage` reads `plugins` from store but renders `DIRECTORY_PLUGINS` cards, mapping installed state via `plugins.find(p => p.id === plugin.id)?.installed`. ⚠️ ID alignment between the two arrays needs verification.
- **User extension:** `customPlugins` via `addCustomPlugin`.
- **UI surfaces:**
  - `CustomizePage` "Plugins" tab.
  - `PlusMenu` → "Plugins" submenu.
  - `CoworkPage` → conversation `+` menu → "Plugins" sub-panel.
- **"Add" / "Install":** `togglePlugin(id)` flips local `installed` boolean. No real install.
- **Persistence:** `customPlugins` is in `partialize`; **`plugins` itself is NOT in `partialize`** → toggling `installed` on a directory plugin is **lost on reload**. Bug.
- **Backend wiring:** None.

### MCP Servers

- **State:** `mcpServers: []` in store (`useGateway.js` L401), with `addMcpServer(url, name)` and `removeMcpServer(id)`.
- **UI surfaces:** **None.** No page references `mcpServers`. No add/remove UI exists.
- **Persistence:** `mcpServers` is **not** in `partialize` — would not persist anyway.
- **Backend wiring:** None.
- **Status:** Dead store slice. Either build UI or remove.

### API Keys (related)

- **State:** `apiKeys: []`, with `addApiKey(name, key)` (slices key to `XXXX...XXXX`) and `removeApiKey(id)`.
- **UI surfaces:** **None.** Dead slice.

---

## E. Cowork Page (Pre-Rename → Qudos)

File: `src/pages/CoworkPage.js` (~480 lines).

### State / data shape

- Local state (`useState`):
  - `category` (default `"all"`)
  - `search`
  - `activeTask` (object or null)
  - `replyVal`
  - `taskMessages` (array of `{id, role, content}`)
  - `isWorking` (boolean)
  - `progressSteps` (array of `{id, label, done}`)
  - `recentTasks` (array of task objects, capped at 8)
  - `showConnectors` (panel toggle)
  - `expandedGroup` (which `DESKTOP_APP_GROUPS` is open)
  - `coworkSub` (submenu)
  - `coworkPlusOpen` (conversation `+` menu)
- Refs: `coworkPlusRef`, `messagesEndRef`.
- Zustand slices read: `models`, `providers`, `activeModel`, `connectors`, `toggleConnector`, `plugins`, `togglePlugin`.
- Zustand slices defined but **unused by this page**: `coworkParticipants`, `coworkMessages`, `addCoworkMessage`, `updateParticipantStatus` (all live in store; component does not consume them).

### Visible toggles / buttons / interactive elements

#### Landing view (`activeTask === null`)

- Header: `"Delegate to OpenClaw"` / `"Hand off a task, get a polished deliverable"` — static text.
- `Connectors & Desktop Apps` collapsible panel (`showConnectors` toggle):
  - "Plugins" sub-link → navigates to `/customize?tab=plugins` ✅
  - **Service connectors grid** (12 entries from `CONNECTORS`):
    - `Control your Mac`, `Desktop Commander`, `File Access`, `Web Search`, `Signal`, `Telegram`, `VS Code`, `Figma`, `Slack`, `Chrome Browser`, `Docker`, `Notion`
    - Each has a `<Toggle>` calling `toggleConnector(id)` — flips boolean in store. ✅ persists.
  - **Desktop App Groups** (`DESKTOP_APP_GROUPS`):
    - `Adobe` (Photoshop, Illustrator, InDesign, Premiere Pro, After Effects, XD, Lightroom, Acrobat)
    - `Microsoft` (Word, Excel, PowerPoint, Outlook, Teams, OneNote, VS Code)
    - `Google` (Docs, Sheets, Slides, Drive, Calendar, Chrome, Meet)
    - `Other Apps` (Spotify, Discord, Zoom, Terminal, Finder)
    - Each app row has a **"Placeholder" badge** — **no toggle, no click handler**. Read-only display.
  - Footer: "Add app" → `/customize?tab=connectors` ✅; "Desktop placeholders" → `/customize?tab=desktop` ✅.
- Yellow dashed banner: `"Desktop operations placeholder" / "Future desktop operations for Cowork will appear here after approval-flow wiring."` — Link "Open Customise" → `/customize?tab=desktop`.
- Category pills (6): All / Schedule / Create / Analyze / Organize / Communicate. Wired to `setCategory`. ✅
- Search input. ✅
- **Task grid** from `COWORK_TASKS` (21 hardcoded tasks in `constants.js`): each tile calls `handleTaskClick(task)` → simulated assistant reply (see below).
- Bottom bar: `"Start a task from your phone"` text + `Smartphone` icon (decorative) + `ModelSelector` (real, calls `switchModel`) + `Mic` icon (no handler).

#### Active task view

- Left sidebar (`hidden lg:flex`):
  - "New task" button → `setActiveTask(null)` ✅
  - "Recents" list of `recentTasks` — clicking restarts a fake task ✅
- Header: back button (mobile only), `TaskIcon`, task title, tags, decorative `ChevronDown` (no handler).
- Message area: renders `taskMessages` with `Markdown`. Working indicator with pulse dot.
- Input bar:
  - Hint line: `"<model> uses your limit faster. Try another model for longer conversations."`
  - Reply textarea (`replyVal`).
  - **Conversation `+` button** (`coworkPlusOpen`) → opens custom popover with:
    - First 6 connectors with toggles
    - "Plugins" sub → toggles plugins
    - `DESKTOP_APP_GROUPS` (with `"Placeholder"` and `"Soon"` badges, no real interaction)
    - "Desktop placeholders" link → `/customize?tab=desktop`
  - `ModelSelector` ✅
  - **"Queue" button** (`handleReply`): pushes user message, fires `setTimeout(1500)` → canned assistant reply. **No backend.**
- Right rail (`hidden lg:flex`):
  - **Progress** panel: 3 hardcoded steps (`"Understanding request"`, `"Processing"`, `"Delivering result"`). All flipped to `done: true` after 2s timeout. Decorative `ChevronDown` next to header.
  - **Working folder** panel: `Folder` icon + `"WORKING FOLDER"` header + `ChevronRight` (no handler). Empty body. Pure decoration.
  - **Connectors** panel: lists active connectors live (read-only) + active desktop apps (also read-only, even though desktop apps can't be toggled anywhere).
  - **Context** panel: `ChevronDown` (no handler) + a single `+` tile with no handler. Pure decoration.

### Empty states

- Task grid empty state: not implemented — if `filteredTasks` is empty, the grid just renders nothing (no message). Minor.
- Recents (left sidebar in active task view) only renders if `recentTasks.length > 0`.
- No "no active sessions" empty state — that concept does not exist on this page.

### Mock task lists / participants / projects

- `COWORK_TASKS`: **21 hardcoded entries** in `constants.js`. Each has `{id, icon, title, prompt, category, tags}`. Categories: `schedule`, `create`, `analyze`, `organize` — note `communicate` category exists in `COWORK_CATEGORIES` but **no task uses it**. Filter pill produces empty grid.
- `coworkParticipants` (in store, unused by page): `[{id:"user", name:"Meg", role:"human", status:"active"}, {id:"claw", name:"OpenClaw", role:"agent", status:"idle"}]`.
- `coworkMessages` (in store, unused by page): `[]`.

### Screen capture / AI vision / accessibility references

- **None.** Cowork page has zero references to screen recording, accessibility permissions, or vision models. The Phase 5.5 brief's "Qudos" concept (watch/suggest/act/launch) is **entirely absent** from current Cowork. This is a from-scratch concept build, not a pivot.

### Cross-references

- Internal links to `/customize?tab=desktop`, `/customize?tab=connectors`, `/customize?tab=plugins`. ✅
- No links to `/jobs`, `/events`, `/agents`. Cross-page wiring (Goal 4) does not exist yet.

---

## F. Agents / Jobs / Events Pages

### `/agents` — `AgentsPage.js`

- **Data source:** Two module-level constants:
  - `AGENT_CARDS = [{id:"main", model:"anthropic/claude-sonnet-4-6", status:"online", workspace:"~/.openclaw/workspace", sessionCount:3, heartbeat:"30m", default:true}, {id:"coder", model:"anthropic/claude-opus-4-7", status:"idle", workspace:"~/.openclaw/workspace-coder", sessionCount:1, heartbeat:"0m", default:false}]`
  - `PAIRED_NODES = [{id:"node-macbook", name:"Meg's MacBook", platform:"macOS", lastSeen:"2m ago", capabilities:["canvas", "screen.record"]}]`
- **Live data read from store:** `models`, `providers`, `activeModel`, `enabledSkills`. Rendered via `ModelSelector` ("Agent Mode" card) + a count line (`Enabled skills: N`).
- **Filter / sort:** None.
- **Empty state:** None — list is non-empty by definition.
- **Buttons:**
  - `ModelSelector` → `switchModel` ✅ real
  - "Revoke" on paired node → **no `onClick`** ❌
- **Bootstrap files row:** decorative chips for `AGENTS.md`, `SOUL.md`, `USER.md`, `TOOLS.md`, `MEMORY.md`, `HEARTBEAT.md`. Not interactive.
- **Notes:** Models cited (`anthropic/claude-sonnet-4-6`, `anthropic/claude-opus-4-7`) inconsistent with stack (Venice + Hermes/Nous). Question for owner.

### `/jobs` — `JobsPage.js`

- **Data source:** `jobs` slice in store, initialized to `MOCK_JOBS` (4 entries: typically `agent-run`, `heartbeat`, `cron` types) at `useGateway.js` L273-278.
- **Live updates?** Local-only — `updateJobStatus(id, status, progress)` and `cancelJob(id)` only mutate the store.
- **Filter / sort:** None. Single flat list.
- **Empty state:** Not implemented — if `jobs` were empty, `<div className="space-y-2">` with no children renders nothing.
- **Buttons:**
  - "Cancel" (`Square` icon) on running jobs → `cancelJob(id)` flips local state. No backend cancel.
- **Helpers:** `inferType(job)` (string heuristic on name), `ago(ms)`.
- **Notes:** Dashboard tile `Active Jobs` reads same `MOCK_JOBS`; Layout sidebar nav badge reads same. Removing mock breaks all three until real fetch is wired.

### `/events` — `EventsPage.js`

- **Data source:** `events` slice in store. Populated in real-time by `addEvent` calls from:
  - `connectGateway.onopen` (`gateway.connected`)
  - `connectGateway.onmessage` (`message.complete`, `gateway.error`, `approval.requested`)
  - `sendMessage` (`message.sent`)
  - `switchModel` (`model.switch`)
  - `executeCommand` (`terminal.execute`)
- **Live data:** ✅ Yes, from real WS and store actions.
- **Filter / sort:** Type filter pills (`useMemo` over `events` map → unique types). ✅ Wired. No date/text filter.
- **Empty state:** ✅ Implemented — "No events yet."
- **Buttons:** None besides filter pills.
- **Notes:** Renders newest-first via `.slice().reverse()`. Level inference (`info|warn|error`) is string heuristic on `evt.type` + `evt.text`. Subscribed badge in header is purely visual.

### Cross-page integration (current state)

- **None.** Sessions, Jobs, Events, Agents are independent slices. There's no `sessionId` linking a chat thread to a job. There's no `jobId` on events. There's no `agentId` on jobs. Goal 4 is greenfield.

---

## G. Settings / Customize / Sessions Pages

### `/settings` — `SettingsPage.js`

Tabs: `general`, `profile`, `data`, `security`. URL-driven via `?tab=`.

- **General tab:**
  - Theme buttons (Dark / Light / System) → `setTheme` ✅ persisted (in `partialize`).
  - Language: static `"English"` text. ❌ Not interactive.
  - Web Search toggle → `setWebSearchEnabled` ✅ persisted.
  - Writing Style buttons (Normal / Concise / Formal / Explanatory) → `setWritingStyle` ✅ persisted.
  - Default Model: read-only display. ❌ No editor.
- **Profile tab:**
  - Display Name input → `setUserProfile({name})` ✅ persisted.
  - Email input → `setUserProfile({email})` ✅ persisted.
  - Custom Instructions textarea → `setUserProfile({customInstructions})` ✅ persisted.
- **Data Controls tab:**
  - Save conversation history toggle → `setDataControl("saveHistory", ...)` ⚠️ NOT in `partialize` — resets on reload.
  - Allow usage for improvement toggle → same ⚠️.
  - Memory across conversations toggle → same ⚠️.
  - "Delete all conversations" button → opens confirm → `clearAllThreads()` ✅ wired.
- **Security tab:**
  - Two-factor toggle → `setSecurity("twoFactor", ...)` ⚠️ NOT in `partialize` — resets on reload.
  - Active sessions list: hardcoded `useState([{...}])`. "Revoke" button on non-current session: **no `onClick`** ❌.
- **Persistence summary:** `partialize` includes `userProfile`, `theme`, `defaultModel`, `webSearchEnabled`, `writingStyle`, `toolAccess`, `connectors`, `enabledSkills`, `threads`, `activeThreadId`, `spaces`, `customSkills`, `customConnectors`, `customPlugins`, `activeModel`. **Missing:** `dataControls`, `security`, `plugins`, `mcpServers`, `apiKeys`, `activeRuntime`.

### `/customize` — `CustomizePage.js`

Tabs: `desktop`, `skills`, `connectors`, `plugins`. URL-driven via `?tab=`.

- **Desktop tab:** Pure placeholder. Yellow info card + 4 link tiles (Connectors, Plugins, Skills cross-links + a static "Desktop operations panel" reserved tile).
- **Skills / Connectors / Plugins tabs:** All structurally similar — search + category filter + grid of cards with toggle button (Plus → Settings/Check) + "Add custom" dashed tile.
- **Search:** ✅ Wired, filters by `name` and `desc`.
- **Category filter:** ✅ Wired.
- **Add custom flow:** ✅ Wired, calls `addCustomSkill/Connector/Plugin`. Custom items get `Trash2` icon for removal.
- **Persistence:** `customSkills`, `customConnectors`, `customPlugins`, `connectors`, `enabledSkills` all persist. ⚠️ `plugins` (the directory plugin install state) does NOT persist.

### `/sessions` — `SessionsPage.js`

- **Data source:** `threads` from store. Each thread renders as a row.
- **Live data:** ✅ from real chat WS.
- **Empty state:** Not implemented — if `threads` is empty, the list section renders nothing.
- **Filter / sort:** None.
- **Buttons:**
  - Row click → `setActiveThread(thread.id)` + `navigate("/")` ✅
  - "Open" pill → no own handler (row click does the work).
  - `RotateCcw` icon → ❌ no handler
  - `Archive` icon → ❌ no handler
- **Helpers:**
  - `getStatus(ts)` — active/idle based on 5-min window. ✅
  - `inferChannel(thread)` — string match (telegram/signal/whatsapp/webchat). Heuristic.
  - `estimateContextUsage(messages)` — defined but **never called**. Dead.
- **Display:** Model name (last segment of `modelId`), message count, channel, scope (space name or "global"), status.

---

## H. App.js + Layout.js Routes — Cross-Reference

### `App.js` route declarations

```
/                  → HomePage
/projects          → SpacesPage
/dashboard         → DashboardPage
/jobs              → JobsPage
/approvals         → ApprovalsPage
/events            → EventsPage
/agents            → AgentsPage
/sessions          → SessionsPage
/cowork            → CoworkPage
/code              → CodePage
/settings          → SettingsPage
/customize         → CustomizePage
/design            → AgentPage
/spaces            → Navigate to /projects (redirect)
/agent             → Navigate to /design (redirect)
*                  → Navigate to /
```

### Page files in `src/pages/`

```
AgentPage.js         (mounted at /design)
AgentsPage.js        (mounted at /agents)
ApprovalsPage.js     (mounted at /approvals)
CodePage.js          (mounted at /code)
CoworkPage.js        (mounted at /cowork)
CustomizePage.js     (mounted at /customize)
DashboardPage.js     (mounted at /dashboard)
EventsPage.js        (mounted at /events)
HomePage.js          (mounted at /)
JobsPage.js          (mounted at /jobs)
SessionsPage.js      (mounted at /sessions)
SettingsPage.js      (mounted at /settings)
SpacesPage.js        (mounted at /projects)
```

### Orphans (route declared, page missing)

**None.** Every route resolves to an existing page or a redirect.

### Ghosts (page file exists, no route mounts it)

**None.** Every page file is mounted.

### NAV (`constants.js`) vs `App.js` cross-reference

| `NAV` href | App.js route exists? | Page renders? |
|---|---|---|
| `/` | ✅ | ✅ |
| `/design` | ✅ | ✅ |
| `/projects` | ✅ | ✅ |
| `/dashboard` | ✅ | ✅ |
| `/jobs` | ✅ | ✅ |
| `/approvals` | ✅ | ✅ |
| `/events` | ✅ | ✅ |
| `/agents` | ✅ | ✅ |
| `/settings` | ✅ | ✅ |

`/sessions`, `/cowork`, `/code`, `/customize` are **routed in `App.js` but not in `NAV`**:

- `/sessions` → injected manually inside `Layout.renderNavLink`. Reachable from sidebar.
- `/cowork`, `/code` → reachable only from the **header tab strip** (`Chat / Cowork / Code`) inside `Layout`, not from the sidebar nav.
- `/customize` → reachable only via deep-links (`/customize?tab=...`) and the back-arrow in `CustomizePage`. **No nav entry point from sidebar or header.** Effectively hidden unless something else links to it (PlusMenu's "Manage skills/connectors/plugins" rows do).

### Redirect paths — duplicates / conflicts

- `/spaces` → `/projects` ✅
- `/agent` (singular) → `/design` ✅ (note: `/agents` plural is a separate page).

No conflicts.

### Layout sidebar grouping vs NAV order

`Layout` reorders `NAV` into three buckets:

- `interfaceTabs = ["/", "/design", "/projects"]`
- `operationsTabs = ["/dashboard", "/sessions", "/jobs", "/approvals", "/events"]`
- `configureTabs = ["/agents", "/customize"]`

`/customize` is in `configureTabs` but is **not** in the `NAV` constant — so `Layout.renderNavLink` falls through to `navByHref[href]` lookup, returns `undefined`, and renders **nothing** for `/customize` from the configure group. ⚠️ **This is a latent bug.** Same fallback as `/sessions`, but `/sessions` has an explicit synthesized fallback; `/customize` does not. **Customize is unreachable from the sidebar.** (Confirmed via code reading — needs in-browser confirmation.)

---

## Cross-cutting Findings (priority refresher for reference, not part of A–H)

- **P0:** Thread isolation (`streamingMessage`/`pendingRunId` global). Documented in brief.
- **P0:** Duplicate `initGateway` definitions in `useGateway.js` (L868 and L1076). Later overrides earlier — first version's approvals bootstrap is dead code. (Off-limits to me; flagging for backend dev.)
- **P0:** `MOCK_APPROVALS` leak when both v2 and legacy fetches fail (`approvalsBackend: "mock"` keeps mocks visible). Off-limits.
- **P0 (frontend):** `/customize` is unreachable from the sidebar — `configureTabs` references it but `NAV` does not declare it.
- **P1:** Approvals backend gap — frontend calls `GET /api/v2/approvals/sessions/:id/state` (not in route list) and `PUT /api/v2/approvals/sessions/:id/mode` (brief lists `POST`).
- **P1:** Two parallel skill lists (`SKILLS` vs `DIRECTORY_SKILLS`) and two parallel plugin lists (store `plugins[]` vs `DIRECTORY_PLUGINS`).
- **P1:** `plugins` directory install state not in `partialize` → toggling install in `CustomizePage` is lost on reload.
- **P1:** `dataControls`, `security`, `activeRuntime` not persisted.
- **P1:** Cowork is entirely simulated — no backend touch despite being the "Delegate" surface.
- **P1:** Code page terminal is fake; URL `?cmd=` bridge dispatches to fake executor.
- **P1:** Design page is canned-string stub.
- **P2:** Dead store slices: `mcpServers`, `apiKeys` (no UI), `coworkParticipants`/`coworkMessages` (defined but unused by `CoworkPage`).
- **P2:** Dead helpers: `estimateContextUsage` in `SessionsPage`.
- **P2:** Dead handlers: "Personal" workspace switcher, "Revoke" buttons in `AgentsPage` and `SettingsPage`, `RotateCcw`/`Archive` in `SessionsPage`, `Mic` icons in `InputBar`/`CoworkPage`/`CodePage`, `ChevronDown`/`ChevronRight` decorations in `CoworkPage` right rail, `+` tile in `CoworkPage` Context panel.
- **P2:** `InputBar` "Agent / Research" mode toggle is local-only — not sent to backend.
- **P2:** `CodePage` Local/Remote toggle is cosmetic.
- **P2:** Hardcoded Dashboard `v847` and `Exec Policy` object.
- **P2:** `COWORK_CATEGORIES` includes `communicate` but no task in `COWORK_TASKS` uses that category — pill produces empty grid.

---

## Open Questions for Human (before any edits)

1. **`/customize` sidebar visibility** — confirm in browser whether the page is actually unreachable from the sidebar (my read of `Layout.js` says yes, since `configureTabs` references `/customize` but `NAV` does not declare it, so `navByHref[href]` returns undefined and `renderNavLink` returns `null`). If confirmed, do I add it to `NAV`, or add a synthesized fallback like `/sessions`?

2. **Cowork → Qudos rename scope** — does the rename include the underlying store slices (`coworkParticipants`, `coworkMessages`, `addCoworkMessage`, `updateParticipantStatus`)? They're in `useGateway.js`, which is **off-limits** to me. If yes, I'll flag for backend dev. If no, I'll leave the slices and rename only the page/route/labels.

3. **`COWORK_TASKS` constant** — keep, rename to `QUDOS_TASKS`, or remove? The Phase 5.5 Qudos concept is fundamentally different from the current task-template grid. My read: tasks belong on a "delegate" surface, but Qudos is more of a co-pilot watching active work. The two metaphors are distinct.

4. **Two skill / plugin source-of-truth arrays** — should I unify `SKILLS` ↔ `DIRECTORY_SKILLS` and store `plugins[]` ↔ `DIRECTORY_PLUGINS` during the audit cleanup, or treat as out-of-scope?

5. **Header tab strip** (`Chat / Cowork / Code` in `Layout.js`) — after rename, becomes `Chat / Qudos / Code`?

6. **`MOCK_JOBS` / `MOCK_APPROVALS`** — backend dev's territory (in `useGateway.js`). Flagging only.

7. **`approvalsBackend: "mock"` initial state** — same. Flagging only.

8. **Dead `mcpServers` and `apiKeys` store slices** — leave, build minimal UI in `/customize`, or flag for backend dev to remove? They're in `useGateway.js`.

---

## Status Log

- [2026-04-27 11:42] Goal 1 audit complete. Sections A–H above. No files modified. **Awaiting "go" before Goal 2 (Cowork → Qudos rename).**
