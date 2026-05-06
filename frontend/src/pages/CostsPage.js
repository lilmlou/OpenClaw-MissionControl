import React, { useEffect, useMemo, useState } from "react";
import {
  DollarSign, RefreshCw, AlertCircle, TrendingUp, Activity,
  Brain, Hammer, Eye, FileCheck, Wrench, Layers,
} from "lucide-react";
import { C } from "@/lib/constants";
import { useGateway } from "@/lib/useGateway";

// /costs — token + cost dashboard.
//
// Wires to Sprint 5 backend (shipped):
//   GET /api/v2/usage/totals?since=&until=
//   GET /api/v2/usage/by-agent?since=&until=
//   GET /api/v2/usage/by-model?since=&until=
//   GET /api/v2/usage/projections
//
// Phase 1 (this commit): hero stats + by-agent/by-model tables +
//   projections card + time-range selector. Recharts area chart deferred
//   to a follow-up — recharts isn't yet a dep, and div-based bars cover
//   the by-agent/by-model views without bundling another 50KB minified.

const AGENT_META = {
  planner:    { color: "#3b82f6", Icon: Brain      },
  executor:   { color: "#eab308", Icon: Hammer     },
  supervisor: { color: "#22c55e", Icon: Eye        },
  auditor:    { color: "#a855f7", Icon: FileCheck  },
  watcher:    { color: "#6b7280", Icon: Activity   },
  builder:    { color: "#f97316", Icon: Wrench     },
  meta:       { color: "#ec4899", Icon: Layers     },
};

const TIME_RANGES = [
  { id: "today",    label: "Today",       hours: 24,    rangeFn: () => ({ since: startOfDay(), until: null, label: "today" }) },
  { id: "yesterday",label: "Yesterday",   hours: 24,    rangeFn: () => { const e = startOfDay(); return { since: e - 86400_000, until: e, label: "yesterday" }; } },
  { id: "7d",       label: "Last 7 days", hours: 168,   rangeFn: () => ({ since: Date.now() - 7*86400_000,  until: null, label: "7d" }) },
  { id: "30d",      label: "Last 30 days",hours: 720,   rangeFn: () => ({ since: Date.now() - 30*86400_000, until: null, label: "30d" }) },
];
function startOfDay() {
  const d = new Date(); d.setHours(0,0,0,0); return d.getTime();
}

