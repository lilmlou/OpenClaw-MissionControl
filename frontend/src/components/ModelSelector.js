import React, { useState, useEffect, useRef } from "react";
import { ChevronDown, ChevronLeft, Check } from "lucide-react";
import { C } from "@/lib/constants";
import { CapabilityIcons, CostBadge } from "@/components/shared";

const INITIAL_SHOW = 8;

export function ModelSelector({ models, providers, activeModel, onSelect, runtimeTheme = C }) {
  const [open, setOpen] = useState(false);
  const [hovProv, setHovProv] = useState(null);
  const [dropUp, setDropUp] = useState(false);
  const [modelsUp, setModelsUp] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const ref = useRef(null);
  const provRef = useRef(null);
  const hoverTimer = useRef(null);

  useEffect(() => {
    if (!open) return;
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) { setOpen(false); setHovProv(null); } };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);

  useEffect(() => {
    if (!open || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    setDropUp(spaceBelow < 200 && spaceAbove > 280);
  }, [open]);

  useEffect(() => {
    if (!hovProv || !provRef.current) return;
    const rect = provRef.current.getBoundingClientRect();
    const spaceAbove = rect.top;
    const spaceBelow = window.innerHeight - rect.bottom;
    setModelsUp(spaceAbove > 200 || spaceAbove >= spaceBelow);
  }, [hovProv]);

  useEffect(() => { setExpanded(false); }, [hovProv]);

  const activeName = activeModel ? (models.find(m => m.id === activeModel)?.name ?? activeModel.split("/").pop()) : null;
  const label = activeName ? (activeName.length > 22 ? activeName.slice(0, 20) + "..." : activeName) : "Select model";
  const provModels = hovProv ? (providers.find(p => p.name === hovProv)?.models ?? []) : [];
  const displayModels = expanded ? provModels : provModels.slice(0, INITIAL_SHOW);
  const hasMore = provModels.length > INITIAL_SHOW;

  const handleSelect = async (id) => { setOpen(false); setHovProv(null); await onSelect(id); };
  const handleProvEnter = (name) => { clearTimeout(hoverTimer.current); setHovProv(name); };
  const handleProvLeave = () => { hoverTimer.current = setTimeout(() => setHovProv(null), 150); };
  const handleModelsEnter = () => { clearTimeout(hoverTimer.current); };
  const handleModelsLeave = () => { hoverTimer.current = setTimeout(() => setHovProv(null), 150); };

  const panelBg = runtimeTheme.surface;
  const borderClr = runtimeTheme.border;
  const hoverBg = `${runtimeTheme.accent}12`;
  const hasModels = hovProv && provModels.length > 0;

  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => { setOpen(v => !v); setHovProv(null); }}
        className="flex items-center gap-1 text-[12px] transition-colors" style={{ color: open ? runtimeTheme.text : runtimeTheme.muted }}
        data-testid="model-selector-trigger">
        <span className="font-medium">{label}</span>
        <ChevronDown className="w-3.5 h-3.5" />
      </button>

      {open && (
        <div className="absolute right-0 z-50"
          style={dropUp ? { bottom: "100%", marginBottom: 8 } : { top: "100%", marginTop: 8 }}>
          <div style={{ position: "relative" }} ref={provRef}>
            <div className="shadow-2xl"
              style={{ background: panelBg, border: `1px solid ${borderClr}`, borderRadius: hasModels ? "0 10px 10px 0" : 10, borderLeft: hasModels ? "none" : `1px solid ${borderClr}`, whiteSpace: "nowrap" }}>
              <div className="px-2 py-1" style={{ borderBottom: "1px solid #1e1e1e" }}>
                <span className="text-[9px] font-bold uppercase tracking-widest" style={{ color: "#555" }}>Providers</span>
              </div>
              <div style={{ maxHeight: 320, overflowY: "auto" }}>
                {providers.map(prov => (
                  <button key={prov.name} type="button"
                    onMouseEnter={() => handleProvEnter(prov.name)}
                    onMouseLeave={handleProvLeave}
                    className="w-full flex items-center px-2 py-[5px] text-left transition-colors"
                    style={{ gap: 4, background: prov.name === hovProv ? `${runtimeTheme.accent}16` : "transparent" }}
                    onMouseOver={e => { if (prov.name !== hovProv) e.currentTarget.style.background = hoverBg; }}
                    onMouseOut={e => { e.currentTarget.style.background = prov.name === hovProv ? `${runtimeTheme.accent}16` : "transparent"; }}
                    data-testid={`provider-${prov.name}`}>
                    <ChevronLeft className="w-2.5 h-2.5 shrink-0" style={{ color: prov.name === hovProv ? runtimeTheme.accent : runtimeTheme.border }} />
                    <span className="text-[11px] font-medium" style={{ color: prov.name === hovProv ? runtimeTheme.text : runtimeTheme.muted }}>{prov.name}</span>
                    <span className="text-[10px]" style={{ color: runtimeTheme.muted, marginLeft: 2, opacity: 0.7 }}>{prov.count}</span>
                  </button>
                ))}
              </div>
            </div>

            {hasModels && (
              <div className="shadow-2xl" onMouseEnter={handleModelsEnter} onMouseLeave={handleModelsLeave}
                style={{ position: "absolute", right: "100%", [modelsUp ? "bottom" : "top"]: 0, width: "auto", maxWidth: 220, minWidth: 150, maxHeight: 400, background: panelBg, borderTop: `1px solid ${borderClr}`, borderLeft: `1px solid ${borderClr}`, borderBottom: `1px solid ${borderClr}`, borderRight: "none", borderRadius: "10px 0 0 10px", display: "flex", flexDirection: "column" }}>
                <div className="px-2 py-1 shrink-0 flex items-center" style={{ gap: 6, borderBottom: `1px solid ${runtimeTheme.border}` }}>
                  <span className="text-[9px] font-bold uppercase tracking-widest" style={{ color: runtimeTheme.muted }}>{hovProv}</span>
                  <span className="text-[9px]" style={{ color: runtimeTheme.muted, opacity: 0.7 }}>{provModels.length}</span>
                </div>
                <div style={{ overflowY: "auto", maxHeight: 370 }} data-testid="models-scroll-container">
                  {displayModels.map(m => {
                    const isActive = m.id === activeModel;
                    return (
                      <button key={m.id} type="button" onClick={() => handleSelect(m.id)}
                        className="w-full text-left transition-colors"
                        style={{ padding: "3px 6px", background: isActive ? `${runtimeTheme.accent}16` : "transparent", borderBottom: `1px solid ${runtimeTheme.border}` }}
                        onMouseOver={e => { if (!isActive) e.currentTarget.style.background = hoverBg; }}
                        onMouseOut={e => { e.currentTarget.style.background = isActive ? `${runtimeTheme.accent}16` : "transparent"; }}
                        data-testid={`model-item-${m.name.replace(/\s+/g, "-").toLowerCase()}`}>
                        <div className="flex items-center gap-1">
                          <span className="text-[11px] font-medium truncate" style={{ color: isActive ? runtimeTheme.accent : runtimeTheme.text }}>{m.name}</span>
                          {isActive && <Check className="w-2.5 h-2.5 shrink-0" style={{ color: runtimeTheme.accent }} />}
                        </div>
                        <div className="flex items-center" style={{ marginTop: 1, gap: 2, whiteSpace: "nowrap" }}>
                          <CapabilityIcons caps={m.caps} size={9} gap={2} />
                          {m.context && <span className="text-[8px] px-1 rounded font-medium shrink-0" style={{ background: `${runtimeTheme.accent}18`, color: runtimeTheme.accent, border: `1px solid ${runtimeTheme.border}`, lineHeight: "13px" }}>{m.context}</span>}
                          {m.costTier && <span className="shrink-0"><CostBadge tier={m.costTier} /></span>}
                        </div>
                      </button>
                    );
                  })}
                  {hasMore && !expanded && (
                    <button type="button" onClick={(e) => { e.stopPropagation(); setExpanded(true); }}
                      className="w-full text-center py-1.5 transition-colors"
                      style={{ color: runtimeTheme.accent, borderTop: `1px solid ${runtimeTheme.border}` }}
                      onMouseOver={e => { e.currentTarget.style.background = hoverBg; }}
                      onMouseOut={e => { e.currentTarget.style.background = "transparent"; }}
                      data-testid="model-show-more-btn">
                      <span className="text-[10px] font-medium">More... ({provModels.length - INITIAL_SHOW})</span>
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
