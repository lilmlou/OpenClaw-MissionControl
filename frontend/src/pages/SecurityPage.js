/**
 * Phase F2 — Security Audit (shell)
 *
 * Route: /security
 * Non-coder visible: severity-graded findings, drift detection, agent
 * evaluation scores — in-app. Replaces "ssh in and read the audit log"
 * with a glanceable severity board.
 *
 * Wiring targets (when FE Wiring lands):
 *   GET /api/v2/security/findings?severity=&status=&since=
 *   GET /api/v2/security/drift                 — config-vs-actual deltas
 *   GET /api/v2/security/agent-eval            — supervisor/auditor scores
 *   WS  security.finding broadcast             — live push on new finding
 *
 * This is SHELL ONLY. Filters, severity chips, drift card, and agent-eval
 * leaderboard render against empty state. FE Wiring fills the data.
 *
 * Theme: locked Mietorè tokens — warm-black surface, hairline gold border,
 * gold + cyan accents, glassmorphism backdrop, severity tones from
 * --mc-ok/--mc-warn/--mc-err/--mc-info.
 */

import React, { useState } from "react";
import {
    ShieldCheck,
    ShieldAlert,
    ShieldX,
    AlertOctagon,
    AlertTriangle,
    Activity,
    GitCompare,
    Eye,
    Search,
    RefreshCw,
    Filter,
    ChevronRight,
} from "lucide-react";
import { Pill, EmptyState, PageError, Tabs } from "@/components/kit";

// --------------------------------------------------------------------------
// Static taxonomy — wiring layer will map backend payloads onto these IDs.
// --------------------------------------------------------------------------

const SEVERITIES = [
    {
        id: "critical",
        label: "Critical",
        Icon: ShieldX,
        tone: "err",
        bg: "var(--mc-err-soft)",
        fg: "var(--mc-err)",
        ring: "rgba(229, 92, 92, 0.32)",
        desc: "Exploitable now. Blocks deploy.",
    },
    {
        id: "high",
        label: "High",
        Icon: AlertOctagon,
        tone: "warn",
        bg: "var(--mc-warn-soft)",
        fg: "var(--mc-warn)",
        ring: "rgba(217, 162, 76, 0.32)",
        desc: "Drift or weak posture. Fix this sprint.",
    },
    {
        id: "medium",
        label: "Medium",
        Icon: AlertTriangle,
        tone: "warn",
        bg: "rgba(217, 162, 76, 0.08)",
        fg: "var(--mc-warn)",
        ring: "rgba(217, 162, 76, 0.18)",
        desc: "Hardening opportunities.",
    },
    {
        id: "low",
        label: "Low",
        Icon: ShieldAlert,
        tone: "neutral",
        bg: "var(--mc-info-soft)",
        fg: "var(--mc-info)",
        ring: "rgba(34, 211, 219, 0.22)",
        desc: "Informational.",
    },
    {
        id: "ok",
        label: "Clean",
        Icon: ShieldCheck,
        tone: "ok",
        bg: "var(--mc-ok-soft)",
        fg: "var(--mc-ok)",
        ring: "rgba(107, 207, 148, 0.28)",
        desc: "Passing all checks.",
    },
];

const TABS = [
    { value: "findings", label: "Findings", icon: <ShieldAlert size={14} strokeWidth={1.75} /> },
    { value: "drift", label: "Drift", icon: <GitCompare size={14} strokeWidth={1.75} /> },
    { value: "agent-eval", label: "Agent Eval", icon: <Eye size={14} strokeWidth={1.75} /> },
];

const RANGES = [
    { id: "today", label: "Today" },
    { id: "7d", label: "7 days" },
    { id: "30d", label: "30 days" },
    { id: "all", label: "All time" },
];

// --------------------------------------------------------------------------
// Small presentational helpers (kept inline to keep this a single-file shell
// the wiring layer can rewire without component-tree archaeology).
// --------------------------------------------------------------------------

