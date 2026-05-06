/**
 * Gateway connection store using Zustand
 * Manages models, messages, events, and connection state
 */
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { DEFAULT_RUNTIME, RUNTIME_META } from "./constants";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const APPROVAL_MODES = ["default", "acceptEdits", "bypassPermissions", "plan", "auto"];
let approvalsWs = null;
let approvalsWsReconnectTimer = null;
let gatewayWs = null;
let gatewayWsReconnectTimer = null;
let agentsWs = null;
let agentsWsReconnectTimer = null;
let activitiesWs = null;
let activitiesWsReconnectTimer = null;
const STREAM_STALE_MS = 90000;
const streamTimers = {};

function clearStreamTimer(threadId) {
  if (threadId && streamTimers[threadId]) {
    clearTimeout(streamTimers[threadId]);
    delete streamTimers[threadId];
  }
}

function armStreamTimer(threadId, runId, get, set) {
  clearStreamTimer(threadId);
  streamTimers[threadId] = setTimeout(() => {
    const state = get();
    if (state.streamingMessage?.runId === runId || state.pendingRunId === runId) {
      set({ streamingMessage: null, pendingRunId: null, lastError: 'Response timed out' });
      state.addEvent?.({ id: crypto.randomUUID(), ts: Date.now(), type: 'gateway.timeout', payload: { runId, threadId } });
    }
    clearStreamTimer(threadId);
  }, STREAM_STALE_MS);
}


const getApiBase = () => (BACKEND_URL ? BACKEND_URL.replace(/\/$/, "") : "");
const apiUrl = (path) => `${getApiBase()}${path}`;
export { apiUrl, getApiBase };
const wsUrl = (path) => {
  if (BACKEND_URL) {
    const base = BACKEND_URL.replace(/\/$/, "");
    const wsBase = base.startsWith("https://")
      ? base.replace("https://", "wss://")
      : base.replace("http://", "ws://");
    return `${wsBase}${path}`;
  }
  const wsProto = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${wsProto}//${window.location.host}${path}`;
};

const toMs = (v) => {
  const n = Date.parse(v || "");
  return Number.isNaN(n) ? Date.now() : n;
};

const normalizeV2Approval = (req) => ({
  id: req.id,
  sessionId: req.session_id,
  toolName: req.tool_name,
  title: req.tool_name || "Tool Permission Request",
  description: req.description || "Permission request",
  status: req.status === "denied" ? "rejected" : req.status,
  agent: req.session_id || "session",
  risk: "medium",
  timestamp: toMs(req.created_at),
  decision: req.decision || null,
});

const normalizeLegacyApproval = (item) => ({
  id: item.id,
  title: item.title || "Approval Request",
  description: item.description || "",
  status: item.status || "pending",
  agent: item.agent || "agent",
  risk: item.risk || "medium",
  timestamp: toMs(item.timestamp),
});

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

// ─── Model providers data (from OpenClaw cheatsheet) ─────────────────────────
// caps: true = supported, "partial" = partial, false = not supported
const MODEL_PROVIDERS_DATA = {
  huggingface: {
    models: [
      { id: "huggingface/Qwen/Qwen3-Coder-480B-A35B-Instruct", name: "Qwen3-Coder-480B", caps: { vision: false, coding: true, tools: "partial", files: true, reasoning: false, fast: false }, costTier: "$$", context: "128K" },
      { id: "huggingface/Qwen/Qwen3-Coder-Next", name: "Qwen3-Coder-Next", caps: { vision: false, coding: true, tools: "partial", files: true, reasoning: false, fast: true }, costTier: "$", context: "128K" },
      { id: "huggingface/Qwen/Qwen3.5-397B-A17B", name: "Qwen3.5-397B", caps: { vision: true, coding: true, tools: "partial", files: true, reasoning: true, fast: "partial" }, costTier: "$", context: "1M+" },
      { id: "huggingface/deepseek-ai/DeepSeek-R1", name: "DeepSeek-R1", caps: { vision: false, coding: true, tools: "partial", files: true, reasoning: true, fast: false }, costTier: "$", context: "128K" },
      { id: "huggingface/deepseek-ai/DeepSeek-V3.1", name: "DeepSeek-V3.1", caps: { vision: false, coding: true, tools: "partial", files: true, reasoning: true, fast: "partial" }, costTier: "$", context: "128K" },
      { id: "huggingface/meta-llama/Llama-3.3-70B-Instruct-Turbo", name: "Llama-3.3-70B", caps: { vision: false, coding: true, tools: "partial", files: true, reasoning: false, fast: true }, costTier: "$", context: "125K" },
      { id: "huggingface/moonshotai/Kimi-K2.5", name: "Kimi-K2.5", caps: { vision: true, coding: true, tools: "partial", files: true, reasoning: true, fast: false }, costTier: "$", context: "256K" },
      { id: "huggingface/openai/gpt-oss-120b", name: "GPT-OSS-120B", caps: { vision: false, coding: true, tools: true, files: true, reasoning: true, fast: true }, costTier: "$", context: "128K" },
      { id: "huggingface/zai-org/GLM-5", name: "GLM-5", caps: { vision: false, coding: true, tools: "partial", files: true, reasoning: true, fast: "partial" }, costTier: "$", context: "128K" },
      { id: "huggingface/XiaomiMiMo/MiMo-V2-Flash", name: "MiMo-V2-Flash", caps: { vision: false, coding: true, tools: "partial", files: true, reasoning: true, fast: true }, costTier: "$", context: "128K" },
      { id: "huggingface/MiniMaxAI/MiniMax-M2.5", name: "MiniMax-M2.5", caps: { vision: false, coding: true, tools: "partial", files: true, reasoning: true, fast: true }, costTier: "$", context: "1M" },
    ],
  },
  ollama: {
    models: [
      { id: "ollama/devstral-small-2:24b-cloud", name: "Devstral-24B", caps: { vision: false, coding: true, tools: true, files: true, reasoning: false, fast: true }, costTier: "$", context: "128K" },
      { id: "ollama/gemma4:31b-cloud", name: "Gemma4-31B", caps: { vision: false, coding: "partial", tools: true, files: "partial", reasoning: false, fast: true }, costTier: "$", context: "128K" },
      { id: "ollama/glm-5:cloud", name: "GLM-5", caps: { vision: false, coding: true, tools: true, files: true, reasoning: true, fast: "partial" }, costTier: "$", context: "128K" },
      { id: "ollama/kimi-k2.5:cloud", name: "Kimi-K2.5", caps: { vision: true, coding: true, tools: true, files: true, reasoning: true, fast: false }, costTier: "$", context: "256K" },
      { id: "ollama/ministral-3:14b-cloud", name: "Ministral-14B", caps: { vision: false, coding: "partial", tools: "partial", files: "partial", reasoning: false, fast: true }, costTier: "$", context: "128K" },
      { id: "ollama/minimax-m2.5:cloud", name: "MiniMax-M2.5", caps: { vision: false, coding: true, tools: true, files: true, reasoning: true, fast: true }, costTier: "$", context: "1M" },
      { id: "ollama/mistral-large-3:675b-cloud", name: "Mistral-Large-675B", caps: { vision: false, coding: true, tools: true, files: true, reasoning: true, fast: false }, costTier: "$$", context: "128K" },
      { id: "ollama/nemotron-3-super:cloud", name: "Nemotron-3-Super", caps: { vision: false, coding: true, tools: true, files: true, reasoning: true, fast: true }, costTier: "$", context: "262K" },
      { id: "ollama/qwen3-coder-next:cloud", name: "Qwen3-Coder-Next", caps: { vision: false, coding: true, tools: true, files: true, reasoning: false, fast: true }, costTier: "$", context: "128K" },
      { id: "ollama/qwen3-vl:235b-instruct-cloud", name: "Qwen3-VL-235B", caps: { vision: true, coding: true, tools: true, files: true, reasoning: false, fast: "partial" }, costTier: "$$", context: "128K" },
    ],
  },
  opencode: {
    models: [
      { id: "opencode/claude-opus-4-7", name: "Claude Opus 4.7", caps: { vision: true, coding: true, tools: true, files: true, reasoning: true, fast: false }, costTier: "$$$", context: "200K" },
      { id: "opencode/claude-sonnet-4-6", name: "Claude Sonnet 4.6", caps: { vision: true, coding: true, tools: true, files: true, reasoning: true, fast: true }, costTier: "$$$", context: "200K" },
      { id: "opencode/gemini-3-flash", name: "Gemini 3 Flash", caps: { vision: true, coding: true, tools: true, files: true, reasoning: true, fast: true }, costTier: "$", context: "1M" },
      { id: "opencode/gemini-3.1-pro", name: "Gemini 3.1 Pro", caps: { vision: true, coding: true, tools: true, files: true, reasoning: true, fast: true }, costTier: "$$", context: "1M" },
      { id: "opencode/glm-5", name: "GLM-5", caps: { vision: false, coding: true, tools: true, files: true, reasoning: true, fast: "partial" }, costTier: "$", context: "128K" },
      { id: "opencode/gpt-5.4", name: "GPT-5.4", caps: { vision: true, coding: true, tools: true, files: true, reasoning: true, fast: true }, costTier: "$$", context: "128K" },
      { id: "opencode/gpt-5.4-mini", name: "GPT-5.4 Mini", caps: { vision: true, coding: true, tools: true, files: true, reasoning: true, fast: true }, costTier: "$", context: "128K" },
      { id: "opencode/gpt-5.4-nano", name: "GPT-5.4 Nano", caps: { vision: true, coding: "partial", tools: true, files: "partial", reasoning: false, fast: true }, costTier: "$", context: "128K" },
      { id: "opencode/kimi-k2.5", name: "Kimi-K2.5", caps: { vision: true, coding: true, tools: true, files: true, reasoning: true, fast: false }, costTier: "$", context: "256K" },
      { id: "opencode/minimax-m2.5", name: "MiniMax-M2.5", caps: { vision: false, coding: true, tools: true, files: true, reasoning: true, fast: true }, costTier: "$", context: "1M" },
      { id: "opencode/minimax-m2.5-free", name: "MiniMax-M2.5 Free", caps: { vision: false, coding: true, tools: true, files: true, reasoning: true, fast: true }, costTier: "Free", context: "1M" },
      { id: "opencode/nemotron-3-super-free", name: "Nemotron-3 Free", caps: { vision: false, coding: true, tools: true, files: true, reasoning: true, fast: true }, costTier: "Free", context: "262K" },
    ],
  },
  "opencode-go": {
    models: [
      { id: "opencode-go/glm-5", name: "GLM-5", caps: { vision: false, coding: true, tools: true, files: true, reasoning: true, fast: "partial" }, costTier: "$", context: "128K" },
      { id: "opencode-go/kimi-k2.5", name: "Kimi-K2.5", caps: { vision: true, coding: true, tools: true, files: true, reasoning: true, fast: false }, costTier: "$", context: "256K" },
      { id: "opencode-go/minimax-m2.5", name: "MiniMax-M2.5", caps: { vision: false, coding: true, tools: true, files: true, reasoning: true, fast: true }, costTier: "$", context: "1M" },
      { id: "opencode-go/minimax-m2.7", name: "MiniMax-M2.7", caps: { vision: false, coding: true, tools: true, files: true, reasoning: true, fast: true }, costTier: "$", context: "1M" },
    ],
  },
  openrouter: {
    models: [
      { id: "openrouter/anthropic/claude-opus-4.7", name: "Claude Opus 4.7", caps: { vision: true, coding: true, tools: true, files: true, reasoning: true, fast: false }, costTier: "$$$", context: "200K" },
      { id: "openrouter/anthropic/claude-sonnet-4.6", name: "Claude Sonnet 4.6", caps: { vision: true, coding: true, tools: true, files: true, reasoning: true, fast: true }, costTier: "$$$", context: "200K" },
      { id: "openrouter/deepseek/deepseek-v3.2", name: "DeepSeek-V3.2", caps: { vision: false, coding: true, tools: true, files: true, reasoning: true, fast: "partial" }, costTier: "$", context: "128K" },
      { id: "openrouter/google/gemini-3-flash-preview", name: "Gemini 3 Flash", caps: { vision: true, coding: true, tools: true, files: true, reasoning: true, fast: true }, costTier: "$", context: "1M" },
      { id: "openrouter/google/gemini-3.1-pro-preview", name: "Gemini 3.1 Pro", caps: { vision: true, coding: true, tools: true, files: true, reasoning: true, fast: true }, costTier: "$$", context: "1M" },
      { id: "openrouter/google/gemini-3.1-pro-preview-customtools", name: "Gemini 3.1 Custom", caps: { vision: true, coding: true, tools: true, files: true, reasoning: true, fast: true }, costTier: "$$", context: "1M" },
      { id: "openrouter/minimax/minimax-m2.5", name: "MiniMax-M2.5", caps: { vision: false, coding: true, tools: true, files: true, reasoning: true, fast: true }, costTier: "$", context: "1M" },
      { id: "openrouter/minimax/minimax-m2.5:free", name: "MiniMax-M2.5 Free", caps: { vision: false, coding: true, tools: true, files: true, reasoning: true, fast: true }, costTier: "Free", context: "1M" },
      { id: "openrouter/minimax/minimax-m2.7", name: "MiniMax-M2.7", caps: { vision: false, coding: true, tools: true, files: true, reasoning: true, fast: true }, costTier: "$", context: "1M" },
      { id: "openrouter/nvidia/nemotron-3-super-120b-a12b", name: "Nemotron-3 Super", caps: { vision: false, coding: true, tools: true, files: true, reasoning: true, fast: true }, costTier: "$", context: "262K" },
      { id: "openrouter/nvidia/nemotron-3-super-120b-a12b:free", name: "Nemotron-3 Free", caps: { vision: false, coding: true, tools: true, files: true, reasoning: true, fast: true }, costTier: "Free", context: "262K" },
      { id: "openrouter/nvidia/nemotron-nano-12b-v2-vl:free", name: "Nemotron Nano VL", caps: { vision: true, coding: "partial", tools: true, files: "partial", reasoning: true, fast: true }, costTier: "Free", context: "128K" },
      { id: "openrouter/nvidia/nemotron-nano-9b-v2:free", name: "Nemotron Nano 9B", caps: { vision: false, coding: "partial", tools: true, files: "partial", reasoning: "partial", fast: true }, costTier: "Free", context: "128K" },
      { id: "openrouter/nvidia/nemotron-3-nano-30b-a3b:free", name: "Nemotron Nano 30B", caps: { vision: false, coding: "partial", tools: true, files: "partial", reasoning: "partial", fast: true }, costTier: "Free", context: "128K" },
      { id: "openrouter/openai/gpt-5.4", name: "GPT-5.4", caps: { vision: true, coding: true, tools: true, files: true, reasoning: true, fast: true }, costTier: "$$", context: "128K" },
      { id: "openrouter/openai/gpt-5.4-mini", name: "GPT-5.4 Mini", caps: { vision: true, coding: true, tools: true, files: true, reasoning: true, fast: true }, costTier: "$", context: "128K" },
      { id: "openrouter/openai/gpt-5.4-nano", name: "GPT-5.4 Nano", caps: { vision: true, coding: "partial", tools: true, files: "partial", reasoning: false, fast: true }, costTier: "$", context: "128K" },
      { id: "openrouter/openai/gpt-oss-120b", name: "GPT-OSS-120B", caps: { vision: false, coding: true, tools: true, files: true, reasoning: true, fast: true }, costTier: "$", context: "128K" },
      { id: "openrouter/openai/gpt-oss-120b:free", name: "GPT-OSS-120B Free", caps: { vision: false, coding: true, tools: true, files: true, reasoning: true, fast: true }, costTier: "Free", context: "128K" },
      { id: "openrouter/qwen/qwen3-coder-next", name: "Qwen3-Coder-Next", caps: { vision: false, coding: true, tools: true, files: true, reasoning: false, fast: true }, costTier: "$", context: "128K" },
      { id: "openrouter/qwen/qwen3-coder:free", name: "Qwen3-Coder Free", caps: { vision: false, coding: true, tools: true, files: true, reasoning: false, fast: true }, costTier: "Free", context: "128K" },
      { id: "openrouter/qwen/qwen3-next-80b-a3b-instruct:free", name: "Qwen3-Next-80B", caps: { vision: false, coding: true, tools: true, files: true, reasoning: false, fast: true }, costTier: "Free", context: "128K" },
      { id: "openrouter/qwen/qwen3-vl-8b-instruct", name: "Qwen3-VL-8B", caps: { vision: true, coding: "partial", tools: true, files: "partial", reasoning: false, fast: true }, costTier: "$", context: "128K" },
      { id: "openrouter/qwen/qwen3.6-plus:free", name: "Qwen3.6-Plus", caps: { vision: false, coding: true, tools: true, files: true, reasoning: true, fast: true }, costTier: "Free", context: "128K" },
      { id: "openrouter/x-ai/grok-4-fast", name: "Grok-4 Fast", caps: { vision: true, coding: true, tools: true, files: true, reasoning: true, fast: true }, costTier: "$$", context: "2M" },
      { id: "openrouter/z-ai/glm-4.5-air:free", name: "GLM-4.5 Air", caps: { vision: false, coding: "partial", tools: true, files: "partial", reasoning: "partial", fast: true }, costTier: "Free", context: "128K" },
      { id: "openrouter/z-ai/glm-5", name: "GLM-5", caps: { vision: false, coding: true, tools: true, files: true, reasoning: true, fast: "partial" }, costTier: "$", context: "128K" },
      { id: "openrouter/z-ai/glm-5-turbo", name: "GLM-5 Turbo", caps: { vision: false, coding: true, tools: true, files: true, reasoning: true, fast: true }, costTier: "$", context: "128K" },
      { id: "openrouter/auto", name: "Auto Router", caps: { vision: "partial", coding: "partial", tools: true, files: "partial", reasoning: "partial", fast: "partial" }, costTier: "$$", context: "varies" },
    ],
  },
  venice: {
    models: [
      { id: "venice/claude-opus-4-7", name: "Claude Opus 4.7", caps: { vision: true, coding: true, tools: true, files: true, reasoning: true, fast: false }, costTier: "$$$", context: "200K" },
      { id: "venice/claude-sonnet-4-6", name: "Claude Sonnet 4.6", caps: { vision: true, coding: true, tools: true, files: true, reasoning: true, fast: true }, costTier: "$$$", context: "200K" },
      { id: "venice/deepseek-v3.2", name: "DeepSeek-V3.2", caps: { vision: false, coding: true, tools: true, files: true, reasoning: true, fast: "partial" }, costTier: "$", context: "128K" },
      { id: "venice/gemini-3-1-pro-preview", name: "Gemini 3.1 Pro", caps: { vision: true, coding: true, tools: true, files: true, reasoning: true, fast: true }, costTier: "$$", context: "1M" },
      { id: "venice/gemini-3-pro-preview", name: "Gemini 3 Pro", caps: { vision: true, coding: true, tools: true, files: true, reasoning: true, fast: true }, costTier: "$$", context: "1M" },
      { id: "venice/google-gemma-3-27b-it", name: "Gemma-3-27B", caps: { vision: false, coding: "partial", tools: "partial", files: "partial", reasoning: false, fast: true }, costTier: "$", context: "128K" },
      { id: "venice/grok-41-fast", name: "Grok-4.1 Fast", caps: { vision: true, coding: true, tools: true, files: true, reasoning: true, fast: true }, costTier: "$", context: "2M" },
      { id: "venice/grok-code-fast-1", name: "Grok Code Fast", caps: { vision: false, coding: true, tools: true, files: true, reasoning: false, fast: true }, costTier: "$", context: "128K" },
      { id: "venice/hermes-3-llama-3.1-405b", name: "Hermes-3-405B", caps: { vision: false, coding: true, tools: true, files: true, reasoning: true, fast: false }, costTier: "$$", context: "128K" },
      { id: "venice/kimi-k2-5", name: "Kimi-K2.5", caps: { vision: true, coding: true, tools: true, files: true, reasoning: true, fast: false }, costTier: "$", context: "256K" },
      { id: "venice/kimi-k2-thinking", name: "Kimi-K2 Thinking", caps: { vision: false, coding: true, tools: true, files: true, reasoning: true, fast: false }, costTier: "$", context: "256K" },
      { id: "venice/llama-3.3-70b", name: "Llama-3.3-70B", caps: { vision: false, coding: true, tools: "partial", files: true, reasoning: false, fast: true }, costTier: "$", context: "125K" },
      { id: "venice/minimax-m25", name: "MiniMax-M2.5", caps: { vision: false, coding: true, tools: true, files: true, reasoning: true, fast: true }, costTier: "$", context: "1M" },
      { id: "venice/mistral-31-24b", name: "Mistral-3.1-24B", caps: { vision: false, coding: true, tools: "partial", files: true, reasoning: false, fast: true }, costTier: "$", context: "128K" },
      { id: "venice/nvidia-nemotron-3-nano-30b-a3b", name: "Nemotron Nano 30B", caps: { vision: false, coding: "partial", tools: true, files: "partial", reasoning: "partial", fast: true }, costTier: "$", context: "128K" },
      { id: "venice/olafangensan-glm-4.7-flash-heretic", name: "GLM-4.7 Heretic", caps: { vision: false, coding: true, tools: true, files: true, reasoning: true, fast: true }, costTier: "$", context: "200K" },
      { id: "venice/openai-gpt-53-codex", name: "GPT-5.3 Codex", caps: { vision: false, coding: true, tools: true, files: true, reasoning: true, fast: true }, costTier: "$$", context: "128K" },
      { id: "venice/openai-gpt-54", name: "GPT-5.4", caps: { vision: true, coding: true, tools: true, files: true, reasoning: true, fast: true }, costTier: "$$", context: "128K" },
      { id: "venice/openai-gpt-oss-120b", name: "GPT-OSS-120B", caps: { vision: false, coding: true, tools: true, files: true, reasoning: true, fast: true }, costTier: "$", context: "128K" },
      { id: "venice/qwen3-235b-a22b-instruct-2507", name: "Qwen3-235B", caps: { vision: false, coding: true, tools: true, files: true, reasoning: false, fast: true }, costTier: "$", context: "128K" },
      { id: "venice/qwen3-235b-a22b-thinking-2507", name: "Qwen3-235B Think", caps: { vision: false, coding: true, tools: true, files: true, reasoning: true, fast: "partial" }, costTier: "$", context: "128K" },
      { id: "venice/qwen3-4b", name: "Qwen3-4B", caps: { vision: false, coding: "partial", tools: "partial", files: "partial", reasoning: false, fast: true }, costTier: "$", context: "32K" },
      { id: "venice/qwen3-5-35b-a3b", name: "Qwen3.5-35B", caps: { vision: false, coding: true, tools: true, files: true, reasoning: "partial", fast: true }, costTier: "$", context: "128K" },
      { id: "venice/qwen3-coder-480b-a35b-instruct", name: "Qwen3-Coder-480B", caps: { vision: false, coding: true, tools: true, files: true, reasoning: false, fast: false }, costTier: "$$", context: "128K" },
      { id: "venice/qwen3-coder-480b-a35b-instruct-turbo", name: "Coder-480B Turbo", caps: { vision: false, coding: true, tools: true, files: true, reasoning: false, fast: true }, costTier: "$$", context: "128K" },
      { id: "venice/qwen3-next-80b", name: "Qwen3-Next-80B", caps: { vision: false, coding: true, tools: true, files: true, reasoning: true, fast: true }, costTier: "$", context: "128K" },
      { id: "venice/qwen3-vl-235b-a22b", name: "Qwen3-VL-235B", caps: { vision: true, coding: true, tools: true, files: true, reasoning: true, fast: "partial" }, costTier: "$$", context: "128K" },
      { id: "venice/venice-uncensored", name: "Venice Uncensored", caps: { vision: false, coding: true, tools: true, files: true, reasoning: true, fast: true }, costTier: "$", context: "128K" },
      { id: "venice/zai-org-glm-4.7", name: "GLM-4.7", caps: { vision: false, coding: true, tools: true, files: true, reasoning: true, fast: true }, costTier: "$", context: "200K" },
      { id: "venice/zai-org-glm-4.7-flash", name: "GLM-4.7 Flash", caps: { vision: false, coding: true, tools: true, files: true, reasoning: true, fast: true }, costTier: "$", context: "200K" },
      { id: "venice/zai-org-glm-5", name: "GLM-5", caps: { vision: false, coding: true, tools: true, files: true, reasoning: true, fast: "partial" }, costTier: "$", context: "128K" },
    ],
  },
};

