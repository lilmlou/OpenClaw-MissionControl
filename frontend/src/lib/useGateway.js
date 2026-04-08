/**
 * Gateway connection store using Zustand
 * Manages models, messages, events, and connection state
 */
import { create } from "zustand";
import { persist } from "zustand/middleware";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

// ─── Model ID Pattern Matchers ───────────────────────────────────────────────
const PATTERNS = {
  fast: /flash|fast|mini|nano|turbo|small|haiku|lite|quick/i,
  vision: /vl|vision|gpt-4o|claude-3|claude-4|gemini|llava|pixtral|4o/i,
  reasoning: /o1|o3|deepseek-r|reasoning|thinking|r1/i,
  coding: /cod(e|er|ing)|qwen.*coder|deepseek.*coder|codestral/i,
  noTools: /embed|whisper|tts|image|dall/i,
  free: /ollama|huggingface|:free$|free$/i,
};

// ─── Derive capabilities from model ID ───────────────────────────────────────
function deriveCapabilities(modelId) {
  const id = modelId.toLowerCase();
  return {
    fast: PATTERNS.fast.test(id),
    vision: PATTERNS.vision.test(id),
    reasoning: PATTERNS.reasoning.test(id),
    coding: PATTERNS.coding.test(id),
    tools: !PATTERNS.noTools.test(id),
    files: PATTERNS.vision.test(id), // Vision models generally accept files
  };
}

// ─── Derive cost tier from model ID or cost data ─────────────────────────────
function deriveCostTier(modelId, costInput) {
  // If we have actual cost data
  if (typeof costInput === 'number') {
    if (costInput === 0) return 'Free';
    if (costInput < 0.000001) return '$';
    if (costInput < 0.000005) return '$$';
    return '$$$';
  }
  
  // Derive from ID pattern
  const id = modelId.toLowerCase();
  if (PATTERNS.free.test(id)) return 'Free';
  
  // Known free providers
  if (id.includes('ollama/') || id.includes('huggingface/')) return 'Free';
  
  // Known premium models
  if (/gpt-4|claude-3-opus|o1-preview|o1-pro/i.test(id)) return '$$$';
  if (/claude-3-sonnet|gpt-4o(?!-mini)/i.test(id)) return '$$';
  if (/haiku|mini|flash|lite/i.test(id)) return '$';
  
  return null; // No cost info available
}

// ─── Format context window ───────────────────────────────────────────────────
function formatContext(contextWindow) {
  if (!contextWindow) return null;
  const n = typeof contextWindow === 'string' ? parseInt(contextWindow) : contextWindow;
  if (isNaN(n)) return contextWindow;
  if (n >= 1000000) return `${Math.round(n / 1000000)}M`;
  if (n >= 1000) return `${Math.round(n / 1000)}K`;
  return `${n}`;
}

// ─── Model providers data ────────────────────────────────────────────────────
const MODEL_PROVIDERS_DATA = {
  anthropic: {
    models: [
      { id: "anthropic/claude-3-opus", name: "claude-3-opus" },
      { id: "anthropic/claude-3-sonnet", name: "claude-3-sonnet" },
      { id: "anthropic/claude-3-haiku", name: "claude-3-haiku" },
      { id: "anthropic/claude-3.5-sonnet", name: "claude-3.5-sonnet" },
    ],
  },
  openai: {
    models: [
      { id: "openai/gpt-4-turbo", name: "gpt-4-turbo" },
      { id: "openai/gpt-4o", name: "gpt-4o" },
      { id: "openai/gpt-4o-mini", name: "gpt-4o-mini" },
      { id: "openai/gpt-3.5-turbo", name: "gpt-3.5-turbo" },
      { id: "openai/o1-preview", name: "o1-preview" },
      { id: "openai/o1-mini", name: "o1-mini" },
    ],
  },
  google: {
    models: [
      { id: "google/gemini-pro", name: "gemini-pro" },
      { id: "google/gemini-1.5-pro", name: "gemini-1.5-pro" },
      { id: "google/gemini-1.5-flash", name: "gemini-1.5-flash" },
    ],
  },
  "meta-llama": {
    models: [
      { id: "meta-llama/llama-3-70b-instruct", name: "llama-3-70b-instruct" },
      { id: "meta-llama/llama-3-8b-instruct", name: "llama-3-8b-instruct" },
      { id: "meta-llama/llama-3.1-405b", name: "llama-3.1-405b" },
    ],
  },
  deepseek: {
    models: [
      { id: "deepseek/deepseek-coder-33b", name: "deepseek-coder-33b" },
      { id: "deepseek/deepseek-chat", name: "deepseek-chat" },
      { id: "deepseek/deepseek-r1", name: "deepseek-r1" },
    ],
  },
  nvidia: {
    models: [
      { id: "nvidia/nemotron-3-super-120b-a12b", name: "nemotron-3-super-120b-a12b" },
      { id: "nvidia/nemotron-3-super-120b-a12b:free", name: "nemotron-3-super-120b-a12b:free" },
      { id: "nvidia/nemotron-nano-12b-v2-vl:free", name: "nemotron-nano-12b-v2-vl:free" },
      { id: "nvidia/nemotron-nano-8b-v2:free", name: "nemotron-nano-8b-v2:free" },
    ],
  },
  mistral: {
    models: [
      { id: "mistral/mistral-large", name: "mistral-large" },
      { id: "mistral/mistral-medium", name: "mistral-medium" },
      { id: "mistral/codestral", name: "codestral" },
    ],
  },
  qwen: {
    models: [
      { id: "qwen/qwen-72b-chat", name: "qwen-72b-chat" },
      { id: "qwen/qwen-coder-32b", name: "qwen-coder-32b" },
    ],
  },
  openrouter: {
    models: [
      { id: "openrouter/auto", name: "auto" },
    ],
  },
};

