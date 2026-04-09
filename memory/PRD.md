# OpenClaw Mission Control - PRD

## Original Problem Statement
Complete the OpenClaw Mission Control dashboard interface to match Claude's desktop app integration with functional UI.

## Architecture
- **Frontend**: React (CRA) + JavaScript, Zustand (localStorage persist), Tailwind CSS, React Router DOM
- **Backend**: Basic FastAPI server (frontend-focused app)

## What's Been Implemented

### Model Selector (Feb 9, 2026)
- Mirrored + menu style, hover-triggered, flush panels, smart positioning
- ALL models have context badges (128K/256K/200K/1M/1M+/2M) from cheatsheet
- Cost/Context/Capability icons per model, scrollable, 6 providers (97 total models)

### + Menu - Fully Functional (Feb 9, 2026)
- **Add files or photos**: Opens native file picker dialog
- **Add to Spaces**: Sub-menu lists existing spaces (Files/Design/Development) with colored icons, create new space inline with name input + Add button, assigns current thread to selected space
- **Add from GitHub**: Fills prompt with "Pull from GitHub repo:"
- **Skills**: Toggleable skills list + "Manage skills" / "Add skill" link to /customize
- **Connectors**: 12 connectors with toggles + "Manage connectors" link to /settings?tab=apps
- **Plugins**: Navigates to /customize plugin catalog
- **Research**: Sets mode + fills "Do deep research on:" prompt
- **Web search**: Toggle with checkmark indicator
- **Use style**: Normal/Concise/Formal/Explanatory selector

### Connectors - Desktop Apps Added (Feb 9, 2026)
12 connectors: Control Mac, Desktop Commander, File Access, Web Search, Signal, Telegram, VS Code, Figma, Slack, Chrome Browser, Docker, Notion

### Settings - Fully Functional (Feb 9, 2026)
- **General**: Theme (Dark/Light/System) persists to state, Web Search toggle, Writing Style selector, Default Model display
- **Profile**: Name, Email, Custom Instructions (all editable, persisted)
- **Connected Apps**: 12 connector toggles, Add MCP Server form (name + URL), Add API Key form (name + key), Remove buttons
- **Data Controls**: Save history / Usage data / Memory toggles (functional, persisted)
- **Delete all conversations**: Confirmation dialog then clears all threads
- **Security**: 2FA toggle, Active Sessions list (2 sessions, Current badge, Revoke option)

### Customize Page - Plugin Catalog (Feb 9, 2026)
- Skills section with 8 toggleable skills
- Manage Connectors link → Settings > Connected Apps
- Plugin catalog: 8 plugins across 3 categories (Tools/Creative/Dev), category filter tabs, install/uninstall toggles

### Other Features (Feb 8, 2026)
- Conversation Threading, Spaces, Agent Page, Jobs (live monitoring), Cowork (inline conversations), Code (terminal), Responsive layout

## P1 - Next Phase
- [ ] WebSocket gateway connection infrastructure
- [ ] Terminal alias bridge for sandboxed OpenClaw user environment
- [ ] Replace mock state with real API responses
- [ ] Real model switching via gateway

## P2 - Future
- [ ] Keyboard shortcuts (Cmd+K, Cmd+/)
- [ ] Componentize monolithic App.js (~1700 lines)
- [ ] Voice input, Mobile/PWA, Auto-route threads to spaces

## Testing: 100% pass rate (iteration 10 - 22 features verified)
