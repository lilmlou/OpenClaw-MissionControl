import React, { useEffect, useMemo, useState } from "react";
import {
  Bot, Brain, Hammer, Eye, FileCheck, Activity, Wrench, Layers,
  RefreshCw, Play, Workflow, ChevronDown, ChevronUp, Filter,
  Laptop, ShieldCheck, AlertCircle, Clock, CheckCircle2, XCircle, Loader2,
} from "lucide-react";
import { C } from "@/lib/constants";
import { useGateway } from "@/lib/useGateway";

/**
 * AgentsPage
 * ----------------------------------------------------------------------------
 * Live surface for the backend agent runtime:
 *   GET  /api/v2/agents/tasks
 *   POST /api/v2/agents/tasks       { agent, prompt }
 *   POST /api/v2/agents/pipeline    { prompt }
 *
 * Agents: planner · executor · supervisor · auditor · watcher · builder · meta
 */

const AGENT_DEFS = [
  { id: "planner",    label: "Planner",    color: "#3b82f6", Icon: Brain,     defaultPrompt: "Describe the next small fix for Mission Control." },
  { id: "executor",   label: "Executor",   color: "#eab308", Icon: Hammer,    defaultPrompt: "Propose safe patch diffs for the current priority." },
  { id: "supervisor", label: "Supervisor", color: "#22c55e", Icon: Eye,       defaultPrompt: "Check whether the most recent changes match intent." },
  { id: "auditor",    label: "Auditor",    color: "#a855f7", Icon: FileCheck, defaultPrompt: "Run a safety/regression audit." },
  { id: "watcher",    label: "Watcher",    color: "#6b7280", Icon: Activity,  defaultPrompt: "Manual health check." },
  { id: "builder",    label: "Builder",    color: "#f97316", Icon: Wrench,    defaultPrompt: "Plan a build step for the current focus." },
  { id: "meta",       label: "Meta",       color: "#ec4899", Icon: Layers,    defaultPrompt: "Run the merged OpenClaw + Hermes reasoning pass." },
];

const AGENT_MAP = Object.fromEntries(AGENT_DEFS.map((a) => [a.id, a]));

const STATUS_STYLE = {
  done:           { bg: "rgba(34,197,94,0.14)",  fg: "#4ade80", Icon: CheckCircle2,  label: "DONE" },
  running:        { bg: "rgba(251,191,36,0.16)", fg: "#fbbf24", Icon: Loader2,       label: "RUNNING", spin: true },
  pending:        { bg: "rgba(148,163,184,0.14)",fg: "#94a3b8", Icon: Clock,         label: "PENDING" },
  failed:         { bg: "rgba(239,68,68,0.16)",  fg: "#f87171", Icon: XCircle,       label: "FAILED" },
  needs_approval: { bg: "rgba(168,85,247,0.16)", fg: "#c084fc", Icon: ShieldCheck,   label: "APPROVAL" },
};

const defaultStatus = { bg: "rgba(148,163,184,0.12)", fg: "#94a3b8", Icon: Clock, label: "UNKNOWN" };

