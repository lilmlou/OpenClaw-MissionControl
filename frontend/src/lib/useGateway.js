/**
 * Gateway connection store using Zustand
 * Manages models, messages, events, and connection state
 */
import { create } from "zustand";
import { persist } from "zustand/middleware";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Model providers data matching your Replit version
const MODEL_PROVIDERS_DATA = {
  anthropic: {
    models: [
      { id: "anthropic/claude-3-opus", name: "claude-3-opus", context: "200K", caps: { vision: true, tools: true, memory: true } },
      { id: "anthropic/claude-3-sonnet", name: "claude-3-sonnet", context: "200K", caps: { vision: true, tools: true, fast: true } },
      { id: "anthropic/claude-3-haiku", name: "claude-3-haiku", context: "200K", caps: { vision: true, tools: true, fast: true } },
    ],
  },
  cognitivecomputations: {
    models: [
      { id: "cognitivecomputations/dolphin-mixtral-8x7b", name: "dolphin-mixtral-8x7b", context: "32K", caps: { tools: true } },
    ],
  },
  deepseek: {
    models: [
      { id: "deepseek/deepseek-coder-33b", name: "deepseek-coder-33b", context: "16K", caps: { tools: true, fast: true } },
      { id: "deepseek/deepseek-chat", name: "deepseek-chat", context: "32K", caps: { tools: true } },
    ],
  },
  "deepseek-ai": {
    models: [
      { id: "deepseek-ai/deepseek-v2", name: "deepseek-v2", context: "128K", caps: { tools: true, memory: true } },
    ],
  },
  google: {
    models: [
      { id: "google/gemini-pro", name: "gemini-pro", context: "32K", caps: { vision: true, tools: true } },
      { id: "google/gemini-ultra", name: "gemini-ultra", context: "32K", caps: { vision: true, tools: true, memory: true } },
    ],
  },
  "meta-llama": {
    models: [
      { id: "meta-llama/llama-3-70b-instruct", name: "llama-3-70b-instruct", context: "8K", caps: { tools: true } },
      { id: "meta-llama/llama-3-8b-instruct", name: "llama-3-8b-instruct", context: "8K", caps: { tools: true, fast: true } },
    ],
  },
  minimax: {
    models: [
      { id: "minimax/abab6-chat", name: "abab6-chat", context: "32K", caps: { tools: true } },
    ],
  },
  moonshot: {
    models: [
      { id: "moonshot/moonshot-v1-128k", name: "moonshot-v1-128k", context: "128K", caps: { tools: true, memory: true } },
    ],
  },
  nvidia: {
    models: [
      { id: "nvidia/nemotron-3-super-120b-a12b", name: "nemotron-3-super-120b-a12b", context: "128K", caps: { tools: true, memory: true } },
      { id: "nvidia/nemotron-3-super-120b-a12b:free", name: "nemotron-3-super-120b-a12b:free", context: "262K", caps: { tools: true, fast: true }, cost: "Free" },
      { id: "nvidia/nemotron-nano-12b-v2-vl:free", name: "nemotron-nano-12b-v2-vl:free", context: "128K", caps: { vision: true, tools: true, fast: true }, cost: "Free" },
      { id: "nvidia/nemotron-nano-8b-v2:free", name: "nemotron-nano-8b-v2:free", context: "128K", caps: { tools: true, fast: true }, cost: "Free" },
    ],
  },
  openai: {
    models: [
      { id: "openai/gpt-4-turbo", name: "gpt-4-turbo", context: "128K", caps: { vision: true, tools: true, memory: true } },
      { id: "openai/gpt-4o", name: "gpt-4o", context: "128K", caps: { vision: true, tools: true, memory: true, fast: true } },
      { id: "openai/gpt-4o-mini", name: "gpt-4o-mini", context: "128K", caps: { vision: true, tools: true, fast: true } },
      { id: "openai/gpt-3.5-turbo", name: "gpt-3.5-turbo", context: "16K", caps: { tools: true, fast: true } },
      { id: "openai/o1-preview", name: "o1-preview", context: "128K", caps: { tools: true, memory: true } },
    ],
  },
  openrouter: {
    models: [
      { id: "openrouter/auto", name: "auto", context: "varies", caps: { tools: true } },
    ],
  },
};

