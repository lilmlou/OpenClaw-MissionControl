import React, { useState } from "react";
import { ChevronDown, ChevronUp, Clock, Loader2, CheckCircle2, XCircle, ShieldCheck } from "lucide-react";
import { C } from "@/lib/constants";

const STATUS_STYLES = {
  pending:        { bg: "rgba(148,163,184,0.1)", fg: "#94a3b8", label: "Pending",  Icon: Clock,        spin: false },
  running:        { bg: "rgba(251,191,36,0.1)",  fg: "#fbbf24", label: "Running",  Icon: Loader2,      spin: true },
  done:           { bg: "rgba(34,197,94,0.1)",   fg: "#4ade80", label: "Done",     Icon: CheckCircle2, spin: false },
  failed:         { bg: "rgba(239,68,68,0.1)",   fg: "#f87171", label: "Failed",   Icon: XCircle,      spin: false },
  needs_approval: { bg: "rgba(168,85,247,0.1)",  fg: "#c084fc", label: "Needs Approval", Icon: ShieldCheck, spin: false },
};
const DEFAULT_STATUS = STATUS_STYLES.pending;

function fmtTime(ts) {
  if (!ts) return "—";
  const diff = Date.now() - ts;
  if (diff < 60_000) return `${Math.max(1, Math.floor(diff / 1000))}s ago`;
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function fmtDuration(start, end) {
  if (!start || !end) return null;
  const ms = end - start;
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60_000)}m`;
}

/**
 * AgentTaskCard
 * Standalone expandable card for a single agent task record.
 *
 * Props:
 *   task  — task object from /api/v2/agents/tasks
 *   color — optional accent hex for the agent
 *   Icon  — optional Lucide icon component for the agent
 */
export function AgentTaskCard({ task, color = "#64748b", Icon = Clock }) {
  const statusKey = (task.status || "").toLowerCase();
  const style = STATUS_STYLES[statusKey] || DEFAULT_STATUS;
  const StatusIcon = style.Icon;
  const duration = fmtDuration(task.createdAt, task.completedAt);
  const [resultOpen, setResultOpen] = useState(true);

  return (
    <div className="p-3 rounded-xl" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
      {/* Header */}
      <div className="flex items-start gap-3 mb-2">
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: `${color}18`, border: `1px solid ${color}40` }}
        >
          <Icon className="w-4 h-4" style={{ color }} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold capitalize" style={{ color: C.text }}>
              {task.agent || "agent"}
            </span>
            {task.phase && (
              <span
                className="px-1.5 py-0.5 text-[9px] font-mono rounded uppercase tracking-wider"
                style={{ background: C.surface2, color: C.muted, border: `1px solid ${C.border}` }}
              >
                {task.phase}
              </span>
            )}
            <span
              className="px-2 py-0.5 text-[10px] font-mono rounded-full flex items-center gap-1"
              style={{ background: style.bg, color: style.fg, border: `1px solid ${style.fg}30` }}
            >
              <StatusIcon className={`w-2.5 h-2.5 ${style.spin ? "animate-spin" : ""}`} />
              {style.label}
            </span>
          </div>
          <div className="text-[10px] font-mono mt-0.5 truncate" style={{ color: C.muted }}>
            {task.id ? `${task.id.slice(0, 8)}…` : "—"}
            {" · "}
            {fmtTime(task.createdAt)}
            {duration && <span> · took {duration}</span>}
            {task.parentId && <span> · pipeline {task.parentId.slice(0, 6)}…</span>}
          </div>
        </div>
      </div>

      {/* Prompt */}
      <div
        className="mb-2 p-2 rounded-lg text-[11px] leading-relaxed"
        style={{ background: C.surface2, color: C.text, border: `1px solid ${C.border}` }}
      >
        <div className="text-[9px] uppercase tracking-wider mb-0.5" style={{ color: C.muted }}>Prompt</div>
        <div className="whitespace-pre-wrap break-words">{task.prompt || "(no prompt)"}</div>
      </div>

      {/* Result */}
      {task.result ? (
        <div className="rounded-lg overflow-hidden" style={{ border: `1px solid ${C.border}` }}>
          <button
            type="button"
            onClick={() => setResultOpen((v) => !v)}
            className="w-full flex items-center justify-between px-2.5 py-1.5 text-[10px] uppercase tracking-wider transition-colors"
            style={{ background: C.surface2, color: C.muted }}
          >
            <span>Result</span>
            {resultOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
          {resultOpen && (
            <pre
              className="p-3 text-[11px] font-mono whitespace-pre-wrap break-words max-h-[200px] overflow-auto"
              style={{ background: "rgba(0,0,0,0.22)", color: "#e2e8f0", margin: 0 }}
            >
              {task.result}
            </pre>
          )}
        </div>
      ) : (
        <div
          className="text-[11px] italic px-2.5 py-2 rounded-lg"
          style={{
            color: statusKey === "failed" ? "#f87171" : C.muted,
            background: C.surface2,
            border: `1px dashed ${statusKey === "failed" ? "rgba(239,68,68,0.3)" : C.border}`,
          }}
        >
          {statusKey === "running"
            ? "Running…"
            : statusKey === "pending"
            ? "Queued…"
            : statusKey === "failed"
            ? "Failed without writing a result (likely a runtime crash or timeout)."
            : statusKey === "done"
            ? "Completed without producing output."
            : "Awaiting result"}
        </div>
      )}
    </div>
  );
}

export default AgentTaskCard;
