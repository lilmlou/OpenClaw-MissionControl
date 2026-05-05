import React, { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  MessageSquare, Plus, ChevronDown, X, Menu, Package, Settings, Layers,
  CheckCircle2, AlertTriangle, AlertOctagon, Clock, Loader2,
} from "lucide-react";
import { C, NAV, getSpaceIcon, getRuntimeTheme, getRuntimeMeta } from "@/lib/constants";
import { useGateway, selectAgentsHealth, formatHealthDetail } from "@/lib/useGateway";
import { useShallow } from "zustand/react/shallow";

const HEALTH_STYLES = {
  healthy: { color: "#22c55e", icon: CheckCircle2 },
  warning: { color: "#fbbf24", icon: AlertTriangle },
  stalled: { color: "#fb923c", icon: Clock },
  error:   { color: "#ef4444", icon: AlertOctagon },
  loading: { color: "#94a3b8", icon: Loader2 },
};

const tintColor = (hex, alpha) => {
  if (!hex || typeof hex !== "string") return `rgba(255,255,255,${alpha})`;
  if (hex.startsWith("rgba") || hex.startsWith("rgb")) return hex;
  const normalized = hex.replace("#", "");
  if (normalized.length !== 6) return hex;
  const value = parseInt(normalized, 16);
  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

export default function Layout({ children }) {
  const location = useLocation();
  const navigate = useNavigate();
  const {
    status,
    clawStatus,
    approvals,
    threads,
    activeThreadId,
    setActiveThread,
    deleteThread,
    spaces,
  } = useGateway();
  // Single-bot mode — runtime is always 'openclaw'.
  const activeRuntime = "openclaw";
  const clawState = clawStatus?.state ?? "Scheduled";
  const activeJobs = useGateway(s => s.jobs.filter(j => j.status === "running").length);
  const agentsHealth = useGateway(useShallow(selectAgentsHealth));
  const findingsCount = agentsHealth.findingsCount || 0;
  const currentTab = location.pathname === "/qudos" || location.pathname === "/cowork"
    ? "qudos"
    : location.pathname === "/code"
      ? "code"
      : "chat";
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const activeTheme = getRuntimeTheme(activeRuntime);
  const runtimeMeta = getRuntimeMeta(activeRuntime);

  useEffect(() => { setSidebarOpen(false); }, [location.pathname]);

  const handleNewThread = () => {
    useGateway.getState().saveThreadMessages();
    useGateway.setState({ activeThreadId: null, activeModel: null, messages: [] });
    navigate("/");
  };

  const handleThreadClick = (threadId) => {
    setActiveThread(threadId);
    navigate("/");
  };

  const recentThreads = (() => {
    const base = threads.slice(0, 12);
    if (!activeThreadId) return base;
    if (base.some(t => t.id === activeThreadId)) return base;
    const active = threads.find(t => t.id === activeThreadId);
    if (!active) return base;
    return [active, ...base.slice(0, 11)];
  })();
  const navByHref = Object.fromEntries(NAV.map(item => [item.href, item]));
  const interfaceTabs = ["/", "/qudos", "/design", "/projects"];
  const operationsTabs = ["/dashboard", "/system", "/sessions", "/jobs", "/approvals", "/events"];
  const configureTabs = ["/agents", "/customize"];

  const renderNavLink = (href) => {
    const item = navByHref[href] || (href === "/sessions" ? { href, label: "Sessions", icon: Layers } : null);
    if (!item) return null;
    const active = location.pathname === item.href;
    let badge = null;
    let badgeTone = "accent";
    if (item.href === "/jobs") badge = activeJobs;
    else if (item.href === "/agents" && findingsCount > 0) {
      badge = findingsCount;
      badgeTone = agentsHealth.state === "error" ? "red" : agentsHealth.state === "warning" ? "yellow" : "accent";
    }
    const badgeBg = badgeTone === "red"
      ? "rgba(239,68,68,0.2)"
      : badgeTone === "yellow"
        ? "rgba(251,191,36,0.2)"
        : tintColor(activeTheme.accent, 0.2);
    const badgeFg = badgeTone === "red"
      ? "#ef4444"
      : badgeTone === "yellow"
        ? "#fbbf24"
        : activeTheme.accent;

    return (
      <Link key={item.href} to={item.href} className="flex items-center justify-between px-3 py-2 rounded-md text-sm transition-colors"
        style={{ background: active ? tintColor(activeTheme.accent, 0.14) : "transparent", color: active ? activeTheme.accent : activeTheme.text }}>
        <div className="flex items-center gap-2.5"><item.icon className="w-4 h-4" />{item.label}</div>
        {badge > 0 && (
          <span className="flex h-4 min-w-4 px-1 items-center justify-center rounded-full text-[10px] font-semibold"
            style={{ background: badgeBg, color: badgeFg }}>
            {badge}
          </span>
        )}
      </Link>
    );
  };

  return (
    <div className="flex h-screen w-full overflow-hidden" style={{ background: activeTheme.bg, color: activeTheme.text }}>
      {sidebarOpen && (
        <div className="sidebar-overlay-bg fixed inset-0 bg-black/60 z-40" onClick={() => setSidebarOpen(false)} />
      )}

      <aside className={`sidebar-desktop flex flex-col shrink-0 overflow-hidden backdrop-blur-2xl ${sidebarOpen ? "sidebar-open" : ""}`} style={{ width: 200, background: "#0f0f0f", borderRight: `1px solid ${activeTheme.border}` }}>
        <div className="px-4 py-3.5" style={{ borderBottom: `1px solid ${activeTheme.border}` }}>
          <div className="flex items-center gap-2 cursor-pointer hover:bg-white/5 transition-colors">
            <div className="w-5 h-5 rounded" style={{ background: activeTheme.accent, boxShadow: `0 0 18px ${tintColor(activeTheme.accent, 0.45)}` }} />
            <span className="text-sm font-medium flex-1" style={{ color: activeTheme.text }}>Personal</span>
            <ChevronDown className="w-3.5 h-3.5" style={{ color: activeTheme.muted }} />
          </div>
        </div>
        <div className="flex flex-col gap-0.5 px-2 pt-3 pb-1">
          <button onClick={handleNewThread} className="flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors hover:bg-white/5" style={{ color: activeTheme.muted }} data-testid="new-thread-btn"><Plus className="w-4 h-4" />New thread</button>
          <div className="text-[10px] font-bold uppercase tracking-widest px-3 pt-1.5 pb-1" style={{ color: activeTheme.muted, opacity: 0.55 }}>Interface</div>
          {interfaceTabs.map(renderNavLink)}
          <div className="text-[10px] font-bold uppercase tracking-widest px-3 pt-2 pb-1" style={{ color: activeTheme.muted, opacity: 0.55 }}>Operations</div>
          {operationsTabs.map(renderNavLink)}
          <div className="text-[10px] font-bold uppercase tracking-widest px-3 pt-2 pb-1" style={{ color: activeTheme.muted, opacity: 0.55 }}>Configure</div>
          {configureTabs.map(renderNavLink)}
        </div>
        {recentThreads.length > 0 && (
          <div className="px-2 pt-2 flex-1 overflow-auto" style={{ borderTop: `1px solid ${activeTheme.border}` }}>
            <div className="text-[10px] font-bold uppercase tracking-widest px-3 py-1.5" style={{ color: activeTheme.muted, opacity: 0.55 }}>Recents</div>
            {recentThreads.map(t => {
              const threadSpace = t.spaceId ? spaces.find(s => s.id === t.spaceId) : null;
              const SpIcon = threadSpace ? getSpaceIcon(threadSpace.icon) : MessageSquare;
              const iconColor = threadSpace ? threadSpace.color : undefined;
              const isActive = t.id === activeThreadId;
              const borderLeft = threadSpace ? `3px solid ${threadSpace.color}` : "3px solid transparent";
              const bgTint = threadSpace && !isActive ? `${threadSpace.color}08` : isActive ? tintColor(activeTheme.accent, 0.12) : "transparent";
              return (
                <button key={t.id} onClick={() => handleThreadClick(t.id)}
                  className="w-full flex items-center gap-2 px-3 py-1.5 rounded-md text-[12px] transition-colors group"
                  style={{ background: bgTint, color: isActive ? activeTheme.accent : activeTheme.muted, borderLeft }}>
                  <SpIcon className="w-3 h-3 shrink-0 mt-0.5" style={{ color: iconColor || (isActive ? activeTheme.accent : activeTheme.muted) }} />
                  <div className="flex-1 min-w-0 text-left">
                    <span className="truncate block">{t.title}</span>
                    <div className="flex items-center gap-1.5">
                      {t.modelId && <span className="truncate text-[9px]" style={{ color: activeTheme.muted, opacity: 0.7 }}>{t.modelId.split("/").pop()}</span>}
                      {threadSpace && <span className="text-[8px] px-1 rounded" style={{ background: `${threadSpace.color}18`, color: threadSpace.color }}>{threadSpace.name}</span>}
                    </div>
                  </div>
                  <X className="w-3 h-3 shrink-0 opacity-0 group-hover:opacity-60 transition-opacity cursor-pointer" onClick={(e) => { e.stopPropagation(); deleteThread(t.id); }} />
                </button>
              );
            })}
          </div>
        )}
        {recentThreads.length === 0 && <div className="flex-1" />}
        <div className="px-2 pb-2" style={{ borderTop: `1px solid ${activeTheme.border}` }}>
          <Link to="/settings" className="mt-2 flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors"
            style={{ background: location.pathname === "/settings" ? tintColor(activeTheme.accent, 0.12) : "transparent", color: location.pathname === "/settings" ? activeTheme.accent : activeTheme.text }}>
            <Settings className="w-4 h-4" />Settings
          </Link>
        </div>
        <div className="flex items-center gap-3 px-4 py-3.5" style={{ borderTop: `1px solid ${activeTheme.border}` }}>
          <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold shrink-0" style={{ background: activeTheme.accent, color: "#fff", boxShadow: `0 0 22px ${tintColor(activeTheme.accent, 0.35)}` }}>M</div>
          <div><div className="text-sm font-medium" style={{ color: activeTheme.text }}>Meg</div><div className="text-[11px]" style={{ color: activeTheme.muted }}>Pro plan</div></div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="h-12 flex items-center justify-between px-4 shrink-0 backdrop-blur-xl" style={{ borderBottom: `1px solid ${activeTheme.border}`, background: activeTheme.bg }}>
          <div className="flex items-center gap-2" style={{ minWidth: 80 }}>
            <button className="hamburger-btn w-8 h-8 items-center justify-center rounded-lg" style={{ color: activeTheme.muted, display: "none" }} onClick={() => setSidebarOpen(v => !v)} data-testid="sidebar-toggle">
              <Menu className="w-5 h-5" />
            </button>
          </div>
          <div className="flex items-center gap-1">
            {["Chat", "Qudos", "Code"].map(tab => {
              const isActive = currentTab === tab.toLowerCase();
              return (
                <Link key={tab} to={tab === "Chat" ? "/" : `/${tab.toLowerCase()}`}
                  className="px-3.5 py-1 rounded-md text-[13px] font-medium transition-colors"
                  style={{ background: isActive ? tintColor(activeTheme.accent, 0.12) : "transparent", color: isActive ? activeTheme.accent : activeTheme.muted }}>
                  {tab}
                </Link>
              );
            })}
          </div>
          <div className="flex items-center justify-end gap-2 text-[12px]" style={{ color: activeTheme.muted, minWidth: 180 }}>
            <span className="hidden sm:inline text-[11px] uppercase tracking-wide">{runtimeMeta.label}</span>

            {/* Gateway connection dot — separate from agents health */}
            <div className="relative flex h-2 w-2" title={`Gateway ${status}`}>
              {status === "connected" ? (
                <>
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ background: activeTheme.green }} />
                  <span className="relative inline-flex rounded-full h-2 w-2" style={{ background: activeTheme.green }} />
                </>
              ) : (
                <span className="relative inline-flex rounded-full h-2 w-2 animate-pulse" style={{ background: activeTheme.yellow }} />
              )}
            </div>

            {/* Agents health pill — links to /agents */}
            {(() => {
              // Derive wall-clock dependent fields here, NOT in the selector,
              // so Zustand's shallow equality stays stable between renders.
              const live = formatHealthDetail(agentsHealth);
              const liveState = live.state || agentsHealth.state;
              const styleDef = HEALTH_STYLES[liveState] || HEALTH_STYLES.loading;
              const Icon = styleDef.icon;
              const tip = live.detail ? `${agentsHealth.label} — ${live.detail}` : agentsHealth.label;
              return (
                <Link
                  to="/agents"
                  className="hidden sm:inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-[11px] font-medium transition-colors hover:opacity-90"
                  style={{
                    background: `${styleDef.color}1f`,
                    color: styleDef.color,
                    border: `1px solid ${styleDef.color}40`,
                  }}
                  title={tip}
                  data-testid="agents-health-pill"
                >
                  <Icon className={`w-3 h-3 ${agentsHealth.state === "loading" ? "animate-spin" : ""}`} />
                  <span>{agentsHealth.label}</span>
                  {agentsHealth.runningCount > 0 && (
                    <span className="text-[10px] opacity-80">· {agentsHealth.runningCount} running</span>
                  )}
                </Link>
              );
            })()}
          </div>
        </header>
        <div className="flex-1 overflow-hidden relative">{children}</div>
      </main>
    </div>
  );
}