// Process models with explicit capabilities from cheatsheet

const capsFromCatalogModel = (model) => ({
  vision: Array.isArray(model?.input) ? model.input.includes("image") || model.input.includes("vision") : /vision|vl|4o|gemini|claude/i.test(model?.id || ""),
  coding: /code|coder|codex|qwen|deepseek|claude|gpt/i.test(model?.id || ""),
  tools: !!model?.toolCompatible,
  files: true,
  reasoning: !!model?.reasoning || /thinking|reasoning|r1|opus|gpt|claude/i.test(model?.id || ""),
  fast: /fast|mini|flash|turbo/i.test(model?.id || ""),
});

const ROUTE_PROVIDERS = new Set([
  "venice", "openrouter", "ollama", "huggingface", "siliconflow",
  "opencode", "opencode-go", "google-gemini-cli", "openai-codex",
]);

const looksLikeRawId = (s) => {
  if (!s || typeof s !== "string") return true;
  // raw IDs: contain '/', start with route provider, are entirely lowercase-with-dashes/colons
  if (s.includes("/")) return true;
  if (/^[a-z0-9]+(?:[-:.][a-z0-9]+)+$/i.test(s)) return true;
  // a "real" name has at least one space OR a colon-with-space pattern OR an internal capital
  const hasSpace = /\s/.test(s);
  const hasInternalCap = /[a-z][A-Z]/.test(s);
  return !hasSpace && !hasInternalCap;
};

const MAKER_LABELS = {
  openai: "OpenAI", anthropic: "Anthropic", google: "Google",
  meta: "Meta", "meta-llama": "Meta", "x-ai": "xAI", xai: "xAI",
  "z-ai": "Z.AI", "zai-org": "Z.AI", qwen: "Qwen", deepseek: "DeepSeek",
  "deepseek-ai": "DeepSeek", mistralai: "Mistral", mistral: "Mistral",
  moonshotai: "Moonshot", moonshot: "Moonshot",
  minimaxai: "MiniMax", minimax: "MiniMax",
  nvidia: "Nvidia", stepfun: "Stepfun",
  cognitivecomputations: "Dolphin", nous: "Nous", "nous-research": "Nous",
  hermes: "Hermes",
};

const prettifyMaker = (m) => MAKER_LABELS[m?.toLowerCase()] ?? m;

// Map a model basename to maker + remainder when no explicit maker prefix exists.
// e.g. "openai-gpt-55-pro" → { maker: "openai", rest: "gpt-5.5-pro" }
//      "claude-opus-4-7"  → { maker: "anthropic", rest: "claude-opus-4.7" }
//      "kimi-k2-6"        → { maker: "moonshot", rest: "kimi-k2.6" }
const inferMakerFromBase = (base) => {
  const s = String(base || "").toLowerCase();
  if (s.startsWith("openai-")) return { maker: "openai", rest: s.replace(/^openai-/, "") };
  if (s.startsWith("claude")) return { maker: "anthropic", rest: s };
  if (s.startsWith("gpt")) return { maker: "openai", rest: s };
  if (s.startsWith("kimi")) return { maker: "moonshot", rest: s };
  if (s.startsWith("qwen")) return { maker: "qwen", rest: s };
  if (s.startsWith("deepseek")) return { maker: "deepseek", rest: s };
  if (s.startsWith("gemini")) return { maker: "google", rest: s };
  if (s.startsWith("gemma")) return { maker: "google", rest: s };
  if (s.startsWith("grok")) return { maker: "xai", rest: s };
  if (s.startsWith("llama")) return { maker: "meta", rest: s };
  if (s.startsWith("mistral") || s.startsWith("ministral") || s.startsWith("devstral")) return { maker: "mistral", rest: s };
  if (s.startsWith("hermes")) return { maker: "nous", rest: s };
  if (s.startsWith("nemotron") || s.startsWith("nvidia-")) return { maker: "nvidia", rest: s.replace(/^nvidia-/, "") };
  if (s.startsWith("glm") || s.includes("zai-org-glm") || s.startsWith("z-ai-glm")) return { maker: "zai-org", rest: s.replace(/^zai-org-/, "").replace(/^z-ai-/, "") };
  if (s.startsWith("minimax")) return { maker: "minimax", rest: s };
  return { maker: null, rest: s };
};

// Restore version dots that route providers stripped:
//   "gpt-55"     → "GPT-5.5"
//   "gpt-54-pro" → "GPT-5.4 Pro"
//   "k2-6"       → "K2.6"
//   "claude-opus-4-7" → "Claude Opus 4.7"
//   "claude-sonnet-4-5" → "Claude Sonnet 4.5"
//   "minimax-m25"  → "MiniMax M2.5"
const reinsertVersionDots = (s) => {
  let out = s;
  // gpt-NN(-suffix)? where NN is two digits → split into N.N
  out = out.replace(/\bgpt[-\s]+(\d)(\d)(\b|[-\s])/gi, "GPT-$1.$2$3");
  // claude/opus/sonnet/haiku N-N → N.N
  out = out.replace(/\b(claude|opus|sonnet|haiku)([-\s]+)(\d+)[-\s]+(\d+)(\b|[-\s])/gi,
    (_m, name, sep, a, b, after) => `${name}${sep}${a}.${b}${after}`);
  // kimi-kN-N → K N.N
  out = out.replace(/\bkimi[-\s]+k(\d+)[-\s]+(\d+)\b/gi, "Kimi K$1.$2");
  // glm 4 7 / glm-4-7 → GLM-4.7  (only if both sides are single digits)
  out = out.replace(/\bglm[-\s]+(\d+)[-\s]+(\d+)\b/gi, "GLM-$1.$2");
  // hermes 3 405b stays as-is
  // grok-41-fast → Grok-4.1 Fast
  out = out.replace(/\bgrok[-\s]+(\d)(\d)([-\s])/gi, "Grok-$1.$2$3");
  // grok-4-20 → Grok-4.20
  out = out.replace(/\bgrok[-\s]+(\d+)[-\s]+(\d+)\b/gi, "Grok-$1.$2");
  // qwen3-235b/qwen3-coder etc — keep "Qwen3"
  out = out.replace(/\bqwen(\d+)\b/gi, "Qwen$1");
  // minimax-mNN → MiniMax MN.N
  out = out.replace(/\bminimax[-\s]+m(\d)(\d)\b/gi, "MiniMax M$1.$2");
  return out;
};

