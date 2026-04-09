# OpenClaw Mission Control - PRD

## Original Problem Statement
Complete the OpenClaw Mission Control dashboard interface to match Claude's desktop app integration with functional UI.

## Architecture
- **Frontend**: React (CRA) + JavaScript, Zustand (localStorage persist), Tailwind CSS, React Router DOM
- **Backend**: Basic FastAPI server (frontend-focused app)

## What's Been Implemented

### Model Selector - Hover-based, Mirrored + Menu Style (Feb 9, 2026)
- `<` icon on LEFT side of provider names (mirroring + menu)
- Providers dropdown directly BELOW "Select Model" trigger
- Models panel on HOVER to LEFT of providers, flush/tight, no gap
- Models panel bottom-aligns with providers, grows upward
- Smart auto-positioning (flips up when <200px space below)
- Native scrollable models list (overflow-y: auto, all models accessible)
- Tight layout: reduced padding, gaps, panel widths (providers 155px, models 260px)
- Cost ($/$$/$$$/Free), Context (2M/256K/125K), Capability icons per model
- 150ms debounce hover transitions
- 6 providers: huggingface(9), ollama(11), opencode(12), opencode-go(3), openrouter(24), venice(31)

### Other Completed Features (Feb 8-9, 2026)
- Conversation Threading with localStorage persistence
- Settings Page (Claude-style 5 tabs)
- Spaces (Files, Design, Development + custom)
- Agent Page (4 capability toggles)
- Jobs Page (live monitoring)
- Cowork Page (21 inline task conversations)
- Code Page (terminal interface)
- Customize Page (skills, connectors link, plugins)
- UI Cleanup (removed suggestion cards, added Agent shortcut icon)

## P1 - Next Phase
- [ ] + menu refinements - each toggle functional
- [ ] Customize tab - Manage Connectors / Browser Plugin functionality
- [ ] Settings abilities discussion & implementation
- [ ] WebSocket connection infrastructure
- [ ] Terminal alias bridge
- [ ] Replace mock state with actual API responses

## P2 - Future
- [ ] Keyboard shortcuts (Cmd+K, Cmd+/)
- [ ] Componentize monolithic App.js (~1650 lines)
- [ ] Voice input, Mobile/PWA, Auto-route threads to spaces

## Testing: 100% pass rate (iteration 9 - 18 features verified)
