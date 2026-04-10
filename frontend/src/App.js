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
  Cloud, Lock, Unlock, Sparkles, Package, Puzzle, Link2, ChevronLeft, Box,
  Database, FileText, Presentation, Calendar, ListTodo, FileSearch,
  Smartphone, MonitorSmartphone, FileSpreadsheet, ClipboardList, Mail,
  FolderSync, ScreenShare, Timer, Receipt, NotebookPen, Menu,
  Palette, Image, Hash, Pencil, ShieldCheck, CreditCard, ExternalLink, Paintbrush,
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
  { href: "/agent", label: "Agent", icon: Sparkles },
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/jobs", label: "Jobs", icon: Briefcase, badgeKey: "activeJobs" },
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
  { id: "vscode", label: "VS Code", icon: Code2 },
  { id: "figma", label: "Figma", icon: Paintbrush },
  { id: "slack", label: "Slack", icon: MessageSquare },
  { id: "chrome", label: "Chrome Browser", icon: Globe },
  { id: "docker", label: "Docker", icon: Box },
  { id: "notion", label: "Notion", icon: FileText },
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

/* ─── Directory Data (Customize — Skills / Connectors / Plugins catalog) ───── */
const DIRECTORY_SKILLS = [
  { id: "deep-research", name: "/deep-research", provider: "OpenClaw", downloads: "134.7K", desc: "Comprehensive multi-source research with synthesis and citation tracking.", icon: Telescope, category: "Research" },
  { id: "canvas-design", name: "/canvas-design", provider: "OpenClaw", downloads: "145.2K", desc: "Create beautiful visual art in .png and .pdf documents using design philosophy.", icon: Paintbrush, category: "Design" },
  { id: "web-artifacts-builder", name: "/web-artifacts-builder", provider: "OpenClaw", downloads: "92.2K", desc: "Suite of tools for creating multi-component HTML artifacts using modern frontend tech.", icon: Globe, category: "Development" },
  { id: "mcp-builder", name: "/mcp-builder", provider: "OpenClaw", downloads: "75.3K", desc: "Guide for creating high-quality MCP servers that enable LLMs to interact with tools.", icon: Wrench, category: "Development" },
  { id: "code-review", name: "/code-review", provider: "OpenClaw", downloads: "89.4K", desc: "Structured code review with best practices, security checks, and performance analysis.", icon: FileCode, category: "Development" },
  { id: "theme-factory", name: "/theme-factory", provider: "OpenClaw", downloads: "72.4K", desc: "Toolkit for styling artifacts with a theme — slides, docs, reportings, landing pages.", icon: Palette, category: "Design" },
  { id: "doc-coauthoring", name: "/doc-coauthoring", provider: "OpenClaw", downloads: "68.5K", desc: "Guide users through a structured workflow for co-authoring documentation.", icon: NotebookPen, category: "Writing" },
  { id: "web-scraper", name: "/web-scraper", provider: "OpenClaw", downloads: "63.8K", desc: "Extract, parse, and analyze content from web pages with structured output.", icon: Globe, category: "Development" },
  { id: "file-manager", name: "/file-manager", provider: "OpenClaw", downloads: "56.1K", desc: "Organize, rename, and manage file systems with intelligent categorization.", icon: FolderKanban, category: "Productivity" },
  { id: "brand-guidelines", name: "/brand-guidelines", provider: "OpenClaw", downloads: "66.9K", desc: "Applies brand colors and typography to any artifact that benefits from branding.", icon: Paintbrush, category: "Design" },
  { id: "algorithmic-art", name: "/algorithmic-art", provider: "OpenClaw", downloads: "55K", desc: "Creating algorithmic art with seeded randomness and interactive parameter exploration.", icon: Hash, category: "Creative" },
  { id: "internal-comms", name: "/internal-comms", provider: "OpenClaw", downloads: "51.8K", desc: "Write all kinds of internal communications using company formats and tone.", icon: Mail, category: "Writing" },
  { id: "task-scheduler", name: "/task-scheduler", provider: "OpenClaw", downloads: "42.3K", desc: "Schedule, manage, and automate recurring tasks with smart prioritization.", icon: Calendar, category: "Productivity" },
  { id: "slack-gif-creator", name: "/slack-gif-creator", provider: "OpenClaw", downloads: "38.1K", desc: "Knowledge and utilities for creating animated GIFs optimized for Slack.", icon: Sparkles, category: "Creative" },
  { id: "skill-creator", name: "/skill-creator", provider: "OpenClaw", downloads: "12.9K", desc: "Create new skills, modify existing skills, and measure skill performance.", icon: Pencil, category: "Development" },
];

const DIRECTORY_CONNECTORS = [
  { id: "linear", name: "Linear", desc: "Manage issues, projects & team workflows in Linear", icon: ListTodo, category: "Development" },
  { id: "huggingface_conn", name: "Hugging Face", desc: "Access the Hugging Face Hub and thousands of Gradio Apps", icon: Bot, category: "AI & ML" },
  { id: "atlassian", name: "Atlassian Rovo", desc: "Access Jira & Confluence from OpenClaw", icon: Briefcase, category: "Productivity" },
  { id: "figma", name: "Figma", desc: "Generate diagrams and better code from Figma context", icon: Paintbrush, category: "Design", badge: "Interactive" },
  { id: "slack", name: "Slack", desc: "Team messaging and workflow automation", icon: MessageSquare, category: "Communication" },
  { id: "notion", name: "Notion", desc: "Knowledge base and documentation management", icon: FileText, category: "Productivity" },
  { id: "vscode", name: "VS Code", desc: "Code editor integration with live editing and debugging", icon: Code2, category: "Development" },
  { id: "docker", name: "Docker", desc: "Container management, builds, and deployment", icon: Box, category: "Development" },
  { id: "github", name: "GitHub", desc: "Code repos, pull requests, and issue management", icon: GitBranch, category: "Development" },
  { id: "chrome", name: "Chrome Browser", desc: "Web browsing and browser automation", icon: Globe, category: "Productivity" },
  { id: "telegram", name: "Telegram", desc: "Messaging integration for notifications and commands", icon: MessageCircle, category: "Communication" },
  { id: "signal", name: "Signal", desc: "Private and secure messaging integration", icon: Radio, category: "Communication" },
  { id: "cloudflare", name: "Cloudflare", desc: "Build applications with compute, storage, and AI", icon: Cloud, category: "Development" },
  { id: "vercel", name: "Vercel", desc: "Deploy and manage web applications seamlessly", icon: Rocket, category: "Development" },
  { id: "mac", name: "Control Mac", desc: "Control your Mac desktop with AI-powered automation", icon: Monitor, category: "Productivity" },
  { id: "desktop", name: "Desktop Commander", desc: "Advanced desktop automation and system commands", icon: Terminal, category: "Productivity" },
  { id: "files", name: "File Access", desc: "Read and write files on your local system", icon: FolderOpen, category: "Productivity" },
  { id: "web", name: "Web Search", desc: "Search the web and extract information", icon: Search, category: "Research" },
];

const DIRECTORY_PLUGINS = [
  { id: "productivity-suite", name: "Productivity", provider: "OpenClaw", downloads: "469.9K", desc: "Manage tasks, plan your day, and build up memory of important context about your work.", icon: Briefcase, category: "Workflow" },
  { id: "design-suite", name: "Design", provider: "OpenClaw", downloads: "423.5K", desc: "Accelerate design workflows — critique, design system management, UX writing, accessibility audits.", icon: Paintbrush, category: "Creative" },
  { id: "marketing-suite", name: "Marketing", provider: "OpenClaw", downloads: "359K", desc: "Create content, plan campaigns, and analyze performance across marketing channels.", icon: BarChart3, category: "Workflow" },
  { id: "data-suite", name: "Data", provider: "OpenClaw", downloads: "343.1K", desc: "Write SQL, explore datasets, and generate insights faster. Build visualizations and dashboards.", icon: Database, category: "Tools" },
  { id: "engineering-suite", name: "Engineering", provider: "OpenClaw", downloads: "324.9K", desc: "Streamline engineering workflows — standups, code review, architecture decisions, incident response.", icon: Code2, category: "Tools" },
  { id: "finance-suite", name: "Finance", provider: "OpenClaw", downloads: "296.3K", desc: "Streamline finance and accounting workflows, from journal entries to financial statements.", icon: CreditCard, category: "Workflow" },
  { id: "product-mgmt", name: "Product management", provider: "OpenClaw", downloads: "271.4K", desc: "Write feature specs, plan roadmaps, and synthesize user research faster.", icon: FolderKanban, category: "Workflow" },
  { id: "operations-suite", name: "Operations", provider: "OpenClaw", downloads: "254.4K", desc: "Optimize business operations — vendor management, process docs, change management.", icon: Layers, category: "Workflow" },
  { id: "legal-suite", name: "Legal", provider: "OpenClaw", downloads: "242.8K", desc: "Contract review, compliance checks, legal research, and document drafting.", icon: Shield, category: "Workflow" },
  { id: "sales-suite", name: "Sales", provider: "OpenClaw", downloads: "231.3K", desc: "Pipeline management, outreach templates, CRM workflows, and sales analytics.", icon: Rocket, category: "Workflow" },
];

const SKILL_CATEGORIES = ["All", ...new Set(DIRECTORY_SKILLS.map(s => s.category))];
const CONNECTOR_CATEGORIES = ["All", ...new Set(DIRECTORY_CONNECTORS.map(c => c.category))];
const PLUGIN_CATEGORIES = ["All", ...new Set(DIRECTORY_PLUGINS.map(p => p.category))];


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

