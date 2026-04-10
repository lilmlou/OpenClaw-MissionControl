# OpenClaw Mission Control — PRD

## Original Problem Statement
Build a polished, functional UI for "OpenClaw Mission Control" — a dashboard similar to Claude.ai/Perplexity. Make all toggle buttons, drop-down menus, and model selectors functional. Keep the Zustand store clean and entirely mocked until the frontend UI is perfect.

## Architecture
- **Frontend**: React + Tailwind CSS + Zustand (state) + Lucide icons
- **State**: All mocked in `useGateway.js` with localStorage persistence
- **Backend**: FastAPI (untouched — awaiting frontend perfection)

## File Structure
```
frontend/src/
├── App.js                    (~30 lines — Router only)
├── App.css
├── index.js
├── components/
│   ├── ModelSelector.js      (Provider→Model dropdown with "More..." expand)
│   ├── PlusMenu.js           (Context menu: spaces, skills, service connectors, style)
│   ├── InputBar.js           (Chat input + mode toggle + space chip)
│   ├── shared.js             (BinaryRain, Toggle, Markdown, CapabilityIcons, CostBadge, MessageRow)
│   ├── layout/
│   │   └── Layout.js         (Sidebar with space-aware threads + header)
│   └── ui/                   (Shadcn components)
├── pages/
│   ├── HomePage.js           (Chat + space banner)
│   ├── DashboardPage.js
│   ├── JobsPage.js
│   ├── ApprovalsPage.js
│   ├── SpacesPage.js
│   ├── CoworkPage.js         (Task delegation + desktop app connectors panel)
│   ├── CodePage.js
│   ├── SettingsPage.js
│   ├── CustomizePage.js
│   └── AgentPage.js
└── lib/
    ├── useGateway.js         (Zustand store — all mocked)
    ├── constants.js           (CONNECTORS, DESKTOP_APP_GROUPS, etc.)
    └── utils.js
```

## Completed Features
- [x] Model Selector: 6 providers, hover→models, capability icons, "More..." expand, model-thread linking
- [x] Thread Management: create, switch, delete, model restoration, space indicators
- [x] Chat: Streaming, markdown, code blocks, stop generating, space banner
- [x] PlusMenu: Files, Spaces, Skills, Service Connectors, Plugins, Research, Web Search, Style
- [x] Cowork Desktop Apps: Services (12) + Desktop App groups (Adobe 8, Microsoft 7, Google 7, Other 5)
- [x] Space Assignment: Colored sidebar border/badge + chat banner + InputBar chip
- [x] Auto-color spaces from 15-color palette
- [x] All 10 pages fully functional
- [x] App.js refactored: 1900→30 lines (14 extracted files)

## Upcoming Tasks
### P1
- Thread Auto-Routing (auto-assign to spaces by content)
- Voice Input Integration (mic button)
- Mobile/PWA Setup

### P2
- Real WebSocket gateway (replace mocks)
- Terminal alias bridge
- Keyboard shortcuts (Cmd+K, Cmd+/)

## Testing
- iteration_13: 31/31 passed (post-refactor)
- iteration_14: 20/20 passed (connectors + space assignment)
- iteration_15: 19/19 passed (cowork desktop apps + chat space banner + sidebar tinting)
