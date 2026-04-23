import React from "react";
import { CircleCheck, Clock3, HeartPulse, LoaderCircle, Square } from "lucide-react";
import { C } from "@/lib/constants";
import { useGateway } from "@/lib/useGateway";

function inferType(job) {
  const name = (job.name || "").toLowerCase();
  if (name.includes("heartbeat")) return "heartbeat";
  if (name.includes("backup") || name.includes("sync")) return "cron";
  return "agent-run";
}

function ago(ms) {
  if (!ms) return "just now";
  const diff = Date.now() - ms;
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  return `${Math.floor(m / 60)}h ago`;
}

export default function JobsPage() {
  const { jobs, cancelJob } = useGateway();

  return (
    <div className="p-6 space-y-4" style={{ color: C.text }}>
      <div>
        <h1 className="text-5xl font-bold tracking-tight">Jobs &amp; Schedules</h1>
        <p className="text-lg" style={{ color: C.muted }}>Agent runs, heartbeats, and cron schedules.</p>
      </div>

      <div className="space-y-2">
        {jobs.map((job) => {
          const type = inferType(job);
          const statusColor = job.status === "running" ? C.accent : job.status === "completed" ? C.green : C.muted;
          return (
          <div key={job.id} className="p-4 rounded-xl" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${statusColor}20` }}>
                {job.status === "running" ? <LoaderCircle className="w-4 h-4 animate-spin" style={{ color: statusColor }} /> :
                  job.status === "completed" ? <CircleCheck className="w-4 h-4" style={{ color: C.green }} /> :
                  <Clock3 className="w-4 h-4" style={{ color: C.muted }} />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[30px] leading-none font-semibold">{job.name || job.id}</span>
                  <span className="text-[12px] px-2 py-1 rounded-md" style={{ background: C.surface2, color: C.muted }}>{type}</span>
                  {type === "heartbeat" && <HeartPulse className="w-3.5 h-3.5" style={{ color: C.green }} />}
                </div>
                <div className="text-[12px]" style={{ color: C.muted }}>
                  Agent: {job.agent} · {job.status === "completed" ? `Completed ${ago(job.started)}` : `Started ${ago(job.started)}`}
                </div>
              </div>
              {job.status === "running" && (
                <div className="flex items-center gap-2">
                  <span className="text-sm font-mono" style={{ color: C.accent }}>{job.progress ?? 0}%</span>
                  <button onClick={() => cancelJob(job.id)} className="p-1.5 rounded-md hover:opacity-80 transition-opacity" style={{ color: C.red }} title="Cancel job">
                    <Square className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>
            {job.status === "running" && (
              <div className="mt-3 h-1 rounded-full overflow-hidden" style={{ background: C.surface2 }}>
                <div className="h-full rounded-full transition-all" style={{ width: `${job.progress ?? 0}%`, background: C.accent }} />
              </div>
            )}
          </div>
        );})}
      </div>
    </div>
  );
}
