import React, { useState, useEffect, useRef, useCallback } from "react";
import { Link, useLocation, Routes, Route } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  MessageSquare, Monitor, LayoutDashboard, Briefcase,
  AlertTriangle, Grid3X3, Settings, Plus, ChevronDown, ChevronRight,
  Terminal, Bookmark, Send, Telescope, Paperclip, Layers, Mic, Wrench,
  FolderOpen, Globe, Eye, Brain, Zap, Radio, Cpu, Rocket, Bot, Trash2,
  MessageCircle, X, Check, Play, Pause, Square, Clock, Shield,
  FileCode, Folder, RefreshCw, Users, Code2, ArrowRight, AlertCircle,
  CheckCircle, XCircle, ChevronUp, Copy, Download, Upload, GitBranch,
} from "lucide-react";
import { useGateway, initGateway, sendMessage, switchModel, executeCommand } from "@/lib/useGateway";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { Toaster } from "@/components/ui/toaster";
import { useToast } from "@/hooks/use-toast";
import "@/App.css";

/* ─── Design tokens ──────────────────────────────────────────────────────────── */
const C = {
  bg:       "#0a0a0a",
  surface:  "#141414",
  surface2: "#1a1a1a",
  accent:   "#1d8cf8",
  text:     "#f5f5f5",
  muted:    "#888",
  border:   "#222",
  borderHi: "#333",
  green:    "#22c55e",
  yellow:   "#fbbf24",
  red:      "#ef4444",
  orange:   "#f97316",
};

/* ─── Capability Icons Component ──────────────────────────────────────────────── */
const CAP_ICONS = [
  { key: "vision", icon: "👁️", label: "Vision" },
  { key: "coding", icon: "💻", label: "Coding" },
  { key: "tools", icon: "🔧", label: "Tool Call" },
  { key: "files", icon: "📁", label: "Files" },
  { key: "reasoning", icon: "🧠", label: "Reasoning" },
  { key: "fast", icon: "⚡", label: "Fast" },
];

function CapabilityIcons({ caps }) {
  return (
    <div className="flex items-center gap-0.5">
      {CAP_ICONS.map(({ key, icon, label }) => (
        <span
          key={key}
          title={label}
          className="text-[10px] w-4 h-4 flex items-center justify-center"
          style={{ opacity: caps?.[key] ? 1 : 0.2, filter: caps?.[key] ? "none" : "grayscale(100%)" }}
        >
          {icon}
        </span>
      ))}
    </div>
  );
}

/* ─── Cost Badge Component ────────────────────────────────────────────────────── */
function CostBadge({ tier }) {
  if (!tier) return null;
  
  const colors = {
    Free: { bg: "#064e3b", color: "#34d399", border: "#065f46" },
    "$": { bg: "#1e3a5f", color: "#60a5fa", border: "#1e40af" },
    "$$": { bg: "#4a3728", color: "#fbbf24", border: "#78350f" },
    "$$$": { bg: "#4a2c2a", color: "#f87171", border: "#7f1d1d" },
  };
  
  const style = colors[tier] || colors["$"];
  
  return (
    <span
      className="text-[9px] px-1.5 py-0.5 rounded font-medium"
      style={{ background: style.bg, color: style.color, border: `1px solid ${style.border}` }}
    >
      {tier}
    </span>
  );
}

/* ─── Navigation items ─────────────────────────────────────────────────────── */
const NAV = [
  { href: "/",          label: "Chat",      icon: MessageSquare },
  { href: "/agent",     label: "Agent",     icon: Monitor },
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/jobs",      label: "Jobs",      icon: Briefcase },
  { href: "/approvals", label: "Approvals", icon: AlertTriangle, badgeKey: "pendingApprovals", warn: true },
  { href: "/spaces",    label: "Spaces",    icon: Grid3X3 },
  { href: "/settings",  label: "Settings",  icon: Settings },
];

const HISTORY = [
  "New conversation",
  "New conversation", 
  "New conversation",
  "New conversation",
  "hello",
  "hi",
  "hello",
];

const CONNECTORS = [
  { id: "mac",       label: "Control your Mac",    icon: Monitor },
  { id: "desktop",   label: "Desktop Commander",   icon: Terminal },
  { id: "files",     label: "File Access",         icon: FolderOpen },
  { id: "web",       label: "Web Search",          icon: Globe },
  { id: "signal",    label: "Signal",              icon: Radio },
  { id: "telegram",  label: "Telegram",            icon: MessageCircle },
];

const SKILLS = [
  "deep-research", "code-review", "web-scraper",
  "file-manager", "task-scheduler", "mcp-builder",
  "slack-gif-creator", "canvas-design",
];

const CARDS = [
  { icon: Cpu,       title: "Select a model",  desc: "Choose from local and cloud models for your tasks", prompt: "What AI models do you have available?", fill: false },
  { icon: Bot,       title: "Try Agent",       desc: "Agent works on any task: building apps, editing files, running commands", prompt: "What are your current agent capabilities?", fill: false },
  { icon: Telescope, title: "Deep Research",   desc: "Comprehensive research that synthesises information from multiple sources", prompt: "Do deep research on: ", fill: true },
  { icon: Rocket,    title: "Mission Control", desc: "Manage swarm jobs, heartbeats, approvals, and live agent monitoring", prompt: "Give me a full mission control status report.", fill: false },
];

/* ─── Binary rain background ─────────────────────────────────────────────────── */
function BinaryRain() {
  const ref = useRef(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let raf;
    const resize = () => { canvas.width = canvas.offsetWidth; canvas.height = canvas.offsetHeight; };
    resize();
    const cols = Math.floor(canvas.width / 16);
    const drops = Array.from({ length: cols }, () => Math.random() * -60);
    const draw = () => {
      ctx.fillStyle = "rgba(10,10,10,0.07)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.font = "13px monospace";
      for (let i = 0; i < drops.length; i++) {
        const c = Math.random() > 0.5 ? "1" : "0";
        const a = Math.random() * 0.35 + 0.04;
        ctx.fillStyle = `rgba(29,140,248,${a})`;
        ctx.fillText(c, i * 16, drops[i] * 16);
        if (drops[i] * 16 > canvas.height && Math.random() > 0.975) drops[i] = 0;
        drops[i] += 0.35;
      }
      raf = requestAnimationFrame(draw);
    };
    draw();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, []);
  return (
    <canvas
      ref={ref}
      className="absolute inset-0 w-full h-full pointer-events-none"
      style={{ opacity: 0.15 }}
    />
  );
}