const prettifyModelName = (raw, providerHint) => {
  if (!raw) return "";
  let s = String(raw);

  // Strip slashed prefixes; remember the *non-route* maker if present.
  const parts = s.split("/").filter(Boolean);
  let maker = null;
  if (parts.length >= 2) {
    // last two segments: maker / model OR provider / model
    const cand = parts[parts.length - 2].replace(/^~/, "");
    if (!ROUTE_PROVIDERS.has(cand.toLowerCase())) maker = cand;
    s = parts[parts.length - 1];
  } else if (parts.length === 1) {
    s = parts[0];
  }

  // Drop trailing route flavours and any colon-suffixed flavour ("foo:cloud", "bar:480b-cloud")
  s = s.replace(/:(free|cloud|turbo|preview|beta|customtools)\b/gi, "");
  s = s.replace(/:([a-z0-9.\-]+?)(?=$|[^a-z0-9.\-])/gi, (_m, tail) => `-${tail}`);

  // Drop activation-parameter noise like "-a35b-" / "-a22b-" left over from MoE model names
  s = s.replace(/-a\d+b\b/gi, "");
  // Drop trailing "-instruct" / "-it" (instruction-tuned variants are the default for chat catalog)
  s = s.replace(/-(instruct|it)\b/gi, "");

  // If we don't yet know a maker, try inferring it from the basename
  if (!maker) {
    const inferred = inferMakerFromBase(s);
    if (inferred.maker) {
      maker = inferred.maker;
      s = inferred.rest;
    }
  }

  // dashes to spaces
  s = s.replace(/-/g, " ");

  // re-insert version dots stripped by route providers
  s = reinsertVersionDots(s);

  // common acronyms
  s = s.replace(/\b(gpt|glm|llm|moe|api|llama|mmlu|qwen|sdk|cli|vl|oss|tts|nlp)\b/gi, (m) => m.toUpperCase());

  // billions: "70b" → "70B", "480b" → "480B", "405b" → "405B"
  s = s.replace(/\b(\d+)b\b/g, "$1B");

  // capitalise leading words
  s = s.replace(/\b([a-z])/g, (m) => m.toUpperCase());

  // brand re-capitalisations the leading-letter pass mangles
  s = s.replace(/\bDeepseek\b/g, "DeepSeek");
  s = s.replace(/\bMoonshot\b/g, "Moonshot");
  s = s.replace(/\bMinimax\b/g, "MiniMax");
  s = s.replace(/\bOpenai\b/g, "OpenAI");

  // collapse multiple spaces
  s = s.replace(/\s+/g, " ").trim();

  // never show route provider as maker
  const makerLabel = maker && !ROUTE_PROVIDERS.has(String(maker).toLowerCase())
    ? prettifyMaker(maker)
    : null;

  // Avoid stutter: if model already starts with maker (e.g. "OpenAI" + "OpenAI GPT 5.5"), drop dup.
  if (makerLabel) {
    const lower = s.toLowerCase();
    const makerLower = makerLabel.toLowerCase();
    if (lower.startsWith(makerLower)) return s;
    // GPT models repeat OpenAI implicitly — fold maker in cleanly
    return `${makerLabel}: ${s}`;
  }
  return s;
};

const normalizeCatalogModel = (model, group = "recommendedLive") => {
  const id = model?.id || `${model?.provider || "unknown"}/${model?.sourceId || model?.resolvedId || "model"}`;
  // Use backend displayName only if it actually looks like a human label;
  // otherwise prettify the source id ourselves.
  const backendName = model?.displayName || model?.name;
  const usable = backendName && !looksLikeRawId(backendName);
  const name = usable
    ? backendName
    : prettifyModelName(model?.sourceId || id);
  const context = model?.contextWindow
    ? formatContext(model.contextWindow)
    : model?.context || null;
  return {
    ...model,
    id,
    name,
    displayName: name,
    rawId: model?.sourceId || id,
    provider: model?.provider || id.split("/")[0] || "unknown",
    group,
    caps: model?.caps || capsFromCatalogModel(model),
    costTier: model?.costTier || null,
    context,
    disabled: !model?.adapterReady || ["planned_cli", "configured_only", "excluded"].includes(model?.routeMode),
    disabledReason: model?.reason || (!model?.adapterReady ? "Provider bridge pending" : ""),
  };
};

const providersFromGroups = (groups) => {
  const orderedGroups = ["recommendedLive", "localOllama", "subscriptionCli", "configuredUnavailable", "hiddenLive"];
  const providerOrder = [
    "venice", "openrouter", "ollama", "huggingface",
    "anthropic", "openai-codex", "google-gemini-cli", "opencode", "opencode-go",
    "hermes", "nous",
  ];
  const byProvider = new Map();
  const seen = new Set();

  for (const group of orderedGroups) {
    const list = Array.isArray(groups?.[group]) ? groups[group] : [];
    for (const raw of list) {
      const model = normalizeCatalogModel(raw, group);
      if (seen.has(model.id)) continue;
      seen.add(model.id);
      const provider = model.provider || "unknown";
      if (!byProvider.has(provider)) {
        byProvider.set(provider, { name: provider, key: provider, count: 0, models: [] });
      }
      byProvider.get(provider).models.push(model);
    }
  }

  return Array.from(byProvider.values())
    .map((provider) => ({ ...provider, count: provider.models.length }))
    .sort((a, b) => {
      const ai = providerOrder.indexOf(a.name);
      const bi = providerOrder.indexOf(b.name);
      if (ai !== -1 || bi !== -1) return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
      return a.name.localeCompare(b.name);
    });
};

