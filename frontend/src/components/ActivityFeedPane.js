/**
 * ActivityFeedPane
 * ---------------------------------------------------------------------------
 * Live 5-minute rolling feed of agent task activity.
 * Polls GET /api/v2/agents/tasks?since=<5-min-ago>&limit=30 every 10 seconds.
 *
 * Adapted from the activity feed pattern in the mission-control-reference repo
 * but uses Meg's stack: inline Tailwind styles + apiUrl() from useGateway.
 *
 * Usage:
 *   <ActivityFeedPane />                      — standalone, self-fetching
 *   <ActivityFeedPane title="5m Activity" />  — custom title
 *   <ActivityFeedPane windowMs={10 * 60000} /> — 10-min window instead
 */
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Activity, AlertCircle, Brain, CheckCircle2, Clock,
  Eye, FileCheck, Hammer, Layers, Loader2, RefreshCw,
  Wrench, XCircle,
} from "lucide-react";
import { C } from "@/lib/constants";
import { apiUrl } from "@/lib/useGateway";

// ─── Agent colours + icons ────────────────────────────────────────────────────
const AGENT_META = {
  planner:    { color: "#3b82f6", Icon: Brain },
  executor:   { color: "#eab308", Icon: Hammer },
  supervisor: { color: "#22c55e", Icon: Eye },
  auditor:    { color: "#a855f7", Icon: FileCheck },
  watcher:    { color: "#6b7280", Icon: Activity },
  builder:    { color: "#f97316", Icon: Wrench },
  meta:       { color: "#ec4899", Icon: Layers },
};

// ─── Status colours + icons ────────────────────────────────────────────────────
const STATUS_META = {
  pending:        { color: "var(--mc-fg-2)", Icon: Clock,        label: "pending" },
  running:        { color: "var(--mc-warn)", Icon: Loader2,      label: "running",  spin: true },
  // F7 §4.4 — `done` is banned; legacy exit-0 maps to "claims done" at data layer.
  claims_done:    { color: "var(--mc-warn)", Icon: AlertCircle,  label: "claims done" },
  verified:       { color: "var(--mc-ok)",   Icon: CheckCircle2, label: "verified" },
  killed:         { color: "var(--mc-fg-2)", Icon: XCircle,      label: "killed" },
  failed:         { color: "var(--mc-err)",  Icon: XCircle,      label: "failed" },
  needs_approval: { color: "#c084fc", Icon: AlertCircle,  label: "approval" },
};
const defaultStatus = STATUS_META.pending;

