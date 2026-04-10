import React from "react";
import { Briefcase, AlertTriangle, Layers, Radio, Cpu } from "lucide-react";
import { C } from "@/lib/constants";
import { useGateway } from "@/lib/useGateway";

export default function DashboardPage() {
  const { jobs, approvals, connectors, status, activeModel, events } = useGateway();
  const runningJobs = jobs.filter(j => j.status === "running").length;
  const pendingApprovals = approvals.filter(a => a.status === "pending").length;
  const activeConnectors = Object.values(connectors).filter(Boolean).length;
  const stats = [
    { label: "Active Jobs", value: runningJobs, icon: Briefcase, color: C.accent },
    { label: "Pending Approvals", value: pendingApprovals, icon: AlertTriangle, color: C.yellow },
    { label: "Connectors", value: activeConnectors, icon: Layers, color: C.green },
    { label: "Gateway", value: status, icon: Radio, color: status === "connected" ? C.green : C.yellow },
  ];
  return (
    <div className="p-6 space-y-6" style={{ color: C.text }}>
      <h1 className="text-2xl font-bold">Mission Control Dashboard</h1>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map(stat => (
          <div key={stat.label} className="p-4 rounded-xl" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: `${stat.color}20` }}><stat.icon className="w-5 h-5" style={{ color: stat.color }} /></div>
              <div><div className="text-2xl font-bold">{stat.value}</div><div className="text-xs" style={{ color: C.muted }}>{stat.label}</div></div>
            </div>
          </div>
        ))}
      </div>
      <div className="p-4 rounded-xl" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
        <div className="flex items-center justify-between"><div><div className="text-sm font-medium mb-1">Active Model</div><div className="text-lg" style={{ color: C.accent }}>{activeModel || "None selected"}</div></div><Cpu className="w-8 h-8" style={{ color: C.muted }} /></div>
      </div>
      <div className="p-4 rounded-xl" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
        <h2 className="text-sm font-medium mb-3">Recent Events</h2>
        <div className="space-y-2 max-h-48 overflow-auto">
          {events.length === 0 ? <div className="text-sm" style={{ color: C.muted }}>No events yet</div> : events.slice(-10).reverse().map(evt => (
            <div key={evt.id} className="flex items-center gap-2 text-xs"><span className="w-1.5 h-1.5 rounded-full" style={{ background: C.accent }} /><span style={{ color: C.accent }}>{evt.type}</span><span style={{ color: C.muted }}>{new Date(evt.ts).toLocaleTimeString()}</span></div>
          ))}
        </div>
      </div>
    </div>
  );
}
