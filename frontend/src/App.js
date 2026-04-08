import React, { useState, useEffect, useRef, useCallback } from "react";
import { Link, useLocation, Routes, Route, useNavigate } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  MessageSquare, Monitor, LayoutDashboard, Briefcase,
  AlertTriangle, Grid3X3, Settings, Plus, ChevronDown, ChevronRight,
  Terminal, Bookmark, Send, Telescope, Paperclip, Layers, Mic, Wrench,
  FolderOpen, Globe, Eye, Brain, Zap, Radio, Cpu, Rocket, Bot, Trash2,
  MessageCircle, X, Check, Play, Pause, Square, Clock, Shield,
  FileCode, Folder, RefreshCw, Users, Code2, ArrowRight, AlertCircle,
  CheckCircle, XCircle, Copy, Download, Upload, GitBranch,
  Search, Lightbulb, PenTool, BarChart3, FolderKanban, MessageSquareText,
  Cloud, Lock, Unlock, Sparkles, Package, Puzzle, Link2, ChevronLeft,
  Database, FileText, Presentation, Calendar, ListTodo, FileSearch,
  Smartphone, MonitorSmartphone, FileSpreadsheet, ClipboardList, Mail,
  FolderSync, ScreenShare, Timer, Receipt, NotebookPen, Menu,
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
  bg: "#0a0a0a",
  surface: "#141414",
  surface2: "#1a1a1a",
  accent: "#1d8cf8",
  text: "#f5f5f5",
  muted: "#888",
  border: "#222",
  green: "#22c55e",
  yellow: "#fbbf24",
  red: "#ef4444",
  orange: "#f97316",
};

/* ─── Capability Icons ──────────────────────────────────────────────────────── */
const CAP_DEFS = [
  { key: "vision", Icon: Eye, label: "Vision" },
  { key: "coding", Icon: Code2, label: "Coding" },
  { key: "tools", Icon: Wrench, label: "Tools" },
  { key: "files", Icon: FileText, label: "Files" },
  { key: "reasoning", Icon: Brain, label: "Reasoning" },
  { key: "fast", Icon: Zap, label: "Fast" },
];

// Keep old CAP_ICONS for backward compat in CoworkPage etc
const CAP_ICONS = CAP_DEFS.map(d => ({ key: d.key, icon: d.Icon, label: d.label }));

function CapabilityIcons({ caps, size = 14, gap = 6 }) {
  return (
    <div className="flex items-center" style={{ gap }}>
      {CAP_DEFS.map(({ key, Icon, label }) => {
        const val = caps?.[key];
        const isOn = val === true || val === "partial";
        return (
          <Icon key={key} title={label} className="shrink-0"
            style={{ width: size, height: size, color: isOn ? "#22c55e" : "#333", strokeWidth: isOn ? 2.2 : 1.5 }} />
        );
      })}
    </div>
  );
}

function CostBadge({ tier }) {
  if (!tier) return null;
  const colors = {
    Free: { bg: "#064e3b", color: "#34d399", border: "#065f46" },
    "$": { bg: "#1e3a5f", color: "#60a5fa", border: "#1e40af" },
    "$$": { bg: "#4a3728", color: "#fbbf24", border: "#78350f" },
    "$$$": { bg: "#4a2c2a", color: "#f87171", border: "#7f1d1d" },
  };
  const style = colors[tier] || colors["$"];
  return <span className="text-[9px] px-1.5 py-0.5 rounded font-medium" style={{ background: style.bg, color: style.color, border: `1px solid ${style.border}` }}>{tier}</span>;
}

/* ─── Navigation ─────────────────────────────────────────────────────────────── */
const NAV = [
  { href: "/", label: "Chat", icon: MessageSquare },
  { href: "/agent", label: "Agent", icon: Monitor },
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/jobs", label: "Jobs", icon: Briefcase },
  { href: "/approvals", label: "Approvals", icon: AlertTriangle, badgeKey: "pendingApprovals", warn: true },
  { href: "/spaces", label: "Spaces", icon: Grid3X3 },
  { href: "/settings", label: "Settings", icon: Settings },
];

const CONNECTORS = [
  { id: "mac", label: "Control your Mac", icon: Monitor },
  { id: "desktop", label: "Desktop Commander", icon: Terminal },
  { id: "files", label: "File Access", icon: FolderOpen },
  { id: "web", label: "Web Search", icon: Globe },
  { id: "signal", label: "Signal", icon: Radio },
  { id: "telegram", label: "Telegram", icon: MessageCircle },
];

const SKILLS = ["deep-research", "code-review", "web-scraper", "file-manager", "task-scheduler", "mcp-builder", "slack-gif-creator", "canvas-design"];