const processModels = () => {
  const models = [];
  Object.entries(MODEL_PROVIDERS_DATA).forEach(([provider, data]) => {
    data.models.forEach(model => {
      models.push({
        ...model,
        provider,
        caps: model.caps || deriveCapabilities(model.id),
        costTier: model.costTier || deriveCostTier(model.id),
        context: model.context || null,
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
      caps: m.caps || deriveCapabilities(m.id),
      costTier: m.costTier || deriveCostTier(m.id),
      context: m.context || null,
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
const DEFAULT_SPACES = [
  { id: "space-files", name: "Files", description: "Documents and reports", icon: "FileText", color: "#3b82f6" },
  { id: "space-design", name: "Design", description: "Creative and visual work", icon: "PenTool", color: "#ec4899" },
  { id: "space-dev", name: "Development", description: "Code, builds, and dev jobs", icon: "Code2", color: "#22c55e" },
];

// ─── Auto-routing: keyword → space mapping ──────────────────────────────────
const ROUTE_KEYWORDS = {
  "space-dev": ["code","debug","function","api","deploy","build","test","git","npm","python","javascript","react","server","database","sql","bug","error","compile","runtime","backend","frontend","devops","docker","kubernetes","typescript","webpack","node","terminal","command","script","algorithm","refactor","merge","branch","commit","pull request"],
  "space-design": ["design","ui","ux","color","layout","figma","font","typography","mockup","wireframe","prototype","responsive","css","style","animation","visual","brand","logo","icon","illustration","sketch","photoshop","illustrator","palette","gradient","pixel","grid","spacing"],
  "space-files": ["file","document","report","pdf","spreadsheet","excel","csv","import","export","upload","download","backup","archive","folder","organize","rename","storage","attachment","doc","sheet","slide","presentation","template","invoice","receipt","contract"],
};

function autoRouteThread(text) {
  const lower = text.toLowerCase();
  let bestSpace = null;
  let bestScore = 0;
  for (const [spaceId, keywords] of Object.entries(ROUTE_KEYWORDS)) {
    const score = keywords.reduce((s, kw) => s + (lower.includes(kw) ? 1 : 0), 0);
    if (score > bestScore) { bestScore = score; bestSpace = spaceId; }
  }
  return bestScore >= 1 ? bestSpace : null;
}

// ─── Zustand store ───────────────────────────────────────────────────────────
export const useGateway = create(
  persist(
    (set, get) => ({
      // Connection state
      status: "connecting",
      phase: "idle",
      lastError: null,

      // Runtime state
      // Frozen single-runtime values — kept in store so any straggler reads
      // don't crash. Treat as read-only constants.
      activeRuntime: DEFAULT_RUNTIME,
      runtimeMeta: RUNTIME_META,
      // ── (Hermes/Meta runtimes removed 2026-05-05; single-bot mode) ──
      chatParameters: {
        temperature: 0.1,
        top_p: 0.3,
        top_k: 40,
        max_tokens: 8192,
        frequency_penalty: 0.2,
        presence_penalty: 0.1,
      },
      // Per-parameter lock — if true, resetChatParameters keeps that value.
      lockedParameters: {
        temperature: false,
        top_p: false,
        top_k: false,
        max_tokens: false,
        frequency_penalty: false,
        presence_penalty: false,
      },
      // Voice / playback (UI-only for now, sent with every chat frame as `options`).
      voiceSettings: {
        ttsVoice: "Emma",
        conversationVoice: "Eve",
        playbackSpeed: 1,
      },
      // When true, backend skips injecting the runtime persona/system prompt.
      disableSystemPrompt: false,
      
      // Models
      models: processModels(),
      providers: getProviders(),
      modelGroups: null,
      modelProvidersStatus: [],
      modelsLoading: false,
      modelsError: null,
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
      
      // Connectors state (all OFF by default — connect in Settings)
      connectors: {
        mac: false,
        desktop: false,
        files: false,
        web: false,
        signal: false,
        telegram: false,
        vscode: false,
        figma: false,
        slack: false,
        chrome: false,
        docker: false,
        notion: false,
      },
      
      // Skills state  
      enabledSkills: [],
      
      // Style
      writingStyle: "Normal",
      
      // Web search
      webSearchEnabled: false,
      
      // Tool access
      toolAccess: "lazy",
      
      // Data controls
      dataControls: { saveHistory: true, usageData: false, memoryEnabled: true },
      
      // Security
      security: { twoFactor: false },
      
      // Plugins
      plugins: [
        { id: "code-interpreter", name: "Code Interpreter", desc: "Execute Python, JS, and shell commands in sandbox", installed: true, category: "Tools" },
        { id: "web-pilot", name: "Web Pilot", desc: "Browse, extract, and summarize web content", installed: false, category: "Tools" },
        { id: "doc-parser", name: "Doc Parser", desc: "Parse PDFs, Word docs, and spreadsheets", installed: false, category: "Tools" },
        { id: "image-gen", name: "Image Generator", desc: "Create images from text descriptions", installed: false, category: "Creative" },
        { id: "diagram-maker", name: "Diagram Maker", desc: "Generate flowcharts, sequence diagrams, ERDs", installed: true, category: "Creative" },
        { id: "git-assistant", name: "Git Assistant", desc: "PR reviews, commit messages, branch management", installed: false, category: "Dev" },
        { id: "db-query", name: "DB Query", desc: "Run SQL queries against connected databases", installed: false, category: "Dev" },
        { id: "api-tester", name: "API Tester", desc: "Test REST/GraphQL endpoints with auto-docs", installed: false, category: "Dev" },
        { id: "productivity-suite", name: "Productivity", desc: "Task management and context building", installed: false, category: "Workflow" },
        { id: "design-suite", name: "Design", desc: "Design workflows and UX tools", installed: false, category: "Creative" },
        { id: "marketing-suite", name: "Marketing", desc: "Content and campaign management", installed: false, category: "Workflow" },
        { id: "data-suite", name: "Data", desc: "SQL, datasets, and visualizations", installed: false, category: "Tools" },
        { id: "engineering-suite", name: "Engineering", desc: "Engineering workflow tools", installed: false, category: "Tools" },
        { id: "finance-suite", name: "Finance", desc: "Finance and accounting workflows", installed: false, category: "Workflow" },
        { id: "product-mgmt", name: "Product management", desc: "Specs, roadmaps, and research", installed: false, category: "Workflow" },
        { id: "operations-suite", name: "Operations", desc: "Business operations optimization", installed: false, category: "Workflow" },
        { id: "legal-suite", name: "Legal", desc: "Contract review and compliance", installed: false, category: "Workflow" },
        { id: "sales-suite", name: "Sales", desc: "Pipeline and CRM workflows", installed: false, category: "Workflow" },
      ],
      
      // MCP Servers
      mcpServers: [],
      
      // API Keys
      apiKeys: [],
      
      // Custom items (user-created)
      customSkills: [],
      customConnectors: [],
      customPlugins: [],
      
      // Active page/tab
      activePage: "chat",
      activeTab: "chat",
      
      // Jobs
      jobs: MOCK_JOBS,
      
      // Approvals
      approvals: MOCK_APPROVALS,
      approvalHistory: [],
      approvalsLoading: false,
      approvalsBackend: "mock",
      approvalModesBySession: {},
      approvalsWsConnected: false,

      // Agent runtime (planner/executor/supervisor/auditor/watcher/builder/meta)
      agentTasks: [],
      agentTasksLoading: false,
      agentTasksError: null,
      agentTasksLastUpdated: null,
      agentSubmitting: false,
      agentFilter: "all", // all | planner | executor | supervisor | auditor | watcher | builder | meta | pipeline

      // Agent lifecycle control — pause/resume/stop/start each agent loop.
      // GET /api/v2/agents/control → { agents: { watcher: 'running', ... } }
      // POST same with { agent, action } → state transition + WS broadcast.
      // Persisted server-side in agent_control SQLite table.
      agentControl: {},               // { agent: 'running'|'paused'|'stopped' }
      agentControlLoading: false,
      agentControlError: null,
      agentControlLastUpdated: null,
      // Set of agent ids with an in-flight POST; UI uses this to disable
      // duplicate clicks until the response (or WS echo) lands.
      pendingAgentControls: [],

      // System (host telemetry)
      // Per BACKEND_REQUESTS.md: server caches stats 2s / services 5s / apps 5min.
      // Frontend polls stats 3s, services 5s, apps on demand. All paused on hidden.
      systemServices: [],
      systemServicesLoading: false,
      systemServicesError: null,
      systemServicesLastUpdated: null,

      systemStats: null,
      systemStatsLoading: false,
      systemStatsError: null,
      systemStatsLastUpdated: null,

      systemApps: [],
      systemAppsByCategory: null,
      systemAppsCount: 0,
      systemAppsLoading: false,
      systemAppsError: null,
      systemAppsLastUpdated: null,

      // Usage / Costs (/costs page) — Sprint 5 backend shipped
      // GET /api/v2/usage/totals?since=&until=&group_by=
      // GET /api/v2/usage/by-agent?since=&until=
      // GET /api/v2/usage/by-model?since=&until=
      // GET /api/v2/usage/projections
      usage: {
        totals: null,
        byAgent: [],
        byModel: [],
        projections: null,
        timeRange: { since: null, until: null, label: "today" },
        loading: false,
        error: null,
        lastUpdated: null,
      },

      // Activities (/activity page + global pane) — Sprint 4 backend shipped
      // GET /api/v2/activities?since=&until=&limit=&category=&severity=&actor=&search=
      // WS  /api/ws/activities — live frame stream
      activities: [],
      activitiesLoading: false,
      activitiesHasMore: false,
      activitiesError: null,
      activitiesFilters: {
        categories: [],     // [] = all
        severities: [],     // [] = all
        since: null,
        until: null,
        actor: null,
        search: null,
      },
      activitiesPaneOpen: false,
      activitiesUnreadCount: 0,
      activitiesWsConnected: false,

      // Cron / Schedule (/cron page) — Sprint 3 backend shipped
      // GET    /api/v2/cron/jobs?enabled=&is_system=&agent=
      // GET    /api/v2/cron/jobs/:id
      // POST   /api/v2/cron/jobs                  (create)
      // PATCH  /api/v2/cron/jobs/:id              (edit + enable/disable)
      // DELETE /api/v2/cron/jobs/:id              (user jobs only)
      // POST   /api/v2/cron/jobs/:id/run-now
      // GET    /api/v2/cron/runs?since=&cron_job_id=&status=&limit=
      // WS broadcasts on /api/ws/agents: cron.created, cron.updated,
      //   cron.deleted, cron.enabled, cron.fired, cron.completed
      cronJobs: [],
      cronJobsLoading: false,
      cronJobsError: null,
      cronJobsLastUpdated: null,
      cronRuns: {},                  // keyed by cron_job_id → array of recent runs
      cronRunsLoading: false,
      selectedCronJobId: null,
      pendingCronOps: [],            // job ids with an in-flight POST/PATCH/DELETE/run-now

      // Design / Image Studio (/design page)
      // Phase C Part 6 backend not yet shipped — see BACKEND_REQUESTS.md:215-238.
      // All generation is mocked via setTimeout for now; every TODO in
      // DesignPage.js maps 1:1 to a real endpoint when backend lands.
      design: {
        mode: "studio",                // 'studio' | 'gallery' | 'chat'
        activeGeneration: null,        // current generation being viewed/edited
        activeVariationIndex: 0,
        settings: {
          model: null,                 // auto-pick image-capable when backend ships
          aspect_ratio: "1:1",         // '1:1' | '4:5' | '9:16' | '16:9' | '3:2' | '2:3'
          quality: "balanced",         // 'speed' | 'balanced' | 'quality'
          negative_prompt: "",
          seed: null,
          num_variations: 4,           // 1 | 2 | 4 | 6 | 8
          style_strength: 50,          // 0-100, only used when references attached
        },
        references: [],                // [{ id, name, dataUrl }] — frontend-only base64 stash
        history: [],                   // mock generations for now; will hydrate from /design/history
        inspector: {
          open: true,
          tab: "settings",             // 'settings' | 'history' | 'references'
        },
        composer: { input: "", mentions: [] },
        isGenerating: false,
        generationProgress: 0,         // 0-100, used during mock generation
      },

      // Spaces
      spaces: DEFAULT_SPACES,
      
      // Conversation threads
      threads: [],
      activeThreadId: null,
      
      // Terminal/Code state
      terminalOutput: [],
      codeFiles: [],
      activeFile: null,
      
      // ─── Qudos state ──────────────────────────────────────────────────────
      // Concept shell for AI co-pilot inside desktop apps.
      // Today this is purely UI/state — backend bridges (screen capture,
      // accessibility API, app control) are not wired yet. All session/suggestion
      // creation goes through frontend handlers that record the intent locally;
      // when Hermes/OpenClaw ships the macOS bridge, swap the handlers to
      // POST /api/v2/qudos/* without changing this surface.
      qudosEnabledApps: {},                       // { [appId]: true }
      qudosCapabilitiesByApp: {},                 // { [appId]: { watch:bool, suggest:bool, act:bool, launch:bool } }
      qudosActiveAppId: null,                     // currently focused app (auto-detected later)
      qudosPermissions: {                         // macOS permissions self-reported by user
        screenRecording: false,
        accessibility: false,
        microphone: false,
        camera: false,
      },
      qudosOverlay: {                             // floating button settings
        enabled: false,
        position: "bottom-right",                 // top-left | top-right | bottom-left | bottom-right
        hotkey: "Option+Space",
        autoHideMs: 5000,
        opacity: 0.85,
        theme: "auto",                            // light | dark | auto
      },
      qudosPrivacy: {
        retention: "7d",                          // none | 24h | 7d | 30d
        excludeApps: [],                          // app ids that Qudos should never watch
        sensitiveTags: ["banking", "passwords", "keychain"],
        paused: false,                            // master pause
      },
      qudosSessions: [],                          // active/historical co-pilot sessions
      qudosSuggestions: [],                       // assistant suggestions waiting on approve/dismiss
      
      // Actions
      setStatus: (status) => set({ status }),
      setPhase: (phase) => set({ phase }),
      setLastError: (lastError) => set({ lastError }),
      // Single-bot mode. Hermes/Meta runtimes removed from UI 2026-05-05.
      // setActiveRuntime kept as a no-op so any lingering callers don't crash;
      // backend chat frames always carry runtime: 'openclaw'.
      setActiveRuntime: (_runtime) => {
        if (_runtime && _runtime !== "openclaw") {
          // eslint-disable-next-line no-console
          console.warn(`[useGateway] setActiveRuntime("${_runtime}") ignored — single-bot mode`);
        }
      },
      getRuntimeForActiveThread: () => "openclaw",
      setActiveModel: (activeModel) => set({ activeModel }),
      fetchModelGroups: async ({ refresh = false } = {}) => {
        set({ modelsLoading: true, modelsError: null });
        try {
          if (refresh) {
            await fetch(apiUrl("/api/v2/models/refresh"), { method: "POST" });
          }
          const res = await fetch(apiUrl("/api/v2/models/groups"));
          if (!res.ok) throw new Error(`models/groups HTTP ${res.status}`);
          const payload = await res.json();
          const providers = providersFromGroups(payload?.groups || {});
          const models = providers.flatMap((p) => p.models);
          set({
            providers: providers.length ? providers : getProviders(),
            models: models.length ? models : processModels(),
            modelGroups: payload?.groups || null,
            modelProvidersStatus: payload?.providers || [],
            modelsLoading: false,
          });
          return payload;
        } catch (err) {
          set({ modelsLoading: false, modelsError: err?.message || String(err) });
          return null;
        }
      },
      // ── System telemetry ────────────────────────────────────────────
      // GET /api/v2/system/services. Returns either a bare array OR an
      // object { services, takenAt } depending on backend version — we
      // accept both. On error keep the previous list so the UI doesn't
      // flash empty during a transient blip.
      fetchSystemServices: async ({ silent = false } = {}) => {
        if (!silent) set({ systemServicesLoading: true, systemServicesError: null });
        try {
          const res = await fetch(apiUrl("/api/v2/system/services"));
          if (!res.ok) throw new Error(`system/services HTTP ${res.status}`);
          const payload = await res.json();
          const services = Array.isArray(payload)
            ? payload
            : Array.isArray(payload?.services) ? payload.services : [];
          set({
            systemServices: services,
            systemServicesLoading: false,
            systemServicesError: null,
            systemServicesLastUpdated: Date.now(),
          });
          return services;
        } catch (err) {
          set({
            systemServicesLoading: false,
            systemServicesError: err?.message || String(err),
          });
          return null;
        }
      },

      // GET /api/v2/system/stats — host hardware snapshot.
      // API_CONTRACT.md is authoritative: { uptime, cpu, memory, disk, network, takenAt }.
      // BACKEND_REQUESTS.md proposed a flatter shape ({ cpu.pct, ram.usedGB, ... });
      // we accept either. Disk and network rates may be null — preserve null so the
      // UI can render "—" instead of misleading zeros.
      fetchSystemStats: async ({ silent = false } = {}) => {
        if (!silent) set({ systemStatsLoading: true, systemStatsError: null });
        try {
          const res = await fetch(apiUrl("/api/v2/system/stats"));
          if (!res.ok) throw new Error(`system/stats HTTP ${res.status}`);
          const payload = await res.json();
          set({
            systemStats: payload || null,
            systemStatsLoading: false,
            systemStatsError: null,
            systemStatsLastUpdated: Date.now(),
          });
          return payload;
        } catch (err) {
          set({
            systemStatsLoading: false,
            systemStatsError: err?.message || String(err),
          });
          return null;
        }
      },

      // GET /api/v2/system/apps?device=mac — installed-app catalog.
      // Cached 5 minutes server-side; FE fetches on demand (Apps tab mount + manual refresh).
      // Response: { device, apps[], count, byCategory, takenAt }.
      fetchSystemApps: async ({ silent = false, device = "mac" } = {}) => {
        if (!silent) set({ systemAppsLoading: true, systemAppsError: null });
        try {
          const res = await fetch(apiUrl(`/api/v2/system/apps?device=${encodeURIComponent(device)}`));
          if (!res.ok) throw new Error(`system/apps HTTP ${res.status}`);
          const payload = await res.json();
          const apps = Array.isArray(payload?.apps) ? payload.apps : [];
          set({
            systemApps: apps,
            systemAppsByCategory: payload?.byCategory || null,
            systemAppsCount: typeof payload?.count === "number" ? payload.count : apps.length,
            systemAppsLoading: false,
            systemAppsError: null,
            systemAppsLastUpdated: Date.now(),
          });
          return payload;
        } catch (err) {
          set({
            systemAppsLoading: false,
            systemAppsError: err?.message || String(err),
          });
          return null;
        }
      },

      // ── Usage / Costs (Sprint 5) ────────────────────────────────────
      setUsageTimeRange: ({ since, until, label }) => {
        set((s) => ({ usage: { ...s.usage, timeRange: { since, until, label: label || s.usage.timeRange.label } } }));
      },
      refreshAllUsage: async ({ silent = false } = {}) => {
        if (!silent) set((s) => ({ usage: { ...s.usage, loading: true, error: null } }));
        const { since, until } = get().usage.timeRange;
        const q = new URLSearchParams();
        if (since) q.set("since", String(since));
        if (until) q.set("until", String(until));
        try {
          const [totalsRes, byAgentRes, byModelRes, projRes] = await Promise.all([
            fetch(apiUrl(`/api/v2/usage/totals?${q.toString()}`)),
            fetch(apiUrl(`/api/v2/usage/by-agent?${q.toString()}`)),
            fetch(apiUrl(`/api/v2/usage/by-model?${q.toString()}`)),
            fetch(apiUrl(`/api/v2/usage/projections`)),
          ]);
          const totals = totalsRes.ok ? await totalsRes.json() : null;
          const byAgentJson = byAgentRes.ok ? await byAgentRes.json() : null;
          const byModelJson = byModelRes.ok ? await byModelRes.json() : null;
          const projections = projRes.ok ? await projRes.json() : null;
          set((s) => ({
            usage: {
              ...s.usage,
              totals,
              byAgent: Array.isArray(byAgentJson?.by_agent) ? byAgentJson.by_agent
                     : Array.isArray(byAgentJson) ? byAgentJson : [],
              byModel: Array.isArray(byModelJson?.by_model) ? byModelJson.by_model
                     : Array.isArray(byModelJson) ? byModelJson : [],
              projections,
              loading: false,
              error: null,
              lastUpdated: Date.now(),
            },
          }));
          return { totals, byAgent: byAgentJson, byModel: byModelJson, projections };
        } catch (err) {
          set((s) => ({ usage: { ...s.usage, loading: false, error: err?.message || String(err) } }));
          return null;
        }
      },

      // ── Activities (Sprint 4) ───────────────────────────────────────
      fetchActivities: async ({ silent = false, append = false, ...overrides } = {}) => {
        if (!silent) set({ activitiesLoading: true, activitiesError: null });
        const f = { ...get().activitiesFilters, ...overrides };
        const params = new URLSearchParams();
        params.set("limit", String(overrides.limit || 100));
        if (f.categories?.length) params.set("category", f.categories.join(","));
        if (f.severities?.length) params.set("severity", f.severities.join(","));
        if (f.since) params.set("since", String(f.since));
        if (f.until) params.set("until", String(f.until));
        if (f.actor)  params.set("actor", f.actor);
        if (f.search) params.set("search", f.search);
        try {
          const res = await fetch(apiUrl(`/api/v2/activities?${params.toString()}`));
          if (!res.ok) throw new Error(`activities HTTP ${res.status}`);
          const payload = await res.json();
          const items = Array.isArray(payload?.activities) ? payload.activities : Array.isArray(payload) ? payload : [];
          set((s) => ({
            activities: append ? [...s.activities, ...items] : items,
            activitiesLoading: false,
            activitiesError: null,
            activitiesHasMore: typeof payload?.has_more === "boolean" ? payload.has_more : items.length >= 100,
          }));
          return items;
        } catch (err) {
          set({ activitiesLoading: false, activitiesError: err?.message || String(err) });
          return null;
        }
      },

      setActivitiesFilters: (patch) => {
        set((s) => ({ activitiesFilters: { ...s.activitiesFilters, ...patch } }));
        // Caller is expected to refetch.
      },

      toggleActivitiesPane: () => {
        const open = !get().activitiesPaneOpen;
        set({ activitiesPaneOpen: open, activitiesUnreadCount: open ? 0 : get().activitiesUnreadCount });
      },

      markActivitiesRead: () => set({ activitiesUnreadCount: 0 }),

      connectActivitiesWebSocket: () => {
        if (activitiesWs || typeof window === "undefined") return;
        const target = wsUrl("/api/ws/activities");
        try {
          activitiesWs = new WebSocket(target);
        } catch {
          activitiesWs = null;
          return;
        }
        activitiesWs.onopen = () => set({ activitiesWsConnected: true });
        activitiesWs.onmessage = (evt) => {
          try {
            const msg = JSON.parse(evt.data);
            // Backend emits raw activity frames; some servers wrap them
            // in { type: 'activity', payload }. Accept both.
            const a = msg?.payload && msg?.type === "activity" ? msg.payload
                    : msg?.id && msg?.category ? msg
                    : null;
            if (!a) return;
            set((s) => {
              // Prepend, cap at 500 in memory.
              const next = [a, ...s.activities.filter((x) => x.id !== a.id)].slice(0, 500);
              const unread = s.activitiesPaneOpen ? 0 : s.activitiesUnreadCount + 1;
              return { activities: next, activitiesUnreadCount: unread };
            });
          } catch {
            // ignore malformed
          }
        };
        activitiesWs.onclose = () => {
          set({ activitiesWsConnected: false });
          activitiesWs = null;
          if (activitiesWsReconnectTimer) window.clearTimeout(activitiesWsReconnectTimer);
          activitiesWsReconnectTimer = window.setTimeout(() => {
            activitiesWsReconnectTimer = null;
            get().connectActivitiesWebSocket();
          }, 3000);
        };
        activitiesWs.onerror = () => { /* handled by onclose */ };
      },

      // ── Cron / Schedule actions ─────────────────────────────────────
      fetchCronJobs: async ({ silent = false } = {}) => {
        if (!silent) set({ cronJobsLoading: true, cronJobsError: null });
        try {
          const res = await fetch(apiUrl("/api/v2/cron/jobs"));
          if (!res.ok) throw new Error(`cron/jobs HTTP ${res.status}`);
          const payload = await res.json();
          const jobs = Array.isArray(payload?.jobs) ? payload.jobs : Array.isArray(payload) ? payload : [];
          set({
            cronJobs: jobs,
            cronJobsLoading: false,
            cronJobsError: null,
            cronJobsLastUpdated: Date.now(),
          });
          return jobs;
        } catch (err) {
          set({ cronJobsLoading: false, cronJobsError: err?.message || String(err) });
          return null;
        }
      },

      fetchCronRuns: async (jobId, { limit = 20, silent = true } = {}) => {
        if (!silent) set({ cronRunsLoading: true });
        try {
          const url = jobId
            ? `/api/v2/cron/runs?cron_job_id=${encodeURIComponent(jobId)}&limit=${limit}`
            : `/api/v2/cron/runs?limit=${limit}`;
          const res = await fetch(apiUrl(url));
          if (!res.ok) throw new Error(`cron/runs HTTP ${res.status}`);
          const payload = await res.json();
          const runs = Array.isArray(payload?.runs) ? payload.runs : [];
          if (jobId) {
            set((s) => ({ cronRuns: { ...s.cronRuns, [jobId]: runs }, cronRunsLoading: false }));
          } else {
            set({ cronRunsLoading: false });
          }
          return runs;
        } catch (err) {
          set({ cronRunsLoading: false });
          return null;
        }
      },

      setSelectedCronJobId: (id) => {
        set({ selectedCronJobId: id });
        if (id) get().fetchCronRuns(id, { limit: 20 }).catch(() => null);
      },

      // Optimistic toggle. PATCH /api/v2/cron/jobs/:id { enabled }.
      toggleCronJob: async (id, enabled) => {
        const prev = get().cronJobs;
        const next = prev.map((j) => (j.id === id ? { ...j, enabled } : j));
        set({
          cronJobs: next,
          pendingCronOps: [...new Set([...get().pendingCronOps, id])],
        });
        try {
          const res = await fetch(apiUrl(`/api/v2/cron/jobs/${encodeURIComponent(id)}`), {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ enabled }),
          });
          if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            throw new Error(body?.message || body?.error || `cron toggle HTTP ${res.status}`);
          }
          // Backend will broadcast cron.enabled — WS handler reconciles.
          return { ok: true };
        } catch (err) {
          set({ cronJobs: prev });
          return { ok: false, error: err?.message || String(err) };
        } finally {
          set({ pendingCronOps: get().pendingCronOps.filter((x) => x !== id) });
        }
      },

      // POST /api/v2/cron/jobs/:id/run-now
      runCronJobNow: async (id) => {
        set({ pendingCronOps: [...new Set([...get().pendingCronOps, id])] });
        try {
          const res = await fetch(apiUrl(`/api/v2/cron/jobs/${encodeURIComponent(id)}/run-now`), {
            method: "POST",
          });
          if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            throw new Error(body?.message || body?.error || `cron run-now HTTP ${res.status}`);
          }
          return { ok: true, ...(await res.json().catch(() => ({}))) };
        } catch (err) {
          return { ok: false, error: err?.message || String(err) };
        } finally {
          set({ pendingCronOps: get().pendingCronOps.filter((x) => x !== id) });
        }
      },

      createCronJob: async (data) => {
        try {
          const res = await fetch(apiUrl("/api/v2/cron/jobs"), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data),
          });
          if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            throw new Error(body?.message || body?.error || `cron create HTTP ${res.status}`);
          }
          const job = await res.json();
          // WS will broadcast cron.created; refresh defensively.
          get().fetchCronJobs({ silent: true }).catch(() => null);
          return { ok: true, job };
        } catch (err) {
          return { ok: false, error: err?.message || String(err) };
        }
      },

      updateCronJob: async (id, patch) => {
        const prev = get().cronJobs;
        const next = prev.map((j) => (j.id === id ? { ...j, ...patch } : j));
        set({ cronJobs: next });
        try {
          const res = await fetch(apiUrl(`/api/v2/cron/jobs/${encodeURIComponent(id)}`), {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(patch),
          });
          if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            throw new Error(body?.message || body?.error || `cron update HTTP ${res.status}`);
          }
          return { ok: true };
        } catch (err) {
          set({ cronJobs: prev });
          return { ok: false, error: err?.message || String(err) };
        }
      },

      deleteCronJob: async (id) => {
        const prev = get().cronJobs;
        set({ cronJobs: prev.filter((j) => j.id !== id) });
        try {
          const res = await fetch(apiUrl(`/api/v2/cron/jobs/${encodeURIComponent(id)}`), {
            method: "DELETE",
          });
          if (!res.ok && res.status !== 204) {
            const body = await res.json().catch(() => ({}));
            throw new Error(body?.message || body?.error || `cron delete HTTP ${res.status}`);
          }
          return { ok: true };
        } catch (err) {
          set({ cronJobs: prev });
          return { ok: false, error: err?.message || String(err) };
        }
      },

      // WS event handlers for cron broadcasts on /api/ws/agents.
      _applyCronEvent: (msg) => {
        if (!msg?.type || !msg.type.startsWith("cron.")) return;
        const payload = msg.payload || {};
        const id = payload.id || payload.cron_job_id;
        if (msg.type === "cron.created" && payload) {
          set((s) => ({
            cronJobs: [payload, ...s.cronJobs.filter((j) => j.id !== payload.id)],
          }));
        } else if (msg.type === "cron.updated" && payload && id) {
          set((s) => ({
            cronJobs: s.cronJobs.map((j) => (j.id === id ? { ...j, ...payload } : j)),
          }));
        } else if (msg.type === "cron.deleted" && id) {
          set((s) => ({ cronJobs: s.cronJobs.filter((j) => j.id !== id) }));
        } else if (msg.type === "cron.enabled" && id) {
          set((s) => ({
            cronJobs: s.cronJobs.map((j) => (j.id === id ? { ...j, enabled: !!payload.enabled } : j)),
          }));
        } else if (msg.type === "cron.fired" && id) {
          // Update last_run_at + run_count optimistically; full row refresh
          // happens on cron.completed.
          set((s) => ({
            cronJobs: s.cronJobs.map((j) =>
              j.id === id
                ? { ...j, last_run_at: payload.fired_at || Date.now(), run_count: (j.run_count || 0) + 1 }
                : j
            ),
            cronRuns: payload.run
              ? { ...s.cronRuns, [id]: [payload.run, ...((s.cronRuns[id] || []).slice(0, 19))] }
              : s.cronRuns,
          }));
        } else if (msg.type === "cron.completed" && id) {
          set((s) => {
            const existing = s.cronRuns[id] || [];
            const updated = existing.map((r) =>
              r.id === payload.run_id ? { ...r, status: payload.status, completed_at: payload.completed_at, error_message: payload.error_message ?? null } : r
            );
            const newFailureCount = payload.status === "failed"
              ? s.cronJobs.find((j) => j.id === id)?.failure_count + 1
              : undefined;
            return {
              cronRuns: { ...s.cronRuns, [id]: updated },
              cronJobs: s.cronJobs.map((j) =>
                j.id === id
                  ? { ...j, ...(newFailureCount !== undefined ? { failure_count: newFailureCount } : {}) }
                  : j
              ),
            };
          });
        }
      },

      // ── Design / Image Studio actions ───────────────────────────────
      // Pure-mock for now. When Phase C Part 6 backend ships, each action
      // listed below has a corresponding TODO comment naming the real
      // endpoint and request/response shape.
      setDesignMode: (mode) => {
        if (!["studio", "gallery", "chat"].includes(mode)) return;
        set((s) => ({ design: { ...s.design, mode } }));
      },
      setDesignActiveGeneration: (gen) => {
        set((s) => ({ design: { ...s.design, activeGeneration: gen, activeVariationIndex: 0 } }));
      },
      setDesignActiveVariation: (index) => {
        set((s) => ({ design: { ...s.design, activeVariationIndex: index } }));
      },
      updateDesignSettings: (patch) => {
        set((s) => ({ design: { ...s.design, settings: { ...s.design.settings, ...patch } } }));
      },
      toggleDesignInspector: () => {
        set((s) => ({ design: { ...s.design, inspector: { ...s.design.inspector, open: !s.design.inspector.open } } }));
      },
      setDesignInspectorTab: (tab) => {
        if (!["settings", "history", "references"].includes(tab)) return;
        set((s) => ({ design: { ...s.design, inspector: { ...s.design.inspector, tab } } }));
      },
      setDesignComposerInput: (input) => {
        set((s) => ({ design: { ...s.design, composer: { ...s.design.composer, input } } }));
      },
      addDesignReference: (file) => {
        // Frontend-only: base64-encode for in-memory display.
        // TODO: when /api/v2/files/upload (multipart) ships, swap to real upload
        //       and store the returned file_id + url instead of dataUrl.
        return new Promise((resolve) => {
          const reader = new FileReader();
          reader.onload = () => {
            const ref = {
              id: `ref-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
              name: file.name || "reference",
              dataUrl: reader.result,
              uploadedAt: Date.now(),
            };
            set((s) => ({ design: { ...s.design, references: [...s.design.references, ref] } }));
            resolve(ref);
          };
          reader.readAsDataURL(file);
        });
      },
      removeDesignReference: (id) => {
        set((s) => ({ design: { ...s.design, references: s.design.references.filter((r) => r.id !== id) } }));
      },

      // Mock generation. Returns a fake generation entry after 3s.
      // TODO: replace with POST /api/v2/design/generate
      //   Request:  { prompt, settings, references }
      //   Response: { generation_id, status: 'queued', estimatedSeconds }
      //   Then subscribe to WS /api/ws/design/generations and stream
      //   progress events { generationId, progress: 0-1, completed?: imageUrl[] }
      //   into design.activeGeneration.variations as they arrive.
      generateDesign: async (prompt, settingsOverride = {}) => {
        const trimmed = (prompt || "").trim();
        if (!trimmed) return null;
        const settings = { ...get().design.settings, ...settingsOverride };
        set((s) => ({ design: { ...s.design, isGenerating: true, generationProgress: 0 } }));

        // Simulate progress 0→100 over 3s in 6 ticks.
        const progressTimer = setInterval(() => {
          const p = get().design.generationProgress;
          const next = Math.min(95, p + Math.round(15 + Math.random() * 10));
          set((s) => ({ design: { ...s.design, generationProgress: next } }));
        }, 500);

        return new Promise((resolve) => {
          setTimeout(() => {
            clearInterval(progressTimer);
            const id = `gen-${Date.now().toString(36)}`;
            const baseSeed = settings.seed ?? Math.floor(Math.random() * 1e6);
            // Picsum gives stable images per seed; cheap visual variety
            // without bundling assets. Aspect-ratio-aware placeholders.
            const dims = (() => {
              switch (settings.aspect_ratio) {
                case "16:9": return [960, 540];
                case "9:16": return [540, 960];
                case "4:5":  return [640, 800];
                case "3:2":  return [840, 560];
                case "2:3":  return [560, 840];
                default:     return [720, 720];
              }
            })();
            const variations = Array.from({ length: settings.num_variations || 4 }, (_, i) => ({
              id: `${id}-var-${i}`,
              url: `https://picsum.photos/seed/${baseSeed + i}/${dims[0]}/${dims[1]}`,
              favorited: false,
              seed: baseSeed + i,
            }));
            const newGen = {
              id,
              prompt: trimmed,
              status: "complete",
              created_at: Date.now(),
              model: settings.model || "mock-flux-1.1",
              cost_usd: 0,                    // TODO: backend will return real cost
              aspect_ratio: settings.aspect_ratio,
              quality: settings.quality,
              negative_prompt: settings.negative_prompt || null,
              variations,
            };
            set((s) => ({
              design: {
                ...s.design,
                history: [newGen, ...s.design.history],
                activeGeneration: newGen,
                activeVariationIndex: 0,
                isGenerating: false,
                generationProgress: 100,
                composer: { ...s.design.composer, input: "" },
              },
            }));
            resolve(newGen);
          }, 3000);
        });
      },

      // ── Agent control ──────────────────────────────────────────────
      // Read full state map. WS broadcast keeps it fresh after first load,
      // so callers don't need to poll — initial load + reactive updates only.
      fetchAgentControl: async ({ silent = false } = {}) => {
        if (!silent) set({ agentControlLoading: true, agentControlError: null });
        try {
          const res = await fetch(apiUrl("/api/v2/agents/control"));
          if (!res.ok) throw new Error(`agents/control HTTP ${res.status}`);
          const payload = await res.json();
          const agents = (payload && typeof payload.agents === "object") ? payload.agents : {};
          set({
            agentControl: agents,
            agentControlLoading: false,
            agentControlError: null,
            agentControlLastUpdated: Date.now(),
          });
          return agents;
        } catch (err) {
          set({
            agentControlLoading: false,
            agentControlError: err?.message || String(err),
          });
          return null;
        }
      },

      // Apply an action to one agent (or 'all'). Optimistic — UI updates
      // immediately, rollback on error. WS echo reconciles cross-tab state.
      // 409 'already_in_state' is *not* an error — backend just confirms
      // we're already where we asked to be; refresh and move on.
      setAgentControl: async (agent, action) => {
        const validActions = ["start", "stop", "pause", "resume"];
        if (!validActions.includes(action)) {
          return { ok: false, error: "unknown_action" };
        }
        // Optimistically project the new state for known agents.
        const projected = (() => {
          if (action === "stop")   return "stopped";
          if (action === "pause")  return "paused";
          if (action === "start")  return "running";
          if (action === "resume") return "running";
          return null;
        })();
        const prev = get().agentControl;
        const optimistic = { ...prev };
        if (agent === "all") {
          for (const k of Object.keys(optimistic)) optimistic[k] = projected;
        } else {
          optimistic[agent] = projected;
        }
        set({
          agentControl: optimistic,
          pendingAgentControls: [...new Set([...get().pendingAgentControls, agent])],
        });

        try {
          const res = await fetch(apiUrl("/api/v2/agents/control"), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ agent, action }),
          });
          // Backend may return 409 with the canonical state; treat as success.
          if (res.status === 409) {
            const body = await res.json().catch(() => ({}));
            if (body?.currentState && agent !== "all") {
              const next = { ...get().agentControl, [agent]: body.currentState };
              set({ agentControl: next });
            }
            // Refresh the whole map for 'all' to be safe.
            if (agent === "all") {
              await get().fetchAgentControl({ silent: true });
            }
            return { ok: true, alreadyInState: true, currentState: body?.currentState };
          }
          if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            throw new Error(body?.message || body?.error || `agents/control HTTP ${res.status}`);
          }
          const body = await res.json();
          // For single-agent calls, body has { agent, currentState, ... }.
          // For 'all', backend may return aggregate; fall back to fetch.
          if (agent === "all") {
            await get().fetchAgentControl({ silent: true });
          } else if (body?.currentState) {
            const next = { ...get().agentControl, [agent]: body.currentState };
            set({ agentControl: next, agentControlLastUpdated: Date.now() });
          }
          return { ok: true, ...body };
        } catch (err) {
          // Rollback optimistic.
          set({
            agentControl: prev,
            agentControlError: err?.message || String(err),
          });
          return { ok: false, error: err?.message || String(err) };
        } finally {
          set({
            pendingAgentControls: get().pendingAgentControls.filter((a) => a !== agent),
          });
        }
      },

      // Internal — called from the agents WS handler when we see an
      // 'agent.control' broadcast. Reconciles state from another tab/device.
      _applyAgentControlEvent: (payload) => {
        if (!payload || !payload.agent || !payload.currentState) return;
        const next = { ...get().agentControl, [payload.agent]: payload.currentState };
        set({ agentControl: next, agentControlLastUpdated: Date.now() });
      },

      setClawStatus: (clawStatus) => set({ clawStatus }),
      setActivePage: (activePage) => set({ activePage }),
      setActiveTab: (activeTab) => set({ activeTab }),
      
      // Thread-scoped message helper: writes to thread AND global if active
      _addMessageToThread: (threadId, msg) => set((s) => {
        const newThreads = s.threads.map(t =>
          t.id === threadId
            ? { ...t, messages: [...(Array.isArray(t.messages) ? t.messages : []).slice(-199), msg], title: (Array.isArray(t.messages) ? t.messages.length : 0) === 0 && msg.role === "user" ? msg.content?.slice(0, 40) || t.title : t.title, updatedAt: msg.timestamp || Date.now() }
            : t
        );
        if (s.activeThreadId === threadId) {
          return { threads: newThreads, messages: [...s.messages.slice(-199), msg] };
        }
        return { threads: newThreads };
      }),

      // Global message helpers (used by UI for display only)
      addMessage: (msg) => set((s) => ({ messages: [...s.messages.slice(-199), msg] })),
      removeMessage: (id) => set((s) => ({ messages: s.messages.filter(m => m.id !== id) })),
      clearMessages: () => set((s) => {
        const clearStream = s.streamingMessage?.threadId === s.activeThreadId;
        const newThreads = s.activeThreadId
          ? s.threads.map(t => t.id === s.activeThreadId ? { ...t, messages: [] } : t)
          : s.threads;
        return { messages: [], threads: newThreads, ...(clearStream ? { streamingMessage: null, pendingRunId: null } : {}) };
      }),
      stopGenerating: () => {
        const { streamingMessage, activeThreadId, addEvent } = get();
        if (streamingMessage?.threadId) clearStreamTimer(streamingMessage.threadId);
        if (streamingMessage?.runId && gatewayWs?.readyState === WebSocket.OPEN) {
          gatewayWs.send(JSON.stringify({
            type: "chat.cancel",
            threadId: streamingMessage.threadId || activeThreadId || "default-thread",
            runId: streamingMessage.runId,
          }));
          addEvent?.({ id: crypto.randomUUID(), ts: Date.now(), type: "chat.cancel", payload: { runId: streamingMessage.runId, threadId: streamingMessage.threadId } });
        }
        set({ streamingMessage: null, pendingRunId: null });
      },
      
      // Events
      addEvent: (evt) => set((s) => ({ events: [...s.events.slice(-499), evt] })),
      clearEvents: () => set({ events: [] }),
      
      setStreamingMessage: (streamingMessage) => set({ streamingMessage }),
      setPendingRunId: (pendingRunId) => set({ pendingRunId }),
      forceUnlockChat: (reason = "manual unlock") => {
        const { streamingMessage, addEvent } = get();
        if (streamingMessage?.threadId) clearStreamTimer(streamingMessage.threadId);
        set({ streamingMessage: null, pendingRunId: null, status: "connected", lastError: null });
        addEvent?.({ id: crypto.randomUUID(), ts: Date.now(), type: "chat.force_unlock", payload: { reason } });
      },
      
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
      
      // Data controls
      setDataControl: (key, value) => set((s) => ({
        dataControls: { ...s.dataControls, [key]: value }
      })),
      
      // Security
      setSecurity: (key, value) => set((s) => ({
        security: { ...s.security, [key]: value }
      })),
      
      // Plugins
      togglePlugin: (pluginId) => set((s) => ({
        plugins: s.plugins.map(p => p.id === pluginId ? { ...p, installed: !p.installed } : p)
      })),
      
      // Custom item creation
      addCustomSkill: (name, desc) => set((s) => ({ customSkills: [...s.customSkills, { id: `custom-${crypto.randomUUID().slice(0,8)}`, name: `/${name.replace(/\s+/g, '-').toLowerCase()}`, desc, provider: "Custom", downloads: "0", category: "Custom" }] })),
      addCustomConnector: (name, desc) => set((s) => ({ customConnectors: [...s.customConnectors, { id: `custom-${crypto.randomUUID().slice(0,8)}`, name, desc, category: "Custom" }] })),
      addCustomPlugin: (name, desc) => set((s) => ({ customPlugins: [...s.customPlugins, { id: `custom-${crypto.randomUUID().slice(0,8)}`, name, desc, provider: "Custom", downloads: "0", category: "Custom" }] })),
      removeCustomSkill: (id) => set((s) => ({ customSkills: s.customSkills.filter(sk => sk.id !== id) })),
      removeCustomConnector: (id) => set((s) => ({ customConnectors: s.customConnectors.filter(c => c.id !== id) })),
      removeCustomPlugin: (id) => set((s) => ({ customPlugins: s.customPlugins.filter(p => p.id !== id) })),
      
      // Batch connector toggle (for Desktop Integration)
      setConnectorBatch: (ids, value) => set((s) => {
        const c = { ...s.connectors };
        ids.forEach(id => { c[id] = value; });
        return { connectors: c };
      }),
      
      // MCP Servers
      addMcpServer: (url, name) => set((s) => ({
        mcpServers: [...s.mcpServers, { id: crypto.randomUUID().slice(0, 8), url, name: name || url, connected: false, addedAt: Date.now() }]
      })),
      removeMcpServer: (id) => set((s) => ({
        mcpServers: s.mcpServers.filter(m => m.id !== id)
      })),
      
      // API Keys
      addApiKey: (name, key) => set((s) => ({
        apiKeys: [...s.apiKeys, { id: crypto.randomUUID().slice(0, 8), name, key: key.slice(0, 4) + "..." + key.slice(-4), addedAt: Date.now() }]
      })),
      removeApiKey: (id) => set((s) => ({
        apiKeys: s.apiKeys.filter(k => k.id !== id)
      })),
      
      // Clear all threads
      clearAllThreads: () => set({ threads: [], activeThreadId: null, messages: [], streamingMessage: null, pendingRunId: null }),
      
      // Jobs actions
      updateJobStatus: (jobId, status, progress) => set((s) => ({
        jobs: s.jobs.map(j => j.id === jobId ? { ...j, status, progress } : j)
      })),
      cancelJob: (jobId) => set((s) => ({
        jobs: s.jobs.map(j => j.id === jobId ? { ...j, status: "cancelled", progress: j.progress } : j)
      })),
      
      // Approvals actions
      approveRequest: async (approvalId, decision = "once") => {
        const state = get();
        let v2Ok = state.approvalsBackend === "v2";
        try {
          if (state.approvalsBackend !== "v1") {
            const res = await fetch(apiUrl(`/api/v2/approvals/${approvalId}/respond`), {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ decision }),
            });
            if (!res.ok) throw new Error(`v2 respond failed: ${res.status}`);
            v2Ok = true;
          }
        } catch {
          v2Ok = false;
        }

        if (!v2Ok) {
          await fetch(apiUrl(`/api/approvals/${approvalId}/approve`), { method: "PUT" }).catch(() => null);
          set({ approvalsBackend: "v1" });
        }

        set((s) => ({
          approvals: s.approvals.map((a) =>
            a.id === approvalId ? { ...a, status: "approved", decision: v2Ok ? decision : "always" } : a
          ),
        }));
        await get().fetchPendingApprovals();
        await get().fetchApprovalHistory();
      },
      rejectRequest: async (approvalId) => {
        let v2Ok = get().approvalsBackend === "v2";
        try {
          if (get().approvalsBackend !== "v1") {
            const res = await fetch(apiUrl(`/api/v2/approvals/${approvalId}/respond`), {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ decision: "deny" }),
            });
            if (!res.ok) throw new Error(`v2 respond failed: ${res.status}`);
            v2Ok = true;
          }
        } catch {
          v2Ok = false;
        }

        if (!v2Ok) {
          await fetch(apiUrl(`/api/approvals/${approvalId}/reject`), { method: "PUT" }).catch(() => null);
          set({ approvalsBackend: "v1" });
        }

        set((s) => ({
          approvals: s.approvals.map((a) =>
            a.id === approvalId ? { ...a, status: "rejected", decision: "deny" } : a
          ),
        }));
        await get().fetchPendingApprovals();
        await get().fetchApprovalHistory();
      },
      fetchPendingApprovals: async () => {
        set({ approvalsLoading: true });
        try {
          const v2 = await fetch(apiUrl("/api/v2/approvals/pending"));
          if (!v2.ok) throw new Error(`v2 pending failed: ${v2.status}`);
          const payload = await v2.json();
          const pending = Array.isArray(payload?.pending_requests) ? payload.pending_requests : [];
          set({ approvals: pending.map(normalizeV2Approval), approvalsBackend: "v2", approvalsLoading: false });
          return;
        } catch {
          // Fall through to legacy
        }

        try {
          const legacy = await fetch(apiUrl("/api/approvals"));
          if (!legacy.ok) throw new Error(`legacy approvals failed: ${legacy.status}`);
          const payload = await legacy.json();
          const items = Array.isArray(payload) ? payload : [];
          set({ approvals: items.map(normalizeLegacyApproval), approvalsBackend: "v1", approvalsLoading: false });
        } catch {
          set({ approvalsLoading: false, approvalsBackend: "mock" });
        }
      },
      fetchApprovalHistory: async () => {
        if (get().approvalsBackend === "v1") {
          const done = get().approvals.filter((a) => a.status !== "pending").map((a) => ({
            id: a.id,
            session_id: a.sessionId || null,
            tool_name: a.toolName || a.title,
            description: a.description,
            decision: a.status === "approved" ? "always" : "deny",
            resolved_at: new Date(a.timestamp || Date.now()).toISOString(),
          }));
          set({ approvalHistory: done });
          return;
        }

        try {
          const res = await fetch(apiUrl("/api/v2/approvals/history?limit=100&offset=0"));
          if (!res.ok) throw new Error(`history failed: ${res.status}`);
          const payload = await res.json();
          set({ approvalHistory: Array.isArray(payload?.history) ? payload.history : [], approvalsBackend: "v2" });
        } catch {
          if (get().approvalsBackend === "v2") set({ approvalHistory: [] });
        }
      },
      fetchSessionPermissionState: async (sessionId) => {
        if (!sessionId || get().approvalsBackend === "v1") return null;
        try {
          const res = await fetch(apiUrl(`/api/v2/approvals/sessions/${sessionId}/state`));
          if (!res.ok) throw new Error(`state failed: ${res.status}`);
          const payload = await res.json();
          set((s) => ({
            approvalModesBySession: { ...s.approvalModesBySession, [sessionId]: payload?.mode || "default" },
          }));
          return payload;
        } catch {
          return null;
        }
      },
      setSessionPermissionMode: async (sessionId, mode) => {
        if (!sessionId || !APPROVAL_MODES.includes(mode) || get().approvalsBackend === "v1") return false;
        try {
          const res = await fetch(apiUrl(`/api/v2/approvals/sessions/${sessionId}/mode`), {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ mode }),
          });
          if (!res.ok) throw new Error(`mode set failed: ${res.status}`);
          set((s) => ({
            approvalModesBySession: { ...s.approvalModesBySession, [sessionId]: mode },
          }));
          return true;
        } catch {
          return false;
        }
      },
      connectApprovalsWebSocket: () => {
        if (approvalsWs || typeof window === "undefined") return;
        const target = wsUrl("/api/ws/approvals");
        try {
          approvalsWs = new WebSocket(target);
        } catch {
          approvalsWs = null;
          return;
        }

        approvalsWs.onopen = () => {
          set({ approvalsWsConnected: true });
          if (approvalsWs) {
            approvalsWs.send(JSON.stringify({ type: "subscribe" }));
          }
        };

        approvalsWs.onmessage = (evt) => {
          try {
            const msg = JSON.parse(evt.data);
            if (msg.type === "tool_permission_request") {
              const incoming = normalizeV2Approval({
                id: msg.request_id,
                session_id: msg.session_id,
                tool_name: msg.tool_name,
                description: msg.description,
                status: "pending",
                created_at: msg.timestamp,
              });
              set((s) => {
                const existing = s.approvals.filter((a) => a.id !== incoming.id);
                return { approvals: [incoming, ...existing], approvalsBackend: "v2" };
              });
            } else if (msg.type === "tool_permission_resolved") {
              set((s) => ({
                approvals: s.approvals.map((a) =>
                  a.id === msg.request_id
                    ? { ...a, status: msg.decision === "deny" ? "rejected" : "approved", decision: msg.decision }
                    : a
                ),
              }));
              get().fetchPendingApprovals();
              get().fetchApprovalHistory();
            } else if (msg.type === "permission_mode_changed") {
              set((s) => ({
                approvalModesBySession: { ...s.approvalModesBySession, [msg.session_id]: msg.mode || "default" },
              }));
            }
          } catch {
            // ignore malformed payloads
          }
        };

        approvalsWs.onclose = () => {
          set({ approvalsWsConnected: false });
          approvalsWs = null;
          if (approvalsWsReconnectTimer) window.clearTimeout(approvalsWsReconnectTimer);
          approvalsWsReconnectTimer = window.setTimeout(() => {
            approvalsWsReconnectTimer = null;
            get().connectApprovalsWebSocket();
          }, 3000);
        };

        approvalsWs.onerror = () => {
          set({ approvalsWsConnected: false });
        };
      },

      // Agents WS — listens for agent.control broadcasts so the UI stays
      // in sync when state changes from another tab/device or from a
      // direct backend control. Reuses the same auto-reconnect pattern as
      // the approvals socket. We deliberately scope this socket to control
      // events only for now; task lifecycle still flows through polling.
      connectAgentsWebSocket: () => {
        if (agentsWs || typeof window === "undefined") return;
        const target = wsUrl("/api/ws/agents");
        try {
          agentsWs = new WebSocket(target);
        } catch {
          agentsWs = null;
          return;
        }
        agentsWs.onopen = () => {
          if (agentsWs) {
            try { agentsWs.send(JSON.stringify({ type: "subscribe" })); } catch {}
          }
        };
        agentsWs.onmessage = (evt) => {
          try {
            const msg = JSON.parse(evt.data);
            if (msg?.type === "agent.control") {
              get()._applyAgentControlEvent(msg.payload || {});
            } else if (typeof msg?.type === "string" && msg.type.startsWith("cron.")) {
              // Sprint 3 — backend broadcasts cron lifecycle on the same socket.
              get()._applyCronEvent(msg);
            }
          } catch {
            // ignore malformed payloads
          }
        };
        agentsWs.onclose = () => {
          agentsWs = null;
          if (agentsWsReconnectTimer) window.clearTimeout(agentsWsReconnectTimer);
          agentsWsReconnectTimer = window.setTimeout(() => {
            agentsWsReconnectTimer = null;
            get().connectAgentsWebSocket();
          }, 3000);
        };
        agentsWs.onerror = () => { /* handled by onclose */ };
      },

      // ─── Agent runtime actions ─────────────────────────────────────────
      setAgentFilter: (agentFilter) => set({ agentFilter }),

      fetchAgentTasks: async ({ silent = false } = {}) => {
        if (!silent) set({ agentTasksLoading: true });
        try {
          const res = await fetch(apiUrl("/api/v2/agents/tasks"));
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const payload = await res.json();
          const tasks = Array.isArray(payload?.tasks)
            ? payload.tasks
            : Array.isArray(payload)
              ? payload
              : [];
          set({
            agentTasks: tasks,
            agentTasksLoading: false,
            agentTasksError: null,
            agentTasksLastUpdated: Date.now(),
          });
          return tasks;
        } catch (err) {
          set({
            agentTasksLoading: false,
            agentTasksError: err?.message || String(err),
          });
          return [];
        }
      },

      submitAgentTask: async (agent, prompt) => {
        if (!agent || !prompt?.trim()) return null;
        set({ agentSubmitting: true });
        try {
          const res = await fetch(apiUrl("/api/v2/agents/tasks"), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ agent, prompt: prompt.trim() }),
          });
          // 503 with Retry-After means the agent is paused/stopped; surface
          // a friendly error and refresh the control state so the UI catches up.
          if (res.status === 503) {
            const retryAfter = res.headers.get("Retry-After");
            const body = await res.json().catch(() => ({}));
            const msg = body?.message
              || `${agent} is ${body?.state || "unavailable"}. Resume it from /agents to submit work.`;
            get().fetchAgentControl({ silent: true }).catch(() => null);
            set({
              agentSubmitting: false,
              agentTasksError: retryAfter ? `${msg} (retry after ${retryAfter}s)` : msg,
            });
            return null;
          }
          if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            throw new Error(body?.error || `HTTP ${res.status}`);
          }
          const task = await res.json();
          // Merge into list immediately for instant feedback
          set((s) => ({
            agentTasks: [task, ...s.agentTasks.filter((t) => t.id !== task.id)],
            agentSubmitting: false,
          }));
          // Re-poll shortly to pick up status transitions
          setTimeout(() => get().fetchAgentTasks({ silent: true }), 600);
          setTimeout(() => get().fetchAgentTasks({ silent: true }), 2500);
          return task;
        } catch (err) {
          set({
            agentSubmitting: false,
            agentTasksError: err?.message || String(err),
          });
          return null;
        }
      },

      runAgentPipeline: async (prompt) => {
        if (!prompt?.trim()) return null;
        set({ agentSubmitting: true });
        try {
          const res = await fetch(apiUrl("/api/v2/agents/pipeline"), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ prompt: prompt.trim() }),
          });
          // Pipeline 503 — at least one of planner/executor/supervisor/auditor
          // is paused or stopped, so the chain can't run.
          if (res.status === 503) {
            const retryAfter = res.headers.get("Retry-After");
            const body = await res.json().catch(() => ({}));
            const msg = body?.message
              || "Pipeline blocked: one of planner/executor/supervisor/auditor is paused or stopped. Resume from /agents.";
            get().fetchAgentControl({ silent: true }).catch(() => null);
            set({
              agentSubmitting: false,
              agentTasksError: retryAfter ? `${msg} (retry after ${retryAfter}s)` : msg,
            });
            return null;
          }
          if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            throw new Error(body?.error || `HTTP ${res.status}`);
          }
          const payload = await res.json();
          // Pipeline returns { pipelineId, tasks[] } — merge them all
          set((s) => {
            const incoming = Array.isArray(payload?.tasks) ? payload.tasks : [];
            const incomingIds = new Set(incoming.map((t) => t.id));
            return {
              agentTasks: [...incoming, ...s.agentTasks.filter((t) => !incomingIds.has(t.id))],
              agentSubmitting: false,
            };
          });
          setTimeout(() => get().fetchAgentTasks({ silent: true }), 800);
          setTimeout(() => get().fetchAgentTasks({ silent: true }), 3000);
          return payload;
        } catch (err) {
          set({
            agentSubmitting: false,
            agentTasksError: err?.message || String(err),
          });
          return null;
        }
      },

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
      
      // ─── Qudos actions ────────────────────────────────────────────────────
      // Toggle whether Qudos is enabled for an app.
      toggleQudosApp: (appId) => set((s) => {
        const next = { ...s.qudosEnabledApps };
        if (next[appId]) delete next[appId];
        else next[appId] = true;
        return { qudosEnabledApps: next };
      }),
      setQudosCapability: (appId, key, on) => set((s) => {
        const cur = s.qudosCapabilitiesByApp[appId] || { watch: true, suggest: true, act: false, launch: true };
        return {
          qudosCapabilitiesByApp: { ...s.qudosCapabilitiesByApp, [appId]: { ...cur, [key]: !!on } },
        };
      }),
      setQudosPermission: (key, on) => set((s) => ({
        qudosPermissions: { ...s.qudosPermissions, [key]: !!on },
      })),
      setQudosActiveApp: (appId) => set({ qudosActiveAppId: appId || null }),
      updateQudosOverlay: (patch) => set((s) => ({
        qudosOverlay: { ...s.qudosOverlay, ...patch },
      })),
      updateQudosPrivacy: (patch) => set((s) => ({
        qudosPrivacy: { ...s.qudosPrivacy, ...patch },
      })),
      excludeQudosApp: (appId) => set((s) => ({
        qudosPrivacy: {
          ...s.qudosPrivacy,
          excludeApps: s.qudosPrivacy.excludeApps.includes(appId)
            ? s.qudosPrivacy.excludeApps.filter((id) => id !== appId)
            : [...s.qudosPrivacy.excludeApps, appId],
        },
      })),
      pauseQudos: (paused = true) => set((s) => ({
        qudosPrivacy: { ...s.qudosPrivacy, paused: !!paused },
      })),
      // ─── Qudos session lifecycle ──────────────────────────────────────────
      // A Qudos session creates a corresponding Job record and emits Events so
      // the Agents → Jobs → Events tabs all surface the same activity.
      // TODO (backend): replace local-only state with:
      //   POST /api/v2/qudos/sessions { appId, task, agent, capabilities }
      //     → { id, jobId, status }
      //   POST /api/v2/qudos/sessions/:id/pause
      //   POST /api/v2/qudos/sessions/:id/stop
      //   WS  /api/ws/qudos/events     ← step + suggestion stream
      // The frontend already produces the same shape; swap the body of these
      // three actions to dispatch the HTTP/WS calls when the backend lands.
      startQudosSession: (appId, taskTitle, opts = {}) => {
        const id = crypto.randomUUID();
        const jobId = crypto.randomUUID();
        const now = Date.now();
        const agent = opts.agent || "openclaw";
        const capabilities = opts.capabilities || get().qudosCapabilitiesByApp?.[appId] || { watch: true, suggest: true, act: false, launch: true };
        const session = {
          id,
          jobId,
          appId: appId || null,
          task: taskTitle || "Untitled task",
          agent,
          capabilities,
          status: "running",
          createdAt: now,
          updatedAt: now,
          steps: [{ id: crypto.randomUUID(), label: "Session created", done: true, ts: now }],
        };
        const job = {
          id: jobId,
          name: `Qudos · ${taskTitle || "Untitled"}`,
          status: "running",
          progress: 5,
          agent,
          started: now,
          source: "qudos",
          sessionId: id,
        };
        set((s) => ({
          qudosSessions: [session, ...s.qudosSessions].slice(0, 50),
          jobs: [job, ...s.jobs.filter((j) => j.id !== jobId)].slice(0, 200),
        }));
        get().addEvent?.({ id: crypto.randomUUID(), ts: now, type: "qudos.session.start", payload: { sessionId: id, jobId, appId, taskTitle, agent } });
        return { sessionId: id, jobId };
      },
      pauseQudosSession: (id) => set((s) => {
        const session = s.qudosSessions.find((q) => q.id === id);
        if (!session) return {};
        const nextStatus = session.status === "paused" ? "running" : "paused";
        const ts = Date.now();
        get().addEvent?.({ id: crypto.randomUUID(), ts, type: "qudos.session.pause", payload: { sessionId: id, jobId: session.jobId, status: nextStatus } });
        return {
          qudosSessions: s.qudosSessions.map((q) => q.id === id ? { ...q, status: nextStatus, updatedAt: ts } : q),
          jobs: s.jobs.map((j) => j.id === session.jobId ? { ...j, status: nextStatus } : j),
        };
      }),
      stopQudosSession: (id) => set((s) => {
        const session = s.qudosSessions.find((q) => q.id === id);
        if (!session) return {};
        const ts = Date.now();
        get().addEvent?.({ id: crypto.randomUUID(), ts, type: "qudos.session.stop", payload: { sessionId: id, jobId: session.jobId } });
        return {
          qudosSessions: s.qudosSessions.map((q) => q.id === id ? { ...q, status: "completed", updatedAt: ts } : q),
          jobs: s.jobs.map((j) => j.id === session.jobId ? { ...j, status: "completed", progress: 100 } : j),
        };
      }),
      appendQudosStep: (id, label) => set((s) => {
        const ts = Date.now();
        const session = s.qudosSessions.find((q) => q.id === id);
        if (!session) return {};
        get().addEvent?.({ id: crypto.randomUUID(), ts, type: "qudos.session.step", payload: { sessionId: id, jobId: session.jobId, label } });
        return {
          qudosSessions: s.qudosSessions.map((q) => q.id === id
            ? { ...q, updatedAt: ts, steps: [...(q.steps || []), { id: crypto.randomUUID(), label, done: true, ts }] }
            : q
          ),
          jobs: s.jobs.map((j) => j.id === session.jobId ? { ...j, updatedAt: ts, progress: Math.min(95, (j.progress || 0) + 7) } : j),
        };
      }),
      // ─── Suggestions feed ─────────────────────────────────────────────────
      // TODO (backend): replace with WS /api/ws/qudos/suggestions push +
      //   POST /api/v2/qudos/suggestions/:id/approve
      //   POST /api/v2/qudos/suggestions/:id/dismiss
      addQudosSuggestion: (suggestion) => {
        const ts = Date.now();
        const item = { id: crypto.randomUUID(), createdAt: ts, status: "pending", ...suggestion };
        get().addEvent?.({ id: crypto.randomUUID(), ts, type: "qudos.suggestion", payload: { suggestionId: item.id, sessionId: item.sessionId, appId: item.appId, text: item.text } });
        set((s) => ({ qudosSuggestions: [item, ...s.qudosSuggestions].slice(0, 100) }));
        return item.id;
      },
      resolveQudosSuggestion: (id, decision) => set((s) => {
        const ts = Date.now();
        const next = s.qudosSuggestions.map((q) => q.id === id ? { ...q, status: decision, resolvedAt: ts } : q);
        const target = next.find((q) => q.id === id);
        if (target) get().addEvent?.({ id: crypto.randomUUID(), ts, type: "qudos.suggestion.resolve", payload: { suggestionId: id, sessionId: target.sessionId, decision } });
        return { qudosSuggestions: next };
      }),
      
      // Thread actions
      createThread: (title) => {
        const id = crypto.randomUUID();
        const currentModel = get().activeModel;
        const now = Date.now();
        const thread = { id, title: title || "New thread", runtime: "openclaw", messages: [], createdAt: now, updatedAt: now, spaceId: null, modelId: currentModel };
        set((s) => ({ threads: [thread, ...s.threads], activeThreadId: id, messages: [] }));
        return id;
      },
      setActiveThread: (threadId) => {
        // Save current thread's messages directly from global state
        const { activeThreadId: prevId, messages: prevMsgs, threads, activeModel: prevModel } = get();
        let updatedThreads = threads;
        if (prevId) {
          updatedThreads = threads.map(t => t.id === prevId ? { ...t, messages: Array.isArray(prevMsgs) ? prevMsgs : [], modelId: prevModel ?? t.modelId, updatedAt: Date.now() } : t);
        }
        // Load target thread
        const thread = updatedThreads.find(t => t.id === threadId);
        set({
          threads: updatedThreads,
          activeThreadId: threadId,
          messages: Array.isArray(thread?.messages) ? thread.messages : [],
          activeModel: thread?.modelId || null,
          // DO NOT touch streamingMessage — UI filters by threadId
        });
      },
      saveThreadMessages: () => {
        const { activeThreadId, messages, threads, activeModel } = get();
        if (!activeThreadId) return;
        set({ threads: threads.map(t => t.id === activeThreadId ? { ...t, messages: Array.isArray(messages) ? messages : [], title: messages[0]?.content?.slice(0, 40) || t.title, modelId: activeModel ?? t.modelId, updatedAt: Date.now() } : t) });
      },
      deleteThread: (threadId) => set((s) => {
        const clearStream = s.streamingMessage?.threadId === threadId;
        return {
          threads: s.threads.filter(t => t.id !== threadId),
          activeThreadId: s.activeThreadId === threadId ? null : s.activeThreadId,
          messages: s.activeThreadId === threadId ? [] : s.messages,
          ...(clearStream ? { streamingMessage: null, pendingRunId: null } : {}),
        };
      }),
      assignThreadToSpace: (threadId, spaceId) => set((s) => ({
        threads: s.threads.map(t => t.id === threadId ? { ...t, spaceId } : t)
      })),
      
      // Space actions
      addSpace: (name, icon, color) => {
        const SPACE_AUTO_COLORS = [
          "#3b82f6", "#ec4899", "#22c55e", "#f59e0b", "#8b5cf6",
          "#06b6d4", "#ef4444", "#84cc16", "#e879f9", "#fb923c",
          "#14b8a6", "#f43f5e", "#a3e635", "#818cf8", "#fbbf24",
        ];
        const id = `space-${crypto.randomUUID().slice(0, 8)}`;
        const autoColor = color || SPACE_AUTO_COLORS[get().spaces.length % SPACE_AUTO_COLORS.length];
        set((s) => ({ spaces: [...s.spaces, { id, name, description: "", icon: icon || "Folder", color: autoColor }] }));
        return id;
      },
      deleteSpace: (spaceId) => set((s) => ({
        spaces: s.spaces.filter(sp => sp.id !== spaceId),
        threads: s.threads.map(t => t.spaceId === spaceId ? { ...t, spaceId: null } : t),
      })),
      
      // Settings
      userProfile: { name: "Meg", email: "", customInstructions: "" },
      theme: "dark",
      defaultModel: null,
      setUserProfile: (profile) => set((s) => ({ userProfile: { ...s.userProfile, ...profile } })),
      setTheme: (theme) => set({ theme }),
      setDefaultModel: (defaultModel) => set({ defaultModel }),
      
      // Initialize connection
      initGateway: async () => {
        set({ status: "connecting" });
        await new Promise(r => setTimeout(r, 1500));
        set({ status: "connected", clawStatus: { state: "Scheduled" } });
        await get().fetchPendingApprovals();
        await get().fetchApprovalHistory();
        await get().fetchModelGroups({ refresh: true });
        get().connectApprovalsWebSocket();
      },
      
      // Switch model — also persist to current thread immediately
      setChatParameters: (patch) => set((state) => ({ chatParameters: { ...state.chatParameters, ...patch } })),
      resetChatParameters: () => set((state) => {
        const defaults = { temperature: 0.1, top_p: 0.3, top_k: 40, max_tokens: 8192, frequency_penalty: 0.2, presence_penalty: 0.1 };
        const locked = state.lockedParameters || {};
        const next = {};
        for (const k of Object.keys(defaults)) {
          next[k] = locked[k] ? (state.chatParameters?.[k] ?? defaults[k]) : defaults[k];
        }
        return { chatParameters: next };
      }),
      toggleParameterLock: (key) => set((state) => ({
        lockedParameters: { ...state.lockedParameters, [key]: !state.lockedParameters?.[key] },
      })),
      setVoiceSetting: (key, value) => set((state) => ({
        voiceSettings: { ...state.voiceSettings, [key]: value },
      })),
      setDisableSystemPrompt: (value) => set({ disableSystemPrompt: !!value }),

      switchModel: async (modelId) => {
        const { activeThreadId, threads, streamingMessage, stopGenerating, models, addEvent } = get();
        const selected = models.find((m) => m.id === modelId);
        if (selected?.disabled) {
          const reason = selected.disabledReason || "Provider bridge pending";
          set({ lastError: reason });
          addEvent({ id: crypto.randomUUID(), ts: Date.now(), type: "model.not_routable", payload: { model: modelId, reason } });
          return false;
        }

        try {
          const res = await fetch(apiUrl("/api/v2/models/resolve"), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ model: modelId }),
          });
          if (res.ok) {
            const resolved = await res.json();
            if (resolved?.status === "not_routable" || resolved?.adapterReady === false) {
              const reason = resolved?.reason || "Provider bridge pending";
              set({ lastError: reason });
              addEvent({ id: crypto.randomUUID(), ts: Date.now(), type: "model.not_routable", payload: { model: modelId, reason } });
              return false;
            }
          }
        } catch {
          // If resolver endpoint is unreachable, allow selection and let chat.error handle it.
        }

        if (streamingMessage?.threadId === activeThreadId) {
          stopGenerating();
        }
        set({ activeModel: modelId });
        if (activeThreadId) {
          set({ threads: threads.map(t => t.id === activeThreadId ? { ...t, modelId } : t) });
        }
        addEvent({
          id: crypto.randomUUID(),
          ts: Date.now(),
          type: "model.switch",
          payload: { model: modelId }
        });
        return true;
      },
      
      // Send message — thread-isolated with real gateway connection
      sendMessage: async (text) => {
        const {
          activeThreadId, createThread, assignThreadToSpace, addEvent, activeModel,
          chatParameters, voiceSettings, disableSystemPrompt,
        } = get();
        
        // Auto-create thread if none active
        let threadId = activeThreadId;
        if (!threadId) {
          threadId = createThread(text.slice(0, 40));
          const routedSpace = autoRouteThread(text);
          if (routedSpace) {
            assignThreadToSpace(threadId, routedSpace);
          }
        }
        
        // Add user message to the specific thread
        const userMsg = { id: crypto.randomUUID(), role: "user", content: text, timestamp: Date.now() };
        get()._addMessageToThread(threadId, userMsg);
        
        addEvent({ id: crypto.randomUUID(), ts: Date.now(), type: "message.sent", payload: { content: text.slice(0, 50) } });
        
        // Start streaming — tagged with threadId
        const runId = crypto.randomUUID();
        set({ pendingRunId: runId, streamingMessage: { id: crypto.randomUUID(), runId, threadId, content: "" } });
        armStreamTimer(threadId, runId, get, set);
        
        // Single-bot mode: runtime is always 'openclaw'. Backend frame keeps
        // the field for contract compatibility.
        const runtime = "openclaw";
        
        if (!gatewayWs || gatewayWs.readyState !== WebSocket.OPEN) {
          await get().connectGateway(threadId, runtime);
          // Wait for WS to actually OPEN (up to 5s)
          const start = Date.now();
          while (gatewayWs && gatewayWs.readyState === 0 && Date.now() - start < 5000) {
            await new Promise(r => setTimeout(r, 50));
          }
        }

        // Ensure backend websocket is bound to the intended runtime/thread before send.
        if (gatewayWs && gatewayWs.readyState === WebSocket.OPEN) {
          gatewayWs.send(JSON.stringify({
            type: "connect",
            threadId,
            runtime,
          }));
        }
        
        // Send message to chat WebSocket
        const messagePayload = {
          type: "chat.message",
          id: runId,
          threadId: threadId,
          runtime,
          content: text,
          model: activeModel || "huggingface/Qwen/Qwen3-Coder-480B-A35B-Instruct",
          parameters: chatParameters,
          options: {
            disableSystemPrompt: !!disableSystemPrompt,
            voice: voiceSettings,
          },
          timestamp: Date.now(),
        };
        
        if (gatewayWs && gatewayWs.readyState === WebSocket.OPEN) {
          gatewayWs.send(JSON.stringify(messagePayload));
        } else {
          clearStreamTimer(threadId);
          set({ streamingMessage: null, pendingRunId: null, status: "connected", lastError: "Gateway WebSocket is not connected. Please try again." });
          get()._addMessageToThread(threadId, {
            id: crypto.randomUUID(),
            role: "assistant",
            content: "❌ Gateway is not connected. Please try again.",
            timestamp: Date.now(),
          });
          return { ok: false, error: "gateway websocket not connected" };
        }
        
        return { ok: true };
      },
      
      // Connect to backend chat WebSocket (which forwards to OpenClaw gateway)
      connectGateway: async (threadId = "default-thread", runtime = DEFAULT_RUNTIME) => {
        const { addEvent } = get();

        // StrictMode double-mount guard: if there's already an OPEN or CONNECTING
        // socket, reuse it instead of tearing it down and racing a new one.
        // (WebSocket.readyState: 0=CONNECTING, 1=OPEN, 2=CLOSING, 3=CLOSED)
        if (gatewayWs && (gatewayWs.readyState === 0 || gatewayWs.readyState === 1)) {
          return;
        }

        if (gatewayWs) {
          // Existing socket is CLOSING/CLOSED — clear its handlers so they
          // don't flip the UI to disconnected as we re-open.
          gatewayWs.onclose = null;
          gatewayWs.onerror = null;
          try { gatewayWs.close(); } catch {}
        }
        
        try {
          const chatWsUrl = wsUrl("/api/ws/chat");
          gatewayWs = new WebSocket(chatWsUrl);
          
          gatewayWs.onopen = () => {
            console.log("Connected to backend chat WebSocket");
            set({ status: "connected", lastError: null });
            addEvent({ id: crypto.randomUUID(), ts: Date.now(), type: "gateway.connected", payload: {} });
            
            // Send connect message to initialize gateway connection
            if (gatewayWs && gatewayWs.readyState === WebSocket.OPEN) {
              const connectMessage = {
                type: "connect",
                threadId,
                runtime,
              };
              gatewayWs.send(JSON.stringify(connectMessage));
            }
            
            // Clear any reconnect timer
            if (gatewayWsReconnectTimer) {
              clearTimeout(gatewayWsReconnectTimer);
              gatewayWsReconnectTimer = null;
            }
          };
          
          gatewayWs.onmessage = (event) => {
            try {
              const data = JSON.parse(event.data);
              
              switch (data.type) {
                case "chat.chunk": {
                  const { streamingMessage } = get();
                  if (streamingMessage && streamingMessage.runId === data.runId) {
                    const threadId = data.threadId || streamingMessage.threadId;
                    armStreamTimer(threadId, data.runId, get, set);
                    const newContent = streamingMessage.content + data.chunk;
                    set({ streamingMessage: { ...streamingMessage, threadId, content: newContent } });
                  }
                  break;
                }
                  
                case "chat.complete": {
                  const { pendingRunId: currentRunId, streamingMessage } = get();
                  if (currentRunId === data.runId || streamingMessage?.runId === data.runId) {
                    clearStreamTimer(data.threadId || streamingMessage?.threadId);
                    const assistantMsg = {
                      id: crypto.randomUUID(),
                      role: "assistant",
                      content: data.content,
                      timestamp: Date.now(),
                    };
                    get()._addMessageToThread(data.threadId, assistantMsg);
                    set({ streamingMessage: null, pendingRunId: null });
                    addEvent({ id: crypto.randomUUID(), ts: Date.now(), type: "message.complete", payload: { runId: data.runId, threadId: data.threadId } });
                  }
                  break;
                }
                  
                case "chat.error": {
                  const { pendingRunId: currentRunId, streamingMessage, _addMessageToThread } = get();
                  const isActiveRun = !data.runId || currentRunId === data.runId || streamingMessage?.runId === data.runId;
                  const threadId = data.threadId || (isActiveRun ? streamingMessage?.threadId : null);
                  const errorText = data.error || "The backend reported an error.";
                  const userError = "❌ Something went wrong while generating the response. Please try again.";

                  if (isActiveRun) {
                    clearStreamTimer(threadId);
                    // Clear streaming state but KEEP status "connected" so the input
                    // unlocks immediately. lastError keeps the error visible to the UI.
                    set({ streamingMessage: null, pendingRunId: null, lastError: errorText, status: "connected" });
                    if (threadId) {
                      _addMessageToThread(threadId, {
                        id: crypto.randomUUID(),
                        role: "assistant",
                        content: userError,
                        timestamp: Date.now(),
                      });
                    }
                  } else {
                    // Don't flip global status for an unrelated thread's error.
                    set({ lastError: errorText });
                  }

                  addEvent({ id: crypto.randomUUID(), ts: Date.now(), type: "gateway.error", payload: { error: errorText, runId: data.runId, threadId, activeRun: isActiveRun } });
                  break;
                }
                  
                case "tool.permission_request":
                  // Forward to approval system
                  addEvent({ id: crypto.randomUUID(), ts: Date.now(), type: "approval.requested", payload: data });
                  break;
                  
                default:
                  console.log("Unknown gateway message:", data);
              }
            } catch (err) {
              console.error("Failed to parse gateway message:", err);
            }
          };
          
          gatewayWs.onclose = () => {
            console.log("Gateway connection closed");
            
            const { streamingMessage, pendingRunId, _addMessageToThread, lastError } = get();
            if ((streamingMessage || pendingRunId) && lastError !== "WebSocket error") {
              const threadId = streamingMessage?.threadId;
              clearStreamTimer(threadId);
              set({ streamingMessage: null, pendingRunId: null });
              
              if (threadId) {
                _addMessageToThread(threadId, {
                  id: crypto.randomUUID(),
                  role: "assistant",
                  content: "❌ Connection closed unexpectedly. Please try again.",
                  timestamp: Date.now(),
                });
              }
            }
            
            set({ status: "disconnected" });
            
            // Attempt reconnect
            if (!gatewayWsReconnectTimer) {
              gatewayWsReconnectTimer = setTimeout(() => {
                gatewayWsReconnectTimer = null;
                get().connectGateway();
              }, 5000);
            }
          };
          
          gatewayWs.onerror = (error) => {
            console.error("Gateway error:", error);
            
            const { streamingMessage, pendingRunId, _addMessageToThread } = get();
            if (streamingMessage || pendingRunId) {
              const threadId = streamingMessage?.threadId;
              clearStreamTimer(threadId);
              set({ streamingMessage: null, pendingRunId: null });
              
              if (threadId) {
                _addMessageToThread(threadId, {
                  id: crypto.randomUUID(),
                  role: "assistant",
                  content: "❌ WebSocket error occurred. Please try again.",
                  timestamp: Date.now(),
                });
              }
            }
            
            set({ status: "error", lastError: "WebSocket error" });
          };
          
        } catch (err) {
          console.error("Failed to connect to gateway:", err);
          set({ status: "error", lastError: err.message });
        }
      },
      
      // Disconnect from gateway
      disconnectGateway: () => {
        if (gatewayWs) {
          gatewayWs.close();
          gatewayWs = null;
        }
        if (gatewayWsReconnectTimer) {
          clearTimeout(gatewayWsReconnectTimer);
          gatewayWsReconnectTimer = null;
        }
        set({ status: "disconnected" });
      },

      // Init function - connects to gateway. Idempotent: safe to call from
      // React 19 StrictMode (which mounts components twice in dev) without
      // racing two parallel WebSocket opens. If a socket is already open or
      // a connect is in flight, skip re-entry; the existing socket is reused.
      initGateway: async () => {
        const { connectGateway, fetchModelGroups, connectActivitiesWebSocket, status } = get();
        // Bail out if already connected or actively connecting.
        if (status === "connected" || status === "connecting") {
          // Still refresh models in case they're stale, but don't re-open WS.
          fetchModelGroups({ refresh: false }).catch(() => null);
          // Make sure activities WS is up — cheap idempotent call.
          connectActivitiesWebSocket();
          return;
        }
        set({ status: "connecting" });
        await connectGateway();
        await fetchModelGroups({ refresh: true });
        // Sprint 4 — subscribe to /api/ws/activities for the global feed.
        // Idempotent; safe to call from any page.
        connectActivitiesWebSocket();
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
      version: 4,
      migrate: (persisted, version) => {
        if (version < 3) {
          return { ...persisted, spaces: DEFAULT_SPACES, threads: [], activeThreadId: null };
        }
        if (version < 4) {
          // v4: added top_k default + lockedParameters + voiceSettings + disableSystemPrompt
          return {
            ...persisted,
            chatParameters: {
              temperature: 0.1, top_p: 0.3, top_k: 40, max_tokens: 8192,
              frequency_penalty: 0.2, presence_penalty: 0.1,
              ...(persisted?.chatParameters || {}),
            },
            lockedParameters: persisted?.lockedParameters || {
              temperature: false, top_p: false, top_k: false,
              max_tokens: false, frequency_penalty: false, presence_penalty: false,
            },
            voiceSettings: persisted?.voiceSettings || { ttsVoice: "Emma", conversationVoice: "Eve", playbackSpeed: 1 },
            disableSystemPrompt: !!persisted?.disableSystemPrompt,
          };
        }
        return persisted;
      },
      partialize: (s) => ({
        activeModel: s.activeModel,
        chatParameters: s.chatParameters,
        lockedParameters: s.lockedParameters,
        voiceSettings: s.voiceSettings,
        disableSystemPrompt: s.disableSystemPrompt,
        connectors: s.connectors,
        enabledSkills: s.enabledSkills,
        writingStyle: s.writingStyle,
        webSearchEnabled: s.webSearchEnabled,
        toolAccess: s.toolAccess,
        threads: s.threads,
        activeThreadId: s.activeThreadId,
        spaces: s.spaces,
        userProfile: s.userProfile,
        theme: s.theme,
        defaultModel: s.defaultModel,
        dataControls: s.dataControls,
        security: s.security,
        activeRuntime: s.activeRuntime,
        customSkills: s.customSkills,
        customConnectors: s.customConnectors,
        customPlugins: s.customPlugins,
        qudosEnabledApps: s.qudosEnabledApps,
        qudosCapabilitiesByApp: s.qudosCapabilitiesByApp,
        qudosPermissions: s.qudosPermissions,
        qudosOverlay: s.qudosOverlay,
        qudosPrivacy: s.qudosPrivacy,
      }),
      onRehydrateStorage: () => (state) => {
        if (state?.threads?.length) {
          const migratedThreads = state.threads.map((thread) => ({
            ...thread,
            // Force single-bot mode: any historical hermes/meta thread becomes openclaw.
            runtime: "openclaw",
          }));
          useGateway.setState({ threads: migratedThreads });
        }

        // After rehydration, load active thread's messages into global state
        if (state?.activeThreadId && state?.threads) {
          const thread = state.threads.find(t => t.id === state.activeThreadId);
          if (thread?.messages?.length > 0) {
            useGateway.setState({ messages: thread.messages });
          }
        }
      },
    }
  )
);