function fmtUsd(v) {
  if (v == null) return "—";
  if (v === 0) return "free";
  if (v < 0.0001) return "<$0.0001";
  if (v < 1) return `$${v.toFixed(4)}`;
  return `$${v.toFixed(2)}`;
}
function fmtTokens(v) {
  if (v == null) return "—";
  if (v < 1000) return String(v);
  if (v < 1_000_000) return `${(v/1000).toFixed(1)}K`;
  return `${(v/1_000_000).toFixed(2)}M`;
}
function fmtRelative(ts) {
  if (!ts) return "—";
  const diff = Date.now() - ts;
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff/60_000)}m ago`;
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function HeroCard({ label, value, sub, color, icon: Icon }) {
  return (
    <div className="p-4 rounded-xl"
         style={{ background: C.surface, border: `1px solid ${C.border}` }}>
      <div className="flex items-center gap-2 mb-1.5" style={{ color: C.muted }}>
        {Icon && <Icon className="w-3.5 h-3.5" />}
        <span className="text-[11px] uppercase tracking-wider font-semibold">{label}</span>
      </div>
      <div className="text-2xl font-semibold tabular-nums" style={{ color: color || C.text }}>
        {value}
      </div>
      {sub && (
        <div className="text-[11px] mt-1" style={{ color: C.muted }}>{sub}</div>
      )}
    </div>
  );
}

// Horizontal bar — width is value/max %, segment colour is `color`.
function HorizontalBar({ label, value, max, formatted, color, sublabel }) {
  const pct = max > 0 ? Math.max(2, Math.round((value / max) * 100)) : 0;
  return (
    <div className="grid grid-cols-[140px_1fr_auto] items-center gap-3 py-1.5">
      <div className="min-w-0">
        <div className="text-[12px] truncate" style={{ color: C.text }}>{label}</div>
        {sublabel && <div className="text-[10px] truncate font-mono" style={{ color: C.muted }}>{sublabel}</div>}
      </div>
      <div className="h-2 rounded-full overflow-hidden" style={{ background: C.surface2 }}>
        <div className="h-full transition-all"
             style={{ width: `${pct}%`, background: color || C.accent, boxShadow: `0 0 6px ${color || C.accent}55` }} />
      </div>
      <div className="text-[12px] font-mono tabular-nums shrink-0 min-w-[70px] text-right" style={{ color: C.text }}>
        {formatted}
      </div>
    </div>
  );
}

export default function CostsPage() {
  const {
    usage,
    setUsageTimeRange,
    refreshAllUsage,
  } = useGateway();
  const [tab, setTab] = useState("agent");      // 'agent' | 'model'
  const [sortBy, setSortBy] = useState("cost"); // 'cost' | 'calls' | 'tokens'
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [rangeId, setRangeId] = useState("today");

  // Apply time range + initial fetch.
  useEffect(() => {
    const tr = TIME_RANGES.find((r) => r.id === rangeId) || TIME_RANGES[0];
    setUsageTimeRange(tr.rangeFn());
    refreshAllUsage().catch(() => null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rangeId]);

  // 30s auto-refresh per spec.
  useEffect(() => {
    if (!autoRefresh) return;
    const id = setInterval(() => {
      if (document.visibilityState === "visible") {
        refreshAllUsage({ silent: true }).catch(() => null);
      }
    }, 30_000);
    return () => clearInterval(id);
  }, [autoRefresh, refreshAllUsage]);

  const totals = usage.totals;
  const projections = usage.projections;

  const sortedAgent = useMemo(() => {
    const key = sortBy === "cost" ? "cost_usd" : sortBy === "calls" ? "calls" : "tokens_in";
    return [...usage.byAgent].sort((a, b) => (b[key] || 0) - (a[key] || 0));
  }, [usage.byAgent, sortBy]);
  const sortedModel = useMemo(() => {
    const key = sortBy === "cost" ? "cost_usd" : sortBy === "calls" ? "calls" : "tokens_in";
    return [...usage.byModel].sort((a, b) => (b[key] || 0) - (a[key] || 0));
  }, [usage.byModel, sortBy]);

  const maxAgent = useMemo(() => {
    const key = sortBy === "cost" ? "cost_usd" : sortBy === "calls" ? "calls" : "tokens_in";
    return Math.max(...sortedAgent.map((a) => a[key] || 0), 0.0001);
  }, [sortedAgent, sortBy]);
  const maxModel = useMemo(() => {
    const key = sortBy === "cost" ? "cost_usd" : sortBy === "calls" ? "calls" : "tokens_in";
    return Math.max(...sortedModel.map((m) => m[key] || 0), 0.0001);
  }, [sortedModel, sortBy]);

  // Subscriptions hero — backend doesn't yet split subscription vs PAYG;
  // we approximate from provider names. When Sprint 8 quota tracking
  // ships, swap in real coverage data.
  const subscriptionStat = useMemo(() => {
    if (!usage.byModel?.length) return null;
    const totalCost = usage.byModel.reduce((s, m) => s + (m.cost_usd || 0), 0);
    const totalCalls = usage.byModel.reduce((s, m) => s + (m.calls || 0), 0);
    const subProviders = new Set(["ollama", "venice", "anthropic", "opencode", "opencode-go"]);
    const subCalls = usage.byModel
      .filter((m) => subProviders.has(m.provider))
      .reduce((s, m) => s + (m.calls || 0), 0);
    const coveredPct = totalCalls > 0 ? Math.round((subCalls / totalCalls) * 100) : 100;
    return { coveredPct, outOfPocket: totalCost, subCalls, totalCalls };
  }, [usage.byModel]);

  return (
    <div className="h-full flex flex-col" style={{ color: C.text }}>
      {/* Header + toolbar */}
      <div className="shrink-0 px-6 py-3 space-y-3"
           style={{ borderBottom: `1px solid ${C.border}` }}>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <DollarSign className="w-5 h-5" style={{ color: C.accent }} />
            <div>
              <h1 className="text-lg font-semibold" style={{ color: C.text }}>Costs</h1>
              <p className="text-[11px]" style={{ color: C.muted }}>
                Token usage and cost tracking · {usage.lastUpdated ? `updated ${fmtRelative(usage.lastUpdated)}` : "—"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
              />
              <span style={{ color: C.muted }}>Auto-refresh 30s</span>
            </label>
            <button
              type="button"
              onClick={() => refreshAllUsage()}
              disabled={usage.loading}
              className="px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 disabled:opacity-50"
              style={{ background: C.surface2, border: `1px solid ${C.border}`, color: C.text }}
              data-testid="costs-refresh"
            >
              <RefreshCw className={`w-3 h-3 ${usage.loading ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>
        </div>

        {/* Time range pills */}
        <div className="flex items-center gap-1 flex-wrap">
          {TIME_RANGES.map((r) => {
            const active = rangeId === r.id;
            return (
              <button
                key={r.id}
                type="button"
                onClick={() => setRangeId(r.id)}
                className="px-3 py-1 rounded-full text-[11px] font-medium transition-colors"
                style={{
                  background: active ? `${C.accent}22` : C.surface2,
                  color: active ? C.text : C.muted,
                  border: `1px solid ${active ? `${C.accent}44` : C.border}`,
                }}
                data-testid={`costs-range-${r.id}`}
              >
                {r.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Error banner */}
      {usage.error && (
        <div className="mx-6 my-2 p-3 rounded-lg text-xs flex items-start gap-2 shrink-0"
             style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", color: "#f87171" }}>
          <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <div className="font-mono">{usage.error}</div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-6 space-y-5">
        <div className="max-w-6xl mx-auto space-y-5">
          {/* Hero row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <HeroCard
              label="Spend"
              value={fmtUsd(totals?.total_cost_usd)}
              sub={totals ? `${totals.total_calls ?? 0} calls` : "—"}
              color={totals?.total_cost_usd > 0 ? C.text : C.green}
              icon={DollarSign}
            />
            <HeroCard
              label="Tokens In"
              value={fmtTokens(totals?.total_tokens_in)}
              sub="prompt"
              icon={TrendingUp}
            />
            <HeroCard
              label="Tokens Out"
              value={fmtTokens(totals?.total_tokens_out)}
              sub="completion"
              icon={TrendingUp}
            />
            <HeroCard
              label="Projected (Month)"
              value={fmtUsd(projections?.projected_monthly_usd)}
              sub={projections ? `${projections.confidence} confidence · ${projections.based_on_days}d sample` : "—"}
              icon={TrendingUp}
            />
          </div>

          {/* Subscriptions card */}
          {subscriptionStat && (
            <div className="p-4 rounded-xl"
                 style={{ background: C.surface, border: `1px solid ${C.border}` }}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[12px] font-semibold uppercase tracking-wider" style={{ color: C.muted }}>
                  Subscriptions
                </span>
                <span className="text-[10px]" style={{ color: C.muted }}>
                  {subscriptionStat.subCalls} of {subscriptionStat.totalCalls} calls covered
                </span>
              </div>
              <div className="flex items-center gap-3 mb-1">
                <span className="text-2xl font-semibold tabular-nums" style={{ color: C.green }}>
                  {subscriptionStat.coveredPct}%
                </span>
                <span className="text-[12px]" style={{ color: C.muted }}>covered by flat-rate plans</span>
                <span className="ml-auto text-[12px] font-mono" style={{ color: C.text }}>
                  {fmtUsd(subscriptionStat.outOfPocket)} out-of-pocket
                </span>
              </div>
              <div className="h-2 rounded-full overflow-hidden" style={{ background: C.surface2 }}>
                <div className="h-full transition-all"
                     style={{ width: `${subscriptionStat.coveredPct}%`, background: C.green }} />
              </div>
              <div className="text-[10px] mt-2" style={{ color: C.muted }}>
                Approximate — subscription split is inferred from provider name. Sprint 8 quota tracking will
                replace this with real coverage + cap-proximity data.
              </div>
            </div>
          )}

          {/* By-agent / by-model tabs */}
          <div className="p-4 rounded-xl"
               style={{ background: C.surface, border: `1px solid ${C.border}` }}>
            <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
              <div className="flex items-center gap-1">
                {[
                  { id: "agent", label: "By Agent" },
                  { id: "model", label: "By Model" },
                ].map((t) => {
                  const active = tab === t.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setTab(t.id)}
                      className="px-3 py-1.5 rounded-md text-[12px] font-medium transition-colors"
                      style={{
                        background: active ? `${C.accent}22` : C.surface2,
                        color: active ? C.text : C.muted,
                        border: `1px solid ${active ? `${C.accent}44` : C.border}`,
                      }}
                      data-testid={`costs-tab-${t.id}`}
                    >
                      {t.label}
                    </button>
                  );
                })}
              </div>
              <div className="flex items-center gap-1.5 text-[11px]">
                <span style={{ color: C.muted }}>Sort by:</span>
                {[
                  { id: "cost",   label: "Cost"   },
                  { id: "calls",  label: "Calls"  },
                  { id: "tokens", label: "Tokens" },
                ].map((s) => {
                  const active = sortBy === s.id;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setSortBy(s.id)}
                      className="px-2 py-0.5 rounded transition-colors"
                      style={{
                        background: active ? `${C.accent}22` : "transparent",
                        color: active ? C.text : C.muted,
                        border: `1px solid ${active ? `${C.accent}44` : C.border}`,
                      }}
                    >
                      {s.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {tab === "agent" ? (
              sortedAgent.length === 0 ? (
                <div className="text-[12px] text-center py-4" style={{ color: C.muted }}>
                  No agent activity in this range.
                </div>
              ) : (
                <div className="space-y-0.5">
                  {sortedAgent.map((a) => {
                    const meta = AGENT_META[a.agent] || { color: C.muted, Icon: Activity };
                    const Icon = meta.Icon;
                    const value = sortBy === "cost" ? a.cost_usd : sortBy === "calls" ? a.calls : a.tokens_in;
                    const formatted = sortBy === "cost"
                      ? fmtUsd(a.cost_usd)
                      : sortBy === "calls"
                      ? `${a.calls}`
                      : fmtTokens(a.tokens_in);
                    return (
                      <HorizontalBar
                        key={a.agent}
                        label={(<span className="inline-flex items-center gap-1.5">
                          <Icon className="w-3 h-3" style={{ color: meta.color }} /> {a.agent}
                        </span>)}
                        value={value || 0}
                        max={maxAgent}
                        formatted={formatted}
                        color={meta.color}
                        sublabel={`${a.calls} calls · ${fmtTokens(a.tokens_in)}/${fmtTokens(a.tokens_out)}`}
                      />
                    );
                  })}
                </div>
              )
            ) : (
              sortedModel.length === 0 ? (
                <div className="text-[12px] text-center py-4" style={{ color: C.muted }}>
                  No model activity in this range.
                </div>
              ) : (
                <div className="space-y-0.5">
                  {sortedModel.slice(0, 10).map((m) => {
                    const value = sortBy === "cost" ? m.cost_usd : sortBy === "calls" ? m.calls : m.tokens_in;
                    const formatted = sortBy === "cost"
                      ? fmtUsd(m.cost_usd)
                      : sortBy === "calls"
                      ? `${m.calls}`
                      : fmtTokens(m.tokens_in);
                    return (
                      <HorizontalBar
                        key={m.model}
                        label={m.model}
                        value={value || 0}
                        max={maxModel}
                        formatted={formatted}
                        color={C.accent}
                        sublabel={`${m.provider} · ${m.calls} calls · ${fmtTokens(m.tokens_in)}/${fmtTokens(m.tokens_out)}`}
                      />
                    );
                  })}
                  {sortedModel.length > 10 && (
                    <div className="text-[10px] mt-2 px-1" style={{ color: C.muted }}>
                      Showing top 10 of {sortedModel.length} models.
                    </div>
                  )}
                </div>
              )
            )}
          </div>

          <div className="text-[10px] px-1" style={{ color: C.muted }}>
            Daily trend area chart deferred — recharts not yet a dep, will land with the
            chart introduction in Phase D polish. Hover-tooltip cost breakdowns on task
            rows wire when AgentsPage / JobsPage rows are upgraded with token columns.
          </div>
        </div>
      </div>
    </div>
  );
}
