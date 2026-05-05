import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  CheckCircle2, Clock, Loader2, XCircle, ShieldCheck, RefreshCw, AlertCircle,
  Brain, Hammer, Eye, FileCheck, Activity, Wrench, Layers, ChevronRight, Filter,
} from "lucide-react";
import { C } from "@/lib/constants";
import { useGateway } from "@/lib/useGateway";

// Wired to GET /api/v2/agents/tasks (same source AgentsPage uses).
// Click any row to jump to /agents — task detail is rendered there.

// Mirrors AGENT_DEFS in AgentsPage for consistent iconography + colour.
const AGENT_META = {
  planner:    { label: "Planner",    color: "#3b82f6", Icon: Brain },
  executor:   { label: "Executor",   color: "#eab308", Icon: Hammer },
  supervisor: { label: "Supervisor", color: "#22c55e", Icon: Eye },
  auditor:    { label: "Auditor",    color: "#a855f7", Icon: FileCheck },
  watcher:    { label: "Watcher",    color: "#6b7280", Icon: Activity },
  builder:    { label: "Builder",    color: "#f97316", Icon: Wrench },
  meta:       { label: "Meta",       color: "#ec4899", Icon: Layers },
};

const STATUS_STYLE = {
  done:           { bg: "rgba(34,197,94,0.14)",  fg: "#4ade80", Icon: CheckCircle2,  label: "DONE" },
  running:        { bg: "rgba(251,191,36,0.16)", fg: "#fbbf24", Icon: Loader2,       label: "RUNNING", spin: true },
  pending:        { bg: "rgba(148,163,184,0.14)",fg: "#94a3b8", Icon: Clock,         label: "PENDING" },
  failed:         { bg: "rgba(239,68,68,0.16)",  fg: "#f87171", Icon: XCircle,       label: "FAILED" },
  needs_approval: { bg: "rgba(168,85,247,0.16)", fg: "#c084fc", Icon: ShieldCheck,   label: "APPROVAL" },
};
const defaultStatus = { bg: "rgba(148,163,184,0.12)", fg: "#94a3b8", Icon: Clock, label: "UNKNOWN" };

const FILTERS = [
  { id: "all",            label: "All" },
  { id: "running",        label: "Running" },
  { id: "done",           label: "Done" },
  { id: "failed",         label: "Failed" },
  { id: "pending",        label: "Pending" },
  { id: "needs_approval", label: "Approval" },
];

function fmtTime(ts) {
  if (!ts) return "—";
  const diff = Date.now() - ts;
  if (diff < 60_000) return `${Math.max(1, Math.floor(diff / 1000))}s ago`;
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return new Date(ts).toLocaleDateString([], { month: "short", day: "numeric" });
}