/* ─── Cowork Task Templates (User prompts to OpenClaw) ─────────────────────── */
const COWORK_TASKS = [
  // Schedule tasks
  { id: 1, icon: Timer, title: "Schedule a recurring task", prompt: "I need to set up a recurring task. I'll tell you what it is and how often it should run. Ask me anything unclear, then configure the schedule and confirm before activating.", category: "schedule", tags: ["Automation"] },
  { id: 2, icon: Mail, title: "Create daily briefing", prompt: "I want a daily briefing that pulls from my connected tools — Slack, email, calendar — every morning at 8am. I'll tell you what to include. Ask follow-ups, draft the format, and wait for my approval before scheduling.", category: "schedule", tags: ["Productivity"] },
  
  // File organization
  { id: 3, icon: FolderSync, title: "Organize my files", prompt: "I want to organize my files. I'll point you at the folder and tell you what needs organizing. Follow up on anything that's unclear, then scan everything, propose a plan with categories and naming conventions, and wait for my go-ahead before moving anything.", category: "organize", tags: [] },
  { id: 4, icon: FileText, title: "Turn documents into a report", prompt: "I have a set of documents I need turned into a polished report. I'll share the files or point you to a folder. Read through everything, ask what format and tone I want, then draft it for my review.", category: "create", tags: ["Documents"] },
  
  // Spreadsheets & Data
  { id: 5, icon: FileSpreadsheet, title: "Build a spreadsheet", prompt: "I need to build a spreadsheet to track some data. I'll describe what I'm working with and what I need to see. Ask clarifying questions, then set up the structure and formulas for me to review.", category: "create", tags: ["Data"] },
  { id: 6, icon: Receipt, title: "Turn receipts into spreadsheet", prompt: "I have a bunch of receipts I need organized into a spreadsheet. I'll share them or tell you which folder they're in. Extract the data, organize it by date and category, and show me the result before finalizing.", category: "analyze", tags: ["Data", "Finance"] },
  { id: 7, icon: Database, title: "Write optimized SQL query", prompt: "I need an optimized SQL query. I'll describe my database schema and what data I need. Ask about edge cases or performance requirements, then write the query and explain your reasoning.", category: "analyze", tags: ["Data", "Engineering"] },
  
  // Reports & Presentations
  { id: 8, icon: Presentation, title: "Create a presentation", prompt: "I want to create a presentation. I'll tell you the topic, audience, and key points. Ask about style, length, and any specific requirements, then build out the slides for my review — don't finalize until I approve the structure.", category: "create", tags: [] },
  { id: 9, icon: ClipboardList, title: "Prepare a report", prompt: "I need a report prepared. I'll give you the subject and point you at the sources. Ask about scope and format, pull together the findings, and draft it section by section for me to review.", category: "create", tags: ["Documents"] },
  { id: 10, icon: BarChart3, title: "Create data visualization", prompt: "I need a data visualization built. I'll share the data and tell you what insights I'm looking for. Ask what chart types work best, then create the visualization and let me iterate on it.", category: "create", tags: ["Data"] },
  
  // Research & Analysis
  { id: 11, icon: Telescope, title: "Deep research", prompt: "I need comprehensive research on a topic. I'll tell you what I'm looking into and what angle matters. Go deep — synthesize from multiple sources, surface the key findings, and organize everything so I can act on it.", category: "analyze", tags: ["Research"] },
  { id: 12, icon: NotebookPen, title: "Synthesize research notes", prompt: "I have a bunch of research notes that need synthesizing into key insights. I'll point you at the folder. Read through everything, identify the themes, and draft a clean summary with the most important takeaways.", category: "analyze", tags: ["Research"] },
  { id: 13, icon: Search, title: "Search all sources", prompt: "I'm looking for something across all my connected sources — files, Slack, email, the web. I'll tell you what I need. Search everywhere, rank the results by relevance, and surface the best matches.", category: "analyze", tags: ["Enterprise search"] },
  
  // Writing & Communication
  { id: 14, icon: PenTool, title: "Polish rough notes", prompt: "I have rough notes that need polishing into a clean document. I'll share them or point you to the file. Clean up the language, improve the structure, and keep my voice — show me the draft before finalizing.", category: "create", tags: [] },
  { id: 15, icon: MessageSquareText, title: "Write meeting follow-up", prompt: "I need a meeting follow-up email written. I'll give you the key points and action items from the meeting. Draft something clear and professional, and let me review before sending.", category: "communicate", tags: [] },
  
  // Development
  { id: 16, icon: Code2, title: "Build a web app", prompt: "I want to build a web app. I'll describe what it should do and how it should look. Ask about tech stack preferences, walk me through the architecture, then build it out step by step — checking in at each milestone.", category: "create", tags: ["Engineering"] },
  { id: 17, icon: GitBranch, title: "Code review checklist", prompt: "I need a code review checklist tailored for my team. I'll tell you what languages, frameworks, and standards we use. Ask about our priorities, then create a thorough checklist I can share with the team.", category: "create", tags: ["Engineering"] },
  { id: 18, icon: Globe, title: "Automate browser task", prompt: "I have a browser task I need automated. I'll describe the website and the actions I repeat. Figure out the best approach, ask about edge cases, then build the automation and test it before I run it.", category: "create", tags: ["Automation"] },
  
  // Design & Planning
  { id: 19, icon: FileSearch, title: "Audit accessibility", prompt: "I need an accessibility audit on my design or website. I'll share a URL or screenshots. Run through WCAG guidelines, flag the issues by severity, and give me actionable fixes for each one.", category: "analyze", tags: ["Design"] },
  { id: 20, icon: ListTodo, title: "Create launch checklist", prompt: "I'm launching something and need a comprehensive checklist. I'll tell you what I'm launching and the timeline. Ask about my team, dependencies, and risks, then build out the checklist in priority order.", category: "organize", tags: ["Product management"] },
  { id: 21, icon: Calendar, title: "Plan a trip", prompt: "I want to plan a trip. I'll tell you where, when, and what I'm into. Ask about budget, travel style, and must-dos, then put together an itinerary for me to customize.", category: "organize", tags: [] },
];

const COWORK_CATEGORIES = [
  { id: "all", label: "All", icon: Grid3X3 },
  { id: "schedule", label: "Schedule", icon: Timer },
  { id: "create", label: "Create", icon: Sparkles },
  { id: "analyze", label: "Analyze", icon: Search },
  { id: "organize", label: "Organize", icon: FolderKanban },
  { id: "communicate", label: "Communicate", icon: MessageSquareText },
];

/* ─── Shared Components ─────────────────────────────────────────────────────── */
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
        ctx.fillStyle = `rgba(29,140,248,${Math.random() * 0.35 + 0.04})`;
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

