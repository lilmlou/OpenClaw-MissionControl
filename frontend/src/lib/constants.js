import {
  MessageSquare, Monitor, Briefcase, Settings, Telescope, Layers, Wrench,
  FolderOpen, Globe, Eye, Brain, Zap, Radio, Rocket, Bot,
  MessageCircle, Code2, Search, BarChart3, FolderKanban, Cloud, Box,
  Database, FileText, Calendar, ListTodo, Mail, Terminal, AlertTriangle, ShieldAlert,
  Palette, Hash, Pencil, CreditCard, Paintbrush, Shield, LayoutDashboard,
  Package, Sparkles, FileCode, NotebookPen, GitBranch, Link2, Grid3X3,
  Timer, Receipt, ClipboardList, Presentation, FolderSync, FileSpreadsheet,
  FileSearch, PenTool, MessageSquareText, Image, Film, BookOpen, Users,
  Table, Smartphone, Music, Camera, Video, Map, Chrome, Play, Clapperboard,
} from "lucide-react";

/* ─── Runtime + Design tokens ───────────────────────────────────────────────── */
// Single-bot mode. Hermes/Meta runtimes removed from UI 2026-05-05.
// Backend chat.message frames still carry runtime: 'openclaw' for compatibility.
export const DEFAULT_RUNTIME = "openclaw";

export const RUNTIME_META = {
  openclaw: {
    id: "openclaw",
    label: "OpenClaw",
    title: "Mission Control",
    assistantName: "OpenClaw",
    placeholder: "Message OpenClaw...",
    statusLabel: "Mission",
  },
};

export const RUNTIME_THEMES = {
  openclaw: {
    bg: "#0a0a0a",
    surface: "#141414",
    surface2: "#1a1a1a",
    accent: "#ff304e",
    text: "#f5f5f5",
    muted: "#b78b92",
    border: "#3a1d24",
    green: "#22c55e",
    yellow: "#fbbf24",
    red: "#ff304e",
    orange: "#ff6a3d",
  },
};

export const RUNTIME_BACKGROUNDS = {
  openclaw: {
    mode: "image",
    image: "/813a2b5f-2185-438b-b547-9e13ee28e8ea.jpg",
    position: "center center",
    size: "cover",
    overlay: "linear-gradient(180deg, rgba(2, 8, 20, 0.72) 0%, rgba(5, 9, 20, 0.78) 42%, rgba(5, 8, 18, 0.88) 100%)",
    accentGlow: "rgba(255, 48, 78, 0.18)",
  },
};

export const RUNTIME_CHROME = {
  openclaw: {
    panel: "rgba(22, 12, 16, 0.80)",
    panelAlt: "rgba(30, 15, 20, 0.84)",
    panelBorder: "rgba(255, 48, 78, 0.22)",
    nav: "rgba(16, 8, 12, 0.88)",
    sidebar: "rgba(14, 6, 10, 0.92)",
    textMuted: "#c49aa2",
    glow: "rgba(255, 48, 78, 0.30)",
  },
};

/* Keep these fixed for legacy toggle controls (Research/Skills/etc.) */
export const ORIGINAL_FRONTEND_THEME = Object.freeze({
  accent: "#1d8cf8",
  orange: "#f97316",
  green: "#22c55e",
  yellow: "#fbbf24",
  muted: "#888",
  border: "#222",
  surface2: "#1a1a1a",
  text: "#f5f5f5",
});

export const getRuntimeTheme = (runtime) => RUNTIME_THEMES[runtime] || RUNTIME_THEMES[DEFAULT_RUNTIME];
export const getRuntimeMeta = (runtime) => RUNTIME_META[runtime] || RUNTIME_META[DEFAULT_RUNTIME];
export const getRuntimeBackground = (runtime) => RUNTIME_BACKGROUNDS[runtime] || RUNTIME_BACKGROUNDS[DEFAULT_RUNTIME];
export const getRuntimeChrome = (runtime) => RUNTIME_CHROME[runtime] || RUNTIME_CHROME[DEFAULT_RUNTIME];

