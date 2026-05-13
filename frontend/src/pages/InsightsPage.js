/**
 * P0-A FE-5 — Insights Page
 *
 * Route: /insights
 * Polls GET /api/v1/brain/insights every 60s.
 * by_context table, recent_improvements list, totals strip.
 * NO MOCK DATA — real HTTP against AgentRuntime :7801.
 * Empty state with action to go send a message.
 */

import React, { useEffect, useState, useCallback } from "react";
import { Brain, Star, TrendingUp, MessageSquare } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { getApiBase } from "@/lib/useGateway";

const GATEWAY_BASE = getApiBase() || "http://127.0.0.1:7801";
const POLL_MS = 60000;

function EmptyState({ message, action }) {
  return (
    <div style={{ padding: "40px 20px", textAlign: "center" }}>
      <Brain size={48} style={{ color: "var(--mc-fg-3)", marginBottom: 16, opacity: 0.5 }} />
      <div style={{ color: "var(--mc-fg-2)", fontSize: 13, marginBottom: 16 }}>{message}</div>
      {action}
    </div>
  );
}

function ErrorState({ error, onRetry }) {
  return (
    <div style={{
      padding: 16, borderRadius: 10,
      background: "var(--mc-err-soft)", border: "1px solid rgba(224,85,85,0.32)",
      color: "var(--mc-err)", marginBottom: 16,
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

function StarRating({ rating }) {
  const stars = [];
  for (let i = 1; i <= 5; i++) {
    stars.push(
      <Star key={i} size={12}
        fill={i <= Math.round(rating) ? "var(--mc-accent)" : "none"}
        color={i <= Math.round(rating) ? "var(--mc-accent)" : "var(--mc-fg-3)"}
      />
    );
  }
  return <span style={{ display: "inline-flex", gap: 2, alignItems: "center" }}>{stars}</span>;
}

export default function InsightsPage() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  const fetchInsights = useCallback(async () => {
    try {
      const res = await fetch(`${GATEWAY_BASE}/api/v1/brain/insights`, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const payload = await res.json();
      setData(payload?.data || payload);
      setError(null);
      setLastUpdated(Date.now());
    } catch (err) {
      setError(err.message || String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInsights();
    const iv = setInterval(fetchInsights, POLL_MS);
    return () => clearInterval(iv);
  }, [fetchInsights]);

  const timeAgo = lastUpdated
    ? `${Math.round((Date.now() - lastUpdated) / 60000)}m ago`
    : "—";

  const byContext = data?.by_context || {};
  const contextEntries = Object.entries(byContext);
  const improvements = data?.recent_improvements || [];
  const totalTurns = data?.total_turns || 0;
  const totalFeedback = data?.total_feedback || 0;

  return (
    <div style={{
      padding: "28px 36px 64px", maxWidth: 1100, margin: "0 auto",
      overflowY: "auto", height: "100%", color: "var(--mc-fg)",
    }}>
      {/* Header */}
      <div style={{ marginBottom: 28, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <h1 style={{
            margin: 0, fontFamily: "var(--mc-font-display)", fontSize: 28, fontWeight: 700,
            letterSpacing: -0.5, color: "var(--mc-fg)", display: "flex", alignItems: "center", gap: 12,
          }}>
            <span style={{
              background: "linear-gradient(135deg, var(--mc-accent-2) 0%, var(--mc-accent) 100%)",
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text",
            }}>
              Insights
            </span>
            <TrendingUp size={24} style={{ color: "var(--mc-accent-2)" }} />
          </h1>
          <p style={{ color: "var(--mc-fg-2)", fontSize: 13, marginTop: 6 }}>
            Model performance by context. The brain learns from every turn.
          </p>
        </div>
        <span style={{ fontSize: 11, color: "var(--mc-fg-3)", fontFamily: "var(--mc-font-mono)" }}>
          Updated {timeAgo}
        </span>
      </div>

      {/* Error */}
      {error && <ErrorState error={error} onRetry={fetchInsights} />}

      {/* Loading */}
      {loading && (
        <EmptyState message="Loading insights…" />
      )}

      {/* Empty */}
      {!loading && !error && contextEntries.length === 0 && (
        <EmptyState
          message="No brain turns recorded yet"
          action={
            <button onClick={() => navigate("/")} style={{
              padding: "8px 20px", borderRadius: 8, fontSize: 13, fontWeight: 600,
              background: "var(--mc-accent)", color: "var(--mc-accent-fg)",
              border: "none", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 8,
            }}>
              <MessageSquare size={14} /> Send a message to start
            </button>
          }
        />
      )}

      {/* By Context Table */}
      {contextEntries.length > 0 && (
        <div style={{
          background: "var(--mc-bg-1)", border: "1px solid var(--mc-line)",
          borderRadius: "var(--mc-radius-lg)", padding: 20, marginBottom: 16,
        }}>
          <h3 style={{
            margin: "0 0 16px 0", fontFamily: "var(--mc-font-display)", fontSize: 11,
            fontWeight: 700, letterSpacing: 1.4, textTransform: "uppercase", color: "var(--mc-fg-2)",
          }}>
            By Context
          </h3>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ color: "var(--mc-fg-2)", fontSize: 10, textTransform: "uppercase", letterSpacing: 1.2, fontWeight: 600 }}>
                  <th style={{ padding: "10px 8px", textAlign: "left" }}>Context</th>
                  <th style={{ padding: "10px 8px", textAlign: "left" }}>Top Model</th>
                  <th style={{ padding: "10px 8px", textAlign: "center" }}>Avg Rating</th>
                  <th style={{ padding: "10px 8px", textAlign: "right" }}>Turns</th>
                </tr>
              </thead>
              <tbody>
                {contextEntries.sort(([, a], [, b]) => (b.turn_count || 0) - (a.turn_count || 0)).map(([ctx, info]) => (
                  <tr key={ctx} style={{ borderTop: "1px solid var(--mc-line)" }}>
                    <td style={{ padding: "10px 8px" }}>
                      <span style={{
                        display: "inline-block", padding: "3px 10px", borderRadius: 999, fontSize: 11, fontWeight: 600,
                        background: ctxColor(ctx).bg, color: ctxColor(ctx).fg,
                        border: `1px solid ${ctxColor(ctx).border}`,
                      }}>
                        {ctx}
                      </span>
                    </td>
                    <td style={{
                      padding: "10px 8px", color: "var(--mc-fg-1)",
                      fontFamily: "var(--mc-font-mono)", fontSize: 11,
                    }}>
                      {info.top_model || "—"}
                    </td>
                    <td style={{ padding: "10px 8px", textAlign: "center" }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                        <StarRating rating={info.avg_rating || 0} />
                        <span style={{ color: "var(--mc-fg-1)", fontSize: 12, fontWeight: 600 }}>
                          {info.avg_rating != null ? info.avg_rating.toFixed(1) : "—"}
                        </span>
                      </div>
                    </td>
                    <td style={{ padding: "10px 8px", textAlign: "right", fontWeight: 600, color: "var(--mc-fg)" }}>
                      {info.turn_count || 0}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Recent Improvements */}
      {improvements.length > 0 && (
        <div style={{
          background: "var(--mc-bg-1)", border: "1px solid var(--mc-line)",
          borderRadius: "var(--mc-radius-lg)", padding: 20, marginBottom: 16,
        }}>
          <h3 style={{
            margin: "0 0 16px 0", fontFamily: "var(--mc-font-display)", fontSize: 11,
            fontWeight: 700, letterSpacing: 1.4, textTransform: "uppercase", color: "var(--mc-fg-2)",
          }}>
            <TrendingUp size={14} style={{ marginRight: 6, verticalAlign: "middle" }} />
            Recent Improvements
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {improvements.map((imp, i) => (
              <div key={i} style={{
                display: "flex", alignItems: "center", gap: 12, padding: "8px 12px",
                background: "var(--mc-bg-2)", borderRadius: "var(--mc-radius-sm)",
                border: "1px solid var(--mc-line)", fontSize: 12,
              }}>
                <span style={{ color: "var(--mc-fg-3)", fontSize: 11, fontFamily: "var(--mc-font-mono)", minWidth: 160 }}>
                  {imp.ts ? new Date(imp.ts).toLocaleString() : "—"}
                </span>
                <span style={{ color: "var(--mc-fg-1)" }}>{imp.action}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Totals Footer */}
      {totalTurns > 0 && (
        <div style={{
          display: "flex", gap: 24, padding: "16px 20px",
          background: "var(--mc-bg-1)", border: "1px solid var(--mc-line)",
          borderRadius: "var(--mc-radius-lg)", justifyContent: "center",
        }}>
          <Stat label="Total Turns" value={totalTurns} />
          <Stat label="Feedback Ratings" value={totalFeedback} />
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ fontSize: 10, color: "var(--mc-fg-2)", textTransform: "uppercase", letterSpacing: 1.2, fontWeight: 600, marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ fontSize: 22, fontWeight: 700, fontFamily: "var(--mc-font-mono)", color: "var(--mc-fg)" }}>
        {value}
      </div>
    </div>
  );
}

function ctxColor(ctx) {
  const map = {
    coding: { bg: "rgba(94,226,201,0.12)", fg: "var(--mc-ok)", border: "rgba(94,226,201,0.32)" },
    design: { bg: "rgba(229,177,53,0.12)", fg: "var(--mc-warn)", border: "rgba(229,177,53,0.32)" },
    research: { bg: "rgba(129,140,248,0.12)", fg: "var(--mc-accent-2)", border: "rgba(129,140,248,0.32)" },
    writing: { bg: "rgba(196,181,253,0.12)", fg: "#c4b5fd", border: "rgba(196,181,253,0.32)" },
    analysis: { bg: "rgba(251,146,60,0.12)", fg: "#fb923c", border: "rgba(251,146,60,0.32)" },
    casual: { bg: "rgba(148,163,184,0.12)", fg: "var(--mc-fg-2)", border: "rgba(148,163,184,0.32)" },
  };
  return map[ctx] || { bg: "var(--mc-bg-2)", fg: "var(--mc-fg-1)", border: "var(--mc-line-strong)" };
}