function Toggle({ on, onToggle }) {
  return (
    <button type="button" onClick={onToggle} className="w-8 h-[18px] rounded-full relative transition-colors shrink-0" style={{ background: on ? C.accent : "#333" }}>
      <div className="absolute top-[2px] w-[14px] h-[14px] rounded-full transition-all" style={{ background: "#fff", left: on ? 14 : 2 }} />
    </button>
  );
}

function Markdown({ content }) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={{
      p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
      ul: ({ children }) => <ul className="list-disc ml-4 mb-2 space-y-0.5">{children}</ul>,
      ol: ({ children }) => <ol className="list-decimal ml-4 mb-2 space-y-0.5">{children}</ol>,
      li: ({ children }) => <li className="text-sm">{children}</li>,
      strong: ({ children }) => <strong className="font-semibold" style={{ color: C.text }}>{children}</strong>,
      code: ({ children, className }) => className
        ? <code className="block text-[11px] rounded p-2 my-1.5 overflow-auto font-mono whitespace-pre-wrap" style={{ background: C.surface2, border: `1px solid ${C.border}` }}>{children}</code>
        : <code className="text-[11px] rounded px-1 py-0.5 font-mono" style={{ background: C.surface2, border: `1px solid ${C.border}` }}>{children}</code>,
      pre: ({ children }) => <>{children}</>,
      a: ({ href, children }) => <a href={href} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:opacity-80" style={{ color: C.accent }}>{children}</a>,
    }}>{content}</ReactMarkdown>
  );
}

