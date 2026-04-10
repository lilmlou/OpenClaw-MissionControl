# OpenClaw Mission Control — PRD

## Original Problem Statement
Build a polished, functional UI for "OpenClaw Mission Control" — a dashboard similar to Claude.ai/Perplexity. All toggles, dropdowns, model selectors functional. Zustand store clean and mocked.

## Architecture
- **Frontend**: React + Tailwind CSS + Zustand + Lucide icons
- **State**: Mocked in `useGateway.js` with localStorage persistence (version 2)
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
- [x] Space Assignment: Chat banner + sidebar colored border/badge + InputBar chip
- [x] Auto-color spaces (15-color palette)
- [x] PlusMenu: Spaces, Skills, Service Connectors, Plugins, Research, Web Search, Style
- [x] Cowork Desktop Apps: Services + Desktop Apps (Adobe/Microsoft/Google/Other) on task list AND conversation view
- [x] Cowork Conversation: + button opens connectors dropdown, right sidebar shows active connectors
- [x] All 10 pages, refactored from 1900→30 lines
- [x] Persist version migration (v2) for stale localStorage

## Upcoming (P1)
- Thread Auto-Routing, Voice Input, Mobile/PWA

## Backlog (P2)
- Real WebSocket gateway, Terminal alias bridge, Keyboard shortcuts
