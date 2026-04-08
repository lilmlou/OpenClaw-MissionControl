# OpenClaw Mission Control - PRD

## Original Problem Statement
Complete the OpenClaw Mission Control dashboard interface from the existing Replit codebase (Api-Finder.zip). Requirements:
1. Fix model dropdown with proper badges (Cost tier, Context, Capability icons)
2. Build Dashboard/Jobs/Approvals pages
3. Add Cowork and Code features like Claude's integration
4. Prepare for real OpenClaw WebSocket gateway connection

## Architecture
- **Frontend**: React (Create React App) with JavaScript
- **State Management**: Zustand (persisted to localStorage)
- **UI Components**: Custom components with Radix UI primitives
- **Styling**: Tailwind CSS + custom CSS
- **Routing**: React Router DOM

## Core Requirements (Static)
1. Claude.ai/Perplexity-style dashboard interface
2. Model selector with cost/capability badges
3. Plus menu with Skills, Connectors, Plugins, Style submenus
4. Mission Control features: Dashboard, Jobs, Approvals, Spaces
5. Cowork and Code features for collaboration
6. Real-time agent monitoring (future)

## What's Been Implemented (Jan 2026)

### Iteration 1 - Base Dashboard ✅
- Left sidebar with navigation
- Model selector with providers
- Plus menu with submenus
- Feature cards
- Chat interface with streaming

### Iteration 2 - Enhanced Features ✅
- **Model Selector Badges**:
  - Cost tier: Free/$/$$/$$$ (derived from model ID patterns)
  - Capability icons: 👁️ Vision, 💻 Coding, 🔧 Tool Call, 📁 Files, 🧠 Reasoning, ⚡ Fast
  - Green when supported, gray when not

- **Dashboard Page**:
  - Stats grid: Active Jobs, Pending Approvals, Connectors count, Gateway status
  - Active Model display
  - Recent Events section

- **Jobs Page**:
  - Job cards with status (Running/Completed/Pending/Cancelled)
  - Progress bars for running jobs
  - Cancel job functionality
  - New Job button

- **Approvals Page**:
  - Approval cards with description
  - Risk levels (low/medium/high) with color coding
  - Approve/Reject buttons with state updates

- **Spaces Page**:
  - Workspace cards (Development, Research, Automation)
  - Agent assignments per space
  - Color-coded spaces

- **Cowork Page**:
  - Participants sidebar (Meg/Human, OpenClaw/Agent)
  - Status indicators (active/idle/thinking)
  - Chat interface for real-time collaboration

- **Code Page (Terminal)**:
  - Terminal interface with black background
  - Command execution (simulated)
  - Clear terminal button
  - Output display

- **Settings Page**:
  - Connectors toggle switches
  - Writing style selection
  - Web search toggle

## User Personas
1. **AI Developer**: Needs multi-model access with capability awareness
2. **Power User**: Wants control over agent capabilities and connectors
3. **Team Manager**: Uses Mission Control for job/approval monitoring
4. **Collaborator**: Uses Cowork for real-time agent collaboration

## Prioritized Backlog

### P0 (Critical) - DONE ✅
- [x] Model selector with badges
- [x] Capability icons derived from model ID
- [x] Dashboard page
- [x] Jobs page with progress
- [x] Approvals with approve/reject
- [x] Cowork page
- [x] Code/Terminal page

### P1 (High Priority) - NEXT
- [ ] Real WebSocket connection to OpenClaw gateway
- [ ] Actual model switching with API calls
- [ ] Real terminal command execution via OpenClaw sandbox
- [ ] File upload functionality

### P2 (Medium Priority)
- [ ] Real-time job status updates via WebSocket
- [ ] Push notifications for approvals
- [ ] Agent heartbeat monitoring
- [ ] Conversation history persistence

### P3 (Nice to Have)
- [ ] Voice input (mic button)
- [ ] Multiple workspaces
- [ ] Custom skills creation
- [ ] Plugin marketplace

## Technical Notes

### Model Capability Derivation
Since RPC may not pass full metadata, capabilities are derived from model ID:
- **Fast** ⚡: `/flash|fast|mini|nano|turbo|small|haiku|lite/i`
- **Vision** 👁️: `/vl|vision|gpt-4o|claude-3|gemini|llava|pixtral/i`
- **Reasoning** 🧠: `/o1|o3|deepseek-r|reasoning|thinking|r1/i`
- **Coding** 💻: `/cod(e|er|ing)|qwen.*coder|deepseek.*coder|codestral/i`
- **Tool Call** 🔧: Assume ✓ unless `/embed|whisper|tts|image/i`
- **Files** 📁: Same as Vision

### Cost Tier Derivation
- **Free**: `:free` suffix, `ollama/`, `huggingface/`
- **$$$**: `gpt-4`, `claude-3-opus`, `o1-preview`
- **$$**: `claude-3-sonnet`, `gpt-4o`
- **$**: `haiku`, `mini`, `flash`, `lite`

## Next Steps
1. Obtain OpenClaw WebSocket gateway URL and credentials
2. Implement real gateway connection in useGateway.js
3. Replace mock command execution with actual sandbox calls
4. Test with sandboxed OpenClaw user account
