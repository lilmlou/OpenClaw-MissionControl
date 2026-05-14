/**
 * RoadmapPage — Mietorè Roadmap (NEW shell page)
 *
 * Route: /roadmap
 *
 * Non-coder surface that mirrors the authoritative
 *   /Volumes/🦋• Drive   1/MC/MASTER_PLAN.md (or the staging copy)
 * inside the app, so Meg never has to open a terminal or read a
 * markdown doc to see "where are we and what's next".
 *
 * Sections rendered, in order:
 *   • Completed       — all ✅ phases (collapsed by default)
 *   • In Flight       — partials (Sprint 3, Sprint 4, Phase 5.5)
 *   • Drifted         — PROGRESS.md-lies row (re-verify candidates)
 *   • Next            — Sprint 5 → 6 → 7 → 8 → 9 → 3 (cron)
 *   • Phase E         — Config-as-UI (E1, E2, E3)
 *   • Phase F         — Visibility (F1, F2, F3, F4, F5, F6)
 *   • Phase G         — Real Qudos (G1..G5)
 *   • Phase H         — Mobile (H1..H5)
 *   • Phase I+        — I, J, K, L, M, N
 *
 * This is a SHELL — the content is encoded as static phase rows that
 * match MASTER_PLAN.md verbatim. Future FE Wiring can hydrate the
 * status pills from `GET /api/v2/roadmap` once a backend ships; the
 * current row schema is intentionally identical to that future
 * envelope (`{phase, label, status, summary, surface}`), so wiring is
 * a one-line replacement of the local fixture.
 *
 * Theme: locked Mietorè tokens only — warm-black (#0A0807) surface,
 * gold (#D9A24C) hairline borders / accent, cyan (#22D3DB) accent-2
 * for the "Next" highlight, glassmorphism on the hero. No raw hex.
 *
 * No backend calls, no markdown, no terminal.
 */

import React, { useMemo, useState } from "react";
import {
    Map,
    CheckCircle2,
    Clock,
    AlertOctagon,
    Sparkles,
    ChevronDown,
    ChevronRight,
    Cpu,
    Eye,
    Hand,
    Smartphone,
    Layers,
    Sliders,
    Rocket,
} from "lucide-react";
import { Pill, EmptyState } from "@/components/kit";

// ───────────────────────────────────────────────────────────────────
// Data — verbatim from MASTER_PLAN.md (Source of Truth, 2026-05-14).
// Edit this fixture when MASTER_PLAN.md is amended. FE Wiring will
// later replace this constant with the response of /api/v2/roadmap.
// ───────────────────────────────────────────────────────────────────

const COMPLETED = [
    { phase: "Phase 1",   label: "Decision Engine (Layer 1)" },
    { phase: "Phase 2",   label: "Event Loop + Session Manager (Layer 2)" },
    { phase: "Phase 3",   label: "Adapters via Venice (OpenClaw + dormant Hermes)" },
    { phase: "Phase 4",   label: "Tool Use Infrastructure", note: "wired, not heavily used" },
    { phase: "Phase 5",   label: "Frontend Streaming Chat", note: "input bug fixed 2026-05-13" },
    { phase: "Phase 6.A", label: "SQLite Persistence" },
    { phase: "Phase 6.B", label: "Thread isolation" },
    { phase: "Phase 6.C", label: "AI memory within thread" },
    { phase: "Phase 6.D", label: "Cross-session memory" },
    { phase: "Phase A",   label: "Provider Registry (640 models)" },
    { phase: "Phase B",   label: "Security & Tailscale" },
    { phase: "Phase 6.E", label: "Watcher cooldown fix" },
    { phase: "Phase 6.F", label: "Ollama Cloud default for crons" },
    { phase: "Sprint 2",  label: "Agent runtime control" },
];

const IN_FLIGHT = [
    { phase: "Sprint 3",   label: "BE shipped, FE partial — finish in dependency order below" },
    { phase: "Sprint 4",   label: "BE partial, FE consumer wired — Activity Feed bell live in Layout" },
    { phase: "Phase 5.5",  label: "Page renamed, layout built, UI shell only — no real Qudos input" },
];

