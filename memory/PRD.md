# OpenClaw Mission Control - PRD

## Original Problem Statement
Complete the OpenClaw Mission Control dashboard interface to match Claude's desktop app integration with functional UI.

## Architecture
- **Frontend**: React (CRA) + JavaScript, Zustand (localStorage persist), Tailwind CSS, React Router DOM
- **Backend**: Basic FastAPI server (frontend-focused app)

## What's Been Implemented

### Model Selector - Hover-based, Mirrored + Menu Style (Feb 9, 2026)
- `<` icon on LEFT side of provider names (mirroring + menu's `>` on right)
- Providers dropdown appears DIRECTLY BELOW "Select Model" trigger
- Models panel appears on HOVER (not click) to the LEFT of providers
- Panels are flush/tight (no gap, shared border, radius adjustments)
- Models panel bottom-aligns with providers, grows UPWARD
- Smart auto-positioning: flips entire dropdown up when insufficient space below (< 200px)
- Models panel direction adapts independently (up/down based on available space)
- All models scrollable via ScrollArea (no "more..." button needed)
- Cost badges ($, $$, $$$, Free), Context badges (2M, 256K, 125K), Capability icons per model
- 150ms debounce on mouse leave for smooth hover transitions
- 6 providers: huggingface(9), ollama(11), opencode(13), opencode-go(3), openrouter(24), venice(31)

### Conversation Threading (Feb 8, 2026)
- New thread button, messages auto-save to localStorage via Zustand
- Sidebar recent threads with click-to-load and delete

### Settings Page - Claude-Style Tabs (Feb 8, 2026)
- General, Profile, Connected Apps, Data Controls, Security

### Spaces (Feb 8, 2026)
- Files, Design, Development default spaces + custom

### Agent Page (Feb 8, 2026)
- Image Gen, Design, Code Exec, Web Browsing toggles

### Jobs Page - Live Monitoring (Feb 8, 2026)
- Active jobs with progress bars + history

### Cowork Page - Inline Conversation (Feb 8, 2026)
- 21 task templates with inline conversation windows

### Code Page - Terminal Interface (Feb 8, 2026)
### Customize Page (Feb 8, 2026)
### UI Cleanup (Feb 9, 2026)
- Removed suggestion cards, added Agent shortcut icon next to +

## P1 - Next Phase
- [ ] + menu refinements - each toggle working correctly
- [ ] Customize tab - Manage Connectors / Browser Plugin functionality
- [ ] Settings abilities discussion & implementation
- [ ] WebSocket connection infrastructure
- [ ] Terminal alias bridge
- [ ] Replace mock state with actual API responses

## P2 - Future
- [ ] Keyboard shortcuts (Cmd+K, Cmd+/)
- [ ] Componentize monolithic App.js (~1650 lines)
- [ ] Voice input integration
- [ ] Mobile/PWA configuration
- [ ] Auto-route threads to spaces

## Testing: 100% pass rate (iteration 9 - 18 features verified)
