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
│   ├── PlusMenu.js           (Context menu with submenus)
│   ├── InputBar.js           (Chat input with mode toggle)
│   ├── shared.js             (BinaryRain, Toggle, Markdown, CapabilityIcons, CostBadge, MessageRow)
│   ├── layout/
│   │   └── Layout.js         (Main layout: sidebar + header + content)
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
    ├── constants.js           (Shared data/constants)
    └── utils.js
```

## Completed Features
- [x] Model Selector: 6 providers, hover→models, capability icons, cost badges, "More..." expand (8 initial, expand for rest)
- [x] Model-Thread Linking: model saved per thread, restored on switch, cleared on new thread
- [x] Thread Management: create, switch, delete, sidebar recents with model indicator
- [x] Chat: Streaming simulation, markdown rendering, code blocks, stop generating
- [x] PlusMenu: Files, Spaces, Skills, Connectors, Plugins, Research, Web Search, Style submenus
- [x] Dashboard: Stats cards, active model, recent events
- [x] Jobs: Live monitoring with progress bars, cancel, history
- [x] Approvals: Approve/reject with risk levels, empty state
- [x] Spaces: Create, view, organize threads by space
- [x] Cowork: Task delegation with inline conversation, progress sidebar
- [x] Code: Terminal with command input, bypass permissions, local/remote toggle
- [x] Settings: 5 tabs (General, Profile, Connected Apps, Data, Security)
- [x] Customize/Directory: Skills, Connectors, Plugins with search, filter, custom additions
- [x] Agent: Capability toggles (Image, Design, Code, Web), workspace
- [x] Responsive mobile layout with sidebar toggle
- [x] App.js refactored from 1900 lines → 30 lines (14 extracted files)

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
- iteration_13.json: 31/31 passed (post-refactor verification)
