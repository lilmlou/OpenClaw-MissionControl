import React, { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { MessageSquare, Plus, ChevronDown, X, Menu, Lightbulb, Package, FolderOpen, FileText, Code2, Paintbrush, Briefcase, Globe, Layers } from "lucide-react";
import { C, NAV } from "@/lib/constants";
import { useGateway } from "@/lib/useGateway";

const SPACE_ICONS = { FileText, Code2, Paintbrush, FolderOpen, Briefcase, Globe, Layers };
const getSpaceIcon = (iconName) => SPACE_ICONS[iconName] || FolderOpen;

export default function Layout({ children }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { status, clawStatus, approvals, threads, activeThreadId, setActiveThread, deleteThread, spaces } = useGateway();
  const clawState = clawStatus?.state ?? "Scheduled";
  const pendingApprovals = approvals.filter(a => a.status === "pending").length;
  const activeJobs = useGateway(s => s.jobs.filter(j => j.status === "running").length);
  const currentTab = location.pathname === "/cowork" ? "cowork" : location.pathname === "/code" ? "code" : "chat";
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => { setSidebarOpen(false); }, [location.pathname]);

  const handleNewThread = () => {
    useGateway.getState().saveThreadMessages();
    useGateway.getState().clearMessages();
    useGateway.setState({ activeThreadId: null, activeModel: null });
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
        {recentThreads.length > 0 && (
          <div className="px-2 pt-2 flex-1 overflow-auto" style={{ borderTop: "1px solid #1a1a1a" }}>
            <div className="text-[10px] font-bold uppercase tracking-widest px-3 py-1.5" style={{ color: "#444" }}>Recents</div>
            {recentThreads.map(t => {
              const threadSpace = t.spaceId ? spaces.find(s => s.id === t.spaceId) : null;
              const SpIcon = threadSpace ? getSpaceIcon(threadSpace.icon) : MessageSquare;
              const iconColor = threadSpace ? threadSpace.color : undefined;
              const isActive = t.id === activeThreadId;
              const borderLeft = threadSpace ? `3px solid ${threadSpace.color}` : "3px solid transparent";
              const bgTint = threadSpace && !isActive ? `${threadSpace.color}08` : isActive ? "rgba(29,140,248,0.1)" : "transparent";
              return (
                <button key={t.id} onClick={() => handleThreadClick(t.id)}
                  className="w-full flex items-center gap-2 px-3 py-1.5 rounded-md text-[12px] transition-colors group"
                  style={{ background: bgTint, color: isActive ? C.accent : "#777", borderLeft }}>
                  <SpIcon className="w-3 h-3 shrink-0 mt-0.5" style={{ color: iconColor || (isActive ? C.accent : "#555") }} />
                  <div className="flex-1 min-w-0 text-left">
                    <span className="truncate block">{t.title}</span>
                    <div className="flex items-center gap-1.5">
                      {t.modelId && <span className="truncate text-[9px]" style={{ color: "#555" }}>{t.modelId.split("/").pop()}</span>}
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