const DRIFTED = [
    { phase: "D1",   label: "sensors/services/apps return {available:false} — not actually live" },
    { phase: "P0.1", label: "destructive restart never re-run on canonical ports" },
    { phase: "P0.3", label: "config.reset_all executes without approval gate" },
];

const NEXT = [
    {
        phase: "Sprint 5",
        label: "Token Tracking Instrumentation",
        eta: "~1h",
        summary: "tokens_in / tokens_out / cost_estimate_usd in model_choices.",
        surface: "/system → Token Usage card + inline cost-per-message badge",
        unlocks: "Sprint 6, 7, 8, 9, Phase F1",
        highlight: false,
    },
    {
        phase: "Sprint 4 (finish)",
        label: "Activities Feed",
        eta: "~6h",
        summary: "Fix useGateway category/kind. Wire /api/v2/activities + WS.",
        surface: "Activity Feed drawer",
    },
    {
        phase: "Sprint 6",
        label: "Self-Learning Loop Closure",
        eta: "~2d",
        summary: "Quality/latency/override columns. Nightly aggregator.",
        surface: "/insights page",
    },
    {
        phase: "Sprint 7",
        label: "Context Classifier + OpenCode Go/Zen",
        eta: "~1-2d",
        summary: "Heuristic + LLM classifier. Wire chain in chatSocket.",
        surface: "“why this model” badge in chat",
    },
    {
        phase: "Sprint 8",
        label: "Quota Tracking",
        eta: "~1d",
        summary: "Subscription-aware picker. fixed / overage / capped / ppc.",
        surface: "Real-time quota gauge",
    },
    {
        phase: "Sprint 9",
        label: "Auto-Pick UI",
        eta: "~1d FE",
        summary: "“Auto” toggle in chat header. Inline badge. Override → learn.",
        surface: "Auto toggle + badge",
    },
    {
        phase: "Sprint 3 (finish)",
        label: "Cron Management UI",
        eta: "~1d FE",
        summary: "/cron agenda/day/week/month. Pause / resume / run-now.",
        surface: "/cron page",
    },
];

const PHASE_E = [
    { phase: "Phase E1", label: "Files Browser READ-ONLY",     eta: "~6h", summary: "Allowlisted tree + Monaco read-only." },
    { phase: "Phase E2", label: "Files Editor READ-WRITE",     eta: "~6h", summary: "Path-traversal guards, validation, confirm." },
    { phase: "Phase E3", label: "Customise Functional Rebuild", eta: "~2d", summary: "Skills, plugins, connectors + WS sync." },
];

const PHASE_F = [
    { phase: "Phase F1", label: "Cost & Usage Tracker",  eta: "~1d FE", summary: "Today/Month/Projected/Budget. Depends on Sprint 5." },
    { phase: "Phase F5", label: "Standup Report",        eta: "~1d",     summary: "Mietorè writes her own daily summary." },
    { phase: "Phase F6", label: "Inspector Drawer",      eta: "~1d",     summary: "6 tabs per task — Activity/Artifacts/Files/Memory/Skills/Logs." },
    { phase: "Phase F3", label: "Doctor Fix Banner",     summary: "Scans + one-click fixes." },
    { phase: "Phase F2", label: "Security Audit",        summary: "Severity badges, drift detection, agent-eval scores." },
    { phase: "Phase F4", label: "Audit Trail",           summary: "Type-coloured rows, filters." },
];

const PHASE_G = [
    { phase: "G1", label: "Screen Capture",       summary: "Swift helper, ScreenCaptureKit." },
    { phase: "G2", label: "Accessibility API",    summary: "Swift helper, approval-gated." },
    { phase: "G3", label: "Active App Detection", summary: "osascript." },
    { phase: "G4", label: "Vision Model Pipeline" },
    { phase: "G5", label: "Floating Overlay App", summary: "Native menu bar." },
];

const PHASE_H = [
    { phase: "H1", label: "PWA configuration",   summary: "service worker, manifest, splash, icons." },
    { phase: "H2", label: "iPad layout",         summary: "collapsible sidebar, 44px tap targets." },
    { phase: "H3", label: "iPhone layout",       summary: "single column, bottom sheet." },
    { phase: "H4", label: "Voice",               summary: "iOS Shortcut bridge, Whisper, TTS." },
    { phase: "H5", label: "Push Notifications",  summary: "Web Push API." },
];

