import React, { useState, useEffect, useRef, useCallback } from "react";
import { Link, useLocation } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  MessageSquare, Monitor, LayoutDashboard, Briefcase,
  AlertTriangle, Grid3X3, Settings, Plus, ChevronDown, ChevronRight,
  Terminal, Bookmark, Send, Telescope, Paperclip, Layers, Mic, Wrench,
  FolderOpen, Globe, Eye, Brain, Zap, Radio, Cpu, Rocket, Bot, Trash2,
  MessageCircle, X, Check,
} from "lucide-react";
import { useGateway, initGateway, sendMessage, switchModel } from "@/lib/useGateway";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Toaster } from "@/components/ui/toaster";
import { useToast } from "@/hooks/use-toast";

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
};

/* ─── Navigation items ─────────────────────────────────────────────────────── */
const NAV = [
  { href: "/",          label: "Chat",      icon: MessageSquare },
  { href: "/agent",     label: "Agent",     icon: Monitor },
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/jobs",      label: "Jobs",      icon: Briefcase },
  { href: "/approvals", label: "Approvals", icon: AlertTriangle, badge: "2", warn: true },
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

const MODEL_CAPS = [
  { key: "vision", Icon: Eye,   label: "Vision" },
  { key: "tools",  Icon: Wrench, label: "Tools" },
  { key: "memory", Icon: Brain, label: "Reasoning" },
  { key: "fast",   Icon: Zap,   label: "Fast" },
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
      data-testid="toggle-switch"
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

/* ─── Model Selector ─────────────────────────────────────────────────────────── */
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

  const HDR = { borderBottom: "1px solid #1d1d1d" };
  const hoverRow = "rgba(255,255,255,0.045)";
  const activeRow = "rgba(29,140,248,0.1)";
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
            <div className="px-3 py-2 shrink-0" style={HDR}>
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
          <div style={{ width: 320, background: "#131313", display: "flex", flexDirection: "column", maxHeight: 440 }}>
            {selProv ? (
              <>
                <div className="flex items-center justify-between px-3 py-2 shrink-0" style={HDR}>
                  <span className="text-[11px] font-bold uppercase tracking-[0.1em]" style={{ color: "#555" }}>{selProv}</span>
                  <div className="flex items-center gap-2">
                    {MODEL_CAPS.map(({ key, Icon, label }) => (
                      <span key={key} title={label} className="flex items-center justify-center w-3.5 h-3.5" style={{ color: "#3a3a3a" }}>
                        <Icon className="w-3 h-3" />
                      </span>
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
                        className="w-full px-3 py-[8px] text-left transition-colors"
                        style={{ background: isActive ? activeRow : "transparent" }}
                        onMouseOver={e => { if (!isActive) e.currentTarget.style.background = hoverRow; }}
                        onMouseOut={e => { if (!isActive) e.currentTarget.style.background = "transparent"; }}
                        data-testid={`model-${m.name}`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[13px] font-semibold truncate" style={{ color: isActive ? C.accent : "#ddd" }}>{m.name}</span>
                          {isActive && <Check className="w-3 h-3 shrink-0" style={{ color: C.accent }} />}
                        </div>
                        <div className="text-[10px] truncate mt-[1px]" style={{ color: "#484848", fontFamily: "monospace" }}>{m.id}</div>
                        <div className="flex items-center gap-1.5 mt-1">
                          {m.cost && (
                            <span className="text-[10px] px-[5px] py-[1px] rounded font-mono shrink-0" style={{ background: "#1a1a1a", color: "#f5a623", border: "1px solid #2a2200" }}>
                              {m.cost}
                            </span>
                          )}
                          {m.context && (
                            <span className="text-[10px] px-[5px] py-[1px] rounded font-mono shrink-0" style={{ background: "#1a1a1a", color: "#666", border: "1px solid #222" }}>
                              {m.context}
                            </span>
                          )}
                          <div className="flex items-center gap-1 ml-auto">
                            {MODEL_CAPS.map(({ key, Icon }) => {
                              const on = m.caps?.[key];
                              return (
                                <span key={key} className="flex items-center justify-center w-3.5 h-3.5" style={{ color: on ? C.accent : "#282828" }}>
                                  <Icon className="w-3 h-3" />
                                </span>
                              );
                            })}
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
            <Row icon={Globe} label="Add from GitHub" onClick={() => { onSelect("Pull from GitHub repo: ", true); close(); }} />
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

/* ─── Layout ─────────────────────────────────────────────────────────────────── */
function Layout({ children }) {
  const location = useLocation();
  const { status, clawStatus } = useGateway();
  const clawState = clawStatus?.state ?? "Scheduled";

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
                {item.badge && (
                  <span
                    className="flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-semibold"
                    style={{ background: item.warn ? "rgba(251,191,36,0.2)" : "rgba(29,140,248,0.2)", color: item.warn ? "#fbbf24" : C.accent }}
                  >
                    {item.badge}
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
              const isActive = tab === "Chat";
              return (
                <button
                  key={tab}
                  className="px-3.5 py-1 rounded-md text-[13px] font-medium transition-colors"
                  style={{
                    background: isActive ? "rgba(29,140,248,0.12)" : "transparent",
                    color: isActive ? C.accent : "#666",
                  }}
                  data-testid={`tab-${tab.toLowerCase()}`}
                >
                  {tab}
                </button>
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
function Home() {
  const { messages, streamingMessage, status, clearMessages } = useGateway();
  const [fillPrompt, setFillPrompt] = useState(null);
  const [showEvents, setShowEvents] = useState(false);
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
          onClick={() => setShowEvents(v => !v)}
          className="flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-full transition-colors"
          style={{
            border: `1px solid ${showEvents ? "rgba(29,140,248,0.4)" : C.border}`,
            background: showEvents ? "rgba(29,140,248,0.1)" : "transparent",
            color: showEvents ? C.accent : "#666",
          }}
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
      <Home />
      <Toaster />
    </Layout>
  );
}

export default App;
