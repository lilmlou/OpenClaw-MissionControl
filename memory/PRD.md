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

### Model Selector with Proper Badges
- Cost tier: Free/$/$$/$$$ (derived from model ID patterns)
- Capability icons: Vision, Coding, Tool Call, Files, Reasoning, Fast
- 9 providers: anthropic, openai, google, nvidia, meta-llama, deepseek, mistral, qwen, openrouter

### Dashboard/Jobs/Approvals/Spaces Pages
- **Dashboard**: Stats grid, Active Model, Recent Events
- **Jobs**: Job cards with status/progress, cancel functionality
- **Approvals**: Risk levels, Approve/Reject buttons (functional)
- **Spaces**: Workspace cards with agents

### Cowork Page (Functional)
- 21 actionable task templates across 6 categories (Schedule, Create, Analyze, Organize, Communicate)
- Category filter tabs and search functionality
- Clicking any task navigates to Chat with prompt pre-filled in input
- "Connect tools" banner with links to Settings/Customize
- Mobile-friendly bottom bar with model selector

### Code Page (Clean Terminal)
- Clean terminal interface with lobster mascot splash screen (no mock data)
- Command input with simulated execution
- Clear button to reset terminal
- Bypass Permissions toggle (locked/unlocked visual state)
- Local/Remote execution toggle
- Model selector and mic button

### Customize Page
- Connect apps, Create skills, Browse plugins cards

### Navigation & Layout
- Sidebar with all nav items + Cowork + Customize
- Top tabs: Chat/Cowork/Code
- Mobile responsive: collapsible sidebar with hamburger menu on screens < 768px
- Binary rain background on Chat page

## User Personas
1. **AI Developer**: Multi-model access with capability awareness
2. **Power User**: Control over agent capabilities and connectors
3. **Team Manager**: Mission Control for job/approval monitoring
4. **Collaborator**: Cowork for real-time agent collaboration

## Technical Implementation Notes

### Model Capability Derivation (from ID patterns)
- **Fast**: `/flash|fast|mini|nano|turbo|small|haiku|lite/i`
- **Vision**: `/vl|vision|gpt-4o|claude-3|gemini|llava|pixtral/i`
- **Reasoning**: `/o1|o3|deepseek-r|reasoning|thinking|r1/i`
- **Coding**: `/cod(e|er|ing)|qwen.*coder|deepseek.*coder|codestral/i`
- **Tool Call**: Assume yes unless `/embed|whisper|tts|image/i`
- **Files**: Same as Vision

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
- [ ] Terminal alias bridge between dashboard and sandbox

## P2 - Future Enhancements
- [ ] Keyboard shortcuts (Cmd+K, Cmd+/)
- [ ] Real-time job status updates via WebSocket
- [ ] Push notifications for approvals
- [ ] Agent heartbeat monitoring
- [ ] Conversation history persistence
- [ ] Voice input integration (mic button)
- [ ] Componentize App.js into separate page files

## Testing Status (Feb 8, 2026)
- Frontend: 100% pass rate (iteration 4)
- All 15 features tested and verified
- Cowork task navigation, Code terminal, Chat, Dashboard, Jobs, Approvals all functional
- All toggles, dropdowns, and navigation working
