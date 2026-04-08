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
  Search, Lightbulb, PenTool, BarChart3, FolderKanban, MessageSquareText,
  Cloud, Lock, Unlock, Sparkles, Package, Puzzle, Link2, ChevronLeft,
  Database, FileText, Presentation, Calendar, ListTodo, FileSearch,
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
    <span className="text-[9px] px-1.5 py-0.5 rounded font-medium" style={{ background: style.bg, color: style.color, border: `1px solid ${style.border}` }}>
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
  "New conversation", "New conversation", "New conversation", "New conversation",
  "hello", "hi", "hello",
];

const CONNECTORS = [
  { id: "mac", label: "Control your Mac", icon: Monitor },
  { id: "desktop", label: "Desktop Commander", icon: Terminal },
  { id: "files", label: "File Access", icon: FolderOpen },
  { id: "web", label: "Web Search", icon: Globe },
  { id: "signal", label: "Signal", icon: Radio },
  { id: "telegram", label: "Telegram", icon: MessageCircle },
];

const SKILLS = [
  "deep-research", "code-review", "web-scraper", "file-manager",
  "task-scheduler", "mcp-builder", "slack-gif-creator", "canvas-design",
];

const CARDS = [
  { icon: Cpu, title: "Select a model", desc: "Choose from local and cloud models for your tasks", prompt: "What AI models do you have available?", fill: false },
  { icon: Bot, title: "Try Agent", desc: "Agent works on any task: building apps, editing files, running commands", prompt: "What are your current agent capabilities?", fill: false },
  { icon: Telescope, title: "Deep Research", desc: "Comprehensive research that synthesises information from multiple sources", prompt: "Do deep research on: ", fill: true },
  { icon: Rocket, title: "Mission Control", desc: "Manage swarm jobs, heartbeats, approvals, and live agent monitoring", prompt: "Give me a full mission control status report.", fill: false },
];

/* ─── Cowork Ideas Data (Claude-style) ─────────────────────────────────────── */
const COWORK_IDEAS = [
  { id: 1, title: "Create a presentation", tags: [], category: "create" },
  { id: 2, title: "Create a daily briefing", tags: ["slack", "notion"], category: "create" },
  { id: 3, title: "Write optimized SQL query", tags: ["Data"], category: "analyze" },
  { id: 4, title: "Draft an architecture design doc", tags: ["Engineering"], category: "create" },
  { id: 5, title: "Turn documents into a presentation", tags: [], category: "create" },
  { id: 6, title: "Plan user research", tags: ["Design"], category: "organize" },
  { id: 7, title: "Polish rough notes into a document", tags: [], category: "create" },
  { id: 8, title: "Create a code review checklist for my team", tags: ["Engineering"], category: "create" },
  { id: 9, title: "Initialize productivity system", tags: ["Productivity"], category: "organize" },
  { id: 10, title: "Build a web app", tags: [], category: "create" },
  { id: 11, title: "Automate a browser task", tags: [], category: "create" },
  { id: 12, title: "Plan a trip", tags: [], category: "organize" },
  { id: 13, title: "Audit accessibility", tags: ["Design"], category: "analyze" },
  { id: 14, title: "Synthesize research insights", tags: ["Design"], category: "analyze" },
  { id: 15, title: "Write UX copy", tags: ["Design"], category: "create" },
  { id: 16, title: "Review for accuracy and bias", tags: ["Data"], category: "analyze" },
  { id: 17, title: "Search all sources", tags: ["Enterprise search"], category: "analyze" },
  { id: 18, title: "Build a data dashboard", tags: [], category: "create" },
  { id: 19, title: "Plan a data pipeline", tags: ["Data science"], category: "organize" },
  { id: 20, title: "Write a meeting follow-up", tags: [], category: "communicate" },
  { id: 21, title: "Create a launch checklist", tags: ["Product management"], category: "organize" },
  { id: 22, title: "Create visualization", tags: ["Data"], category: "create" },
  { id: 23, title: "Organize my files", tags: [], category: "organize" },
  { id: 24, title: "Audit and extend system", tags: ["Design"], category: "analyze" },
  { id: 25, title: "Turn my notes into a website", tags: [], category: "create" },
  { id: 26, title: "Sync tasks and refresh", tags: [], category: "organize" },
];

const COWORK_CATEGORIES = [
  { id: "all", label: "All" },
  { id: "plugins", label: "Plugins" },
  { id: "create", label: "Create" },
  { id: "analyze", label: "Analyze" },
  { id: "organize", label: "Organize" },
  { id: "communicate", label: "Communicate" },
];

/* ─── Code Sessions Data ──────────────────────────────────────────────────────── */
const CODE_SESSIONS = [
  { id: "s1", title: "New session", date: "Today", synced: false },
  { id: "s2", title: "Debug Claude code desktop application", date: "Today", synced: true },
  { id: "s3", title: "Enable Claude access on mobile devices", date: "Older", synced: true },
  { id: "s4", title: "Add memory for continuous...", date: "Older", synced: true, changes: { added: 101, removed: 0 } },
  { id: "s5", title: "Fix remote terminal connection wit...", date: "Older", synced: true },
  { id: "s6", title: "Implement terminal mem...", date: "Older", synced: true, changes: { added: 236, removed: 0 } },
  { id: "s7", title: "megahurtz-main", date: "Older", synced: true },
  { id: "s8", title: "Review conversation history and mem...", date: "Older", synced: true },
  { id: "s9", title: "Create terminal link functionality", date: "Older", synced: true },
  { id: "s10", title: "Debug API Error 529 response", date: "Older", synced: true },
  { id: "s11", title: "Debug model change issue in termi...", date: "Older", synced: true },
  { id: "s12", title: "Create Claude installation guide for...", date: "Older", synced: true },
];

/* ─── Personal Plugins ────────────────────────────────────────────────────────── */
const PERSONAL_PLUGINS = [
  { id: "productivity", name: "Productivity", icon: ListTodo },
  { id: "design", name: "Design", icon: PenTool },
  { id: "data", name: "Data", icon: Database },
  { id: "enterprise", name: "Enterprise search", icon: FileSearch },
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
  return <canvas ref={ref} className="absolute inset-0 w-full h-full pointer-events-none" style={{ opacity: 0.15 }} />;
}

