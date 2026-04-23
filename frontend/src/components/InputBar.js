import React, { useState, useEffect, useRef } from "react";
import { ChevronDown, Globe, Wrench, Bot, Telescope, Mic, Send } from "lucide-react";
import { C, ORIGINAL_FRONTEND_THEME, getSpaceIcon } from "@/lib/constants";
import { useGateway, switchModel } from "@/lib/useGateway";
import { ModelSelector } from "@/components/ModelSelector";
import { PlusMenu } from "@/components/PlusMenu";

export function InputBar({ onSend, disabled, placeholder, fillPrompt, onFillConsumed, runtimeTheme = C }) {
  const [val, setVal] = useState("");
  const ref = useRef(null);
  const { models, providers, activeModel, webSearchEnabled, enabledSkills, activeThreadId, threads, spaces } = useGateway();
  const [activeMode, setActiveMode] = useState("agent");

  useEffect(() => { if (fillPrompt) { setVal(fillPrompt); onFillConsumed?.(); setTimeout(() => ref.current?.focus(), 0); } }, [fillPrompt, onFillConsumed]);

  const handleInput = (e) => { setVal(e.target.value); const el = e.target; el.style.height = "auto"; el.style.height = `${Math.min(el.scrollHeight, 180)}px`; };
  const handleKey = (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); } };
  const submit = () => { if (!val.trim() || disabled) return; onSend(val.trim()); setVal(""); if (ref.current) ref.current.style.height = "auto"; };
  const handleQuick = (prompt, fill) => {
    if (fill) { setVal(prompt); setTimeout(() => ref.current?.focus(), 0); }
    else { onSend(prompt); }
  };
  const handleModeFromMenu = (mode) => { setActiveMode(mode); };
  const active = !!val.trim() && !disabled;

  const chips = [];
  if (webSearchEnabled) chips.push({ key: "web", label: "Web", icon: Globe });
  if (enabledSkills.length > 0) chips.push({ key: "skills", label: `${enabledSkills.length} skill${enabledSkills.length > 1 ? "s" : ""}`, icon: Wrench });

  // Resolve active thread's space
  const activeThread = activeThreadId ? threads.find(t => t.id === activeThreadId) : null;
  const threadSpace = activeThread?.spaceId ? spaces.find(s => s.id === activeThread.spaceId) : null;
  const SpaceIconComponent = threadSpace ? getSpaceIcon(threadSpace.icon) : null;

  const modeConfig = {
    agent: { label: "Agent", icon: Bot, color: ORIGINAL_FRONTEND_THEME.accent },
    research: { label: "Research", icon: Telescope, color: ORIGINAL_FRONTEND_THEME.orange },
  };
  const currentMode = modeConfig[activeMode] || modeConfig.agent;
  const ModeIcon = currentMode.icon;

  return (
    <div className="w-full rounded-[28px] shadow-xl backdrop-blur-2xl" style={{ background: runtimeTheme.surface, border: `1px solid ${runtimeTheme.border}`, boxShadow: runtimeTheme === C ? "0 20px 40px rgba(0,0,0,0.25)" : "0 24px 60px rgba(10, 8, 24, 0.28)" }}>
      <textarea ref={ref} value={val} onChange={handleInput} onKeyDown={handleKey} placeholder={placeholder ?? (disabled ? "Connecting to gateway..." : "Ask anything...")} rows={1}
        className="w-full focus:outline-none resize-none text-[14px] font-sans" style={{ background: "transparent", border: "none", color: runtimeTheme.text, padding: "16px 18px 10px", minHeight: 56, maxHeight: 180, opacity: 1 }} data-testid="chat-input" />
      <div className="flex items-center gap-2 px-3 pb-3">
        <PlusMenu onSelect={handleQuick} onModeChange={handleModeFromMenu} runtimeTheme={runtimeTheme} />
        <button type="button" onClick={() => setActiveMode(activeMode === "agent" ? "research" : "agent")}
          className="flex items-center gap-1.5 h-7 px-2.5 rounded-full text-[12px] font-medium transition-colors"
          style={{ background: `${currentMode.color}18`, border: `1px solid ${currentMode.color}40`, color: currentMode.color }}
          data-testid="mode-toggle-btn">
          <ModeIcon className="w-3.5 h-3.5" /><span>{currentMode.label}</span><ChevronDown className="w-3 h-3 opacity-60" />
        </button>
        {chips.map(chip => {
          const ChipIcon = chip.icon;
          return (
            <span key={chip.key} className="flex items-center gap-1 h-6 px-2 rounded-full text-[11px] backdrop-blur-md" style={{ background: `${ORIGINAL_FRONTEND_THEME.green}18`, border: `1px solid ${ORIGINAL_FRONTEND_THEME.green}35`, color: ORIGINAL_FRONTEND_THEME.green }}>
              <ChipIcon className="w-3 h-3" />{chip.label}
            </span>
          );
        })}
        {threadSpace && SpaceIconComponent && (
          <span className="flex items-center gap-1 h-6 px-2 rounded-full text-[11px] backdrop-blur-md" style={{ background: `${threadSpace.color}15`, border: `1px solid ${threadSpace.color}35`, color: threadSpace.color }} data-testid="space-indicator-chip">
            <SpaceIconComponent className="w-3 h-3" />{threadSpace.name}
          </span>
        )}
        <div className="flex-1" />
        <ModelSelector models={models} providers={providers} activeModel={activeModel} onSelect={switchModel} runtimeTheme={runtimeTheme} />
        <button type="button" className="w-7 h-7 flex items-center justify-center rounded-full transition-colors" style={{ color: runtimeTheme.muted }}><Mic className="w-4 h-4" /></button>
        <button type="button" onClick={submit} disabled={!active} className="w-8 h-8 rounded-full flex items-center justify-center transition-all"
          style={{ background: active ? runtimeTheme.accent : runtimeTheme.surface2, color: active ? "#fff" : runtimeTheme.muted, cursor: active ? "pointer" : "not-allowed", boxShadow: active ? `0 0 24px ${runtimeTheme.accent}55` : "none" }} title="Send" data-testid="send-btn"><Send className="w-3.5 h-3.5" /></button>
      </div>
    </div>
  );
}
