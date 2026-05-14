import React, { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  MessageSquare, Plus, ChevronDown, X, Menu, Package, Settings, Layers,
  CheckCircle2, AlertTriangle, AlertOctagon, Clock, Loader2,
} from "lucide-react";
import { C, NAV, getSpaceIcon, getRuntimeTheme, getRuntimeMeta } from "@/lib/constants";
import { useGateway, selectAgentsHealth, formatHealthDetail } from "@/lib/useGateway";
import { useShallow } from "zustand/react/shallow";
import StatusBar from "@/components/layout/StatusBar";
import ActivityPane from "@/components/layout/ActivityPane";
import BlockersBanner from "@/components/layout/BlockersBanner";
import DoctorFixBanner from "@/components/layout/DoctorFixBanner";

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
  const operationsTabs = ["/dashboard", "/brain", "/insights", "/system", "/sessions", "/jobs", "/cron", "/activity", "/costs", "/standup", "/audit", "/files", "/approvals", "/events"];
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
    const badgeBg =
      badgeTone === "red" ? "var(--mc-err-soft)"
      : badgeTone === "yellow" ? "var(--mc-warn-soft)"
      : "var(--mc-accent-soft)";
    const badgeFg =
      badgeTone === "red" ? "var(--mc-err)"
      : badgeTone === "yellow" ? "var(--mc-warn)"
      : "var(--mc-accent)";

    return (
      <Link
        key={item.href}
        to={item.href}
        className="group flex items-center justify-between rounded-md transition-all"
        style={{
          padding: "7px 10px",
          fontSize: 13,
          fontWeight: active ? 600 : 500,
          background: active ? "var(--mc-accent-soft)" : "transparent",
          color: active ? "var(--mc-accent)" : "var(--mc-fg-1)",
          letterSpacing: 0.1,
          borderLeft: active
            ? "2px solid var(--mc-accent)"
            : "2px solid transparent",
          paddingLeft: active ? 10 : 12,
        }}
        onMouseEnter={(e) => {
          if (!active) {
            e.currentTarget.style.background = "var(--mc-bg-2)";
            e.currentTarget.style.color = "var(--mc-fg)";
          }
        }}
        onMouseLeave={(e) => {
          if (!active) {
            e.currentTarget.style.background = "transparent";
            e.currentTarget.style.color = "var(--mc-fg-1)";
          }
        }}
      >
        <div className="flex items-center gap-2.5">
          <item.icon className="w-4 h-4" strokeWidth={1.75} />
          {item.label}
        </div>
        {badge > 0 && (
          <span
            className="flex h-[18px] min-w-[18px] px-1.5 items-center justify-center rounded-full"
            style={{
              background: badgeBg,
              color: badgeFg,
              fontSize: 10,
              fontWeight: 600,
              border: `1px solid ${badgeFg}33`,
            }}
          >
            {badge}
          </span>
        )}
      </Link>
    );
  };

  return (
    <div
      className="flex h-screen w-full overflow-hidden"
      style={{
        background: "var(--mc-bg)",
        color: "var(--mc-fg)",
        fontFamily: "var(--mc-font-sans)",
      }}
    >
      {sidebarOpen && (
        <div className="sidebar-overlay-bg fixed inset-0 bg-black/60 z-40" onClick={() => setSidebarOpen(false)} />
      )}

      <aside
        className={`sidebar-desktop flex flex-col shrink-0 overflow-hidden ${sidebarOpen ? "sidebar-open" : ""}`}
        style={{
          width: 224,
          background: "var(--mc-bg-1)",
          borderRight: "1px solid var(--mc-line)",
        }}
      >
        {/* Brand header */}
        <div
          className="px-4 py-4 cursor-pointer"
          style={{ borderBottom: "1px solid var(--mc-line)" }}
        >
          <div className="flex items-center gap-2.5">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{
                background:
                  "linear-gradient(135deg, var(--mc-accent) 0%, var(--mc-accent-hover) 100%)",
                boxShadow: "0 0 20px var(--mc-accent-glow)",
              }}
            >
              <span
                style={{
                  fontFamily: "var(--mc-font-display)",
                  fontWeight: 700,
                  fontSize: 13,
                  letterSpacing: -0.5,
                  color: "var(--mc-accent-fg)",
                }}
              >
                M
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <div
                style={{
                  fontFamily: "var(--mc-font-display)",
                  fontSize: 15,
                  fontWeight: 500,
                  letterSpacing: -0.2,
                  color: "var(--mc-accent)",
                  lineHeight: 1.1,
                }}
              >
                Mietorè
              </div>
              <div
                style={{
                  fontSize: 9,
                  color: "var(--mc-fg-3)",
                  letterSpacing: 1.5,
                  textTransform: "uppercase",
                  marginTop: 2,
                }}
              >
                The Sovereign Agent
              </div>
            </div>
            <ChevronDown className="w-3.5 h-3.5" style={{ color: "var(--mc-fg-2)" }} />
          </div>
        </div>
        <div className="flex flex-col gap-[2px] px-2 pt-3 pb-1">
          <button
            onClick={handleNewThread}
            className="flex items-center gap-2.5 rounded-md transition-all"
            style={{
              padding: "8px 12px",
              marginBottom: 4,
              fontSize: 13,
              fontWeight: 500,
              color: "var(--mc-accent-fg)",
              background:
                "linear-gradient(135deg, var(--mc-accent) 0%, var(--mc-accent-hover) 100%)",
              boxShadow: "0 0 14px var(--mc-accent-glow)",
              letterSpacing: 0.2,
            }}
            data-testid="new-thread-btn"
          >
            <Plus className="w-4 h-4" strokeWidth={2.25} />
            New thread
          </button>

          <SectionLabel>Interface</SectionLabel>
          {interfaceTabs.map(renderNavLink)}

          <SectionLabel>Operations</SectionLabel>
          {operationsTabs.map(renderNavLink)}

          <SectionLabel>Configure</SectionLabel>
          {configureTabs.map(renderNavLink)}
        </div>
        {recentThreads.length > 0 && (
          <div
            className="px-2 pt-2 flex-1 overflow-auto"
            style={{ borderTop: "1px solid var(--mc-line)" }}
          >
            <SectionLabel>Recents</SectionLabel>
            {recentThreads.map((t) => {
              const threadSpace = t.spaceId ? spaces.find((s) => s.id === t.spaceId) : null;
              const SpIcon = threadSpace ? getSpaceIcon(threadSpace.icon) : MessageSquare;
              const iconColor = threadSpace ? threadSpace.color : undefined;
              const isActive = t.id === activeThreadId;
              return (
                <button
                  key={t.id}
                  onClick={() => handleThreadClick(t.id)}
                  className="w-full flex items-center gap-2 rounded-md transition-all group"
                  style={{
                    padding: "6px 10px",
                    fontSize: 12,
                    background: isActive ? "var(--mc-accent-soft)" : "transparent",
                    color: isActive ? "var(--mc-accent)" : "var(--mc-fg-1)",
                    borderLeft: isActive
                      ? "2px solid var(--mc-accent)"
                      : "2px solid transparent",
                    paddingLeft: isActive ? 10 : 12,
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) e.currentTarget.style.background = "var(--mc-bg-2)";
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) e.currentTarget.style.background = "transparent";
                  }}
                >
                  <SpIcon
                    className="w-3 h-3 shrink-0 mt-0.5"
                    style={{ color: iconColor || (isActive ? "var(--mc-accent)" : "var(--mc-fg-2)") }}
                  />
                  <div className="flex-1 min-w-0 text-left">
                    <span className="truncate block">{t.title}</span>
                    <div className="flex items-center gap-1.5">
                      {t.modelId && (
                        <span
                          className="truncate"
                          style={{ fontSize: 9, color: "var(--mc-fg-2)", opacity: 0.8 }}
                        >
                          {t.modelId.split("/").pop()}
                        </span>
                      )}
                      {threadSpace && (
                        <span
                          className="px-1 rounded"
                          style={{
                            fontSize: 8,
                            background: `${threadSpace.color}1f`,
                            color: threadSpace.color,
                          }}
                        >
                          {threadSpace.name}
                        </span>
                      )}
                    </div>
                  </div>
                  <X
                    className="w-3 h-3 shrink-0 opacity-0 group-hover:opacity-60 transition-opacity cursor-pointer"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteThread(t.id);
                    }}
                  />
                </button>
              );
            })}
          </div>
        )}
        {recentThreads.length === 0 && <div className="flex-1" />}

        <div className="px-2 pb-2" style={{ borderTop: "1px solid var(--mc-line)" }}>
          <Link
            to="/settings"
            className="mt-2 flex items-center gap-2.5 rounded-md transition-all"
            style={{
              padding: "7px 12px",
              fontSize: 13,
              fontWeight: location.pathname === "/settings" ? 600 : 500,
              background:
                location.pathname === "/settings" ? "var(--mc-accent-soft)" : "transparent",
              color: location.pathname === "/settings" ? "var(--mc-accent)" : "var(--mc-fg-1)",
              borderLeft:
                location.pathname === "/settings"
                  ? "2px solid var(--mc-accent)"
                  : "2px solid transparent",
              paddingLeft: location.pathname === "/settings" ? 10 : 12,
            }}
          >
            <Settings className="w-4 h-4" strokeWidth={1.75} />
            Settings
          </Link>
        </div>

        <div
          className="flex items-center gap-3 px-4 py-3"
          style={{ borderTop: "1px solid var(--mc-line)" }}
        >
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
            style={{
              background: "var(--mc-accent-2-soft)",
              color: "var(--mc-accent-2)",
              border: "1px solid var(--mc-accent-2)",
              fontSize: 11,
              fontWeight: 700,
            }}
          >
            M
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 500, color: "var(--mc-fg)" }}>Meg</div>
            <div style={{ fontSize: 10, color: "var(--mc-fg-2)", letterSpacing: 0.4 }}>
              Pro · Local
            </div>
          </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header
          className="flex items-center justify-between shrink-0 backdrop-blur-xl"
          style={{
            height: 52,
            padding: "0 20px",
            borderBottom: "1px solid var(--mc-line)",
            background: "var(--mc-bg-overlay)",
          }}
        >
          <div className="flex items-center gap-3" style={{ minWidth: 80 }}>
            <button
              className="hamburger-btn w-8 h-8 items-center justify-center rounded-lg"
              style={{ color: "var(--mc-fg-2)", display: "none" }}
              onClick={() => setSidebarOpen((v) => !v)}
              data-testid="sidebar-toggle"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2">
              <span
                style={{
                  fontFamily: "var(--mc-font-display)",
                  fontSize: 15,
                  fontWeight: 600,
                  letterSpacing: -0.2,
                  color: "var(--mc-fg)",
                }}
              >
                {getHeaderTitle(location.pathname)}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {["Chat", "Qudos", "Code"].map((tab) => {
              const isActive = currentTab === tab.toLowerCase();
              return (
                <Link
                  key={tab}
                  to={tab === "Chat" ? "/" : `/${tab.toLowerCase()}`}
                  className="rounded-md transition-all"
                  style={{
                    padding: "5px 14px",
                    fontSize: 12,
                    fontWeight: isActive ? 600 : 500,
                    letterSpacing: 0.2,
                    background: isActive ? "var(--mc-accent-soft)" : "transparent",
                    color: isActive ? "var(--mc-accent)" : "var(--mc-fg-2)",
                    border: isActive
                      ? "1px solid var(--mc-accent)"
                      : "1px solid transparent",
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) e.currentTarget.style.color = "var(--mc-fg)";
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) e.currentTarget.style.color = "var(--mc-fg-2)";
                  }}
                >
                  {tab}
                </Link>
              );
            })}
          </div>

          <div
            className="flex items-center justify-end gap-2.5"
            style={{ minWidth: 180, fontSize: 11, color: "var(--mc-fg-2)" }}
          >
            <span
              className="hidden sm:inline"
              style={{ fontSize: 10, letterSpacing: 0.8, textTransform: "uppercase" }}
            >
              {runtimeMeta.label}
            </span>

            {/* Gateway connection dot */}
            <div className="relative flex h-2 w-2" title={`Gateway ${status}`}>
              {status === "connected" ? (
                <>
                  <span
                    className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
                    style={{ background: "var(--mc-ok)" }}
                  />
                  <span
                    className="relative inline-flex rounded-full h-2 w-2"
                    style={{ background: "var(--mc-ok)" }}
                  />
                </>
              ) : (
                <span
                  className="relative inline-flex rounded-full h-2 w-2 animate-pulse"
                  style={{ background: "var(--mc-warn)" }}
                />
              )}
            </div>

            {/* Agents health pill */}
            {(() => {
              const live = formatHealthDetail(agentsHealth);
              const liveState = live.state || agentsHealth.state;
              const styleDef = HEALTH_STYLES[liveState] || HEALTH_STYLES.loading;
              const Icon = styleDef.icon;
              const tip = live.detail
                ? `${agentsHealth.label} — ${live.detail}`
                : agentsHealth.label;
              return (
                <Link
                  to="/agents"
                  className="hidden sm:inline-flex items-center gap-1.5 rounded-full transition-opacity hover:opacity-90"
                  style={{
                    padding: "3px 10px",
                    fontSize: 11,
                    fontWeight: 500,
                    background: `${styleDef.color}1a`,
                    color: styleDef.color,
                    border: `1px solid ${styleDef.color}3a`,
                  }}
                  title={tip}
                  data-testid="agents-health-pill"
                >
                  <Icon
                    className={`w-3 h-3 ${
                      agentsHealth.state === "loading" ? "animate-spin" : ""
                    }`}
                  />
                  <span>{agentsHealth.label}</span>
                  {agentsHealth.runningCount > 0 && (
                    <span style={{ fontSize: 10, opacity: 0.8 }}>
                      · {agentsHealth.runningCount} running
                    </span>
                  )}
                </Link>
              );
            })()}
          </div>
        </header>
        <BlockersBanner />
        <DoctorFixBanner />
        <div className="flex-1 overflow-hidden relative">{children}</div>
        <StatusBar />
      </main>
      <ActivityPane />
    </div>
  );
}

// Section label for sidebar groups
function SectionLabel({ children }) {
  return (
    <div
      style={{
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: 1.2,
        textTransform: "uppercase",
        color: "var(--mc-fg-2)",
        opacity: 0.7,
        padding: "12px 12px 6px",
      }}
    >
      {children}
    </div>
  );
}

// Header title from current route
const HEADER_TITLES = {
  "/": "Chat",
  "/projects": "Projects",
  "/dashboard": "Dashboard",
  "/jobs": "Jobs",
  "/approvals": "Approvals",
  "/events": "Events",
  "/agents": "Agents",
  "/agents/live": "Agent Live View",
  "/sessions": "Sessions",
  "/system": "System",
  "/cron": "Schedule",
  "/activity": "Activity",
  "/costs": "Costs",
  "/qudos": "Qudos",
  "/cowork": "Qudos",
  "/code": "Code",
  "/settings": "Settings",
  "/customize": "Customise",
  "/design": "Design",
  "/brain": "Brain",
  "/dev/schema-form-demo": "Schema Demo",
};
function getHeaderTitle(pathname) {
  return HEADER_TITLES[pathname] || "Mission Control";
}