function fmtDuration(start, end) {
  if (!start || !end) return null;
  const ms = end - start;
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60_000)}m`;
}

function previewPrompt(prompt) {
  if (!prompt) return "(no prompt)";
  // Strip the [auto-cron …] prefix watcher/auditor/supervisor add — it's noise
  // in a dense list view. Full prompt is still visible on /agents.
  const stripped = String(prompt).replace(/^\[auto-cron[^\]]*\]\s*/i, "");
  const collapsed = stripped.replace(/\s+/g, " ").trim();
  return collapsed.length > 110 ? collapsed.slice(0, 108) + "…" : collapsed;
}

export default function JobsPage() {
  const { agentTasks, agentTasksLoading, agentTasksError, agentTasksLastUpdated, fetchAgentTasks } = useGateway();
  const [filter, setFilter] = useState("all");

  // Same refresh cadence as AgentsPage so both feel consistent.
  useEffect(() => {
    fetchAgentTasks();
    const id = setInterval(() => fetchAgentTasks({ silent: true }), 10_000);
    return () => clearInterval(id);
  }, [fetchAgentTasks]);

  const counts = useMemo(() => {
    const out = { all: agentTasks.length, running: 0, done: 0, failed: 0, pending: 0, needs_approval: 0 };
    for (const t of agentTasks) {
      const k = (t.status || "").toLowerCase();
      if (out[k] !== undefined) out[k] += 1;
    }
    return out;
  }, [agentTasks]);

  const filtered = useMemo(() => {
    if (filter === "all") return agentTasks;
    return agentTasks.filter((t) => (t.status || "").toLowerCase() === filter);
  }, [agentTasks, filter]);

  return (
    <div className="h-full flex flex-col" style={{ color: C.text }}>
      <div className="flex-1 overflow-y-auto">
        <div className="p-6 space-y-4 max-w-5xl mx-auto">

          {/* Header */}
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Jobs</h1>
              <p className="text-sm" style={{ color: C.muted }}>
                Live agent task history — every planner, executor, supervisor, auditor, watcher, builder, and meta run.
                Click any job to see its full prompt + result on the Agents page.
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs">
              {agentTasksLastUpdated && (
                <span style={{ color: C.muted }}>Updated {fmtTime(agentTasksLastUpdated)}</span>
              )}
              <button
                onClick={() => fetchAgentTasks()}
                disabled={agentTasksLoading}
                className="px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 disabled:opacity-50"
                style={{ background: C.surface2, border: `1px solid ${C.border}`, color: C.text }}
                data-testid="jobs-refresh"
              >
                <RefreshCw className={`w-3 h-3 ${agentTasksLoading ? "animate-spin" : ""}`} />
                Refresh
              </button>
            </div>
          </div>

          {/* Error banner */}
          {agentTasksError && (
            <div className="p-3 rounded-lg text-xs flex items-start gap-2"
                 style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", color: "#f87171" }}>
              <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              <div>
                <div className="font-medium">Could not reach agent runtime.</div>
                <div className="opacity-80 font-mono">{agentTasksError}</div>
              </div>
            </div>
          )}

          {/* Filter pills */}
          <div className="flex items-center gap-2 flex-wrap">
            <Filter className="w-3 h-3" style={{ color: C.muted }} />
            {FILTERS.map((f) => {
              const active = filter === f.id;
              const count = counts[f.id] ?? 0;
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setFilter(f.id)}
                  className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-medium transition-colors"
                  style={{
                    background: active ? `${C.accent}22` : C.surface2,
                    color: active ? C.text : C.muted,
                    border: `1px solid ${active ? `${C.accent}44` : C.border}`,
                  }}
                  data-testid={`jobs-filter-${f.id}`}
                >
                  <span>{f.label}</span>
                  <span className="text-[10px] font-mono opacity-80">{count}</span>
                </button>
              );
            })}
          </div>

          {/* Job list */}
          {agentTasksLoading && agentTasks.length === 0 ? (
            <div className="p-8 text-center rounded-xl text-sm" style={{ background: C.surface2, color: C.muted }}>
              <Loader2 className="w-4 h-4 animate-spin inline mr-2" />
              Loading jobs…
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-8 rounded-xl text-center text-sm" style={{ background: C.surface2, color: C.muted }}>
              {agentTasks.length === 0
                ? "No agent tasks yet. Run an individual agent or the full pipeline from /agents."
                : `No jobs match the "${FILTERS.find(f => f.id === filter)?.label || filter}" filter.`}
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map((task) => {
                const meta = AGENT_META[task.agent] || { label: task.agent || "?", color: "#6b7280", Icon: Activity };
                const Icon = meta.Icon;
                const statusKey = (task.status || "").toLowerCase();
                const status = STATUS_STYLE[statusKey] || defaultStatus;
                const StatusIcon = status.Icon;
                const duration = fmtDuration(task.startedAt || task.createdAt, task.completedAt);
                return (
                  <Link
                    key={task.id}
                    to="/agents"
                    state={{ taskId: task.id }}
                    className="p-3 rounded-xl flex items-center gap-3 transition-colors hover:opacity-90"
                    style={{ background: C.surface, border: `1px solid ${C.border}` }}
                    data-testid={`job-row-${task.id}`}
                  >
                    {/* Agent icon */}
                    <div
                      className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                      style={{ background: `${meta.color}18`, border: `1px solid ${meta.color}40` }}
                    >
                      <Icon className="w-4 h-4" style={{ color: meta.color }} />
                    </div>

                    {/* Body */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-[13px] font-semibold" style={{ color: C.text }}>{meta.label}</span>
                        <span
                          className="px-2 py-0.5 text-[10px] font-mono rounded-full flex items-center gap-1"
                          style={{ background: status.bg, color: status.fg, border: `1px solid ${status.fg}30` }}
                        >
                          <StatusIcon className={`w-3 h-3 ${status.spin ? "animate-spin" : ""}`} />
                          {status.label}
                        </span>
                        {task.phase && (
                          <span className="px-1.5 py-0.5 text-[9px] font-mono rounded uppercase tracking-wider"
                                style={{ background: C.surface2, color: C.muted, border: `1px solid ${C.border}` }}>
                            {task.phase}
                          </span>
                        )}
                        {task.pipelineId && (
                          <span className="text-[10px] font-mono" style={{ color: C.muted }}>
                            pipeline {task.pipelineId.slice(0, 6)}…
                          </span>
                        )}
                      </div>
                      <div className="text-[12px] truncate" style={{ color: C.text, opacity: 0.85 }}>
                        {previewPrompt(task.prompt)}
                      </div>
                      <div className="text-[10px] font-mono mt-0.5" style={{ color: C.muted }}>
                        {task.id ? `${task.id.slice(0, 8)}…` : "—"}
                        {" · "}
                        {fmtTime(task.startedAt || task.createdAt)}
                        {duration && <span> · took {duration}</span>}
                        {task.model && <span> · {task.model}</span>}
                      </div>
                    </div>

                    <ChevronRight className="w-4 h-4 shrink-0" style={{ color: C.muted }} />
                  </Link>
                );
              })}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
