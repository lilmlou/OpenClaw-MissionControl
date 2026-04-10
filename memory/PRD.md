# OpenClaw Mission Control — PRD

## Original Problem Statement
Build a polished, functional UI for "OpenClaw Mission Control" — a dashboard similar to Claude.ai/Perplexity. All toggles, dropdowns, model selectors functional. Zustand store clean and mocked.

## Architecture
- **Frontend**: React + Tailwind CSS + Zustand + Lucide icons
- **State**: Mocked in `useGateway.js` with localStorage persistence (version 3)
- **Backend**: FastAPI (untouched)

## File Structure
```
frontend/src/
├── App.js              (Router only ~30 lines)
├── components/
│   ├── ModelSelector.js, PlusMenu.js, InputBar.js
│   ├── shared.js, layout/Layout.js
│   └── ui/ (Shadcn)
├── pages/
│   ├── HomePage.js, DashboardPage.js, JobsPage.js
│   ├── ApprovalsPage.js, SpacesPage.js, CoworkPage.js
│   ├── CodePage.js, SettingsPage.js, CustomizePage.js, AgentPage.js
└── lib/
    ├── useGateway.js, constants.js, utils.js
```

## Completed
- [x] Model Selector: 6 providers, hover→models, "More...", model-thread linking
- [x] Thread Management: create, switch, delete, model restoration
- [x] **Thread Isolation**: Messages and streaming scoped per-thread (streamingMessage tagged with threadId, _addMessageToThread writes to specific thread, UI filters by activeThreadId) — Feb 2026
- [x] **Thread Auto-Routing**: Keyword analysis routes new threads to Dev/Design/Files spaces automatically — Feb 2026
- [x] Space Assignment: Chat banner + sidebar colored border/badge + InputBar chip
- [x] Auto-color spaces (15-color palette)
- [x] PlusMenu: Spaces, Skills, Service Connectors, Plugins, Research, Web Search, Style
- [x] Cowork Desktop Apps: Services + Desktop Apps on task list AND conversation view
- [x] Cowork Conversation: + button opens connectors dropdown, right sidebar shows active connectors
- [x] All 10 pages, refactored from 1900→30 lines
- [x] Persist version migration (v3) for stale localStorage
- [x] **Mobile/PWA Setup**: manifest.json, service worker, apple-mobile-web-app meta tags — Feb 2026
- [x] **Terminal Alias Bridge**: Code page supports ?cmd= URL dispatch, alias setup panel with copy-able shell snippets — Feb 2026
- [x] setActiveThread model bug fix: properly clears/restores activeModel — Feb 2026

## Upcoming (P1)
- Voice Input (mic button integration)
- Keyboard shortcuts (⌘K, ⌘/)

## Backlog (P2)
- Real WebSocket gateway integration (ON HOLD until frontend is perfect)
- Terminal alias bridge — real sandboxed environment connection
