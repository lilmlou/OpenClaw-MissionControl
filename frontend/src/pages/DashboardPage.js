import React, { useEffect } from "react";
import { Activity, AlertTriangle, Briefcase, Laptop, Lock, MessageSquareText, ShieldAlert, Terminal, Server, AlertCircle } from "lucide-react";
import { C } from "@/lib/constants";
import { useGateway } from "@/lib/useGateway";
import { ActivityFeedPane } from "@/components/ActivityFeedPane";

function eventText(evt) {
  if (evt.text) return evt.text;
  if (evt.payload?.content) return evt.payload.content;
  if (evt.payload?.command) return `Command: ${evt.payload.command}`;
  return "Runtime event";
}

// Map backend service status enum → existing C palette colour.
// Spec: BACKEND_REQUESTS.md /system/services — 7 status values.
function statusColor(status) {
  switch (status) {
    case "connected":    return C.green;
    case "disconnected": return C.red;
    case "rate_limited": return C.yellow;
    case "auth_failed":  return C.orange;
    case "corrupted":    return C.red;
    case "locked":       return C.yellow;
    default:             return C.muted; // unknown / anything else
  }
}

function relativeTime(ts) {
  if (!ts) return "—";
  const secs = Math.max(0, Math.round((Date.now() - ts) / 1000));
  if (secs < 5) return "just now";
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  return `${Math.round(mins / 60)}h ago`;
}

