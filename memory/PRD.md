# OpenClaw Mission Control — PRD

## Original Problem Statement
Build a polished, functional UI for "OpenClaw Mission Control" — a dashboard similar to Claude.ai/Perplexity. All toggles, dropdowns, model selectors functional. Zustand store clean, mocked, and ready for future backend integration.

## Architecture
- **Frontend**: React + Tailwind CSS + Zustand + Lucide icons
- **State**: Mocked in `useGateway.js` with localStorage persistence (version 3)
- **Backend**: FastAPI (untouched — on hold until frontend is perfect)

## File Structure
```
frontend/src/
├── App.js              (Router with catch-all 404 redirect)
├── components/
│   ├── ModelSelector.js, PlusMenu.js, InputBar.js
│   ├── shared.js
│   ├── layout/Layout.js
│   └── ui/ (Shadcn)
├── pages/
│   ├── HomePage.js, DashboardPage.js, JobsPage.js
│   ├── ApprovalsPage.js, SpacesPage.js, CoworkPage.js
│   ├── CodePage.js, SettingsPage.js, CustomizePage.js, AgentPage.js
└── lib/
    ├── useGateway.js, constants.js, utils.js
```

## Completed Features
- [x] Model Selector: 6 providers, hover→models, "More...", model-thread linking
- [x] Thread Management: create, switch, delete, model restoration
- [x] Thread Isolation: Messages/streaming scoped per-thread (threadId tagging) — Feb 2026
- [x] Thread Auto-Routing: Keyword analysis routes threads to Dev/Design/Files spaces — Feb 2026
- [x] Message Persistence on Refresh: onRehydrateStorage hydrates messages from active thread — Feb 2026
- [x] clearMessages properly clears from thread object (not just global display) — Feb 2026
- [x] deleteThread/clearAllThreads handle streaming cleanup — Feb 2026
- [x] handleNewThread preserves old thread messages correctly — Feb 2026
- [x] Space Assignment: Chat banner + sidebar colored border/badge + InputBar chip
- [x] SpacesPage: Create + Delete (with confirmation, default spaces protected) — Feb 2026
- [x] PlusMenu: Spaces, Skills, Connectors, Plugins, Research, Web Search, Style
- [x] Cowork page: Tasks, inline conversation, connectors panel, desktop app groups
- [x] CoworkPage inline "Manage connectors" navigates to settings — Feb 2026
- [x] Settings: General, Profile, Connected Apps, Data Controls, Security tabs
- [x] Customize/Directory: Skills, Connectors, Plugins with search/filter/custom add
- [x] Agent workspace with capability toggles
- [x] Code page: Terminal with alias bridge (?cmd= URL dispatch) — Feb 2026
- [x] Mobile/PWA: manifest.json, service worker, apple meta tags — Feb 2026
- [x] 404 catch-all route redirects to home — Feb 2026
- [x] All 10 pages refactored from monolith, rendering cleanly
- [x] Zustand persist v3 migration for stale localStorage

## Frontend Audit Status (Feb 2026)
- All 10 pages systematically reviewed
- 8 bugs found and fixed
- 10/10 Playwright browser tests passed (iteration_18)
- HTML nesting warning fixed (SpacesPage button-in-button)
- Store is clean and ready for backend integration

## Upcoming (P1)
- Voice Input (mic button → Web Speech API)
- Keyboard shortcuts (⌘K, ⌘/)

## Backlog (P2)
- Real WebSocket gateway integration (ON HOLD until frontend perfect)
- Terminal alias bridge — real sandboxed environment
