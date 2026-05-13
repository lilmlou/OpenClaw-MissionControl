/**
 * P0-A FE-3 — Brain Log Page
 *
 * Routes: /brain (list) and /brain/:turnId (detail pane open)
 *
 * Left rail: virtualised turn list from useBrainTurns
 * Right pane: turn detail (GET /api/v1/brain/turns/:id)
 * Bottom strip: BrainLiveStrip (last 5 WS events from useBrainWs)
 * Config slide-over: BrainConfigPanel (FE-4)
 * Filter: context_type chips
 *
 * Raw-JSON ban: routing candidates[], decisions, memory_loads render as structured rows.
 * Only JSON.stringify inside opt-in <details> "Inspect raw" drawer.
 * NO MOCK DATA. Real WS + HTTP against AgentRuntime :7801.
 */

import React, { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import {
  Settings, ChevronRight, AlertTriangle, CheckCircle2, Clock, XCircle,
  Zap, Brain, Cpu, BarChart3, Activity, Eye, EyeOff, RotateCcw,
} from "lucide-react";
import { useBrainWs } from "@/hooks/useBrainWs";
import { useBrainTurns } from "@/hooks/useBrainTurns";
import BrainConfigPanel from "@/components/brain/BrainConfigPanel";
import { getApiBase } from "@/lib/useGateway";

const GATEWAY_BASE = getApiBase() || "http://127.0.0.1:7801";

const CONTEXT_TYPES = ["all", "coding", "design", "research", "writing", "analysis", "casual", "vision", "tools"];

const ctxColor = (ctx) => {
  const map = {
    coding:   { dot: "var(--mc-ok)",        bg: "rgba(94,226,201,0.12)" },
    design:   { dot: "var(--mc-warn)",      bg: "rgba(229,177,53,0.12)" },
    research: { dot: "var(--mc-accent-2)",  bg: "rgba(129,140,248,0.12)" },
    writing:  { dot: "#c4b5fd",             bg: "rgba(196,181,253,0.12)" },
    analysis: { dot: "#fb923c",             bg: "rgba(251,146,60,0.12)" },
    casual:   { dot: "var(--mc-fg-2)",      bg: "rgba(148,163,184,0.12)" },
    vision:   { dot: "#22d3ee",             bg: "rgba(34,211,238,0.12)" },
    tools:    { dot: "var(--mc-accent)",    bg: "rgba(229,177,53,0.12)" },
  };
  return map[ctx] || { dot: "var(--mc-fg-3)", bg: "var(--mc-bg-2)" };
};

function StatusDot({ status }) {
  const map = {
    ok: { color: "var(--mc-ok)", icon: CheckCircle2 },
    error: { color: "var(--mc-err)", icon: XCircle },
    cancelled: { color: "var(--mc-fg-2)", icon: AlertTriangle },
    streaming: { color: "var(--mc-accent-2)", icon: Zap },
    pending: { color: "var(--mc-fg-3)", icon: Clock },
  };
  const s = map[status] || map.ok;
  return <s.icon size={14} style={{ color: s.color }} />;
}

function TurnRow({ turn, selected, onClick }) {
  const ctxInfo = ctxColor(turn.context_type);
  return (
    <button
      onClick={onClick}
      style={{
        display: "grid",
        gridTemplateColumns: "20px 1fr auto",
        alignItems: "center",
        gap: 10,
        width: "100%",
        padding: "10px 12px",
        background: selected ? "var(--mc-accent-soft)" : "transparent",
        border: "none",
        borderLeft: selected ? "2px solid var(--mc-accent)" : "2px solid transparent",
        cursor: "pointer",
        textAlign: "left",
        borderBottom: "1px solid var(--mc-line)",
        color: "var(--mc-fg)",
        fontSize: 12,
      }}
      data-testid={`turn-row-${turn.id}`}
    >
      <StatusDot status={turn.status} />
      <div>
        <div style={{ fontWeight: 600, marginBottom: 2 }}>
          <span style={{
            display: "inline-block", padding: "1px 6px", borderRadius: 4, fontSize: 10,
            background: ctxInfo.bg, color: ctxInfo.dot, marginRight: 6, fontWeight: 600,
          }}>
            {turn.context_type || "?"}
          </span>
          {turn.model_id && (
            <span style={{ color: "var(--mc-fg-1)", fontFamily: "var(--mc-font-mono)", fontSize: 11 }}>
              {turn.model_id}
            </span>
          )}
        </div>
        <div style={{ color: "var(--mc-fg-2)", fontSize: 11 }}>
          {turn.input_tokens != null && `in: ${turn.input_tokens}  `}
          {turn.output_tokens != null && `out: ${turn.output_tokens}  `}
          {turn.duration_ms != null && `${turn.duration_ms}ms`}
        </div>
      </div>
      <div style={{ fontSize: 10, color: "var(--mc-fg-3)", fontFamily: "var(--mc-font-mono)" }}>
        {turn.ts ? new Date(turn.ts).toLocaleTimeString() : ""}
      </div>
    </button>
  );
}

function TurnDetail({ turnId, onClose }) {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [inspect, setInspect] = useState(false);

  useEffect(() => {
    if (!turnId) return;
    setLoading(true);
    setError(null);
    fetch(`${GATEWAY_BASE}/api/v1/brain/turns/${turnId}`, { cache: "no-store" })
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(payload => setDetail(payload?.data || payload))
      .catch(err => setError(err.message || String(err)))
      .finally(() => setLoading(false));
  }, [turnId]);

  if (!turnId) return null;

  const turn = detail?.turn;
  const decisions = detail?.decisions || [];
  const memoryLoads = detail?.memory_loads || [];
  const routing = detail?.routing;

  return (
    <div style={{ padding: 16, height: "100%", overflowY: "auto" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <h3 style={{ margin: 0, fontFamily: "var(--mc-font-display)", fontSize: 13, fontWeight: 700, color: "var(--mc-fg)" }}>
          Turn Detail
        </h3>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => setInspect(!inspect)} style={iconBtnStyle} title="Toggle raw inspect">
            {inspect ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
          {onClose && <button onClick={onClose} style={iconBtnStyle}><ChevronRight size={14} /></button>}
        </div>
      </div>

      {loading && <div style={{ color: "var(--mc-fg-2)", fontSize: 12, padding: 20 }}>Loading…</div>}
      {error && <div style={{ color: "var(--mc-err)", fontSize: 12, padding: 12, background: "var(--mc-err-soft)", borderRadius: 8 }}>{error}</div>}

      {turn && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Turn overview */}
          <Section title="Overview">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, fontSize: 12 }}>
              <Kv k="Turn ID" v={turn.id || turnId} />
              <Kv k="Status" v={turn.status} />
              <Kv k="Context" v={<span style={{ color: ctxColor(turn.context_type).dot, fontWeight: 600 }}>{turn.context_type}</span>} />
              <Kv k="Model" v={turn.model_id} />
              <Kv k="Provider" v={turn.provider_id} />
              <Kv k="Duration" v={turn.duration_ms != null ? `${turn.duration_ms}ms` : "—"} />
              <Kv k="Input Tokens" v={turn.input_tokens} />
              <Kv k="Output Tokens" v={turn.output_tokens} />
            </div>
          </Section>

          {/* Memory Loads */}
          {memoryLoads.length > 0 && (
            <Section title="Memory Loaded">
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {memoryLoads.map((m, i) => (
                  <div key={i} style={{
                    display: "flex", justifyContent: "space-between", padding: "6px 10px",
                    background: "var(--mc-bg-2)", borderRadius: 6, fontSize: 12,
                  }}>
                    <span style={{ color: "var(--mc-fg-1)", fontWeight: 500 }}>{m.memory_type}</span>
                    <span style={{ color: "var(--mc-fg-2)", fontFamily: "var(--mc-font-mono)", fontSize: 11 }}>
                      {m.token_count} tokens
                    </span>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* Routing */}
          {routing && (
            <Section title="Routing">
              <div style={{ fontSize: 12 }}>
                <div style={{ marginBottom: 6 }}>
                  <span style={{ color: "var(--mc-fg-2)" }}>Selected: </span>
                  <span style={{ fontWeight: 600, color: "var(--mc-fg)" }}>{routing.model_id}</span>
                  <span style={{ color: "var(--mc-fg-3)" }}> via {routing.provider_id}</span>
                  {routing.score != null && (
                    <span style={{ color: "var(--mc-accent)", marginLeft: 8, fontSize: 11 }}>
                      score {Number(routing.score).toFixed(2)}
                    </span>
                  )}
                </div>
                {routing.reason && (
                  <div style={{ color: "var(--mc-fg-2)", fontSize: 11, marginBottom: 6 }}>
                    Reason: {routing.reason}
                  </div>
                )}
                {/* Candidates — structured, not raw JSON */}
                {routing.candidates && Array.isArray(routing.candidates) && routing.candidates.length > 0 && (
                  <details style={{ fontSize: 11 }}>
                    <summary style={{ cursor: "pointer", color: "var(--mc-accent)", fontWeight: 500 }}>
                      {routing.candidates.length} candidates
                    </summary>
                    <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 4 }}>
                      {routing.candidates.map((c, i) => (
                        <div key={i} style={{
                          display: "flex", justifyContent: "space-between", padding: "4px 8px",
                          background: "var(--mc-bg-2)", borderRadius: 4,
                        }}>
                          <span style={{ fontFamily: "var(--mc-font-mono)", fontSize: 10, color: "var(--mc-fg-1)" }}>
                            {c.model_id || c.model}
                          </span>
                          <span style={{ color: "var(--mc-accent)", fontSize: 10 }}>
                            {c.score != null ? Number(c.score).toFixed(2) : "—"}
                          </span>
                        </div>
                      ))}
                    </div>
                  </details>
                )}
              </div>
            </Section>
          )}

          {/* Decisions timeline */}
          {decisions.length > 0 && (
            <Section title={`Decisions (${decisions.length})`}>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {decisions.map((d, i) => (
                  <div key={i} style={{
                    display: "flex", alignItems: "center", gap: 10, padding: "6px 10px",
                    background: "var(--mc-bg-2)", borderRadius: 6, fontSize: 12,
                  }}>
                    <span style={{
                      padding: "1px 6px", borderRadius: 4, fontSize: 10, fontWeight: 600,
                      background: "var(--mc-accent-soft)", color: "var(--mc-accent)",
                    }}>
                      {d.stage}
                    </span>
                    <span style={{ color: "var(--mc-fg-3)", fontSize: 10, fontFamily: "var(--mc-font-mono)" }}>
                      {d.ts ? new Date(d.ts).toLocaleTimeString() : ""}
                    </span>
                    {d.duration_ms != null && (
                      <span style={{ color: "var(--mc-fg-2)", fontSize: 10 }}>{d.duration_ms}ms</span>
                    )}
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* Inspect raw (opt-in only) */}
          {inspect && (
            <details style={{ fontSize: 11, marginTop: 12 }}>
              <summary style={{ cursor: "pointer", color: "var(--mc-fg-3)" }}>Inspect raw</summary>
              <pre style={{
                padding: 10, background: "var(--mc-bg-2)", borderRadius: 8,
                border: "1px solid var(--mc-line)", overflow: "auto",
                fontSize: 10, fontFamily: "var(--mc-font-mono)", color: "var(--mc-fg-1)",
                maxHeight: 300,
              }}>
                {JSON.stringify(detail, null, 2)}
              </pre>
            </details>
          )}
        </div>
      )}
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div style={{
      padding: 12, background: "var(--mc-bg-1)", borderRadius: 8,
      border: "1px solid var(--mc-line)",
    }}>
      <div style={{
        fontSize: 10, fontWeight: 700, color: "var(--mc-fg-2)", marginBottom: 10,
        textTransform: "uppercase", letterSpacing: 1.2,
      }}>
        {title}
      </div>
      {children}
    </div>
  );
}

function Kv({ k, v }) {
  return (
    <div>
      <span style={{ color: "var(--mc-fg-3)", fontSize: 10 }}>{k}</span>
      <div style={{ color: "var(--mc-fg-1)", fontSize: 12, fontFamily: "var(--mc-font-mono)" }}>
        {v ?? "—"}
      </div>
    </div>
  );
}

function BrainLiveStrip({ events }) {
  const last5 = (events || []).slice(-5).reverse();
  return (
    <div style={{
      display: "flex", gap: 6, padding: "6px 16px", overflow: "auto",
      background: "var(--mc-bg-2)", borderTop: "1px solid var(--mc-line)",
      fontSize: 10, fontFamily: "var(--mc-font-mono)",
    }}>
      <span style={{ color: "var(--mc-fg-3)", fontWeight: 600, marginRight: 4, whiteSpace: "nowrap" }}>
        <Activity size={10} style={{ marginRight: 4 }} />
        Live
      </span>
      {last5.length === 0 && <span style={{ color: "var(--mc-fg-3)" }}>Waiting for events…</span>}
      {last5.map((e, i) => (
        <span key={i} style={{
          color: e.type?.startsWith("brain.error") ? "var(--mc-err)" : "var(--mc-fg-1)",
          whiteSpace: "nowrap",
        }}>
          {e.type?.replace("brain.", "")}
          {i < last5.length - 1 && <span style={{ color: "var(--mc-fg-3)", margin: "0 4px" }}>•</span>}
        </span>
      ))}
    </div>
  );
}

export default function BrainLogPage() {
  const { turnId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const contextFilter = searchParams.get("context") || "all";
  const [selectedTurnId, setSelectedTurnId] = useState(turnId || null);
  const [configOpen, setConfigOpen] = useState(false);

  const { events, connected } = useBrainWs();
  const { turns, total, loading, error, loadingMore, loadMore, hasMore, refresh } = useBrainTurns({
    contextType: contextFilter === "all" ? undefined : contextFilter,
  });

  // Sync selected turn with URL param
  useEffect(() => {
    if (turnId) setSelectedTurnId(turnId);
  }, [turnId]);

  const handleSelectTurn = useCallback((id) => {
    setSelectedTurnId(id);
    navigate(`/brain/${id}`, { replace: true });
  }, [navigate]);

  const handleFilter = useCallback((ctx) => {
    setSelectedTurnId(null);
    navigate("/brain", { replace: true });
    if (ctx === "all") {
      setSearchParams({});
    } else {
      setSearchParams({ context: ctx });
    }
  }, [navigate, setSearchParams]);

  return (
    <div style={{
      display: "flex", flexDirection: "column", height: "100%",
      color: "var(--mc-fg)", overflow: "hidden",
    }}>
      {/* Top bar */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "12px 20px", borderBottom: "1px solid var(--mc-line)",
        background: "var(--mc-bg-1)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <h2 style={{
            margin: 0, fontFamily: "var(--mc-font-display)", fontSize: 18, fontWeight: 700,
            letterSpacing: -0.3,
          }}>
            <span style={{
              background: "linear-gradient(135deg, var(--mc-accent) 0%, var(--mc-accent-2) 100%)",
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text",
            }}>
              Brain Log
            </span>
          </h2>
          <span style={{
            fontSize: 10, padding: "2px 8px", borderRadius: 999,
            background: connected ? "rgba(94,226,201,0.12)" : "rgba(148,163,184,0.12)",
            color: connected ? "var(--mc-ok)" : "var(--mc-fg-2)",
            fontFamily: "var(--mc-font-mono)",
          }}>
            {connected ? "WS live" : "WS offline"}
          </span>
          <span style={{ fontSize: 11, color: "var(--mc-fg-2)" }}>
            {total} turns
          </span>
        </div>
        <button
          onClick={() => setConfigOpen(true)}
          style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "6px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600,
            background: "var(--mc-bg-2)", border: "1px solid var(--mc-line-strong)",
            color: "var(--mc-fg-1)", cursor: "pointer",
          }}
          data-testid="brain-config-btn"
        >
          <Settings size={14} /> Config
        </button>
      </div>

      {/* Context filter chips */}
      <div style={{
        display: "flex", gap: 6, padding: "8px 20px", borderBottom: "1px solid var(--mc-line)",
        background: "var(--mc-bg)", overflowX: "auto",
      }}>
        {CONTEXT_TYPES.map(ctx => {
          const active = contextFilter === ctx;
          return (
            <button key={ctx} onClick={() => handleFilter(ctx)} style={{
              padding: "4px 12px", borderRadius: 999, fontSize: 11, fontWeight: active ? 700 : 500,
              background: active ? "var(--mc-accent)" : "var(--mc-bg-2)",
              color: active ? "var(--mc-accent-fg)" : "var(--mc-fg-2)",
              border: active ? "none" : "1px solid var(--mc-line-strong)",
              cursor: "pointer", textTransform: "capitalize", whiteSpace: "nowrap",
            }}>
              {ctx}
            </button>
          );
        })}
      </div>

      {/* Main area: turn list + detail */}
      <div style={{
        flex: 1, display: "flex", overflow: "hidden",
      }}>
        {/* Left rail — Turn List */}
        <div style={{
          width: 320, minWidth: 280, borderRight: "1px solid var(--mc-line)",
          overflowY: "auto", background: "var(--mc-bg-1)",
        }}>
          {loading && (
            <div style={{ padding: 20, textAlign: "center", color: "var(--mc-fg-2)", fontSize: 12 }}>
              <Activity size={14} style={{ marginBottom: 8 }} />
              <div>Loading turns…</div>
            </div>
          )}
          {error && (
            <div style={{ padding: 12, margin: 12, borderRadius: 8, background: "var(--mc-err-soft)", color: "var(--mc-err)", fontSize: 12 }}>
              {error}
              <button onClick={refresh} style={{ display: "block", marginTop: 8, cursor: "pointer", color: "var(--mc-accent)", background: "none", border: "none", fontSize: 12 }}>
                <RotateCcw size={12} /> Retry
              </button>
            </div>
          )}
          {!loading && turns.length === 0 && !error && (
            <div style={{ padding: 40, textAlign: "center", color: "var(--mc-fg-2)", fontSize: 13 }}>
              <Brain size={32} style={{ marginBottom: 12, opacity: 0.3 }} />
              <div>No brain turns recorded yet</div>
              <div style={{ fontSize: 11, color: "var(--mc-fg-3)", marginTop: 4 }}>Send a message to start</div>
            </div>
          )}
          {/* TODO: virtualise when react-window added */}
          {turns.map(turn => (
            <TurnRow
              key={turn.id}
              turn={turn}
              selected={selectedTurnId === turn.id}
              onClick={() => handleSelectTurn(turn.id)}
            />
          ))}
          {hasMore && (
            <button onClick={loadMore} disabled={loadingMore} style={{
              width: "100%", padding: 10, fontSize: 12, cursor: "pointer",
              background: "var(--mc-bg-2)", border: "none", borderTop: "1px solid var(--mc-line)",
              color: "var(--mc-fg-2)",
            }}>
              {loadingMore ? "Loading…" : "Load more"}
            </button>
          )}
        </div>

        {/* Right detail pane */}
        <div style={{ flex: 1, overflowY: "auto", background: "var(--mc-bg)" }}>
          {selectedTurnId ? (
            <TurnDetail
              turnId={selectedTurnId}
              onClose={() => {
                setSelectedTurnId(null);
                navigate("/brain", { replace: true });
              }}
            />
          ) : (
            <div style={{
              display: "flex", flexDirection: "column", alignItems: "center",
              justifyContent: "center", height: "100%", color: "var(--mc-fg-3)",
            }}>
              <Brain size={48} style={{ opacity: 0.2, marginBottom: 16 }} />
              <div style={{ fontSize: 14 }}>Select a turn to view details</div>
              <div style={{ fontSize: 11, marginTop: 4 }}>Brain decisions, memory loads, and routing</div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom live strip */}
      <BrainLiveStrip events={events} />

      {/* Config slide-over */}
      <BrainConfigPanel open={configOpen} onClose={() => setConfigOpen(false)} />
    </div>
  );
}

const iconBtnStyle = {
  background: "var(--mc-bg-2)", border: "1px solid var(--mc-line-strong)",
  borderRadius: 6, padding: 4, cursor: "pointer", color: "var(--mc-fg-2)",
  display: "flex", alignItems: "center",
};