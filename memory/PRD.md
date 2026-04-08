# OpenClaw Mission Control - PRD

## Original Problem Statement
Complete the OpenClaw Mission Control dashboard interface from the existing Replit codebase to match Claude's desktop app integration. Requirements:
1. Fix model dropdown with proper badges (Cost tier, Context, Capability icons)
2. Build Dashboard/Jobs/Approvals pages
3. Add Cowork and Code features like Claude's integration
4. Connect to real OpenClaw WebSocket gateway (next phase)

## Architecture
- **Frontend**: React (Create React App) with JavaScript
- **State Management**: Zustand (persisted to localStorage)
- **UI Components**: Custom components with Radix UI primitives
- **Styling**: Tailwind CSS + custom CSS
- **Routing**: React Router DOM

## What's Been Implemented

### Model Selector with Real Provider Data (Feb 8, 2026)
- 6 providers: huggingface (9), ollama (11), opencode (13), opencode-go (3), openrouter (24), venice (31)
- ~91 models with explicit capability data from OpenClaw cheatsheet
- Capability icons: Vision, Coding, Tools, Files, Reasoning, Fast
  - Green = supported, Dim = partial, Grey = unsupported
- Cost tier badges: Free (green), $ (blue), $$ (yellow), $$$ (red)
- Context badges (e.g., 2M, 256K, 125K) where applicable
- Selected model name persists and replaces "Select model" text
- Provider auto-detection for multi-segment names (e.g., opencode-go)

### Cowork Page - Inline Conversation (Feb 8, 2026)
- Task grid with 21 templates across 6 categories
- Clicking a task opens inline conversation WITHIN the Cowork page (no navigation)
- Left sidebar: Recents list, "New task" button
- Center: Conversation with user prompt (from user's perspective), AI response, "Working on it..." status
- Right sidebar: Progress (step circles), Working folder, Context sections
- Reply input with "Queue" button and model selector
- Back button returns to task grid
- All prompts rewritten from user's perspective (user instructs OpenClaw)

### PlusMenu & InputBar Enhancement (Feb 8, 2026)
- PlusMenu: Add files, Add to project, Add from GitHub, Skills, Connectors, Plugins, Research, Web search, Use style
- Skills submenu: toggle individual skills with checkmarks
- Connectors submenu: toggle connectors with switches
- Persistent feature badges: "Web" (green), "X skills" (green) appear in InputBar
- Agent/Research mode toggle (blue/purple styling)
- Research selection changes mode badge and fills prompt

### Dashboard/Jobs/Approvals/Spaces Pages (Previously Done)
- **Dashboard**: Stats grid, Active Model, Recent Events
- **Jobs**: Job cards with status/progress, cancel functionality
- **Approvals**: Risk levels, Approve/Reject buttons (functional)
- **Spaces**: Workspace cards with agents

### Code Page - Clean Terminal (Previously Done)
- Clean terminal with lobster mascot splash
- Command execution, Clear, Bypass Permissions, Local/Remote toggle
- Mobile-responsive with collapsible sidebar

### Other (Previously Done)
- Dark mode CSS, binary rain background
- Mobile responsive layout with hamburger menu
- Customize page with plugins/skills/connectors

## P1 - Next Phase: Real Gateway Connection
- [ ] Configure terminal alias bridge between dashboard and sandboxed OpenClaw user account
- [ ] Finalize WebSocket gateway connection with real OpenClaw endpoint
- [ ] Replace mock data in useGateway.js with actual API responses
- [ ] Real model API switching

## P2 - Future Enhancements
- [ ] Keyboard shortcuts (Cmd+K, Cmd+/)
- [ ] Componentize monolithic App.js into separate page files
- [ ] Real-time job status updates via WebSocket
- [ ] Push notifications for approvals
- [ ] Conversation history persistence
- [ ] Voice input integration (mic button)
- [ ] Mobile app configuration

## Testing Status (Feb 8, 2026)
- Frontend: 100% pass rate (iteration 5 - 22+ tests)
- All features verified: Cowork inline conversation, model selector, PlusMenu, InputBar badges
- Previous iterations: 1-4 all passed
