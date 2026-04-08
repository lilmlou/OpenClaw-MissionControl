# OpenClaw Mission Control - PRD

## Original Problem Statement
Complete the OpenClaw Mission Control dashboard interface from the existing Replit codebase (Api-Finder.zip). The user wanted all toggle buttons and dropdown menus to become live and functional.

## Architecture
- **Frontend**: React (Create React App) with JavaScript
- **State Management**: Zustand (persisted to localStorage)
- **UI Components**: Custom components with Radix UI primitives
- **Styling**: Tailwind CSS + custom CSS

## Core Requirements
1. Claude.ai/Perplexity-style dashboard interface
2. Model selector dropdown with providers and models
3. Plus menu with Skills, Connectors, Plugins, Style submenus
4. Toggle switches for connectors
5. Binary rain background animation
6. Chat input with streaming responses

## What's Been Implemented (Jan 2026)

### UI Components
- ✅ Left sidebar with Personal dropdown, navigation, Bookmarks, History
- ✅ Top header with Chat/Cowork/Code tabs and Scheduled status
- ✅ Model selector with dual-panel flyout (providers list + models)
- ✅ Plus menu with all submenus working
- ✅ Skills submenu (8 skills with toggle state)
- ✅ Connectors submenu (6 connectors with toggle switches)
- ✅ Use style submenu (4 writing styles)
- ✅ Feature cards (Select model, Try Agent, Deep Research, Mission Control)
- ✅ Chat interface with streaming markdown responses
- ✅ Binary rain canvas animation background

### State Management (Zustand)
- Models and providers data
- Active model selection
- Connector toggle states
- Enabled skills
- Writing style preference
- Web search toggle
- Tool access mode
- Chat messages and streaming state

## User Personas
1. **AI Developer/Researcher**: Needs to interact with multiple AI models
2. **Power User**: Wants control over agent capabilities and connectors
3. **Team Manager**: Uses Mission Control for job/approval monitoring

## Prioritized Backlog

### P0 (Critical) - DONE
- [x] Model selector dropdown
- [x] Plus menu with submenus
- [x] Toggle switches for connectors
- [x] Skills toggles
- [x] Style selection

### P1 (High Priority)
- [ ] Real WebSocket/API integration with OpenClaw backend
- [ ] Actual model switching with API calls
- [ ] File upload functionality
- [ ] GitHub integration

### P2 (Medium Priority)  
- [ ] Dashboard page with job monitoring
- [ ] Approvals page with approval/reject functionality
- [ ] Agent page with command execution
- [ ] Settings page with configuration

### P3 (Nice to Have)
- [ ] Voice input (mic button)
- [ ] Workspace switching
- [ ] History persistence with backend
- [ ] Bookmarks CRUD operations

## Next Tasks
1. Connect to real OpenClaw WebSocket gateway
2. Implement model API integration
3. Add actual file upload flow
4. Build Dashboard page with jobs view