/* ─── Toggle switch ─────────────────────────────────────────────────────────── */
function Toggle({ on, onToggle }) {
  return (
    <button type="button" onClick={onToggle} className="w-8 h-[18px] rounded-full relative transition-colors shrink-0" style={{ background: on ? C.accent : "#333" }}>
      <div className="absolute top-[2px] w-[14px] h-[14px] rounded-full transition-all" style={{ background: "#fff", left: on ? 14 : 2 }} />
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

/* ─── Model Selector ───────────────────────────────────────────────────────── */
function ModelSelector({ models, providers, activeModel, onSelect, compact }) {
  const [open, setOpen] = useState(false);
  const [selProv, setSelProv] = useState(null);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);

  useEffect(() => {
    if (open && activeModel) {
      const slash = activeModel.indexOf("/");
      setSelProv(slash > 0 ? activeModel.slice(0, slash) : null);
    }
  }, [open, activeModel]);

  const activeName = activeModel ? activeModel.split("/").slice(1).join("/") : null;
  const selModels = selProv ? (providers.find(p => p.name === selProv)?.models ?? []) : [];

  const handleSelect = async (modelId) => {
    setOpen(false);
    await onSelect(modelId);
  };

  const label = activeName ? (activeName.length > 18 ? activeName.slice(0, 16) + "…" : activeName) : "Select model";

  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen(v => !v)} className="flex items-center gap-1 text-[12px] transition-colors" style={{ color: open ? C.text : C.muted }} data-testid="model-selector-trigger">
        <span className="font-medium">{label}</span>
        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute bottom-full right-0 mb-2 z-50 flex items-stretch shadow-2xl" style={{ borderRadius: 14, overflow: "hidden", border: "1px solid #222" }}>
          <div style={{ width: 180, background: "#0f0f0f", borderRight: "1px solid #1d1d1d", display: "flex", flexDirection: "column", maxHeight: 400 }}>
            <div className="px-3 py-2 shrink-0" style={{ borderBottom: "1px solid #1d1d1d" }}>
              <span className="text-[10px] font-bold uppercase tracking-[0.12em]" style={{ color: "#555" }}>Providers</span>
            </div>
            <ScrollArea className="flex-1">
              {providers.map(prov => (
                <button key={prov.name} type="button" onMouseEnter={() => setSelProv(prov.name)} onClick={() => setSelProv(prov.name)}
                  className="w-full flex items-center justify-between px-3 py-[9px] text-left"
                  style={{ background: prov.name === selProv ? "rgba(29,140,248,0.07)" : "transparent", borderLeft: prov.name === selProv ? `2px solid ${C.accent}` : "2px solid transparent" }}>
                  <span className="text-[13px] font-medium" style={{ color: prov.name === selProv ? "#e2e2e2" : "#999" }}>{prov.name}</span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px]" style={{ color: "#505050" }}>{prov.count}</span>
                    <ChevronRight className="w-3 h-3" style={{ color: prov.name === selProv ? C.accent : "#404040" }} />
                  </div>
                </button>
              ))}
            </ScrollArea>
          </div>
          <div style={{ width: 340, background: "#131313", display: "flex", flexDirection: "column", maxHeight: 400 }}>
            {selProv ? (
              <>
                <div className="flex items-center justify-between px-3 py-2 shrink-0" style={{ borderBottom: "1px solid #1d1d1d" }}>
                  <span className="text-[11px] font-bold uppercase tracking-[0.1em]" style={{ color: "#555" }}>{selProv}</span>
                  <div className="flex items-center gap-1 text-[9px]" style={{ color: "#444" }}>
                    {CAP_ICONS.map(({ icon, label }) => <span key={label} title={label}>{icon}</span>)}
                  </div>
                </div>
                <ScrollArea className="flex-1">
                  {selModels.map(m => {
                    const isActive = m.id === activeModel;
                    return (
                      <button key={m.id} type="button" onClick={() => handleSelect(m.id)} className="w-full px-3 py-2.5 text-left transition-colors"
                        style={{ background: isActive ? "rgba(29,140,248,0.1)" : "transparent" }}
                        onMouseOver={e => { if (!isActive) e.currentTarget.style.background = "rgba(255,255,255,0.03)"; }}
                        onMouseOut={e => { if (!isActive) e.currentTarget.style.background = "transparent"; }}>
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className="text-[13px] font-semibold truncate" style={{ color: isActive ? C.accent : "#ddd" }}>{m.name}</span>
                          {isActive && <Check className="w-3.5 h-3.5 shrink-0" style={{ color: C.accent }} />}
                        </div>
                        <div className="text-[10px] truncate mb-1.5" style={{ color: "#484848", fontFamily: "monospace" }}>{m.id}</div>
                        <div className="flex items-center gap-2">
                          <CostBadge tier={m.costTier} />
                          {m.context && <span className="text-[9px] px-1.5 py-0.5 rounded font-mono" style={{ background: "#1a1a1a", color: "#666", border: "1px solid #222" }}>{m.context}</span>}
                          <div className="ml-auto"><CapabilityIcons caps={m.caps} /></div>
                        </div>
                      </button>
                    );
                  })}
                </ScrollArea>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center" style={{ color: "#333", fontSize: 12 }}>← select a provider</div>
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
  const { connectors, toggleConnector, enabledSkills, toggleSkill, webSearchEnabled, setWebSearchEnabled, writingStyle, setWritingStyle, toolAccess, setToolAccess } = useGateway();

  useEffect(() => {
    if (!open) return;
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) { setOpen(false); setSub(null); } };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);

  const close = () => { setOpen(false); setSub(null); };
  const hoverBg = "rgba(255,255,255,0.04)";
  const panelStyle = { background: "#151515", border: "1px solid #2a2a2a" };

  const Row = ({ icon: Icon, label, badge, hasSub, onClick, active }) => (
    <button type="button" onClick={onClick} className="w-full flex items-center gap-2.5 px-3 py-[7px] transition-colors text-left" style={{ color: C.text }}
      onMouseOver={e => { e.currentTarget.style.background = hoverBg; }} onMouseOut={e => { e.currentTarget.style.background = "transparent"; }}>
      {Icon && <Icon className="w-4 h-4 shrink-0" style={{ color: "#888" }} />}
      <span className="text-[13px] flex-1">{label}</span>
      {badge !== undefined && badge > 0 && <span className="flex items-center gap-1"><span className="text-[10px]" style={{ color: "#fbbf24" }}>🔔</span><span className="text-[10px]" style={{ color: "#888" }}>{badge}</span></span>}
      {active && <Check className="w-3.5 h-3.5" style={{ color: C.accent }} />}
      {hasSub && <ChevronRight className="w-3.5 h-3.5" style={{ color: "#555" }} />}
    </button>
  );

  const Divider = () => <div className="my-1" style={{ height: 1, background: "#1e1e1e" }} />;

  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => { setOpen(v => !v); setSub(null); }} disabled={disabled}
        className="w-7 h-7 rounded-full flex items-center justify-center transition-all shrink-0 disabled:opacity-40"
        style={{ background: open ? "rgba(29,140,248,0.15)" : C.surface2, border: `1px solid ${open ? C.accent : C.border}`, color: open ? C.accent : C.muted }}>
        <Plus className={`w-3.5 h-3.5 transition-transform duration-200 ${open ? "rotate-45" : ""}`} />
      </button>

      {open && (
        <div className="absolute bottom-full left-0 mb-2 z-50 flex items-end gap-1">
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

          {sub === "skills" && (
            <div className="w-52 rounded-xl py-1 shadow-2xl" style={panelStyle}>
              {SKILLS.map(sk => (
                <button key={sk} type="button" className="w-full flex items-center justify-between gap-2.5 px-3 py-[6px] text-[13px] text-left transition-colors" style={{ color: "#ccc" }}
                  onMouseOver={e => { e.currentTarget.style.background = hoverBg; }} onMouseOut={e => { e.currentTarget.style.background = "transparent"; }} onClick={() => toggleSkill(sk)}>
                  {sk}
                  {enabledSkills.includes(sk) && <Check className="w-3.5 h-3.5" style={{ color: C.accent }} />}
                </button>
              ))}
              <Divider />
              <Row icon={Wrench} label="Manage skills" onClick={close} />
              <button type="button" className="w-full flex items-center gap-2.5 px-3 py-[6px] text-[13px] text-left transition-colors" style={{ color: "#888" }}
                onMouseOver={e => { e.currentTarget.style.background = hoverBg; e.currentTarget.style.color = "#ccc"; }}
                onMouseOut={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#888"; }} onClick={close}>
                <Plus className="w-3.5 h-3.5" /> Add skill
              </button>
            </div>
          )}

          {sub === "connectors" && (
            <div className="w-60 rounded-xl py-1 shadow-2xl" style={panelStyle}>
              {CONNECTORS.map(c => {
                const Icon = c.icon;
                return (
                  <div key={c.id} className="flex items-center gap-2.5 px-3 py-[7px] transition-colors" style={{ color: C.text }}
                    onMouseOver={e => { e.currentTarget.style.background = hoverBg; }} onMouseOut={e => { e.currentTarget.style.background = "transparent"; }}>
                    <Icon className="w-4 h-4 shrink-0" style={{ color: "#888" }} />
                    <span className="text-[13px] flex-1">{c.label}</span>
                    <Toggle on={connectors[c.id]} onToggle={() => toggleConnector(c.id)} />
                  </div>
                );
              })}
              <Divider />
              <Row icon={Wrench} label="Manage connectors" onClick={close} />
            </div>
          )}

          {sub === "style" && (
            <div className="w-48 rounded-xl py-1 shadow-2xl" style={panelStyle}>
              {["Normal", "Concise", "Formal", "Explanatory"].map(s => (
                <button key={s} type="button" className="w-full flex items-center justify-between text-left px-3 py-[7px] text-[13px] transition-colors" style={{ color: "#ccc" }}
                  onMouseOver={e => { e.currentTarget.style.background = hoverBg; }} onMouseOut={e => { e.currentTarget.style.background = "transparent"; }}
                  onClick={() => { setWritingStyle(s); close(); }}>
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
    if (fillPrompt) { setVal(fillPrompt); onFillConsumed?.(); setTimeout(() => ref.current?.focus(), 0); }
  }, [fillPrompt, onFillConsumed]);

  const handleInput = (e) => { setVal(e.target.value); const el = e.target; el.style.height = "auto"; el.style.height = `${Math.min(el.scrollHeight, 180)}px`; };
  const handleKey = (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); } };
  const submit = () => { if (!val.trim() || disabled) return; onSend(val.trim()); setVal(""); if (ref.current) ref.current.style.height = "auto"; };
  const handleQuick = (prompt, fill) => { if (fill) { setVal(prompt); setTimeout(() => ref.current?.focus(), 0); } else { onSend(prompt); } };
  const active = !!val.trim() && !disabled;

  return (
    <div className="w-full rounded-2xl shadow-xl" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
      <textarea ref={ref} value={val} onChange={handleInput} onKeyDown={handleKey} placeholder={placeholder ?? (disabled ? "Connecting to gateway…" : "Ask anything...")} disabled={disabled} rows={1}
        className="w-full focus:outline-none resize-none text-[14px] font-sans" style={{ background: "transparent", border: "none", color: C.text, padding: "14px 16px 10px", minHeight: 52, maxHeight: 180, opacity: disabled ? 0.5 : 1 }} />
      <div className="flex items-center gap-2 px-3 pb-3">
        <PlusMenu onSelect={handleQuick} disabled={disabled} />
        <button type="button" className="flex items-center gap-1.5 h-7 px-2.5 rounded-full text-[12px] font-medium transition-colors" style={{ background: "rgba(29,140,248,0.12)", border: "1px solid rgba(29,140,248,0.25)", color: C.accent }}>
          <span className="text-sm leading-none">🤖</span><span>Agent</span><ChevronDown className="w-3 h-3 opacity-60" />
        </button>
        <div className="flex-1" />
        <ModelSelector models={models} providers={providers} activeModel={activeModel} onSelect={switchModel} />
        <button type="button" className="w-7 h-7 flex items-center justify-center rounded-full transition-colors" style={{ color: C.muted }}><Mic className="w-4 h-4" /></button>
        <button type="button" onClick={submit} disabled={!active} className="w-8 h-8 rounded-full flex items-center justify-center transition-all"
          style={{ background: active ? C.accent : C.surface2, color: active ? "#fff" : "#555", cursor: active ? "pointer" : "not-allowed" }} title="Send (Enter)">
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
          <div className="rounded-2xl rounded-tr-sm px-4 py-2.5 text-sm whitespace-pre-wrap break-words" style={{ background: "rgba(29,140,248,0.15)", border: "1px solid rgba(29,140,248,0.2)", color: C.text }}>{msg.content}</div>
          <div className="text-[10px] text-right mt-1" style={{ color: "#555" }}>{fmtTime(msg.timestamp)}</div>
        </div>
      </div>
    );
  }
  return (
    <div className="flex gap-3 py-2 px-4">
      <div className="w-7 h-7 rounded-full flex items-center justify-center text-sm shrink-0 mt-0.5" style={{ background: "rgba(29,140,248,0.1)", border: "1px solid rgba(29,140,248,0.2)" }}>🦞</div>
      <div className="flex-1 min-w-0">
        <div className="rounded-2xl rounded-tl-sm px-4 py-2.5 text-sm" style={{ background: C.surface, border: `1px solid ${C.border}` }}><Markdown content={msg.content} /></div>
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
      <div className="grid grid-cols-4 gap-4">
        {stats.map(stat => (
          <div key={stat.label} className="p-4 rounded-xl" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: `${stat.color}20` }}><stat.icon className="w-5 h-5" style={{ color: stat.color }} /></div>
              <div><div className="text-2xl font-bold">{stat.value}</div><div className="text-xs" style={{ color: C.muted }}>{stat.label}</div></div>
            </div>
          </div>
        ))}
      </div>
      <div className="p-4 rounded-xl" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
        <div className="flex items-center justify-between"><div><div className="text-sm font-medium mb-1">Active Model</div><div className="text-lg" style={{ color: C.accent }}>{activeModel || "None selected"}</div></div><Cpu className="w-8 h-8" style={{ color: C.muted }} /></div>
      </div>
      <div className="p-4 rounded-xl" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
        <h2 className="text-sm font-medium mb-3">Recent Events</h2>
        <div className="space-y-2 max-h-48 overflow-auto">
          {events.length === 0 ? <div className="text-sm" style={{ color: C.muted }}>No events yet</div> : events.slice(-10).reverse().map(evt => (
            <div key={evt.id} className="flex items-center gap-2 text-xs"><span className="w-1.5 h-1.5 rounded-full" style={{ background: C.accent }} /><span style={{ color: C.accent }}>{evt.type}</span><span style={{ color: C.muted }}>{new Date(evt.ts).toLocaleTimeString()}</span></div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─── Jobs Page ──────────────────────────────────────────────────────────────── */
function JobsPage() {
  const { jobs, cancelJob } = useGateway();
  const getStatusColor = (status) => { switch (status) { case "running": return C.accent; case "completed": return C.green; case "pending": return C.yellow; default: return C.red; } };
  const getStatusIcon = (status) => { switch (status) { case "running": return <Play className="w-4 h-4" />; case "completed": return <CheckCircle className="w-4 h-4" />; case "pending": return <Clock className="w-4 h-4" />; default: return <XCircle className="w-4 h-4" />; } };
  return (
    <div className="p-6 space-y-4" style={{ color: C.text }}>
      <div className="flex items-center justify-between"><h1 className="text-2xl font-bold">Jobs</h1><Button className="gap-2" style={{ background: C.accent }}><Plus className="w-4 h-4" /> New Job</Button></div>
      <div className="space-y-3">
        {jobs.map(job => (
          <div key={job.id} className="p-4 rounded-xl" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${getStatusColor(job.status)}20`, color: getStatusColor(job.status) }}>{getStatusIcon(job.status)}</div>
                <div><div className="font-medium">{job.name}</div><div className="text-xs" style={{ color: C.muted }}>Agent: {job.agent}</div></div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs px-2 py-1 rounded-full capitalize" style={{ background: `${getStatusColor(job.status)}20`, color: getStatusColor(job.status) }}>{job.status}</span>
                {job.status === "running" && <Button variant="ghost" size="sm" onClick={() => cancelJob(job.id)} style={{ color: C.red }}><Square className="w-4 h-4" /></Button>}
              </div>
            </div>
            {job.status === "running" && <><Progress value={job.progress} className="h-1.5" /><div className="text-xs mt-2" style={{ color: C.muted }}>{job.progress}% complete</div></>}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Approvals Page ─────────────────────────────────────────────────────────── */
function ApprovalsPage() {
  const { approvals, approveRequest, rejectRequest } = useGateway();
  const getRiskColor = (risk) => { switch (risk) { case "low": return C.green; case "medium": return C.yellow; case "high": return C.red; default: return C.muted; } };
  const getStatusBadge = (status) => { const colors = { pending: { bg: `${C.yellow}20`, color: C.yellow }, approved: { bg: `${C.green}20`, color: C.green }, rejected: { bg: `${C.red}20`, color: C.red } }; return colors[status] || colors.pending; };
  return (
    <div className="p-6 space-y-4" style={{ color: C.text }}>
      <h1 className="text-2xl font-bold">Approvals</h1>
      <div className="space-y-3">
        {approvals.map(approval => (
          <div key={approval.id} className="p-4 rounded-xl" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-3"><Shield className="w-5 h-5" style={{ color: getRiskColor(approval.risk) }} /><div><div className="font-medium">{approval.title}</div><div className="text-sm" style={{ color: C.muted }}>{approval.description}</div></div></div>
              <span className="text-xs px-2 py-1 rounded-full capitalize" style={getStatusBadge(approval.status)}>{approval.status}</span>
            </div>
            <div className="flex items-center justify-between mt-3">
              <div className="flex items-center gap-4 text-xs" style={{ color: C.muted }}><span>Agent: {approval.agent}</span><span>Risk: <span style={{ color: getRiskColor(approval.risk) }}>{approval.risk}</span></span></div>
              {approval.status === "pending" && <div className="flex gap-2"><Button size="sm" onClick={() => approveRequest(approval.id)} style={{ background: C.green }}><Check className="w-4 h-4 mr-1" /> Approve</Button><Button size="sm" variant="outline" onClick={() => rejectRequest(approval.id)} style={{ borderColor: C.red, color: C.red }}><X className="w-4 h-4 mr-1" /> Reject</Button></div>}
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
      <div className="flex items-center justify-between"><h1 className="text-2xl font-bold">Spaces</h1><Button className="gap-2" style={{ background: C.accent }}><Plus className="w-4 h-4" /> New Space</Button></div>
      <div className="grid grid-cols-3 gap-4">
        {spaces.map(space => (
          <div key={space.id} className="p-4 rounded-xl cursor-pointer hover:border-[#333] transition-colors" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
            <div className="flex items-center gap-3 mb-3"><div className="w-10 h-10 rounded-lg" style={{ background: space.color }} /><div><div className="font-medium">{space.name}</div><div className="text-xs" style={{ color: C.muted }}>{space.description}</div></div></div>
            <div className="flex gap-2">{space.agents.map(agent => <span key={agent} className="text-xs px-2 py-1 rounded" style={{ background: C.surface2, color: C.muted }}>{agent}</span>)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Cowork Page (Claude-style Ideas) ────────────────────────────────────────── */
function CoworkPage() {
  const [category, setCategory] = useState("all");
  const [search, setSearch] = useState("");
  const { models, providers, activeModel } = useGateway();

  const filteredIdeas = COWORK_IDEAS.filter(idea => {
    if (category !== "all" && idea.category !== category) return false;
    if (search && !idea.title.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const TagBadge = ({ tag }) => (
    <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: C.surface2, color: C.muted }}>{tag}</span>
  );

  return (
    <div className="h-full flex flex-col" style={{ color: C.text }}>
      <div className="flex-1 overflow-auto">
        <div className="max-w-4xl mx-auto px-6 py-8">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-2xl font-bold mb-2">Ideas</h1>
            <div className="flex items-center gap-4">
              {/* Search */}
              <div className="relative flex-1 max-w-xs">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: C.muted }} />
                <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search" className="w-full pl-9 pr-3 py-2 rounded-lg text-sm"
                  style={{ background: C.surface, border: `1px solid ${C.border}`, color: C.text }} />
              </div>
            </div>
          </div>

          {/* Categories */}
          <div className="flex items-center gap-2 mb-4">
            {COWORK_CATEGORIES.map(cat => (
              <button key={cat.id} onClick={() => setCategory(cat.id)}
                className="px-3 py-1.5 rounded-lg text-sm transition-colors"
                style={{ background: category === cat.id ? C.accent : C.surface, color: category === cat.id ? "#fff" : C.muted }}>
                {cat.label}
              </button>
            ))}
            <div className="ml-auto flex items-center gap-2">
              <button className="text-xs text-gray-400">All roles</button>
              <ChevronDown className="w-3 h-3 text-gray-500" />
            </div>
          </div>

          {/* Connect tools banner */}
          <div className="flex items-center justify-between p-3 rounded-lg mb-6" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
            <span className="text-sm" style={{ color: C.muted }}>Connect your tools to get more from Cowork</span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="gap-1" style={{ borderColor: C.border, color: C.text }}><Layers className="w-3 h-3" /> Connectors <Plus className="w-3 h-3" /></Button>
              <Button variant="outline" size="sm" className="gap-1" style={{ borderColor: C.border, color: C.text }}><Puzzle className="w-3 h-3" /> Plugins <span className="text-xs bg-blue-600 px-1 rounded">4</span> <Plus className="w-3 h-3" /></Button>
            </div>
          </div>

          {/* Ideas Grid */}
          <div className="grid grid-cols-3 gap-3">
            {filteredIdeas.map(idea => (
              <button key={idea.id} className="text-left p-4 rounded-xl transition-all hover:border-gray-600"
                style={{ background: C.surface, border: `1px solid ${C.border}` }}>
                <div className="text-sm font-medium mb-2">{idea.title}</div>
                {idea.tags.length > 0 && <div className="flex flex-wrap gap-1">{idea.tags.map(tag => <TagBadge key={tag} tag={tag} />)}</div>}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom input */}
      <div className="p-4 border-t" style={{ borderColor: C.border, background: C.bg }}>
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center gap-3 p-3 rounded-xl" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
            <span className="text-sm" style={{ color: C.muted }}>How can I help you today?</span>
            <div className="flex-1" />
            <button className="flex items-center gap-1 text-xs px-2 py-1 rounded" style={{ background: C.surface2, color: C.muted }}>
              <FolderOpen className="w-3 h-3" /> Work in a project <ChevronDown className="w-3 h-3" />
            </button>
            <Plus className="w-4 h-4" style={{ color: C.muted }} />
            <ModelSelector models={models} providers={providers} activeModel={activeModel} onSelect={switchModel} compact />
            <Mic className="w-4 h-4" style={{ color: C.muted }} />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Code Page (Claude-style Terminal Sessions) ─────────────────────────────── */
function CodePage() {
  const { terminalOutput, addTerminalOutput, clearTerminal, models, providers, activeModel } = useGateway();
  const [cmd, setCmd] = useState("");
  const [activeSession, setActiveSession] = useState("s1");
  const [bypassPermissions, setBypassPermissions] = useState(false);
  const [isLocal, setIsLocal] = useState(true);
  const [projectFilter, setProjectFilter] = useState("all");
  const terminalRef = useRef(null);

  useEffect(() => { terminalRef.current?.scrollTo(0, terminalRef.current.scrollHeight); }, [terminalOutput]);

  const handleCommand = async () => {
    if (!cmd.trim()) return;
    await executeCommand(cmd);
    setCmd("");
  };

  const todaySessions = CODE_SESSIONS.filter(s => s.date === "Today");
  const olderSessions = CODE_SESSIONS.filter(s => s.date === "Older");

  return (
    <div className="h-full flex" style={{ color: C.text }}>
      {/* Sessions Sidebar */}
      <div className="w-64 flex flex-col" style={{ borderRight: `1px solid ${C.border}`, background: "#0d0d0d" }}>
        <div className="p-3">
          <Link to="/" className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors hover:bg-white/5" style={{ color: C.muted }}>
            <Plus className="w-4 h-4" /> New session
          </Link>
        </div>

        <div className="px-3 mb-2">
          <button className="flex items-center gap-2 text-xs" style={{ color: C.muted }}>
            All projects <ChevronDown className="w-3 h-3" />
          </button>
        </div>

        <ScrollArea className="flex-1">
          {todaySessions.length > 0 && (
            <div className="px-3 mb-3">
              <div className="text-[10px] uppercase tracking-wider mb-2" style={{ color: "#555" }}>Today</div>
              {todaySessions.map(session => (
                <button key={session.id} onClick={() => setActiveSession(session.id)}
                  className="w-full text-left px-2 py-2 rounded text-sm transition-colors mb-0.5"
                  style={{ background: activeSession === session.id ? "rgba(29,140,248,0.1)" : "transparent", color: activeSession === session.id ? C.accent : "#999" }}>
                  <div className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: activeSession === session.id ? C.accent : "#444" }} />
                    <span className="truncate flex-1">{session.title}</span>
                    {session.synced && <Cloud className="w-3 h-3 shrink-0" style={{ color: "#444" }} />}
                  </div>
                </button>
              ))}
            </div>
          )}

          {olderSessions.length > 0 && (
            <div className="px-3">
              <div className="text-[10px] uppercase tracking-wider mb-2" style={{ color: "#555" }}>Older</div>
              {olderSessions.map(session => (
                <button key={session.id} onClick={() => setActiveSession(session.id)}
                  className="w-full text-left px-2 py-2 rounded text-sm transition-colors mb-0.5"
                  style={{ background: activeSession === session.id ? "rgba(29,140,248,0.1)" : "transparent", color: activeSession === session.id ? C.accent : "#666" }}>
                  <div className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: "#333" }} />
                    <span className="truncate flex-1">{session.title}</span>
                    {session.changes && (
                      <span className="text-[10px] shrink-0">
                        <span style={{ color: C.green }}>+{session.changes.added}</span>
                        <span style={{ color: C.red }}> -{session.changes.removed}</span>
                      </span>
                    )}
                    {session.synced && <Cloud className="w-3 h-3 shrink-0" style={{ color: "#333" }} />}
                  </div>
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Main Terminal Area */}
      <div className="flex-1 flex flex-col">
        <div ref={terminalRef} className="flex-1 p-6 font-mono text-sm overflow-auto" style={{ background: "#000" }}>
          {terminalOutput.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full">
              <div className="text-6xl mb-4">🦞</div>
              <div className="text-sm" style={{ color: C.muted }}>Find a small todo in the codebase and do it</div>
            </div>
          ) : (
            terminalOutput.map(line => (
              <div key={line.id} style={{ color: line.content.startsWith("$") ? C.green : C.text }}>{line.content}</div>
            ))
          )}
        </div>

        {/* Bottom Input */}
        <div className="p-4" style={{ borderTop: `1px solid ${C.border}`, background: "#0a0a0a" }}>
          <div className="max-w-3xl mx-auto">
            <div className="flex items-center gap-3 p-3 rounded-xl" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
              <input type="text" value={cmd} onChange={e => setCmd(e.target.value)} onKeyDown={e => e.key === "Enter" && handleCommand()}
                placeholder="Find a small todo in the codebase and do it" className="flex-1 bg-transparent border-none outline-none text-sm" style={{ color: C.text }} />
            </div>
            <div className="flex items-center justify-between mt-3 px-1">
              <div className="flex items-center gap-3">
                <Plus className="w-4 h-4" style={{ color: C.muted }} />
                <button onClick={() => setBypassPermissions(!bypassPermissions)}
                  className="flex items-center gap-1.5 text-xs px-2 py-1 rounded transition-colors"
                  style={{ background: bypassPermissions ? "rgba(29,140,248,0.1)" : "transparent", color: bypassPermissions ? C.accent : C.muted }}>
                  {bypassPermissions ? <Unlock className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
                  Bypass permissions <ChevronDown className="w-3 h-3" />
                </button>
              </div>
              <div className="flex items-center gap-3">
                <ModelSelector models={models} providers={providers} activeModel={activeModel} onSelect={switchModel} compact />
                <Mic className="w-4 h-4" style={{ color: C.muted }} />
                <button onClick={() => setIsLocal(!isLocal)}
                  className="flex items-center gap-1.5 text-xs px-2 py-1 rounded"
                  style={{ background: C.surface2, color: C.muted }}>
                  <Monitor className="w-3 h-3" /> {isLocal ? "Local" : "Remote"} <ChevronDown className="w-3 h-3" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Customize Page ─────────────────────────────────────────────────────────── */
function CustomizePage() {
  const [activeSection, setActiveSection] = useState(null);

  return (
    <div className="h-full flex" style={{ color: C.text }}>
      {/* Sidebar */}
      <div className="w-56 p-4" style={{ borderRight: `1px solid ${C.border}`, background: "#0d0d0d" }}>
        <div className="flex items-center gap-2 mb-4">
          <ChevronLeft className="w-4 h-4" style={{ color: C.muted }} />
          <span className="font-medium">Customize</span>
        </div>

        <div className="space-y-1 mb-6">
          <button className="w-full flex items-center gap-2 px-3 py-2 rounded text-sm text-left" style={{ color: C.muted }}>
            <Wrench className="w-4 h-4" /> Skills
          </button>
          <button className="w-full flex items-center gap-2 px-3 py-2 rounded text-sm text-left" style={{ color: C.muted }}>
            <Layers className="w-4 h-4" /> Connectors
          </button>
        </div>

        <div className="text-xs uppercase tracking-wider mb-2" style={{ color: "#555" }}>Personal plugins</div>
        <div className="space-y-1">
          {PERSONAL_PLUGINS.map(plugin => (
            <button key={plugin.id} className="w-full flex items-center gap-2 px-3 py-2 rounded text-sm text-left" style={{ color: C.muted }}>
              <plugin.icon className="w-4 h-4" /> {plugin.name}
            </button>
          ))}
          <button className="w-full flex items-center gap-2 px-3 py-2 rounded text-sm text-left" style={{ color: "#555" }}>
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex items-center justify-center">
        <div className="max-w-md text-center">
          <div className="w-20 h-20 mx-auto mb-6 rounded-xl flex items-center justify-center" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
            <Package className="w-10 h-10" style={{ color: C.muted }} />
          </div>
          <h1 className="text-2xl font-bold mb-2">Customize Claude</h1>
          <p className="text-sm mb-8" style={{ color: C.muted }}>Skills, connectors, and plugins shape how Claude works with you.</p>

          <div className="space-y-3">
            <button className="w-full p-4 rounded-xl text-left transition-colors hover:bg-white/5" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: C.surface2 }}><Link2 className="w-5 h-5" style={{ color: C.muted }} /></div>
                <div><div className="font-medium">Connect your apps</div><div className="text-sm" style={{ color: C.muted }}>Let Claude read and write to the tools you already use.</div></div>
              </div>
            </button>

            <button className="w-full p-4 rounded-xl text-left transition-colors hover:bg-white/5" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: C.surface2 }}><Sparkles className="w-5 h-5" style={{ color: C.muted }} /></div>
                <div><div className="font-medium">Create new skills</div><div className="text-sm" style={{ color: C.muted }}>Teach Claude your processes, team norms, and expertise.</div></div>
              </div>
            </button>

            <button className="w-full p-4 rounded-xl text-left transition-colors hover:bg-white/5" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: C.surface2 }}><Puzzle className="w-5 h-5" style={{ color: C.muted }} /></div>
                <div><div className="font-medium">Browse plugins</div><div className="text-sm" style={{ color: C.muted }}>Add pre-built knowledge for your field.</div></div>
              </div>
            </button>
          </div>
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
      <div className="p-4 rounded-xl" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
        <h2 className="text-lg font-medium mb-4">Connectors</h2>
        <div className="space-y-3">
          {CONNECTORS.map(c => (
            <div key={c.id} className="flex items-center justify-between">
              <div className="flex items-center gap-3"><c.icon className="w-5 h-5" style={{ color: C.muted }} /><span>{c.label}</span></div>
              <Toggle on={connectors[c.id]} onToggle={() => toggleConnector(c.id)} />
            </div>
          ))}
        </div>
      </div>
      <div className="p-4 rounded-xl" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
        <h2 className="text-lg font-medium mb-4">Preferences</h2>
        <div className="space-y-4">
          <div className="flex items-center justify-between"><span>Web Search</span><Toggle on={webSearchEnabled} onToggle={() => setWebSearchEnabled(!webSearchEnabled)} /></div>
          <div><label className="block text-sm mb-2">Writing Style</label><div className="flex gap-2">{["Normal", "Concise", "Formal", "Explanatory"].map(s => (
            <button key={s} onClick={() => setWritingStyle(s)} className="px-3 py-1.5 rounded text-sm" style={{ background: writingStyle === s ? C.accent : C.surface2, color: writingStyle === s ? "#fff" : C.muted }}>{s}</button>
          ))}</div></div>
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

  // Determine active tab from URL
  const currentTab = location.pathname === "/cowork" ? "cowork" : location.pathname === "/code" ? "code" : "chat";

  return (
    <div className="flex h-screen w-full overflow-hidden" style={{ background: C.bg, color: C.text }}>
      {/* Sidebar */}
      <aside className="flex flex-col shrink-0 overflow-hidden" style={{ width: 200, background: "#0f0f0f", borderRight: "1px solid #222" }}>
        <div className="flex items-center gap-2 px-4 py-3.5 cursor-pointer hover:bg-white/5 transition-colors" style={{ borderBottom: "1px solid #222" }}>
          <div className="w-5 h-5 rounded" style={{ background: C.accent }} />
          <span className="text-sm font-medium flex-1" style={{ color: C.text }}>Personal</span>
          <ChevronDown className="w-3.5 h-3.5" style={{ color: "#666" }} />
        </div>

        <div className="flex flex-col gap-0.5 px-2 pt-3 pb-1">
          <Link to="/" className="flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors" style={{ color: "#888" }}><Plus className="w-4 h-4" />New thread</Link>
          {NAV.map(item => {
            const active = location.pathname === item.href;
            const badge = item.badgeKey === "pendingApprovals" ? pendingApprovals : null;
            return (
              <Link key={item.href} to={item.href} className="flex items-center justify-between px-3 py-2 rounded-md text-sm transition-colors"
                style={{ background: active ? "rgba(29,140,248,0.12)" : "transparent", color: active ? C.accent : "#bbb" }}>
                <div className="flex items-center gap-2.5"><item.icon className="w-4 h-4" />{item.label}</div>
                {badge > 0 && <span className="flex h-4 min-w-4 px-1 items-center justify-center rounded-full text-[10px] font-semibold" style={{ background: item.warn ? "rgba(251,191,36,0.2)" : "rgba(29,140,248,0.2)", color: item.warn ? "#fbbf24" : C.accent }}>{badge}</span>}
              </Link>
            );
          })}
          {/* Add Ideas and Customize */}
          <Link to="/cowork" className="flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors" style={{ background: location.pathname === "/cowork" ? "rgba(29,140,248,0.12)" : "transparent", color: location.pathname === "/cowork" ? C.accent : "#bbb" }}>
            <Lightbulb className="w-4 h-4" />Ideas
          </Link>
          <Link to="/customize" className="flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors" style={{ background: location.pathname === "/customize" ? "rgba(29,140,248,0.12)" : "transparent", color: location.pathname === "/customize" ? C.accent : "#bbb" }}>
            <Package className="w-4 h-4" />Customize
          </Link>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="px-4 pt-5 pb-2">
            <p className="text-[10px] uppercase tracking-widest mb-2 font-medium" style={{ color: "#555" }}>Recents</p>
            {["Create organized application refer...", "Convert notes into professional do..."].map((h, i) => (
              <button key={i} className="flex items-center gap-2 w-full px-1 py-1.5 text-[13px] rounded transition-colors text-left truncate" style={{ color: "#666" }}>
                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: "#333" }} /><span className="truncate">{h}</span>
              </button>
            ))}
            <div className="text-[11px] mt-2" style={{ color: "#444" }}>These tasks run locally and aren't synced across devices</div>
          </div>
        </div>

        <div className="flex items-center gap-3 px-4 py-3.5" style={{ borderTop: "1px solid #222" }}>
          <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold shrink-0" style={{ background: C.accent, color: "#fff" }}>M</div>
          <div><div className="text-sm font-medium" style={{ color: C.text }}>Meg</div><div className="text-[11px]" style={{ color: C.muted }}>Pro plan</div></div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="h-12 flex items-center justify-between px-6 shrink-0" style={{ borderBottom: "1px solid #1a1a1a", background: C.bg }}>
          <div className="w-32" />
          <div className="flex items-center gap-1">
            {["Chat", "Cowork", "Code"].map(tab => {
              const isActive = currentTab === tab.toLowerCase();
              return (
                <Link key={tab} to={tab === "Chat" ? "/" : `/${tab.toLowerCase()}`}
                  className="px-3.5 py-1 rounded-md text-[13px] font-medium transition-colors"
                  style={{ background: isActive ? "rgba(29,140,248,0.12)" : "transparent", color: isActive ? C.accent : "#666" }}>
                  {tab}
                </Link>
              );
            })}
          </div>
          <div className="w-32 flex items-center justify-end gap-2 text-[12px]" style={{ color: "#888" }}>
            <div className="relative flex h-2 w-2">
              {status === "connected" ? <><span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ background: "#22c55e" }} /><span className="relative inline-flex rounded-full h-2 w-2" style={{ background: "#22c55e" }} /></>
                : <span className="relative inline-flex rounded-full h-2 w-2 animate-pulse" style={{ background: "#fbbf24" }} />}
            </div>
            <span className="capitalize">{clawState}</span>
          </div>
        </header>
        <div className="flex-1 overflow-hidden relative">{children}</div>
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

  useEffect(() => { initGateway(); }, []);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages.length, streamingMessage?.content]);

  const doSend = useCallback(async (text) => { if (!text.trim()) return; await sendMessage(text); }, []);

  if (!hasMessages) {
    return (
      <div className="relative h-full flex flex-col" style={{ background: C.bg }}>
        <div className="absolute inset-0 overflow-hidden pointer-events-none"><BinaryRain /></div>
        <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-6">
          <div className="w-full" style={{ maxWidth: 680 }}>
            <div className="text-center mb-10"><h1 className="text-4xl font-bold mb-1 tracking-tight" style={{ color: C.text }}>OpenClaw <span>🦞</span></h1><p className="text-sm tracking-widest uppercase" style={{ color: C.muted }}>Mission Control</p></div>
            <div className="w-full mb-5"><InputBar onSend={doSend} disabled={status !== "connected"} fillPrompt={fillPrompt} onFillConsumed={() => setFillPrompt(null)} /></div>
            <div className="grid grid-cols-2 gap-3 w-full">
              {CARDS.map(card => {
                const Icon = card.icon;
                return (
                  <button key={card.title} onClick={() => card.fill ? setFillPrompt(card.prompt) : doSend(card.prompt)} disabled={status !== "connected"}
                    className="text-left p-4 rounded-xl transition-all group disabled:opacity-40" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
                    <div className="flex items-start gap-3">
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: C.surface2, border: `1px solid ${C.border}` }}><Icon className="w-3.5 h-3.5" style={{ color: C.muted }} /></div>
                      <div><div className="text-[13px] font-medium mb-0.5" style={{ color: C.text }}>{card.title}</div><div className="text-[11px] leading-snug" style={{ color: C.muted }}>{card.desc}</div></div>
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

  return (
    <div className="relative h-full flex flex-col" style={{ background: C.bg }}>
      <div className="absolute inset-0 overflow-hidden pointer-events-none"><BinaryRain /></div>
      <div className="relative z-10 flex items-center justify-between px-4 py-2 shrink-0" style={{ borderBottom: `1px solid ${C.surface2}`, background: "rgba(10,10,10,0.85)" }}>
        <button onClick={clearMessages} className="flex items-center gap-1.5 text-[11px] transition-colors" style={{ color: "#666" }}><Trash2 className="w-3 h-3" /> Clear chat</button>
        <button className="flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-full transition-colors" style={{ border: `1px solid ${C.border}`, color: "#666" }}><Terminal className="w-3 h-3" />Events</button>
      </div>
      <div className="relative z-10 flex-1 overflow-y-auto py-4">
        {messages.map(msg => <MessageRow key={msg.id} msg={msg} />)}
        {streamingMessage && (
          <div className="flex gap-3 py-2 px-4">
            <div className="w-7 h-7 rounded-full flex items-center justify-center text-sm shrink-0 mt-0.5" style={{ background: "rgba(29,140,248,0.1)", border: "1px solid rgba(29,140,248,0.2)" }}>🦞</div>
            <div className="flex-1 min-w-0">
              <div className="rounded-2xl rounded-tl-sm px-4 py-2.5 text-sm relative" style={{ background: C.surface, border: "1px solid rgba(29,140,248,0.2)" }}>
                {streamingMessage.content ? <Markdown content={streamingMessage.content} /> : <div className="flex gap-1 items-center py-0.5">{[0, 150, 300].map(d => <span key={d} className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: C.accent, opacity: 0.6, animationDelay: `${d}ms` }} />)}</div>}
                <span className="absolute bottom-2 right-3 w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: C.accent }} />
              </div>
              <div className="text-[10px] mt-1" style={{ color: C.accent, opacity: 0.6 }}>typing…</div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>
      <div className="relative z-10 px-4 pb-4 pt-2 shrink-0"><InputBar onSend={doSend} disabled={status !== "connected"} placeholder="Message Claw…" /></div>
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
        <Route path="/customize" element={<CustomizePage />} />
      </Routes>
      <Toaster />
    </Layout>
  );
}

export default App;
