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
      { id: "opencode/claude-opus-4-6", name: "Claude Opus 4.6", caps: { vision: true, coding: true, tools: true, files: true, reasoning: true, fast: false }, costTier: "$$$", context: "200K" },
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
      { id: "openrouter/anthropic/claude-opus-4.6", name: "Claude Opus 4.6", caps: { vision: true, coding: true, tools: true, files: true, reasoning: true, fast: false }, costTier: "$$$", context: "200K" },
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
      { id: "venice/claude-opus-4-6", name: "Claude Opus 4.6", caps: { vision: true, coding: true, tools: true, files: true, reasoning: true, fast: false }, costTier: "$$$", context: "200K" },
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
      stopGenerating: () => set({ streamingMessage: null }),
      
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
      clearAllThreads: () => set({ threads: [], activeThreadId: null, messages: [] }),
      
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
      
      // Thread actions
      createThread: (title) => {
        const id = crypto.randomUUID();
        const thread = { id, title: title || "New thread", messages: [], createdAt: Date.now(), spaceId: null, modelId: get().activeModel };
        set((s) => ({ threads: [thread, ...s.threads], activeThreadId: id, messages: [] }));
        return id;
      },
      setActiveThread: (threadId) => {
        get().saveThreadMessages();
        const { threads } = get();
        const thread = threads.find(t => t.id === threadId);
        set({ activeThreadId: threadId, messages: thread ? thread.messages : [], ...(thread?.modelId ? { activeModel: thread.modelId } : {}) });
      },
      saveThreadMessages: () => {
        const { activeThreadId, messages, threads, activeModel } = get();
        if (!activeThreadId) return;
        set({ threads: threads.map(t => t.id === activeThreadId ? { ...t, messages, title: messages[0]?.content?.slice(0, 40) || t.title, modelId: activeModel } : t) });
      },
      deleteThread: (threadId) => set((s) => ({
        threads: s.threads.filter(t => t.id !== threadId),
        activeThreadId: s.activeThreadId === threadId ? null : s.activeThreadId,
        messages: s.activeThreadId === threadId ? [] : s.messages,
      })),
      assignThreadToSpace: (threadId, spaceId) => set((s) => ({
        threads: s.threads.map(t => t.id === threadId ? { ...t, spaceId } : t)
      })),
      
      // Space actions
      addSpace: (name, icon, color) => {
        const id = `space-${crypto.randomUUID().slice(0, 8)}`;
        set((s) => ({ spaces: [...s.spaces, { id, name, description: "", icon: icon || "Folder", color: color || "#888" }] }));
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
        const { addMessage, setStreamingMessage, setPendingRunId, addEvent, activeThreadId, createThread, saveThreadMessages } = get();
        
        // Auto-create thread if none active
        if (!activeThreadId) { createThread(text.slice(0, 40)); }
        
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
        
        // Auto-save thread
        get().saveThreadMessages();
        
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
    }
  )
);

// Export helper functions
export const initGateway = () => useGateway.getState().initGateway();
export const sendMessage = (text) => useGateway.getState().sendMessage(text);
export const switchModel = (modelId) => useGateway.getState().switchModel(modelId);
export const executeCommand = (cmd) => useGateway.getState().executeCommand(cmd);
