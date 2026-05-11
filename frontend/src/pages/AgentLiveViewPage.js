/**
 * F7 — Agent Live View
 *
 * Route: /agents/live
 *
 * Two-column layout:
 *   • AgentRunsList   — left, live-updates from shared config WS
 *   • AgentRunDetail  — right (Heartbeat + AgentEventStream + AgentDiffPane +
 *                       AcceptanceList + AgentControls)
 *
 * Phase 0 compliance:
 *   1.1 Visual-first   — every state is a Pill/Indicator + colour, never raw JSON
 *                        (full payloads are tucked behind a "Details" drawer).
 *   1.2 Live config    — poll-fallback interval read from config bus.
 *   1.3 No-text-editing — N/A.
 *   1.4 Self-healing   — every failed acceptance row ships [Retry]; failed runs
 *                        ship [Verify] + [Kill] + [Open diff]; errors use
 *                        ErrorState with Fix buttons (never "view logs" alone).
 *   1.5 In-UI ext.     — N/A read-only.
 *   1.6 Real-time      — single shared config WS via subscribeConfigWs.
 *   1.7 Visible        — every backend status change is itself an activity event
 *                        emitted by `dispatch.py`; this surface visualises it.
 *
 * §3 It Counts as Done — the word "done" is banned in this surface. Statuses:
 *   running · claims_done · verified · failed · killed.
 */
import React, { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Activity, RefreshCw, FileText, GitBranch, Skull, CheckCircle2, XCircle,
  Clock, ShieldCheck, Loader2, Terminal as TerminalIcon, Globe, AlertCircle,
  ChevronRight, ChevronDown, Pencil, Hammer, Eye, FileCheck, Wrench, Brain,
  Layers, Bot, ArrowDown, Filter,
} from "lucide-react";
import {
  PageShell, PageHeader, PageContent, PageError, PageMeta,
  Pill, Indicator, Button, Card, SkeletonCard, EmptyState, ErrorState,
} from "@/components/kit";
import {
  useAgentRuns, useAgentRunDetail, postRunVerify, postRunKill,
} from "@/hooks/useAgentRuns";
import { useConfigValue } from "@/hooks/useConfigBus";
import { apiUrl } from "@/lib/useGateway";
import AgentStatusPill from "@/components/agents/AgentStatusPill";

// ── status vocabulary (no "done" string allowed) ───────────────────────────────
const STATUS_META = {
  running:     { tone: "warn",    label: "running",     pulse: true,  Icon: Loader2,      indicator: "warn" },
  claims_done: { tone: "warn",    label: "claims done", pulse: false, Icon: AlertCircle,  indicator: "warn" },
  verified:    { tone: "ok",      label: "verified",    pulse: false, Icon: CheckCircle2, indicator: "ok"   },
  failed:      { tone: "err",     label: "failed",      pulse: false, Icon: XCircle,      indicator: "err"  },
  killed:      { tone: "neutral", label: "killed",      pulse: false, Icon: Skull,        indicator: "off"  },
};
const statusMeta = (s) => STATUS_META[s] || { tone: "neutral", label: s || "—", pulse: false, Icon: Clock, indicator: "off" };

// ── filter chips ──────────────────────────────────────────────────────────────
const FILTER_STATUSES = [
  { value: "",           label: "All" },
  { value: "running",     label: "Running" },
  { value: "claims_done", label: "Claims done" },
  { value: "verified",    label: "Verified" },
  { value: "failed",      label: "Failed" },
  { value: "killed",      label: "Killed" },
];

const EVENT_KIND_META = {
  "run.started":   { Icon: PlayIcon,        tone: "ok",      label: "started" },
  "run.step":      { Icon: Activity,        tone: "info",    label: "step" },
  "run.tool_call": { Icon: Wrench,          tone: "info",    label: "tool" },
  "run.file_write":{ Icon: FileText,        tone: "accent",  label: "file" },
  "run.shell":     { Icon: TerminalIcon,    tone: "neutral", label: "shell" },
  "run.http":      { Icon: Globe,           tone: "info",    label: "http" },
  "run.log":       { Icon: Activity,        tone: "neutral", label: "log" },
  "run.error":     { Icon: AlertCircle,     tone: "err",     label: "error" },
  "run.acceptance":{ Icon: CheckCircle2,    tone: "ok",      label: "accept" },
  "run.verified":  { Icon: ShieldCheck,     tone: "ok",      label: "verified" },
  "run.failed":    { Icon: XCircle,         tone: "err",     label: "failed" },
  "run.killed":    { Icon: Skull,           tone: "neutral", label: "killed" },
};
const eventMeta = (k) => {
  // try exact match, then fallback to suffix match
  const exact = EVENT_KIND_META[k];
  if (exact) return exact;
  // legacy short forms
  const legacy = {
    tool_call:   EVENT_KIND_META["run.tool_call"],
    file_write:  EVENT_KIND_META["run.file_write"],
    shell:       EVENT_KIND_META["run.shell"],
    http:        EVENT_KIND_META["run.http"],
    log:         EVENT_KIND_META["run.log"],
    error:       EVENT_KIND_META["run.error"],
    complete:    { Icon: CheckCircle2, tone: "ok", label: "complete" },
    killed:      EVENT_KIND_META["run.killed"],
  };
  if (legacy[k]) return legacy[k];
  // suffix match: "run.X" → X
  const suffix = k.replace(/^run\./, "");
  if (EVENT_KIND_META[`run.${suffix}`]) return EVENT_KIND_META[`run.${suffix}`];
  return { Icon: Activity, tone: "neutral", label: suffix || k || "evt" };
};

