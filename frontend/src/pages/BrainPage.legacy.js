// /brain — Brain Dashboard (BRAIN-1)
// Live view of the gateway brain: which models perform best, which contexts,
// recent outcomes, and feedback-loop state.
// NO MOCK DATA. Real fetches against AgentRuntime gateway on :7801.
import React, { useEffect, useState, useCallback } from "react";

const GATEWAY = "http://127.0.0.1:7801";
const LOOKBACK_MS = 7 * 24 * 60 * 60 * 1000;

function Pill({ tone = "neutral", children }) {
  const toneMap = {
    good:    { bg: "var(--mc-ok-soft)",      fg: "var(--mc-ok)",     border: "rgba(94,226,201,0.32)" },
    warn:    { bg: "var(--mc-warn-soft)",    fg: "var(--mc-warn)",   border: "rgba(229,177,53,0.32)" },
    bad:     { bg: "var(--mc-err-soft)",     fg: "var(--mc-err)",    border: "rgba(224,85,85,0.32)" },
    neutral: { bg: "var(--mc-bg-2)",         fg: "var(--mc-fg-2)",   border: "var(--mc-line-strong)" },
    accent:  { bg: "var(--mc-accent-soft)",  fg: "var(--mc-accent)", border: "rgba(229,177,53,0.32)" },
    accent2: { bg: "var(--mc-accent-2-soft)", fg: "var(--mc-accent-2)", border: "rgba(94,226,201,0.32)" },
  };
  const c = toneMap[tone] || toneMap.neutral;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", padding: "3px 11px", borderRadius: 999,
      background: c.bg, color: c.fg, border: `1px solid ${c.border}`,
      fontSize: 11, fontWeight: 600, letterSpacing: 0.3,
    }}>
      {children}
    </span>
  );
}