// Process models with derived capabilities
const processModels = () => {
  const models = [];
  Object.entries(MODEL_PROVIDERS_DATA).forEach(([provider, data]) => {
    data.models.forEach(model => {
      const caps = deriveCapabilities(model.id);
      const costTier = deriveCostTier(model.id, model.cost?.input);
      const context = formatContext(model.contextWindow);
      
      models.push({
        ...model,
        provider,
        caps,
        costTier,
        context,
      });
    });
  });
  return models;
};

const getProviders = () => {
  return Object.entries(MODEL_PROVIDERS_DATA).map(([name, data]) => ({
    name,
    count: data.models.length,
    models: data.models.map(m => ({
      ...m,
      caps: deriveCapabilities(m.id),
      costTier: deriveCostTier(m.id, m.cost?.input),
      context: formatContext(m.contextWindow),
    })),
  }));
};

// ─── Jobs data ───────────────────────────────────────────────────────────────
const MOCK_JOBS = [
  { id: "job-1", name: "Code Analysis Task", status: "running", progress: 65, agent: "coder", started: Date.now() - 120000 },
  { id: "job-2", name: "Web Research: AI Trends", status: "completed", progress: 100, agent: "researcher", started: Date.now() - 3600000 },
  { id: "job-3", name: "File Sync Operation", status: "pending", progress: 0, agent: "file-manager", started: Date.now() },
  { id: "job-4", name: "Desktop Automation", status: "running", progress: 30, agent: "desktop", started: Date.now() - 60000 },
];

// ─── Approvals data ──────────────────────────────────────────────────────────
const MOCK_APPROVALS = [
  { id: "apr-1", title: "File Access Request", description: "Agent requests read access to ~/Documents/config.json", status: "pending", agent: "file-manager", risk: "low", timestamp: Date.now() - 30000 },
  { id: "apr-2", title: "Terminal Command Execution", description: "Agent wants to run: npm install express", status: "pending", agent: "coder", risk: "medium", timestamp: Date.now() - 60000 },
  { id: "apr-3", title: "External API Call", description: "Agent requests permission to call api.github.com", status: "approved", agent: "researcher", risk: "low", timestamp: Date.now() - 120000 },
  { id: "apr-4", title: "System Settings Change", description: "Agent wants to modify ~/.zshrc", status: "rejected", agent: "desktop", risk: "high", timestamp: Date.now() - 180000 },
];

// ─── Spaces data ─────────────────────────────────────────────────────────────
const MOCK_SPACES = [
  { id: "space-1", name: "Development", description: "Code projects and tools", agents: ["coder", "file-manager"], color: "#3b82f6" },
  { id: "space-2", name: "Research", description: "Web research and analysis", agents: ["researcher"], color: "#10b981" },
  { id: "space-3", name: "Automation", description: "Desktop and system tasks", agents: ["desktop"], color: "#f59e0b" },
];

