import React, { useMemo } from "react";
import {
  Brain, Hammer, Eye, FileCheck, Activity, Wrench, Layers, Bot,
  AlertCircle, CheckCircle2, Clock, Loader2, XCircle,
} from "lucide-react";
import { C } from "@/lib/constants";

const AGENT_ICONS = {
  planner: Brain,
  executor: Hammer,
  supervisor: Eye,
  auditor: FileCheck,
  watcher: Activity,
  builder: Wrench,
  meta: Layers,
};

const AGENT_COLORS = {
  planner: "#3b82f6",
  executor: "#eab308",
  supervisor: "#22c55e",
  auditor: "#a855f7",
  watcher: "#6b7280",
  builder: "#f97316",
  meta: "#ec4899",
};

const EVENT_STYLES = {
  taskCreated:   { bg: "rgba(59,130,246,0.1)",   fg: "#3b82f6",  label: "Created" },
  taskStarted:   { bg: "rgba(251,191,36,0.1)",   fg: "#fbbf24",  label: "Started" },
  taskUpdated:   { bg: "rgba(148,163,184,0.1)",  fg: "#94a3b8",  label: "Updated" },
  taskCompleted: { bg: "rgba(34,197,94,0.1)",    fg: "#4ade80",  label: "Completed" },
  taskFailed:    { bg: "rgba(239,68,68,0.1)",    fg: "#f87171",  label: "Failed" },
  errorOccurred: { bg: "rgba(239,68,68,0.1)",    fg: "#f87171",  label: "Error" },
};

const STATUS_ICON = {
  done:           CheckCircle2,
  running:        Loader2,
  pending:        Clock,
  failed:         XCircle,
  needs_approval: AlertCircle,
};

function fmtTime(ts) {
  if (!ts) return "—";
  const diff = Date.now() - ts;
  if (diff < 60_000) return `${Math.max(1, Math.floor(diff / 1000))}s ago`;
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

/**
 * AgentActivityFeed
 * Renders a compact live feed of agent task events.
 *
 * Props:
 *   tasks    — array of agent task objects from /api/v2/agents/tasks
 *   filter   — "all" | agent id string
 *   maxItems — max rows to render (default 20)
 *   compact  — if true, renders a single-line-per-event style
 */
export function AgentActivityFeed({ tasks = [], filter = "all", maxItems = 20, compact = false }) {
  const visible = useMemo(() => {
    const base = filter === "all" ? tasks : tasks.filter((t) => t.agent === filter);
    return base.slice(0, maxItems);
  }, [tasks, filter, maxItems]);

  if (visible.length === 0) {
    return (
      <div
        className="rounded-xl p-6 text-center text-sm"
        style={{ background: C.surface, border: `1px solid ${C.border}`, color: C.muted }}
      >
        No agent activity yet.
      </div>
    );
  }

  if (compact) {
    return (
      <div
        className="rounded-xl overflow-hidden"
        style={{ background: C.surface, border: `1px solid ${C.border}` }}
      >
        <div
          className="px-3 py-2 text-[10px] font-bold uppercase tracking-widest"
          style={{ color: C.muted, borderBottom: `1px solid ${C.border}` }}
        >
          Agent activity
        </div>
        <div className="divide-y" style={{ borderColor: C.border }}>
          {visible.map((task) => {
            const AgentIcon = AGENT_ICONS[task.agent] || Bot;
            const color = AGENT_COLORS[task.agent] || "#64748b";
            const statusKey = (task.status || "").toLowerCase();
            const StatusIcon = STATUS_ICON[statusKey] || Clock;
            return (
              <div
                key={task.id}
                className="flex items-center gap-2 px-3 py-1.5 hover:opacity-90 transition-opacity"
                style={{ background: "transparent" }}
              >
                <AgentIcon className="w-3 h-3 shrink-0" style={{ color }} />
                <span className="text-[11px] font-medium truncate flex-1" style={{ color: C.text }}>
                  {task.agent || "agent"}
                </span>
                <StatusIcon
                  className={`w-3 h-3 shrink-0 ${statusKey === "running" ? "animate-spin" : ""}`}
                  style={{ color: statusKey === "failed" ? "#f87171" : statusKey === "done" ? "#4ade80" : "#fbbf24" }}
                />
                <span className="text-[10px] shrink-0" style={{ color: C.muted }}>
                  {fmtTime(task.createdAt)}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {visible.map((task) => {
        const AgentIcon = AGENT_ICONS[task.agent] || Bot;
        const color = AGENT_COLORS[task.agent] || "#64748b";
        const statusKey = (task.status || "").toLowerCase();
        const StatusIcon = STATUS_ICON[statusKey] || Clock;
        const statusColor =
          statusKey === "failed" ? "#f87171"
          : statusKey === "done" ? "#4ade80"
          : statusKey === "running" ? "#fbbf24"
          : "#94a3b8";

        return (
          <div
            key={task.id}
            className="flex items-start gap-3 p-3 rounded-lg"
            style={{ background: C.surface, border: `1px solid ${C.border}` }}
          >
            <div
              className="w-7 h-7 rounded-md flex items-center justify-center shrink-0 mt-0.5"
              style={{ background: `${color}18`, border: `1px solid ${color}40` }}
            >
              <AgentIcon className="w-3.5 h-3.5" style={{ color }} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap mb-0.5">
                <span className="text-[12px] font-semibold capitalize" style={{ color: C.text }}>
                  {task.agent || "agent"}
                </span>
                <span
                  className="flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-mono rounded-full"
                  style={{ background: `${statusColor}18`, color: statusColor, border: `1px solid ${statusColor}30` }}
                >
                  <StatusIcon className={`w-2.5 h-2.5 ${statusKey === "running" ? "animate-spin" : ""}`} />
                  {statusKey.toUpperCase()}
                </span>
                {task.phase && (
                  <span
                    className="px-1.5 py-0.5 text-[9px] font-mono rounded uppercase tracking-wider"
                    style={{ background: C.surface2, color: C.muted, border: `1px solid ${C.border}` }}
                  >
                    {task.phase}
                  </span>
                )}
              </div>
              {task.prompt && (
                <div className="text-[11px] truncate" style={{ color: C.muted }}>
                  {task.prompt}
                </div>
              )}
              {task.result && statusKey === "failed" && (
                <div
                  className="text-[10px] mt-1 rounded px-2 py-1 truncate"
                  style={{ background: "rgba(239,68,68,0.05)", border: "1px solid rgba(239,68,68,0.2)", color: "#f87171" }}
                >
                  {String(task.result).slice(0, 120)}
                </div>
              )}
              <div className="text-[10px] mt-0.5" style={{ color: C.muted }}>
                {fmtTime(task.createdAt)}
                {task.id && <span> · {task.id.slice(0, 8)}…</span>}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default AgentActivityFeed;
