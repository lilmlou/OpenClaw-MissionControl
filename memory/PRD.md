# OpenClaw Mission Control - PRD

## Original Problem Statement
Complete the OpenClaw Mission Control dashboard interface to match Claude's desktop app integration with functional UI.

## Architecture
- **Frontend**: React (CRA) + JavaScript, Zustand (localStorage persist), Tailwind CSS, React Router DOM
- **Backend**: Basic FastAPI server (frontend-focused app)

## What's Been Implemented

### Conversation Threading (Feb 8, 2026)
- New thread button creates fresh conversation, clears messages
- Messages auto-save to threads in localStorage via Zustand persist
- Sidebar shows recent threads with click-to-load and X-to-delete
- Thread titles derived from first message content

### Model Selector - Click-Based with Smart Positioning (Feb 9, 2026)
- 6 providers: huggingface (9), ollama (11), opencode (13), opencode-go (3), openrouter (24), venice (31)
- Click-to-select provider (not hover) - matches + menu pattern
- Models panel appears LEFT of providers, shows 8 models initially with "more..." expand button
- Dynamic capability badges per model: Cost ($, $$, $$$, Free), Context (2M, 256K, etc.), Vision, Coding, Tools, Files, Reasoning, Fast icons
- Smart positioning: drops up or down based on available viewport space
- Flush side-by-side panels matching + menu styling

### Settings Page - Claude-Style Tabs (Feb 8, 2026)
- **General**: Theme (Dark/Light/System), Language, Web Search, Writing Style, Default Model
- **Profile**: Display Name, Email, Custom Instructions
- **Connected Apps**: Connectors (all OFF by default), MCP Servers, API Keys
- **Data Controls**: Save history, Usage data, Memory toggles
- **Security**: 2FA toggle, Active sessions

### Spaces (Feb 8, 2026)
- Default: Files (blue), Design (pink), Development (green)
- "Add Space" card + "New Space" button for custom spaces
- Click space -> detail view showing threads assigned to that space
- Thread <-> Space association via assignThreadToSpace

### Agent Page - Creative Workspace (Feb 8, 2026)
- 4 capability toggles: Image Generation, Design Creation, Code Execution (ON default), Web Browsing
- Active capability chips shown in input bar
- Warning banner linking to Settings when no connectors enabled
- Distinct from Chat: task-oriented with tool access

### Jobs Page - Live Monitoring (Feb 8, 2026)
- Active section: running jobs with animated progress bars and cancel buttons
- History section: completed/failed/cancelled jobs
- Sidebar badge showing active job count
- Auto-progress tick every 3 seconds

### Cowork Page - Inline Conversation (Feb 8, 2026)
- 21 task templates with user-perspective prompts
- Inline conversation within Cowork page
- Left: Recents | Center: Conversation | Right: Progress/Context

### Code Page - Clean Terminal
- Command execution, Clear, Bypass Permissions, Local/Remote toggle

### Customize Page (Feb 8, 2026)
- Functional skill toggles (8 skills)
- "Manage Connectors" links to Settings > Connected Apps
- Browse plugins section

### UI Cleanup (Feb 9, 2026)
- Removed 4 suggestion cards below chat input (Select a model, Try Agent, Deep Research, Mission Control)
- Added Agent sparkles icon next to + button in InputBar as hyperlink to /agent page
- Clean minimal home screen with just the input bar

## P1 - Next Phase
- [ ] + menu refinements - ensure each toggle works correctly (user priority)
- [ ] WebSocket connection infrastructure (ready to plug in gateway URL)
- [ ] Terminal alias bridge for sandboxed OpenClaw user account
- [ ] Replace mock state with actual API responses
- [ ] Real model switching via gateway

## P2 - Future
- [ ] Keyboard shortcuts (Cmd+K, Cmd+/)
- [ ] Componentize monolithic App.js (~1600 lines)
- [ ] Voice input integration
- [ ] Mobile app configuration
- [ ] Auto-route threads to spaces based on context

## Testing: 100% pass rate (iteration 8 - 20+ features verified)
