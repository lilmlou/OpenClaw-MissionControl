# OpenClaw Mission Control — PRD

## Original Problem Statement
Build a clean, minimal dashboard UI (similar to Claude.ai/Perplexity) for OpenClaw Mission Control. Make all toggles, dropdowns, model selectors functional. Build functional pages: Dashboard, Jobs, Approvals, Cowork, Code, Spaces, Agent, Settings, Customize. Polish frontend until bulletproof before any backend integration.

## Architecture
- **Frontend:** React + Tailwind + Zustand (localStorage persistence), Lucide icons
- **Backend:** FastAPI (untouched — mocked frontend-only)
- **State:** `useGateway.js` Zustand store with mocked WebSocket, chat, terminal, jobs
- **Monolith:** `App.js` (~1900 lines) — contains all pages/components (refactor planned)

## Completed Features

### Core UI (Done)
- Dark-mode responsive layout with sidebar navigation
- Model Selector: provider dropdown → hover models panel, capability/context/cost badges, smart viewport positioning
- Plus Menu: Spaces submenu, Skills toggles, Connectors, Style, Research, Web Search
- Input bar with model selector, +menu, agent sparkles link

### Pages (All Done)
- **Chat/Home:** Thread-based conversation, streaming messages, markdown rendering
- **Agent:** Capability toggles (Image, Design, Code, Web), workspace prompt
- **Dashboard:** Stats (active jobs, approvals, connectors, gateway status), recent activity
- **Jobs:** Live real-time task monitoring with progress bars, cancel
- **Approvals:** Pending approvals with approve/reject
- **Spaces:** Files, Design, Development workspaces
- **Settings:** General, Profile, Connected Apps, Data Controls, Security tabs (URL param deep-linking)
- **Cowork:** Inline Claude-style conversation windows
- **Code:** Terminal interface
- **Customize:** Full Claude-style Directory with Skills/Connectors/Plugins catalog (NEW)

### Customize/Directory Page (Feb 2026)
- 3-tab Directory (Skills, Connectors, Plugins) matching Claude.ai layout
- Skills: 15 items with /skill-name, OpenClaw provider, download counts, descriptions, install/uninstall
- Connectors: 18 items with icons, descriptions, "Interactive" badges, connect/disconnect
- Plugins: 10 suite-level items with provider info, download counts, install/uninstall
- Search across all tabs, Filter by category dropdown
- URL param deep-linking (?tab=skills/connectors/plugins)
- PlusMenu links updated to navigate to correct directory tabs

### Thread Model Tracking (Feb 2026)
- Conversations track which model was selected (modelId per thread)
- Thread sidebar shows model name indicator below title
- Switching threads restores the associated model

## Testing Status
- Iteration 11: 28/28 tests PASS (Customize Directory, PlusMenu nav, Settings URL params, Model Selector, Threads, Chat, Jobs, Approvals, Dashboard, Navigation)

## Backlog (Prioritized)

### P1 — When user approves backend work
- Replace mock state with real API responses
- WebSocket gateway connection in useGateway.js
- Terminal alias bridge for sandboxed environment

### P2 — Enhancements
- Refactor App.js monolith (~1900 lines) into src/pages/ and src/components/
- Keyboard shortcuts (Cmd+K, Cmd+/)
- Voice input integration (mic button)
- Auto-route threads to specific spaces
- Mobile/PWA setup
