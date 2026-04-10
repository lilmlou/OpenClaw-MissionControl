# OpenClaw Mission Control — PRD

## Original Problem Statement
Build a clean, minimal dashboard UI (similar to Claude.ai/Perplexity) for OpenClaw Mission Control. Make all toggles, dropdowns, model selectors functional. Build functional pages: Dashboard, Jobs, Approvals, Cowork, Code, Spaces, Agent, Settings, Customize. Polish frontend until bulletproof before any backend integration.

## Architecture
- **Frontend:** React + Tailwind + Zustand (localStorage persistence), Lucide icons
- **Backend:** FastAPI (untouched — mocked frontend-only)
- **State:** `useGateway.js` Zustand store with mocked WebSocket, chat, terminal, jobs
- **File Structure (Refactored):**
  - `src/lib/constants.js` — All design tokens, navigation, data constants (C, NAV, CONNECTORS, SKILLS, COWORK_TASKS, DIRECTORY_*)
  - `src/lib/useGateway.js` — Zustand store (mocked state, actions, localStorage persistence)
  - `src/components/shared.js` — Reusable components (Toggle, Markdown, MessageRow, BinaryRain, CapabilityIcons, CostBadge)
  - `src/components/ui/` — Shadcn UI components
  - `src/App.js` — Page components + Layout + routing (~1900 lines, down from ~2175)

## Completed Features

### Core UI
- Dark-mode responsive layout with sidebar navigation
- Model Selector: provider -> hover models panel, capability/context/cost badges, smart viewport positioning
- Plus Menu: Spaces, Skills toggles, Connectors, Style, Research, Web Search
- Input bar with model selector, +menu, agent sparkles link
- Thread management: create/switch/delete with model tracking per conversation
- Thread sidebar shows model name below thread title
- Messages: copy button on hover, stop generating button during streaming

### Pages (All Done)
- **Chat/Home:** Thread-based conversation, streaming messages, markdown, copy, stop generating
- **Agent:** Capability toggles (Image, Design, Code, Web), workspace prompt
- **Dashboard:** Stats (active jobs, approvals, connectors, gateway status), recent activity
- **Jobs:** Live monitoring with smooth progress bars, cancel
- **Approvals:** Pending count badge, approve/reject, "All caught up" empty state
- **Spaces:** Files, Design, Development workspaces
- **Settings:** General, Profile, Connected Apps (Desktop Integration toggle + Browse Directory link), Data Controls, Security (URL deep-linking)
- **Cowork:** Inline Claude-style conversation windows with 21 task templates
- **Code:** Terminal interface
- **Customize:** Full Claude-style Directory (Skills/Connectors/Plugins) with search, filter, add custom items

### Frontend Audit Fixes (Feb 2026)
- Copy button on hover for all messages
- Stop generating button during AI streaming
- Thread save-on-switch (prevents message loss)
- New thread saves current thread before clearing
- Approvals: pending count badge + "All caught up" state
- Dashboard: connectors count accurate (not hardcoded /6)
- Jobs: progress bars smooth (no oscillation)
- Desktop Integration toggle (batch enables mac+desktop+files)
- Settings Connected Apps: "Browse all connectors in Directory" link
- Settings: URL param deep-linking (?tab=apps)

### Refactoring (Feb 2026)
- Extracted constants to `src/lib/constants.js` (156 lines)
- Extracted shared components to `src/components/shared.js` (126 lines)
- Created `src/pages/` and `src/components/` directory structure
- App.js reduced from 2175 to 1908 lines

## Testing Status
- Iteration 11: 28/28 PASS (Directory page, navigation, model selector)
- Iteration 12: 39/39 PASS (Full audit: copy, stop, threads, desktop, approvals, jobs, custom items, settings)

## Backlog (Prioritized)

### P1 — When user approves backend work
- Replace mock state with real API responses
- WebSocket gateway connection in useGateway.js
- Terminal alias bridge for sandboxed environment

### P2 — Further refactoring
- Extract remaining pages from App.js into `src/pages/*.js`
- Extract ModelSelector, PlusMenu, InputBar, Layout into `src/components/`

### P2 — Enhancements
- Keyboard shortcuts (Cmd+K, Cmd+/)
- Voice input integration (mic button)
- Auto-route threads to specific spaces
- Mobile/PWA setup