/* Backward-compatible default tokens for existing OpenClaw shell */
export const C = RUNTIME_THEMES[DEFAULT_RUNTIME];

/* ─── Capability Icons ──────────────────────────────────────────────────────── */
export const CAP_DEFS = [
  { key: "vision", Icon: Eye, label: "Vision" },
  { key: "coding", Icon: Code2, label: "Coding" },
  { key: "tools", Icon: Wrench, label: "Tools" },
  { key: "files", Icon: FileText, label: "Files" },
  { key: "reasoning", Icon: Brain, label: "Reasoning" },
  { key: "fast", Icon: Zap, label: "Fast" },
];

export const CAP_ICONS = CAP_DEFS.map(d => ({ key: d.key, icon: d.Icon, label: d.label }));

/* ─── Space Icon Map (single source of truth) ─────────────────────────────── */
export const SPACE_ICON_MAP = {
  FileText, PenTool, Code2, Paintbrush, FolderOpen, Briefcase,
  Globe, Layers, Database, Rocket, Folder: FolderOpen,
};
export const getSpaceIcon = (iconName) => SPACE_ICON_MAP[iconName] || FolderOpen;

/* ─── Navigation ─────────────────────────────────────────────────────────────── */
export const NAV = [
  { href: "/", label: "Chat", icon: MessageSquare },
  { href: "/design", label: "Design", icon: Sparkles },
  { href: "/projects", label: "Projects", icon: Grid3X3 },
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/qudos", label: "Qudos", icon: Monitor },
  { href: "/jobs", label: "Jobs", icon: Briefcase },
  { href: "/approvals", label: "Approvals", icon: ShieldAlert },
  { href: "/events", label: "Events", icon: Terminal },
  { href: "/agents", label: "Agents", icon: Users },
  { href: "/customize", label: "Customize", icon: Palette },
  { href: "/settings", label: "Settings", icon: Settings },
];