/* ─── Model Selector (Minimal 2-step hover) ───────────────────────────────── */
function ModelSelector({ models, providers, activeModel, onSelect }) {
  const [open, setOpen] = useState(false);
  const [hovProv, setHovProv] = useState(null);
  const ref = useRef(null);
  const hoverTimer = useRef(null);

  useEffect(() => {
    if (!open) return;
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) { setOpen(false); setHovProv(null); } };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);

  const activeName = activeModel ? (models.find(m => m.id === activeModel)?.name ?? activeModel.split("/").pop()) : null;
  const hovModels = hovProv ? (providers.find(p => p.name === hovProv)?.models ?? []) : [];
  const handleSelect = async (modelId) => { setOpen(false); setHovProv(null); await onSelect(modelId); };
  const label = activeName ? (activeName.length > 22 ? activeName.slice(0, 20) + "..." : activeName) : "Select model";

  const handleProvHover = (name) => {
    clearTimeout(hoverTimer.current);
    setHovProv(name);
  };
  const handleProvLeave = () => {
    hoverTimer.current = setTimeout(() => setHovProv(null), 200);
  };
  const handleModelsEnter = () => { clearTimeout(hoverTimer.current); };
  const handleModelsLeave = () => { hoverTimer.current = setTimeout(() => setHovProv(null), 200); };

  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => { setOpen(v => !v); setHovProv(null); }}
        className="flex items-center gap-1 text-[12px] transition-colors" style={{ color: open ? C.text : C.muted }}
        data-testid="model-selector-trigger">
        <span className="font-medium">{label}</span>
        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute bottom-full right-0 mb-2 z-50 flex items-start" style={{ gap: 2 }}>
          {/* Models panel (appears on hover, LEFT of providers) */}
          {hovProv && hovModels.length > 0 && (
            <div className="shadow-2xl" onMouseEnter={handleModelsEnter} onMouseLeave={handleModelsLeave}
              style={{ width: 300, maxHeight: 420, background: "#111", borderRadius: 12, border: "1px solid #222", overflow: "hidden", display: "flex", flexDirection: "column" }}>
              <div className="px-3 py-2 shrink-0 flex items-center justify-between" style={{ borderBottom: "1px solid #1d1d1d" }}>
                <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "#555" }}>{hovProv}</span>
                <CapabilityIcons caps={{ vision: true, coding: true, tools: true, files: true, reasoning: true, fast: true }} size={11} gap={5} />
              </div>
              <ScrollArea className="flex-1" style={{ maxHeight: 380 }}>
                {hovModels.map(m => {
                  const isActive = m.id === activeModel;
                  return (
                    <button key={m.id} type="button" onClick={() => handleSelect(m.id)}
                      className="w-full text-left transition-colors group"
                      style={{ padding: "8px 12px", background: isActive ? "rgba(29,140,248,0.08)" : "transparent", borderBottom: "1px solid #1a1a1a" }}
                      onMouseOver={e => { if (!isActive) e.currentTarget.style.background = "rgba(255,255,255,0.03)"; }}
                      onMouseOut={e => { if (!isActive) e.currentTarget.style.background = isActive ? "rgba(29,140,248,0.08)" : "transparent"; }}
                      data-testid={`model-item-${m.name.replace(/\s+/g, "-").toLowerCase()}`}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-[13px] font-semibold truncate" style={{ color: isActive ? C.accent : "#ddd", lineHeight: 1.3 }}>{m.name}</div>
                          <div className="text-[10px] truncate" style={{ color: "#444", fontFamily: "monospace", lineHeight: 1.4 }}>{m.id.split("/").pop()}</div>
                        </div>
                        {isActive && <Check className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: C.accent }} />}
                      </div>
                      <div className="mt-1"><CapabilityIcons caps={m.caps} size={12} gap={5} /></div>
                    </button>
                  );
                })}
              </ScrollArea>
            </div>
          )}

          {/* Providers panel (always visible when open, RIGHT side) */}
          <div className="shadow-2xl" style={{ width: 160, background: "#0f0f0f", borderRadius: 12, border: "1px solid #222", overflow: "hidden" }}>
            <div className="px-3 py-2" style={{ borderBottom: "1px solid #1d1d1d" }}>
              <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "#555" }}>Providers</span>
            </div>
            <div style={{ maxHeight: 320, overflowY: "auto" }}>
              {providers.map(prov => (
                <button key={prov.name} type="button"
                  onMouseEnter={() => handleProvHover(prov.name)}
                  onMouseLeave={handleProvLeave}
                  onClick={() => handleProvHover(prov.name)}
                  className="w-full flex items-center justify-between px-3 py-2 text-left transition-colors"
                  style={{ background: prov.name === hovProv ? "rgba(29,140,248,0.06)" : "transparent" }}
                  data-testid={`provider-${prov.name}`}>
                  <span className="text-[12px] font-medium" style={{ color: prov.name === hovProv ? "#ddd" : "#888" }}>{prov.name}</span>
                  <div className="flex items-center gap-1">
                    <span className="text-[10px]" style={{ color: "#444" }}>{prov.count}</span>
                    <ChevronLeft className="w-3 h-3" style={{ color: prov.name === hovProv ? C.accent : "#333" }} />
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Plus Menu ──────────────────────────────────────────────────────────────── */
function PlusMenu({ onSelect, disabled, onModeChange }) {
  const [open, setOpen] = useState(false);
  const [sub, setSub] = useState(null);
  const ref = useRef(null);
  const { connectors, toggleConnector, enabledSkills, toggleSkill, webSearchEnabled, setWebSearchEnabled, writingStyle, setWritingStyle } = useGateway();

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
            <Row icon={Telescope} label="Research" onClick={() => { onModeChange?.("research"); onSelect("Do deep research on: ", true); close(); }} />
            <Row icon={Globe} label="Web search" active={webSearchEnabled} onClick={() => setWebSearchEnabled(!webSearchEnabled)} />
            <Row icon={Bot} label="Use style" hasSub onClick={() => setSub(p => p === "style" ? null : "style")} />
          </div>
          {sub === "skills" && (
            <div className="w-52 rounded-xl py-1 shadow-2xl" style={panelStyle}>
              {SKILLS.map(sk => (
                <button key={sk} type="button" className="w-full flex items-center justify-between gap-2.5 px-3 py-[6px] text-[13px] text-left transition-colors" style={{ color: "#ccc" }}
                  onMouseOver={e => { e.currentTarget.style.background = hoverBg; }} onMouseOut={e => { e.currentTarget.style.background = "transparent"; }} onClick={() => toggleSkill(sk)}>
                  {sk}{enabledSkills.includes(sk) && <Check className="w-3.5 h-3.5" style={{ color: C.accent }} />}
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
              {CONNECTORS.map(c => (
                <div key={c.id} className="flex items-center gap-2.5 px-3 py-[7px] transition-colors" style={{ color: C.text }}
                  onMouseOver={e => { e.currentTarget.style.background = hoverBg; }} onMouseOut={e => { e.currentTarget.style.background = "transparent"; }}>
                  <c.icon className="w-4 h-4 shrink-0" style={{ color: "#888" }} /><span className="text-[13px] flex-1">{c.label}</span><Toggle on={connectors[c.id]} onToggle={() => toggleConnector(c.id)} />
                </div>
              ))}
              <Divider /><Row icon={Wrench} label="Manage connectors" onClick={close} />
            </div>
          )}
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

/* ─── Input Bar ──────────────────────────────────────────────────────────────── */
function InputBar({ onSend, disabled, placeholder, fillPrompt, onFillConsumed }) {
  const [val, setVal] = useState("");
  const ref = useRef(null);
  const { models, providers, activeModel, webSearchEnabled, enabledSkills } = useGateway();
  const [activeMode, setActiveMode] = useState("agent"); // agent, research, code

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

  // Build active feature chips
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
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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

/* ─── Cowork Page (Inline Conversation like Claude) ────────────────────────────── */
function CoworkPage() {
  const [category, setCategory] = useState("all");
  const [search, setSearch] = useState("");
  const { models, providers, activeModel, connectors, sendMessage, messages, streamingMessage } = useGateway();
  const [activeTask, setActiveTask] = useState(null);
  const [replyVal, setReplyVal] = useState("");
  const [taskMessages, setTaskMessages] = useState([]);
  const [isWorking, setIsWorking] = useState(false);
  const [progressSteps, setProgressSteps] = useState([]);
  const [recentTasks, setRecentTasks] = useState([]);
  const replyRef = useRef(null);
  const messagesEndRef = useRef(null);

  const filteredTasks = COWORK_TASKS.filter(task => {
    if (category !== "all" && task.category !== category) return false;
    if (search && !task.title.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const activeConnectors = Object.values(connectors).filter(Boolean).length;

  const handleTaskClick = (task) => {
    setActiveTask(task);
    setTaskMessages([{ id: 1, role: "user", content: task.prompt }]);
    setIsWorking(true);
    setProgressSteps([{ id: 1, label: "Understanding request", done: true }, { id: 2, label: "Processing", done: false }, { id: 3, label: "Delivering result", done: false }]);
    // Add to recents
    setRecentTasks(prev => {
      const filtered = prev.filter(t => t.id !== task.id);
      return [task, ...filtered].slice(0, 8);
    });
    // Simulate AI response after delay
    setTimeout(() => {
      setTaskMessages(prev => [...prev, { id: 2, role: "assistant", content: `Got it. I'll work on "${task.title}" for you.\n\nLet me start by understanding what you need. I'll ask some follow-up questions to make sure I get this right before diving in.` }]);
      setProgressSteps(prev => prev.map((s, i) => i <= 1 ? { ...s, done: true } : s));
      setIsWorking(false);
    }, 2000);
  };

  const handleReply = () => {
    if (!replyVal.trim()) return;
    const newMsg = { id: taskMessages.length + 1, role: "user", content: replyVal.trim() };
    setTaskMessages(prev => [...prev, newMsg]);
    setReplyVal("");
    setIsWorking(true);
    setTimeout(() => {
      setTaskMessages(prev => [...prev, { id: prev.length + 1, role: "assistant", content: "Understood. I'm processing that now and will update you shortly with the next steps." }]);
      setIsWorking(false);
    }, 1500);
  };

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [taskMessages, isWorking]);

  // ── Task grid view ──
  if (!activeTask) {
    return (
      <div className="h-full flex flex-col" style={{ color: C.text }}>
        <div className="flex-1 overflow-auto">
          <div className="max-w-4xl mx-auto px-6 py-8">
            <div className="text-center mb-8">
              <h1 className="text-3xl font-bold mb-2">Delegate to OpenClaw</h1>
              <p className="text-lg" style={{ color: C.muted }}>Hand off a task, get a polished deliverable</p>
            </div>
            {activeConnectors < 4 && (
              <div className="flex items-center justify-between p-4 rounded-xl mb-6" style={{ background: "rgba(29,140,248,0.1)", border: "1px solid rgba(29,140,248,0.2)" }}>
                <div className="flex items-center gap-3"><MonitorSmartphone className="w-5 h-5" style={{ color: C.accent }} /><span className="text-sm">Connect your tools to unlock more capabilities</span></div>
                <div className="flex gap-2">
                  <Link to="/settings"><Button variant="outline" size="sm" className="gap-1" style={{ borderColor: C.border, color: C.text }}><Layers className="w-3 h-3" /> Connectors <span className="text-xs bg-blue-600 px-1 rounded">{activeConnectors}</span></Button></Link>
                  <Link to="/customize"><Button variant="outline" size="sm" className="gap-1" style={{ borderColor: C.border, color: C.text }}><Puzzle className="w-3 h-3" /> Plugins</Button></Link>
                </div>
              </div>
            )}
            <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-2">
              {COWORK_CATEGORIES.map(cat => {
                const Icon = cat.icon;
                const isActive = category === cat.id;
                return (
                  <button key={cat.id} onClick={() => setCategory(cat.id)}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm whitespace-nowrap transition-all"
                    style={{ background: isActive ? C.accent : C.surface, color: isActive ? "#fff" : C.muted, border: `1px solid ${isActive ? C.accent : C.border}` }}>
                    <Icon className="w-4 h-4" />{cat.label}
                  </button>
                );
              })}
            </div>
            <div className="relative mb-6">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: C.muted }} />
              <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search tasks..."
                className="w-full pl-11 pr-4 py-3 rounded-xl text-sm" style={{ background: C.surface, border: `1px solid ${C.border}`, color: C.text }} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredTasks.map(task => {
                const Icon = task.icon;
                return (
                  <button key={task.id} onClick={() => handleTaskClick(task)}
                    className="text-left p-4 rounded-xl transition-all hover:border-blue-500/50 hover:bg-blue-500/5 group"
                    style={{ background: C.surface, border: `1px solid ${C.border}` }}
                    data-testid={`cowork-task-${task.id}`}>
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 transition-colors group-hover:bg-blue-500/20"
                        style={{ background: C.surface2, border: `1px solid ${C.border}` }}>
                        <Icon className="w-5 h-5 transition-colors group-hover:text-blue-400" style={{ color: C.muted }} />
                      </div>
                      <div>
                        <div className="font-medium mb-1 group-hover:text-blue-400 transition-colors">{task.title}</div>
                        {task.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {task.tags.map(tag => (<span key={tag} className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: C.surface2, color: C.muted }}>{tag}</span>))}
                          </div>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
        <div className="p-4 border-t" style={{ borderColor: C.border, background: C.bg }}>
          <div className="max-w-2xl mx-auto">
            <div className="flex items-center justify-between gap-3 p-3 rounded-xl" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
              <div className="flex items-center gap-2"><Smartphone className="w-4 h-4" style={{ color: C.muted }} /><span className="text-sm" style={{ color: C.muted }}>Start a task from your phone</span></div>
              <div className="flex items-center gap-2">
                <ModelSelector models={models} providers={providers} activeModel={activeModel} onSelect={switchModel} />
                <Mic className="w-4 h-4 cursor-pointer" style={{ color: C.muted }} />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Active task conversation view (Claude-style) ──
  const TaskIcon = activeTask.icon;
  return (
    <div className="h-full flex" style={{ color: C.text }}>
      {/* Left recents sidebar */}
      <div className="hidden lg:flex flex-col shrink-0 overflow-hidden" style={{ width: 220, borderRight: `1px solid ${C.border}`, background: "#0b0b0b" }}>
        <div className="p-3" style={{ borderBottom: `1px solid ${C.border}` }}>
          <button onClick={() => setActiveTask(null)} className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm transition-colors" style={{ color: C.muted }}
            onMouseOver={e => { e.currentTarget.style.background = "rgba(255,255,255,0.04)"; }} onMouseOut={e => { e.currentTarget.style.background = "transparent"; }}
            data-testid="cowork-back-btn">
            <ChevronLeft className="w-4 h-4" /><Plus className="w-4 h-4" /> New task
          </button>
        </div>
        {recentTasks.length > 0 && (
          <div className="px-3 pt-3">
            <div className="text-[10px] font-bold uppercase tracking-widest mb-2 px-2" style={{ color: "#555" }}>Recents</div>
            {recentTasks.map(t => {
              const isActive = t.id === activeTask?.id;
              return (
                <button key={t.id} onClick={() => handleTaskClick(t)} className="w-full text-left px-2 py-1.5 rounded-md text-[13px] truncate transition-colors mb-0.5"
                  style={{ background: isActive ? "rgba(29,140,248,0.1)" : "transparent", color: isActive ? C.accent : "#888" }}>{t.title}</button>
              );
            })}
          </div>
        )}
      </div>

      {/* Center conversation */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Task header */}
        <div className="flex items-center gap-3 px-4 py-3 shrink-0" style={{ borderBottom: `1px solid ${C.border}`, background: "#0d0d0d" }}>
          <button onClick={() => setActiveTask(null)} className="lg:hidden flex items-center justify-center w-7 h-7 rounded-lg transition-colors" style={{ color: C.muted }}
            onMouseOver={e => { e.currentTarget.style.background = "rgba(255,255,255,0.06)"; }} onMouseOut={e => { e.currentTarget.style.background = "transparent"; }}>
            <ChevronLeft className="w-4 h-4" />
          </button>
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: C.surface2, border: `1px solid ${C.border}` }}>
            <TaskIcon className="w-4 h-4" style={{ color: C.accent }} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-medium text-sm truncate">{activeTask.title}</div>
            {activeTask.tags.length > 0 && <div className="text-[10px]" style={{ color: C.muted }}>{activeTask.tags.join(" / ")}</div>}
          </div>
          <ChevronDown className="w-4 h-4" style={{ color: "#555" }} />
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-auto px-4 py-6">
          <div className="max-w-2xl mx-auto space-y-5">
            {taskMessages.map(msg => (
              <div key={msg.id} className="flex gap-3" data-testid={`cowork-msg-${msg.id}`}>
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] shrink-0 mt-0.5"
                  style={{ background: msg.role === "user" ? C.surface2 : "rgba(29,140,248,0.1)", border: `1px solid ${msg.role === "user" ? C.border : "rgba(29,140,248,0.2)"}` }}>
                  {msg.role === "user" ? "M" : <span style={{ fontSize: 14 }}>&#129438;</span>}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm leading-relaxed" style={{ color: msg.role === "user" ? "#ccc" : C.text }}>
                    <Markdown content={msg.content} />
                  </div>
                </div>
              </div>
            ))}
            {isWorking && (
              <div className="flex gap-3">
                <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5" style={{ background: "rgba(29,140,248,0.1)", border: "1px solid rgba(29,140,248,0.2)" }}>
                  <span style={{ fontSize: 14 }}>&#129438;</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: "#f59e0b" }} />
                  <span style={{ color: C.muted }}>Working on it...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Reply input */}
        <div className="px-4 pb-4 pt-2 shrink-0">
          <div className="max-w-2xl mx-auto">
            <div className="text-[11px] mb-2 px-1" style={{ color: "#555" }}>
              <span style={{ color: C.accent }}>{activeModel ? activeModel.split("/").pop() : "Select model"}</span> uses your limit faster. Try another model for longer conversations.
            </div>
            <div className="rounded-2xl shadow-xl" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
              <textarea ref={replyRef} value={replyVal} onChange={e => setReplyVal(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleReply(); } }}
                placeholder="Reply..." rows={1}
                className="w-full focus:outline-none resize-none text-[14px] font-sans" style={{ background: "transparent", border: "none", color: C.text, padding: "12px 16px 8px", minHeight: 44, maxHeight: 160 }}
                data-testid="cowork-reply-input" />
              <div className="flex items-center gap-2 px-3 pb-3">
                <button className="w-6 h-6 rounded-full flex items-center justify-center" style={{ background: C.surface2, border: `1px solid ${C.border}`, color: C.muted }}><Plus className="w-3 h-3" /></button>
                <div className="flex-1" />
                <ModelSelector models={models} providers={providers} activeModel={activeModel} onSelect={switchModel} />
                <button onClick={handleReply} disabled={!replyVal.trim()} className="h-7 px-3 rounded-lg text-[12px] font-medium flex items-center gap-1.5 transition-colors"
                  style={{ background: replyVal.trim() ? C.accent : C.surface2, color: replyVal.trim() ? "#fff" : "#555" }}
                  data-testid="cowork-queue-btn">
                  Queue <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            </div>
            <div className="text-[10px] mt-1.5 text-center" style={{ color: "#444" }}>OpenClaw is AI and can make mistakes. Please double-check responses.</div>
          </div>
        </div>
      </div>

      {/* Right sidebar - Progress/Context */}
      <div className="hidden lg:flex flex-col shrink-0 overflow-auto" style={{ width: 240, borderLeft: `1px solid ${C.border}`, background: "#0b0b0b" }}>
        {/* Progress */}
        <div className="p-4" style={{ borderBottom: `1px solid ${C.border}` }}>
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "#666" }}>Progress</span>
            <ChevronDown className="w-3.5 h-3.5" style={{ color: "#555" }} />
          </div>
          <div className="space-y-3">
            {progressSteps.map((step) => (
              <div key={step.id} className="flex items-center gap-2.5">
                <div className="w-5 h-5 rounded-full flex items-center justify-center shrink-0"
                  style={{ background: step.done ? "rgba(34,197,94,0.15)" : C.surface2, border: `1.5px solid ${step.done ? "#22c55e" : "#333"}` }}>
                  {step.done && <Check className="w-3 h-3" style={{ color: "#22c55e" }} />}
                </div>
                <span className="text-[12px]" style={{ color: step.done ? "#aaa" : "#555" }}>{step.label}</span>
              </div>
            ))}
          </div>
          <div className="text-[10px] mt-3" style={{ color: "#444" }}>See task progress for longer tasks.</div>
        </div>
        {/* Working folder */}
        <div className="p-4" style={{ borderBottom: `1px solid ${C.border}` }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2"><Folder className="w-4 h-4" style={{ color: "#555" }} /><span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "#666" }}>Working folder</span></div>
            <ChevronRight className="w-3.5 h-3.5" style={{ color: "#555" }} />
          </div>
        </div>
        {/* Context */}
        <div className="p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "#666" }}>Context</span>
            <ChevronDown className="w-3.5 h-3.5" style={{ color: "#555" }} />
          </div>
          <div className="flex gap-2 flex-wrap">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer" style={{ background: C.surface2, border: `1px solid ${C.border}`, color: C.muted }}>
              <Plus className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-[10px] mt-3" style={{ color: "#444" }}>Track tools and referenced files used in this task.</div>
        </div>
      </div>
    </div>
  );
}

/* ─── Code Page (Clean Terminal for Mobile/Desktop) ─────────────────────────── */
function CodePage() {
  const { terminalOutput, clearTerminal, models, providers, activeModel } = useGateway();
  const [cmd, setCmd] = useState("");
  const [bypassPermissions, setBypassPermissions] = useState(false);
  const [isLocal, setIsLocal] = useState(true);
  const terminalRef = useRef(null);

  useEffect(() => { terminalRef.current?.scrollTo(0, terminalRef.current.scrollHeight); }, [terminalOutput]);

  const handleCommand = async () => {
    if (!cmd.trim()) return;
    await executeCommand(cmd);
    setCmd("");
  };

  return (
    <div className="h-full flex flex-col" style={{ color: C.text }}>
      {/* Terminal Header */}
      <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: `1px solid ${C.border}`, background: "#0d0d0d" }}>
        <div className="flex items-center gap-3">
          <div className="text-lg font-semibold">Terminal</div>
          <span className="text-xs px-2 py-0.5 rounded" style={{ background: C.surface2, color: C.muted }}>OpenClaw Sandbox</span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={clearTerminal} style={{ color: C.muted }}>
            <Trash2 className="w-4 h-4 mr-1" /> Clear
          </Button>
        </div>
      </div>

      {/* Terminal Output */}
      <div ref={terminalRef} className="flex-1 p-6 font-mono text-sm overflow-auto" style={{ background: "#000" }}>
        {terminalOutput.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="text-6xl mb-6">🦞</div>
            <h2 className="text-xl font-bold mb-2">OpenClaw Terminal</h2>
            <p className="text-sm mb-4" style={{ color: C.muted }}>Execute commands in the sandboxed environment</p>
            <p className="text-xs" style={{ color: "#444" }}>Works on desktop, mobile, and anywhere you can access OpenClaw</p>
          </div>
        ) : (
          terminalOutput.map(line => (
            <div key={line.id} className="whitespace-pre-wrap" style={{ color: line.content.startsWith("$") ? C.green : C.text }}>{line.content}</div>
          ))
        )}
      </div>

      {/* Command Input - Mobile Friendly */}
      <div className="p-3 md:p-4" style={{ borderTop: `1px solid ${C.border}`, background: "#0a0a0a" }}>
        <div className="max-w-3xl mx-auto space-y-2 md:space-y-3">
          {/* Input */}
          <div className="flex items-center gap-2 p-2 md:p-3 rounded-xl" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
            <span style={{ color: C.green }}>$</span>
            <input type="text" value={cmd} onChange={e => setCmd(e.target.value)} onKeyDown={e => e.key === "Enter" && handleCommand()}
              placeholder="Enter command or describe what you want to do..."
              className="flex-1 bg-transparent border-none outline-none text-sm" style={{ color: C.text }} data-testid="terminal-input" />
            <Button size="sm" onClick={handleCommand} disabled={!cmd.trim()} style={{ background: cmd.trim() ? C.accent : C.surface2 }}>
              <ArrowRight className="w-4 h-4" />
            </Button>
          </div>

          {/* Controls */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <button onClick={() => setBypassPermissions(!bypassPermissions)}
                className="flex items-center gap-1.5 text-xs px-2 md:px-3 py-1.5 rounded-lg transition-colors"
                style={{ background: bypassPermissions ? "rgba(239,68,68,0.1)" : C.surface2, color: bypassPermissions ? C.red : C.muted, border: `1px solid ${bypassPermissions ? "rgba(239,68,68,0.3)" : C.border}` }}
                data-testid="bypass-permissions-toggle">
                {bypassPermissions ? <Unlock className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                <span className="hidden sm:inline">{bypassPermissions ? "Permissions bypassed" : "Bypass permissions"}</span>
              </button>
            </div>
            <div className="flex items-center gap-2">
              <ModelSelector models={models} providers={providers} activeModel={activeModel} onSelect={switchModel} />
              <Mic className="w-4 h-4 cursor-pointer shrink-0" style={{ color: C.muted }} />
              <button onClick={() => setIsLocal(!isLocal)}
                className="flex items-center gap-1.5 text-xs px-2 md:px-3 py-1.5 rounded-lg"
                style={{ background: C.surface2, color: C.muted, border: `1px solid ${C.border}` }}
                data-testid="local-remote-toggle">
                {isLocal ? <Monitor className="w-3.5 h-3.5" /> : <Cloud className="w-3.5 h-3.5" />}
                {isLocal ? "Local" : "Remote"}
              </button>
            </div>
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
          <div><label className="block text-sm mb-2">Writing Style</label>
            <div className="flex gap-2">{["Normal", "Concise", "Formal", "Explanatory"].map(s => (
              <button key={s} onClick={() => setWritingStyle(s)} className="px-3 py-1.5 rounded text-sm" style={{ background: writingStyle === s ? C.accent : C.surface2, color: writingStyle === s ? "#fff" : C.muted }}>{s}</button>
            ))}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Customize Page ─────────────────────────────────────────────────────────── */
function CustomizePage() {
  return (
    <div className="h-full flex items-center justify-center" style={{ color: C.text }}>
      <div className="max-w-md text-center">
        <div className="w-20 h-20 mx-auto mb-6 rounded-xl flex items-center justify-center" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
          <Package className="w-10 h-10" style={{ color: C.muted }} />
        </div>
        <h1 className="text-2xl font-bold mb-2">Customize OpenClaw</h1>
        <p className="text-sm mb-8" style={{ color: C.muted }}>Skills, connectors, and plugins shape how OpenClaw works with you.</p>
        <div className="space-y-3">
          <Link to="/settings" className="block p-4 rounded-xl text-left transition-colors hover:bg-white/5" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: C.surface2 }}><Link2 className="w-5 h-5" style={{ color: C.muted }} /></div>
              <div><div className="font-medium">Connect your apps</div><div className="text-sm" style={{ color: C.muted }}>Let OpenClaw read and write to the tools you already use.</div></div>
            </div>
          </Link>
          <button className="w-full p-4 rounded-xl text-left transition-colors hover:bg-white/5" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: C.surface2 }}><Sparkles className="w-5 h-5" style={{ color: C.muted }} /></div>
              <div><div className="font-medium">Create new skills</div><div className="text-sm" style={{ color: C.muted }}>Teach OpenClaw your processes, team norms, and expertise.</div></div>
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
  );
}

/* ─── Layout ─────────────────────────────────────────────────────────────────── */
function Layout({ children }) {
  const location = useLocation();
  const { status, clawStatus, approvals } = useGateway();
  const clawState = clawStatus?.state ?? "Scheduled";
  const pendingApprovals = approvals.filter(a => a.status === "pending").length;
  const currentTab = location.pathname === "/cowork" ? "cowork" : location.pathname === "/code" ? "code" : "chat";
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const isMobile = typeof window !== "undefined" && window.innerWidth < 768;

  // Close sidebar on route change (mobile)
  useEffect(() => { setSidebarOpen(false); }, [location.pathname]);

  return (
    <div className="flex h-screen w-full overflow-hidden" style={{ background: C.bg, color: C.text }}>
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="sidebar-overlay-bg fixed inset-0 bg-black/60 z-40" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`sidebar-desktop flex flex-col shrink-0 overflow-hidden ${sidebarOpen ? "sidebar-open" : ""}`} style={{ width: 200, background: "#0f0f0f", borderRight: "1px solid #222" }}>
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
          <Link to="/cowork" className="flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors" style={{ background: location.pathname === "/cowork" ? "rgba(29,140,248,0.12)" : "transparent", color: location.pathname === "/cowork" ? C.accent : "#bbb" }}>
            <Lightbulb className="w-4 h-4" />Cowork
          </Link>
          <Link to="/customize" className="flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors" style={{ background: location.pathname === "/customize" ? "rgba(29,140,248,0.12)" : "transparent", color: location.pathname === "/customize" ? C.accent : "#bbb" }}>
            <Package className="w-4 h-4" />Customize
          </Link>
        </div>
        <div className="flex-1" />
        <div className="flex items-center gap-3 px-4 py-3.5" style={{ borderTop: "1px solid #222" }}>
          <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold shrink-0" style={{ background: C.accent, color: "#fff" }}>M</div>
          <div><div className="text-sm font-medium" style={{ color: C.text }}>Meg</div><div className="text-[11px]" style={{ color: C.muted }}>Pro plan</div></div>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="h-12 flex items-center justify-between px-4 shrink-0" style={{ borderBottom: "1px solid #1a1a1a", background: C.bg }}>
          <div className="flex items-center gap-2" style={{ minWidth: 80 }}>
            <button className="hamburger-btn w-8 h-8 items-center justify-center rounded-lg" style={{ color: C.muted, display: "none" }} onClick={() => setSidebarOpen(v => !v)} data-testid="sidebar-toggle">
              <Menu className="w-5 h-5" />
            </button>
          </div>
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
          <div className="flex items-center justify-end gap-2 text-[12px]" style={{ color: "#888", minWidth: 80 }}>
            <div className="relative flex h-2 w-2">
              {status === "connected" ? <><span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ background: "#22c55e" }} /><span className="relative inline-flex rounded-full h-2 w-2" style={{ background: "#22c55e" }} /></>
                : <span className="relative inline-flex rounded-full h-2 w-2 animate-pulse" style={{ background: "#fbbf24" }} />}
            </div>
            <span className="capitalize status-text-mobile">{clawState}</span>
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
  const location = useLocation();
  const hasMessages = messages.length > 0 || !!streamingMessage;

  useEffect(() => { initGateway(); }, []);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages.length, streamingMessage?.content]);

  // Check for prompt in URL (from Cowork)
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const prompt = params.get("prompt");
    if (prompt) {
      setFillPrompt(decodeURIComponent(prompt));
      // Clean URL
      window.history.replaceState({}, "", "/");
    }
  }, [location]);

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
              {[
                { icon: Cpu, title: "Select a model", desc: "Choose from local and cloud models", prompt: "What AI models do you have available?" },
                { icon: Bot, title: "Try Agent", desc: "Build apps, edit files, run commands", prompt: "What are your current agent capabilities?" },
                { icon: Telescope, title: "Deep Research", desc: "Synthesize from multiple sources", prompt: "Do deep research on: ", fill: true },
                { icon: Rocket, title: "Mission Control", desc: "Jobs, approvals, live monitoring", prompt: "Give me a full mission control status report." },
              ].map(card => {
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