/* ─── Toggle switch ─────────────────────────────────────────────────────────── */
function Toggle({ on, onToggle }) {
  return (
    <button 
      type="button" 
      onClick={onToggle}
      className="w-8 h-[18px] rounded-full relative transition-colors shrink-0"
      style={{ background: on ? C.accent : "#333" }}
    >
      <div 
        className="absolute top-[2px] w-[14px] h-[14px] rounded-full transition-all"
        style={{ background: "#fff", left: on ? 14 : 2 }} 
      />
    </button>
  );
}

/* ─── Markdown renderer ──────────────────────────────────────────────────────── */
function Markdown({ content }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
        ul: ({ children }) => <ul className="list-disc ml-4 mb-2 space-y-0.5">{children}</ul>,
        ol: ({ children }) => <ol className="list-decimal ml-4 mb-2 space-y-0.5">{children}</ol>,
        li: ({ children }) => <li className="text-sm">{children}</li>,
        strong: ({ children }) => <strong className="font-semibold" style={{ color: C.text }}>{children}</strong>,
        em: ({ children }) => <em className="italic">{children}</em>,
        code: ({ children, className }) =>
          className
            ? <code className="block text-[11px] rounded p-2 my-1.5 overflow-auto font-mono whitespace-pre-wrap" style={{ background: C.surface2, border: `1px solid ${C.border}` }}>{children}</code>
            : <code className="text-[11px] rounded px-1 py-0.5 font-mono" style={{ background: C.surface2, border: `1px solid ${C.border}` }}>{children}</code>,
        pre: ({ children }) => <>{children}</>,
        a: ({ href, children }) => <a href={href} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:opacity-80" style={{ color: C.accent }}>{children}</a>,
      }}
    >
      {content}
    </ReactMarkdown>
  );
}

