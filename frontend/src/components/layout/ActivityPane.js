import React, { useEffect } from "react";
import { useLocation, Link } from "react-router-dom";
import {
  Bell, X, Activity, Bot, Clock, Shield, MessageSquare, Server,
  Lock as LockIcon, Eye, Sparkles, ChevronRight,
} from "lucide-react";
import { C } from "@/lib/constants";
import { useGateway } from "@/lib/useGateway";

// Right-side global activity pane. Hidden on /activity (the dedicated page
// already shows the same data more richly) and /system (which has its own
// right column).
//
// Wires to the existing Sprint 4 store slice — no new state, no second WS
// connection. Just a presentational wrapper around `activities[]` with a
// floating bell trigger and a slide-out drawer.

const CATEGORY_META = {
  agent:    { Icon: Bot          },
  cron:     { Icon: Clock        },
  approval: { Icon: Shield       },
  chat:     { Icon: MessageSquare},
  system:   { Icon: Server       },
  security: { Icon: LockIcon     },
  watcher:  { Icon: Eye          },
  model:    { Icon: Sparkles     },
};

const SEVERITY_DOT = {
  info:     C.muted,
  warn:     "#fbbf24",
  error:    "#f87171",
  critical: "#f87171",
};

function fmtTime(ts) {
  if (!ts) return "—";
  const diff = Date.now() - ts;
  if (diff < 60_000) return `${Math.max(1, Math.floor(diff / 1000))}s`;
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h`;
  return `${Math.floor(diff / 86_400_000)}d`;
}

function CategoryIcon({ category, className, style }) {
  const meta = CATEGORY_META[category];
  if (!meta) return <Activity className={className} style={style} />;
  const Icon = meta.Icon;
  return <Icon className={className} style={style} />;
}

export default function ActivityPane() {
  const location = useLocation();
  const {
    activities, activitiesPaneOpen, activitiesUnreadCount, activitiesWsConnected,
    toggleActivitiesPane, markActivitiesRead, connectActivitiesWebSocket,
  } = useGateway();

  // Idempotent — no-op if already connected. Layout mounts once,
  // ensures the WS is up regardless of which page the user lands on.
  useEffect(() => { connectActivitiesWebSocket(); }, [connectActivitiesWebSocket]);

  // Hide pane on /activity (dedicated page) and /system (own right column).
  const hidden = location.pathname === "/activity"
              || location.pathname === "/activities"
              || location.pathname === "/system";
  if (hidden) return null;

  const recent = activities.slice(0, 50);

  return (
    <>
      {/* Floating bell trigger */}
      {!activitiesPaneOpen && (
        <button
          type="button"
          onClick={toggleActivitiesPane}
          className="fixed bottom-12 right-4 z-40 w-10 h-10 rounded-full flex items-center justify-center transition-colors shadow-lg"
          style={{
            background: C.surface,
            border: `1px solid ${C.border}`,
            color: C.text,
          }}
          title={`Activity (${activitiesUnreadCount} unread)`}
          data-testid="activity-pane-toggle"
        >
          <Bell className="w-4 h-4" />
          {activitiesUnreadCount > 0 && (
            <span
              className="absolute -top-1 -right-1 min-w-[16px] h-[16px] rounded-full text-[9px] font-bold flex items-center justify-center px-1"
              style={{ background: C.red, color: "#fff" }}
            >
              {activitiesUnreadCount > 99 ? "99+" : activitiesUnreadCount}
            </span>
          )}
        </button>
      )}

      {/* Drawer */}
      {activitiesPaneOpen && (
        <aside
          className="fixed top-0 right-0 z-40 flex flex-col"
          style={{
            width: 320,
            height: "100vh",
            background: C.surface,
            borderLeft: `1px solid ${C.border}`,
            boxShadow: "-4px 0 20px rgba(0,0,0,0.4)",
          }}
          data-testid="activity-pane"
        >
          <div className="flex items-center justify-between gap-2 px-4 py-3 shrink-0"
               style={{ borderBottom: `1px solid ${C.border}` }}>
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4" style={{ color: C.accent }} />
              <span className="text-sm font-semibold">Activity</span>
              <span className="text-[10px] flex items-center gap-1"
                    style={{ color: activitiesWsConnected ? C.green : C.muted }}>
                <span className="w-1.5 h-1.5 rounded-full"
                      style={{ background: activitiesWsConnected ? C.green : C.muted }} />
                {activitiesWsConnected ? "live" : "offline"}
              </span>
            </div>
            <button
              type="button"
              onClick={toggleActivitiesPane}
              className="p-1 rounded-md hover:opacity-80 transition-opacity"
              style={{ color: C.muted }}
              data-testid="activity-pane-close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-2">
            {recent.length === 0 ? (
              <div className="text-[12px] text-center py-8" style={{ color: C.muted }}>
                No activity yet.
              </div>
            ) : (
              <div className="space-y-1">
                {recent.map((a) => {
                  const dotColor = SEVERITY_DOT[a.severity] || C.muted;
                  return (
                    <Link
                      key={a.id}
                      to={`/activity?id=${encodeURIComponent(a.id)}`}
                      onClick={markActivitiesRead}
                      className="flex items-start gap-2 px-2 py-1.5 rounded-md transition-colors"
                      style={{ background: "transparent" }}
                      onMouseEnter={(e) => e.currentTarget.style.background = C.surface2}
                      onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                    >
                      <div className="w-6 h-6 shrink-0 rounded-md flex items-center justify-center mt-0.5"
                           style={{ background: `${dotColor}18`, border: `1px solid ${dotColor}30` }}>
                        <CategoryIcon category={a.category} className="w-3 h-3" style={{ color: dotColor }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span className="text-[11px] font-semibold capitalize truncate" style={{ color: C.text }}>
                            {a.actor || "system"}
                          </span>
                          <span className="text-[9px] font-mono shrink-0" style={{ color: C.muted }}>
                            {fmtTime(a.created_at)}
                          </span>
                        </div>
                        <div className="text-[11px] truncate" style={{ color: C.muted }}>
                          {a.description}
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          <div className="shrink-0 px-4 py-2"
               style={{ borderTop: `1px solid ${C.border}` }}>
            <Link
              to="/activity"
              onClick={() => { markActivitiesRead(); toggleActivitiesPane(); }}
              className="flex items-center justify-between text-[11px] py-1.5 px-2 rounded-md transition-colors"
              style={{ color: C.muted }}
              onMouseEnter={(e) => { e.currentTarget.style.background = C.surface2; e.currentTarget.style.color = C.text; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = C.muted; }}
            >
              <span>View all activities</span>
              <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
        </aside>
      )}
    </>
  );
}
