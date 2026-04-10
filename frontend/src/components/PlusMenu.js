import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  Plus, ChevronRight, Check, Paperclip, Grid3X3, GitBranch, Wrench,
  Layers, Puzzle, Telescope, Globe, Bot,
} from "lucide-react";
import { C, CONNECTORS, SKILLS, getSpaceIcon } from "@/lib/constants";
import { useGateway } from "@/lib/useGateway";
import { Toggle } from "@/components/shared";

export function PlusMenu({ onSelect, disabled, onModeChange }) {
  const [open, setOpen] = useState(false);
  const [sub, setSub] = useState(null);
  const [newSpaceName, setNewSpaceName] = useState("");
  const ref = useRef(null);
  const fileRef = useRef(null);
  const navigate = useNavigate();
  const { connectors, toggleConnector, enabledSkills, toggleSkill, webSearchEnabled, setWebSearchEnabled, writingStyle, setWritingStyle, spaces, addSpace, activeThreadId, assignThreadToSpace } = useGateway();

  useEffect(() => {
    if (!open) return;
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) { setOpen(false); setSub(null); } };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);

  const close = () => { setOpen(false); setSub(null); setNewSpaceName(""); };
  const hoverBg = "rgba(255,255,255,0.04)";
  const panelStyle = { background: "#151515", border: "1px solid #2a2a2a" };

  const Row = ({ icon: Icon, label, badge, hasSub, onClick, active }) => (
    <button type="button" onClick={onClick} className="w-full flex items-center gap-2.5 px-3 py-[7px] transition-colors text-left" style={{ color: C.text }}
      onMouseOver={e => { e.currentTarget.style.background = hoverBg; }} onMouseOut={e => { e.currentTarget.style.background = "transparent"; }}>
      {Icon && <Icon className="w-4 h-4 shrink-0" style={{ color: "#888" }} />}
      <span className="text-[13px] flex-1">{label}</span>
      {badge !== undefined && badge > 0 && <span className="flex items-center gap-1"><span className="text-[10px]" style={{ color: "#fbbf24" }}>!</span><span className="text-[10px]" style={{ color: "#888" }}>{badge}</span></span>}
      {active && <Check className="w-3.5 h-3.5" style={{ color: C.accent }} />}
      {hasSub && <ChevronRight className="w-3.5 h-3.5" style={{ color: "#555" }} />}
    </button>
  );

  const Divider = () => <div className="my-1" style={{ height: 1, background: "#1e1e1e" }} />;

  const handleAddToSpace = (spaceId) => {
    if (activeThreadId) { assignThreadToSpace(activeThreadId, spaceId); }
    close();
  };

  const handleCreateSpace = () => {
    if (!newSpaceName.trim()) return;
    const id = addSpace(newSpaceName.trim());
    if (activeThreadId) assignThreadToSpace(activeThreadId, id);
    close();
  };

  const handleFileClick = () => { fileRef.current?.click(); };
  const handleFileChange = (e) => {
    const files = e.target.files;
    if (files?.length) { onSelect(`[Attached: ${Array.from(files).map(f => f.name).join(", ")}] `, true); }
    close();
  };

  const totalConnectorsBadge = Object.values(connectors).filter(Boolean).length;

  return (
    <div ref={ref} className="relative">
      <input type="file" ref={fileRef} multiple className="hidden" onChange={handleFileChange} />
      <button type="button" onClick={() => { setOpen(v => !v); setSub(null); }} disabled={disabled}
        className="w-7 h-7 rounded-full flex items-center justify-center transition-all shrink-0 disabled:opacity-40"
        style={{ background: open ? "rgba(29,140,248,0.15)" : C.surface2, border: `1px solid ${open ? C.accent : C.border}`, color: open ? C.accent : C.muted }}
        data-testid="plus-menu-trigger">
        <Plus className={`w-3.5 h-3.5 transition-transform duration-200 ${open ? "rotate-45" : ""}`} />
      </button>
      {open && (
        <div className="absolute bottom-full left-0 mb-2 z-50 flex items-end gap-1">
          <div className="w-56 rounded-xl py-1 shadow-2xl" style={panelStyle}>
            <Row icon={Paperclip} label="Add files or photos" onClick={handleFileClick} />
            <Row icon={Grid3X3} label="Add to Spaces" badge={spaces.length} hasSub onClick={() => setSub(p => p === "spaces" ? null : "spaces")} />
            <Row icon={GitBranch} label="Add from GitHub" onClick={() => { onSelect("Pull from GitHub repo: ", true); close(); }} />
            <Divider />
            <Row icon={Wrench} label="Skills" badge={enabledSkills.length} hasSub onClick={() => setSub(p => p === "skills" ? null : "skills")} />
            <Row icon={Layers} label="Connectors" badge={totalConnectorsBadge} hasSub onClick={() => setSub(p => p === "connectors" ? null : "connectors")} />
            <Row icon={Puzzle} label="Plugins" onClick={() => { navigate("/customize?tab=plugins"); close(); }} />
            <Divider />
            <Row icon={Telescope} label="Research" onClick={() => { onModeChange?.("research"); onSelect("Do deep research on: ", true); close(); }} />
            <Row icon={Globe} label="Web search" active={webSearchEnabled} onClick={() => setWebSearchEnabled(!webSearchEnabled)} />
            <Row icon={Bot} label="Use style" hasSub onClick={() => setSub(p => p === "style" ? null : "style")} />
          </div>

          {/* Spaces submenu */}
          {sub === "spaces" && (
            <div className="w-52 rounded-xl py-1 shadow-2xl" style={panelStyle}>
              {spaces.map(sp => {
                const SpIcon = getSpaceIcon(sp.icon);
                const isAssigned = activeThreadId && useGateway.getState().threads.find(t => t.id === activeThreadId)?.spaceId === sp.id;
                return (
                  <button key={sp.id} type="button" onClick={() => handleAddToSpace(sp.id)}
                    className="w-full flex items-center gap-2.5 px-3 py-[6px] text-[13px] text-left transition-colors" style={{ color: isAssigned ? sp.color : "#ccc" }}
                    onMouseOver={e => { e.currentTarget.style.background = hoverBg; }} onMouseOut={e => { e.currentTarget.style.background = "transparent"; }}
                    data-testid={`space-assign-${sp.id}`}>
                    <SpIcon className="w-3.5 h-3.5" style={{ color: sp.color }} />
                    <span className="flex-1">{sp.name}</span>
                    {isAssigned && <Check className="w-3.5 h-3.5" style={{ color: sp.color }} />}
                  </button>
                );
              })}
              <Divider />
              <div className="px-3 py-1.5">
                <div className="flex items-center gap-1.5">
                  <input type="text" value={newSpaceName} onChange={e => setNewSpaceName(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") handleCreateSpace(); }}
                    placeholder="New space name..."
                    className="flex-1 text-[12px] px-2 py-1 rounded" style={{ background: C.surface2, border: `1px solid ${C.border}`, color: C.text, outline: "none" }}
                    data-testid="new-space-input" />
                  <button type="button" onClick={handleCreateSpace} className="text-[11px] px-2 py-1 rounded font-medium"
                    style={{ background: newSpaceName.trim() ? C.accent : C.surface2, color: newSpaceName.trim() ? "#fff" : "#555" }}
                    data-testid="create-space-btn">Add</button>
                </div>
              </div>
            </div>
          )}

          {/* Skills submenu */}
          {sub === "skills" && (
            <div className="w-52 rounded-xl py-1 shadow-2xl" style={panelStyle}>
              {SKILLS.map(sk => (
                <button key={sk} type="button" className="w-full flex items-center justify-between gap-2.5 px-3 py-[6px] text-[13px] text-left transition-colors" style={{ color: "#ccc" }}
                  onMouseOver={e => { e.currentTarget.style.background = hoverBg; }} onMouseOut={e => { e.currentTarget.style.background = "transparent"; }} onClick={() => toggleSkill(sk)}>
                  {sk}{enabledSkills.includes(sk) && <Check className="w-3.5 h-3.5" style={{ color: C.accent }} />}
                </button>
              ))}
              <Divider />
              <Row icon={Wrench} label="Manage skills" onClick={() => { navigate("/customize?tab=skills"); close(); }} />
              <button type="button" className="w-full flex items-center gap-2.5 px-3 py-[6px] text-[13px] text-left transition-colors" style={{ color: "#888" }}
                onMouseOver={e => { e.currentTarget.style.background = hoverBg; e.currentTarget.style.color = "#ccc"; }}
                onMouseOut={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#888"; }} onClick={() => { navigate("/customize?tab=skills"); close(); }}>
                <Plus className="w-3.5 h-3.5" /> Add skill
              </button>
            </div>
          )}

          {/* Connectors submenu — service connectors only */}
          {sub === "connectors" && (
            <div className="w-60 rounded-xl py-1 shadow-2xl max-h-80 overflow-y-auto" style={panelStyle}>
              {CONNECTORS.map(c => (
                <div key={c.id} className="flex items-center gap-2.5 px-3 py-[7px] transition-colors" style={{ color: C.text }}
                  onMouseOver={e => { e.currentTarget.style.background = hoverBg; }} onMouseOut={e => { e.currentTarget.style.background = "transparent"; }}>
                  <c.icon className="w-4 h-4 shrink-0" style={{ color: connectors[c.id] ? C.green : "#666" }} /><span className="text-[13px] flex-1">{c.label}</span><Toggle on={connectors[c.id]} onToggle={() => toggleConnector(c.id)} />
                </div>
              ))}
              <Divider />
              <Row icon={Wrench} label="Manage connectors" onClick={() => { navigate("/settings?tab=apps"); close(); }} />
            </div>
          )}

          {/* Style submenu */}
          {sub === "style" && (
            <div className="w-48 rounded-xl py-1 shadow-2xl" style={panelStyle}>
              {["Normal", "Concise", "Formal", "Explanatory"].map(s => (
                <button key={s} type="button" className="w-full flex items-center justify-between text-left px-3 py-[7px] text-[13px] transition-colors" style={{ color: "#ccc" }}
                  onMouseOver={e => { e.currentTarget.style.background = hoverBg; }} onMouseOut={e => { e.currentTarget.style.background = "transparent"; }}
                  onClick={() => { setWritingStyle(s); close(); }}>{s}{writingStyle === s && <Check className="w-3.5 h-3.5" style={{ color: C.accent }} />}</button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