/* ─── Model Selector with proper badges ───────────────────────────────────────── */
function ModelSelector({ models, providers, activeModel, onSelect }) {
  const [open, setOpen] = useState(false);
  const [selProv, setSelProv] = useState(null);
  const ref = useRef(null);
  const { toast } = useToast();

  useEffect(() => {
    if (!open) return;
    const h = (e) => {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);

  useEffect(() => {
    if (open && activeModel) {
      const slash = activeModel.indexOf("/");
      setSelProv(slash > 0 ? activeModel.slice(0, slash) : null);
    }
  }, [open, activeModel]);

  const activeProvider = activeModel ? activeModel.split("/")[0] : null;
  const activeName = activeModel ? activeModel.split("/").slice(1).join("/") : null;
  const selModels = selProv ? (providers.find(p => p.name === selProv)?.models ?? []) : [];

  const handleSelect = async (modelId) => {
    setOpen(false);
    const ok = await onSelect(modelId);
    if (!ok) toast({ title: "Failed to switch model", variant: "destructive" });
  };

  const label = activeName
    ? (activeName.length > 24 ? activeName.slice(0, 22) + "…" : activeName)
    : models.length > 0 ? "Select model" : "No models";

  return (
    <div ref={ref} className="relative">
      <button 
        type="button"
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1 text-[12px] transition-colors"
        style={{ color: open ? C.text : C.muted }}
        data-testid="model-selector-trigger"
      >
        <span className="font-medium">{label}</span>
        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div 
          className="absolute bottom-full right-0 mb-2 z-50 flex items-stretch shadow-2xl"
          style={{ borderRadius: 14, overflow: "hidden", border: "1px solid #222" }}
          data-testid="model-selector-flyout"
        >
          {/* Providers panel */}
          <div style={{ width: 180, background: "#0f0f0f", borderRight: "1px solid #1d1d1d", display: "flex", flexDirection: "column", maxHeight: 440 }}>
            <div className="px-3 py-2 shrink-0" style={{ borderBottom: "1px solid #1d1d1d" }}>
              <span className="text-[10px] font-bold uppercase tracking-[0.12em]" style={{ color: "#555" }}>Providers</span>
            </div>
            <ScrollArea className="flex-1">
              {providers.map(prov => {
                const isActive = prov.name === activeProvider;
                const isSel = prov.name === selProv;
                return (
                  <button
                    key={prov.name}
                    type="button"
                    onMouseEnter={() => setSelProv(prov.name)}
                    onClick={() => setSelProv(prov.name)}
                    className="w-full flex items-center justify-between px-3 py-[9px] text-left"
                    style={{
                      background: isSel ? "rgba(29,140,248,0.07)" : "transparent",
                      borderLeft: isSel ? `2px solid ${C.accent}` : "2px solid transparent",
                    }}
                    data-testid={`provider-${prov.name}`}
                  >
                    <span className="text-[13px] font-medium" style={{ color: isActive ? C.accent : isSel ? "#e2e2e2" : "#999" }}>
                      {prov.name}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px]" style={{ color: "#505050" }}>{prov.count}</span>
                      <ChevronRight className="w-3 h-3" style={{ color: isSel ? C.accent : "#404040" }} />
                    </div>
                  </button>
                );
              })}
            </ScrollArea>
          </div>

          {/* Models panel */}
          <div style={{ width: 360, background: "#131313", display: "flex", flexDirection: "column", maxHeight: 440 }}>
            {selProv ? (
              <>
                <div className="flex items-center justify-between px-3 py-2 shrink-0" style={{ borderBottom: "1px solid #1d1d1d" }}>
                  <span className="text-[11px] font-bold uppercase tracking-[0.1em]" style={{ color: "#555" }}>{selProv}</span>
                  <div className="flex items-center gap-1 text-[9px]" style={{ color: "#444" }}>
                    {CAP_ICONS.map(({ icon, label }) => (
                      <span key={label} title={label}>{icon}</span>
                    ))}
                  </div>
                </div>
                <ScrollArea className="flex-1">
                  {selModels.map(m => {
                    const isActive = m.id === activeModel;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => handleSelect(m.id)}
                        className="w-full px-3 py-2.5 text-left transition-colors"
                        style={{ background: isActive ? "rgba(29,140,248,0.1)" : "transparent" }}
                        onMouseOver={e => { if (!isActive) e.currentTarget.style.background = "rgba(255,255,255,0.03)"; }}
                        onMouseOut={e => { if (!isActive) e.currentTarget.style.background = "transparent"; }}
                        data-testid={`model-${m.name}`}
                      >
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className="text-[13px] font-semibold truncate" style={{ color: isActive ? C.accent : "#ddd" }}>{m.name}</span>
                          {isActive && <Check className="w-3.5 h-3.5 shrink-0" style={{ color: C.accent }} />}
                        </div>
                        <div className="text-[10px] truncate mb-1.5" style={{ color: "#484848", fontFamily: "monospace" }}>{m.id}</div>
                        <div className="flex items-center gap-2">
                          <CostBadge tier={m.costTier} />
                          {m.context && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded font-mono" style={{ background: "#1a1a1a", color: "#666", border: "1px solid #222" }}>
                              {m.context}
                            </span>
                          )}
                          <div className="ml-auto">
                            <CapabilityIcons caps={m.caps} />
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </ScrollArea>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center" style={{ color: "#333", fontSize: 12 }}>
                ← select a provider
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Plus Menu ──────────────────────────────────────────────────────────────── */
function PlusMenu({ onSelect, disabled }) {
  const [open, setOpen] = useState(false);
  const [sub, setSub] = useState(null);
  const ref = useRef(null);
  
  const { 
    connectors, toggleConnector, 
    enabledSkills, toggleSkill,
    webSearchEnabled, setWebSearchEnabled,
    writingStyle, setWritingStyle,
    toolAccess, setToolAccess,
  } = useGateway();

  useEffect(() => {
    if (!open) return;
    const h = (e) => {
      if (ref.current && !ref.current.contains(e.target)) { 
        setOpen(false); 
        setSub(null); 
      }
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);

  const close = () => { setOpen(false); setSub(null); };
  const hoverBg = "rgba(255,255,255,0.04)";
  const panelStyle = { background: "#151515", border: "1px solid #2a2a2a" };

  const Row = ({ icon: Icon, label, badge, right, hasSub, onClick, active }) => (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center gap-2.5 px-3 py-[7px] transition-colors text-left"
      style={{ color: C.text }}
      onMouseOver={e => { e.currentTarget.style.background = hoverBg; }}
      onMouseOut={e => { e.currentTarget.style.background = "transparent"; }}
      data-testid={`menu-${label.toLowerCase().replace(/\s+/g, '-')}`}
    >
      {Icon && <Icon className="w-4 h-4 shrink-0" style={{ color: "#888" }} />}
      <span className="text-[13px] flex-1">{label}</span>
      {badge !== undefined && badge > 0 && (
        <span className="flex items-center gap-1">
          <span className="text-[10px]" style={{ color: "#fbbf24" }}>🔔</span>
          <span className="text-[10px]" style={{ color: "#888" }}>{badge}</span>
        </span>
      )}
      {active && <Check className="w-3.5 h-3.5" style={{ color: C.accent }} />}
      {right}
      {hasSub && <ChevronRight className="w-3.5 h-3.5" style={{ color: "#555" }} />}
    </button>
  );

  const Divider = () => <div className="my-1" style={{ height: 1, background: "#1e1e1e" }} />;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => { setOpen(v => !v); setSub(null); }}
        disabled={disabled}
        className="w-7 h-7 rounded-full flex items-center justify-center transition-all shrink-0 disabled:opacity-40"
        style={{ 
          background: open ? "rgba(29,140,248,0.15)" : C.surface2, 
          border: `1px solid ${open ? C.accent : C.border}`, 
          color: open ? C.accent : C.muted 
        }}
        data-testid="plus-menu-trigger"
      >
        <Plus className={`w-3.5 h-3.5 transition-transform duration-200 ${open ? "rotate-45" : ""}`} />
      </button>

      {open && (
        <div className="absolute bottom-full left-0 mb-2 z-50 flex items-end gap-1" data-testid="plus-menu-content">
          {/* Main panel */}
          <div className="w-56 rounded-xl py-1 shadow-2xl" style={panelStyle}>
            <Row icon={Paperclip} label="Add files or photos" onClick={close} />
            <Row icon={FolderOpen} label="Add to project" onClick={() => { onSelect("Add the following to the project: ", true); close(); }} />
            <Row icon={GitBranch} label="Add from GitHub" onClick={() => { onSelect("Pull from GitHub repo: ", true); close(); }} />
            <Divider />
            <Row icon={Wrench} label="Skills" badge={enabledSkills.length} hasSub onClick={() => setSub(p => p === "skills" ? null : "skills")} />
            <Row icon={Layers} label="Connectors" badge={Object.values(connectors).filter(Boolean).length} hasSub onClick={() => setSub(p => p === "connectors" ? null : "connectors")} />
            <Row icon={Cpu} label="Plugins" onClick={close} />
            <Divider />
            <Row icon={Telescope} label="Research" onClick={() => { onSelect("Do deep research on: ", true); close(); }} />
            <Row icon={Globe} label="Web search" active={webSearchEnabled} onClick={() => setWebSearchEnabled(!webSearchEnabled)} />
            <Row icon={Bot} label="Use style" hasSub onClick={() => setSub(p => p === "style" ? null : "style")} />
          </div>

          {/* Skills sub-panel */}
          {sub === "skills" && (
            <div className="w-52 rounded-xl py-1 shadow-2xl" style={panelStyle} data-testid="skills-submenu">
              {SKILLS.map(sk => (
                <button
                  key={sk}
                  type="button"
                  className="w-full flex items-center justify-between gap-2.5 px-3 py-[6px] text-[13px] text-left transition-colors"
                  style={{ color: "#ccc" }}
                  onMouseOver={e => { e.currentTarget.style.background = hoverBg; }}
                  onMouseOut={e => { e.currentTarget.style.background = "transparent"; }}
                  onClick={() => toggleSkill(sk)}
                  data-testid={`skill-${sk}`}
                >
                  {sk}
                  {enabledSkills.includes(sk) && <Check className="w-3.5 h-3.5" style={{ color: C.accent }} />}
                </button>
              ))}
              <Divider />
              <Row icon={Wrench} label="Manage skills" onClick={close} />
              <button
                type="button"
                className="w-full flex items-center gap-2.5 px-3 py-[6px] text-[13px] text-left transition-colors"
                style={{ color: "#888" }}
                onMouseOver={e => { e.currentTarget.style.background = hoverBg; e.currentTarget.style.color = "#ccc"; }}
                onMouseOut={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#888"; }}
                onClick={close}
              >
                <Plus className="w-3.5 h-3.5" /> Add skill
              </button>
            </div>
          )}

          {/* Connectors sub-panel */}
          {sub === "connectors" && (
            <div className="w-60 rounded-xl py-1 shadow-2xl" style={panelStyle} data-testid="connectors-submenu">
              {CONNECTORS.map(c => {
                const Icon = c.icon;
                return (
                  <div
                    key={c.id}
                    className="flex items-center gap-2.5 px-3 py-[7px] transition-colors"
                    style={{ color: C.text }}
                    onMouseOver={e => { e.currentTarget.style.background = hoverBg; }}
                    onMouseOut={e => { e.currentTarget.style.background = "transparent"; }}
                  >
                    <Icon className="w-4 h-4 shrink-0" style={{ color: "#888" }} />
                    <span className="text-[13px] flex-1">{c.label}</span>
                    <Toggle on={connectors[c.id]} onToggle={() => toggleConnector(c.id)} />
                  </div>
                );
              })}
              <Divider />
              <Row icon={Wrench} label="Manage connectors" onClick={close} />
              <button
                type="button"
                className="w-full flex items-center gap-2.5 px-3 py-[6px] text-[13px] text-left transition-colors"
                style={{ color: "#888" }}
                onMouseOver={e => { e.currentTarget.style.background = hoverBg; e.currentTarget.style.color = "#ccc"; }}
                onMouseOut={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#888"; }}
                onClick={close}
              >
                <Plus className="w-3.5 h-3.5" /> Add connector
              </button>
              <Divider />
              <Row icon={Wrench} label="Tool access" hasSub onClick={() => setSub("tool-access")} />
            </div>
          )}

          {/* Tool access sub-panel */}
          {sub === "tool-access" && (
            <div className="w-56 rounded-xl py-2 shadow-2xl" style={panelStyle} data-testid="tool-access-submenu">
              {[
                { id: "lazy", title: "Load tools when needed", desc: "Tools aren't pre-loaded." },
                { id: "eager", title: "Tools already loaded", desc: "Tools are always loaded." },
              ].map(opt => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => { setToolAccess(opt.id); setSub("connectors"); }}
                  className="w-full text-left px-3 py-2 transition-colors"
                  onMouseOver={e => { e.currentTarget.style.background = hoverBg; }}
                  onMouseOut={e => { e.currentTarget.style.background = "transparent"; }}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-medium" style={{ color: toolAccess === opt.id ? C.accent : C.text }}>{opt.title}</span>
                    {toolAccess === opt.id && <Check className="w-3.5 h-3.5" style={{ color: C.accent }} />}
                  </div>
                  <p className="text-[11px] mt-0.5" style={{ color: "#666" }}>{opt.desc}</p>
                </button>
              ))}
            </div>
          )}

          {/* Style sub-panel */}
          {sub === "style" && (
            <div className="w-48 rounded-xl py-1 shadow-2xl" style={panelStyle} data-testid="style-submenu">
              {["Normal", "Concise", "Formal", "Explanatory"].map(s => (
                <button
                  key={s}
                  type="button"
                  className="w-full flex items-center justify-between text-left px-3 py-[7px] text-[13px] transition-colors"
                  style={{ color: "#ccc" }}
                  onMouseOver={e => { e.currentTarget.style.background = hoverBg; }}
                  onMouseOut={e => { e.currentTarget.style.background = "transparent"; }}
                  onClick={() => { setWritingStyle(s); close(); }}
                  data-testid={`style-${s.toLowerCase()}`}
                >
                  {s}
                  {writingStyle === s && <Check className="w-3.5 h-3.5" style={{ color: C.accent }} />}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Input Bar ──────────────────────────────────────────────────────────────── */
function InputBar({ onSend, disabled, placeholder, fillPrompt, onFillConsumed }) {
  const [val, setVal] = useState("");
  const ref = useRef(null);
  const { models, providers, activeModel } = useGateway();

  useEffect(() => {
    if (fillPrompt) {
      setVal(fillPrompt);
      onFillConsumed?.();
      setTimeout(() => ref.current?.focus(), 0);
    }
  }, [fillPrompt, onFillConsumed]);

  const handleInput = (e) => {
    setVal(e.target.value);
    const el = e.target;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 180)}px`;
  };

  const handleKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  const submit = () => {
    if (!val.trim() || disabled) return;
    onSend(val.trim());
    setVal("");
    if (ref.current) ref.current.style.height = "auto";
  };

  const handleQuick = (prompt, fill) => {
    if (fill) {
      setVal(prompt);
      setTimeout(() => ref.current?.focus(), 0);
    } else {
      onSend(prompt);
    }
  };

  const active = !!val.trim() && !disabled;

  return (
    <div className="w-full rounded-2xl shadow-xl" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
      <textarea
        ref={ref}
        value={val}
        onChange={handleInput}
        onKeyDown={handleKey}
        placeholder={placeholder ?? (disabled ? "Connecting to gateway…" : "Ask anything...")}
        disabled={disabled}
        rows={1}
        className="w-full focus:outline-none resize-none text-[14px] font-sans"
        style={{
          background: "transparent",
          border: "none",
          color: C.text,
          padding: "14px 16px 10px",
          minHeight: 52,
          maxHeight: 180,
          opacity: disabled ? 0.5 : 1,
        }}
        data-testid="chat-input"
      />
      <div className="flex items-center gap-2 px-3 pb-3">
        <PlusMenu onSelect={handleQuick} disabled={disabled} />

        <button
          type="button"
          className="flex items-center gap-1.5 h-7 px-2.5 rounded-full text-[12px] font-medium transition-colors"
          style={{ background: "rgba(29,140,248,0.12)", border: "1px solid rgba(29,140,248,0.25)", color: C.accent }}
          data-testid="agent-mode-toggle"
        >
          <span className="text-sm leading-none">🤖</span>
          <span>Agent</span>
          <ChevronDown className="w-3 h-3 opacity-60" />
        </button>

        <div className="flex-1" />

        <ModelSelector 
          models={models} 
          providers={providers}
          activeModel={activeModel} 
          onSelect={switchModel}
        />

        <button
          type="button"
          className="w-7 h-7 flex items-center justify-center rounded-full transition-colors"
          style={{ color: C.muted }}
          data-testid="mic-btn"
        >
          <Mic className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={submit}
          disabled={!active}
          className="w-8 h-8 rounded-full flex items-center justify-center transition-all"
          style={{ 
            background: active ? C.accent : C.surface2, 
            color: active ? "#fff" : "#555", 
            cursor: active ? "pointer" : "not-allowed" 
          }}
          title="Send (Enter)"
          data-testid="send-btn"
        >
          <Send className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

/* ─── Message Row ────────────────────────────────────────────────────────────── */
function MessageRow({ msg }) {
  const fmtTime = (ts) => new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  if (msg.role === "user") {
    return (
      <div className="flex justify-end py-2 px-4">
        <div className="max-w-[75%]">
          <div
            className="rounded-2xl rounded-tr-sm px-4 py-2.5 text-sm whitespace-pre-wrap break-words"
            style={{ background: "rgba(29,140,248,0.15)", border: "1px solid rgba(29,140,248,0.2)", color: C.text }}
          >
            {msg.content}
          </div>
          <div className="text-[10px] text-right mt-1" style={{ color: "#555" }}>{fmtTime(msg.timestamp)}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-3 py-2 px-4">
      <div
        className="w-7 h-7 rounded-full flex items-center justify-center text-sm shrink-0 mt-0.5"
        style={{ background: "rgba(29,140,248,0.1)", border: "1px solid rgba(29,140,248,0.2)" }}
      >
        🦞
      </div>
      <div className="flex-1 min-w-0">
        <div
          className="rounded-2xl rounded-tl-sm px-4 py-2.5 text-sm"
          style={{ background: C.surface, border: `1px solid ${C.border}` }}
        >
          <Markdown content={msg.content} />
        </div>
        <div className="text-[10px] mt-1" style={{ color: "#555" }}>{fmtTime(msg.timestamp)}</div>
      </div>
    </div>
  );
}

/* ─── Dashboard Page ─────────────────────────────────────────────────────────── */
function DashboardPage() {
  const { jobs, approvals, connectors, status, activeModel, events } = useGateway();
  
  const runningJobs = jobs.filter(j => j.status === "running").length;
  const pendingApprovals = approvals.filter(a => a.status === "pending").length;
  const activeConnectors = Object.values(connectors).filter(Boolean).length;

  const stats = [
    { label: "Active Jobs", value: runningJobs, icon: Briefcase, color: C.accent },
    { label: "Pending Approvals", value: pendingApprovals, icon: AlertTriangle, color: C.yellow },
    { label: "Connectors", value: `${activeConnectors}/6`, icon: Layers, color: C.green },
    { label: "Gateway", value: status, icon: Radio, color: status === "connected" ? C.green : C.yellow },
  ];

  return (
    <div className="p-6 space-y-6" style={{ color: C.text }}>
      <h1 className="text-2xl font-bold">Mission Control Dashboard</h1>
      
      {/* Stats Grid */}
      <div className="grid grid-cols-4 gap-4">
        {stats.map(stat => (
          <div key={stat.label} className="p-4 rounded-xl" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: `${stat.color}20` }}>
                <stat.icon className="w-5 h-5" style={{ color: stat.color }} />
              </div>
              <div>
                <div className="text-2xl font-bold">{stat.value}</div>
                <div className="text-xs" style={{ color: C.muted }}>{stat.label}</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Active Model */}
      <div className="p-4 rounded-xl" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-medium mb-1">Active Model</div>
            <div className="text-lg" style={{ color: C.accent }}>{activeModel || "None selected"}</div>
          </div>
          <Cpu className="w-8 h-8" style={{ color: C.muted }} />
        </div>
      </div>

      {/* Recent Events */}
      <div className="p-4 rounded-xl" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
        <h2 className="text-sm font-medium mb-3">Recent Events</h2>
        <div className="space-y-2 max-h-48 overflow-auto">
          {events.length === 0 ? (
            <div className="text-sm" style={{ color: C.muted }}>No events yet</div>
          ) : (
            events.slice(-10).reverse().map(evt => (
              <div key={evt.id} className="flex items-center gap-2 text-xs">
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: C.accent }} />
                <span style={{ color: C.accent }}>{evt.type}</span>
                <span style={{ color: C.muted }}>{new Date(evt.ts).toLocaleTimeString()}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Jobs Page ──────────────────────────────────────────────────────────────── */
function JobsPage() {
  const { jobs, updateJobStatus, cancelJob } = useGateway();

  const getStatusColor = (status) => {
    switch (status) {
      case "running": return C.accent;
      case "completed": return C.green;
      case "pending": return C.yellow;
      case "failed":
      case "cancelled": return C.red;
      default: return C.muted;
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case "running": return <Play className="w-4 h-4" />;
      case "completed": return <CheckCircle className="w-4 h-4" />;
      case "pending": return <Clock className="w-4 h-4" />;
      case "failed":
      case "cancelled": return <XCircle className="w-4 h-4" />;
      default: return <AlertCircle className="w-4 h-4" />;
    }
  };

  return (
    <div className="p-6 space-y-4" style={{ color: C.text }}>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Jobs</h1>
        <Button className="gap-2" style={{ background: C.accent }}>
          <Plus className="w-4 h-4" /> New Job
        </Button>
      </div>

      <div className="space-y-3">
        {jobs.map(job => (
          <div
            key={job.id}
            className="p-4 rounded-xl"
            style={{ background: C.surface, border: `1px solid ${C.border}` }}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{ background: `${getStatusColor(job.status)}20`, color: getStatusColor(job.status) }}
                >
                  {getStatusIcon(job.status)}
                </div>
                <div>
                  <div className="font-medium">{job.name}</div>
                  <div className="text-xs" style={{ color: C.muted }}>Agent: {job.agent}</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className="text-xs px-2 py-1 rounded-full capitalize"
                  style={{ background: `${getStatusColor(job.status)}20`, color: getStatusColor(job.status) }}
                >
                  {job.status}
                </span>
                {job.status === "running" && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => cancelJob(job.id)}
                    style={{ color: C.red }}
                  >
                    <Square className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </div>
            {job.status === "running" && (
              <Progress value={job.progress} className="h-1.5" />
            )}
            {job.status === "running" && (
              <div className="text-xs mt-2" style={{ color: C.muted }}>{job.progress}% complete</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Approvals Page ─────────────────────────────────────────────────────────── */
function ApprovalsPage() {
  const { approvals, approveRequest, rejectRequest } = useGateway();

  const getRiskColor = (risk) => {
    switch (risk) {
      case "low": return C.green;
      case "medium": return C.yellow;
      case "high": return C.red;
      default: return C.muted;
    }
  };

  const getStatusBadge = (status) => {
    const colors = {
      pending: { bg: `${C.yellow}20`, color: C.yellow },
      approved: { bg: `${C.green}20`, color: C.green },
      rejected: { bg: `${C.red}20`, color: C.red },
    };
    return colors[status] || colors.pending;
  };

  return (
    <div className="p-6 space-y-4" style={{ color: C.text }}>
      <h1 className="text-2xl font-bold">Approvals</h1>

      <div className="space-y-3">
        {approvals.map(approval => (
          <div
            key={approval.id}
            className="p-4 rounded-xl"
            style={{ background: C.surface, border: `1px solid ${C.border}` }}
          >
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-3">
                <Shield className="w-5 h-5" style={{ color: getRiskColor(approval.risk) }} />
                <div>
                  <div className="font-medium">{approval.title}</div>
                  <div className="text-sm" style={{ color: C.muted }}>{approval.description}</div>
                </div>
              </div>
              <span
                className="text-xs px-2 py-1 rounded-full capitalize"
                style={getStatusBadge(approval.status)}
              >
                {approval.status}
              </span>
            </div>
            <div className="flex items-center justify-between mt-3">
              <div className="flex items-center gap-4 text-xs" style={{ color: C.muted }}>
                <span>Agent: {approval.agent}</span>
                <span>Risk: <span style={{ color: getRiskColor(approval.risk) }}>{approval.risk}</span></span>
              </div>
              {approval.status === "pending" && (
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => approveRequest(approval.id)}
                    style={{ background: C.green }}
                  >
                    <Check className="w-4 h-4 mr-1" /> Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => rejectRequest(approval.id)}
                    style={{ borderColor: C.red, color: C.red }}
                  >
                    <X className="w-4 h-4 mr-1" /> Reject
                  </Button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Spaces Page ────────────────────────────────────────────────────────────── */
function SpacesPage() {
  const { spaces } = useGateway();

  return (
    <div className="p-6 space-y-4" style={{ color: C.text }}>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Spaces</h1>
        <Button className="gap-2" style={{ background: C.accent }}>
          <Plus className="w-4 h-4" /> New Space
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {spaces.map(space => (
          <div
            key={space.id}
            className="p-4 rounded-xl cursor-pointer hover:border-[#333] transition-colors"
            style={{ background: C.surface, border: `1px solid ${C.border}` }}
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg" style={{ background: space.color }} />
              <div>
                <div className="font-medium">{space.name}</div>
                <div className="text-xs" style={{ color: C.muted }}>{space.description}</div>
              </div>
            </div>
            <div className="flex gap-2">
              {space.agents.map(agent => (
                <span
                  key={agent}
                  className="text-xs px-2 py-1 rounded"
                  style={{ background: C.surface2, color: C.muted }}
                >
                  {agent}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Cowork Page ────────────────────────────────────────────────────────────── */
function CoworkPage() {
  const { coworkParticipants, coworkMessages, addCoworkMessage, updateParticipantStatus } = useGateway();
  const [input, setInput] = useState("");

  const handleSend = () => {
    if (!input.trim()) return;
    addCoworkMessage({
      id: crypto.randomUUID(),
      sender: "user",
      content: input,
      timestamp: Date.now(),
    });
    setInput("");
    
    // Simulate agent response
    updateParticipantStatus("claw", "thinking");
    setTimeout(() => {
      addCoworkMessage({
        id: crypto.randomUUID(),
        sender: "claw",
        content: "I understand your request. Let me work on that collaboratively with you.",
        timestamp: Date.now(),
      });
      updateParticipantStatus("claw", "idle");
    }, 1500);
  };

  return (
    <div className="h-full flex" style={{ color: C.text }}>
      {/* Participants sidebar */}
      <div className="w-60 p-4" style={{ borderRight: `1px solid ${C.border}`, background: C.surface }}>
        <h2 className="text-sm font-medium mb-3">Participants</h2>
        <div className="space-y-2">
          {coworkParticipants.map(p => (
            <div key={p.id} className="flex items-center gap-2 p-2 rounded" style={{ background: C.surface2 }}>
              <div className="relative">
                <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: p.role === "human" ? C.accent : C.green }}>
                  {p.role === "human" ? <Users className="w-4 h-4" /> : "🦞"}
                </div>
                <span
                  className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2"
                  style={{
                    borderColor: C.surface,
                    background: p.status === "active" || p.status === "thinking" ? C.green : C.muted,
                  }}
                />
              </div>
              <div>
                <div className="text-sm font-medium">{p.name}</div>
                <div className="text-xs capitalize" style={{ color: C.muted }}>{p.status}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Chat area */}
      <div className="flex-1 flex flex-col">
        <div className="p-4" style={{ borderBottom: `1px solid ${C.border}` }}>
          <h1 className="text-xl font-bold">Cowork Session</h1>
          <p className="text-sm" style={{ color: C.muted }}>Collaborate in real-time with OpenClaw</p>
        </div>
        
        <div className="flex-1 overflow-auto p-4 space-y-3">
          {coworkMessages.length === 0 ? (
            <div className="text-center py-8" style={{ color: C.muted }}>
              Start a cowork session by sending a message
            </div>
          ) : (
            coworkMessages.map(msg => (
              <div
                key={msg.id}
                className={`flex ${msg.sender === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className="max-w-[70%] px-4 py-2.5 rounded-2xl"
                  style={{
                    background: msg.sender === "user" ? `${C.accent}20` : C.surface,
                    border: `1px solid ${msg.sender === "user" ? `${C.accent}30` : C.border}`,
                  }}
                >
                  {msg.content}
                </div>
              </div>
            ))
          )}
        </div>

        <div className="p-4" style={{ borderTop: `1px solid ${C.border}` }}>
          <div className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleSend()}
              placeholder="Collaborate with the team..."
              className="flex-1 px-4 py-2 rounded-xl text-sm"
              style={{ background: C.surface2, border: `1px solid ${C.border}`, color: C.text }}
            />
            <Button onClick={handleSend} style={{ background: C.accent }}>
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Code Page ──────────────────────────────────────────────────────────────── */
function CodePage() {
  const { terminalOutput, addTerminalOutput, clearTerminal } = useGateway();
  const [cmd, setCmd] = useState("");
  const terminalRef = useRef(null);

  useEffect(() => {
    terminalRef.current?.scrollTo(0, terminalRef.current.scrollHeight);
  }, [terminalOutput]);

  const handleCommand = async () => {
    if (!cmd.trim()) return;
    await executeCommand(cmd);
    setCmd("");
  };

  return (
    <div className="h-full flex flex-col" style={{ color: C.text }}>
      <div className="p-4 flex items-center justify-between" style={{ borderBottom: `1px solid ${C.border}` }}>
        <div>
          <h1 className="text-xl font-bold">Terminal</h1>
          <p className="text-sm" style={{ color: C.muted }}>Execute commands via OpenClaw sandbox</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={clearTerminal}>
            <Trash2 className="w-4 h-4 mr-1" /> Clear
          </Button>
        </div>
      </div>

      <div
        ref={terminalRef}
        className="flex-1 p-4 font-mono text-sm overflow-auto"
        style={{ background: "#000" }}
      >
        {terminalOutput.length === 0 ? (
          <div style={{ color: C.muted }}>Terminal ready. Type a command below.</div>
        ) : (
          terminalOutput.map(line => (
            <div key={line.id} style={{ color: line.content.startsWith("$") ? C.green : C.text }}>
              {line.content}
            </div>
          ))
        )}
      </div>

      <div className="p-4" style={{ borderTop: `1px solid ${C.border}`, background: "#000" }}>
        <div className="flex items-center gap-2">
          <span style={{ color: C.green }}>$</span>
          <input
            type="text"
            value={cmd}
            onChange={e => setCmd(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleCommand()}
            placeholder="Enter command..."
            className="flex-1 bg-transparent border-none outline-none font-mono text-sm"
            style={{ color: C.text }}
          />
          <Button size="sm" onClick={handleCommand} style={{ background: C.accent }}>
            <ArrowRight className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ─── Settings Page ──────────────────────────────────────────────────────────── */
function SettingsPage() {
  const { connectors, toggleConnector, writingStyle, setWritingStyle, webSearchEnabled, setWebSearchEnabled } = useGateway();

  return (
    <div className="p-6 space-y-6" style={{ color: C.text }}>
      <h1 className="text-2xl font-bold">Settings</h1>

      {/* Connectors */}
      <div className="p-4 rounded-xl" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
        <h2 className="text-lg font-medium mb-4">Connectors</h2>
        <div className="space-y-3">
          {CONNECTORS.map(c => (
            <div key={c.id} className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <c.icon className="w-5 h-5" style={{ color: C.muted }} />
                <span>{c.label}</span>
              </div>
              <Toggle on={connectors[c.id]} onToggle={() => toggleConnector(c.id)} />
            </div>
          ))}
        </div>
      </div>

      {/* Preferences */}
      <div className="p-4 rounded-xl" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
        <h2 className="text-lg font-medium mb-4">Preferences</h2>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span>Web Search</span>
            <Toggle on={webSearchEnabled} onToggle={() => setWebSearchEnabled(!webSearchEnabled)} />
          </div>
          <div>
            <label className="block text-sm mb-2">Writing Style</label>
            <div className="flex gap-2">
              {["Normal", "Concise", "Formal", "Explanatory"].map(s => (
                <button
                  key={s}
                  onClick={() => setWritingStyle(s)}
                  className="px-3 py-1.5 rounded text-sm"
                  style={{
                    background: writingStyle === s ? C.accent : C.surface2,
                    color: writingStyle === s ? "#fff" : C.muted,
                  }}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Layout ─────────────────────────────────────────────────────────────────── */
function Layout({ children }) {
  const location = useLocation();
  const { status, clawStatus, approvals, activeTab, setActiveTab } = useGateway();
  const clawState = clawStatus?.state ?? "Scheduled";
  const pendingApprovals = approvals.filter(a => a.status === "pending").length;

  return (
    <div className="flex h-screen w-full overflow-hidden" style={{ background: C.bg, color: C.text }}>
      {/* Sidebar */}
      <aside className="flex flex-col shrink-0 overflow-hidden" style={{ width: 260, background: "#0f0f0f", borderRight: "1px solid #222" }}>
        {/* Workspace picker */}
        <div
          className="flex items-center gap-2 px-4 py-3.5 cursor-pointer hover:bg-white/5 transition-colors"
          style={{ borderBottom: "1px solid #222" }}
          data-testid="workspace-dropdown"
        >
          <div className="w-5 h-5 rounded" style={{ background: C.accent }} />
          <span className="text-sm font-medium flex-1" style={{ color: C.text }}>Personal</span>
          <ChevronDown className="w-3.5 h-3.5" style={{ color: "#666" }} />
        </div>

        {/* Nav items */}
        <div className="flex flex-col gap-0.5 px-2 pt-3 pb-1">
          <Link
            to="/"
            className="flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors"
            style={{ color: "#888" }}
            data-testid="nav-new-thread"
          >
            <Plus className="w-4 h-4" />
            New thread
          </Link>
          {NAV.map(item => {
            const active = location.pathname === item.href;
            const badge = item.badgeKey === "pendingApprovals" ? pendingApprovals : null;
            return (
              <Link
                key={item.href}
                to={item.href}
                className="flex items-center justify-between px-3 py-2 rounded-md text-sm transition-colors"
                style={{
                  background: active ? "rgba(29,140,248,0.12)" : "transparent",
                  color: active ? C.accent : "#bbb",
                }}
                data-testid={`nav-${item.label.toLowerCase()}`}
              >
                <div className="flex items-center gap-2.5">
                  <item.icon className="w-4 h-4" />
                  {item.label}
                </div>
                {badge > 0 && (
                  <span
                    className="flex h-4 min-w-4 px-1 items-center justify-center rounded-full text-[10px] font-semibold"
                    style={{ background: item.warn ? "rgba(251,191,36,0.2)" : "rgba(29,140,248,0.2)", color: item.warn ? "#fbbf24" : C.accent }}
                  >
                    {badge}
                  </span>
                )}
              </Link>
            );
          })}
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* Bookmarks */}
          <div className="px-4 pt-5 pb-2">
            <p className="text-[10px] uppercase tracking-widest mb-2 font-medium" style={{ color: "#555" }}>Bookmarks</p>
            {[
              { label: "Config + logs", icon: Terminal },
              { label: "Setting Up OpenClaw Wi…", icon: Bookmark },
            ].map(b => (
              <button
                key={b.label}
                className="flex items-center gap-2 w-full px-1 py-1.5 text-sm rounded transition-colors text-left"
                style={{ color: "#888" }}
              >
                <b.icon className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate text-[13px]">{b.label}</span>
              </button>
            ))}
          </div>

          {/* History */}
          <div className="px-4 pt-4 pb-2">
            <p className="text-[10px] uppercase tracking-widest mb-2 font-medium" style={{ color: "#555" }}>History</p>
            {HISTORY.map((h, i) => (
              <button
                key={i}
                className="flex items-center gap-2 w-full px-1 py-1.5 text-[13px] rounded transition-colors text-left truncate"
                style={{ color: "#666" }}
              >
                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: "#333" }} />
                <span className="truncate">{h}</span>
              </button>
            ))}
          </div>
        </div>

        {/* User row */}
        <div className="flex items-center gap-3 px-4 py-3.5" style={{ borderTop: "1px solid #222" }}>
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold shrink-0"
            style={{ background: C.accent, color: "#fff" }}
            data-testid="user-avatar"
          >
            M
          </div>
          <span className="text-sm font-medium" style={{ color: C.text }}>Meg</span>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <header className="h-12 flex items-center justify-between px-6 shrink-0" style={{ borderBottom: "1px solid #1a1a1a", background: C.bg }}>
          <div className="w-32" />
          <div className="flex items-center gap-1">
            {["Chat", "Cowork", "Code"].map(tab => {
              const isActive = activeTab === tab.toLowerCase();
              return (
                <Link
                  key={tab}
                  to={tab === "Chat" ? "/" : `/${tab.toLowerCase()}`}
                  onClick={() => setActiveTab(tab.toLowerCase())}
                  className="px-3.5 py-1 rounded-md text-[13px] font-medium transition-colors"
                  style={{
                    background: isActive ? "rgba(29,140,248,0.12)" : "transparent",
                    color: isActive ? C.accent : "#666",
                  }}
                  data-testid={`tab-${tab.toLowerCase()}`}
                >
                  {tab}
                </Link>
              );
            })}
          </div>
          <div className="w-32 flex items-center justify-end gap-2 text-[12px]" style={{ color: "#888" }}>
            <div className="relative flex h-2 w-2">
              {status === "connected" ? (
                <>
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ background: "#22c55e" }} />
                  <span className="relative inline-flex rounded-full h-2 w-2" style={{ background: "#22c55e" }} />
                </>
              ) : status === "connecting" ? (
                <span className="relative inline-flex rounded-full h-2 w-2 animate-pulse" style={{ background: "#fbbf24" }} />
              ) : (
                <span className="relative inline-flex rounded-full h-2 w-2" style={{ background: "#666" }} />
              )}
            </div>
            <span className="capitalize" data-testid="connection-status">{clawState}</span>
          </div>
        </header>

        <div className="flex-1 overflow-hidden relative">
          {children}
        </div>
      </main>
    </div>
  );
}

/* ─── Home Page ──────────────────────────────────────────────────────────────── */
function HomePage() {
  const { messages, streamingMessage, status, clearMessages } = useGateway();
  const [fillPrompt, setFillPrompt] = useState(null);
  const bottomRef = useRef(null);
  const hasMessages = messages.length > 0 || !!streamingMessage;

  useEffect(() => {
    initGateway();
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, streamingMessage?.content]);

  const doSend = useCallback(async (text) => {
    if (!text.trim()) return;
    await sendMessage(text);
  }, []);

  // Empty state
  if (!hasMessages) {
    return (
      <div className="relative h-full flex flex-col" style={{ background: C.bg }}>
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <BinaryRain />
        </div>

        <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-6">
          <div className="w-full" style={{ maxWidth: 680 }}>
            <div className="text-center mb-10">
              <h1 className="text-4xl font-bold mb-1 tracking-tight" style={{ color: C.text }} data-testid="logo-title">
                OpenClaw <span>🦞</span>
              </h1>
              <p className="text-sm tracking-widest uppercase" style={{ color: C.muted }}>Mission Control</p>
            </div>

            <div className="w-full mb-5">
              <InputBar
                onSend={doSend}
                disabled={status !== "connected"}
                fillPrompt={fillPrompt}
                onFillConsumed={() => setFillPrompt(null)}
              />
            </div>

            <div className="grid grid-cols-2 gap-3 w-full">
              {CARDS.map(card => {
                const Icon = card.icon;
                return (
                  <button
                    key={card.title}
                    onClick={() => card.fill ? setFillPrompt(card.prompt) : doSend(card.prompt)}
                    disabled={status !== "connected"}
                    className="text-left p-4 rounded-xl transition-all group disabled:opacity-40"
                    style={{ background: C.surface, border: `1px solid ${C.border}` }}
                    data-testid={`card-${card.title.toLowerCase().replace(/\s+/g, '-')}`}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                        style={{ background: C.surface2, border: `1px solid ${C.border}` }}
                      >
                        <Icon className="w-3.5 h-3.5" style={{ color: C.muted }} />
                      </div>
                      <div>
                        <div className="text-[13px] font-medium mb-0.5" style={{ color: C.text }}>{card.title}</div>
                        <div className="text-[11px] leading-snug" style={{ color: C.muted }}>{card.desc}</div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Chat state
  return (
    <div className="relative h-full flex flex-col" style={{ background: C.bg }}>
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <BinaryRain />
      </div>

      <div
        className="relative z-10 flex items-center justify-between px-4 py-2 shrink-0"
        style={{ borderBottom: `1px solid ${C.surface2}`, background: "rgba(10,10,10,0.85)" }}
      >
        <button
          onClick={clearMessages}
          className="flex items-center gap-1.5 text-[11px] transition-colors"
          style={{ color: "#666" }}
          data-testid="clear-chat-btn"
        >
          <Trash2 className="w-3 h-3" /> Clear chat
        </button>
        <button
          className="flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-full transition-colors"
          style={{ border: `1px solid ${C.border}`, color: "#666" }}
          data-testid="events-toggle"
        >
          <Terminal className="w-3 h-3" />
          Events
        </button>
      </div>

      <div className="relative z-10 flex-1 overflow-y-auto py-4">
        {messages.map(msg => (
          <MessageRow key={msg.id} msg={msg} />
        ))}

        {streamingMessage && (
          <div className="flex gap-3 py-2 px-4">
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center text-sm shrink-0 mt-0.5"
              style={{ background: "rgba(29,140,248,0.1)", border: "1px solid rgba(29,140,248,0.2)" }}
            >
              🦞
            </div>
            <div className="flex-1 min-w-0">
              <div
                className="rounded-2xl rounded-tl-sm px-4 py-2.5 text-sm relative"
                style={{ background: C.surface, border: "1px solid rgba(29,140,248,0.2)" }}
              >
                {streamingMessage.content ? (
                  <Markdown content={streamingMessage.content} />
                ) : (
                  <div className="flex gap-1 items-center py-0.5">
                    {[0, 150, 300].map(d => (
                      <span
                        key={d}
                        className="w-1.5 h-1.5 rounded-full animate-bounce"
                        style={{ background: C.accent, opacity: 0.6, animationDelay: `${d}ms` }}
                      />
                    ))}
                  </div>
                )}
                <span className="absolute bottom-2 right-3 w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: C.accent }} />
              </div>
              <div className="text-[10px] mt-1" style={{ color: C.accent, opacity: 0.6 }}>typing…</div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="relative z-10 px-4 pb-4 pt-2 shrink-0">
        <InputBar onSend={doSend} disabled={status !== "connected"} placeholder="Message Claw…" />
      </div>
    </div>
  );
}

/* ─── Main App ───────────────────────────────────────────────────────────────── */
function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/agent" element={<HomePage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/jobs" element={<JobsPage />} />
        <Route path="/approvals" element={<ApprovalsPage />} />
        <Route path="/spaces" element={<SpacesPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/cowork" element={<CoworkPage />} />
        <Route path="/code" element={<CodePage />} />
      </Routes>
      <Toaster />
    </Layout>
  );
}

export default App;
