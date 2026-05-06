import React, { useEffect, useMemo, useState } from "react";
import {
  Activity, Bot, Clock, Shield, MessageSquare, Server, Lock as LockIcon,
  Eye, Sparkles, Search, RefreshCw, ChevronDown, ChevronUp, X, AlertCircle,
} from "lucide-react";
import { C } from "@/lib/constants";
import { useGateway } from "@/lib/useGateway";

// /activity — unified activities feed.
//
// Wires to Sprint 4 backend (shipped):
//   GET /api/v2/activities?since=&until=&limit=&category=&severity=&actor=&search=
//   WS  /api/ws/activities — live frame stream
//
// Phase 1 (this commit): page with filters, day-grouped list, detail modal.
// Phase 2 (separate): global right-side pane visible across all pages.

const CATEGORY_META = {
  agent:    { label: "Agent",    Icon: Bot          },
  cron:     { label: "Cron",     Icon: Clock        },
  approval: { label: "Approval", Icon: Shield       },
  chat:     { label: "Chat",     Icon: MessageSquare},
  system:   { label: "System",   Icon: Server       },
  security: { label: "Security", Icon: LockIcon     },
  watcher:  { label: "Watcher",  Icon: Eye          },
  model:    { label: "Model",    Icon: Sparkles     },
};

const SEVERITY_STYLE = {
  info:     { bg: C.surface2,                 fg: C.muted,   label: "info",     dot: C.muted   },
  warn:     { bg: "rgba(251,191,36,0.16)",    fg: "#fbbf24", label: "warn",     dot: "#fbbf24" },
  error:    { bg: "rgba(239,68,68,0.16)",     fg: "#f87171", label: "error",    dot: "#f87171" },
  critical: { bg: "rgba(239,68,68,0.22)",     fg: "#f87171", label: "critical", dot: "#f87171", pulse: true },
};

const TIME_RANGES = [
  { id: "1h",  label: "Last hour",   ms: 3600 * 1000 },
  { id: "24h", label: "Today",       ms: 24 * 3600 * 1000 },
  { id: "7d",  label: "Last 7 days", ms: 7 * 24 * 3600 * 1000 },
  { id: "30d", label: "Last 30 days", ms: 30 * 24 * 3600 * 1000 },
];

const SEVERITIES = ["info", "warn", "error", "critical"];

function fmtTime(ts) {
  if (!ts) return "—";
  const diff = Date.now() - ts;
  if (diff < 60_000) return `${Math.max(1, Math.floor(diff / 1000))}s ago`;
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return new Date(ts).toLocaleDateString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function dayLabel(ts) {
  const d = new Date(ts);
  const today = new Date();
  const y = new Date();
  y.setDate(y.getDate() - 1);
  const sameDay = (a, b) => a.toDateString() === b.toDateString();
  if (sameDay(d, today)) return "Today";
  if (sameDay(d, y))     return "Yesterday";
  return d.toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" });
}

function CategoryIcon({ category, className, style }) {
  const meta = CATEGORY_META[category];
  if (!meta) return <Activity className={className} style={style} />;
  const Icon = meta.Icon;
  return <Icon className={className} style={style} />;
}

function SeverityPill({ severity }) {
  const s = SEVERITY_STYLE[severity] || SEVERITY_STYLE.info;
  return (
    <span
      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-mono uppercase tracking-wider"
      style={{
        background: s.bg,
        color: s.fg,
        border: `1px solid ${s.fg}30`,
        animation: s.pulse ? "design-shimmer 2s linear infinite" : undefined,
      }}
    >
      {s.label}
    </span>
  );
}

function ActivityRow({ activity, onSelect }) {
  const sev = SEVERITY_STYLE[activity.severity] || SEVERITY_STYLE.info;
  return (
    <button
      type="button"
      onClick={() => onSelect(activity)}
      className="w-full flex items-start gap-3 px-3 py-2 rounded-md text-left transition-colors"
      style={{ background: C.surface, border: `1px solid ${C.border}` }}
      data-testid={`activity-row-${activity.id}`}
    >
      <div className="w-7 h-7 rounded-md flex items-center justify-center shrink-0 mt-0.5"
           style={{ background: `${sev.dot}18`, border: `1px solid ${sev.dot}30` }}>
        <CategoryIcon category={activity.category} className="w-3.5 h-3.5" style={{ color: sev.dot }} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-[11px] font-semibold capitalize" style={{ color: C.text }}>
            {activity.actor || "system"}
          </span>
          <span className="text-[10px]" style={{ color: C.muted }}>{fmtTime(activity.created_at)}</span>
          <span className="text-[9px] uppercase tracking-wider opacity-60" style={{ color: C.muted }}>
            {activity.type}
          </span>
        </div>
        <div className="text-[12px] truncate" style={{ color: C.text, opacity: 0.9 }}>
          {activity.description}
        </div>
        <div className="flex items-center gap-1.5 mt-1">
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] uppercase tracking-wider"
                style={{ background: C.surface2, color: C.muted, border: `1px solid ${C.border}` }}>
            <CategoryIcon category={activity.category} className="w-2.5 h-2.5" />
            {activity.category}
          </span>
          <SeverityPill severity={activity.severity} />
        </div>
      </div>
    </button>
  );
}