// ─────────────────────────────────────────────────────────────────────────────
// Agents health derivation
// Returns a single object the UI can read anywhere:
//   { state: "healthy" | "warning" | "stalled" | "error" | "loading",
//     lastWatcherAt, ageMs, label, detail, env, findingsCount, runningCount }
// "warning" = watcher reported environment problems (e.g. missing API keys)
// "stalled" = watcher hasn't ticked in >2 minutes
// "error"   = backend agent fetch failed
// ─────────────────────────────────────────────────────────────────────────────
const WATCHER_STALL_MS = 2 * 60 * 1000;
// Only failures within this window count toward live "error" state.
// Anything older is treated as historical backlog and ignored by the pill.
const RECENT_FAILURE_WINDOW_MS = 30 * 60 * 1000;

const parseWatcherFindings = (text) => {
  const out = { ok: true, items: [] };
  if (!text) return out;
  const checks = String(text).split("\n");
  for (const line of checks) {
    const m = line.match(/^([A-Z][^:]+):\s*(.+)$/);
    if (!m) continue;
    const key = m[1].trim();
    const val = m[2].trim();
    // Treat "false" / "missing" / "0KB" / "not found" as warnings
    if (/false|missing|not found|0kb/i.test(val)) {
      out.ok = false;
      out.items.push({ key, val, severity: "warn" });
    }
  }
  return out;
};