// ─── Zustand store ───────────────────────────────────────────────────────────
export const useGateway = create(
  persist(
    (set, get) => ({
      // Connection state
      status: "connecting",
      phase: "idle",
      lastError: null,
      
      // Models
      models: processModels(),
      providers: getProviders(),
      activeModel: null,
      
      // Messages and events
      messages: [],
      events: [],
      streamingMessage: null,
      pendingRunId: null,
      
      // Claw status
      clawStatus: { state: "Scheduled" },
      usageStatus: null,
      
      // Settings
      userName: "Meg",
      
      // Connectors state
      connectors: {
        mac: true,
        desktop: true,
        files: true,
        web: true,
        signal: false,
        telegram: true,
      },
      
      // Skills state  
      enabledSkills: ["deep-research", "code-review"],
      
      // Style
      writingStyle: "Normal",
      
      // Web search
      webSearchEnabled: true,
      
      // Tool access
      toolAccess: "lazy",
      
      // Active page/tab
      activePage: "chat",
      activeTab: "chat",
      
      // Jobs
      jobs: MOCK_JOBS,
      
      // Approvals
      approvals: MOCK_APPROVALS,
      
      // Spaces
      spaces: MOCK_SPACES,
      
      // Terminal/Code state
      terminalOutput: [],
      codeFiles: [],
      activeFile: null,
      
      // Cowork state
      coworkParticipants: [
        { id: "user", name: "Meg", role: "human", status: "active" },
        { id: "claw", name: "OpenClaw", role: "agent", status: "idle" },
      ],
      coworkMessages: [],
      
      // Actions
      setStatus: (status) => set({ status }),
      setPhase: (phase) => set({ phase }),
      setLastError: (lastError) => set({ lastError }),
      setActiveModel: (activeModel) => set({ activeModel }),
      setClawStatus: (clawStatus) => set({ clawStatus }),
      setActivePage: (activePage) => set({ activePage }),
      setActiveTab: (activeTab) => set({ activeTab }),
      
      // Messages
      addMessage: (msg) => set((s) => ({ 
        messages: [...s.messages.slice(-199), msg] 
      })),
      removeMessage: (id) => set((s) => ({ 
        messages: s.messages.filter(m => m.id !== id) 
      })),
      clearMessages: () => set({ messages: [], streamingMessage: null }),
      
      // Events
      addEvent: (evt) => set((s) => ({ 
        events: [...s.events.slice(-499), evt] 
      })),
      clearEvents: () => set({ events: [] }),
      
      setStreamingMessage: (streamingMessage) => set({ streamingMessage }),
      setPendingRunId: (pendingRunId) => set({ pendingRunId }),
      
      // Connectors
      toggleConnector: (id) => set((s) => ({
        connectors: { ...s.connectors, [id]: !s.connectors[id] }
      })),
      
      // Skills
      toggleSkill: (skillId) => set((s) => ({
        enabledSkills: s.enabledSkills.includes(skillId)
          ? s.enabledSkills.filter(id => id !== skillId)
          : [...s.enabledSkills, skillId]
      })),
      
      setWritingStyle: (writingStyle) => set({ writingStyle }),
      setWebSearchEnabled: (webSearchEnabled) => set({ webSearchEnabled }),
      setToolAccess: (toolAccess) => set({ toolAccess }),
      
      // Jobs actions
      updateJobStatus: (jobId, status, progress) => set((s) => ({
        jobs: s.jobs.map(j => j.id === jobId ? { ...j, status, progress } : j)
      })),
      cancelJob: (jobId) => set((s) => ({
        jobs: s.jobs.map(j => j.id === jobId ? { ...j, status: "cancelled", progress: j.progress } : j)
      })),
      
      // Approvals actions
      approveRequest: (approvalId) => set((s) => ({
        approvals: s.approvals.map(a => a.id === approvalId ? { ...a, status: "approved" } : a)
      })),
      rejectRequest: (approvalId) => set((s) => ({
        approvals: s.approvals.map(a => a.id === approvalId ? { ...a, status: "rejected" } : a)
      })),
      
      // Terminal actions
      addTerminalOutput: (line) => set((s) => ({
        terminalOutput: [...s.terminalOutput.slice(-500), { id: crypto.randomUUID(), content: line, timestamp: Date.now() }]
      })),
      clearTerminal: () => set({ terminalOutput: [] }),
      
      // Code actions
      setActiveFile: (activeFile) => set({ activeFile }),
      updateCodeFile: (fileId, content) => set((s) => ({
        codeFiles: s.codeFiles.map(f => f.id === fileId ? { ...f, content } : f)
      })),
      
      // Cowork actions
      addCoworkMessage: (msg) => set((s) => ({
        coworkMessages: [...s.coworkMessages.slice(-99), msg]
      })),
      updateParticipantStatus: (participantId, status) => set((s) => ({
        coworkParticipants: s.coworkParticipants.map(p => 
          p.id === participantId ? { ...p, status } : p
        )
      })),
      
      // Initialize connection
      initGateway: async () => {
        set({ status: "connecting" });
        await new Promise(r => setTimeout(r, 1500));
        set({ status: "connected", clawStatus: { state: "Scheduled" } });
      },
      
      // Switch model
      switchModel: async (modelId) => {
        set({ activeModel: modelId });
        get().addEvent({
          id: crypto.randomUUID(),
          ts: Date.now(),
          type: "model.switch",
          payload: { model: modelId }
        });
        return true;
      },
      
      // Send message
      sendMessage: async (text) => {
        const { addMessage, setStreamingMessage, setPendingRunId, addEvent } = get();
        
        const userMsgId = crypto.randomUUID();
        addMessage({
          id: userMsgId,
          role: "user",
          content: text,
          timestamp: Date.now(),
        });
        
        addEvent({
          id: crypto.randomUUID(),
          ts: Date.now(),
          type: "message.sent",
          payload: { content: text.slice(0, 50) }
        });
        
        // Start streaming simulation
        const runId = crypto.randomUUID();
        setPendingRunId(runId);
        setStreamingMessage({ id: crypto.randomUUID(), runId, content: "" });
        
        // Simulate typing response
        const response = `I received your message: "${text}"\n\nThis is a placeholder response from the OpenClaw Mission Control system. The actual AI response would appear here with full markdown support.\n\n**Features:**\n- Real-time streaming\n- Markdown rendering\n- Code syntax highlighting\n\n\`\`\`javascript\nconsole.log("Hello from OpenClaw!");\n\`\`\``;
        
        let content = "";
        for (const char of response) {
          await new Promise(r => setTimeout(r, 10));
          content += char;
          setStreamingMessage({ id: crypto.randomUUID(), runId, content });
        }
        
        // Finalize
        addMessage({
          id: crypto.randomUUID(),
          role: "assistant", 
          content: response,
          timestamp: Date.now(),
        });
        setStreamingMessage(null);
        setPendingRunId(null);
        
        addEvent({
          id: crypto.randomUUID(),
          ts: Date.now(),
          type: "message.complete",
          payload: { runId }
        });
        
        return { ok: true };
      },
      
      // Execute terminal command (simulated)
      executeCommand: async (command) => {
        const { addTerminalOutput, addEvent } = get();
        
        addTerminalOutput(`$ ${command}`);
        addEvent({
          id: crypto.randomUUID(),
          ts: Date.now(),
          type: "terminal.execute",
          payload: { command }
        });
        
        // Simulate command execution
        await new Promise(r => setTimeout(r, 500));
        
        // Mock responses based on command
        if (command.startsWith("ls")) {
          addTerminalOutput("Documents  Downloads  Desktop  Projects  .config");
        } else if (command.startsWith("pwd")) {
          addTerminalOutput("/Users/meg");
        } else if (command.startsWith("echo")) {
          addTerminalOutput(command.replace("echo ", ""));
        } else if (command.startsWith("cat")) {
          addTerminalOutput("# Config file contents\nkey=value");
        } else {
          addTerminalOutput(`Command executed: ${command}`);
        }
        
        addTerminalOutput(""); // Empty line
      },
    }),
    {
      name: "openclaw-gateway",
      partialize: (s) => ({
        activeModel: s.activeModel,
        connectors: s.connectors,
        enabledSkills: s.enabledSkills,
        writingStyle: s.writingStyle,
        webSearchEnabled: s.webSearchEnabled,
        toolAccess: s.toolAccess,
      }),
    }
  )
);

// Export helper functions
export const initGateway = () => useGateway.getState().initGateway();
export const sendMessage = (text) => useGateway.getState().sendMessage(text);
export const switchModel = (modelId) => useGateway.getState().switchModel(modelId);
export const executeCommand = (cmd) => useGateway.getState().executeCommand(cmd);
