# OpenClaw Mission Control - PRD

## Original Problem Statement
Complete the OpenClaw Mission Control dashboard interface to match Claude's desktop app integration with functional UI.

## Architecture
- **Frontend**: React (CRA) + JavaScript, Zustand (localStorage persist), Tailwind CSS, React Router DOM
- **Backend**: Basic FastAPI server (frontend-focused app)

## What's Been Implemented

### Model Selector - Complete (Feb 9, 2026)
- Mirrored + menu style: `<` icon LEFT of providers, hover-triggered models panel
- Providers dropdown directly BELOW trigger, models panel LEFT growing upward
- Tight layout: 190px models panel, minimal padding (3px 6px), no excess space
- ALL models have context badges (128K/256K/200K/1M/1M+/2M) sourced from cheatsheet
- Cost ($/$$/$$$/Free), Context, and 6 Capability icons per model
- Smart positioning (up/down based on viewport)
- Scrollable model list, flush panels, 150ms hover debounce
- 6 providers with full cheatsheet data: huggingface(11), ollama(10), opencode(12), opencode-go(4), openrouter(29), venice(31)
- Added missing models: MiniMax-M2.5 HF, DeepSeek-R1, openrouter free models (Qwen3.6+, Qwen Coder, Qwen Next, Nano 30B, GLM Air, Auto Router), opencode-go M2.7

### Other Completed Features (Feb 8-9, 2026)
- Conversation Threading, Settings (5 Claude-style tabs), Spaces, Agent Page, Jobs, Cowork, Code, Customize
- UI: removed suggestion cards, added Agent shortcut icon

## P1 - Next Phase
- [ ] + menu refinements - each toggle functional
- [ ] Customize tab - Manage Connectors / Browser Plugin functionality
- [ ] Settings abilities discussion & implementation
- [ ] WebSocket connection infrastructure
- [ ] Replace mock state with actual API responses

## P2 - Future
- [ ] Keyboard shortcuts, componentize App.js, voice input, mobile/PWA

## Testing: All verified via screenshots (iterations 8-9 passed 100%)
