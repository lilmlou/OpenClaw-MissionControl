import React, { useEffect, useMemo, useState } from "react";
import { Check, Clock3, ShieldAlert, XCircle, AlertTriangle, RefreshCw } from "lucide-react";
import { C } from "@/lib/constants";
import { useGateway } from "@/lib/useGateway";

const MODE_OPTIONS = ["default", "acceptEdits", "bypassPermissions", "plan", "auto"];

const FILTERS = [
  { id: "pending",  label: "Pending"  },
  { id: "resolved", label: "Resolved" },
  { id: "all",      label: "All"      },
];

function fmt(ts) {
  if (!ts) return "-";
  const t = typeof ts === "number" ? ts : Date.parse(ts);
  if (Number.isNaN(t)) return "-";
  const diff = Date.now() - t;
  if (diff < 60_000) return `${Math.max(1, Math.floor(diff / 1000))}s ago`;
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return new Date(t).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return new Date(t).toLocaleString();
}

// Project pending requests to "expired" if they have an expiresAt that's
// in the past. Mirrors the reference panel pattern — a pending row that
// can never be resolved should not look like it's still actionable.
function withExpired(approvals) {
  const now = Date.now();
  return approvals.map((a) => {
    if (a.status === "pending" && a.expiresAt && Date.parse(a.expiresAt) < now) {
      return { ...a, status: "expired" };
    }
    return a;
  });
}