// ── inline PlayIcon (not in lucide-react) ─────────────────────────────────────
function PlayIcon({ size, className }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <polygon points="5 3 19 12 5 21 5 3" />
    </svg>
  );
}

// ── helpers ───────────────────────────────────────────────────────────────────
function fmtAgo(ts) {
  if (!ts) return "—";
  const diff = Date.now() - ts;
  if (diff < 1000) return "now";
  if (diff < 60_000) return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return new Date(ts).toLocaleDateString();
}
function fmtTime(ts) {
  if (!ts) return "—";
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}
function fmtElapsed(start, end) {
  if (!start) return null;
  const ms = (end || Date.now()) - start;
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${Math.floor(ms / 1000)}s`;
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m`;
  return `${Math.floor(ms / 3_600_000)}h`;
}

// ── AgentRunsList ─────────────────────────────────────────────────────────────
function AgentRunsList({ runs, selectedId, onSelect, loading }) {
  if (loading && runs.length === 0) {
    return (
      <div className="flex flex-col gap-[var(--mc-space-2)]" data-testid="agent-runs-list-loading">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="mc-skeleton" style={{ height: 64, borderRadius: "var(--mc-radius-md)" }} />
        ))}
      </div>
    );
  }
  if (runs.length === 0) {
    return (
      <EmptyState
        title="No agent runs yet"
        description="Dispatch an agent to see its live tool stream, diff, and acceptance status here."
      />
    );
  }
  return (
    <div className="flex flex-col gap-[var(--mc-space-2)]" data-testid="agent-runs-list">
      {runs.map((r) => {
        const meta = statusMeta(r.status);
        const StatusIcon = meta.Icon;
        const active = r.id === selectedId;
        const elapsed = fmtElapsed(r.started_ts || r.dispatched_ts, r.ended_ts);
        return (
          <button
            key={r.id}
            type="button"
            onClick={() => onSelect(r.id)}
            data-testid={`agent-run-row-${r.id}`}
            className="text-left rounded-[var(--mc-radius-md)] p-[var(--mc-space-3)] border transition-colors"
            style={{
              background: active ? "var(--mc-bg-3)" : "var(--mc-bg-1)",
              borderColor: active ? "var(--mc-accent)" : "var(--mc-line)",
              cursor: "pointer",
            }}
          >
            <div className="flex items-center justify-between gap-2 mb-1">
              <div className="flex items-center gap-2 min-w-0">
                <Indicator tone={meta.indicator} pulse={meta.pulse} size="sm" />
                <span
                  className="font-mono truncate"
                  style={{ fontSize: "var(--mc-text-sm)", color: "var(--mc-fg)" }}
                >
                  {r.phase_id || r.handoff_doc?.replace(/\.md$/, "") || r.agent_id || "run"}
                </span>
              </div>
              <AgentStatusPill status={r.status} size="sm" />
            </div>
            <div
              className="flex items-center gap-[var(--mc-space-3)] flex-wrap"
              style={{ fontSize: "var(--mc-text-xs)", color: "var(--mc-fg-2)" }}
            >
              <span>{r.agent_id || "—"}</span>
              {elapsed && <span>· {elapsed}</span>}
              {r.acceptance_total > 0 && (
                <span data-testid={`agent-run-acceptance-${r.id}`}>
                  · {r.acceptance_passed || 0}/{r.acceptance_total} ✓
                </span>
              )}
              {(r.diff_added || r.diff_removed) ? (
                <span style={{ fontFamily: "var(--mc-font-mono)" }}>
                  · +{r.diff_added || 0}/−{r.diff_removed || 0}
                </span>
              ) : null}
            </div>
          </button>
        );
      })}
    </div>
  );
}

// ── Heartbeat ─────────────────────────────────────────────────────────────────
function Heartbeat({ lastHeartbeat, status, elapsedMs, onKill }) {
  const now = Date.now();
  const cells = [4, 3, 2, 1, 0].map((i) => {
    const winStart = now - (i + 1) * 5000;
    const winEnd = now - i * 5000;
    const live = lastHeartbeat && lastHeartbeat >= winStart && lastHeartbeat < winEnd;
    return live;
  });
  const isRunning = status === "running";
  const msSinceLastEvent = lastHeartbeat ? now - lastHeartbeat : null;
  const stalled = isRunning && msSinceLastEvent !== null && msSinceLastEvent > 10_000;
  return (
    <div className="flex items-center gap-[var(--mc-space-2)] flex-wrap" data-testid="agent-heartbeat">
      <span
        className="uppercase"
        style={{
          fontSize: "var(--mc-text-xs)",
          color: "var(--mc-fg-2)",
          letterSpacing: "var(--mc-tracking-wide)",
        }}
      >
        Heartbeat
      </span>
      <div className="flex items-center gap-1">
        {cells.map((live, idx) => (
          <Indicator
            key={idx}
            tone={live ? "ok" : (isRunning ? "warn" : "off")}
            size="sm"
            pulse={live && idx === cells.length - 1}
          />
        ))}
      </div>
      <span style={{ fontSize: "var(--mc-text-xs)", color: "var(--mc-fg-2)" }}>
        {stalled
          ? `Stalled — no event for ${Math.round(msSinceLastEvent / 1000)}s`
          : lastHeartbeat
            ? `last event ${fmtAgo(lastHeartbeat)}`
            : (isRunning ? "waiting…" : "idle")}
      </span>
      {stalled && (
        <>
          <span
            className="inline-flex items-center gap-1 rounded-[var(--mc-radius-sm)] px-2 py-0.5"
            style={{
              fontSize: "var(--mc-text-xs)",
              background: "var(--mc-err-soft)",
              color: "var(--mc-err)",
              border: "1px solid var(--mc-err-soft)",
            }}
            data-testid="heartbeat-stalled"
          >
            Stalled
          </span>
          {onKill && (
            <Button
              variant="secondary"
              size="sm"
              onClick={onKill}
              data-testid="heartbeat-kill-btn"
              style={{ color: "var(--mc-err)", borderColor: "var(--mc-err)" }}
            >
              <Skull size={10} />
              Kill
            </Button>
          )}
        </>
      )}
    </div>
  );
}

