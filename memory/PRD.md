# OpenClaw Mission Control - PRD

## Original Problem Statement
Complete the OpenClaw Mission Control dashboard interface from the existing Replit codebase to match Claude's desktop app integration.

## Architecture
- **Frontend**: React (CRA) + JavaScript, Zustand state, Tailwind CSS, React Router DOM
- **Backend**: Basic FastAPI server (frontend-focused app)

## What's Been Implemented

### Model Selector - Minimal 2-Step Hover Design (Feb 8, 2026)
- Small provider-only dropdown (6 providers): huggingface (9), ollama (11), opencode (13), opencode-go (3), openrouter (24), venice (31)
- Models panel appears on hover to the LEFT of providers
- ~91 models with explicit capability data from OpenClaw cheatsheet
- Lucide React icons (Eye, Code2, Wrench, FileText, Brain, Zap) replacing emoji
- Green (#22c55e) = supported, grey (#333) = unsupported
- No cost badges - clean minimal rows: name, monospace slug, capability icons
- Selected model name persists in label

### Cowork Page - Inline Conversation (Feb 8, 2026)
- 21 task templates with user-perspective prompts
- Inline conversation opens within Cowork page (no navigation)
- Left: Recents sidebar | Center: Conversation | Right: Progress/Context sidebar
- Reply input with Queue button and model selector

### PlusMenu & InputBar (Feb 8, 2026)
- All PlusMenu items functional (Skills, Connectors, Web search, Research, Style)
- Research click changes Agent badge to Research (purple) in InputBar
- Persistent feature badges: "Web" (green), "X skills" (green)
- Agent/Research mode toggle

### Other Pages (Previously Done)
- Dashboard, Jobs, Approvals, Spaces, Code, Customize
- Mobile responsive layout with hamburger menu
- Dark mode, binary rain background

## P1 - Next Phase
- [ ] Terminal alias bridge for sandboxed OpenClaw user account
- [ ] Real WebSocket gateway connection
- [ ] Replace mock state with actual API responses

## P2 - Future
- [ ] Keyboard shortcuts (Cmd+K, Cmd+/)
- [ ] Componentize monolithic App.js
- [ ] Conversation persistence, voice input, mobile app config

## Testing: 100% pass rate (iteration 6 - all features verified)