function SeverityCard({ sev, count, active, onClick }) {
    const Icon = sev.Icon;
    return (
        <button
            type="button"
            onClick={onClick}
            data-testid={`security-sev-${sev.id}`}
            aria-pressed={active}
            style={{
                flex: "1 1 160px",
                minWidth: 160,
                textAlign: "left",
                padding: "14px 16px",
                borderRadius: "var(--mc-radius-md, 12px)",
                background: active ? sev.bg : "var(--mc-bg-1)",
                border: `1px solid ${active ? sev.ring : "var(--mc-line)"}`,
                boxShadow: active ? `0 0 20px ${sev.ring}` : "none",
                color: "var(--mc-fg)",
                cursor: "pointer",
                transition: "all 160ms ease",
                backdropFilter: "blur(10px)",
                WebkitBackdropFilter: "blur(10px)",
            }}
        >
            <div
                style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    marginBottom: 8,
                    color: sev.fg,
                }}
            >
                <Icon size={16} strokeWidth={1.75} />
                <span
                    style={{
                        fontSize: 11,
                        fontWeight: 700,
                        letterSpacing: "0.12em",
                        textTransform: "uppercase",
                    }}
                >
                    {sev.label}
                </span>
            </div>
            <div
                style={{
                    fontFamily: "var(--mc-font-display, inherit)",
                    fontSize: 28,
                    fontWeight: 600,
                    lineHeight: 1,
                    color: count == null ? "var(--mc-fg-3)" : "var(--mc-fg)",
                    letterSpacing: "-0.02em",
                }}
            >
                {count == null ? "—" : count}
            </div>
            <div style={{ fontSize: 11, color: "var(--mc-fg-2)", marginTop: 6 }}>
                {sev.desc}
            </div>
        </button>
    );
}

function PanelCard({ title, hint, icon, children, accent = "var(--mc-accent)" }) {
    return (
        <section
            style={{
                background: "var(--mc-bg-1)",
                border: "1px solid var(--mc-line)",
                borderRadius: "var(--mc-radius-lg, 14px)",
                padding: 18,
                backdropFilter: "blur(12px)",
                WebkitBackdropFilter: "blur(12px)",
            }}
        >
            <header
                style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: 14,
                }}
            >
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    {icon ? (
                        <span style={{ color: accent, display: "inline-flex" }}>{icon}</span>
                    ) : null}
                    <h2
                        style={{
                            margin: 0,
                            fontFamily: "var(--mc-font-display, inherit)",
                            fontSize: 15,
                            fontWeight: 600,
                            letterSpacing: "-0.01em",
                            color: "var(--mc-fg)",
                        }}
                    >
                        {title}
                    </h2>
                </div>
                {hint ? (
                    <span
                        style={{
                            fontSize: 10,
                            letterSpacing: "0.12em",
                            textTransform: "uppercase",
                            color: "var(--mc-fg-3)",
                            fontFamily: "var(--mc-font-mono, monospace)",
                        }}
                    >
                        {hint}
                    </span>
                ) : null}
            </header>
            {children}
        </section>
    );
}

// --------------------------------------------------------------------------
// Tab bodies — all empty-state today. Wiring drops real lists in here.
// --------------------------------------------------------------------------

function FindingsBody() {
    return (
        <PanelCard
            title="Open findings"
            hint="GET /api/v2/security/findings"
            icon={<ShieldAlert size={15} strokeWidth={1.75} />}
        >
            <EmptyState
                title="No findings to show"
                description="Findings will stream here once the wiring layer subscribes to security.finding. Each row carries severity, source check, evidence snippet, and a one-click fix where available."
                data-testid="security-findings-empty"
            />
        </PanelCard>
    );
}