// ── AgentEventStream (virtualised — windowed render) ──────────────────────────
function AgentEventStream({ events }) {
  const [openId, setOpenId] = useState(null);
  const scrollRef = useRef(null);
  const [userScrolledUp, setUserScrolledUp] = useState(false);

  // Group consecutive run.log events for readability
  const grouped = useMemo(() => {
    if (!events || events.length === 0) return [];
    const result = [];
    let logGroup = null;

    for (const ev of events) {
      const isLog = ev.kind === "log" || ev.kind === "run.log";
      if (isLog) {
        if (!logGroup) {
          logGroup = { kind: "log", events: [], first: ev, ids: [] };
        }
        logGroup.events.push(ev);
        logGroup.ids.push(ev.id);
      } else {
        if (logGroup) {
          result.push(logGroup);
          logGroup = null;
        }
        result.push({ kind: "event", ev });
      }
    }
    if (logGroup) result.push(logGroup);
    return result;
  }, [events]);

  const recent = grouped.slice(-200);

  // Auto-scroll to bottom on new events unless user scrolled up
  useEffect(() => {
    if (!userScrolledUp && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [events.length, userScrolledUp]);

  const handleScroll = useCallback(() => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    // If within 50px of bottom, consider at-live
    setUserScrolledUp(scrollHeight - scrollTop - clientHeight > 50);
  }, []);

  if (recent.length === 0) {
    return (
      <EmptyState
        title="No tool calls yet"
        description="Events appear here as the agent writes files, runs commands, and makes HTTP calls."
      />
    );
  }

  return (
    <div style={{ position: "relative" }} data-testid="agent-event-stream">
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="overflow-y-auto rounded-[var(--mc-radius-md)] border"
        style={{ borderColor: "var(--mc-line)", background: "var(--mc-bg-1)", maxHeight: 360 }}
      >
        <ol className="m-0 p-0 list-none">
          {recent.map((item, gi) => {
            // Grouped log events
            if (item.kind === "log") {
              const count = item.events.length;
              const first = item.first;
              const m = eventMeta(first.kind);
              const Icon = m.Icon;
              const isOpen = item.ids.some((id) => id === openId);
              return (
                <li key={`log-${gi}`} className="border-b" style={{ borderColor: "var(--mc-line)" }}>
                  <button
                    type="button"
                    onClick={() => setOpenId(isOpen ? null : item.ids[0])}
                    className="w-full flex items-center gap-[var(--mc-space-3)] px-[var(--mc-space-3)] py-[var(--mc-space-2)] text-left"
                    data-testid={`agent-event-log-group-${gi}`}
                    style={{ background: "transparent" }}
                  >
                    <span style={{ fontSize: "var(--mc-text-xs)", color: "var(--mc-fg-2)", fontFamily: "var(--mc-font-mono)" }}>
                      {fmtTime(first.ts)}
                    </span>
                    <Pill tone={m.tone} size="sm" icon={<Icon size={10} />}>{m.label}</Pill>
                    <span style={{ fontSize: "var(--mc-text-sm)", color: "var(--mc-fg-2)", fontFamily: "var(--mc-font-mono)" }}>
                      {count > 1 ? `+${count - 1} more log lines` : first.summary || "—"}
                    </span>
                    {count > 1 && (
                      isOpen
                        ? <ChevronDown size={12} style={{ color: "var(--mc-fg-2)" }} />
                        : <ChevronRight size={12} style={{ color: "var(--mc-fg-2)" }} />
                    )}
                  </button>
                  {isOpen && count > 1 && (
                    <div style={{ background: "var(--mc-bg-2)" }}>
                      {item.events.map((ev) => (
                        <pre
                          key={ev.id}
                          className="m-0 px-[var(--mc-space-4)] py-[var(--mc-space-1)] overflow-auto"
                          style={{
                            fontFamily: "var(--mc-font-mono)",
                            fontSize: "var(--mc-text-xs)",
                            color: "var(--mc-fg-1)",
                            maxHeight: 120,
                          }}
                        >
                          {ev.summary || JSON.stringify(ev.detail)}
                        </pre>
                      ))}
                    </div>
                  )}
                </li>
              );
            }

            // Single event
            const ev = item.ev;
            const m = eventMeta(ev.kind);
            const Icon = m.Icon;
            const isOpen = openId === ev.id;
            return (
              <li key={ev.id} className="border-b" style={{ borderColor: "var(--mc-line)" }}>
                <button
                  type="button"
                  onClick={() => setOpenId(isOpen ? null : ev.id)}
                  className="w-full flex items-center gap-[var(--mc-space-3)] px-[var(--mc-space-3)] py-[var(--mc-space-2)] text-left"
                  data-testid={`agent-event-${ev.id}`}
                  style={{ background: "transparent" }}
                >
                  <span style={{ fontSize: "var(--mc-text-xs)", color: "var(--mc-fg-2)", fontFamily: "var(--mc-font-mono)" }}>
                    {fmtTime(ev.ts)}
                  </span>
                  <Pill tone={m.tone} size="sm" icon={<Icon size={10} />}>{m.label}</Pill>
                  <span
                    className="flex-1 truncate"
                    style={{ fontSize: "var(--mc-text-sm)", color: "var(--mc-fg)", fontFamily: "var(--mc-font-mono)" }}
                  >
                    {ev.summary || "—"}
                  </span>
                  {ev.duration_ms != null && (
                    <span style={{ fontSize: "var(--mc-text-xs)", color: "var(--mc-fg-2)" }}>
                      {ev.duration_ms}ms
                    </span>
                  )}
                  {ev.detail && Object.keys(ev.detail).length > 0 && (
                    isOpen
                      ? <ChevronDown size={12} style={{ color: "var(--mc-fg-2)" }} />
                      : <ChevronRight size={12} style={{ color: "var(--mc-fg-2)" }} />
                  )}
                </button>
                {isOpen && ev.detail && (
                  <pre
                    className="m-0 px-[var(--mc-space-3)] py-[var(--mc-space-2)] overflow-auto"
                    data-testid={`agent-event-detail-${ev.id}`}
                    style={{
                      background: "var(--mc-bg-2)",
                      fontFamily: "var(--mc-font-mono)",
                      fontSize: "var(--mc-text-xs)",
                      color: "var(--mc-fg-1)",
                      maxHeight: 240,
                    }}
                  >
                    {JSON.stringify(ev.detail, null, 2)}
                  </pre>
                )}
              </li>
            );
          })}
        </ol>
      </div>
      {/* Jump-to-live pill */}
      {userScrolledUp && events.length > 0 && (
        <button
          type="button"
          onClick={() => {
            setUserScrolledUp(false);
            if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
          }}
          className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-1 px-3 py-1 rounded-full border shadow-sm transition-opacity"
          data-testid="jump-to-live"
          style={{
            background: "var(--mc-bg-3)",
            borderColor: "var(--mc-accent)",
            color: "var(--mc-accent)",
            fontSize: "var(--mc-text-xs)",
            cursor: "pointer",
          }}
        >
          <ArrowDown size={12} />
          Jump to live
        </button>
      )}
    </div>
  );
}

// ── AgentDiffPane ─────────────────────────────────────────────────────────────
function AgentDiffPane({ diff, run, runId }) {
  const [open, setOpen] = useState(false);
  const [diffText, setDiffText] = useState(null);
  const [fetching, setFetching] = useState(false);
  const [fetchError, setFetchError] = useState(null);
  const [showUnified, setShowUnified] = useState(true);

  const files = diff?.files || run?.files_touched || [];
  const added = diff?.added ?? run?.diff_added ?? 0;
  const removed = diff?.removed ?? run?.diff_removed ?? 0;

  // Lazy-fetch diff text on first expand — cache for panel lifetime.
  const fetchDiff = useCallback(async () => {
    if (diffText !== null) return;
    if (!runId) return;
    setFetching(true); setFetchError(null);
    try {
      const res = await fetch(apiUrl(`/api/v2/agents/runs/${encodeURIComponent(runId)}/diff?format=text`));
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const payload = await res.json();
      const data = payload?.ok === false ? payload : (payload?.data || payload);
      const text = typeof data?.diff === "string" ? data.diff : (data?.ok === false ? null : JSON.stringify(data, null, 2));
      setDiffText(text || "");
    } catch (err) {
      setFetchError(err.message);
    } finally {
      setFetching(false);
    }
  }, [diffText, runId]);

  const handleToggle = useCallback(() => {
    const willOpen = !open;
    setOpen(willOpen);
    if (willOpen && diffText === null) fetchDiff();
  }, [open, diffText, fetchDiff]);

  const refetch = useCallback(() => {
    setDiffText(null); setFetchError(null);
    fetchDiff();
  }, [fetchDiff]);

  return (
    <div className="rounded-[var(--mc-radius-md)] border" style={{ borderColor: "var(--mc-line)" }} data-testid="agent-diff-pane">
      <button
        type="button"
        onClick={handleToggle}
        className="w-full flex items-center gap-[var(--mc-space-2)] px-[var(--mc-space-3)] py-[var(--mc-space-2)]"
        style={{ background: "var(--mc-bg-1)" }}
      >
        <GitBranch size={14} style={{ color: "var(--mc-fg-1)" }} />
        <span style={{ fontSize: "var(--mc-text-sm)", color: "var(--mc-fg)" }}>Diff</span>
        <span style={{ fontSize: "var(--mc-text-xs)", color: "var(--mc-fg-2)", fontFamily: "var(--mc-font-mono)" }}>
          {files.length} file{files.length === 1 ? "" : "s"} · +{added}/−{removed}
        </span>
        <span className="flex-1" />
        {open
          ? <ChevronDown size={12} style={{ color: "var(--mc-fg-2)" }} />
          : <ChevronRight size={12} style={{ color: "var(--mc-fg-2)" }} />}
      </button>
      {open && (
        <div className="border-t" style={{ borderColor: "var(--mc-line)" }}>
          {/* File list summary */}
          {files.length > 0 && (
            <ul className="m-0 list-none p-0 border-b" style={{ borderColor: "var(--mc-line)" }}>
              {files.map((f) => {
                const path = typeof f === "string" ? f : (f.path || f.name || JSON.stringify(f));
                return (
                  <li
                    key={path}
                    className="px-[var(--mc-space-3)] py-[var(--mc-space-1)] flex items-center gap-[var(--mc-space-2)]"
                    style={{ fontSize: "var(--mc-text-xs)", color: "var(--mc-fg-1)", fontFamily: "var(--mc-font-mono)" }}
                  >
                    <FileText size={12} style={{ color: "var(--mc-fg-2)" }} />
                    <span className="truncate">{path}</span>
                  </li>
                );
              })}
            </ul>
          )}

          {/* Toggle: unified vs file-list-only */}
          <div className="flex items-center gap-[var(--mc-space-2)] px-[var(--mc-space-3)] py-[var(--mc-space-1)]" style={{ borderBottom: diffText ? "1px solid var(--mc-line)" : "none" }}>
            <button
              type="button"
              onClick={() => setShowUnified(true)}
              className="rounded-[var(--mc-radius-sm)] px-2 py-0.5 border"
              style={{
                fontSize: "var(--mc-text-xs)",
                fontFamily: "var(--mc-font-sans)",
                background: showUnified ? "var(--mc-accent-soft)" : "transparent",
                color: showUnified ? "var(--mc-accent)" : "var(--mc-fg-2)",
                borderColor: showUnified ? "var(--mc-accent)" : "var(--mc-line)",
                cursor: "pointer",
              }}
              data-testid="diff-toggle-unified"
            >
              Unified
            </button>
            <button
              type="button"
              onClick={fetchDiff}
              className="rounded-[var(--mc-radius-sm)] px-2 py-0.5 border ml-auto"
              style={{
                fontSize: "var(--mc-text-xs)",
                fontFamily: "var(--mc-font-sans)",
                background: "transparent",
                color: "var(--mc-fg-2)",
                borderColor: "var(--mc-line)",
                cursor: "pointer",
              }}
              data-testid="diff-refetch-btn"
            >
              <RefreshCw size={10} className={fetching ? "animate-spin" : ""} style={{ marginRight: 4 }} />
              Re-fetch
            </button>
          </div>

          {/* Diff text display */}
          {fetching && (
            <div className="p-[var(--mc-space-3)]" style={{ fontSize: "var(--mc-text-xs)", color: "var(--mc-fg-2)" }}>
              Fetching diff…
            </div>
          )}
          {fetchError && (
            <div className="p-[var(--mc-space-3)] rounded-[var(--mc-radius-sm)] m-[var(--mc-space-2)] flex items-center gap-2"
              style={{ background: "var(--mc-err-soft)", color: "var(--mc-err)", fontSize: "var(--mc-text-xs)" }}>
              <AlertCircle size={12} />
              {fetchError}
              <button type="button" onClick={refetch} className="underline ml-auto" style={{ color: "var(--mc-err)" }}>
                Retry
              </button>
            </div>
          )}
          {!fetching && !fetchError && diffText !== null && diffText && showUnified && (
            <pre
              className="m-0 p-[var(--mc-space-3)] overflow-auto"
              data-testid="agent-diff-content"
              style={{
                fontFamily: "var(--mc-font-mono)",
                fontSize: "var(--mc-text-xs)",
                color: "var(--mc-fg-1)",
                background: "var(--mc-bg-2)",
                maxHeight: 480,
                lineHeight: 1.5,
                whiteSpace: "pre-wrap",
                wordBreak: "break-all",
              }}
            >
              {diffText}
            </pre>
          )}
          {!fetching && !fetchError && (!diffText && files.length === 0) && (
            <div className="p-[var(--mc-space-3)]" style={{ fontSize: "var(--mc-text-xs)", color: "var(--mc-fg-2)" }}>
              No files changed since dispatch.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── AcceptanceList ────────────────────────────────────────────────────────────
function AcceptanceList({ checks, onRetry, onRetryCheck, retrying }) {
  if (!checks || checks.length === 0) {
    return (
      <EmptyState
        title="No acceptance checks parsed"
        description="The handoff doc's §6 either has no checkboxes or this run wasn't dispatched against a doc."
      />
    );
  }
  const passed = checks.filter((c) => c.status === "pass").length;
  return (
    <div className="flex flex-col gap-[var(--mc-space-2)]" data-testid="acceptance-list">
      <div className="flex items-center gap-[var(--mc-space-2)]">
        <span
          className="uppercase"
          style={{
            fontSize: "var(--mc-text-xs)",
            color: "var(--mc-fg-2)",
            letterSpacing: "var(--mc-tracking-wide)",
          }}
        >
          Acceptance
        </span>
        <Pill tone={passed === checks.length ? "ok" : "warn"} size="sm">
          {passed}/{checks.length}
        </Pill>
      </div>
      <ul className="m-0 list-none p-0 flex flex-col gap-[var(--mc-space-1)]">
        {checks.map((c) => {
          const tone =
            c.status === "pass"  ? "ok"   :
            c.status === "fail"  ? "err"  :
            c.status === "error" ? "err"  :
            "neutral";
          const Icon =
            c.status === "pass"  ? CheckCircle2 :
            c.status === "fail"  ? XCircle      :
            c.status === "error" ? AlertCircle  :
            Clock;
          const failed = c.status === "fail" || c.status === "error";
          const pending = c.status === "pending";
          return (
            <li
              key={c.id}
              className="flex items-start gap-[var(--mc-space-2)] p-[var(--mc-space-2)] rounded-[var(--mc-radius-sm)]"
              style={{ background: "var(--mc-bg-1)", border: "1px solid var(--mc-line)" }}
              data-testid={`acceptance-check-${c.id}`}
            >
              <Pill tone={tone} size="sm" icon={<Icon size={10} />}>{c.status || "pending"}</Pill>
              <div className="min-w-0 flex-1">
                <div style={{ fontSize: "var(--mc-text-sm)", color: "var(--mc-fg)" }}>{c.label}</div>
                {c.command && (
                  <div
                    className="truncate"
                    style={{
                      fontSize: "var(--mc-text-xs)",
                      color: "var(--mc-fg-2)",
                      fontFamily: "var(--mc-font-mono)",
                    }}
                  >
                    $ {c.command}
                  </div>
                )}
                {c.actual && failed && (
                  <pre
                    className="m-0 mt-[var(--mc-space-1)] p-[var(--mc-space-2)] rounded-[var(--mc-radius-sm)] overflow-auto"
                    style={{
                      background: "var(--mc-bg-2)",
                      fontFamily: "var(--mc-font-mono)",
                      fontSize: "var(--mc-text-xs)",
                      color: "var(--mc-err)",
                      maxHeight: 120,
                    }}
                  >
                    {String(c.actual).slice(0, 800)}
                  </pre>
                )}
              </div>
              {/* Per-check retry: POST /verify with { check_ids: [single_id] } */}
              {(failed || pending) && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => onRetryCheck(c.id)}
                  disabled={retrying}
                  data-testid={`acceptance-retry-${c.id}`}
                >
                  Retry
                </Button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// ── KillConfirmModal ──────────────────────────────────────────────────────────
function KillConfirmModal({ open, onConfirm, onCancel, busy }) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(2px)" }}
      onClick={onCancel}
      data-testid="kill-confirm-modal"
    >
      <div
        className="rounded-[var(--mc-radius-lg)] border p-[var(--mc-space-6)] max-w-sm w-full mx-4"
        style={{ background: "var(--mc-bg-1)", borderColor: "var(--mc-line)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 mb-3">
          <div
            className="flex items-center justify-center rounded-full"
            style={{ width: 40, height: 40, background: "var(--mc-err-soft)", color: "var(--mc-err)" }}
          >
            <Skull size={20} />
          </div>
          <h3 className="m-0" style={{ fontSize: "var(--mc-text-md)", color: "var(--mc-fg)", fontFamily: "var(--mc-font-display)" }}>
            Kill agent?
          </h3>
        </div>
        <p style={{ fontSize: "var(--mc-text-sm)", color: "var(--mc-fg-2)", marginBottom: "var(--mc-space-4)" }}>
          Send SIGTERM to this agent. It will be force-killed after 6s if it ignores. The status will change to <strong>killed</strong>.
        </p>
        <div className="flex gap-[var(--mc-space-2)] justify-end">
          <Button variant="secondary" size="md" onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="md"
            onClick={onConfirm}
            disabled={busy}
            data-testid="kill-confirm-btn"
            style={{ background: "var(--mc-err)", borderColor: "var(--mc-err)" }}
          >
            {busy ? "Killing…" : "Kill agent"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── suggested action label / icon mapping ────────────────────────────────────
const SUGGESTED_ACTION_META = {
  retry:         { Icon: RefreshCw,     label: "Retry verify"      },
  verify_again:  { Icon: ShieldCheck,   label: "Verify again"      },
  open_diff:     { Icon: FileText,      label: "Open diff"         },
  open_log:      { Icon: TerminalIcon,  label: "Open log"          },
};

// ── AgentControls ─────────────────────────────────────────────────────────────
function AgentControls({ run, onVerify, onKill, busy }) {
  const status = run?.status;
  const canKill = status === "running";
  const canVerify = status === "claims_done" || status === "failed";
  const sa = run?.suggested_action;
  const saMeta = SUGGESTED_ACTION_META[sa];
  const SaIcon = saMeta?.Icon;
  return (
    <div className="flex items-center gap-[var(--mc-space-2)]" data-testid="agent-controls">
      {/* Suggested action (from WS / backend) */}
      {sa && SaIcon && (
        <div
          className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 border"
          style={{
            fontSize: "var(--mc-text-xs)",
            background: "var(--mc-accent-soft)",
            color: "var(--mc-accent)",
            borderColor: "var(--mc-accent)",
          }}
          title={`Backend suggests: ${sa}`}
          data-testid={`agent-suggested-action-${sa}`}
        >
          <SaIcon size={10} />
          <span>{saMeta.label}</span>
        </div>
      )}
      <Button
        variant="primary"
        size="md"
        onClick={onVerify}
        disabled={!canVerify || busy}
        data-testid="agent-control-verify"
      >
        <ShieldCheck size={14} />
        <span>Verify all</span>
      </Button>
      <Button
        variant="secondary"
        size="md"
        onClick={onKill}
        disabled={!canKill || busy}
        data-testid="agent-control-kill"
      >
        <Skull size={14} />
        <span>Kill agent</span>
      </Button>
    </div>
  );
}

// ── AgentRunDetail ────────────────────────────────────────────────────────────
function AgentRunDetail({ runId }) {
  const detail = useAgentRunDetail(runId);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState(null);
  const [killModalOpen, setKillModalOpen] = useState(false);

  // Verify all
  const handleVerifyAll = async () => {
    if (!runId || busy) return;
    setBusy(true); setActionError(null);
    try {
      await postRunVerify(runId);  // POST with empty body = run all
      await detail.reload();
    } catch (err) {
      setActionError(err.message);
    } finally {
      setBusy(false);
    }
  };

  // Per-check retry: POST /verify with { check_ids: [single_id] }
  const handleVerifyCheck = async (checkId) => {
    if (!runId || busy) return;
    setBusy(true); setActionError(null);
    try {
      await postRunVerify(runId, [checkId]);
      await detail.reload();
    } catch (err) {
      setActionError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleKillClick = () => setKillModalOpen(true);

  const handleKillConfirm = async () => {
    if (!runId || busy) return;
    setBusy(true); setActionError(null);
    try {
      await postRunKill(runId);
      setKillModalOpen(false);
      await detail.reload();
    } catch (err) {
      setActionError(err.message);
    } finally {
      setBusy(false);
    }
  };

  if (!runId) {
    return (
      <EmptyState
        title="Select a run"
        description="Pick an agent run on the left to see its tool stream, diff, and acceptance status."
      />
    );
  }
  if (detail.loading && !detail.run) {
    return <SkeletonCard />;
  }
  if (detail.error) {
    return (
      <ErrorState
        title="Could not load run"
        description={detail.error}
        fix={[
          { label: "Retry", onClick: detail.reload, variant: "primary" },
        ]}
      />
    );
  }
  const { run, events, checks, diff, lastHeartbeat } = detail;
  if (!run) {
    return (
      <ErrorState
        title="Run not found"
        description={`No run with id ${runId}`}
        fix={[{ label: "Reload list", onClick: () => window.history.back(), variant: "primary" }]}
      />
    );
  }
  const meta = statusMeta(run.status);
  const StatusIcon = meta.Icon;
  const elapsed = fmtElapsed(run.started_ts || run.dispatched_ts, run.ended_ts);

  return (
    <div className="flex flex-col gap-[var(--mc-space-4)]" data-testid={`agent-run-detail-${runId}`}>
      {/* Run header */}
      <Card>
        <div className="flex items-start justify-between gap-[var(--mc-space-3)] flex-wrap">
          <div className="min-w-0">
            <div className="flex items-center gap-[var(--mc-space-2)] flex-wrap">
              <h2
                className="m-0"
                style={{
                  fontSize: "var(--mc-text-md)",
                  color: "var(--mc-fg)",
                  fontFamily: "var(--mc-font-display)",
                }}
                data-testid="agent-run-title"
              >
                {run.phase_id || run.handoff_doc || "run"}
              </h2>
              <AgentStatusPill status={run.status} size="md" />
              {run.acceptance_total > 0 && (
                <Pill tone={(run.acceptance_passed || 0) === run.acceptance_total ? "ok" : "warn"} size="sm">
                  {run.acceptance_passed || 0}/{run.acceptance_total} ✓
                </Pill>
              )}
            </div>
            <div
              className="mt-[var(--mc-space-1)]"
              style={{ fontSize: "var(--mc-text-xs)", color: "var(--mc-fg-2)", fontFamily: "var(--mc-font-mono)" }}
            >
              {run.id} · {run.agent_id || "—"}
              {elapsed && <> · {elapsed}</>}
              {run.dispatched_ts && <> · dispatched {fmtAgo(run.dispatched_ts)}</>}
            </div>
          </div>
          <AgentControls run={run} onVerify={handleVerifyAll} onKill={handleKillClick} busy={busy} />
        </div>
        {actionError && (
          <div
            className="mt-[var(--mc-space-3)] p-[var(--mc-space-2)] rounded-[var(--mc-radius-sm)] flex items-center gap-2"
            style={{ background: "var(--mc-err-soft)", color: "var(--mc-err)", fontSize: "var(--mc-text-xs)" }}
          >
            <AlertCircle size={12} />
            {actionError}
            <Button variant="secondary" size="sm" onClick={() => setActionError(null)}>Dismiss</Button>
          </div>
        )}
        <div className="mt-[var(--mc-space-3)]">
          <Heartbeat lastHeartbeat={lastHeartbeat} status={run.status} onKill={handleKillClick} />
        </div>
      </Card>

      {/* Live event stream */}
      <Card>
        <div className="flex items-center gap-[var(--mc-space-2)] mb-[var(--mc-space-2)]">
          <Activity size={14} style={{ color: "var(--mc-fg-1)" }} />
          <span
            className="uppercase"
            style={{
              fontSize: "var(--mc-text-xs)",
              color: "var(--mc-fg-2)",
              letterSpacing: "var(--mc-tracking-wide)",
            }}
          >
            Live tool stream
          </span>
          <span className="flex-1" />
          <span style={{ fontSize: "var(--mc-text-xs)", color: "var(--mc-fg-2)" }}>
            {events.length} event{events.length === 1 ? "" : "s"}
          </span>
        </div>
        <AgentEventStream events={events} />
      </Card>

      {/* Diff */}
      <AgentDiffPane diff={diff} run={run} runId={runId} />

      {/* Acceptance */}
      <Card>
        <AcceptanceList
          checks={checks}
          onRetry={handleVerifyAll}
          onRetryCheck={handleVerifyCheck}
          retrying={busy}
        />
      </Card>

      {/* Kill confirm modal */}
      <KillConfirmModal
        open={killModalOpen}
        onConfirm={handleKillConfirm}
        onCancel={() => setKillModalOpen(false)}
        busy={busy}
      />
    </div>
  );
}

// ── PollingFallbackBanner ─────────────────────────────────────────────────────
function PollingFallbackBanner({ visible, onRetry }) {
  if (!visible) return null;
  return (
    <div
      className="flex items-center justify-between gap-3 px-[var(--mc-space-3)] py-[var(--mc-space-2)] rounded-[var(--mc-radius-md)]"
      style={{ background: "var(--mc-warn-soft)", border: "1px solid var(--mc-warn)", color: "var(--mc-warn)", fontSize: "var(--mc-text-xs)" }}
      data-testid="polling-fallback-banner"
    >
      <span>Live updates paused — reconnecting…</span>
      <Button variant="secondary" size="sm" onClick={onRetry}>
        <RefreshCw size={12} />
        <span>Retry</span>
      </Button>
    </div>
  );
}

// ── AgentLiveViewPage (route entry) ───────────────────────────────────────────
export default function AgentLiveViewPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const statusFilter = searchParams.get("status") || "";
  const urlSelected = searchParams.get("selected") || null;

  // Read poll fallback interval from config bus (§0.5 Live config)
  const configPoll = useConfigValue("agents.live_view.poll_fallback_s");
  const pollFallbackS = configPoll?.value;
  const pollIntervalMs = (typeof pollFallbackS === "number" && pollFallbackS > 0)
    ? pollFallbackS * 1000
    : 30_000;

  const { runs, loading, error, reload, runningCount, claimsCount, lastUpdated, wsDisconnected, reconnectWs }
    = useAgentRuns(statusFilter, { pollIntervalMs });

  const [selectedId, setSelectedId] = useState(urlSelected);

  // Sync URL → local state on mount / URL change
  useEffect(() => {
    if (urlSelected) setSelectedId(urlSelected);
  }, [urlSelected]);

  // Auto-select first run when list arrives, if nothing selected
  useEffect(() => {
    if (!selectedId && runs.length > 0) {
      const id = runs[0].id;
      setSelectedId(id);
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.set("selected", id);
        return next;
      }, { replace: true });
    }
  }, [runs, selectedId, setSearchParams]);

  // Validate selectedId still exists
  useEffect(() => {
    if (selectedId && runs.length > 0 && !runs.some((r) => r.id === selectedId)) {
      const id = runs[0].id;
      setSelectedId(id);
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.set("selected", id);
        return next;
      }, { replace: true });
    }
  }, [runs, selectedId, setSearchParams]);

  // Update URL when filter changes
  const handleFilterChange = useCallback((status) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams();
      if (status) next.set("status", status);
      // Preserve selected if still valid
      if (selectedId) next.set("selected", selectedId);
      return next;
    }, { replace: true });
  }, [selectedId, setSearchParams]);

  // Update URL when selection changes
  const handleSelect = useCallback((id) => {
    setSelectedId(id);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set("selected", id);
      return next;
    }, { replace: true });
  }, [setSearchParams]);

  return (
    <PageError>
      <PageShell maxWidth="1400px">
        <PageHeader
          title="Agent Live View"
          subtitle="Every running and recently-finished agent task — heartbeat, tool stream, diff, acceptance."
          actions={
            <>
              {runningCount > 0 && (
                <Pill tone="warn" size="md" icon={<Loader2 size={12} className="animate-spin" />}>
                  {runningCount} running
                </Pill>
              )}
              {claimsCount > 0 && (
                <Pill tone="warn" size="md" icon={<AlertCircle size={12} />}>
                  {claimsCount} awaiting verify
                </Pill>
              )}
              <Button variant="secondary" size="md" onClick={reload} disabled={loading} data-testid="agents-live-refresh">
                <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
                Refresh
              </Button>
            </>
          }
        />
        {error && (
          <ErrorState
            title="Could not reach agent runtime"
            description={error}
            fix={[
              { label: "Retry", onClick: reload, variant: "primary" },
            ]}
          />
        )}

        {/* Polling fallback banner */}
        <PollingFallbackBanner visible={wsDisconnected} onRetry={reconnectWs} />

        {/* Filter chips */}
        <div className="flex items-center gap-[var(--mc-space-2)] px-[var(--mc-page-px)] py-[var(--mc-space-2)] flex-wrap" data-testid="agent-live-filter-chips">
          <Filter size={14} style={{ color: "var(--mc-fg-2)" }} />
          {FILTER_STATUSES.map((f) => {
            const active = statusFilter === f.value;
            return (
              <button
                key={f.value}
                type="button"
                onClick={() => handleFilterChange(f.value)}
                className="rounded-[var(--mc-radius-full)] px-3 py-1 border transition-colors"
                data-testid={`filter-chip-${f.value || "all"}`}
                style={{
                  fontSize: "var(--mc-text-xs)",
                  fontFamily: "var(--mc-font-sans)",
                  letterSpacing: "var(--mc-tracking-wide)",
                  background: active ? "var(--mc-accent)" : "var(--mc-bg-1)",
                  color: active ? "var(--mc-fg)" : "var(--mc-fg-2)",
                  borderColor: active ? "var(--mc-accent)" : "var(--mc-line)",
                  cursor: "pointer",
                }}
              >
                {f.label}
              </button>
            );
          })}
        </div>

        <PageContent>
          <div
            className="grid gap-[var(--mc-space-4)]"
            style={{ gridTemplateColumns: "minmax(280px, 360px) 1fr", minHeight: 0 }}
          >
            <aside className="min-w-0">
              <AgentRunsList
                runs={runs}
                selectedId={selectedId}
                onSelect={handleSelect}
                loading={loading}
              />
            </aside>
            <section className="min-w-0">
              <AgentRunDetail runId={selectedId} />
            </section>
          </div>
        </PageContent>
        <PageMeta
          lastUpdated={lastUpdated}
          dataSource="GET /api/v2/agents/runs · WS /api/ws/config"
        />
      </PageShell>
    </PageError>
  );
}