function Card({ title, action, children }) {
  return (
    <div style={{
      background: "var(--mc-bg-1)",
      border: "1px solid var(--mc-line)",
      borderRadius: "var(--mc-radius-lg)",
      padding: 20,
      marginBottom: 16,
      boxShadow: "var(--mc-shadow-1)",
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <h3 style={{
          margin: 0,
          fontFamily: "var(--mc-font-display)",
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: 1.4,
          textTransform: "uppercase",
          color: "var(--mc-fg-2)",
        }}>
          {title}
        </h3>
        {action}
      </div>
      {children}
    </div>
  );
}

function EmptyState({ children }) {
  return (
    <div style={{ padding: "24px 0", textAlign: "center", color: "var(--mc-fg-2)", fontSize: 13 }}>
      {children}
    </div>
  );
}

function ErrorState({ error, onRetry }) {
  return (
    <div style={{
      padding: 16,
      borderRadius: 10,
      background: "var(--mc-err-soft)",
      border: "1px solid rgba(224,85,85,0.32)",
      color: "var(--mc-err)",
    }}>
      <div style={{ fontSize: 13, marginBottom: 10 }}>{error}</div>
      {onRetry && (
        <button onClick={onRetry} style={{
          padding: "6px 14px", fontSize: 12, borderRadius: 6,
          background: "var(--mc-bg-2)", border: "1px solid var(--mc-line-strong)",
          color: "var(--mc-fg)", cursor: "pointer",
        }}>Retry</button>
      )}
    </div>
  );
}

function useGatewayJson(path, refreshMs = 15000) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const fetcher = useCallback(async () => {
    try {
      const r = await fetch(`${GATEWAY}${path}`, { cache: "no-store" });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = await r.json();
      setData(j);
      setError(null);
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setLoading(false);
    }
  }, [path]);
  useEffect(() => {
    fetcher();
    const iv = setInterval(fetcher, refreshMs);
    return () => clearInterval(iv);
  }, [fetcher, refreshMs]);
  return { data, error, loading, refresh: fetcher };
}

export default function BrainPage() {
  const insights = useGatewayJson("/api/v2/learning/insights", 15000);
  const scores = useGatewayJson(`/api/v2/learning/scores?lookback=${LOOKBACK_MS}`, 15000);
  const outcomes = useGatewayJson(`/api/v2/agents/outcomes?since=${Date.now() - LOOKBACK_MS}&limit=20`, 15000);

  const fmtRate = (r) => (r == null ? "—" : `${(r * 100).toFixed(0)}%`);
  const fmtRating = (r) => (r == null ? "—" : r.toFixed(2));
  const fmtQuality = (q) => (q == null ? "—" : q.toFixed(2));

  return (
    <div style={{
      padding: "28px 36px 64px",
      maxWidth: 1400,
      margin: "0 auto",
      overflowY: "auto",
      height: "100%",
      color: "var(--mc-fg)",
    }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{
          margin: 0,
          fontFamily: "var(--mc-font-display)",
          fontSize: 28,
          fontWeight: 700,
          letterSpacing: -0.5,
          color: "var(--mc-fg)",
          display: "flex",
          alignItems: "center",
          gap: 12,
        }}>
          <span style={{
            background: "linear-gradient(135deg, var(--mc-accent) 0%, var(--mc-accent-2) 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
          }}>
            Brain
          </span>
          <span style={{ fontSize: 24, opacity: 0.9 }}>🧠</span>
        </h1>
        <p style={{
          color: "var(--mc-fg-2)",
          fontSize: 13,
          marginTop: 6,
          lineHeight: 1.5,
          maxWidth: 720,
        }}>
          Self-learning model router. Tracks which models perform best for each agent,
          learns from outcomes, adapts over time.
          {" "}
          <span style={{ color: "var(--mc-fg-3)", fontFamily: "var(--mc-font-mono)", fontSize: 11 }}>
            /api/v2/learning/*
          </span>
        </p>
      </div>

      {/* Top: Feedback-loop status */}
      <Card title="Feedback Loop Status">
        {insights.loading && <EmptyState>Loading…</EmptyState>}
        {insights.error && <ErrorState error={insights.error} onRetry={insights.refresh} />}
        {insights.data && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14 }}>
            <Stat label="Feedback enabled" value={insights.data.feedback_enabled ? "ON" : "OFF"} tone={insights.data.feedback_enabled ? "good" : "warn"} />
            <Stat label="Pairs tracked" value={insights.data.total_pairs ?? 0} tone="accent" />
            <Stat label="Pairs rated" value={insights.data.rated_pairs ?? 0} tone={insights.data.rated_pairs > 0 ? "good" : "warn"} />
            <Stat label="Lookback" value={`${Math.round((insights.data.lookback_ms || 0) / 86400000)}d`} />
          </div>
        )}
        {insights.data?.summary && (
          <p style={{
            fontSize: 13,
            color: "var(--mc-fg-1)",
            marginTop: 16,
            lineHeight: 1.6,
            paddingTop: 14,
            borderTop: "1px solid var(--mc-line)",
          }}>
            {insights.data.summary}
          </p>
        )}
      </Card>

      {/* Top performers */}
      <Card title="Top Performers">
        {insights.data?.top_performers?.length ? (
          <PerformanceTable rows={insights.data.top_performers} fmtRate={fmtRate} fmtRating={fmtRating} fmtQuality={fmtQuality} tone="good" />
        ) : (
          <EmptyState>
            {insights.data ? "No top performers yet — need at least 3 ratings ≥ 4/5." : "Loading…"}
          </EmptyState>
        )}
      </Card>

      {/* Underperformers */}
      <Card title="Underperformers">
        {insights.data?.underperformers?.length ? (
          <PerformanceTable rows={insights.data.underperformers} fmtRate={fmtRate} fmtRating={fmtRating} fmtQuality={fmtQuality} tone="bad" />
        ) : (
          <EmptyState>No underperformers in the last 7 days.</EmptyState>
        )}
      </Card>

      {/* Full score table */}
      <Card title="Full Performance Table" action={<Pill tone="accent">{scores.data?.scores?.length || 0} pairs</Pill>}>
        {scores.loading && <EmptyState>Loading…</EmptyState>}
        {scores.error && <ErrorState error={scores.error} onRetry={scores.refresh} />}
        {scores.data?.scores?.length ? (
          <PerformanceTable rows={scores.data.scores} fmtRate={fmtRate} fmtRating={fmtRating} fmtQuality={fmtQuality} />
        ) : !scores.loading && !scores.error ? (
          <EmptyState>No (agent, model) pairs in the last 7 days yet.</EmptyState>
        ) : null}
      </Card>

      {/* Recent outcomes */}
      <Card title="Recent Outcomes" action={<Pill tone="accent">{outcomes.data?.outcomes?.length || 0} entries</Pill>}>
        {outcomes.loading && <EmptyState>Loading…</EmptyState>}
        {outcomes.error && <ErrorState error={outcomes.error} onRetry={outcomes.refresh} />}
        {outcomes.data?.outcomes?.length ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 380, overflowY: "auto" }}>
            {outcomes.data.outcomes.map((o) => (
              <div key={o.id} style={{
                display: "grid",
                gridTemplateColumns: "minmax(80px, 110px) auto 1fr auto",
                alignItems: "center",
                gap: 12,
                padding: "10px 12px",
                background: "var(--mc-bg-2)",
                borderRadius: "var(--mc-radius-sm)",
                border: "1px solid var(--mc-line)",
                fontSize: 12,
              }}>
                <span style={{
                  color: "var(--mc-fg-1)",
                  fontFamily: "var(--mc-font-mono)",
                  fontSize: 11,
                }}>
                  {o.task_id?.slice(0, 8)}…
                </span>
                <Pill tone={o.outcome === "approved" ? "good" : o.outcome === "rejected" ? "bad" : "warn"}>
                  {o.outcome}
                </Pill>
                <span style={{ color: "var(--mc-fg-1)" }}>
                  Rating: <strong style={{ color: "var(--mc-fg)" }}>{o.rating != null ? `${o.rating}/5` : "—"}</strong>
                </span>
                <span style={{ color: "var(--mc-fg-2)", fontSize: 11, fontFamily: "var(--mc-font-mono)" }}>
                  {new Date(o.decided_at).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        ) : !outcomes.loading && !outcomes.error ? (
          <EmptyState>No rated outcomes yet. Use the rating buttons on completed tasks to teach the brain.</EmptyState>
        ) : null}
      </Card>
    </div>
  );
}

