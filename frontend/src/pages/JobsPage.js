import React, { useState, useEffect } from "react";
import { Briefcase, Square, CheckCircle, XCircle, Clock } from "lucide-react";
import { C } from "@/lib/constants";
import { useGateway } from "@/lib/useGateway";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

export default function JobsPage() {
  const { jobs, cancelJob } = useGateway();
  const getStatusColor = (s) => { switch (s) { case "running": return "#3b82f6"; case "completed": return C.green; case "failed": return C.red; case "cancelled": return "#888"; default: return C.muted; } };

  const runningJobs = jobs.filter(j => j.status === "running");
  const completedJobs = jobs.filter(j => j.status !== "running");

  const [tick, setTick] = useState(0);
  useEffect(() => { const iv = setInterval(() => setTick(t => t + 1), 3000); return () => clearInterval(iv); }, []);

  return (
    <div className="h-full overflow-auto" style={{ color: C.text }}>
      <div className="max-w-3xl mx-auto px-6 py-6">
        <div className="flex items-center justify-between mb-6">
          <div><h1 className="text-2xl font-bold">Jobs</h1><p className="text-sm" style={{ color: C.muted }}>Monitor active and completed tasks</p></div>
          {runningJobs.length > 0 && (
            <span className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full" style={{ background: "rgba(59,130,246,0.1)", color: "#3b82f6", border: "1px solid rgba(59,130,246,0.2)" }}>
              <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: "#3b82f6" }} />{runningJobs.length} active
            </span>
          )}
        </div>
        {runningJobs.length > 0 && (
          <div className="mb-6">
            <h2 className="text-sm font-medium mb-3" style={{ color: C.muted }}>Active</h2>
            <div className="space-y-3">
              {runningJobs.map(job => (
                <div key={job.id} className="p-4 rounded-xl" style={{ background: C.surface, border: "1px solid rgba(59,130,246,0.2)" }}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3"><div className="w-2 h-2 rounded-full animate-pulse" style={{ background: "#3b82f6" }} /><div><div className="font-medium">{job.name}</div><div className="text-xs" style={{ color: C.muted }}>Agent: {job.agent}</div></div></div>
                    <div className="flex items-center gap-2"><span className="text-xs font-mono" style={{ color: "#3b82f6" }}>{Math.min(job.progress + tick, 99)}%</span><Button variant="ghost" size="sm" onClick={() => cancelJob(job.id)} style={{ color: C.red }} data-testid={`cancel-job-${job.id}`}><Square className="w-3.5 h-3.5" /></Button></div>
                  </div>
                  <Progress value={Math.min(job.progress + tick, 99)} className="h-1.5" />
                </div>
              ))}
            </div>
          </div>
        )}
        {completedJobs.length > 0 && (
          <div>
            <h2 className="text-sm font-medium mb-3" style={{ color: C.muted }}>History</h2>
            <div className="space-y-2">
              {completedJobs.map(job => (
                <div key={job.id} className="p-3 rounded-xl flex items-center justify-between" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
                  <div className="flex items-center gap-3">
                    {job.status === "completed" ? <CheckCircle className="w-4 h-4" style={{ color: C.green }} /> : job.status === "failed" ? <XCircle className="w-4 h-4" style={{ color: C.red }} /> : <Clock className="w-4 h-4" style={{ color: C.muted }} />}
                    <div><div className="text-sm">{job.name}</div><div className="text-[11px]" style={{ color: C.muted }}>Agent: {job.agent}</div></div>
                  </div>
                  <span className="text-xs px-2 py-1 rounded-full capitalize" style={{ background: `${getStatusColor(job.status)}20`, color: getStatusColor(job.status) }}>{job.status}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        {jobs.length === 0 && (<div className="text-center py-16"><Briefcase className="w-10 h-10 mx-auto mb-3" style={{ color: "#333" }} /><p className="text-sm" style={{ color: C.muted }}>No jobs yet</p></div>)}
      </div>
    </div>
  );
}