const PHASE_I_PLUS = [
    { phase: "Phase I", label: "Persona System",         summary: "Dev / Personal / Research modes." },
    { phase: "Phase J", label: "Plugin/Skill Architecture", summary: "Signed manifests, sandbox, marketplace." },
    { phase: "Phase K", label: "Tauri Desktop App",      summary: "macOS + iOS native shell." },
    { phase: "Phase L", label: "Brand Rename",           summary: "OpenClaw Mission Control → Mietorè." },
    { phase: "Phase M", label: "Personalization LoRA" },
    { phase: "Phase N", label: "Distribute to other devices", summary: "self-update, onboarding, sync." },
];

// ───────────────────────────────────────────────────────────────────
// Atoms
// ───────────────────────────────────────────────────────────────────

function StatusPill({ tone, icon: Icon, children }) {
    return (
        <span
            style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "2px 9px",
                borderRadius: 999,
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: 0.6,
                textTransform: "uppercase",
                background: `var(--mc-${tone}-soft)`,
                color: `var(--mc-${tone})`,
                border: "1px solid transparent",
                fontFamily: "var(--mc-font-mono)",
            }}
        >
            {Icon ? <Icon size={11} strokeWidth={2} /> : null}
            {children}
        </span>
    );
}

function PhaseRow({ phase, label, summary, surface, eta, unlocks, note, highlight }) {
    return (
        <div
            data-testid={`roadmap-row-${phase.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}
            style={{
                display: "grid",
                gridTemplateColumns: "minmax(110px, auto) 1fr",
                gap: 14,
                padding: "12px 14px",
                borderTop: "1px solid var(--mc-line)",
                background: highlight ? "var(--mc-accent-soft)" : "transparent",
                borderLeft: highlight ? "2px solid var(--mc-accent)" : "2px solid transparent",
                transition: "background 120ms ease",
            }}
        >
            <div
                style={{
                    fontFamily: "var(--mc-font-mono)",
                    fontSize: 11,
                    fontWeight: 700,
                    color: highlight ? "var(--mc-accent)" : "var(--mc-fg-1)",
                    letterSpacing: 0.4,
                    paddingTop: 2,
                }}
            >
                {phase}
            </div>
            <div style={{ minWidth: 0 }}>
                <div
                    style={{
                        display: "flex",
                        alignItems: "center",
                        flexWrap: "wrap",
                        gap: 8,
                    }}
                >
                    <span
                        style={{
                            fontFamily: "var(--mc-font-display)",
                            fontSize: 13,
                            fontWeight: 600,
                            color: "var(--mc-fg)",
                            letterSpacing: -0.1,
                        }}
                    >
                        {label}
                    </span>
                    {eta ? (
                        <span
                            style={{
                                fontSize: 10,
                                fontFamily: "var(--mc-font-mono)",
                                color: "var(--mc-fg-3)",
                                padding: "1px 6px",
                                borderRadius: 4,
                                background: "var(--mc-bg-2)",
                                border: "1px solid var(--mc-line)",
                            }}
                        >
                            {eta}
                        </span>
                    ) : null}
                    {highlight ? (
                        <StatusPill tone="accent" icon={Sparkles}>
                            Next
                        </StatusPill>
                    ) : null}
                </div>
                {summary ? (
                    <div
                        style={{
                            marginTop: 4,
                            fontSize: 12,
                            lineHeight: 1.45,
                            color: "var(--mc-fg-2)",
                        }}
                    >
                        {summary}
                    </div>
                ) : null}
                {(surface || unlocks || note) ? (
                    <div
                        style={{
                            marginTop: 6,
                            display: "flex",
                            flexWrap: "wrap",
                            gap: 8,
                            fontSize: 11,
                            color: "var(--mc-fg-3)",
                            fontFamily: "var(--mc-font-mono)",
                        }}
                    >
                        {surface ? (
                            <span>
                                <span style={{ color: "var(--mc-accent-2)" }}>visible:</span>{" "}
                                {surface}
                            </span>
                        ) : null}
                        {unlocks ? (
                            <span>
                                <span style={{ color: "var(--mc-accent)" }}>unlocks:</span>{" "}
                                {unlocks}
                            </span>
                        ) : null}
                        {note ? (
                            <span>
                                <span style={{ color: "var(--mc-fg-2)" }}>note:</span> {note}
                            </span>
                        ) : null}
                    </div>
                ) : null}
            </div>
        </div>
    );
}

function Section({
    icon: Icon,
    title,
    subtitle,
    tone = "neutral",
    rows,
    rowProps,
    defaultOpen = true,
    testId,
}) {
    const [open, setOpen] = useState(defaultOpen);
    const Chevron = open ? ChevronDown : ChevronRight;
    return (
        <section
            data-testid={testId}
            style={{
                background: "var(--mc-bg-1)",
                border: "1px solid var(--mc-line)",
                borderRadius: "var(--mc-radius-lg, 12px)",
                marginBottom: 16,
                overflow: "hidden",
            }}
        >
            <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                aria-expanded={open}
                data-testid={testId ? `${testId}-toggle` : undefined}
                style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "12px 16px",
                    background: "var(--mc-bg-overlay)",
                    backdropFilter: "blur(14px)",
                    WebkitBackdropFilter: "blur(14px)",
                    border: "none",
                    borderBottom: open ? "1px solid var(--mc-line)" : "none",
                    color: "var(--mc-fg)",
                    cursor: "pointer",
                    textAlign: "left",
                }}
            >
                <Chevron
                    size={14}
                    strokeWidth={2}
                    style={{ color: "var(--mc-fg-2)", flexShrink: 0 }}
                />
                {Icon ? (
                    <Icon
                        size={15}
                        strokeWidth={1.75}
                        style={{ color: `var(--mc-${tone === "neutral" ? "fg-1" : tone})` }}
                    />
                ) : null}
                <span
                    style={{
                        fontFamily: "var(--mc-font-display)",
                        fontSize: 14,
                        fontWeight: 600,
                        letterSpacing: -0.1,
                        color: "var(--mc-fg)",
                    }}
                >
                    {title}
                </span>
                {subtitle ? (
                    <span
                        style={{
                            fontSize: 11,
                            color: "var(--mc-fg-3)",
                            fontFamily: "var(--mc-font-mono)",
                        }}
                    >
                        — {subtitle}
                    </span>
                ) : null}
                <span style={{ flex: 1 }} />
                <Pill tone={tone === "neutral" ? "neutral" : tone} size="sm">
                    {rows.length}
                </Pill>
            </button>
            {open ? (
                rows.length === 0 ? (
                    <div style={{ padding: 16 }}>
                        <EmptyState
                            title="Nothing here yet"
                            description="Phases will populate as MASTER_PLAN.md is amended."
                        />
                    </div>
                ) : (
                    <div>
                        {rows.map((r) => (
                            <PhaseRow key={r.phase + r.label} {...r} {...(rowProps || {})} />
                        ))}
                    </div>
                )
            ) : null}
        </section>
    );
}

// ───────────────────────────────────────────────────────────────────
// Page
// ───────────────────────────────────────────────────────────────────

export default function RoadmapPage() {
    const nextRows = useMemo(
        () => NEXT.map((r, i) => ({ ...r, highlight: i === 0 })),
        [],
    );

    return (
        <div
            data-testid="roadmap-page"
            style={{
                height: "100%",
                overflowY: "auto",
                padding: "28px 36px 64px",
                maxWidth: 1100,
                margin: "0 auto",
                color: "var(--mc-fg)",
                fontFamily: "var(--mc-font-sans)",
            }}
        >
            {/* Hero */}
            <header
                style={{
                    marginBottom: 24,
                    padding: "20px 22px",
                    borderRadius: "var(--mc-radius-lg, 12px)",
                    background: "var(--mc-bg-overlay)",
                    border: "1px solid var(--mc-line-strong)",
                    backdropFilter: "blur(18px)",
                    WebkitBackdropFilter: "blur(18px)",
                    boxShadow: "0 0 40px rgba(217, 162, 76, 0.06)",
                }}
            >
                <div
                    style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        flexWrap: "wrap",
                    }}
                >
                    <h1
                        style={{
                            margin: 0,
                            fontFamily: "var(--mc-font-display)",
                            fontSize: 28,
                            fontWeight: 700,
                            letterSpacing: -0.5,
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
                            Roadmap
                        </span>
                        <Map size={22} style={{ color: "var(--mc-accent)" }} />
                    </h1>
                    <Pill tone="accent" size="sm">
                        in-app mirror of MASTER_PLAN.md
                    </Pill>
                </div>
                <p
                    style={{
                        marginTop: 8,
                        marginBottom: 0,
                        fontSize: 13,
                        lineHeight: 1.5,
                        color: "var(--mc-fg-2)",
                        maxWidth: 760,
                    }}
                >
                    Every Venice phase, in dependency order. The non-coder test:
                    you should never have to open a terminal or read a markdown
                    doc to see where Mietorè is and what is next. Tap a section
                    to collapse it.
                </p>
            </header>

            {/* Next — highlighted at the top */}
            <Section
                testId="roadmap-section-next"
                icon={Sparkles}
                tone="accent"
                title="Next — Backend in dependency order"
                subtitle="Sprint 5 → 6 → 7 → 8 → 9 → Sprint 3 (finish)"
                rows={nextRows}
            />

            {/* Phase E — Config-as-UI */}
            <Section
                testId="roadmap-section-phase-e"
                icon={Sliders}
                tone="info"
                title="Phase E — Config-as-UI"
                subtitle="Files browser, files editor, customise rebuild"
                rows={PHASE_E}
            />

            {/* Phase F — Visibility */}
            <Section
                testId="roadmap-section-phase-f"
                icon={Eye}
                tone="info"
                title="Phase F — Visibility"
                subtitle="Cost, standup, inspector, doctor, security audit, audit trail"
                rows={PHASE_F}
            />

            {/* Phase G — Real Qudos */}
            <Section
                testId="roadmap-section-phase-g"
                icon={Hand}
                tone="warn"
                title="Phase G — Real Qudos"
                subtitle="Screen capture, accessibility, vision pipeline, overlay app"
                rows={PHASE_G}
                defaultOpen={false}
            />

            {/* Phase H — Mobile */}
            <Section
                testId="roadmap-section-phase-h"
                icon={Smartphone}
                tone="warn"
                title="Phase H — Mobile"
                subtitle="PWA, iPad, iPhone, voice, push"
                rows={PHASE_H}
                defaultOpen={false}
            />

            {/* Phase I+ — long-tail */}
            <Section
                testId="roadmap-section-phase-i-plus"
                icon={Rocket}
                tone="neutral"
                title="Phase I+"
                subtitle="Personas, plugins, Tauri, brand rename, LoRA, distribution"
                rows={PHASE_I_PLUS}
                defaultOpen={false}
            />

            {/* In flight */}
            <Section
                testId="roadmap-section-in-flight"
                icon={Clock}
                tone="warn"
                title="In Flight"
                subtitle="Started but not yet ✅"
                rows={IN_FLIGHT}
            />

            {/* Drifted */}
            <Section
                testId="roadmap-section-drifted"
                icon={AlertOctagon}
                tone="err"
                title="Drifted (PROGRESS.md re-verify)"
                subtitle="Previously verified, now suspect — Reviewer re-checks"
                rows={DRIFTED}
            />

            {/* Completed */}
            <Section
                testId="roadmap-section-completed"
                icon={CheckCircle2}
                tone="ok"
                title="Completed"
                subtitle="DO NOT REBUILD"
                rows={COMPLETED}
                defaultOpen={false}
            />

            {/* Footnote */}
            <footer
                style={{
                    marginTop: 16,
                    padding: "10px 14px",
                    fontSize: 11,
                    color: "var(--mc-fg-3)",
                    fontFamily: "var(--mc-font-mono)",
                    borderTop: "1px solid var(--mc-line)",
                    display: "flex",
                    gap: 16,
                    flexWrap: "wrap",
                }}
            >
                <span>
                    <Cpu size={11} style={{ marginRight: 4, verticalAlign: -1 }} />
                    Source of truth: MASTER_PLAN.md (Venice phase IDs)
                </span>
                <span>
                    <Layers size={11} style={{ marginRight: 4, verticalAlign: -1 }} />
                    Wiring target: GET /api/v2/roadmap (future)
                </span>
            </footer>
        </div>
    );
}
