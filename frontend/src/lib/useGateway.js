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

const getApiBase = () => (BACKEND_URL ? BACKEND_URL.replace(/\/$/, "") : "");
const apiUrl = (path) => `${getApiBase()}${path}`;
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
      activeRuntime: DEFAULT_RUNTIME,
      runtimeMeta: RUNTIME_META,
      
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
      
      // Spaces
      spaces: DEFAULT_SPACES,
      
      // Conversation threads
      threads: [],
      activeThreadId: null,
      
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
      setActiveRuntime: (activeRuntime) => set({ activeRuntime }),
      getRuntimeForActiveThread: () => {
        const { activeThreadId, threads, activeRuntime } = get();
        const thread = activeThreadId ? threads.find((t) => t.id === activeThreadId) : null;
        return thread?.runtime || activeRuntime;
      },
      setActiveModel: (activeModel) => set({ activeModel }),
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
        const { streamingMessage } = get();
        if (streamingMessage) {
          set({ streamingMessage: null, pendingRunId: null });
        }
      },
      
      // Events
      addEvent: (evt) => set((s) => ({ events: [...s.events.slice(-499), evt] })),
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
      
      // Thread actions
      createThread: (title) => {
        const id = crypto.randomUUID();
        const currentModel = get().activeModel;
        const currentRuntime = get().activeRuntime;
        const now = Date.now();
        const thread = { id, title: title || "New thread", runtime: currentRuntime, messages: [], createdAt: now, updatedAt: now, spaceId: null, modelId: currentModel };
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
        get().connectApprovalsWebSocket();
      },
      
      // Switch model — also persist to current thread immediately
      switchModel: async (modelId) => {
        const { activeThreadId, threads } = get();
        set({ activeModel: modelId });
        if (activeThreadId) {
          set({ threads: threads.map(t => t.id === activeThreadId ? { ...t, modelId } : t) });
        }
        get().addEvent({
          id: crypto.randomUUID(),
          ts: Date.now(),
          type: "model.switch",
          payload: { model: modelId }
        });
        return true;
      },
      
      // Send message — thread-isolated with real gateway connection
      sendMessage: async (text) => {
        const { activeThreadId, createThread, assignThreadToSpace, addEvent, activeModel, getRuntimeForActiveThread, activeRuntime } = get();
        
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
        
        // Resolve runtime from active thread first; fall back to active runtime toggle.
        const runtime = activeThreadId ? getRuntimeForActiveThread() : activeRuntime;
        
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
          timestamp: Date.now(),
        };
        
        if (gatewayWs && gatewayWs.readyState === WebSocket.OPEN) {
          gatewayWs.send(JSON.stringify(messagePayload));
        }
        
        return { ok: true };
      },
      
      // Connect to backend chat WebSocket (which forwards to OpenClaw gateway)
      connectGateway: async (threadId = "default-thread", runtime = DEFAULT_RUNTIME) => {
        const { addEvent } = get();
        
        if (gatewayWs) {
          gatewayWs.close();
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
                case "chat.chunk":
                  // Streaming response chunk
                  const { streamingMessage, pendingRunId } = get();
                  if (streamingMessage && streamingMessage.runId === data.runId) {
                    const newContent = streamingMessage.content + data.chunk;
                    set({ streamingMessage: { ...streamingMessage, content: newContent } });
                  }
                  break;
                  
                case "chat.complete":
                  // Message complete
                  const { pendingRunId: currentRunId } = get();
                  if (currentRunId === data.runId) {
                    const assistantMsg = {
                      id: crypto.randomUUID(),
                      role: "assistant",
                      content: data.content,
                      timestamp: Date.now(),
                    };
                    get()._addMessageToThread(data.threadId, assistantMsg);
                    set({ streamingMessage: null, pendingRunId: null });
                    addEvent({ id: crypto.randomUUID(), ts: Date.now(), type: "message.complete", payload: { runId: data.runId } });
                  }
                  break;
                  
                case "chat.error":
                  set({ lastError: data.error, status: "error" });
                  addEvent({ id: crypto.randomUUID(), ts: Date.now(), type: "gateway.error", payload: { error: data.error } });
                  break;
                  
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

      // Legacy init function - now connects to gateway
      initGateway: async () => {
        const { connectGateway } = get();
        set({ status: "connecting" });
        await connectGateway();
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
      version: 3,
      migrate: (persisted, version) => {
        if (version < 3) {
          return { ...persisted, spaces: DEFAULT_SPACES, threads: [], activeThreadId: null };
        }
        return persisted;
      },
      partialize: (s) => ({
        activeModel: s.activeModel,
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
        customSkills: s.customSkills,
        customConnectors: s.customConnectors,
        customPlugins: s.customPlugins,
      }),
      onRehydrateStorage: () => (state) => {
        if (state?.threads?.length) {
          const migratedThreads = state.threads.map((thread) => ({
            ...thread,
            runtime: thread.runtime || DEFAULT_RUNTIME,
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

// Export helper functions
export const initGateway = () => useGateway.getState().initGateway();
export const sendMessage = (text) => useGateway.getState().sendMessage(text);
export const switchModel = (modelId) => useGateway.getState().switchModel(modelId);
export const executeCommand = (cmd) => useGateway.getState().executeCommand(cmd);
export const connectGateway = () => useGateway.getState().connectGateway();
export const disconnectGateway = () => useGateway.getState().disconnectGateway();
