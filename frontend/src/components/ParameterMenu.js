import React, { useState, useEffect, useRef } from "react";
import {
  SlidersHorizontal, RotateCcw, Info, Play, Lock, Unlock, ChevronDown, ChevronUp,
} from "lucide-react";
import { useGateway } from "@/lib/useGateway";

/*
 * ParameterMenu
 * ----------------------------------------------------------------------------
 * A Venice-style "Advanced Settings" popover attached to the chat input.
 *
 * Reads/writes from the Zustand store:
 *   - chatParameters       { temperature, top_p, max_tokens, frequency_penalty, presence_penalty, top_k }
 *   - lockedParameters     { [key]: true }  → prevents Reset from clearing
 *   - voiceSettings        { ttsVoice, conversationVoice, playbackSpeed }
 *   - disableSystemPrompt  boolean (skip persona injection when true)
 *
 * All of these are already sent to the backend inside the chat.message frame's
 * `parameters` + `options` payload (see useGateway.sendMessage).
 */

const SLIDER_ROWS = [
  { key: "temperature",       label: "Temperature",       min: 0,    max: 2,     step: 0.01, hint: "Lower = focused. Higher = creative." },
  { key: "top_p",             label: "Top P",             min: 0,    max: 1,     step: 0.01, hint: "Nucleus sampling. 0.3 = tight, 1 = wide." },
  { key: "top_k",             label: "Top K",             min: 0,    max: 100,   step: 1,    hint: "Restrict to top-K tokens. 40 is common." },
  { key: "max_tokens",        label: "Max tokens",        min: 256,  max: 32768, step: 256,  hint: "Cap response length." },
  { key: "frequency_penalty", label: "Frequency penalty", min: -2,   max: 2,     step: 0.01, hint: "Reduce repeated phrases." },
  { key: "presence_penalty",  label: "Presence penalty",  min: -2,   max: 2,     step: 0.01, hint: "Encourage new topics." },
];

const VOICES = [
  "Emma", "Eve", "Aria", "Luna", "Orion", "Sage", "Marlowe", "Nova",
];
const PLAYBACK_SPEEDS = [
  { label: "0.75x", value: 0.75 },
  { label: "1x",    value: 1 },
  { label: "1.25x", value: 1.25 },
  { label: "1.5x",  value: 1.5 },
  { label: "2x",    value: 2 },
];

const fmt = (key, value) => {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  if (key === "max_tokens" || key === "top_k") return String(Math.round(value));
  return Number(value).toFixed(key === "temperature" || key === "top_p" ? 1 : 2);
};

function InfoDot({ text, theme }) {
  return (
    <span
      title={text}
      className="inline-flex items-center justify-center w-4 h-4 rounded-full cursor-help shrink-0"
      style={{ background: theme.surface2, border: `1px solid ${theme.border}`, color: theme.muted }}
    >
      <Info className="w-2.5 h-2.5" />
    </span>
  );
}