export const CONNECTORS = [
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

export const DESKTOP_APP_GROUPS = [
  {
    id: "adobe", name: "Adobe", icon: Paintbrush, color: "#ff0000",
    apps: [
      { id: "adobe-photoshop", label: "Photoshop", icon: Image },
      { id: "adobe-illustrator", label: "Illustrator", icon: PenTool },
      { id: "adobe-indesign", label: "InDesign", icon: FileText },
      { id: "adobe-premiere", label: "Premiere Pro", icon: Film },
      { id: "adobe-aftereffects", label: "After Effects", icon: Sparkles },
      { id: "adobe-xd", label: "XD", icon: Palette },
      { id: "adobe-lightroom", label: "Lightroom", icon: Camera },
      { id: "adobe-acrobat", label: "Acrobat", icon: FileText },
    ],
  },
  {
    id: "microsoft", name: "Microsoft", icon: Monitor, color: "#00a4ef",
    apps: [
      { id: "ms-word", label: "Word", icon: FileText },
      { id: "ms-excel", label: "Excel", icon: Table },
      { id: "ms-powerpoint", label: "PowerPoint", icon: Presentation },
      { id: "ms-outlook", label: "Outlook", icon: Mail },
      { id: "ms-teams", label: "Teams", icon: Users },
      { id: "ms-onenote", label: "OneNote", icon: BookOpen },
      { id: "ms-vscode", label: "VS Code", icon: Code2 },
    ],
  },
  {
    id: "google", name: "Google", icon: Globe, color: "#4285f4",
    apps: [
      { id: "google-docs", label: "Docs", icon: FileText },
      { id: "google-sheets", label: "Sheets", icon: Table },
      { id: "google-slides", label: "Slides", icon: Presentation },
      { id: "google-drive", label: "Drive", icon: FolderOpen },
      { id: "google-calendar", label: "Calendar", icon: Calendar },
      { id: "google-chrome", label: "Chrome", icon: Globe },
      { id: "google-meet", label: "Meet", icon: Video },
    ],
  },
  {
    id: "other", name: "Other Apps", icon: Smartphone, color: "#888",
    apps: [
      { id: "other-spotify", label: "Spotify", icon: Music },
      { id: "other-discord", label: "Discord", icon: MessageCircle },
      { id: "other-zoom", label: "Zoom", icon: Video },
      { id: "other-terminal", label: "Terminal", icon: Terminal },
      { id: "other-finder", label: "Finder", icon: FolderOpen },
    ],
  },
];

export const SKILLS = ["deep-research", "code-review", "web-scraper", "file-manager", "task-scheduler", "mcp-builder", "slack-gif-creator", "canvas-design"];

/* ─── Cowork Task Templates (User prompts to OpenClaw) ─────────────────────── */
export const COWORK_TASKS = [
  { id: 1, icon: Timer, title: "Schedule a recurring task", prompt: "I need to set up a recurring task. I'll tell you what it is and how often it should run. Ask me anything unclear, then configure the schedule and confirm before activating.", category: "schedule", tags: ["Automation"] },
  { id: 2, icon: Mail, title: "Create daily briefing", prompt: "I want a daily briefing that pulls from my connected tools \u2014 Slack, email, calendar \u2014 every morning at 8am. I'll tell you what to include. Ask follow-ups, draft the format, and wait for my approval before scheduling.", category: "schedule", tags: ["Productivity"] },
  { id: 3, icon: FolderSync, title: "Organize my files", prompt: "I want to organize my files. I'll point you at the folder and tell you what needs organizing. Follow up on anything that's unclear, then scan everything, propose a plan with categories and naming conventions, and wait for my go-ahead before moving anything.", category: "organize", tags: [] },
  { id: 4, icon: FileText, title: "Turn documents into a report", prompt: "I have a set of documents I need turned into a polished report. I'll share the files or point you to a folder. Read through everything, ask what format and tone I want, then draft it for my review.", category: "create", tags: ["Documents"] },
  { id: 5, icon: FileSpreadsheet, title: "Build a spreadsheet", prompt: "I need to build a spreadsheet to track some data. I'll describe what I'm working with and what I need to see. Ask clarifying questions, then set up the structure and formulas for me to review.", category: "create", tags: ["Data"] },
  { id: 6, icon: Receipt, title: "Turn receipts into spreadsheet", prompt: "I have a bunch of receipts I need organized into a spreadsheet. I'll share them or tell you which folder they're in. Extract the data, organize it by date and category, and show me the result before finalizing.", category: "analyze", tags: ["Data", "Finance"] },
  { id: 7, icon: Database, title: "Write optimized SQL query", prompt: "I need an optimized SQL query. I'll describe my database schema and what data I need. Ask about edge cases or performance requirements, then write the query and explain your reasoning.", category: "analyze", tags: ["Data", "Engineering"] },
  { id: 8, icon: Presentation, title: "Create a presentation", prompt: "I want to create a presentation. I'll tell you the topic, audience, and key points. Ask about style, length, and any specific requirements, then build out the slides for my review \u2014 don't finalize until I approve the structure.", category: "create", tags: [] },
  { id: 9, icon: ClipboardList, title: "Prepare a report", prompt: "I need a report prepared. I'll give you the subject and point you at the sources. Ask about scope and format, pull together the findings, and draft it section by section for me to review.", category: "create", tags: ["Documents"] },
  { id: 10, icon: BarChart3, title: "Create data visualization", prompt: "I need a data visualization built. I'll share the data and tell you what insights I'm looking for. Ask what chart types work best, then create the visualization and let me iterate on it.", category: "create", tags: ["Data"] },
  { id: 11, icon: Telescope, title: "Deep research", prompt: "I need comprehensive research on a topic. I'll tell you what I'm looking into and what angle matters. Go deep \u2014 synthesize from multiple sources, surface the key findings, and organize everything so I can act on it.", category: "analyze", tags: ["Research"] },
  { id: 12, icon: NotebookPen, title: "Synthesize research notes", prompt: "I have a bunch of research notes that need synthesizing into key insights. I'll point you at the folder. Read through everything, identify the themes, and draft a clean summary with the most important takeaways.", category: "analyze", tags: ["Research"] },
  { id: 13, icon: Search, title: "Search all sources", prompt: "I'm looking for something across all my connected sources \u2014 files, Slack, email, the web. I'll tell you what I need. Search everywhere, rank the results by relevance, and surface the best matches.", category: "analyze", tags: ["Enterprise search"] },
  { id: 14, icon: PenTool, title: "Polish rough notes", prompt: "I have rough notes that need polishing into a clean document. I'll share them or point you to the file. Clean up the language, improve the structure, and keep my voice \u2014 show me the draft before finalizing.", category: "create", tags: [] },
  { id: 15, icon: MessageSquareText, title: "Write meeting follow-up", prompt: "I need a meeting follow-up email written. I'll give you the key points and action items from the meeting. Draft something clear and professional, and let me review before sending.", category: "communicate", tags: [] },
  { id: 16, icon: Code2, title: "Build a web app", prompt: "I want to build a web app. I'll describe what it should do and how it should look. Ask about tech stack preferences, walk me through the architecture, then build it out step by step \u2014 checking in at each milestone.", category: "create", tags: ["Engineering"] },
  { id: 17, icon: GitBranch, title: "Code review checklist", prompt: "I need a code review checklist tailored for my team. I'll tell you what languages, frameworks, and standards we use. Ask about our priorities, then create a thorough checklist I can share with the team.", category: "create", tags: ["Engineering"] },
  { id: 18, icon: Globe, title: "Automate browser task", prompt: "I have a browser task I need automated. I'll describe the website and the actions I repeat. Figure out the best approach, ask about edge cases, then build the automation and test it before I run it.", category: "create", tags: ["Automation"] },
  { id: 19, icon: FileSearch, title: "Audit accessibility", prompt: "I need an accessibility audit on my design or website. I'll share a URL or screenshots. Run through WCAG guidelines, flag the issues by severity, and give me actionable fixes for each one.", category: "analyze", tags: ["Design"] },
  { id: 20, icon: ListTodo, title: "Create launch checklist", prompt: "I'm launching something and need a comprehensive checklist. I'll tell you what I'm launching and the timeline. Ask about my team, dependencies, and risks, then build out the checklist in priority order.", category: "organize", tags: ["Product management"] },
  { id: 21, icon: Calendar, title: "Plan a trip", prompt: "I want to plan a trip. I'll tell you where, when, and what I'm into. Ask about budget, travel style, and must-dos, then put together an itinerary for me to customize.", category: "organize", tags: [] },
];

export const COWORK_CATEGORIES = [
  { id: "all", label: "All", icon: Grid3X3 },
  { id: "schedule", label: "Schedule", icon: Timer },
  { id: "create", label: "Create", icon: Sparkles },
  { id: "analyze", label: "Analyze", icon: Search },
  { id: "organize", label: "Organize", icon: FolderKanban },
  { id: "communicate", label: "Communicate", icon: MessageSquareText },
];

/* ─── Directory Data (Customize \u2014 Skills / Connectors / Plugins catalog) \u2500\u2500\u2500\u2500\u2500 */
export const DIRECTORY_SKILLS = [
  { id: "deep-research", name: "/deep-research", provider: "OpenClaw", downloads: "134.7K", desc: "Comprehensive multi-source research with synthesis and citation tracking.", icon: Telescope, category: "Research" },
  { id: "canvas-design", name: "/canvas-design", provider: "OpenClaw", downloads: "145.2K", desc: "Create beautiful visual art in .png and .pdf documents using design philosophy.", icon: Paintbrush, category: "Design" },
  { id: "web-artifacts-builder", name: "/web-artifacts-builder", provider: "OpenClaw", downloads: "92.2K", desc: "Suite of tools for creating multi-component HTML artifacts using modern frontend tech.", icon: Globe, category: "Development" },
  { id: "mcp-builder", name: "/mcp-builder", provider: "OpenClaw", downloads: "75.3K", desc: "Guide for creating high-quality MCP servers that enable LLMs to interact with tools.", icon: Wrench, category: "Development" },
  { id: "code-review", name: "/code-review", provider: "OpenClaw", downloads: "89.4K", desc: "Structured code review with best practices, security checks, and performance analysis.", icon: FileCode, category: "Development" },
  { id: "theme-factory", name: "/theme-factory", provider: "OpenClaw", downloads: "72.4K", desc: "Toolkit for styling artifacts with a theme \u2014 slides, docs, reportings, landing pages.", icon: Palette, category: "Design" },
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

export const DIRECTORY_CONNECTORS = [
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

export const DIRECTORY_PLUGINS = [
  { id: "productivity-suite", name: "Productivity", provider: "OpenClaw", downloads: "469.9K", desc: "Manage tasks, plan your day, and build up memory of important context about your work.", icon: Briefcase, category: "Workflow" },
  { id: "design-suite", name: "Design", provider: "OpenClaw", downloads: "423.5K", desc: "Accelerate design workflows \u2014 critique, design system management, UX writing, accessibility audits.", icon: Paintbrush, category: "Creative" },
  { id: "marketing-suite", name: "Marketing", provider: "OpenClaw", downloads: "359K", desc: "Create content, plan campaigns, and analyze performance across marketing channels.", icon: BarChart3, category: "Workflow" },
  { id: "data-suite", name: "Data", provider: "OpenClaw", downloads: "343.1K", desc: "Write SQL, explore datasets, and generate insights faster. Build visualizations and dashboards.", icon: Database, category: "Tools" },
  { id: "engineering-suite", name: "Engineering", provider: "OpenClaw", downloads: "324.9K", desc: "Streamline engineering workflows \u2014 standups, code review, architecture decisions, incident response.", icon: Code2, category: "Tools" },
  { id: "finance-suite", name: "Finance", provider: "OpenClaw", downloads: "296.3K", desc: "Streamline finance and accounting workflows, from journal entries to financial statements.", icon: CreditCard, category: "Workflow" },
  { id: "product-mgmt", name: "Product management", provider: "OpenClaw", downloads: "271.4K", desc: "Write feature specs, plan roadmaps, and synthesize user research faster.", icon: FolderKanban, category: "Workflow" },
  { id: "operations-suite", name: "Operations", provider: "OpenClaw", downloads: "254.4K", desc: "Optimize business operations \u2014 vendor management, process docs, change management.", icon: Layers, category: "Workflow" },
  { id: "legal-suite", name: "Legal", provider: "OpenClaw", downloads: "242.8K", desc: "Contract review, compliance checks, legal research, and document drafting.", icon: Shield, category: "Workflow" },
  { id: "sales-suite", name: "Sales", provider: "OpenClaw", downloads: "231.3K", desc: "Pipeline management, outreach templates, CRM workflows, and sales analytics.", icon: Rocket, category: "Workflow" },
];

export const SKILL_CATEGORIES = ["All", ...new Set(DIRECTORY_SKILLS.map(s => s.category))];
export const CONNECTOR_CATEGORIES = ["All", ...new Set(DIRECTORY_CONNECTORS.map(c => c.category))];
export const PLUGIN_CATEGORIES = ["All", ...new Set(DIRECTORY_PLUGINS.map(p => p.category))];