// Flatten models array
const getAllModels = () => {
  const models = [];
  Object.entries(MODEL_PROVIDERS_DATA).forEach(([provider, data]) => {
    data.models.forEach(model => {
      models.push({
        ...model,
        provider,
      });
    });
  });
  return models;
};

// Get providers list
const getProviders = () => {
  return Object.entries(MODEL_PROVIDERS_DATA).map(([name, data]) => ({
    name,
    count: data.models.length,
    models: data.models,
  }));
};

// Zustand store
export const useGateway = create(
  persist(
    (set, get) => ({
      // Connection state
      status: "connecting",
      phase: "idle",
      lastError: null,
      
      // Models
      models: getAllModels(),
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
      enabledSkills: [],
      
      // Style
      writingStyle: "Normal",
      
      // Web search
      webSearchEnabled: true,
      
      // Tool access
      toolAccess: "lazy",
      
      // Actions
      setStatus: (status) => set({ status }),
      setPhase: (phase) => set({ phase }),
      setLastError: (lastError) => set({ lastError }),
      setActiveModel: (activeModel) => set({ activeModel }),
      setClawStatus: (clawStatus) => set({ clawStatus }),
      
      addMessage: (msg) => set((s) => ({ 
        messages: [...s.messages.slice(-199), msg] 
      })),
      removeMessage: (id) => set((s) => ({ 
        messages: s.messages.filter(m => m.id !== id) 
      })),
      clearMessages: () => set({ messages: [], streamingMessage: null }),
      
      addEvent: (evt) => set((s) => ({ 
        events: [...s.events.slice(-499), evt] 
      })),
      clearEvents: () => set({ events: [] }),
      
      setStreamingMessage: (streamingMessage) => set({ streamingMessage }),
      setPendingRunId: (pendingRunId) => set({ pendingRunId }),
      
      toggleConnector: (id) => set((s) => ({
        connectors: { ...s.connectors, [id]: !s.connectors[id] }
      })),
      
      toggleSkill: (skillId) => set((s) => ({
        enabledSkills: s.enabledSkills.includes(skillId)
          ? s.enabledSkills.filter(id => id !== skillId)
          : [...s.enabledSkills, skillId]
      })),
      
      setWritingStyle: (writingStyle) => set({ writingStyle }),
      setWebSearchEnabled: (webSearchEnabled) => set({ webSearchEnabled }),
      setToolAccess: (toolAccess) => set({ toolAccess }),
      
      // Initialize connection
      initGateway: async () => {
        set({ status: "connecting" });
        // Simulate connection delay
        await new Promise(r => setTimeout(r, 1500));
        set({ status: "connected", clawStatus: { state: "Scheduled" } });
      },
      
      // Switch model
      switchModel: async (modelId) => {
        set({ activeModel: modelId });
        return true;
      },
      
      // Send message
      sendMessage: async (text) => {
        const { addMessage, setStreamingMessage, setPendingRunId } = get();
        
        const userMsgId = crypto.randomUUID();
        addMessage({
          id: userMsgId,
          role: "user",
          content: text,
          timestamp: Date.now(),
        });
        
        // Start streaming simulation
        const runId = crypto.randomUUID();
        setPendingRunId(runId);
        setStreamingMessage({ id: crypto.randomUUID(), runId, content: "" });
        
        // Simulate typing response
        const response = `I received your message: "${text}"\n\nThis is a placeholder response from the OpenClaw Mission Control system. The actual AI response would appear here with full markdown support.`;
        
        let content = "";
        for (const char of response) {
          await new Promise(r => setTimeout(r, 15));
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
        
        return { ok: true };
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
