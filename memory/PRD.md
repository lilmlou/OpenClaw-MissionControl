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

### Model Selector - Minimal 2-Step Hover (Feb 8, 2026)
- 6 providers: huggingface (9), ollama (11), opencode (13), opencode-go (3), openrouter (24), venice (31)
- Flush side-by-side panels (no gap/flashing)
- Lucide icons (Eye, Code2, Wrench, FileText, Brain, Zap) - green for supported, grey for unsupported
- No cost badges - clean minimal design
- Selected model name persists

### Settings Page - Claude-Style Tabs (Feb 8, 2026)
- **General**: Theme (Dark/Light/System), Language, Web Search, Writing Style, Default Model
- **Profile**: Display Name, Email, Custom Instructions
- **Connected Apps**: Connectors (all OFF by default), MCP Servers, API Keys
- **Data Controls**: Save history, Usage data, Memory toggles
- **Security**: 2FA toggle, Active sessions

### Spaces (Feb 8, 2026)
- Default: Files (blue), Design (pink), Development (green)
- "Add Space" card + "New Space" button for custom spaces
- Click space → detail view showing threads assigned to that space
- Thread ↔ Space association via assignThreadToSpace

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

## P1 - Next Phase
- [ ] WebSocket connection infrastructure (ready to plug in gateway URL)
- [ ] Terminal alias bridge for sandboxed OpenClaw user account
- [ ] Replace mock state with actual API responses
- [ ] Real model switching via gateway

## P2 - Future
- [ ] Keyboard shortcuts (Cmd+K, Cmd+/)
- [ ] Componentize monolithic App.js
- [ ] Voice input integration
- [ ] Mobile app configuration
- [ ] Auto-route threads to spaces based on context

## Testing: 100% pass rate (iteration 7 - 28 features verified)