function Stat({ label, value, tone = "neutral" }) {
  const valColor =
    tone === "good" ? "var(--mc-ok)"
    : tone === "warn" ? "var(--mc-warn)"
    : tone === "accent" ? "var(--mc-accent)"
    : "var(--mc-fg)";
  return (
    <div style={{
      padding: 16,
      borderRadius: "var(--mc-radius-md)",
      background: "var(--mc-bg-2)",
      border: "1px solid var(--mc-line)",
    }}>
      <div style={{
        fontSize: 10,
        color: "var(--mc-fg-2)",
        textTransform: "uppercase",
        letterSpacing: 1.2,
        fontWeight: 600,
        marginBottom: 8,
      }}>
        {label}
      </div>
      <div style={{
        fontSize: 22,
        fontWeight: 700,
        fontFamily: "var(--mc-font-mono)",
        color: valColor,
        letterSpacing: -0.5,
      }}>
        {value}
      </div>
    </div>
  );
}

function PerformanceTable({ rows, fmtRate, fmtRating, fmtQuality, tone }) {
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
        <thead>
          <tr style={{
            color: "var(--mc-fg-2)",
            textAlign: "left",
            fontSize: 10,
            textTransform: "uppercase",
            letterSpacing: 1.2,
            fontWeight: 600,
          }}>
            <th style={{ padding: "10px 6px" }}>Agent</th>
            <th style={{ padding: "10px 6px" }}>Model</th>
            <th style={{ padding: "10px 6px", textAlign: "right" }}>Calls</th>
            <th style={{ padding: "10px 6px", textAlign: "right" }}>Rated</th>
            <th style={{ padding: "10px 6px", textAlign: "right" }}>Avg ★</th>
            <th style={{ padding: "10px 6px", textAlign: "right" }}>Quality</th>
            <th style={{ padding: "10px 6px", textAlign: "right" }}>Fail %</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={`${r.agent}-${r.model}-${i}`}
              style={{ borderTop: "1px solid var(--mc-line)" }}>
              <td style={{ padding: "10px 6px", color: "var(--mc-fg)", fontWeight: 500 }}>{r.agent}</td>
              <td style={{
                padding: "10px 6px",
                color: "var(--mc-fg-1)",
                fontFamily: "var(--mc-font-mono)",
                fontSize: 11,
              }}>
                {r.model}
              </td>
              <td style={{ padding: "10px 6px", textAlign: "right", color: "var(--mc-fg-1)" }}>{r.calls ?? r.call_count}</td>
              <td style={{ padding: "10px 6px", textAlign: "right", color: "var(--mc-fg-1)" }}>{r.rated ?? r.rated_count}</td>
              <td style={{ padding: "10px 6px", textAlign: "right" }}>
                <Pill tone={tone || (r.avg_rating >= 4 ? "good" : r.avg_rating >= 3 ? "warn" : r.avg_rating ? "bad" : "neutral")}>
                  {fmtRating(r.avg_rating)}
                </Pill>
              </td>
              <td style={{ padding: "10px 6px", textAlign: "right", color: "var(--mc-fg-1)" }}>{fmtQuality(r.avg_quality)}</td>
              <td style={{
                padding: "10px 6px",
                textAlign: "right",
                color: r.fail_rate > 0.3 ? "var(--mc-err)" : "var(--mc-fg-1)",
              }}>
                {fmtRate(r.fail_rate)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
