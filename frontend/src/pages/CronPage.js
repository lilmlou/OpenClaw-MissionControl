import React, { useEffect, useMemo, useState } from "react";
import {
  Calendar, Play, Pause, RefreshCw, ChevronDown, ChevronRight,
  CheckCircle2, XCircle, Loader2, Clock, AlertCircle, Lock, Trash2,
  Brain, Hammer, Eye, FileCheck, Activity, Wrench, Layers,
} from "lucide-react";
import { C } from "@/lib/constants";
import { useGateway } from "@/lib/useGateway";

// /cron — Schedule manager.
//
// Wires to Sprint 3 backend (cron management endpoints, shipped):
//   GET    /api/v2/cron/jobs                  → list
//   PATCH  /api/v2/cron/jobs/:id              → toggle enabled / edit
//   POST   /api/v2/cron/jobs/:id/run-now      → manual trigger
//   GET    /api/v2/cron/runs?cron_job_id=     → recent runs
//   WS     /api/ws/agents (cron.* broadcasts) → live updates
//
// Phase 1 (this commit): list + toggle + run-now + inspector with run history.
// Phase 2 (separate): New Schedule modal, Edit modal, cron-parser preview.

const AGENT_META = {
  planner:    { color: "#3b82f6", Icon: Brain      },
  executor:   { color: "#eab308", Icon: Hammer     },
  supervisor: { color: "#22c55e", Icon: Eye        },
  auditor:    { color: "#a855f7", Icon: FileCheck  },
  watcher:    { color: "#6b7280", Icon: Activity   },
  builder:    { color: "#f97316", Icon: Wrench     },
  meta:       { color: "#ec4899", Icon: Layers     },
};

const RUN_STATUS_STYLE = {
  done:    { bg: "rgba(34,197,94,0.14)",  fg: "#4ade80", Icon: CheckCircle2, label: "DONE" },
  running: { bg: "rgba(251,191,36,0.16)", fg: "#fbbf24", Icon: Loader2,      label: "RUNNING", spin: true },
  failed:  { bg: "rgba(239,68,68,0.16)",  fg: "#f87171", Icon: XCircle,      label: "FAILED" },
  pending: { bg: "rgba(148,163,184,0.14)", fg: "#94a3b8", Icon: Clock,       label: "PENDING" },
};