export default function ApprovalsPage() {
  const {
    approvals,
    approvalHistory,
    approvalsBackend,
    approvalsLoading,
    approvalsWsConnected,
    approvalModesBySession,
    fetchPendingApprovals,
    fetchApprovalHistory,
    fetchSessionPermissionState,
    setSessionPermissionMode,
    approveRequest,
    rejectRequest,
    connectApprovalsWebSocket,
  } = useGateway();
  const [activeSession, setActiveSession] = useState("");
  const [filter, setFilter] = useState("pending");

  useEffect(() => {
    fetchPendingApprovals();
    fetchApprovalHistory();
    connectApprovalsWebSocket();
  }, [fetchPendingApprovals, fetchApprovalHistory, connectApprovalsWebSocket]);

  const sessions = useMemo(() => {
    const ids = new Set();
    approvals.forEach((a) => a.sessionId && ids.add(a.sessionId));
    approvalHistory.forEach((h) => h.session_id && ids.add(h.session_id));
    return Array.from(ids);
  }, [approvals, approvalHistory]);

  useEffect(() => {
    if (!activeSession && sessions.length > 0) setActiveSession(sessions[0]);
  }, [sessions, activeSession]);

  useEffect(() => {
    if (activeSession && approvalsBackend === "v2") {
      fetchSessionPermissionState(activeSession);
    }
  }, [activeSession, approvalsBackend, fetchSessionPermissionState]);

  const projected = useMemo(() => withExpired(approvals), [approvals]);
  const pending = useMemo(() => projected.filter((a) => a.status === "pending"), [projected]);
  const expired = useMemo(() => projected.filter((a) => a.status === "expired"), [projected]);

  // What to render in the main list, controlled by the filter tabs.
  const displayList = useMemo(() => {
    if (filter === "pending") return pending;
    if (filter === "resolved") return projected.filter((a) => a.status !== "pending" && a.status !== "expired");
    return projected; // all
  }, [filter, projected, pending]);

  const counts = {
    pending: pending.length,
    resolved: projected.filter((a) => a.status !== "pending" && a.status !== "expired").length,
    all: projected.length,
  };

  return (
    <div className="h-full flex flex-col" style={{ color: C.text }}>
      <div className="flex-1 overflow-y-auto">
        <div className="p-6 space-y-5 max-w-4xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Approvals</h1>
        <p className="text-sm" style={{ color: C.muted }}>
          Runtime permission requests with v2 backend wiring and legacy fallback.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[11px] px-2 py-1 rounded-md" style={{ background: C.surface2, color: C.muted }}>
          backend: {approvalsBackend}
        </span>
        <span className="text-[11px] px-2 py-1 rounded-md flex items-center gap-1.5"
              style={{ background: C.surface2, color: approvalsWsConnected ? C.green : C.muted }}>
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: approvalsWsConnected ? C.green : C.muted }} />
          ws: {approvalsWsConnected ? "connected" : "disconnected"}
        </span>
        <span className="text-[11px] px-2 py-1 rounded-md" style={{ background: C.surface2, color: C.muted }}>
          pending: {pending.length}
        </span>
        {expired.length > 0 && (
          <span className="text-[11px] px-2 py-1 rounded-md flex items-center gap-1"
                style={{ background: "rgba(251,191,36,0.12)", color: "#fbbf24", border: "1px solid rgba(251,191,36,0.3)" }}>
            <AlertTriangle className="w-3 h-3" /> expired: {expired.length}
          </span>
        )}
        <button
          type="button"
          onClick={() => { fetchPendingApprovals(); fetchApprovalHistory(); }}
          disabled={approvalsLoading}
          className="ml-auto px-2.5 py-1 rounded-md text-[11px] flex items-center gap-1 disabled:opacity-50"
          style={{ background: C.surface2, color: C.muted, border: `1px solid ${C.border}` }}
          data-testid="approvals-refresh"
        >
          <RefreshCw className={`w-3 h-3 ${approvalsLoading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {/* Filter tabs (merged from reference exec-approval-panel.tsx) */}
      <div className="flex items-center gap-1">
        {FILTERS.map((f) => {
          const active = filter === f.id;
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
              data-testid={`approvals-filter-${f.id}`}
            >
              <span>{f.label}</span>
              <span className="text-[10px] font-mono opacity-80">{counts[f.id] ?? 0}</span>
            </button>
          );
        })}
      </div>

      <div className="p-4 rounded-xl space-y-3" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-4 h-4" style={{ color: C.accent }} />
          <span className="text-sm font-semibold">Permission Mode</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={activeSession}
            onChange={(e) => setActiveSession(e.target.value)}
            className="px-2 py-1.5 rounded-md text-sm"
            style={{ background: C.surface2, border: `1px solid ${C.border}` }}
          >
            <option value="">Select session</option>
            {sessions.map((id) => (
              <option key={id} value={id}>{id}</option>
            ))}
          </select>
          <select
            value={approvalModesBySession[activeSession] || "default"}
            onChange={(e) => activeSession && setSessionPermissionMode(activeSession, e.target.value)}
            disabled={!activeSession || approvalsBackend !== "v2"}
            className="px-2 py-1.5 rounded-md text-sm disabled:opacity-50"
            style={{ background: C.surface2, border: `1px solid ${C.border}` }}
          >
            {MODE_OPTIONS.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
          {approvalsBackend !== "v2" && (
            <span className="text-[11px]" style={{ color: C.muted }}>
              mode selector requires v2 backend.
            </span>
          )}
        </div>
      </div>

      <div className="p-4 rounded-xl space-y-3" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
        <div className="flex items-center gap-2">
          <Clock3 className="w-4 h-4" style={{ color: C.accent }} />
          <span className="text-sm font-semibold">{filter === "pending" ? "Pending Requests" : filter === "resolved" ? "Resolved" : "All Requests"}</span>
        </div>
        {approvalsLoading && displayList.length === 0 && (
          <div className="text-sm" style={{ color: C.muted }}>Loading approvals...</div>
        )}
        {!approvalsLoading && displayList.length === 0 && (
          <div className="text-sm" style={{ color: C.muted }}>
            {filter === "pending"
              ? "All caught up — no pending approvals."
              : filter === "resolved"
              ? "No resolved approvals yet."
              : "No approvals."}
          </div>
        )}
        <div className="space-y-2">
          {displayList.map((a) => {
            const isPending = a.status === "pending";
            const isExpired = a.status === "expired";
            const statusColor = isPending ? C.accent : isExpired ? "#fbbf24" : a.status === "approved" ? C.green : C.red;
            return (
              <div key={a.id} className="p-3 rounded-lg" style={{ background: C.surface2, border: `1px solid ${C.border}` }}>
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-sm font-semibold truncate">{a.title}</span>
                      <span className="text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded shrink-0"
                            style={{ background: `${statusColor}22`, color: statusColor, border: `1px solid ${statusColor}44` }}>
                        {a.status}
                      </span>
                    </div>
                    <div className="text-xs" style={{ color: C.muted }}>{a.description}</div>
                    <div className="text-[11px] mt-1 font-mono truncate" style={{ color: C.muted }}>
                      {a.id?.slice(0, 8)}…
                      {a.sessionId && ` · ${String(a.sessionId).slice(0, 8)}…`}
                      {a.toolName && ` · ${a.toolName}`}
                      {a.expiresAt && isPending && ` · expires ${fmt(a.expiresAt)}`}
                    </div>
                  </div>
                  {isPending && (
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => approveRequest(a.id, "once")}
                        className="px-2 py-1.5 text-xs rounded-md flex items-center gap-1"
                        style={{ background: "rgba(34,197,94,0.15)", color: C.green, border: "1px solid rgba(34,197,94,0.3)" }}
                        data-testid={`approval-allow-${a.id}`}
                      >
                        <Check className="w-3 h-3" /> Allow
                      </button>
                      {approvalsBackend === "v2" && (
                        <button
                          onClick={() => approveRequest(a.id, "always")}
                          className="px-2 py-1.5 text-xs rounded-md"
                          style={{ background: "rgba(29,140,248,0.15)", color: C.accent, border: "1px solid rgba(29,140,248,0.3)" }}
                          data-testid={`approval-always-${a.id}`}
                        >
                          Always
                        </button>
                      )}
                      <button
                        onClick={() => rejectRequest(a.id)}
                        className="px-2 py-1.5 text-xs rounded-md flex items-center gap-1"
                        style={{ background: "rgba(239,68,68,0.15)", color: C.red, border: "1px solid rgba(239,68,68,0.3)" }}
                        data-testid={`approval-deny-${a.id}`}
                      >
                        <XCircle className="w-3 h-3" /> Deny
                      </button>
                    </div>
                  )}
                  {isExpired && (
                    <span className="text-[10px] uppercase tracking-wider shrink-0"
                          style={{ color: "#fbbf24" }}>
                      Expired before resolution
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="p-4 rounded-xl space-y-3" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
        <div className="flex items-center gap-2">
          <Clock3 className="w-4 h-4" style={{ color: C.accent }} />
          <span className="text-sm font-semibold">Approval History</span>
        </div>
        {approvalHistory.length === 0 && <div className="text-sm" style={{ color: C.muted }}>No resolved approvals yet.</div>}
        <div className="space-y-2 max-h-72 overflow-y-auto">
          {approvalHistory.map((h, idx) => (
            <div key={`${h.id || "hist"}-${idx}`} className="p-2 rounded-md text-xs" style={{ background: C.surface2, border: `1px solid ${C.border}` }}>
              <div className="font-mono" style={{ color: C.text }}>{h.id || "-"}</div>
              <div style={{ color: C.muted }}>
                {h.tool_name || "tool"} • {h.session_id || "session"} • {h.decision || "decision"} • {fmt(h.resolved_at)}
              </div>
            </div>
          ))}
        </div>
      </div>
        </div>
      </div>
    </div>
  );
}