// PURE selector — no Date.now(), no wall-clock derivations. Output only changes
// when underlying store state changes, so useShallow can stabilise it.
// Time-derived strings (e.g. "5s ago") live in formatHealthDetail() below and
// are recomputed inline by the consumer at render time.
export const selectAgentsHealth = (state) => {
  const { agentTasks, agentTasksError, agentTasksLoading, agentTasksLastUpdated, status } = state;
  if (agentTasksError) {
    return {
      state: "error",
      label: "Agents offline",
      staticDetail: agentTasksError,
      lastWatcherAt: null,
      envOk: false,
      envItemCount: 0,
      failedFirstResult: null,
      findingsCount: 0,
      runningCount: 0,
      historicalFailureCount: 0,
    };
  }
  if (!agentTasks?.length && agentTasksLoading) {
    return {
      state: "loading", label: "Loading agents…", staticDetail: null,
      lastWatcherAt: null, envOk: true, envItemCount: 0,
      failedFirstResult: null, findingsCount: 0, runningCount: 0,
      historicalFailureCount: 0,
    };
  }
  const watchers = (agentTasks || []).filter((t) => t.agent === "watcher" && t.status === "done");
  const latest = watchers[0];
  const lastAt = latest?.completedAt || latest?.createdAt || null;
  const env = parseWatcherFindings(latest?.result || "");

  // For "live" health we only count failures within the recent window so
  // long-stale orphaned tasks (e.g. abandoned at a previous gateway crash)
  // don't keep the pill red forever. agentTasksLastUpdated is the store's
  // stable "now" reference — uses Date.now() only at poll time, not at every
  // render — so the selector stays pure for Zustand's shallow equality.
  const nowRef = agentTasksLastUpdated || lastAt || 0;
  const allFailed = (agentTasks || []).filter((t) => t.status === "failed");
  const recentFailed = allFailed.filter((t) => {
    const ts = t.completedAt || t.createdAt || 0;
    return nowRef - ts <= RECENT_FAILURE_WINDOW_MS;
  });
  const runningCount = (agentTasks || []).filter((t) => t.status === "running").length;
  const findingsCount = recentFailed.length + (env.ok ? 0 : env.items.length);

  if (!lastAt) {
    return {
      state: status === "connected" ? "loading" : "error",
      label: status === "connected" ? "Waiting for watcher…" : "Gateway offline",
      staticDetail: null,
      lastWatcherAt: null,
      envOk: env.ok, envItemCount: env.items.length,
      failedFirstResult: null,
      findingsCount, runningCount,
      historicalFailureCount: allFailed.length,
    };
  }
  if (recentFailed.length > 0) {
    return {
      state: "error",
      label: `${recentFailed.length} failed task${recentFailed.length === 1 ? "" : "s"}`,
      staticDetail: recentFailed[0]?.result?.slice(0, 120) || null,
      lastWatcherAt: lastAt,
      envOk: env.ok, envItemCount: env.items.length,
      failedFirstResult: recentFailed[0]?.result?.slice(0, 120) || null,
      findingsCount, runningCount,
      historicalFailureCount: allFailed.length,
    };
  }
  if (!env.ok) {
    return {
      state: "warning",
      label: "Watcher: env warnings",
      staticDetail: env.items.map((i) => `${i.key}: ${i.val}`).join(" · "),
      lastWatcherAt: lastAt,
      envOk: false, envItemCount: env.items.length,
      failedFirstResult: null,
      findingsCount, runningCount,
      historicalFailureCount: allFailed.length,
    };
  }
  // Healthy or stalled — distinguished by formatHealthDetail() at render time
  // (state field stays "healthy" here; consumer can re-classify visually).
  return {
    state: "healthy",
    label: "Healthy",
    staticDetail: null,
    lastWatcherAt: lastAt,
    envOk: true, envItemCount: 0,
    failedFirstResult: null,
    findingsCount, runningCount,
    historicalFailureCount: allFailed.length,
  };
};