function fmtTime(ts) {
  if (!ts) return "—";
  const diff = Date.now() - ts;
  if (Math.abs(diff) < 60_000) return diff > 0 ? `${Math.max(1, Math.floor(diff / 1000))}s ago` : `in ${Math.max(1, Math.floor(-diff / 1000))}s`;
  if (Math.abs(diff) < 3_600_000) {
    const mins = Math.floor(Math.abs(diff) / 60_000);
    return diff > 0 ? `${mins}m ago` : `in ${mins}m`;
  }
  if (Math.abs(diff) < 86_400_000) {
    return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  return new Date(ts).toLocaleDateString([], { month: "short", day: "numeric" });
}

function fmtDuration(start, end) {
  if (!start || !end) return null;
  const ms = end - start;
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60_000)}m`;
}

// Naive cron-to-human translator. Catches the common cases the backend
// uses; falls back to the raw expression. A proper cron parser belongs
// in a follow-up commit (cron-parser dep), not blocking this one.
function humanCron(expr) {
  if (!expr) return "—";
  const e = expr.trim();
  // Every N seconds (non-standard 6-field; backend examples use 5)
  if (e === "*/5 * * * *")  return "Every 5 minutes";
  if (e === "*/10 * * * *") return "Every 10 minutes";
  if (e === "*/15 * * * *") return "Every 15 minutes";
  if (e === "*/30 * * * *") return "Every 30 minutes";
  if (e === "0 * * * *")    return "Every hour";
  if (e === "0 */2 * * *")  return "Every 2 hours";
  if (e === "0 */6 * * *")  return "Every 6 hours";
  if (e === "0 0 * * *")    return "Daily at midnight";
  if (e === "0 9 * * *")    return "Daily at 9:00 AM";
  if (e === "0 3 * * *")    return "Daily at 3:00 AM";
  if (e === "0 0 * * 0")    return "Weekly on Sunday";
  if (e === "30 3 * * 0")   return "Weekly on Sunday at 3:30 AM";
  // Daily at HH:00 → "0 H * * *"
  const dailyHour = e.match(/^0 (\d{1,2}) \* \* \*$/);
  if (dailyHour) {
    const h = parseInt(dailyHour[1], 10);
    const ampm = h < 12 ? "AM" : "PM";
    const hh = ((h + 11) % 12) + 1;
    return `Daily at ${hh}:00 ${ampm}`;
  }
  return expr; // raw fallback
}

function StatusDot({ enabled, running }) {
  let color = C.muted, glow = false;
  if (running) { color = C.yellow; glow = true; }
  else if (enabled) { color = C.green; }
  else { color = C.muted; }
  return (
    <span
      className="rounded-full shrink-0"
      style={{
        width: 8, height: 8, background: color,
        boxShadow: glow ? `0 0 10px ${color}` : "none",
      }}
    />
  );
}

function AgentBadge({ agent }) {
  const meta = AGENT_META[agent] || { color: C.muted, Icon: Activity };
  const Icon = meta.Icon;
  return (
    <span
      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium uppercase tracking-wide"
      style={{
        background: `${meta.color}18`,
        color: meta.color,
        border: `1px solid ${meta.color}40`,
      }}
    >
      <Icon className="w-3 h-3" />
      {agent}
    </span>
  );
}

function CronJobRow({ job, isRunning, isPending, isSelected, onSelect, onToggle, onRunNow }) {
  const handleRow = (e) => {
    if (e.target.closest("button")) return;
    onSelect(job.id);
  };
  return (
    <div
      onClick={handleRow}
      className="flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-colors"
      style={{
        background: isSelected ? `${C.accent}18` : C.surface,
        border: `1px solid ${isSelected ? `${C.accent}44` : C.border}`,
      }}
      data-testid={`cron-row-${job.id}`}
    >
      <StatusDot enabled={job.enabled} running={isRunning} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-[13px] font-semibold truncate" style={{ color: C.text }}>
            {job.name}
          </span>
          {job.agent && <AgentBadge agent={job.agent} />}
          {job.is_system && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px]"
                  style={{ background: C.surface2, color: C.muted, border: `1px solid ${C.border}` }}>
              <Lock className="w-2.5 h-2.5" />
              SYSTEM
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 text-[11px]" style={{ color: C.muted }}>
          <span title={job.schedule}>{humanCron(job.schedule)}</span>
          <span style={{ opacity: 0.4 }}>·</span>
          <span>last {fmtTime(job.last_run_at)}</span>
          <span style={{ opacity: 0.4 }}>·</span>
          <span>next {fmtTime(job.next_run_at)}</span>
          {job.run_count > 0 && (
            <>
              <span style={{ opacity: 0.4 }}>·</span>
              <span className="font-mono">{job.run_count} runs</span>
            </>
          )}
          {job.failure_count > 0 && (
            <span className="font-mono" style={{ color: C.red }}>· {job.failure_count} failed</span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          onClick={() => onRunNow(job.id)}
          disabled={isPending}
          className="px-2.5 py-1 rounded-md text-[10px] font-medium uppercase tracking-wide flex items-center gap-1 transition-colors disabled:opacity-50"
          style={{ background: C.surface2, color: C.muted, border: `1px solid ${C.border}` }}
          title="Run now"
          data-testid={`cron-run-${job.id}`}
        >
          <Play className="w-3 h-3" /> Run
        </button>
        <button
          type="button"
          onClick={() => onToggle(job.id, !job.enabled)}
          disabled={isPending}
          className="px-2.5 py-1 rounded-md text-[10px] font-medium uppercase tracking-wide flex items-center gap-1 transition-colors disabled:opacity-50"
          style={{
            background: job.enabled ? "rgba(251,191,36,0.12)" : "rgba(34,197,94,0.12)",
            color: job.enabled ? "#fbbf24" : "#4ade80",
            border: `1px solid ${job.enabled ? "rgba(251,191,36,0.3)" : "rgba(34,197,94,0.3)"}`,
          }}
          title={job.enabled ? "Pause" : "Resume"}
          data-testid={`cron-toggle-${job.id}`}
        >
          {job.enabled ? <><Pause className="w-3 h-3" /> Pause</> : <><Play className="w-3 h-3" /> Resume</>}
        </button>
      </div>
    </div>
  );
}

function JobInspector({ job }) {
  const { cronRuns, deleteCronJob } = useGateway();
  const runs = job ? (cronRuns[job.id] || []) : [];

  if (!job) {
    return (
      <div className="p-6 text-center text-[12px]" style={{ color: C.muted }}>
        Select a job on the left to see its details and run history.
      </div>
    );
  }

  const handleDelete = async () => {
    if (job.is_system) return;
    if (!window.confirm(`Delete "${job.name}"? This cannot be undone.`)) return;
    await deleteCronJob(job.id);
  };

  return (
    <div className="overflow-y-auto h-full">
      <div className="p-4" style={{ borderBottom: `1px solid ${C.border}` }}>
        <div className="flex items-center justify-between gap-2 mb-2">
          <span className="text-[16px] font-semibold truncate" style={{ color: C.text }}>{job.name}</span>
          {!job.is_system && (
            <button
              type="button"
              onClick={handleDelete}
              className="p-1.5 rounded-md transition-colors"
              style={{ color: C.red }}
              title="Delete schedule"
              data-testid={`cron-delete-${job.id}`}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          {job.agent && <AgentBadge agent={job.agent} />}
          {job.is_system && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px]"
                  style={{ background: C.surface2, color: C.muted, border: `1px solid ${C.border}` }}>
              <Lock className="w-2.5 h-2.5" /> SYSTEM
            </span>
          )}
          <span className="text-[11px] font-mono" style={{ color: C.muted }}>{job.schedule}</span>
        </div>
        <div className="text-[11px]" style={{ color: C.muted }}>
          {humanCron(job.schedule)} · next {fmtTime(job.next_run_at)}
        </div>
        {job.description && (
          <div className="text-[12px] mt-2" style={{ color: C.text, opacity: 0.85 }}>
            {job.description}
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 p-4" style={{ borderBottom: `1px solid ${C.border}` }}>
        <div>
          <div className="text-[10px] uppercase tracking-wider mb-1" style={{ color: C.muted }}>Run count</div>
          <div className="text-xl font-semibold" style={{ color: C.text }}>{job.run_count ?? 0}</div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wider mb-1" style={{ color: C.muted }}>Failures</div>
          <div className="text-xl font-semibold" style={{ color: (job.failure_count ?? 0) > 0 ? C.red : C.text }}>
            {job.failure_count ?? 0}
          </div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wider mb-1" style={{ color: C.muted }}>Last run</div>
          <div className="text-[12px] font-mono" style={{ color: C.text }}>{fmtTime(job.last_run_at)}</div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wider mb-1" style={{ color: C.muted }}>Next run</div>
          <div className="text-[12px] font-mono" style={{ color: C.text }}>{fmtTime(job.next_run_at)}</div>
        </div>
      </div>

      {job.prompt && (
        <div className="p-4" style={{ borderBottom: `1px solid ${C.border}` }}>
          <div className="text-[10px] uppercase tracking-wider mb-2" style={{ color: C.muted }}>Prompt</div>
          <div className="text-[12px] font-mono whitespace-pre-wrap break-words p-3 rounded-md"
               style={{ background: C.surface2, border: `1px solid ${C.border}`, color: C.text }}>
            {job.prompt}
          </div>
        </div>
      )}

      <div className="p-4">
        <div className="text-[10px] uppercase tracking-wider mb-2" style={{ color: C.muted }}>
          Recent runs ({runs.length})
        </div>
        {runs.length === 0 ? (
          <div className="text-[11px]" style={{ color: C.muted }}>
            No runs recorded yet.
          </div>
        ) : (
          <div className="space-y-1">
            {runs.map((r) => {
              const status = RUN_STATUS_STYLE[r.status] || RUN_STATUS_STYLE.pending;
              const StatusIcon = status.Icon;
              const dur = fmtDuration(r.fired_at, r.completed_at);
              return (
                <div key={r.id} className="flex items-center gap-2 p-2 rounded-md text-[11px]"
                     style={{ background: C.surface2 }}>
                  <span
                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-medium uppercase shrink-0"
                    style={{ background: status.bg, color: status.fg, border: `1px solid ${status.fg}30` }}
                  >
                    <StatusIcon className={`w-2.5 h-2.5 ${status.spin ? "animate-spin" : ""}`} />
                    {status.label}
                  </span>
                  <span className="flex-1 truncate" style={{ color: C.muted }} title={r.fired_at ? new Date(r.fired_at).toISOString() : ""}>
                    {fmtTime(r.fired_at)}
                    {dur && ` · ${dur}`}
                    {r.manual && " · manual"}
                  </span>
                  {r.error_message && (
                    <span className="font-mono text-[10px] truncate max-w-[140px]" style={{ color: C.red }} title={r.error_message}>
                      {r.error_message}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function GroupHeader({ icon: Icon, label, count, expanded, onToggle }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md transition-colors"
      style={{ color: C.muted }}
    >
      {expanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
      <Icon className="w-3.5 h-3.5" />
      <span className="text-[11px] font-bold uppercase tracking-widest">{label}</span>
      <span className="text-[10px] font-mono opacity-70">{count}</span>
    </button>
  );
}

export default function CronPage() {
  const {
    cronJobs, cronJobsLoading, cronJobsError, cronJobsLastUpdated,
    pendingCronOps, selectedCronJobId,
    fetchCronJobs, fetchCronRuns, setSelectedCronJobId,
    toggleCronJob, runCronJobNow,
    connectAgentsWebSocket,
  } = useGateway();

  const [systemOpen, setSystemOpen] = useState(false);
  const [userOpen, setUserOpen] = useState(true);

  // Initial fetch + WS connect for cron.* broadcasts.
  useEffect(() => {
    fetchCronJobs();
    connectAgentsWebSocket();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // When a job is selected, fetch its recent runs.
  useEffect(() => {
    if (selectedCronJobId) {
      fetchCronRuns(selectedCronJobId, { limit: 20 }).catch(() => null);
    }
  }, [selectedCronJobId, fetchCronRuns]);

  const { systemJobs, userJobs } = useMemo(() => {
    const sys = [], usr = [];
    for (const j of cronJobs) (j.is_system ? sys : usr).push(j);
    return { systemJobs: sys, userJobs: usr };
  }, [cronJobs]);

  const selectedJob = cronJobs.find((j) => j.id === selectedCronJobId) || null;

  // A job is "running" if any of its recent runs is still running.
  const isJobRunning = (id) => {
    const runs = useGateway.getState().cronRuns[id] || [];
    return runs.some((r) => r.status === "running");
  };

  return (
    <div className="h-full flex flex-col" style={{ color: C.text }}>
      {/* Header */}
      <div className="shrink-0 flex items-center justify-between px-6 py-3"
           style={{ borderBottom: `1px solid ${C.border}` }}>
        <div className="flex items-center gap-3">
          <Calendar className="w-5 h-5" style={{ color: C.accent }} />
          <div>
            <h1 className="text-lg font-semibold" style={{ color: C.text }}>Schedule</h1>
            <p className="text-[11px]" style={{ color: C.muted }}>
              Recurring jobs and automations · {cronJobs.length} total
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs">
          {cronJobsLastUpdated && (
            <span style={{ color: C.muted }}>Updated {fmtTime(cronJobsLastUpdated)}</span>
          )}
          <button
            type="button"
            onClick={() => fetchCronJobs()}
            disabled={cronJobsLoading}
            className="px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 disabled:opacity-50"
            style={{ background: C.surface2, border: `1px solid ${C.border}`, color: C.text }}
            data-testid="cron-refresh"
          >
            <RefreshCw className={`w-3 h-3 ${cronJobsLoading ? "animate-spin" : ""}`} />
            Refresh
          </button>
          {/* TODO: New Schedule modal — Phase 2 cron commit */}
          <button
            type="button"
            disabled
            title="New Schedule modal — Phase 2 (cron-parser dep + form validation)"
            className="px-3 py-1.5 rounded-lg text-xs font-medium opacity-50 cursor-not-allowed"
            style={{ background: C.accent, color: "#fff" }}
          >
            + New Schedule
          </button>
        </div>
      </div>

      {/* Error banner */}
      {cronJobsError && (
        <div className="mx-6 my-2 p-3 rounded-lg text-xs flex items-start gap-2 shrink-0"
             style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", color: "#f87171" }}>
          <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <div>
            <div className="font-medium">Could not reach cron endpoint.</div>
            <div className="opacity-80 font-mono">{cronJobsError}</div>
          </div>
        </div>
      )}

      {/* Two-pane body */}
      <div className="flex-1 flex overflow-hidden">
        {/* List (60%) */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4" style={{ minWidth: 0 }}>
          {cronJobsLoading && cronJobs.length === 0 ? (
            <div className="p-8 text-center rounded-xl text-sm" style={{ background: C.surface2, color: C.muted }}>
              <Loader2 className="w-4 h-4 animate-spin inline mr-2" />
              Loading schedules…
            </div>
          ) : (
            <>
              {/* Your Schedules */}
              <div>
                <GroupHeader
                  icon={Calendar}
                  label="Your Schedules"
                  count={userJobs.length}
                  expanded={userOpen}
                  onToggle={() => setUserOpen((v) => !v)}
                />
                {userOpen && (
                  <div className="mt-1 space-y-1">
                    {userJobs.length === 0 ? (
                      <div className="p-6 rounded-xl text-center"
                           style={{ background: C.surface2, border: `1px dashed ${C.border}` }}>
                        <Calendar className="w-6 h-6 mx-auto mb-2" style={{ color: C.muted }} />
                        <div className="text-[13px] font-medium mb-1" style={{ color: C.text }}>
                          No custom schedules yet
                        </div>
                        <div className="text-[11px]" style={{ color: C.muted }}>
                          Create one to have the bot run tasks automatically.
                          <br />
                          New Schedule modal lands in the next commit.
                        </div>
                      </div>
                    ) : (
                      userJobs.map((j) => (
                        <CronJobRow
                          key={j.id}
                          job={j}
                          isRunning={isJobRunning(j.id)}
                          isPending={pendingCronOps.includes(j.id)}
                          isSelected={selectedCronJobId === j.id}
                          onSelect={setSelectedCronJobId}
                          onToggle={toggleCronJob}
                          onRunNow={runCronJobNow}
                        />
                      ))
                    )}
                  </div>
                )}
              </div>

              {/* System Jobs */}
              <div>
                <GroupHeader
                  icon={Lock}
                  label="System Jobs"
                  count={systemJobs.length}
                  expanded={systemOpen}
                  onToggle={() => setSystemOpen((v) => !v)}
                />
                {systemOpen && (
                  <div className="mt-1 space-y-1">
                    {systemJobs.map((j) => (
                      <CronJobRow
                        key={j.id}
                        job={j}
                        isRunning={isJobRunning(j.id)}
                        isPending={pendingCronOps.includes(j.id)}
                        isSelected={selectedCronJobId === j.id}
                        onSelect={setSelectedCronJobId}
                        onToggle={toggleCronJob}
                        onRunNow={runCronJobNow}
                      />
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Inspector (40%) */}
        <aside className="w-[400px] shrink-0 overflow-hidden flex flex-col"
               style={{ borderLeft: `1px solid ${C.border}`, background: C.surface }}>
          <JobInspector job={selectedJob} />
        </aside>
      </div>
    </div>
  );
}
