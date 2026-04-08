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

## What's Been Implemented (Jan 2026)

### ✅ Model Selector with Proper Badges
- Cost tier: Free/$/$$/$$$ (derived from model ID patterns)
- Capability icons: 👁️ Vision, 💻 Coding, 🔧 Tool Call, 📁 Files, 🧠 Reasoning, ⚡ Fast
- 9 providers: anthropic, openai, google, nvidia, meta-llama, deepseek, mistral, qwen, openrouter

### ✅ Dashboard/Jobs/Approvals/Spaces Pages
- **Dashboard**: Stats grid, Active Model, Recent Events
- **Jobs**: Job cards with status/progress, cancel functionality
- **Approvals**: Risk levels, Approve/Reject buttons
- **Spaces**: Workspace cards with agents

### ✅ Claude-style Cowork (Ideas) Page
- Ideas header with search
- Category tabs: All, Plugins, Create, Analyze, Organize, Communicate
- "Connect your tools" banner with Connectors/Plugins buttons
- 3-column grid of 26 idea templates with tags (Engineering, Design, Data, etc.)
- Bottom input: "How can I help you today?" with "Work in a project" dropdown
- Model selector and mic button

### ✅ Claude-style Code (Terminal Sessions) Page
- Session sidebar with "New session" and "All projects" filter
- Today/Older session grouping (12 mock sessions)
- Session names: "Debug Claude code desktop application", "Enable Claude access on mobile devices", etc.
- Main terminal with 🦞 lobster mascot
- "Find a small todo in the codebase and do it" placeholder
- **Bypass permissions** toggle (Lock/Unlock)
- **Local** toggle (Local/Remote execution)
- Model selector and mic button

### ✅ Claude-style Customize Page
- Sidebar: Skills, Connectors, Personal plugins
- Personal plugins: Productivity, Design, Data, Enterprise search
- "Customize Claude" main content
- Three action cards:
  - Connect your apps
  - Create new skills
  - Browse plugins

### ✅ Navigation Updates
- Added "Ideas" and "Customize" to left sidebar
- Top tabs: Chat/Cowork/Code
- Recents section in sidebar

## User Personas
1. **AI Developer**: Multi-model access with capability awareness
2. **Power User**: Control over agent capabilities and connectors
3. **Team Manager**: Mission Control for job/approval monitoring
4. **Collaborator**: Cowork for real-time agent collaboration

## Technical Implementation Notes

### Model Capability Derivation (from ID patterns)
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

## P1 - Next Phase: Real Gateway Connection
- [ ] Obtain OpenClaw WebSocket gateway URL and credentials
- [ ] Implement real gateway connection in useGateway.js
- [ ] Replace mock terminal commands with actual sandbox execution
- [ ] Real model API switching
- [ ] Connect to sandboxed OpenClaw user account

## P2 - Future Enhancements
- [ ] Real-time job status updates via WebSocket
- [ ] Push notifications for approvals
- [ ] Agent heartbeat monitoring
- [ ] Conversation history persistence
- [ ] Voice input integration (mic button)

## Testing Status
- Frontend: 100% pass rate
- All pages functional
- All toggles and dropdowns working
- Navigation working correctly