/**
 * formatHealthDetail(health) — consumer-side derivation of the wall-clock
 * detail string. Call this inline in render; it's NOT in the selector so
 * Date.now() never destabilises Zustand's equality check.
 *
 * Also re-classifies "healthy" as "stalled" if the last watcher tick is too old.
 */
export function formatHealthDetail(health) {
  if (!health) return { state: "loading", detail: null };
  // Static detail wins (errors, env warnings, failed tasks).
  if (health.staticDetail) return { state: health.state, detail: health.staticDetail };
  if (!health.lastWatcherAt) return { state: health.state, detail: null };

  const ageMs = Date.now() - health.lastWatcherAt;
  if (ageMs > WATCHER_STALL_MS) {
    return {
      state: "stalled",
      detail: `Last tick ${Math.floor(ageMs / 60000)} min ago`,
    };
  }
  if (health.state === "healthy") {
    return {
      state: "healthy",
      detail: `Watcher ticked ${Math.max(1, Math.floor(ageMs / 1000))}s ago`,
    };
  }
  return { state: health.state, detail: null };
}

// Boot a single global polling loop the moment the store first hydrates so
// the Layout health pill works on every page, not only when AgentsPage is mounted.
let __agentsPollTimer = null;
const startAgentsPolling = () => {
  if (__agentsPollTimer || typeof window === "undefined") return;
  const tick = () => useGateway.getState().fetchAgentTasks?.({ silent: true });
  // Initial fetch on next macrotask so the store is fully constructed
  setTimeout(tick, 50);
  __agentsPollTimer = setInterval(tick, 15_000);
};
if (typeof window !== "undefined") {
  // Defer until store definition has executed
  setTimeout(startAgentsPolling, 0);
}

// Export helper functions
export const initGateway = () => useGateway.getState().initGateway();
export const sendMessage = (text) => useGateway.getState().sendMessage(text);
export const switchModel = (modelId) => useGateway.getState().switchModel(modelId);
export const executeCommand = (cmd) => useGateway.getState().executeCommand(cmd);
export const connectGateway = () => useGateway.getState().connectGateway();
export const disconnectGateway = () => useGateway.getState().disconnectGateway();