function VoiceRow({ label, hint, value, onChange, options, theme, showPlay }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 py-1.5">
      <div className="flex items-center gap-1.5 min-w-0">
        <span className="text-[12px] font-semibold truncate" style={{ color: theme.text }}>{label}</span>
        <InfoDot text={hint} theme={theme} />
      </div>
      <div className="flex items-center gap-1.5">
        {showPlay && (
          <button
            type="button"
            className="w-6 h-6 rounded-md flex items-center justify-center transition-colors"
            style={{ background: theme.surface2, border: `1px solid ${theme.border}`, color: theme.muted }}
            title="Preview voice (coming soon)"
            onClick={(e) => e.preventDefault()}
          >
            <Play className="w-3 h-3" />
          </button>
        )}
        <div className="relative">
          <select
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="appearance-none pl-2 pr-6 py-1.5 rounded-md text-[12px] font-medium focus:outline-none cursor-pointer max-w-[120px]"
            style={{ background: theme.surface2, border: `1px solid ${theme.border}`, color: theme.text }}
          >
            {options.map(o => (
              typeof o === "string"
                ? <option key={o} value={o}>{o}</option>
                : <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <ChevronDown className="w-3 h-3 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: theme.muted }} />
        </div>
      </div>
    </div>
  );
}

export function ParameterMenu({ runtimeTheme }) {
  const [open, setOpen] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(true);
  const panelRef = useRef(null);

  const {
    chatParameters,
    lockedParameters,
    voiceSettings,
    disableSystemPrompt,
    setChatParameters,
    resetChatParameters,
    toggleParameterLock,
    setVoiceSetting,
    setDisableSystemPrompt,
  } = useGateway();

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const theme = runtimeTheme;

  const update = (key, raw) => {
    const value = (key === "max_tokens" || key === "top_k")
      ? Math.round(Number(raw))
      : Number(raw);
    if (Number.isNaN(value)) return;
    setChatParameters({ [key]: value });
  };

  const locked = (key) => !!lockedParameters?.[key];

  return (
    <div ref={panelRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="h-7 w-7 flex items-center justify-center rounded-md transition-colors"
        style={{
          background: open ? theme.accent + "20" : theme.surface2,
          border: `1px solid ${open ? theme.accent + "60" : theme.border}`,
          color: open ? theme.accent : theme.muted,
        }}
        title="Model parameters & voice"
        data-testid="parameter-menu-btn"
      >
        <SlidersHorizontal className="w-3.5 h-3.5" />
      </button>

      {open && (
        <div
          className="absolute right-0 bottom-10 z-50 w-[min(92vw,360px)] max-h-[min(78vh,640px)] overflow-y-auto overscroll-contain rounded-2xl p-3 shadow-2xl backdrop-blur-2xl"
          style={{
            background: theme.surface,
            border: `1px solid ${theme.border}`,
            color: theme.text,
            boxShadow: "0 24px 80px rgba(0,0,0,0.55)",
          }}
          data-testid="parameter-menu-panel"
        >
          {/* Header */}
          <div className="flex items-start justify-between gap-2 mb-1.5">
            <div>
              <div className="text-[13px] font-semibold">Chat & Voice Settings</div>
              <div className="text-[10px]" style={{ color: theme.muted }}>
                Applied to the next message.
              </div>
            </div>
            <button
              type="button"
              onClick={resetChatParameters}
              className="h-6 px-2 rounded-md text-[10px] flex items-center gap-1 transition-colors shrink-0"
              style={{ background: theme.surface2, border: `1px solid ${theme.border}`, color: theme.muted }}
              title="Reset parameters (locked values kept)"
            >
              <RotateCcw className="w-3 h-3" /> Reset
            </button>
          </div>

          {/* Voice */}
          <div className="mt-1 space-y-0.5">
            <VoiceRow
              label="Text-To-Speech Voice"
              hint="Voice used when reading assistant replies aloud."
              value={voiceSettings?.ttsVoice ?? "Emma"}
              onChange={(v) => setVoiceSetting("ttsVoice", v)}
              options={VOICES}
              theme={theme}
              showPlay
            />
            <VoiceRow
              label="Conversation Voice"
              hint="Voice for spoken-input conversation mode."
              value={voiceSettings?.conversationVoice ?? "Eve"}
              onChange={(v) => setVoiceSetting("conversationVoice", v)}
              options={VOICES}
              theme={theme}
              showPlay
            />
            <VoiceRow
              label="Playback Speed"
              hint="Speed for TTS playback."
              value={voiceSettings?.playbackSpeed ?? 1}
              onChange={(v) => setVoiceSetting("playbackSpeed", Number(v))}
              options={PLAYBACK_SPEEDS}
              theme={theme}
              showPlay={false}
            />
          </div>

          {/* Advanced Settings header */}
          <button
            type="button"
            onClick={() => setAdvancedOpen(v => !v)}
            className="w-full flex items-center justify-between py-1.5 mt-2"
            style={{ borderTop: `1px solid ${theme.border}`, color: theme.text }}
          >
            <span className="text-[12px] font-semibold">Advanced Settings</span>
            {advancedOpen
              ? <ChevronUp className="w-4 h-4" style={{ color: theme.muted }} />
              : <ChevronDown className="w-4 h-4" style={{ color: theme.muted }} />}
          </button>

          {advancedOpen && (
            <div className="space-y-3 pt-1">
              {/* Disable Venice System Prompt */}
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-[12px] font-semibold truncate">Disable Venice System Prompt</span>
                  <InfoDot text="Skip the runtime persona/system prompt for this thread." theme={theme} />
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={!!disableSystemPrompt}
                  onClick={() => setDisableSystemPrompt(!disableSystemPrompt)}
                  className="relative h-5 w-9 rounded-full transition-colors shrink-0"
                  style={{
                    background: disableSystemPrompt ? theme.accent : theme.surface2,
                    border: `1px solid ${theme.border}`,
                  }}
                  data-testid="toggle-disable-system-prompt"
                >
                  <span
                    className="absolute top-[1px] w-[15px] h-[15px] rounded-full bg-white shadow-sm transition-transform"
                    style={{ transform: disableSystemPrompt ? "translateX(18px)" : "translateX(2px)" }}
                  />
                </button>
              </div>

              {/* Numeric sliders with lock per row */}
              {SLIDER_ROWS.map(row => {
                const isLocked = locked(row.key);
                const val = chatParameters?.[row.key];
                return (
                  <div key={row.key}>
                    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 mb-1">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="text-[12px] font-semibold truncate">{row.label}</span>
                        <InfoDot text={row.hint} theme={theme} />
                      </div>
                      <div className="flex items-center gap-1.5">
                        <input
                          value={fmt(row.key, val)}
                          onChange={(e) => update(row.key, e.target.value)}
                          className="w-12 rounded-md px-1.5 py-0.5 text-right text-[10px] font-mono focus:outline-none"
                          style={{ background: theme.surface2, border: `1px solid ${theme.border}`, color: theme.text }}
                        />
                        <button
                          type="button"
                          onClick={() => toggleParameterLock(row.key)}
                          className="w-6 h-6 rounded-md flex items-center justify-center transition-colors shrink-0"
                          style={{
                            background: isLocked ? theme.accent + "20" : theme.surface2,
                            border: `1px solid ${isLocked ? theme.accent + "60" : theme.border}`,
                            color: isLocked ? theme.accent : theme.muted,
                          }}
                          title={isLocked ? "Locked — Reset will not change this value" : "Unlocked — Reset will restore default"}
                          data-testid={`param-lock-${row.key}`}
                        >
                          {isLocked ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                        </button>
                      </div>
                    </div>
                    <input
                      type="range"
                      min={row.min}
                      max={row.max}
                      step={row.step}
                      value={val ?? 0}
                      onChange={(e) => update(row.key, e.target.value)}
                      className="w-full accent-current cursor-pointer h-4"
                      style={{ color: theme.accent }}
                    />
                  </div>
                );
              })}
            </div>
          )}

          <div className="mt-3 text-[9px] leading-relaxed" style={{ color: theme.muted }}>
            Values are sent with every chat message. The backend adapter will fall back to its own defaults for any value a provider doesn't accept.
          </div>
        </div>
      )}
    </div>
  );
}