function fmtAge(ts) {
  if (!ts) return "—";
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return `${Math.max(1, s)}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  return `${Math.floor(s / 3600)}h`;
}

function severityBadge(task) {
  const s = (task.status || "").toLowerCase();
  if (s === "failed") return { bg: "var(--mc-err-soft)", fg: "var(--mc-err)", border: "rgba(239,68,68,0.35)", label: "FAIL" };
  if (s === "running") return { bg: "var(--mc-warn-soft)", fg: "var(--mc-warn)", border: "rgba(251,191,36,0.35)", label: "RUN" };
  if (s === "needs_approval") return { bg: "rgba(168,85,247,0.12)", fg: "#c084fc", border: "rgba(168,85,247,0.35)", label: "GATE" };
  if (s === "claims_done") return { bg: "var(--mc-warn-soft)", fg: "var(--mc-warn)", border: "rgba(251,191,36,0.35)", label: "CLAIMS" };
  if (s === "verified") return { bg: "var(--mc-ok-soft)", fg: "var(--mc-ok)", border: "rgba(34,197,94,0.3)", label: "VERIFIED" };
  if (s === "killed") return { bg: "var(--mc-bg-2)", fg: "var(--mc-fg-2)", border: "rgba(148,163,184,0.3)", label: "KILLED" };
  return { bg: "var(--mc-bg-2)", fg: "var(--mc-fg-2)", border: "rgba(148,163,184,0.3)", label: s.toUpperCase() || "—" };
}

// ─── Row ─────────────────────────────────────────────────────────────────────
function FeedRow({ task }) {
  const agentM = AGENT_META[task.agent] || { color: "#64748b", Icon: Activity };
  const AgentIcon = agentM.Icon;
  const rawStatus = (task.status || "").toLowerCase();
  const statusM = STATUS_META[rawStatus === "done" ? "claims_done" : rawStatus] || defaultStatus;
  const StatusIcon = statusM.Icon;
  const badge = severityBadge(task);

  return (
    <div
      className="flex items-center gap-2 px-3 py-2 group transition-colors hover:opacity-90"
      style={{ borderBottom: `1px solid ${C.border}` }}
    >
      {/* Agent icon */}
      <div
        className="w-5 h-5 rounded-md flex items-center justify-center shrink-0"
        style={{ background: `${agentM.color}18`, border: `1px solid ${agentM.color}40` }}
      >
        <AgentIcon className="w-2.5 h-2.5" style={{ color: agentM.color }} />
      </div>

      {/* Agent label */}
      <span
        className="text-[11px] font-medium capitalize shrink-0"
        style={{ color: C.text, minWidth: 56 }}
      >
        {task.agent || "agent"}
      </span>

      {/* Severity badge */}
      <span
        className="px-1.5 py-0.5 text-[9px] font-mono rounded-full flex items-center gap-0.5 shrink-0"
        style={{ background: badge.bg, color: badge.fg, border: `1px solid ${badge.border}` }}
      >
        <StatusIcon
          className={`w-2 h-2 ${statusM.spin ? "animate-spin" : ""}`}
        />
        {badge.label}
      </span>

      {/* Prompt snippet */}
      <span
        className="text-[10px] truncate flex-1"
        style={{ color: C.muted }}
        title={task.prompt}
      >
        {task.prompt ? task.prompt.slice(0, 80) : task.id?.slice(0, 12) || "—"}
      </span>

      {/* Age */}
      <span
        className="text-[10px] font-mono shrink-0"
        style={{ color: C.muted, minWidth: 28, textAlign: "right" }}
      >
        {fmtAge(task.createdAt)}
      </span>
    </div>
  );
}

// ─── Main pane ────────────────────────────────────────────────────────────────
export function ActivityFeedPane({
  title = "Recent Agent Activity",
  windowMs = 5 * 60 * 1000,  // 5 minutes
  limit = 30,
  pollMs = 10_000,
  className = "",
}) {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastFetch, setLastFetch] = useState(null);
  const mountedRef = useRef(true);

  const fetch5m = useCallback(async () => {
    setLoading(true);
    try {
      const since = Date.now() - windowMs;
      const url = apiUrl(`/api/v2/agents/tasks?since=${since}&limit=${limit}`);
      const res = await window.fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const payload = await res.json();
      const list = Array.isArray(payload?.tasks)
        ? payload.tasks
        : Array.isArray(payload)
          ? payload
          : [];
      if (mountedRef.current) {
        setTasks(list);
        setError(null);
        setLastFetch(Date.now());
      }
    } catch (err) {
      if (mountedRef.current) setError(err?.message || String(err));
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [windowMs, limit]);

  useEffect(() => {
    mountedRef.current = true;
    fetch5m();
    const timer = setInterval(fetch5m, pollMs);
    return () => {
      mountedRef.current = false;
      clearInterval(timer);
    };
  }, [fetch5m, pollMs]);

  // Derived counts for the header summary
  const runningCount = tasks.filter((t) => (t.status || "").toLowerCase() === "running").length;
  const failedCount  = tasks.filter((t) => (t.status || "").toLowerCase() === "failed").length;

  return (
    <div
      className={`rounded-xl overflow-hidden flex flex-col ${className}`}
      style={{ background: C.surface, border: `1px solid ${C.border}` }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-3 py-2 shrink-0"
        style={{ borderBottom: `1px solid ${C.border}` }}
      >
        <div className="flex items-center gap-2">
          <Activity className="w-3.5 h-3.5" style={{ color: C.accent }} />
          <span className="text-[12px] font-semibold" style={{ color: C.text }}>{title}</span>
          <span className="text-[10px]" style={{ color: C.muted }}>last 5 min</span>
        </div>
        <div className="flex items-center gap-2">
          {runningCount > 0 && (
            <span
              className="text-[10px] px-1.5 py-0.5 rounded-full"
              style={{ background: "rgba(251,191,36,0.12)", color: "#fbbf24", border: "1px solid rgba(251,191,36,0.3)" }}
            >
              {runningCount} running
            </span>
          )}
          {failedCount > 0 && (
            <span
              className="text-[10px] px-1.5 py-0.5 rounded-full"
              style={{ background: "rgba(239,68,68,0.12)", color: "#f87171", border: "1px solid rgba(239,68,68,0.3)" }}
            >
              {failedCount} failed
            </span>
          )}
          <button
            type="button"
            onClick={fetch5m}
            disabled={loading}
            className="w-5 h-5 flex items-center justify-center rounded-md disabled:opacity-50 transition-colors"
            style={{ color: C.muted }}
            title="Refresh"
          >
            <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Error bar */}
      {error && (
        <div
          className="px-3 py-1.5 text-[10px] flex items-center gap-1.5"
          style={{ background: "rgba(239,68,68,0.08)", color: "#f87171", borderBottom: `1px solid ${C.border}` }}
        >
          <AlertCircle className="w-3 h-3 shrink-0" />
          <span className="truncate">{error}</span>
        </div>
      )}

      {/* Feed rows */}
      <div className="flex-1 overflow-y-auto" style={{ maxHeight: 280 }}>
        {loading && tasks.length === 0 ? (
          <div className="flex items-center justify-center gap-2 py-6 text-[11px]" style={{ color: C.muted }}>
            <Loader2 className="w-3 h-3 animate-spin" />
            Loading…
          </div>
        ) : tasks.length === 0 ? (
          <div className="py-6 text-center text-[11px]" style={{ color: C.muted }}>
            No agent activity in the last 5 minutes.
          </div>
        ) : (
          tasks.map((task) => <FeedRow key={task.id} task={task} />)
        )}
      </div>

      {/* Footer */}
      {lastFetch && !loading && (
        <div
          className="px-3 py-1 text-[9px] text-right shrink-0"
          style={{ color: C.muted, borderTop: `1px solid ${C.border}` }}
        >
          {tasks.length} task{tasks.length !== 1 ? "s" : ""} · refreshed {fmtAge(lastFetch)} ago
        </div>
      )}
    </div>
  );
}

export default ActivityFeedPane;