export default function DashboardPage() {
  const { status, jobs, events, threads, approvals, connectors,
          systemServices, systemServicesLoading, systemServicesError,
          systemServicesLastUpdated, fetchSystemServices } = useGateway();

  // Poll /api/v2/system/services every 8s when tab is visible.
  // Initial fetch is non-silent (spinner). Subsequent polls are silent
  // so the UI doesn't flash. Paused via document.visibilityState per
  // BACKEND_REQUESTS.md guidance.
  useEffect(() => {
    let cancelled = false;
    const tick = (silent) => {
      if (cancelled) return;
      if (document.visibilityState !== "visible") return;
      fetchSystemServices({ silent }).catch(() => null);
    };
    tick(false);
    const id = setInterval(() => tick(true), 8000);
    const onVis = () => { if (document.visibilityState === "visible") tick(true); };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      cancelled = true;
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [fetchSystemServices]);

  const pendingApprovals = approvals.filter((a) => a.status === "pending").length;
  const runningJobs = jobs.filter((j) => j.status === "running").length;
  const activeNodes = connectors.mac || connectors.desktop ? 1 : 0;
  const execPolicy = { security: "allowlist", askMode: "on-miss", fallback: "deny" };

  const cards = [
    { label: "Gateway", value: status, icon: Activity, sub: "v847", color: C.green },
    { label: "Pending Approvals", value: pendingApprovals, icon: ShieldAlert, sub: pendingApprovals > 0 ? "Action required" : "All clear", color: pendingApprovals > 0 ? C.red : C.green },
    { label: "Active Jobs", value: runningJobs, icon: Briefcase, sub: `${jobs.length} total`, color: C.accent },
    { label: "Sessions", value: threads.length, icon: MessageSquareText, sub: "state active", color: C.accent },
    { label: "Events", value: events.length, icon: Terminal, sub: "in-memory", color: C.muted },
    { label: "Nodes", value: activeNodes, icon: Laptop, sub: activeNodes > 0 ? "paired" : "none", color: activeNodes > 0 ? C.green : C.muted },
  ];

  return (
    <div className="h-full flex flex-col" style={{ color: C.text }}>
      <div className="flex-1 overflow-y-auto">
        <div className="p-6 space-y-5 max-w-6xl mx-auto">
      <div>
        <h1 className="text-4xl font-bold tracking-tight">Mission Control</h1>
        <p className="text-lg" style={{ color: C.muted }}>Real-time operational view of your OpenClaw runtime.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="p-4 rounded-xl" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: `${card.color}20` }}>
                  <Icon className="w-4 h-4" style={{ color: card.color }} />
                </div>
                <div>
                  <div className="text-3xl leading-none font-semibold mt-0.5 capitalize">{String(card.value)}</div>
                  <div className="text-[11px] uppercase tracking-wide" style={{ color: C.muted }}>{card.label}</div>
                  <div className="text-[11px] mt-1" style={{ color: C.muted }}>{card.sub}</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="p-4 rounded-xl" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
        <div className="flex items-center gap-2 mb-3">
          <Lock className="w-4 h-4" style={{ color: C.accent }} />
          <span className="text-[13px] font-semibold">Exec Policy</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {[
            { label: "Security", val: execPolicy.security, color: C.yellow },
            { label: "Ask Mode", val: execPolicy.askMode, color: C.green },
            { label: "Fallback", val: execPolicy.fallback, color: C.green },
          ].map((p) => (
            <div key={p.label} className="p-3 rounded-lg" style={{ background: C.surface2 }}>
              <div className="text-[10px] uppercase tracking-wider mb-1" style={{ color: C.muted }}>{p.label}</div>
              <div className="text-[24px] leading-none font-mono" style={{ color: p.color }}>{p.val}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Services — wired to GET /api/v2/system/services, 8s poll, visibility-paused */}
      <div className="p-4 rounded-xl" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Server className="w-4 h-4" style={{ color: C.accent }} />
            <span className="text-[13px] font-semibold">Services</span>
          </div>
          <span className="text-[11px]" style={{ color: C.muted }}>
            {systemServicesError
              ? <span style={{ color: C.red }}>error · {systemServicesError}</span>
              : systemServicesLoading && systemServices.length === 0
                ? "loading…"
                : `updated ${relativeTime(systemServicesLastUpdated)}`}
          </span>
        </div>
        <div className="space-y-1.5">
          {systemServices.length === 0 && !systemServicesLoading && !systemServicesError && (
            <div className="text-[12px] p-2 rounded-lg" style={{ color: C.muted, background: C.surface2 }}>
              No services reported.
            </div>
          )}
          {systemServices.map((svc) => {
            const color = statusColor(svc.status);
            const corrupted = svc.status === "corrupted";
            const detail = svc.detail || svc.url || "";
            return (
              <div key={svc.name} className="flex items-center gap-3 py-1.5 px-2 rounded-md"
                   style={{ background: C.surface2 }}>
                <span className="shrink-0 rounded-full" style={{ width: 7, height: 7, background: color }} />
                <span className="text-[12px] font-medium capitalize shrink-0" style={{ color: C.text, minWidth: 96 }}>
                  {svc.name}
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-md uppercase tracking-wide shrink-0 inline-flex items-center gap-1"
                      style={{ background: `${color}20`, color, border: `1px solid ${color}33` }}>
                  {corrupted && <AlertCircle className="w-3 h-3" />}
                  {svc.status || "unknown"}
                </span>
                <span className="text-[11px] flex-1 truncate" style={{ color: C.muted }} title={detail}>
                  {detail}
                </span>
                <span className="text-[10px] shrink-0 font-mono" style={{ color: C.muted }}>
                  {relativeTime(svc.lastCheck)}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="p-4 rounded-xl" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
        <div className="flex items-center justify-between mb-3">
          <span className="text-[13px] font-semibold">Live Activity</span>
          <span className="text-[11px] px-2.5 py-1 rounded-lg" style={{ background: "rgba(34,197,94,0.1)", color: C.green, border: "1px solid rgba(34,197,94,0.2)" }}>streaming</span>
        </div>
        <div className="space-y-1 max-h-60 overflow-y-auto">
          {[...events].reverse().slice(0, 12).map((evt) => {
            const level = String(evt.type || "").includes("error") ? "error" : String(evt.type || "").includes("warn") ? "warn" : "info";
            const color = level === "error" ? C.red : level === "warn" ? C.yellow : C.muted;
            return (
              <div key={evt.id} className="flex items-start gap-2 py-1.5 px-2 rounded-md">
                <span className="mt-1 shrink-0 rounded-full" style={{ width: 5, height: 5, background: color }} />
                <span className="text-[11px] font-mono shrink-0" style={{ color: C.muted, minWidth: 68 }}>
                  {new Date(evt.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-md capitalize" style={{ background: C.surface2, color: C.muted }}>{evt.type || "event"}</span>
                <span className="text-[11px] flex-1" style={{ color }}>{eventText(evt)}</span>
              </div>
            );
          })}
          {events.length === 0 && (
            <div className="text-[12px] p-2 rounded-lg" style={{ color: C.muted, background: C.surface2 }}>
              No events yet.
            </div>
          )}
        </div>
        {pendingApprovals > 0 && (
          <div className="mt-3 flex items-center gap-2 p-2 rounded-lg" style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}>
            <AlertTriangle className="w-3.5 h-3.5" style={{ color: C.red }} />
            <span className="text-[11px]" style={{ color: C.red }}>Pending approvals require review.</span>
          </div>
        )}
      </div>

      {/* 5-minute agent activity feed — wired to /api/v2/agents/tasks?since= */}
      <ActivityFeedPane />

        </div>
      </div>
    </div>
  );
}