function fmtTime(ts) {
  if (!ts) return "—";
  const d = new Date(ts);
  const now = Date.now();
  const diff = now - ts;
  if (diff < 60_000) return `${Math.max(1, Math.floor(diff / 1000))}s ago`;
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

function fmtDuration(start, end) {
  if (!start || !end) return null;
  const ms = end - start;
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60_000)}m`;
}

function TaskCard({ task }) {
  const agentDef = AGENT_MAP[task.agent] || { label: task.agent || "agent", color: "#64748b", Icon: Bot };
  const Icon = agentDef.Icon;
  const statusKey = (task.status || "").toLowerCase();
  const status = STATUS_STYLE[statusKey] || defaultStatus;
  const StatusIcon = status.Icon;
  const duration = fmtDuration(task.createdAt, task.completedAt);
  const [resultOpen, setResultOpen] = useState(true);

  return (
    <div className="p-4 rounded-xl" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: `${agentDef.color}18`, border: `1px solid ${agentDef.color}40` }}
          >
            <Icon className="w-4 h-4" style={{ color: agentDef.color }} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-base font-semibold capitalize" style={{ color: C.text }}>
                {agentDef.label}
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
                style={{ background: status.bg, color: status.fg, border: `1px solid ${status.fg}30` }}
              >
                <StatusIcon className={`w-3 h-3 ${status.spin ? "animate-spin" : ""}`} />
                {status.label}
              </span>
            </div>
            <div className="text-[11px] font-mono mt-0.5 truncate" style={{ color: C.muted }}>
              {task.id ? `${task.id.slice(0, 8)}…` : "—"}
              {" · "}
              {fmtTime(task.createdAt)}
              {duration && <span> · took {duration}</span>}
              {task.parentId && <span> · pipeline {task.parentId.slice(0, 6)}…</span>}
            </div>
          </div>
        </div>
      </div>

      <div
        className="mb-2 p-2.5 rounded-lg text-[11px] leading-relaxed"
        style={{ background: C.surface2, color: C.text, border: `1px solid ${C.border}` }}
      >
        <div className="text-[9px] uppercase tracking-wider mb-1" style={{ color: C.muted }}>Prompt</div>
        <div className="whitespace-pre-wrap break-words">{task.prompt || "(no prompt)"}</div>
      </div>

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
              className="p-3 text-[12px] font-mono whitespace-pre-wrap break-words max-h-[280px] overflow-auto"
              style={{ background: "rgba(0,0,0,0.25)", color: "#e2e8f0", margin: 0 }}
            >
              {task.result}
            </pre>
          )}
        </div>
      ) : (
        <div
          className="text-[11px] italic px-2.5 py-2 rounded-lg"
          style={{ color: C.muted, background: C.surface2, border: `1px dashed ${C.border}` }}
        >
          {statusKey === "running" ? "Running…" : statusKey === "pending" ? "Queued…" : "Awaiting result"}
        </div>
      )}
    </div>
  );
}

function AgentTile({ def, counts, onRun, busy }) {
  const { Icon, color, label, id, defaultPrompt } = def;
  const [promptOpen, setPromptOpen] = useState(false);
  const [prompt, setPrompt] = useState(defaultPrompt);

  return (
    <div
      className="p-3 rounded-xl flex flex-col gap-2"
      style={{ background: C.surface, border: `1px solid ${color}30` }}
    >
      <div className="flex items-center gap-2">
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: `${color}18`, border: `1px solid ${color}40` }}
        >
          <Icon className="w-4 h-4" style={{ color }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold" style={{ color: C.text }}>{label}</div>
          <div className="text-[10px] font-mono" style={{ color: C.muted }}>
            {counts.running > 0 && <span style={{ color: "#fbbf24" }}>{counts.running} running · </span>}
            {counts.total} total
          </div>
        </div>
      </div>

      {promptOpen ? (
        <>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={2}
            className="w-full rounded-md px-2 py-1.5 text-[11px] resize-none focus:outline-none"
            style={{ background: C.surface2, border: `1px solid ${C.border}`, color: C.text }}
            placeholder="Prompt for this agent..."
            data-testid={`agent-prompt-${id}`}
          />
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => {
                onRun(id, prompt);
                setPromptOpen(false);
              }}
              disabled={busy || !prompt.trim()}
              className="flex-1 px-2 py-1 rounded-md text-[11px] font-medium flex items-center justify-center gap-1 disabled:opacity-50"
              style={{ background: color, color: "#fff" }}
              data-testid={`agent-run-${id}`}
            >
              <Play className="w-3 h-3" /> Run
            </button>
            <button
              type="button"
              onClick={() => setPromptOpen(false)}
              className="px-2 py-1 rounded-md text-[11px]"
              style={{ background: C.surface2, color: C.muted, border: `1px solid ${C.border}` }}
            >
              Cancel
            </button>
          </div>
        </>
      ) : (
        <button
          type="button"
          onClick={() => setPromptOpen(true)}
          disabled={busy}
          className="w-full px-2 py-1.5 rounded-md text-[11px] font-medium flex items-center justify-center gap-1 disabled:opacity-50"
          style={{ background: C.surface2, color: color, border: `1px solid ${color}30` }}
          data-testid={`agent-open-${id}`}
        >
          <Play className="w-3 h-3" /> Run {label}
        </button>
      )}
    </div>
  );
}

export default function AgentsPage() {
  const {
    agentTasks,
    agentTasksLoading,
    agentTasksError,
    agentTasksLastUpdated,
    agentSubmitting,
    agentFilter,
    fetchAgentTasks,
    submitAgentTask,
    runAgentPipeline,
    setAgentFilter,
  } = useGateway();

  const [pipelinePrompt, setPipelinePrompt] = useState("");
  const [pipelineOpen, setPipelineOpen] = useState(false);

  useEffect(() => {
    fetchAgentTasks();
    const interval = setInterval(() => fetchAgentTasks({ silent: true }), 10_000);
    return () => clearInterval(interval);
  }, [fetchAgentTasks]);

  const counts = useMemo(() => {
    const out = {};
    for (const def of AGENT_DEFS) out[def.id] = { total: 0, running: 0 };
    for (const t of agentTasks) {
      const k = t.agent;
      if (!out[k]) out[k] = { total: 0, running: 0 };
      out[k].total += 1;
      if ((t.status || "").toLowerCase() === "running") out[k].running += 1;
    }
    return out;
  }, [agentTasks]);

  const PAGE_SIZE = 30;
  const [showAllWatcher, setShowAllWatcher] = useState(false);
  const [pageMultiplier, setPageMultiplier] = useState(1);

  // Reset paging when the filter changes so we always start at the top.
  useEffect(() => {
    setPageMultiplier(1);
    setShowAllWatcher(false);
  }, [agentFilter]);

  const { filtered, watcherCollapsed, totalAfterFilter } = useMemo(() => {
    let base;
    if (agentFilter === "all") base = agentTasks;
    else if (agentFilter === "pipeline") base = agentTasks.filter((t) => !!t.parentId);
    else base = agentTasks.filter((t) => t.agent === agentFilter);

    const total = base.length;

    // Group repetitive watcher tasks unless the user explicitly clicked "show all watcher runs"
    let collapsedCount = 0;
    let working = base;
    if (!showAllWatcher && (agentFilter === "all" || agentFilter === "watcher")) {
      const watcherRuns = base.filter((t) => t.agent === "watcher");
      const others = base.filter((t) => t.agent !== "watcher");
      if (watcherRuns.length > 3) {
        collapsedCount = watcherRuns.length;
        const latest = watcherRuns[0];
        const summaryCard = {
          ...latest,
          id: "watcher-summary",
          __summary: true,
          __summaryCount: watcherRuns.length,
          prompt: "Periodic health checks (auto, every 30s)",
          phase: "background",
        };
        working = agentFilter === "watcher"
          ? [summaryCard, ...watcherRuns.slice(0, 3)]
          : [summaryCard, ...others];
      }
    }

    return {
      filtered: working.slice(0, PAGE_SIZE * pageMultiplier),
      watcherCollapsed: collapsedCount,
      totalAfterFilter: working.length,
    };
  }, [agentTasks, agentFilter, showAllWatcher, pageMultiplier]);

  const runningCount = agentTasks.filter((t) => (t.status || "").toLowerCase() === "running").length;

  const handleRun = (agent, prompt) => {
    submitAgentTask(agent, prompt);
  };

  const handlePipeline = () => {
    if (!pipelinePrompt.trim()) return;
    runAgentPipeline(pipelinePrompt);
    setPipelineOpen(false);
  };

  return (
    <div className="h-full flex flex-col" style={{ color: C.text }}>
      <div className="flex-1 overflow-y-auto">
        <div className="p-6 space-y-5 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Agents</h1>
          <p className="text-sm" style={{ color: C.muted }}>
            Live agent runtime — planner, executor, supervisor, auditor, plus watcher/builder/meta. Watcher runs auto every 30s; the rest are manual or pipeline.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          {runningCount > 0 && (
            <span className="px-2 py-1 rounded-md flex items-center gap-1" style={{ background: "rgba(251,191,36,0.12)", color: "#fbbf24", border: "1px solid rgba(251,191,36,0.3)" }}>
              <Loader2 className="w-3 h-3 animate-spin" /> {runningCount} running
            </span>
          )}
          {agentTasksLastUpdated && (
            <span style={{ color: C.muted }}>
              Updated {fmtTime(agentTasksLastUpdated)}
            </span>
          )}
          <button
            onClick={() => fetchAgentTasks()}
            disabled={agentTasksLoading}
            className="px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 disabled:opacity-50"
            style={{ background: C.surface2, border: `1px solid ${C.border}`, color: C.text }}
            data-testid="agents-refresh"
          >
            <RefreshCw className={`w-3 h-3 ${agentTasksLoading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </div>

      {agentTasksError && (
        <div className="p-3 rounded-lg text-xs flex items-start gap-2" style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", color: "#f87171" }}>
          <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <div>
            <div className="font-medium">Could not reach agent runtime.</div>
            <div className="opacity-80 font-mono">{agentTasksError}</div>
            <div className="opacity-80 mt-1">Ensure the gateway is running: <code className="px-1 rounded" style={{ background: "rgba(0,0,0,0.25)" }}>cd ~/backend && npx tsx src/gateway.ts</code></div>
          </div>
        </div>
      )}

      {/* Pipeline launcher */}
      <div className="p-4 rounded-xl" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Workflow className="w-4 h-4" style={{ color: C.accent }} />
            <span className="text-sm font-semibold">Full Pipeline</span>
            <span className="text-[11px]" style={{ color: C.muted }}>
              Planner → Executor → Supervisor → Auditor, chained with a shared pipeline id.
            </span>
          </div>
          <button
            type="button"
            onClick={() => setPipelineOpen((v) => !v)}
            disabled={agentSubmitting}
            className="px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1 disabled:opacity-50"
            style={{ background: C.accent, color: "#fff" }}
            data-testid="agents-pipeline-toggle"
          >
            <Workflow className="w-3.5 h-3.5" /> {pipelineOpen ? "Close" : "Run pipeline"}
          </button>
        </div>
        {pipelineOpen && (
          <div className="mt-3 space-y-2">
            <textarea
              value={pipelinePrompt}
              onChange={(e) => setPipelinePrompt(e.target.value)}
              rows={2}
              className="w-full rounded-md px-3 py-2 text-sm resize-none focus:outline-none"
              style={{ background: C.surface2, border: `1px solid ${C.border}`, color: C.text }}
              placeholder="What should the pipeline reason about? e.g. 'Wire Jobs page to /api/v2/agents/tasks'"
              data-testid="agents-pipeline-prompt"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handlePipeline}
                disabled={agentSubmitting || !pipelinePrompt.trim()}
                className="px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-1 disabled:opacity-50"
                style={{ background: C.accent, color: "#fff" }}
                data-testid="agents-pipeline-run"
              >
                {agentSubmitting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
                Run full pipeline
              </button>
              <button
                type="button"
                onClick={() => setPipelineOpen(false)}
                className="px-3 py-1.5 rounded-md text-xs"
                style={{ background: C.surface2, color: C.muted, border: `1px solid ${C.border}` }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Per-agent tiles */}
      <div>
        <div className="flex items-center gap-2 mb-2 px-1">
          <span className="text-[11px] font-bold uppercase tracking-widest" style={{ color: C.muted }}>
            Individual agents
          </span>
          <div className="flex-1 h-px" style={{ background: C.border }} />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {AGENT_DEFS.map((def) => (
            <AgentTile
              key={def.id}
              def={def}
              counts={counts[def.id] || { total: 0, running: 0 }}
              busy={agentSubmitting}
              onRun={handleRun}
            />
          ))}
        </div>
      </div>

      {/* Task list */}
      <div>
        <div className="flex items-center justify-between gap-2 mb-3 px-1">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-widest" style={{ color: C.muted }}>
              Tasks ({filtered.length})
            </span>
          </div>
          <div className="flex items-center gap-1">
            <Filter className="w-3 h-3" style={{ color: C.muted }} />
            <select
              value={agentFilter}
              onChange={(e) => setAgentFilter(e.target.value)}
              className="rounded-md px-2 py-1 text-xs focus:outline-none"
              style={{ background: C.surface2, border: `1px solid ${C.border}`, color: C.text }}
              data-testid="agents-filter"
            >
              <option value="all">All agents</option>
              <option value="pipeline">Pipeline runs</option>
              {AGENT_DEFS.map((def) => (
                <option key={def.id} value={def.id}>{def.label}</option>
              ))}
            </select>
          </div>
        </div>

        {agentTasksLoading && agentTasks.length === 0 ? (
          <div className="p-8 text-center rounded-xl text-sm" style={{ background: C.surface2, color: C.muted }}>
            <Loader2 className="w-4 h-4 animate-spin inline mr-2" />
            Loading live tasks…
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-8 rounded-xl text-center text-sm" style={{ background: C.surface2, color: C.muted }}>
            {agentTasks.length === 0
              ? "No agent tasks yet. Run an individual agent or the full pipeline to see activity here."
              : `No tasks match the "${agentFilter}" filter.`}
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((task) => (
              task.__summary ? (
                <div key={task.id} className="p-3 rounded-xl flex items-center justify-between gap-3" style={{ background: C.surface, border: `1px dashed ${C.border}` }}>
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: "rgba(107,114,128,0.18)", border: "1px solid rgba(107,114,128,0.4)" }}>
                      <Activity className="w-4 h-4" style={{ color: "#6b7280" }} />
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold" style={{ color: C.text }}>
                        Watcher × {task.__summaryCount}
                      </div>
                      <div className="text-[11px] truncate" style={{ color: C.muted }}>
                        Periodic health & safety checks · last run {fmtTime(task.createdAt)}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowAllWatcher(true)}
                    className="px-3 py-1.5 rounded-md text-[11px] font-medium shrink-0"
                    style={{ background: C.surface2, color: C.muted, border: `1px solid ${C.border}` }}
                  >
                    Show all watcher runs
                  </button>
                </div>
              ) : (
                <TaskCard key={task.id} task={task} />
              )
            ))}
            {totalAfterFilter > filtered.length && (
              <button
                type="button"
                onClick={() => setPageMultiplier((m) => m + 1)}
                className="w-full px-3 py-2 rounded-lg text-xs font-medium"
                style={{ background: C.surface2, color: C.muted, border: `1px solid ${C.border}` }}
              >
                Show {Math.min(PAGE_SIZE, totalAfterFilter - filtered.length)} more · {totalAfterFilter - filtered.length} hidden
              </button>
            )}
            {showAllWatcher && watcherCollapsed > 0 && (
              <button
                type="button"
                onClick={() => setShowAllWatcher(false)}
                className="w-full px-3 py-1.5 rounded-md text-[11px]"
                style={{ background: C.surface2, color: C.muted, border: `1px solid ${C.border}` }}
              >
                Collapse watcher runs
              </button>
            )}
          </div>
        )}
      </div>

      {/* Paired nodes stub (kept but clearly labeled as pending) */}
      <div className="p-4 rounded-xl" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
        <div className="flex items-center gap-2 mb-2">
          <Laptop className="w-4 h-4" style={{ color: C.accent }} />
          <span className="text-[13px] font-semibold">Paired Nodes</span>
          <span
            className="text-[9px] px-1.5 py-0.5 rounded uppercase tracking-wider"
            style={{ background: C.surface2, color: C.muted, border: `1px dashed ${C.border}` }}
          >
            Placeholder
          </span>
        </div>
        <p className="text-[11px] m-0" style={{ color: C.muted }}>
          Device pairing is not yet wired. Future iPhone/iPad clients over Tailscale will appear here.
        </p>
      </div>

      <div
        className="p-3 rounded-xl inline-flex items-center gap-2 text-xs"
        style={{ background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.2)", color: C.yellow }}
      >
        <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
        Executor writes and destructive actions remain gated by the approval system on the Approvals page.
      </div>
        </div>
      </div>
    </div>
  );
}