function DriftBody() {
    return (
        <PanelCard
            title="Configuration drift"
            hint="GET /api/v2/security/drift"
            icon={<GitCompare size={15} strokeWidth={1.75} />}
            accent="var(--mc-accent-2)"
        >
            <EmptyState
                title="No drift detected"
                description="Drift compares declared config (settings UI, env declarations, RBAC rules) against the live runtime. Deltas land here grouped by surface — settings / env / RBAC / cron — with a 'reconcile' action wired in by FE Wiring."
                data-testid="security-drift-empty"
            />
        </PanelCard>
    );
}

function AgentEvalBody() {
    return (
        <PanelCard
            title="Agent evaluation scores"
            hint="GET /api/v2/security/agent-eval"
            icon={<Eye size={15} strokeWidth={1.75} />}
        >
            <EmptyState
                title="No evaluations recorded yet"
                description="Supervisor and auditor agents grade each task on safety, scope, and policy. Scores appear here as a leaderboard so you can see which agents are drifting before findings appear."
                data-testid="security-agent-eval-empty"
            />
        </PanelCard>
    );
}

// --------------------------------------------------------------------------
// Page
// --------------------------------------------------------------------------

export default function SecurityPage() {
    const [tab, setTab] = useState("findings");
    const [sev, setSev] = useState("all");
    const [range, setRange] = useState("7d");
    const [query, setQuery] = useState("");

    return (
        <PageError>
            <div
                data-testid="security-page"
                style={{
                    padding: "28px 36px 64px",
                    maxWidth: 1280,
                    margin: "0 auto",
                    overflowY: "auto",
                    height: "100%",
                    color: "var(--mc-fg)",
                    fontFamily: "var(--mc-font-sans, inherit)",
                }}
            >
                {/* Header */}
                <header
                    style={{
                        marginBottom: 22,
                        display: "flex",
                        alignItems: "flex-start",
                        justifyContent: "space-between",
                        gap: 16,
                        flexWrap: "wrap",
                    }}
                >
                    <div>
                        <h1
                            style={{
                                margin: 0,
                                fontFamily: "var(--mc-font-display, inherit)",
                                fontSize: 28,
                                fontWeight: 700,
                                letterSpacing: "-0.02em",
                                display: "flex",
                                alignItems: "center",
                                gap: 12,
                            }}
                        >
                            <span
                                style={{
                                    background:
                                        "linear-gradient(135deg, var(--mc-accent) 0%, var(--mc-accent-2) 100%)",
                                    WebkitBackgroundClip: "text",
                                    WebkitTextFillColor: "transparent",
                                    backgroundClip: "text",
                                }}
                            >
                                Security Audit
                            </span>
                            <ShieldCheck size={22} style={{ color: "var(--mc-accent)" }} />
                            <Pill tone="neutral" size="sm">
                                F2 · shell
                            </Pill>
                        </h1>
                        <p
                            style={{
                                color: "var(--mc-fg-2)",
                                fontSize: 13,
                                marginTop: 6,
                                maxWidth: 680,
                            }}
                        >
                            Severity-graded findings, configuration drift, and agent
                            evaluation scores — in one glanceable surface. Replaces tailing
                            audit logs with a board you can act on.
                        </p>
                    </div>
                    <button
                        type="button"
                        disabled
                        title="Refresh wired in FE Wiring"
                        data-testid="security-refresh"
                        style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 6,
                            padding: "8px 14px",
                            borderRadius: 8,
                            background: "var(--mc-bg-1)",
                            border: "1px solid var(--mc-line-strong)",
                            color: "var(--mc-fg-2)",
                            fontSize: 12,
                            fontWeight: 600,
                            cursor: "not-allowed",
                            opacity: 0.7,
                        }}
                    >
                        <RefreshCw size={12} /> Rescan
                    </button>
                </header>

                {/* Severity strip */}
                <div
                    role="group"
                    aria-label="Severity summary"
                    style={{
                        display: "flex",
                        gap: 12,
                        marginBottom: 18,
                        flexWrap: "wrap",
                    }}
                >
                    {SEVERITIES.map((s) => (
                        <SeverityCard
                            key={s.id}
                            sev={s}
                            count={null}
                            active={sev === s.id}
                            onClick={() => setSev(sev === s.id ? "all" : s.id)}
                        />
                    ))}
                </div>

                {/* Filter bar */}
                <div
                    style={{
                        background: "var(--mc-bg-1)",
                        border: "1px solid var(--mc-line)",
                        borderRadius: "var(--mc-radius-lg, 14px)",
                        padding: 14,
                        marginBottom: 16,
                        display: "flex",
                        gap: 10,
                        flexWrap: "wrap",
                        alignItems: "center",
                        backdropFilter: "blur(10px)",
                        WebkitBackdropFilter: "blur(10px)",
                    }}
                >
                    <div
                        style={{
                            flex: 1,
                            minWidth: 240,
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            padding: "8px 12px",
                            borderRadius: 8,
                            background: "var(--mc-bg-2)",
                            border: "1px solid var(--mc-line)",
                        }}
                    >
                        <Search size={14} style={{ color: "var(--mc-fg-3)" }} />
                        <input
                            type="text"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="Search findings, sources, agents…"
                            data-testid="security-search"
                            style={{
                                flex: 1,
                                background: "transparent",
                                border: "none",
                                outline: "none",
                                color: "var(--mc-fg)",
                                fontSize: 13,
                                fontFamily: "inherit",
                            }}
                        />
                    </div>
                    <div
                        style={{
                            display: "flex",
                            gap: 4,
                            padding: 3,
                            borderRadius: 8,
                            background: "var(--mc-bg-2)",
                            border: "1px solid var(--mc-line)",
                        }}
                        role="tablist"
                        aria-label="Time range"
                    >
                        {RANGES.map((r) => {
                            const on = r.id === range;
                            return (
                                <button
                                    key={r.id}
                                    type="button"
                                    role="tab"
                                    aria-selected={on}
                                    onClick={() => setRange(r.id)}
                                    data-testid={`security-range-${r.id}`}
                                    style={{
                                        padding: "5px 10px",
                                        borderRadius: 6,
                                        fontSize: 11,
                                        fontWeight: on ? 700 : 500,
                                        letterSpacing: 0.3,
                                        background: on ? "var(--mc-accent-soft)" : "transparent",
                                        color: on ? "var(--mc-accent)" : "var(--mc-fg-2)",
                                        border: "none",
                                        cursor: "pointer",
                                        transition: "all 0.15s ease",
                                    }}
                                >
                                    {r.label}
                                </button>
                            );
                        })}
                    </div>
                    <div
                        style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 6,
                            padding: "6px 10px",
                            borderRadius: 999,
                            background: "var(--mc-bg-2)",
                            border: "1px solid var(--mc-line)",
                            fontSize: 11,
                            color: "var(--mc-fg-2)",
                        }}
                    >
                        <Filter size={11} />
                        <span>
                            severity: {sev === "all" ? "any" : sev}
                        </span>
                    </div>
                </div>

                {/* Tabs */}
                <div style={{ marginBottom: 16 }}>
                    <Tabs items={TABS} value={tab} onChange={setTab} />
                </div>

                {/* Tab body */}
                <div data-testid={`security-tab-${tab}`}>
                    {tab === "findings" && <FindingsBody />}
                    {tab === "drift" && <DriftBody />}
                    {tab === "agent-eval" && <AgentEvalBody />}
                </div>

                {/* Footer meta */}
                <footer
                    style={{
                        marginTop: 24,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 12,
                        fontSize: 11,
                        color: "var(--mc-fg-3)",
                        fontFamily: "var(--mc-font-mono, monospace)",
                        letterSpacing: 0.4,
                    }}
                >
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                        <Activity size={11} />
                        live · ws security.finding · esc to close drawers
                    </span>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                        F2 · shell — wiring pending
                        <ChevronRight size={11} />
                    </span>
                </footer>
            </div>
        </PageError>
    );
}