function DetailModal({ activity, onClose, allActivities }) {
  const [showData, setShowData] = useState(true);
  if (!activity) return null;
  const related = (allActivities || [])
    .filter((a) => a.id !== activity.id && a.entity_id && a.entity_id === activity.entity_id)
    .slice(0, 10);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ background: "rgba(0,0,0,0.6)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl max-h-[80vh] overflow-hidden rounded-xl flex flex-col"
        style={{ background: C.surface, border: `1px solid ${C.border}` }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 p-4"
             style={{ borderBottom: `1px solid ${C.border}` }}>
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-9 h-9 rounded-md flex items-center justify-center shrink-0"
                 style={{ background: `${C.accent}15`, border: `1px solid ${C.accent}40` }}>
              <CategoryIcon category={activity.category} className="w-4 h-4" style={{ color: C.accent }} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className="text-[14px] font-semibold capitalize" style={{ color: C.text }}>
                  {activity.actor || "system"}
                </span>
                <SeverityPill severity={activity.severity} />
                <span className="text-[10px] font-mono uppercase tracking-wider"
                      style={{ color: C.muted }}>
                  {activity.type}
                </span>
              </div>
              <div className="text-[12px]" style={{ color: C.muted }}>
                {new Date(activity.created_at).toLocaleString()}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-md hover:opacity-80 transition-opacity"
            style={{ color: C.muted }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="overflow-y-auto p-4 flex-1">
          <div className="text-[14px] mb-3" style={{ color: C.text }}>{activity.description}</div>
          {activity.entity_id && (
            <div className="text-[11px] font-mono mb-4" style={{ color: C.muted }}>
              Linked: {activity.entity_type || "entity"} ·
              <span style={{ color: C.text, marginLeft: 4 }}>{activity.entity_id}</span>
            </div>
          )}
          {activity.data && Object.keys(activity.data).length > 0 && (
            <div className="mb-4">
              <button
                type="button"
                onClick={() => setShowData((v) => !v)}
                className="flex items-center gap-1 text-[10px] uppercase tracking-wider mb-1"
                style={{ color: C.muted }}
              >
                {showData ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                Data
              </button>
              {showData && (
                <pre className="text-[11px] font-mono whitespace-pre-wrap break-words p-3 rounded-md max-h-[280px] overflow-auto"
                     style={{ background: C.surface2, border: `1px solid ${C.border}`, color: "#e2e8f0", margin: 0 }}>
                  {JSON.stringify(activity.data, null, 2)}
                </pre>
              )}
            </div>
          )}
          {related.length > 0 && (
            <div>
              <div className="text-[10px] uppercase tracking-wider mb-2" style={{ color: C.muted }}>
                Related ({related.length})
              </div>
              <div className="space-y-1">
                {related.map((r) => (
                  <div key={r.id}
                       className="flex items-center gap-2 px-2 py-1.5 rounded-md text-[11px]"
                       style={{ background: C.surface2 }}>
                    <CategoryIcon category={r.category} className="w-3 h-3 shrink-0" style={{ color: C.muted }} />
                    <span className="capitalize" style={{ color: C.text }}>{r.actor}</span>
                    <span className="flex-1 truncate" style={{ color: C.muted }}>{r.description}</span>
                    <span style={{ color: C.muted }}>{fmtTime(r.created_at)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function FilterChip({ label, active, onClick, count }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors"
      style={{
        background: active ? `${C.accent}22` : C.surface2,
        color: active ? C.text : C.muted,
        border: `1px solid ${active ? `${C.accent}44` : C.border}`,
      }}
    >
      {label}
      {count != null && <span className="text-[10px] font-mono opacity-80">{count}</span>}
    </button>
  );
}

export default function ActivitiesPage() {
  const {
    activities, activitiesLoading, activitiesError, activitiesFilters,
    fetchActivities, setActivitiesFilters,
    connectActivitiesWebSocket, activitiesWsConnected,
  } = useGateway();

  const [timeRange, setTimeRange] = useState("24h");
  const [search, setSearch] = useState("");
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [selectedActivity, setSelectedActivity] = useState(null);

  const range = TIME_RANGES.find((r) => r.id === timeRange) || TIME_RANGES[1];

  // Initial fetch + WS subscribe.
  useEffect(() => {
    const since = Date.now() - range.ms;
    fetchActivities({ since });
    connectActivitiesWebSocket();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeRange]);

  // Apply filters by re-fetching when the user changes them.
  useEffect(() => {
    if (autoRefresh) {
      const id = setInterval(() => {
        if (document.visibilityState === "visible") {
          fetchActivities({ silent: true, since: Date.now() - range.ms });
        }
      }, 5000);
      return () => clearInterval(id);
    }
  }, [autoRefresh, range.ms, fetchActivities]);

  // Client-side filtering. WS adds new ones to the store, but we also
  // narrow them here to whatever the user selected.
  const filtered = useMemo(() => {
    return activities.filter((a) => {
      if (activitiesFilters.categories.length && !activitiesFilters.categories.includes(a.category)) return false;
      if (activitiesFilters.severities.length && !activitiesFilters.severities.includes(a.severity)) return false;
      if (search) {
        const q = search.toLowerCase();
        if (!String(a.description || "").toLowerCase().includes(q)
            && !String(a.actor || "").toLowerCase().includes(q)
            && !String(a.type || "").toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [activities, activitiesFilters, search]);

  // Group by day for day separators.
  const grouped = useMemo(() => {
    const buckets = new Map();
    for (const a of filtered) {
      const key = dayLabel(a.created_at);
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key).push(a);
    }
    return Array.from(buckets.entries());
  }, [filtered]);

  const stats = useMemo(() => {
    const byCategory = {};
    let errors = 0;
    for (const a of filtered) {
      byCategory[a.category] = (byCategory[a.category] || 0) + 1;
      if (a.severity === "error" || a.severity === "critical") errors++;
    }
    return { total: filtered.length, byCategory, errors };
  }, [filtered]);

  const toggleCategory = (cat) => {
    const cur = activitiesFilters.categories;
    setActivitiesFilters({
      categories: cur.includes(cat) ? cur.filter((c) => c !== cat) : [...cur, cat],
    });
  };
  const toggleSeverity = (sev) => {
    const cur = activitiesFilters.severities;
    setActivitiesFilters({
      severities: cur.includes(sev) ? cur.filter((s) => s !== sev) : [...cur, sev],
    });
  };

  return (
    <div className="h-full flex flex-col" style={{ color: C.text }}>
      {/* Header + toolbar */}
      <div className="shrink-0 px-6 py-3 space-y-3"
           style={{ borderBottom: `1px solid ${C.border}` }}>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <Activity className="w-5 h-5" style={{ color: C.accent }} />
            <div>
              <h1 className="text-lg font-semibold" style={{ color: C.text }}>Activities</h1>
              <p className="text-[11px]" style={{ color: C.muted }}>
                Unified runtime stream · {activitiesWsConnected ? <span style={{ color: C.green }}>● live</span> : <span style={{ color: C.muted }}>○ disconnected</span>}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="cursor-pointer"
              />
              <span style={{ color: C.muted }}>Auto refresh</span>
            </label>
            <button
              type="button"
              onClick={() => fetchActivities({ since: Date.now() - range.ms })}
              disabled={activitiesLoading}
              className="px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 disabled:opacity-50"
              style={{ background: C.surface2, border: `1px solid ${C.border}`, color: C.text }}
              data-testid="activities-refresh"
            >
              <RefreshCw className={`w-3 h-3 ${activitiesLoading ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Time range */}
          <div className="flex items-center gap-1">
            {TIME_RANGES.map((r) => (
              <FilterChip
                key={r.id}
                label={r.label}
                active={timeRange === r.id}
                onClick={() => setTimeRange(r.id)}
              />
            ))}
          </div>
          <div className="w-px h-5" style={{ background: C.border }} />
          {/* Category */}
          {Object.entries(CATEGORY_META).map(([cat, m]) => (
            <FilterChip
              key={cat}
              label={m.label}
              active={activitiesFilters.categories.includes(cat)}
              onClick={() => toggleCategory(cat)}
              count={stats.byCategory[cat]}
            />
          ))}
          <div className="w-px h-5" style={{ background: C.border }} />
          {/* Severity */}
          {SEVERITIES.map((s) => (
            <FilterChip
              key={s}
              label={s}
              active={activitiesFilters.severities.includes(s)}
              onClick={() => toggleSeverity(s)}
            />
          ))}
        </div>

        {/* Search */}
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg max-w-md"
             style={{ background: C.surface, border: `1px solid ${C.border}` }}>
          <Search className="w-3.5 h-3.5 shrink-0" style={{ color: C.muted }} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search description, actor, or type…"
            className="flex-1 bg-transparent outline-none text-[12px]"
            style={{ color: C.text }}
            data-testid="activities-search"
          />
          {search && (
            <button type="button" onClick={() => setSearch("")} style={{ color: C.muted }}>
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Stats */}
        <div className="flex items-center gap-4 text-[11px]" style={{ color: C.muted }}>
          <span>{stats.total} activities</span>
          {stats.errors > 0 && (
            <span style={{ color: C.red }}>{stats.errors} errors</span>
          )}
        </div>
      </div>

      {/* Error banner */}
      {activitiesError && (
        <div className="mx-6 my-2 p-3 rounded-lg text-xs flex items-start gap-2 shrink-0"
             style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", color: "#f87171" }}>
          <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <div className="font-mono">{activitiesError}</div>
        </div>
      )}

      {/* Timeline */}
      <div className="flex-1 overflow-y-auto p-6">
        {activitiesLoading && activities.length === 0 ? (
          <div className="text-center text-sm" style={{ color: C.muted }}>Loading activities…</div>
        ) : grouped.length === 0 ? (
          <div className="text-center text-sm" style={{ color: C.muted }}>
            {activities.length === 0 ? "No activities yet." : "No activities match the current filters."}
          </div>
        ) : (
          <div className="space-y-6 max-w-4xl mx-auto">
            {grouped.map(([day, items]) => (
              <div key={day}>
                <div className="flex items-center gap-3 mb-3">
                  <div className="text-[10px] uppercase tracking-widest font-semibold"
                       style={{ color: C.muted }}>
                    {day}
                  </div>
                  <div className="flex-1 h-px" style={{ background: C.border }} />
                  <div className="text-[10px] font-mono" style={{ color: C.muted }}>{items.length}</div>
                </div>
                <div className="space-y-1.5">
                  {items.map((a) => (
                    <ActivityRow key={a.id} activity={a} onSelect={setSelectedActivity} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Detail modal */}
      <DetailModal
        activity={selectedActivity}
        onClose={() => setSelectedActivity(null)}
        allActivities={activities}
      />
    </div>
  );
}
