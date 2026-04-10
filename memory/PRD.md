# OpenClaw Mission Control — PRD

## Original Problem Statement
Build a polished, functional UI for "OpenClaw Mission Control" — a dashboard similar to Claude.ai/Perplexity. Make all toggle buttons, drop-down menus, and model selectors functional. Keep the Zustand store clean and entirely mocked until the frontend UI is perfect.

## Core Requirements
1. Model Selector: Provider dropdown → hover for models, capability badges, cost tiers, "More..." expand for large lists
2. Functional pages: Dashboard, Jobs, Approvals, Cowork, Code, Spaces, Agent, Settings, Customize
3. Cowork: Inline conversation windows for delegated tasks
4. Code: Clean terminal interface
5. Thread management: creation, switching, deletion with model persistence
6. Clean component architecture
7. Connectors: Service connectors + Desktop App suites (Adobe, Microsoft, Google, Other) with individual toggles
8. Space assignment: Visual indicators in sidebar (colored icon + badge) and InputBar (chip)

## Architecture
- **Frontend**: React + Tailwind CSS + Zustand (state) + Lucide icons
- **State**: All mocked in `useGateway.js` with localStorage persistence
- **Backend**: FastAPI (untouched — awaiting frontend perfection)

## File Structure (Post-Refactor)
```
frontend/src/
├── App.js                    (~30 lines — Router only)
├── App.css
├── index.js
├── components/
│   ├── ModelSelector.js      (Provider→Model dropdown with "More..." expand)
│   ├── PlusMenu.js           (Context menu: services + desktop apps + spaces)
│   ├── InputBar.js           (Chat input with mode toggle + space chip)
│   ├── shared.js             (BinaryRain, Toggle, Markdown, CapabilityIcons, CostBadge, MessageRow)
│   ├── layout/
│   │   └── Layout.js         (Main layout: sidebar with space-aware threads + header)
│   └── ui/                   (Shadcn components)
├── pages/
│   ├── HomePage.js           (Chat interface)
│   ├── DashboardPage.js      (Stats overview)
│   ├── JobsPage.js           (Job monitoring)
│   ├── ApprovalsPage.js      (Permission requests)
│   ├── SpacesPage.js         (Conversation organization)
│   ├── CoworkPage.js         (Task delegation)
│   ├── CodePage.js           (Terminal interface)
│   ├── SettingsPage.js       (5 tab settings)
│   ├── CustomizePage.js      (Directory: Skills/Connectors/Plugins)
│   └── AgentPage.js          (Agent workspace)
└── lib/
    ├── useGateway.js         (Zustand store — all mocked)
    ├── constants.js           (Shared data/constants + DESKTOP_APP_GROUPS)
    └── utils.js
```

## Completed Features
- [x] Model Selector: 6 providers, hover→models, capability icons, cost badges, "More..." expand
- [x] Model-Thread Linking: model saved per thread, restored on switch, cleared on new thread
- [x] Thread Management: create, switch, delete, sidebar recents with model+space indicator
- [x] Chat: Streaming simulation, markdown rendering, code blocks, stop generating
- [x] PlusMenu: Files, Spaces, Skills, Connectors (services+desktop apps), Plugins, Research, Web Search, Style
- [x] Connectors: 12 service connectors + Desktop App groups (Adobe 8, Microsoft 7, Google 7, Other 5)
- [x] Space Assignment: Colored icon in sidebar + chip in InputBar + checkmark in dropdown
- [x] Auto-color spaces: New spaces get unique colors from 15-color palette
- [x] Dashboard, Jobs, Approvals, Spaces, Cowork, Code, Settings, Customize, Agent pages
- [x] App.js refactored from 1900→30 lines (14 extracted files)

## Upcoming Tasks (Prioritized)
### P1
- Thread Auto-Routing (auto-assign threads to spaces based on content context)
- Voice Input Integration (mic button → transcribe → insert text)
- Mobile/PWA Setup (manifest, service worker)

### P2
- Real WebSocket gateway connection (replace mocks in useGateway.js)
- Terminal alias bridge configuration
- Keyboard shortcuts (Cmd+K, Cmd+/)

## Testing Status
- iteration_11.json: 28/28 passed
- iteration_12.json: 39/39 passed
- iteration_13.json: 31/31 passed (post-refactor)
- iteration_14.json: 20/20 passed (connectors + space assignment)
