import React, { useEffect, useMemo, useState } from "react";
import { Check, Clock3, ShieldAlert, XCircle } from "lucide-react";
import { C } from "@/lib/constants";
import { useGateway } from "@/lib/useGateway";

const MODE_OPTIONS = ["default", "acceptEdits", "bypassPermissions", "plan", "auto"];

function fmt(ts) {
  if (!ts) return "-";
  const t = Date.parse(ts);
  if (Number.isNaN(t)) return "-";
  return new Date(t).toLocaleString();
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

  const pending = approvals.filter((a) => a.status === "pending");

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
        <span className="text-[11px] px-2 py-1 rounded-md" style={{ background: C.surface2, color: approvalsWsConnected ? C.green : C.muted }}>
          ws: {approvalsWsConnected ? "connected" : "disconnected"}
        </span>
        <span className="text-[11px] px-2 py-1 rounded-md" style={{ background: C.surface2, color: C.muted }}>
          pending: {pending.length}
        </span>
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
          <span className="text-sm font-semibold">Pending Requests</span>
        </div>
        {approvalsLoading && <div className="text-sm" style={{ color: C.muted }}>Loading approvals...</div>}
        {!approvalsLoading && pending.length === 0 && (
          <div className="text-sm" style={{ color: C.muted }}>All caught up - no pending approvals.</div>
        )}
        <div className="space-y-2">
          {pending.map((a) => (
            <div key={a.id} className="p-3 rounded-lg" style={{ background: C.surface2, border: `1px solid ${C.border}` }}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold">{a.title}</div>
                  <div className="text-xs" style={{ color: C.muted }}>{a.description}</div>
                  <div className="text-[11px] mt-1" style={{ color: C.muted }}>
                    id: {a.id} {a.sessionId ? `• session: ${a.sessionId}` : ""} {a.toolName ? `• tool: ${a.toolName}` : ""}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => approveRequest(a.id, "once")}
                    className="px-2 py-1.5 text-xs rounded-md flex items-center gap-1"
                    style={{ background: "rgba(34,197,94,0.15)", color: C.green, border: "1px solid rgba(34,197,94,0.3)" }}
                  >
                    <Check className="w-3 h-3" /> Allow
                  </button>
                  {approvalsBackend === "v2" && (
                    <button
                      onClick={() => approveRequest(a.id, "always")}
                      className="px-2 py-1.5 text-xs rounded-md"
                      style={{ background: "rgba(29,140,248,0.15)", color: C.accent, border: "1px solid rgba(29,140,248,0.3)" }}
                    >
                      Always
                    </button>
                  )}
                  <button
                    onClick={() => rejectRequest(a.id)}
                    className="px-2 py-1.5 text-xs rounded-md flex items-center gap-1"
                    style={{ background: "rgba(239,68,68,0.15)", color: C.red, border: "1px solid rgba(239,68,68,0.3)" }}
                  >
                    <XCircle className="w-3 h-3" /> Deny
                  </button>
                </div>
              </div>
            </div>
          ))}
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
