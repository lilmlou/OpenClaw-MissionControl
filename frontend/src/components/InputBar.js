import React, { useState, useEffect, useRef } from "react";
import { ChevronDown, Globe, Wrench, Bot, Telescope, Mic, Send } from "lucide-react";
import { C } from "@/lib/constants";
import { useGateway, switchModel } from "@/lib/useGateway";
import { ModelSelector } from "@/components/ModelSelector";
import { PlusMenu } from "@/components/PlusMenu";

export function InputBar({ onSend, disabled, placeholder, fillPrompt, onFillConsumed }) {
  const [val, setVal] = useState("");
  const ref = useRef(null);
  const { models, providers, activeModel, webSearchEnabled, enabledSkills } = useGateway();
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

  const modeConfig = {
    agent: { label: "Agent", icon: Bot, color: C.accent },
    research: { label: "Research", icon: Telescope, color: "#a78bfa" },
  };
  const currentMode = modeConfig[activeMode] || modeConfig.agent;
  const ModeIcon = currentMode.icon;

  return (
    <div className="w-full rounded-2xl shadow-xl" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
      <textarea ref={ref} value={val} onChange={handleInput} onKeyDown={handleKey} placeholder={placeholder ?? (disabled ? "Connecting to gateway..." : "Ask anything...")} disabled={disabled} rows={1}
        className="w-full focus:outline-none resize-none text-[14px] font-sans" style={{ background: "transparent", border: "none", color: C.text, padding: "14px 16px 10px", minHeight: 52, maxHeight: 180, opacity: disabled ? 0.5 : 1 }} data-testid="chat-input" />
      <div className="flex items-center gap-2 px-3 pb-3">
        <PlusMenu onSelect={handleQuick} disabled={disabled} onModeChange={handleModeFromMenu} />
        <button type="button" onClick={() => setActiveMode(activeMode === "agent" ? "research" : "agent")}
          className="flex items-center gap-1.5 h-7 px-2.5 rounded-full text-[12px] font-medium transition-colors"
          style={{ background: `${currentMode.color}18`, border: `1px solid ${currentMode.color}40`, color: currentMode.color }}
          data-testid="mode-toggle-btn">
          <ModeIcon className="w-3.5 h-3.5" /><span>{currentMode.label}</span><ChevronDown className="w-3 h-3 opacity-60" />
        </button>
        {chips.map(chip => {
          const ChipIcon = chip.icon;
          return (
            <span key={chip.key} className="flex items-center gap-1 h-6 px-2 rounded-full text-[11px]" style={{ background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.25)", color: "#22c55e" }}>
              <ChipIcon className="w-3 h-3" />{chip.label}
            </span>
          );
        })}
        <div className="flex-1" />
        <ModelSelector models={models} providers={providers} activeModel={activeModel} onSelect={switchModel} />
        <button type="button" className="w-7 h-7 flex items-center justify-center rounded-full transition-colors" style={{ color: C.muted }}><Mic className="w-4 h-4" /></button>
        <button type="button" onClick={submit} disabled={!active} className="w-8 h-8 rounded-full flex items-center justify-center transition-all"
          style={{ background: active ? C.accent : C.surface2, color: active ? "#fff" : "#555", cursor: active ? "pointer" : "not-allowed" }} title="Send" data-testid="send-btn"><Send className="w-3.5 h-3.5" /></button>
      </div>
    </div>
  );
}
