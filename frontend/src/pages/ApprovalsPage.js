import React from "react";
import { Shield, Check, X, CheckCircle } from "lucide-react";
import { C } from "@/lib/constants";
import { useGateway } from "@/lib/useGateway";
import { Button } from "@/components/ui/button";

export default function ApprovalsPage() {
  const { approvals, approveRequest, rejectRequest } = useGateway();
  const getRiskColor = (risk) => { switch (risk) { case "low": return C.green; case "medium": return C.yellow; case "high": return C.red; default: return C.muted; } };
  const getStatusBadge = (status) => { const colors = { pending: { bg: `${C.yellow}20`, color: C.yellow }, approved: { bg: `${C.green}20`, color: C.green }, rejected: { bg: `${C.red}20`, color: C.red } }; return colors[status] || colors.pending; };
  const pendingCount = approvals.filter(a => a.status === "pending").length;
  return (
    <div className="h-full overflow-auto" style={{ color: C.text }}>
      <div className="max-w-3xl mx-auto px-6 py-6">
        <div className="flex items-center justify-between mb-6">
          <div><h1 className="text-2xl font-bold">Approvals</h1><p className="text-sm" style={{ color: C.muted }}>Review and manage agent permission requests</p></div>
          {pendingCount > 0 && (
            <span className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full" style={{ background: "rgba(251,191,36,0.1)", color: "#fbbf24", border: "1px solid rgba(251,191,36,0.2)" }} data-testid="pending-count-badge">
              <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: "#fbbf24" }} />{pendingCount} pending
            </span>
          )}
        </div>
        {approvals.length === 0 ? (
          <div className="text-center py-16"><Shield className="w-10 h-10 mx-auto mb-3" style={{ color: "#333" }} /><p className="text-sm" style={{ color: C.muted }}>No approval requests yet</p></div>
        ) : (
          <div className="space-y-3">
            {approvals.map(approval => (
              <div key={approval.id} className="p-4 rounded-xl" style={{ background: C.surface, border: `1px solid ${C.border}` }} data-testid={`approval-card-${approval.id}`}>
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-3"><Shield className="w-5 h-5" style={{ color: getRiskColor(approval.risk) }} /><div><div className="font-medium">{approval.title}</div><div className="text-sm" style={{ color: C.muted }}>{approval.description}</div></div></div>
                  <span className="text-xs px-2 py-1 rounded-full capitalize" style={getStatusBadge(approval.status)}>{approval.status}</span>
                </div>
                <div className="flex items-center justify-between mt-3">
                  <div className="flex items-center gap-4 text-xs" style={{ color: C.muted }}><span>Agent: {approval.agent}</span><span>Risk: <span style={{ color: getRiskColor(approval.risk) }}>{approval.risk}</span></span></div>
                  {approval.status === "pending" && <div className="flex gap-2"><Button size="sm" onClick={() => approveRequest(approval.id)} style={{ background: C.green }} data-testid={`approve-${approval.id}`}><Check className="w-4 h-4 mr-1" /> Approve</Button><Button size="sm" variant="outline" onClick={() => rejectRequest(approval.id)} style={{ borderColor: C.red, color: C.red }} data-testid={`reject-${approval.id}`}><X className="w-4 h-4 mr-1" /> Reject</Button></div>}
                </div>
              </div>
            ))}
            {pendingCount === 0 && (
              <div className="text-center py-8 mt-4"><CheckCircle className="w-8 h-8 mx-auto mb-2" style={{ color: C.green }} /><p className="text-sm" style={{ color: C.muted }}>All caught up — no pending approvals</p></div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