/* ─── Model Selector (Mirrored + menu style: hover, flush, smart direction) */
function ModelSelector({ models, providers, activeModel, onSelect }) {
  const [open, setOpen] = useState(false);
  const [hovProv, setHovProv] = useState(null);
  const [dropUp, setDropUp] = useState(false);
  const [modelsUp, setModelsUp] = useState(true);
  const ref = useRef(null);
  const provRef = useRef(null);
  const hoverTimer = useRef(null);

  useEffect(() => {
    if (!open) return;
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) { setOpen(false); setHovProv(null); } };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);

  // Smart positioning on open
  useEffect(() => {
    if (!open || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    // Providers: only flip up when very little space below
    setDropUp(spaceBelow < 200 && spaceAbove > 280);
  }, [open]);

  // Models panel direction: check space above providers panel
  useEffect(() => {
    if (!hovProv || !provRef.current) return;
    const rect = provRef.current.getBoundingClientRect();
    const spaceAbove = rect.top;
    const spaceBelow = window.innerHeight - rect.bottom;
    setModelsUp(spaceAbove > 200 || spaceAbove >= spaceBelow);
  }, [hovProv]);

  const activeName = activeModel ? (models.find(m => m.id === activeModel)?.name ?? activeModel.split("/").pop()) : null;
  const label = activeName ? (activeName.length > 22 ? activeName.slice(0, 20) + "..." : activeName) : "Select model";
  const provModels = hovProv ? (providers.find(p => p.name === hovProv)?.models ?? []) : [];

  const handleSelect = async (id) => { setOpen(false); setHovProv(null); await onSelect(id); };
  const handleProvEnter = (name) => { clearTimeout(hoverTimer.current); setHovProv(name); };
  const handleProvLeave = () => { hoverTimer.current = setTimeout(() => setHovProv(null), 150); };
  const handleModelsEnter = () => { clearTimeout(hoverTimer.current); };
  const handleModelsLeave = () => { hoverTimer.current = setTimeout(() => setHovProv(null), 150); };

  const panelBg = "#151515";
  const borderClr = "#2a2a2a";
  const hoverBg = "rgba(255,255,255,0.04)";
  const hasModels = hovProv && provModels.length > 0;

  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => { setOpen(v => !v); setHovProv(null); }}
        className="flex items-center gap-1 text-[12px] transition-colors" style={{ color: open ? C.text : C.muted }}
        data-testid="model-selector-trigger">
        <span className="font-medium">{label}</span>
        <ChevronDown className="w-3.5 h-3.5" />
      </button>

      {open && (
        <div className="absolute right-0 z-50"
          style={dropUp ? { bottom: "100%", marginBottom: 8 } : { top: "100%", marginTop: 8 }}>
          {/* Wrapper: providers as anchor, models absolutely positioned */}
          <div style={{ position: "relative" }} ref={provRef}>

            {/* Providers panel (anchor, directly below/above trigger) */}
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
                    style={{ gap: 4, background: prov.name === hovProv ? "rgba(29,140,248,0.06)" : "transparent" }}
                    onMouseOver={e => { if (prov.name !== hovProv) e.currentTarget.style.background = hoverBg; }}
                    onMouseOut={e => { e.currentTarget.style.background = prov.name === hovProv ? "rgba(29,140,248,0.06)" : "transparent"; }}
                    data-testid={`provider-${prov.name}`}>
                    <ChevronLeft className="w-2.5 h-2.5 shrink-0" style={{ color: prov.name === hovProv ? C.accent : "#333" }} />
                    <span className="text-[11px] font-medium" style={{ color: prov.name === hovProv ? "#ddd" : "#888" }}>{prov.name}</span>
                    <span className="text-[10px]" style={{ color: "#444", marginLeft: 2 }}>{prov.count}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Models panel (absolutely positioned LEFT of providers, bottom or top aligned) */}
            {hasModels && (
              <div className="shadow-2xl" onMouseEnter={handleModelsEnter} onMouseLeave={handleModelsLeave}
                style={{ position: "absolute", right: "100%", [modelsUp ? "bottom" : "top"]: 0, width: "auto", maxWidth: 220, minWidth: 150, maxHeight: 400, background: panelBg, borderTop: `1px solid ${borderClr}`, borderLeft: `1px solid ${borderClr}`, borderBottom: `1px solid ${borderClr}`, borderRight: "none", borderRadius: "10px 0 0 10px", display: "flex", flexDirection: "column" }}>
                <div className="px-2 py-1 shrink-0 flex items-center" style={{ gap: 6, borderBottom: "1px solid #1e1e1e" }}>
                  <span className="text-[9px] font-bold uppercase tracking-widest" style={{ color: "#555" }}>{hovProv}</span>
                  <span className="text-[9px]" style={{ color: "#444" }}>{provModels.length}</span>
                </div>
                <div style={{ overflowY: "auto", maxHeight: 370 }} data-testid="models-scroll-container">
                  {provModels.map(m => {
                    const isActive = m.id === activeModel;
                    return (
                      <button key={m.id} type="button" onClick={() => handleSelect(m.id)}
                        className="w-full text-left transition-colors"
                        style={{ padding: "3px 6px", background: isActive ? "rgba(29,140,248,0.08)" : "transparent", borderBottom: "1px solid #1e1e1e" }}
                        onMouseOver={e => { if (!isActive) e.currentTarget.style.background = hoverBg; }}
                        onMouseOut={e => { e.currentTarget.style.background = isActive ? "rgba(29,140,248,0.08)" : "transparent"; }}
                        data-testid={`model-item-${m.name.replace(/\s+/g, "-").toLowerCase()}`}>
                        <div className="flex items-center gap-1">
                          <span className="text-[11px] font-medium truncate" style={{ color: isActive ? C.accent : "#ddd" }}>{m.name}</span>
                          {isActive && <Check className="w-2.5 h-2.5 shrink-0" style={{ color: C.accent }} />}
                        </div>
                        <div className="flex items-center" style={{ marginTop: 1, gap: 2, whiteSpace: "nowrap" }}>
                          <CapabilityIcons caps={m.caps} size={9} gap={2} />
                          {m.context && <span className="text-[8px] px-1 rounded font-medium shrink-0" style={{ background: "#1a2332", color: "#60a5fa", border: "1px solid #1e3a5f", lineHeight: "13px" }}>{m.context}</span>}
                          {m.costTier && <span className="shrink-0"><CostBadge tier={m.costTier} /></span>}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
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

  const SPACE_ICONS = { FileText, Code2, Paintbrush, FolderOpen, Briefcase, Globe, Layers };
  const getSpaceIcon = (iconName) => SPACE_ICONS[iconName] || FolderOpen;

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
            <Row icon={Layers} label="Connectors" badge={Object.values(connectors).filter(Boolean).length} hasSub onClick={() => setSub(p => p === "connectors" ? null : "connectors")} />
            <Row icon={Puzzle} label="Plugins" onClick={() => { navigate("/customize?tab=plugins"); close(); }} />
            <Divider />
            <Row icon={Telescope} label="Research" onClick={() => { onModeChange?.("research"); onSelect("Do deep research on: ", true); close(); }} />
            <Row icon={Globe} label="Web search" active={webSearchEnabled} onClick={() => setWebSearchEnabled(!webSearchEnabled)} />
            <Row icon={Bot} label="Use style" hasSub onClick={() => setSub(p => p === "style" ? null : "style")} />
          </div>
          {sub === "spaces" && (
            <div className="w-52 rounded-xl py-1 shadow-2xl" style={panelStyle}>
              {spaces.map(sp => {
                const SpIcon = getSpaceIcon(sp.icon);
                return (
                  <button key={sp.id} type="button" onClick={() => handleAddToSpace(sp.id)}
                    className="w-full flex items-center gap-2.5 px-3 py-[6px] text-[13px] text-left transition-colors" style={{ color: "#ccc" }}
                    onMouseOver={e => { e.currentTarget.style.background = hoverBg; }} onMouseOut={e => { e.currentTarget.style.background = "transparent"; }}
                    data-testid={`space-assign-${sp.id}`}>
                    <SpIcon className="w-3.5 h-3.5" style={{ color: sp.color }} />
                    {sp.name}
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
          {sub === "connectors" && (
            <div className="w-60 rounded-xl py-1 shadow-2xl max-h-80 overflow-y-auto" style={panelStyle}>
              {CONNECTORS.map(c => (
                <div key={c.id} className="flex items-center gap-2.5 px-3 py-[7px] transition-colors" style={{ color: C.text }}
                  onMouseOver={e => { e.currentTarget.style.background = hoverBg; }} onMouseOut={e => { e.currentTarget.style.background = "transparent"; }}>
                  <c.icon className="w-4 h-4 shrink-0" style={{ color: "#888" }} /><span className="text-[13px] flex-1">{c.label}</span><Toggle on={connectors[c.id]} onToggle={() => toggleConnector(c.id)} />
                </div>
              ))}
              <Divider /><Row icon={Wrench} label="Manage connectors" onClick={() => { navigate("/customize?tab=connectors"); close(); }} />
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
  const [copied, setCopied] = useState(false);
  const fmtTime = (ts) => new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const handleCopy = () => { navigator.clipboard.writeText(msg.content); setCopied(true); setTimeout(() => setCopied(false), 1500); };
  if (msg.role === "user") {
    return (
      <div className="flex justify-end py-2 px-4 group">
        <div className="max-w-[75%]">
          <div className="rounded-2xl rounded-tr-sm px-4 py-2.5 text-sm whitespace-pre-wrap break-words" style={{ background: "rgba(29,140,248,0.15)", border: "1px solid rgba(29,140,248,0.2)", color: C.text }}>{msg.content}</div>
          <div className="flex items-center justify-end gap-2 mt-1">
            <button onClick={handleCopy} className="opacity-0 group-hover:opacity-60 transition-opacity" data-testid={`copy-msg-${msg.id}`}>
              {copied ? <Check className="w-3 h-3" style={{ color: C.green }} /> : <Copy className="w-3 h-3" style={{ color: "#555" }} />}
            </button>
            <span className="text-[10px]" style={{ color: "#555" }}>{fmtTime(msg.timestamp)}</span>
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="flex gap-3 py-2 px-4 group">
      <div className="w-7 h-7 rounded-full flex items-center justify-center text-sm shrink-0 mt-0.5" style={{ background: "rgba(29,140,248,0.1)", border: "1px solid rgba(29,140,248,0.2)" }}>&#129438;</div>
      <div className="flex-1 min-w-0">
        <div className="rounded-2xl rounded-tl-sm px-4 py-2.5 text-sm" style={{ background: C.surface, border: `1px solid ${C.border}` }}><Markdown content={msg.content} /></div>
        <div className="flex items-center gap-2 mt-1">
          <button onClick={handleCopy} className="opacity-0 group-hover:opacity-60 transition-opacity" data-testid={`copy-msg-${msg.id}`}>
            {copied ? <Check className="w-3 h-3" style={{ color: C.green }} /> : <Copy className="w-3 h-3" style={{ color: "#555" }} />}
          </button>
          <span className="text-[10px]" style={{ color: "#555" }}>{fmtTime(msg.timestamp)}</span>
        </div>
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
    { label: "Connectors", value: activeConnectors, icon: Layers, color: C.green },
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
  const getStatusColor = (s) => { switch (s) { case "running": return "#3b82f6"; case "completed": return C.green; case "failed": return C.red; case "cancelled": return "#888"; default: return C.muted; } };
  
  const runningJobs = jobs.filter(j => j.status === "running");
  const completedJobs = jobs.filter(j => j.status !== "running");

  const [tick, setTick] = useState(0);
  useEffect(() => { const iv = setInterval(() => setTick(t => t + 1), 3000); return () => clearInterval(iv); }, []);

  return (
    <div className="h-full overflow-auto" style={{ color: C.text }}>
      <div className="max-w-3xl mx-auto px-6 py-6">
        <div className="flex items-center justify-between mb-6">
          <div><h1 className="text-2xl font-bold">Jobs</h1><p className="text-sm" style={{ color: C.muted }}>Monitor active and completed tasks</p></div>
          {runningJobs.length > 0 && (
            <span className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full" style={{ background: "rgba(59,130,246,0.1)", color: "#3b82f6", border: "1px solid rgba(59,130,246,0.2)" }}>
              <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: "#3b82f6" }} />{runningJobs.length} active
            </span>
          )}
        </div>
        {runningJobs.length > 0 && (
          <div className="mb-6">
            <h2 className="text-sm font-medium mb-3" style={{ color: C.muted }}>Active</h2>
            <div className="space-y-3">
              {runningJobs.map(job => (
                <div key={job.id} className="p-4 rounded-xl" style={{ background: C.surface, border: "1px solid rgba(59,130,246,0.2)" }}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3"><div className="w-2 h-2 rounded-full animate-pulse" style={{ background: "#3b82f6" }} /><div><div className="font-medium">{job.name}</div><div className="text-xs" style={{ color: C.muted }}>Agent: {job.agent}</div></div></div>
                    <div className="flex items-center gap-2"><span className="text-xs font-mono" style={{ color: "#3b82f6" }}>{Math.min(job.progress + tick, 99)}%</span><Button variant="ghost" size="sm" onClick={() => cancelJob(job.id)} style={{ color: C.red }} data-testid={`cancel-job-${job.id}`}><Square className="w-3.5 h-3.5" /></Button></div>
                  </div>
                  <Progress value={Math.min(job.progress + tick, 99)} className="h-1.5" />
                </div>
              ))}
            </div>
          </div>
        )}
        {completedJobs.length > 0 && (
          <div>
            <h2 className="text-sm font-medium mb-3" style={{ color: C.muted }}>History</h2>
            <div className="space-y-2">
              {completedJobs.map(job => (
                <div key={job.id} className="p-3 rounded-xl flex items-center justify-between" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
                  <div className="flex items-center gap-3">
                    {job.status === "completed" ? <CheckCircle className="w-4 h-4" style={{ color: C.green }} /> : job.status === "failed" ? <XCircle className="w-4 h-4" style={{ color: C.red }} /> : <Clock className="w-4 h-4" style={{ color: C.muted }} />}
                    <div><div className="text-sm">{job.name}</div><div className="text-[11px]" style={{ color: C.muted }}>Agent: {job.agent}</div></div>
                  </div>
                  <span className="text-xs px-2 py-1 rounded-full capitalize" style={{ background: `${getStatusColor(job.status)}20`, color: getStatusColor(job.status) }}>{job.status}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        {jobs.length === 0 && (<div className="text-center py-16"><Briefcase className="w-10 h-10 mx-auto mb-3" style={{ color: "#333" }} /><p className="text-sm" style={{ color: C.muted }}>No jobs yet</p></div>)}
      </div>
    </div>
  );
}

/* ─── Approvals Page ─────────────────────────────────────────────────────────── */
function ApprovalsPage() {
  const { approvals, approveRequest, rejectRequest } = useGateway();
  const getRiskColor = (risk) => { switch (risk) { case "low": return C.green; case "medium": return C.yellow; case "high": return C.red; default: return C.muted; } };
  const getStatusBadge = (status) => { const colors = { pending: { bg: `${C.yellow}20`, color: C.yellow }, approved: { bg: `${C.green}20`, color: C.green }, rejected: { bg: `${C.red}20`, color: C.red } }; return colors[status] || colors.pending; };
  const pendingCount = approvals.filter(a => a.status === "pending").length;
  return (
    <div className="h-full overflow-auto" style={{ color: C.text }}>
      <div className="max-w-3xl mx-auto px-6 py-6">
        <div className="flex items-center justify-between mb-6">
          <div><h1 className="text-2xl font-bold">Approvals</h1><p className="text-sm" style={{ color: C.muted }}>Review and manage agent permission requests</p></div>
          {pendingCount > 0 && (
            <span className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full" style={{ background: "rgba(251,191,36,0.1)", color: "#fbbf24", border: "1px solid rgba(251,191,36,0.2)" }} data-testid="pending-count-badge">
              <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: "#fbbf24" }} />{pendingCount} pending
            </span>
          )}
        </div>
        {approvals.length === 0 ? (
          <div className="text-center py-16"><Shield className="w-10 h-10 mx-auto mb-3" style={{ color: "#333" }} /><p className="text-sm" style={{ color: C.muted }}>No approval requests yet</p></div>
        ) : (
          <div className="space-y-3">
            {approvals.map(approval => (
              <div key={approval.id} className="p-4 rounded-xl" style={{ background: C.surface, border: `1px solid ${C.border}` }} data-testid={`approval-card-${approval.id}`}>
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-3"><Shield className="w-5 h-5" style={{ color: getRiskColor(approval.risk) }} /><div><div className="font-medium">{approval.title}</div><div className="text-sm" style={{ color: C.muted }}>{approval.description}</div></div></div>
                  <span className="text-xs px-2 py-1 rounded-full capitalize" style={getStatusBadge(approval.status)}>{approval.status}</span>
                </div>
                <div className="flex items-center justify-between mt-3">
                  <div className="flex items-center gap-4 text-xs" style={{ color: C.muted }}><span>Agent: {approval.agent}</span><span>Risk: <span style={{ color: getRiskColor(approval.risk) }}>{approval.risk}</span></span></div>
                  {approval.status === "pending" && <div className="flex gap-2"><Button size="sm" onClick={() => approveRequest(approval.id)} style={{ background: C.green }} data-testid={`approve-${approval.id}`}><Check className="w-4 h-4 mr-1" /> Approve</Button><Button size="sm" variant="outline" onClick={() => rejectRequest(approval.id)} style={{ borderColor: C.red, color: C.red }} data-testid={`reject-${approval.id}`}><X className="w-4 h-4 mr-1" /> Reject</Button></div>}
                </div>
              </div>
            ))}
            {pendingCount === 0 && (
              <div className="text-center py-8 mt-4"><CheckCircle className="w-8 h-8 mx-auto mb-2" style={{ color: C.green }} /><p className="text-sm" style={{ color: C.muted }}>All caught up — no pending approvals</p></div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Spaces Page ────────────────────────────────────────────────────────────── */
function SpacesPage() {
  const { spaces, threads, addSpace, deleteSpace, assignThreadToSpace } = useGateway();
  const navigate = useNavigate();
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState("");
  const [selectedSpace, setSelectedSpace] = useState(null);

  const SPACE_ICONS = { FileText, PenTool, Code2, Folder, Briefcase, Globe, Database, Rocket };
  const SPACE_COLORS = ["#3b82f6", "#ec4899", "#22c55e", "#f59e0b", "#8b5cf6", "#06b6d4", "#ef4444", "#84cc16"];

  const handleCreate = () => {
    if (!newName.trim()) return;
    addSpace(newName.trim(), "Folder", SPACE_COLORS[spaces.length % SPACE_COLORS.length]);
    setNewName("");
    setShowNew(false);
  };

  const getSpaceThreads = (spaceId) => threads.filter(t => t.spaceId === spaceId);
  const unassignedThreads = threads.filter(t => !t.spaceId);

  if (selectedSpace) {
    const sp = spaces.find(s => s.id === selectedSpace);
    if (!sp) { setSelectedSpace(null); return null; }
    const spThreads = getSpaceThreads(sp.id);
    const Icon = SPACE_ICONS[sp.icon] || Folder;
    return (
      <div className="h-full flex flex-col" style={{ color: C.text }}>
        <div className="flex items-center gap-3 px-6 py-4" style={{ borderBottom: `1px solid ${C.border}` }}>
          <button onClick={() => setSelectedSpace(null)} className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ color: C.muted }}><ChevronLeft className="w-4 h-4" /></button>
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: sp.color + "20" }}><Icon className="w-4 h-4" style={{ color: sp.color }} /></div>
          <div><div className="font-medium">{sp.name}</div><div className="text-xs" style={{ color: C.muted }}>{spThreads.length} conversation{spThreads.length !== 1 ? "s" : ""}</div></div>
        </div>
        <div className="flex-1 overflow-auto p-6">
          {spThreads.length === 0 ? (
            <div className="text-center py-16"><Folder className="w-10 h-10 mx-auto mb-3" style={{ color: "#333" }} /><p className="text-sm" style={{ color: C.muted }}>No conversations in this space yet</p><p className="text-xs mt-1" style={{ color: "#555" }}>Conversations will auto-save here or you can move them manually</p></div>
          ) : (
            <div className="space-y-2">
              {spThreads.map(t => (
                <button key={t.id} onClick={() => { useGateway.getState().setActiveThread(t.id); navigate("/"); }}
                  className="w-full text-left p-3 rounded-xl transition-colors hover:bg-white/5"
                  style={{ background: C.surface, border: `1px solid ${C.border}` }}>
                  <div className="flex items-center gap-3">
                    <MessageSquare className="w-4 h-4 shrink-0" style={{ color: C.muted }} />
                    <div className="flex-1 min-w-0"><div className="text-sm font-medium truncate">{t.title}</div><div className="text-[11px]" style={{ color: C.muted }}>{new Date(t.createdAt).toLocaleDateString()}</div></div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4" style={{ color: C.text }}>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Spaces</h1>
        <Button className="gap-2" style={{ background: C.accent }} onClick={() => setShowNew(true)} data-testid="new-space-btn"><Plus className="w-4 h-4" /> New Space</Button>
      </div>
      <p className="text-sm" style={{ color: C.muted }}>Organize conversations by project or topic. Threads auto-save based on context.</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {spaces.map(space => {
          const Icon = SPACE_ICONS[space.icon] || Folder;
          const count = getSpaceThreads(space.id).length;
          return (
            <button key={space.id} onClick={() => setSelectedSpace(space.id)}
              className="text-left p-4 rounded-xl cursor-pointer transition-all hover:border-[#444] group"
              style={{ background: C.surface, border: `1px solid ${C.border}` }}>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: space.color + "18" }}>
                  <Icon className="w-5 h-5" style={{ color: space.color }} />
                </div>
                <div>
                  <div className="font-medium">{space.name}</div>
                  <div className="text-xs" style={{ color: C.muted }}>{space.description || `${count} conversation${count !== 1 ? "s" : ""}`}</div>
                </div>
              </div>
            </button>
          );
        })}
        {/* Add space card */}
        {showNew ? (
          <div className="p-4 rounded-xl" style={{ background: C.surface, border: `1px solid ${C.accent}40` }}>
            <input type="text" value={newName} onChange={e => setNewName(e.target.value)} placeholder="Space name..." autoFocus
              onKeyDown={e => { if (e.key === "Enter") handleCreate(); if (e.key === "Escape") setShowNew(false); }}
              className="w-full px-3 py-2 rounded-lg text-sm mb-3" style={{ background: C.surface2, border: `1px solid ${C.border}`, color: C.text }} data-testid="new-space-input" />
            <div className="flex gap-2">
              <Button size="sm" onClick={handleCreate} style={{ background: C.accent }}>Create</Button>
              <Button size="sm" variant="ghost" onClick={() => setShowNew(false)} style={{ color: C.muted }}>Cancel</Button>
            </div>
          </div>
        ) : (
          <button onClick={() => setShowNew(true)} className="p-4 rounded-xl border-dashed flex items-center justify-center transition-colors hover:border-[#444]"
            style={{ border: `2px dashed ${C.border}`, color: C.muted, minHeight: 100 }}>
            <div className="text-center"><Plus className="w-6 h-6 mx-auto mb-1" /><span className="text-sm">Add Space</span></div>
          </button>
        )}
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

/* ─── Settings Page (Claude-style tabs) ───────────────────────────────────────── */
function SettingsPage() {
  const { connectors, toggleConnector, writingStyle, setWritingStyle, webSearchEnabled, setWebSearchEnabled, userProfile, setUserProfile, activeModel, models, theme, setTheme, dataControls, setDataControl, security, setSecurity, mcpServers, addMcpServer, removeMcpServer, apiKeys, addApiKey, removeApiKey, clearAllThreads, threads } = useGateway();
  const [tab, setTab] = useState("general");
  const settingsLocation = useLocation();
  useEffect(() => {
    const params = new URLSearchParams(settingsLocation.search);
    const urlTab = params.get("tab");
    if (urlTab && ["general", "profile", "apps", "data", "security"].includes(urlTab)) setTab(urlTab);
  }, [settingsLocation.search]);
  const [mcpUrl, setMcpUrl] = useState("");
  const [mcpName, setMcpName] = useState("");
  const [showMcpForm, setShowMcpForm] = useState(false);
  const [keyName, setKeyName] = useState("");
  const [keyValue, setKeyValue] = useState("");
  const [showKeyForm, setShowKeyForm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [sessions] = useState([{ id: 1, device: "This device", browser: "Chrome", lastActive: "Now", current: true }, { id: 2, device: "iPhone 16", browser: "Safari", lastActive: "2 hours ago", current: false }]);
  const [showSessions, setShowSessions] = useState(false);

  const TABS = [
    { id: "general", label: "General", icon: Settings },
    { id: "profile", label: "Profile", icon: Users },
    { id: "apps", label: "Connected Apps", icon: Link2 },
    { id: "data", label: "Data Controls", icon: Database },
    { id: "security", label: "Security", icon: ShieldCheck },
  ];

  const handleAddMcp = () => { if (mcpUrl.trim()) { addMcpServer(mcpUrl.trim(), mcpName.trim()); setMcpUrl(""); setMcpName(""); setShowMcpForm(false); } };
  const handleAddKey = () => { if (keyName.trim() && keyValue.trim()) { addApiKey(keyName.trim(), keyValue.trim()); setKeyName(""); setKeyValue(""); setShowKeyForm(false); } };

  return (
    <div className="h-full flex" style={{ color: C.text }}>
      <div className="shrink-0 overflow-auto" style={{ width: 200, borderRight: `1px solid ${C.border}`, background: "#0b0b0b" }}>
        <div className="p-4 pb-2"><h1 className="text-lg font-bold">Settings</h1></div>
        <div className="px-2 pb-4">
          {TABS.map(t => {
            const Icon = t.icon;
            const active = tab === t.id;
            return (
              <button key={t.id} onClick={() => setTab(t.id)} className="w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-[13px] transition-colors"
                style={{ background: active ? "rgba(29,140,248,0.1)" : "transparent", color: active ? C.accent : "#999" }}
                data-testid={`settings-tab-${t.id}`}>
                <Icon className="w-4 h-4" />{t.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-xl">
          {tab === "general" && (
            <div className="space-y-6">
              <h2 className="text-xl font-bold mb-4">General</h2>
              <div className="p-4 rounded-xl space-y-4" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
                <div className="flex items-center justify-between"><span className="text-sm">Theme</span>
                  <div className="flex gap-1">{["Dark", "Light", "System"].map(t => (
                    <button key={t} onClick={() => setTheme(t.toLowerCase())} className="px-3 py-1 rounded text-xs transition-colors"
                      style={{ background: theme === t.toLowerCase() ? C.accent : C.surface2, color: theme === t.toLowerCase() ? "#fff" : C.muted }}
                      data-testid={`theme-${t.toLowerCase()}`}>{t}</button>
                  ))}</div>
                </div>
                <div className="flex items-center justify-between"><span className="text-sm">Language</span><span className="text-sm" style={{ color: C.muted }}>English</span></div>
                <div className="flex items-center justify-between"><span className="text-sm">Web Search</span><Toggle on={webSearchEnabled} onToggle={() => setWebSearchEnabled(!webSearchEnabled)} /></div>
                <div>
                  <label className="block text-sm mb-2">Writing Style</label>
                  <div className="flex gap-2">{["Normal", "Concise", "Formal", "Explanatory"].map(s => (
                    <button key={s} onClick={() => setWritingStyle(s)} className="px-3 py-1.5 rounded text-xs transition-colors" style={{ background: writingStyle === s ? C.accent : C.surface2, color: writingStyle === s ? "#fff" : C.muted }}>{s}</button>
                  ))}</div>
                </div>
                <div>
                  <label className="block text-sm mb-2">Default Model</label>
                  <span className="text-xs" style={{ color: C.muted }}>{activeModel ? models.find(m => m.id === activeModel)?.name || activeModel : "None selected"}</span>
                </div>
              </div>
            </div>
          )}

          {tab === "profile" && (
            <div className="space-y-6">
              <h2 className="text-xl font-bold mb-4">Profile</h2>
              <div className="p-4 rounded-xl space-y-4" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
                <div>
                  <label className="block text-sm mb-1.5">Display Name</label>
                  <input type="text" value={userProfile.name} onChange={e => setUserProfile({ name: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg text-sm" style={{ background: C.surface2, border: `1px solid ${C.border}`, color: C.text, outline: "none" }} data-testid="profile-name-input" />
                </div>
                <div>
                  <label className="block text-sm mb-1.5">Email</label>
                  <input type="email" value={userProfile.email} onChange={e => setUserProfile({ email: e.target.value })} placeholder="meg@example.com"
                    className="w-full px-3 py-2 rounded-lg text-sm" style={{ background: C.surface2, border: `1px solid ${C.border}`, color: C.text, outline: "none" }} />
                </div>
                <div>
                  <label className="block text-sm mb-1.5">Custom Instructions</label>
                  <p className="text-xs mb-2" style={{ color: C.muted }}>Tell OpenClaw about yourself, your preferences, or how you'd like it to respond.</p>
                  <textarea value={userProfile.customInstructions} onChange={e => setUserProfile({ customInstructions: e.target.value })} rows={4} placeholder="e.g., I'm a frontend developer who prefers TypeScript and React..."
                    className="w-full px-3 py-2 rounded-lg text-sm resize-none" style={{ background: C.surface2, border: `1px solid ${C.border}`, color: C.text, outline: "none" }} data-testid="custom-instructions-input" />
                </div>
              </div>
            </div>
          )}

          {tab === "apps" && (
            <div className="space-y-6">
              <h2 className="text-xl font-bold mb-4">Connected Apps</h2>
              <p className="text-sm" style={{ color: C.muted }}>Manage integrations and connectors. Enable only the services you need.</p>
              {/* Desktop Integration toggle */}
              <div className="p-4 rounded-xl" style={{ background: C.surface, border: `1px solid ${connectors.mac && connectors.desktop && connectors.files ? C.accent + "40" : C.border}` }}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: `${C.accent}20` }}><Monitor className="w-5 h-5" style={{ color: C.accent }} /></div>
                    <div>
                      <h3 className="text-sm font-medium">Desktop Integration</h3>
                      <p className="text-xs" style={{ color: C.muted }}>Control desktop, access files, and run commands</p>
                    </div>
                  </div>
                  <Toggle on={connectors.mac && connectors.desktop && connectors.files} onToggle={() => {
                    const on = !(connectors.mac && connectors.desktop && connectors.files);
                    useGateway.getState().setConnectorBatch(["mac", "desktop", "files"], on);
                  }} />
                </div>
                <div className="flex gap-1.5 mt-3 ml-[52px]">
                  {[{id:"mac",l:"Mac Control"},{id:"desktop",l:"Commands"},{id:"files",l:"File Access"}].map(d => (
                    <span key={d.id} className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: connectors[d.id] ? `${C.accent}15` : C.surface2, color: connectors[d.id] ? C.accent : C.muted, border: `1px solid ${connectors[d.id] ? C.accent + "30" : C.border}` }}>{d.l}</span>
                  ))}
                </div>
              </div>
              <div className="p-4 rounded-xl space-y-4" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
                <h3 className="text-sm font-medium">Connectors</h3>
                <div className="space-y-3">
                  {CONNECTORS.map(c => (
                    <div key={c.id} className="flex items-center justify-between py-1">
                      <div className="flex items-center gap-3"><c.icon className="w-4 h-4" style={{ color: connectors[c.id] ? C.green : C.muted }} /><span className="text-sm">{c.label}</span></div>
                      <Toggle on={connectors[c.id]} onToggle={() => toggleConnector(c.id)} />
                    </div>
                  ))}
                </div>
                <Link to="/customize?tab=connectors" className="flex items-center gap-2 text-sm pt-3 mt-1" style={{ color: C.accent, borderTop: `1px solid ${C.border}` }} data-testid="browse-directory-link">
                  Browse all connectors in Directory <ExternalLink className="w-3 h-3" />
                </Link>
              </div>
              <div className="p-4 rounded-xl space-y-3" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
                <h3 className="text-sm font-medium">MCP Servers</h3>
                <p className="text-xs" style={{ color: C.muted }}>Connect remote MCP servers for additional tool access.</p>
                {mcpServers.map(s => (
                  <div key={s.id} className="flex items-center justify-between py-1.5 px-3 rounded-lg" style={{ background: C.surface2 }}>
                    <div><div className="text-sm">{s.name}</div><div className="text-[10px]" style={{ color: C.muted }}>{s.url}</div></div>
                    <button onClick={() => removeMcpServer(s.id)} className="text-xs px-2 py-1 rounded" style={{ color: C.red }}>Remove</button>
                  </div>
                ))}
                {showMcpForm ? (
                  <div className="space-y-2 p-3 rounded-lg" style={{ background: C.surface2 }}>
                    <input type="text" value={mcpName} onChange={e => setMcpName(e.target.value)} placeholder="Server name" className="w-full px-2 py-1.5 rounded text-sm" style={{ background: C.bg, border: `1px solid ${C.border}`, color: C.text, outline: "none" }} />
                    <input type="text" value={mcpUrl} onChange={e => setMcpUrl(e.target.value)} placeholder="wss://mcp-server.example.com" className="w-full px-2 py-1.5 rounded text-sm" style={{ background: C.bg, border: `1px solid ${C.border}`, color: C.text, outline: "none" }}
                      onKeyDown={e => { if (e.key === "Enter") handleAddMcp(); }} data-testid="mcp-url-input" />
                    <div className="flex gap-2">
                      <button onClick={handleAddMcp} className="text-xs px-3 py-1.5 rounded font-medium" style={{ background: C.accent, color: "#fff" }}>Add</button>
                      <button onClick={() => setShowMcpForm(false)} className="text-xs px-3 py-1.5 rounded" style={{ color: C.muted }}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => setShowMcpForm(true)} className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors hover:bg-white/5" style={{ background: C.surface2, border: `1px solid ${C.border}`, color: C.muted }} data-testid="add-mcp-btn">
                    <Plus className="w-4 h-4" /> Add MCP Server
                  </button>
                )}
              </div>
              <div className="p-4 rounded-xl space-y-3" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
                <h3 className="text-sm font-medium">API Keys</h3>
                <p className="text-xs" style={{ color: C.muted }}>Manage API keys for external services.</p>
                {apiKeys.map(k => (
                  <div key={k.id} className="flex items-center justify-between py-1.5 px-3 rounded-lg" style={{ background: C.surface2 }}>
                    <div><div className="text-sm">{k.name}</div><div className="text-[10px] font-mono" style={{ color: C.muted }}>{k.key}</div></div>
                    <button onClick={() => removeApiKey(k.id)} className="text-xs px-2 py-1 rounded" style={{ color: C.red }}>Remove</button>
                  </div>
                ))}
                {showKeyForm ? (
                  <div className="space-y-2 p-3 rounded-lg" style={{ background: C.surface2 }}>
                    <input type="text" value={keyName} onChange={e => setKeyName(e.target.value)} placeholder="Key name (e.g., OpenAI)" className="w-full px-2 py-1.5 rounded text-sm" style={{ background: C.bg, border: `1px solid ${C.border}`, color: C.text, outline: "none" }} />
                    <input type="password" value={keyValue} onChange={e => setKeyValue(e.target.value)} placeholder="sk-..." className="w-full px-2 py-1.5 rounded text-sm" style={{ background: C.bg, border: `1px solid ${C.border}`, color: C.text, outline: "none" }}
                      onKeyDown={e => { if (e.key === "Enter") handleAddKey(); }} data-testid="api-key-input" />
                    <div className="flex gap-2">
                      <button onClick={handleAddKey} className="text-xs px-3 py-1.5 rounded font-medium" style={{ background: C.accent, color: "#fff" }}>Add</button>
                      <button onClick={() => setShowKeyForm(false)} className="text-xs px-3 py-1.5 rounded" style={{ color: C.muted }}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => setShowKeyForm(true)} className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors hover:bg-white/5" style={{ background: C.surface2, border: `1px solid ${C.border}`, color: C.muted }} data-testid="add-key-btn">
                    <Plus className="w-4 h-4" /> Add API Key
                  </button>
                )}
              </div>
            </div>
          )}

          {tab === "data" && (
            <div className="space-y-6">
              <h2 className="text-xl font-bold mb-4">Data Controls</h2>
              <div className="p-4 rounded-xl space-y-4" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
                <div className="flex items-center justify-between"><span className="text-sm">Save conversation history</span><Toggle on={dataControls.saveHistory} onToggle={() => setDataControl("saveHistory", !dataControls.saveHistory)} /></div>
                <div className="flex items-center justify-between"><span className="text-sm">Allow usage for improvement</span><Toggle on={dataControls.usageData} onToggle={() => setDataControl("usageData", !dataControls.usageData)} /></div>
                <div className="flex items-center justify-between"><span className="text-sm">Memory across conversations</span><Toggle on={dataControls.memoryEnabled} onToggle={() => setDataControl("memoryEnabled", !dataControls.memoryEnabled)} /></div>
              </div>
              {showDeleteConfirm ? (
                <div className="p-4 rounded-xl space-y-3" style={{ background: "rgba(239,68,68,0.05)", border: "1px solid rgba(239,68,68,0.3)" }}>
                  <p className="text-sm" style={{ color: C.red }}>Delete all {threads.length} conversations? This cannot be undone.</p>
                  <div className="flex gap-2">
                    <button onClick={() => { clearAllThreads(); setShowDeleteConfirm(false); }} className="px-4 py-2 rounded-lg text-sm font-medium" style={{ background: C.red, color: "#fff" }} data-testid="confirm-delete-btn">Delete all</button>
                    <button onClick={() => setShowDeleteConfirm(false)} className="px-4 py-2 rounded-lg text-sm" style={{ color: C.muted }}>Cancel</button>
                  </div>
                </div>
              ) : (
                <button onClick={() => setShowDeleteConfirm(true)} className="px-4 py-2 rounded-lg text-sm transition-colors hover:bg-red-500/10" style={{ background: "rgba(239,68,68,0.1)", color: C.red, border: "1px solid rgba(239,68,68,0.3)" }} data-testid="delete-conversations-btn">
                  Delete all conversations
                </button>
              )}
            </div>
          )}

          {tab === "security" && (
            <div className="space-y-6">
              <h2 className="text-xl font-bold mb-4">Security</h2>
              <div className="p-4 rounded-xl space-y-4" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
                <div className="flex items-center justify-between"><span className="text-sm">Two-factor authentication</span><Toggle on={security.twoFactor} onToggle={() => setSecurity("twoFactor", !security.twoFactor)} /></div>
                <div className="flex items-center justify-between">
                  <div><span className="text-sm block">Active sessions</span><span className="text-xs" style={{ color: C.muted }}>{sessions.length} active session{sessions.length !== 1 ? "s" : ""}</span></div>
                  <button onClick={() => setShowSessions(!showSessions)} className="text-xs px-3 py-1 rounded transition-colors" style={{ background: C.surface2, color: C.muted }} data-testid="manage-sessions-btn">{showSessions ? "Hide" : "Manage"}</button>
                </div>
                {showSessions && (
                  <div className="space-y-2 pt-2" style={{ borderTop: `1px solid ${C.border}` }}>
                    {sessions.map(s => (
                      <div key={s.id} className="flex items-center justify-between py-2 px-3 rounded-lg" style={{ background: C.surface2 }}>
                        <div>
                          <div className="text-sm flex items-center gap-2">{s.device}{s.current && <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: "rgba(34,197,94,0.15)", color: C.green }}>Current</span>}</div>
                          <div className="text-[11px]" style={{ color: C.muted }}>{s.browser} &middot; {s.lastActive}</div>
                        </div>
                        {!s.current && <button className="text-xs px-2 py-1 rounded" style={{ color: C.red }}>Revoke</button>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Customize Page (Claude-style Directory) ─────────────────────────────── */
function CustomizePage() {
  const [activeTab, setActiveTab] = useState("skills");
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState("All");
  const [showAddForm, setShowAddForm] = useState(false);
  const [addName, setAddName] = useState("");
  const [addDesc, setAddDesc] = useState("");
  const { enabledSkills, toggleSkill, plugins, togglePlugin, connectors, toggleConnector, customSkills, customConnectors, customPlugins, addCustomSkill, addCustomConnector, addCustomPlugin, removeCustomSkill, removeCustomConnector, removeCustomPlugin } = useGateway();
  const location = useLocation();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const urlTab = params.get("tab");
    if (urlTab && ["skills", "connectors", "plugins"].includes(urlTab)) { setActiveTab(urlTab); setSearch(""); setFilterCat("All"); }
  }, [location.search]);

  const TABS = [
    { id: "skills", label: "Skills", icon: Wrench },
    { id: "connectors", label: "Connectors", icon: Link2 },
    { id: "plugins", label: "Plugins", icon: Puzzle },
  ];

  const matchSearch = (item) => !search || item.name.toLowerCase().includes(search.toLowerCase()) || item.desc.toLowerCase().includes(search.toLowerCase());
  const matchCat = (item) => filterCat === "All" || item.category === filterCat;

  const allSkills = [...DIRECTORY_SKILLS, ...customSkills.map(s => ({ ...s, icon: Wrench }))];
  const allConnectors = [...DIRECTORY_CONNECTORS, ...customConnectors.map(c => ({ ...c, icon: Link2 }))];
  const allPlugins = [...DIRECTORY_PLUGINS, ...customPlugins.map(p => ({ ...p, icon: Puzzle }))];

  const allCategories = activeTab === "skills" ? [...SKILL_CATEGORIES, ...(customSkills.length ? ["Custom"] : [])]
    : activeTab === "connectors" ? [...CONNECTOR_CATEGORIES, ...(customConnectors.length ? ["Custom"] : [])]
    : [...PLUGIN_CATEGORIES, ...(customPlugins.length ? ["Custom"] : [])];
  const categories = [...new Set(allCategories)];

  const fSkills = allSkills.filter(s => matchSearch(s) && matchCat(s));
  const fConnectors = allConnectors.filter(c => matchSearch(c) && matchCat(c));
  const fPlugins = allPlugins.filter(p => matchSearch(p) && matchCat(p));

  const handleAdd = () => {
    if (!addName.trim()) return;
    if (activeTab === "skills") addCustomSkill(addName.trim(), addDesc.trim());
    else if (activeTab === "connectors") addCustomConnector(addName.trim(), addDesc.trim());
    else addCustomPlugin(addName.trim(), addDesc.trim());
    setAddName(""); setAddDesc(""); setShowAddForm(false);
  };

  const handleRemoveCustom = (id) => {
    if (activeTab === "skills") removeCustomSkill(id);
    else if (activeTab === "connectors") removeCustomConnector(id);
    else removeCustomPlugin(id);
  };

  const CardEmpty = () => <div className="col-span-2 text-center py-12 text-sm" style={{ color: C.muted }}>No results matching "{search}"</div>;

  const SkillCard = ({ skill }) => {
    const Icon = skill.icon;
    const installed = enabledSkills.includes(skill.id);
    const isCustom = skill.id.startsWith("custom-");
    return (
      <div className="p-4 rounded-xl transition-all hover:border-[#444]"
        style={{ background: C.surface, border: `1px solid ${installed ? C.accent + "40" : C.border}` }}
        data-testid={`skill-card-${skill.id}`}>
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: C.surface2, border: `1px solid ${C.border}` }}>
              <Icon className="w-4 h-4" style={{ color: installed ? C.accent : C.muted }} />
            </div>
            <div>
              <div className="text-sm font-medium">{skill.name}</div>
              <div className="flex items-center gap-1.5 text-[11px]" style={{ color: C.muted }}>
                <span>{skill.provider}</span><span style={{ color: "#444" }}>&bull;</span>
                <span className="flex items-center gap-0.5"><Download className="w-3 h-3" />{skill.downloads}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {isCustom && <button onClick={() => handleRemoveCustom(skill.id)} className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors shrink-0" style={{ color: C.red }}><Trash2 className="w-3.5 h-3.5" /></button>}
            <button onClick={() => toggleSkill(skill.id)} className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors shrink-0"
              style={{ background: installed ? "rgba(29,140,248,0.1)" : C.surface2, border: `1px solid ${installed ? C.accent + "40" : C.border}`, color: installed ? C.accent : C.muted }}
              data-testid={`skill-toggle-${skill.id}`}>
              {installed ? <Settings className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
        <p className="text-xs leading-relaxed" style={{ color: "#777" }}>{skill.desc}</p>
      </div>
    );
  };

  const ConnectorCard = ({ conn }) => {
    const Icon = conn.icon;
    const active = !!connectors[conn.id];
    const isCustom = conn.id.startsWith("custom-");
    return (
      <div className="p-4 rounded-xl transition-all hover:border-[#444]"
        style={{ background: C.surface, border: `1px solid ${active ? C.green + "40" : C.border}` }}
        data-testid={`connector-card-${conn.id}`}>
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: C.surface2, border: `1px solid ${C.border}` }}>
              <Icon className="w-4 h-4" style={{ color: active ? C.green : C.muted }} />
            </div>
            <div>
              <div className="text-sm font-medium flex items-center gap-2">
                {conn.name}
                {conn.badge && <span className="text-[9px] px-1.5 py-0.5 rounded-full" style={{ background: "rgba(139,92,246,0.1)", color: "#a78bfa", border: "1px solid rgba(139,92,246,0.2)" }}>{conn.badge}</span>}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {isCustom && <button onClick={() => handleRemoveCustom(conn.id)} className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors shrink-0" style={{ color: C.red }}><Trash2 className="w-3.5 h-3.5" /></button>}
            <button onClick={() => toggleConnector(conn.id)} className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors shrink-0"
              style={{ background: active ? "rgba(34,197,94,0.1)" : C.surface2, border: `1px solid ${active ? C.green + "40" : C.border}`, color: active ? C.green : C.muted }}
              data-testid={`connector-toggle-${conn.id}`}>
              {active ? <Check className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
        <p className="text-xs leading-relaxed" style={{ color: "#777" }}>{conn.desc}</p>
      </div>
    );
  };

  const PluginCard = ({ plugin }) => {
    const Icon = plugin.icon;
    const installed = plugins.find(p => p.id === plugin.id)?.installed || false;
    const isCustom = plugin.id.startsWith("custom-");
    return (
      <div className="p-4 rounded-xl transition-all hover:border-[#444]"
        style={{ background: C.surface, border: `1px solid ${installed ? C.accent + "40" : C.border}` }}
        data-testid={`plugin-card-${plugin.id}`}>
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: C.surface2, border: `1px solid ${C.border}` }}>
              <Icon className="w-4 h-4" style={{ color: installed ? C.accent : C.muted }} />
            </div>
            <div>
              <div className="text-sm font-medium">{plugin.name}</div>
              <div className="flex items-center gap-1.5 text-[11px]" style={{ color: C.muted }}>
                <span>{plugin.provider}</span><span style={{ color: "#444" }}>&bull;</span>
                <span className="flex items-center gap-0.5"><Download className="w-3 h-3" />{plugin.downloads}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {isCustom && <button onClick={() => handleRemoveCustom(plugin.id)} className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors shrink-0" style={{ color: C.red }}><Trash2 className="w-3.5 h-3.5" /></button>}
            <button onClick={() => togglePlugin(plugin.id)} className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors shrink-0"
              style={{ background: installed ? "rgba(29,140,248,0.1)" : C.surface2, border: `1px solid ${installed ? C.accent + "40" : C.border}`, color: installed ? C.accent : C.muted }}
              data-testid={`plugin-toggle-${plugin.id}`}>
              {installed ? <Check className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
        <p className="text-xs leading-relaxed" style={{ color: "#777" }}>{plugin.desc}</p>
      </div>
    );
  };

  return (
    <div className="h-full flex" style={{ color: C.text }}>
      {/* Left sidebar */}
      <div className="shrink-0 overflow-auto" style={{ width: 180, borderRight: `1px solid ${C.border}`, background: "#0b0b0b" }}>
        <div className="p-4 pb-3">
          <Link to="/" className="flex items-center gap-1.5 text-sm" style={{ color: C.muted }} data-testid="customize-back">
            <ChevronLeft className="w-3.5 h-3.5" /> Customize
          </Link>
        </div>
        <div className="px-2">
          {TABS.map(t => {
            const Icon = t.icon;
            const isActive = activeTab === t.id;
            return (
              <button key={t.id} onClick={() => { setActiveTab(t.id); setSearch(""); setFilterCat("All"); setShowAddForm(false); }}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-[13px] transition-colors"
                style={{ background: isActive ? "rgba(29,140,248,0.1)" : "transparent", color: isActive ? C.text : "#999" }}
                data-testid={`customize-tab-${t.id}`}>
                <Icon className="w-4 h-4" />{t.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Directory content */}
      <div className="flex-1 overflow-auto">
        <div className="max-w-3xl mx-auto px-6 py-6">
          <h1 className="text-2xl font-bold mb-6">Directory</h1>

          {/* Search */}
          <div className="relative mb-4">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: C.muted }} />
            <input type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder={`Search ${activeTab}...`}
              className="w-full pl-11 pr-4 py-3 rounded-xl text-sm"
              style={{ background: C.surface, border: `1px solid ${C.border}`, color: C.text, outline: "none" }}
              data-testid="directory-search" />
          </div>

          {/* Provider badge + filter */}
          <div className="flex items-center justify-between mb-6">
            <span className="text-xs px-3 py-1.5 rounded-full font-medium" style={{ background: C.surface, border: `1px solid ${C.border}`, color: C.text }}>
              OpenClaw & Partners
            </span>
            <div className="flex items-center gap-2">
              {categories.length > 2 && (
                <select value={filterCat} onChange={e => setFilterCat(e.target.value)}
                  className="text-xs px-2.5 py-1.5 rounded-lg appearance-none cursor-pointer"
                  style={{ background: C.surface, border: `1px solid ${C.border}`, color: C.muted, outline: "none" }}
                  data-testid="directory-filter">
                  {categories.map(c => <option key={c} value={c}>{c === "All" ? "Filter by" : c}</option>)}
                </select>
              )}
            </div>
          </div>

          {/* Skills tab */}
          {activeTab === "skills" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4" data-testid="skills-grid">
              {fSkills.map(skill => <SkillCard key={skill.id} skill={skill} />)}
              {fSkills.length === 0 && !showAddForm && <CardEmpty />}
              {/* Add custom skill card */}
              {!showAddForm ? (
                <button onClick={() => setShowAddForm(true)} className="p-4 rounded-xl flex flex-col items-center justify-center transition-colors hover:border-[#444]"
                  style={{ border: `2px dashed ${C.border}`, color: C.muted, minHeight: 100 }} data-testid="add-custom-skill-btn">
                  <Plus className="w-5 h-5 mb-1" /><span className="text-xs">Add custom skill</span>
                </button>
              ) : (
                <div className="p-4 rounded-xl space-y-3" style={{ background: C.surface, border: `1px solid ${C.accent}40` }}>
                  <div className="text-sm font-medium">New custom skill</div>
                  <input type="text" value={addName} onChange={e => setAddName(e.target.value)} placeholder="Skill name (e.g., my-workflow)"
                    className="w-full px-3 py-2 rounded-lg text-sm" style={{ background: C.surface2, border: `1px solid ${C.border}`, color: C.text, outline: "none" }} data-testid="custom-skill-name" />
                  <textarea value={addDesc} onChange={e => setAddDesc(e.target.value)} placeholder="Description..." rows={2}
                    className="w-full px-3 py-2 rounded-lg text-sm resize-none" style={{ background: C.surface2, border: `1px solid ${C.border}`, color: C.text, outline: "none" }} />
                  <div className="flex gap-2">
                    <button onClick={handleAdd} disabled={!addName.trim()} className="text-xs px-3 py-1.5 rounded-lg font-medium" style={{ background: addName.trim() ? C.accent : C.surface2, color: addName.trim() ? "#fff" : "#555" }} data-testid="create-custom-skill-btn">Create</button>
                    <button onClick={() => { setShowAddForm(false); setAddName(""); setAddDesc(""); }} className="text-xs px-3 py-1.5 rounded-lg" style={{ color: C.muted }}>Cancel</button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Connectors tab */}
          {activeTab === "connectors" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4" data-testid="connectors-grid">
              {fConnectors.map(conn => <ConnectorCard key={conn.id} conn={conn} />)}
              {fConnectors.length === 0 && !showAddForm && <CardEmpty />}
              {!showAddForm ? (
                <button onClick={() => setShowAddForm(true)} className="p-4 rounded-xl flex flex-col items-center justify-center transition-colors hover:border-[#444]"
                  style={{ border: `2px dashed ${C.border}`, color: C.muted, minHeight: 100 }} data-testid="add-custom-connector-btn">
                  <Plus className="w-5 h-5 mb-1" /><span className="text-xs">Add custom connector</span>
                </button>
              ) : (
                <div className="p-4 rounded-xl space-y-3" style={{ background: C.surface, border: `1px solid ${C.accent}40` }}>
                  <div className="text-sm font-medium">New custom connector</div>
                  <input type="text" value={addName} onChange={e => setAddName(e.target.value)} placeholder="Connector name"
                    className="w-full px-3 py-2 rounded-lg text-sm" style={{ background: C.surface2, border: `1px solid ${C.border}`, color: C.text, outline: "none" }} data-testid="custom-connector-name" />
                  <textarea value={addDesc} onChange={e => setAddDesc(e.target.value)} placeholder="Description..." rows={2}
                    className="w-full px-3 py-2 rounded-lg text-sm resize-none" style={{ background: C.surface2, border: `1px solid ${C.border}`, color: C.text, outline: "none" }} />
                  <div className="flex gap-2">
                    <button onClick={handleAdd} disabled={!addName.trim()} className="text-xs px-3 py-1.5 rounded-lg font-medium" style={{ background: addName.trim() ? C.accent : C.surface2, color: addName.trim() ? "#fff" : "#555" }} data-testid="create-custom-connector-btn">Create</button>
                    <button onClick={() => { setShowAddForm(false); setAddName(""); setAddDesc(""); }} className="text-xs px-3 py-1.5 rounded-lg" style={{ color: C.muted }}>Cancel</button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Plugins tab */}
          {activeTab === "plugins" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4" data-testid="plugins-grid">
              {fPlugins.map(plugin => <PluginCard key={plugin.id} plugin={plugin} />)}
              {fPlugins.length === 0 && !showAddForm && <CardEmpty />}
              {!showAddForm ? (
                <button onClick={() => setShowAddForm(true)} className="p-4 rounded-xl flex flex-col items-center justify-center transition-colors hover:border-[#444]"
                  style={{ border: `2px dashed ${C.border}`, color: C.muted, minHeight: 100 }} data-testid="add-custom-plugin-btn">
                  <Plus className="w-5 h-5 mb-1" /><span className="text-xs">Add custom plugin</span>
                </button>
              ) : (
                <div className="p-4 rounded-xl space-y-3" style={{ background: C.surface, border: `1px solid ${C.accent}40` }}>
                  <div className="text-sm font-medium">New custom plugin</div>
                  <input type="text" value={addName} onChange={e => setAddName(e.target.value)} placeholder="Plugin name"
                    className="w-full px-3 py-2 rounded-lg text-sm" style={{ background: C.surface2, border: `1px solid ${C.border}`, color: C.text, outline: "none" }} data-testid="custom-plugin-name" />
                  <textarea value={addDesc} onChange={e => setAddDesc(e.target.value)} placeholder="Description..." rows={2}
                    className="w-full px-3 py-2 rounded-lg text-sm resize-none" style={{ background: C.surface2, border: `1px solid ${C.border}`, color: C.text, outline: "none" }} />
                  <div className="flex gap-2">
                    <button onClick={handleAdd} disabled={!addName.trim()} className="text-xs px-3 py-1.5 rounded-lg font-medium" style={{ background: addName.trim() ? C.accent : C.surface2, color: addName.trim() ? "#fff" : "#555" }} data-testid="create-custom-plugin-btn">Create</button>
                    <button onClick={() => { setShowAddForm(false); setAddName(""); setAddDesc(""); }} className="text-xs px-3 py-1.5 rounded-lg" style={{ color: C.muted }}>Cancel</button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Agent Page (Creative/Builder workspace) ──────────────────────────────── */
function AgentPage() {
  const { models, providers, activeModel, status, connectors } = useGateway();
  const [agentInput, setAgentInput] = useState("");
  const [capabilities, setCapabilities] = useState({ imageGen: false, design: false, codeExec: true, webBrowse: false });
  const [agentMessages, setAgentMessages] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [agentMessages, isProcessing]);

  const toggleCap = (key) => setCapabilities(prev => ({ ...prev, [key]: !prev[key] }));

  const handleSend = () => {
    if (!agentInput.trim()) return;
    const activeCaps = Object.entries(capabilities).filter(([, v]) => v).map(([k]) => k);
    setAgentMessages(prev => [...prev, { id: crypto.randomUUID(), role: "user", content: agentInput.trim(), caps: activeCaps }]);
    setAgentInput("");
    setIsProcessing(true);
    setTimeout(() => {
      setAgentMessages(prev => [...prev, { id: crypto.randomUUID(), role: "agent", content: `Working with ${activeCaps.length} active capabilities. Processing your request...`, caps: activeCaps }]);
      setIsProcessing(false);
    }, 2000);
  };

  const capButtons = [
    { key: "imageGen", label: "Image Generation", icon: Image, desc: "Generate images and visuals" },
    { key: "design", label: "Design Creation", icon: Paintbrush, desc: "Create UI/UX designs and layouts" },
    { key: "codeExec", label: "Code Execution", icon: Code2, desc: "Run and test code in sandbox" },
    { key: "webBrowse", label: "Web Browsing", icon: Globe, desc: "Browse and research the web" },
  ];

  const connectedCount = Object.values(connectors).filter(Boolean).length;

  return (
    <div className="h-full flex flex-col" style={{ color: C.text }}>
      {agentMessages.length === 0 ? (
        <div className="flex-1 flex items-center justify-center px-6">
          <div className="w-full max-w-lg">
            <div className="text-center mb-8">
              <div className="w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center" style={{ background: "linear-gradient(135deg, #ec4899, #8b5cf6)", border: "2px solid #333" }}>
                <Sparkles className="w-7 h-7 text-white" />
              </div>
              <h1 className="text-2xl font-bold mb-1">Agent Mode</h1>
              <p className="text-sm" style={{ color: C.muted }}>Creative builder workspace with tool access</p>
            </div>
            <div className="grid grid-cols-2 gap-3 mb-6">
              {capButtons.map(cap => {
                const Icon = cap.icon;
                const on = capabilities[cap.key];
                return (
                  <button key={cap.key} onClick={() => toggleCap(cap.key)}
                    className="p-3 rounded-xl text-left transition-all"
                    style={{ background: on ? `${cap.key === "imageGen" ? "#ec4899" : cap.key === "design" ? "#8b5cf6" : cap.key === "codeExec" ? "#22c55e" : "#3b82f6"}12` : C.surface,
                      border: `1px solid ${on ? (cap.key === "imageGen" ? "#ec4899" : cap.key === "design" ? "#8b5cf6" : cap.key === "codeExec" ? "#22c55e" : "#3b82f6") + "40" : C.border}` }}
                    data-testid={`agent-cap-${cap.key}`}>
                    <div className="flex items-center gap-2 mb-1">
                      <Icon className="w-4 h-4" style={{ color: on ? (cap.key === "imageGen" ? "#ec4899" : cap.key === "design" ? "#8b5cf6" : cap.key === "codeExec" ? "#22c55e" : "#3b82f6") : C.muted }} />
                      <span className="text-sm font-medium" style={{ color: on ? C.text : C.muted }}>{cap.label}</span>
                    </div>
                    <div className="text-[11px]" style={{ color: "#555" }}>{cap.desc}</div>
                  </button>
                );
              })}
            </div>
            {connectedCount === 0 && (
              <Link to="/settings?tab=apps" className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm mb-4" style={{ background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.2)", color: C.yellow }}>
                <AlertCircle className="w-4 h-4" /> Connect apps in Settings for full agent capabilities <ChevronRight className="w-3.5 h-3.5 ml-auto" />
              </Link>
            )}
            <div className="rounded-2xl" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
              <textarea value={agentInput} onChange={e => setAgentInput(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                placeholder="Describe what you want to build or create..." rows={2}
                className="w-full focus:outline-none resize-none text-sm" style={{ background: "transparent", border: "none", color: C.text, padding: "14px 16px 8px" }}
                data-testid="agent-input" />
              <div className="flex items-center justify-between px-3 pb-3">
                <div className="flex items-center gap-1.5">
                  {Object.entries(capabilities).filter(([, v]) => v).map(([k]) => {
                    const cap = capButtons.find(c => c.key === k);
                    if (!cap) return null;
                    const Icon = cap.icon;
                    return <span key={k} className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: C.surface2, color: C.muted }}><Icon className="w-3 h-3" />{cap.label.split(" ")[0]}</span>;
                  })}
                </div>
                <div className="flex items-center gap-2">
                  <ModelSelector models={models} providers={providers} activeModel={activeModel} onSelect={switchModel} />
                  <button onClick={handleSend} disabled={!agentInput.trim()} className="h-8 px-4 rounded-lg text-sm font-medium" style={{ background: agentInput.trim() ? C.accent : C.surface2, color: agentInput.trim() ? "#fff" : "#555" }}
                    data-testid="agent-send-btn">Build</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <>
          <div className="flex-1 overflow-auto px-4 py-6">
            <div className="max-w-2xl mx-auto space-y-4">
              {agentMessages.map(msg => (
                <div key={msg.id} className="flex gap-3">
                  <div className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] shrink-0 mt-0.5"
                    style={{ background: msg.role === "user" ? C.surface2 : "linear-gradient(135deg, #ec4899, #8b5cf6)", border: `1px solid ${msg.role === "user" ? C.border : "#8b5cf640"}` }}>
                    {msg.role === "user" ? "M" : <Sparkles className="w-3.5 h-3.5 text-white" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm leading-relaxed" style={{ color: C.text }}>{msg.content}</div>
                    {msg.caps?.length > 0 && <div className="flex gap-1 mt-1">{msg.caps.map(c => <span key={c} className="text-[9px] px-1.5 py-0.5 rounded" style={{ background: C.surface2, color: C.muted }}>{c}</span>)}</div>}
                  </div>
                </div>
              ))}
              {isProcessing && (
                <div className="flex gap-3"><div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5" style={{ background: "linear-gradient(135deg, #ec4899, #8b5cf6)" }}><Sparkles className="w-3.5 h-3.5 text-white" /></div>
                  <div className="flex items-center gap-2 text-sm"><span className="w-2 h-2 rounded-full animate-pulse" style={{ background: "#8b5cf6" }} /><span style={{ color: C.muted }}>Building...</span></div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>
          </div>
          <div className="px-4 pb-4 pt-2 shrink-0">
            <div className="max-w-2xl mx-auto">
              <div className="rounded-2xl" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
                <textarea value={agentInput} onChange={e => setAgentInput(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                  placeholder="Continue building..." rows={1} className="w-full focus:outline-none resize-none text-sm" style={{ background: "transparent", border: "none", color: C.text, padding: "12px 16px 8px" }} />
                <div className="flex items-center justify-end gap-2 px-3 pb-3">
                  <ModelSelector models={models} providers={providers} activeModel={activeModel} onSelect={switchModel} />
                  <button onClick={handleSend} disabled={!agentInput.trim()} className="h-7 px-3 rounded-lg text-xs font-medium" style={{ background: agentInput.trim() ? C.accent : C.surface2, color: agentInput.trim() ? "#fff" : "#555" }}>Send</button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/* ─── Layout ─────────────────────────────────────────────────────────────────── */
function Layout({ children }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { status, clawStatus, approvals, threads, activeThreadId, createThread, setActiveThread, deleteThread } = useGateway();
  const clawState = clawStatus?.state ?? "Scheduled";
  const pendingApprovals = approvals.filter(a => a.status === "pending").length;
  const activeJobs = useGateway(s => s.jobs.filter(j => j.status === "running").length);
  const currentTab = location.pathname === "/cowork" ? "cowork" : location.pathname === "/code" ? "code" : "chat";
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => { setSidebarOpen(false); }, [location.pathname]);

  const handleNewThread = () => {
    useGateway.getState().saveThreadMessages();
    useGateway.getState().clearMessages();
    useGateway.setState({ activeThreadId: null });
    navigate("/");
  };

  const handleThreadClick = (threadId) => {
    setActiveThread(threadId);
    navigate("/");
  };

  const recentThreads = threads.slice(0, 12);

  return (
    <div className="flex h-screen w-full overflow-hidden" style={{ background: C.bg, color: C.text }}>
      {sidebarOpen && (
        <div className="sidebar-overlay-bg fixed inset-0 bg-black/60 z-40" onClick={() => setSidebarOpen(false)} />
      )}

      <aside className={`sidebar-desktop flex flex-col shrink-0 overflow-hidden ${sidebarOpen ? "sidebar-open" : ""}`} style={{ width: 200, background: "#0f0f0f", borderRight: "1px solid #222" }}>
        <div className="flex items-center gap-2 px-4 py-3.5 cursor-pointer hover:bg-white/5 transition-colors" style={{ borderBottom: "1px solid #222" }}>
          <div className="w-5 h-5 rounded" style={{ background: C.accent }} />
          <span className="text-sm font-medium flex-1" style={{ color: C.text }}>Personal</span>
          <ChevronDown className="w-3.5 h-3.5" style={{ color: "#666" }} />
        </div>
        <div className="flex flex-col gap-0.5 px-2 pt-3 pb-1">
          <button onClick={handleNewThread} className="flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors hover:bg-white/5" style={{ color: "#888" }} data-testid="new-thread-btn"><Plus className="w-4 h-4" />New thread</button>
          {NAV.map(item => {
            const active = location.pathname === item.href;
            const badge = item.badgeKey === "pendingApprovals" ? pendingApprovals : item.badgeKey === "activeJobs" ? activeJobs : null;
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
        {/* Thread history */}
        {recentThreads.length > 0 && (
          <div className="px-2 pt-2 flex-1 overflow-auto" style={{ borderTop: "1px solid #1a1a1a" }}>
            <div className="text-[10px] font-bold uppercase tracking-widest px-3 py-1.5" style={{ color: "#444" }}>Recents</div>
            {recentThreads.map(t => (
              <button key={t.id} onClick={() => handleThreadClick(t.id)}
                className="w-full flex items-center gap-2 px-3 py-1.5 rounded-md text-[12px] transition-colors group"
                style={{ background: t.id === activeThreadId ? "rgba(29,140,248,0.1)" : "transparent", color: t.id === activeThreadId ? C.accent : "#777" }}>
                <MessageSquare className="w-3 h-3 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0 text-left">
                  <span className="truncate block">{t.title}</span>
                  {t.modelId && <span className="truncate block text-[9px]" style={{ color: "#555" }}>{t.modelId.split("/").pop()}</span>}
                </div>
                <X className="w-3 h-3 shrink-0 opacity-0 group-hover:opacity-60 transition-opacity cursor-pointer" onClick={(e) => { e.stopPropagation(); deleteThread(t.id); }} />
              </button>
            ))}
          </div>
        )}
        {recentThreads.length === 0 && <div className="flex-1" />}
        <div className="flex items-center gap-3 px-4 py-3.5" style={{ borderTop: "1px solid #222" }}>
          <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold shrink-0" style={{ background: C.accent, color: "#fff" }}>M</div>
          <div><div className="text-sm font-medium" style={{ color: C.text }}>Meg</div><div className="text-[11px]" style={{ color: C.muted }}>Pro plan</div></div>
        </div>
      </aside>

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
        {streamingMessage && (
          <div className="flex justify-center py-2">
            <button onClick={() => useGateway.getState().stopGenerating()} className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full transition-colors hover:bg-white/5"
              style={{ background: C.surface, border: `1px solid ${C.border}`, color: C.muted }}
              data-testid="stop-generating-btn">
              <Square className="w-3 h-3" /> Stop generating
            </button>
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
        <Route path="/agent" element={<AgentPage />} />
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
