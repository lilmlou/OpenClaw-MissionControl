/**
 * Phase F1 — Budget Meter (shell)
 *
 *   <BudgetMeter
 *     period="month"
 *     spent={42.18}
 *     budget={150}
 *     projected={138.4}
 *     warnAt={0.8}       // 80%  → amber
 *     dangerAt={1.0}     // 100% → red
 *     onEdit={() => …}
 *   />
 *
 * Renders the "Budget" tile from MASTER_PLAN.md Phase F1 — Cost & Usage
 * Tracker (Today / Month / Projected / Budget). Visualises the user's
 * configured monthly (or daily) spend ceiling next to live spend and the
 * Sprint 5 projection, so Meg sees:
 *
 *   $42.18 spent of $150         ← big numeric line
 *   ████████░░░░░░░░░░░  28%     ← horizontal meter (warn/danger zones)
 *   projected $138.4 · within budget   ← caption with status pill
 *
 * Pure presentational shell built by mc-fe-builder. The wiring agent
 * (mc-fe-wiring) will later subscribe to:
 *   GET /api/v2/usage/projections     (already shipped — `projected_monthly_usd`)
 *   GET /api/v2/budget                (Phase F1 wiring)
 *   POST /api/v2/budget               (Phase F1 wiring — Meg edits via `onEdit`)
 * No fetches, no WS, no mock data here — every value comes from props
 * so the wiring layer can drop a real subscription in without touching layout.
 *
 * Non-coder test: replaces "open .env, edit MONTHLY_BUDGET_USD, restart".
 * Meg sees her budget on /costs, taps the gear to edit, no terminal.
 *
 * Theme: locked Mietorè tokens — warm-black surface, hairline gold border,
 * gold #D9A24C accent, cyan #22D3DB sub-accent, glassmorphism backdrop,
 * semantic ok/warn/err for the meter zones.
 */
import React, { useMemo } from "react";
import { Target, Pencil, AlertTriangle, CheckCircle2, CircleSlash } from "lucide-react";
import { C } from "@/lib/constants";

/* ─── formatters ──────────────────────────────────────────────────────────── */
function fmtUsd(v) {
    if (v == null || Number.isNaN(Number(v))) return "—";
    const n = Number(v);
    if (n === 0) return "$0.00";
    if (n < 0.01) return "<$0.01";
    if (n < 1) return `$${n.toFixed(4)}`;
    if (n < 100) return `$${n.toFixed(2)}`;
    return `$${n.toFixed(0)}`;
}

function fmtPct(p) {
    if (p == null || Number.isNaN(Number(p))) return "—";
    const n = Number(p);
    if (n < 0.01) return "<1%";
    if (n >= 10) return `${Math.round(n * 100)}%`;
    return `${(n * 100).toFixed(1)}%`;
}

const PERIOD_LABEL = {
    today: "Today",
    week: "This Week",
    month: "This Month",
    quarter: "This Quarter",
    year: "This Year",
};

/* ─── small helpers ───────────────────────────────────────────────────────── */
function statusFor({ ratio, projectedRatio, hasBudget, warnAt, dangerAt }) {
    if (!hasBudget) {
        return {
            tone: "neutral",
            label: "No budget set",
            Icon: CircleSlash,
            sub: "Tap to configure a spend ceiling.",
        };
    }
    if (ratio >= dangerAt) {
        return {
            tone: "err",
            label: "Over budget",
            Icon: AlertTriangle,
            sub: "Current spend exceeds the configured limit.",
        };
    }
    if (projectedRatio != null && projectedRatio >= dangerAt) {
        return {
            tone: "warn",
            label: "Projected over",
            Icon: AlertTriangle,
            sub: "Projection trends past the budget before period end.",
        };
    }
    if (ratio >= warnAt) {
        return {
            tone: "warn",
            label: "Approaching limit",
            Icon: AlertTriangle,
            sub: "Spend is in the warning zone.",
        };
    }
    return {
        tone: "ok",
        label: "Within budget",
        Icon: CheckCircle2,
        sub: "On track.",
    };
}

const TONE_COLOR = {
    ok: "var(--mc-ok, #5EE2C9)",
    warn: "var(--mc-warn, #E5B135)",
    err: "var(--mc-err, #E05555)",
    neutral: "var(--mc-fg-2, rgba(255,255,255,0.55))",
};

/* ─── meter bar ───────────────────────────────────────────────────────────── */
function MeterBar({ ratio, projectedRatio, warnAt, dangerAt, hasBudget }) {
    const clamp = (v) => Math.max(0, Math.min(1, v ?? 0));
    const actualPct = clamp(ratio) * 100;
    const projPct = projectedRatio != null ? clamp(projectedRatio) * 100 : null;

    // Filled-segment colour follows the same status thresholds.
    let fillColor = TONE_COLOR.ok;
    if (hasBudget) {
        if (ratio >= dangerAt) fillColor = TONE_COLOR.err;
        else if (ratio >= warnAt) fillColor = TONE_COLOR.warn;
        else fillColor = "var(--mc-accent, #D9A24C)";
    } else {
        fillColor = TONE_COLOR.neutral;
    }

    return (
        <div
            data-testid="budget-meter-bar"
            style={{
                position: "relative",
                height: 10,
                borderRadius: 999,
                overflow: "hidden",
                background: "var(--mc-bg-2)",
                border: "1px solid var(--mc-line)",
            }}
            aria-hidden
        >
            {/* fill */}
            <div
                style={{
                    width: `${actualPct}%`,
                    height: "100%",
                    background: fillColor,
                    boxShadow: hasBudget ? `0 0 8px ${fillColor}55` : "none",
                    transition: "width var(--mc-dur-base, 220ms) var(--mc-ease-out, ease)",
                }}
                data-testid="budget-meter-fill"
            />
            {/* warn-zone hairline */}
            {hasBudget && warnAt > 0 && warnAt < 1 && (
                <div
                    style={{
                        position: "absolute",
                        top: 0,
                        bottom: 0,
                        left: `${warnAt * 100}%`,
                        width: 1,
                        background: "rgba(229,177,53,0.55)",
                    }}
                />
            )}
            {/* danger-zone hairline */}
            {hasBudget && dangerAt > 0 && dangerAt < 1.0001 && (
                <div
                    style={{
                        position: "absolute",
                        top: 0,
                        bottom: 0,
                        left: `${Math.min(dangerAt, 1) * 100}%`,
                        width: 1,
                        background: "rgba(224,85,85,0.6)",
                    }}
                />
            )}
            {/* projected marker — cyan tick */}
            {hasBudget && projPct != null && (
                <div
                    data-testid="budget-meter-projection"
                    title="Projected end-of-period spend"
                    style={{
                        position: "absolute",
                        top: -2,
                        bottom: -2,
                        left: `${projPct}%`,
                        width: 2,
                        background: "var(--mc-accent-2, #22D3DB)",
                        boxShadow: "0 0 6px rgba(34,211,219,0.55)",
                        transform: "translateX(-1px)",
                    }}
                />
            )}
        </div>
    );
}

/* ─── main component ─────────────────────────────────────────────────────── */
/**
 * BudgetMeter
 *
 * Props (all optional — renders an empty state when nothing is set):
 *   period            "today" | "week" | "month" | "quarter" | "year"  (default "month")
 *   spent             number  — current period spend in USD
 *   budget            number | null  — configured ceiling in USD; null = unset
 *   projected         number | null  — projected end-of-period spend in USD
 *   warnAt            number  — fraction of budget where amber starts (default 0.8)
 *   dangerAt          number  — fraction of budget where red starts (default 1.0)
 *   currency          string  — currency code label (default "USD")
 *   onEdit            () => void  — opens the budget-editing modal (wiring)
 *   loading           boolean
 *   error             string | null
 *   dataTestid        string  (default "budget-meter")
 *   className         string
 */
export function BudgetMeter({
    period = "month",
    spent,
    budget,
    projected,
    warnAt = 0.8,
    dangerAt = 1.0,
    currency = "USD",
    onEdit,
    loading = false,
    error = null,
    dataTestid = "budget-meter",
    className,
}) {
    const hasBudget = budget != null && Number(budget) > 0;
    const hasSpent = spent != null && !Number.isNaN(Number(spent));

    const ratio = useMemo(() => {
        if (!hasBudget || !hasSpent) return 0;
        return Number(spent) / Number(budget);
    }, [hasBudget, hasSpent, spent, budget]);

    const projectedRatio = useMemo(() => {
        if (!hasBudget || projected == null) return null;
        return Number(projected) / Number(budget);
    }, [hasBudget, projected, budget]);

    const status = useMemo(
        () => statusFor({ ratio, projectedRatio, hasBudget, warnAt, dangerAt }),
        [ratio, projectedRatio, hasBudget, warnAt, dangerAt],
    );
    const StatusIcon = status.Icon;
    const statusColor = TONE_COLOR[status.tone] || TONE_COLOR.neutral;

    return (
        <div
            data-testid={dataTestid}
            data-state={hasBudget ? "configured" : "unset"}
            data-status={status.tone}
            className={className}
            style={{
                position: "relative",
                background: C.surface,
                border: `1px solid ${C.border}`,
                borderRadius: "var(--mc-radius-xl, 14px)",
                padding: 16,
                backdropFilter: "blur(8px)",
                WebkitBackdropFilter: "blur(8px)",
                color: C.text,
            }}
        >
            {/* Header row */}
            <div className="flex items-center justify-between gap-3" style={{ marginBottom: 8 }}>
                <div className="flex items-center gap-2" style={{ color: C.muted }}>
                    <Target className="w-3.5 h-3.5" style={{ color: C.accent }} />
                    <span
                        className="text-[11px] uppercase tracking-wider font-semibold"
                        data-testid={`${dataTestid}-label`}
                    >
                        Budget · {PERIOD_LABEL[period] || period}
                    </span>
                </div>
                <button
                    type="button"
                    onClick={onEdit}
                    disabled={typeof onEdit !== "function"}
                    className="flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-medium disabled:opacity-40"
                    style={{
                        background: C.surface2,
                        border: `1px solid ${C.border}`,
                        color: C.muted,
                    }}
                    data-testid={`${dataTestid}-edit`}
                    title="Edit budget"
                >
                    <Pencil className="w-3 h-3" />
                    {hasBudget ? "Edit" : "Set budget"}
                </button>
            </div>

            {/* Big numeric line */}
            <div className="flex items-baseline gap-2" style={{ marginBottom: 10 }}>
                <span
                    className="text-2xl font-semibold tabular-nums"
                    style={{ color: hasSpent ? C.text : C.muted }}
                    data-testid={`${dataTestid}-spent`}
                >
                    {hasSpent ? fmtUsd(spent) : "—"}
                </span>
                <span className="text-[12px]" style={{ color: C.muted }}>
                    spent of
                </span>
                <span
                    className="text-[14px] font-semibold tabular-nums"
                    style={{ color: hasBudget ? C.text : C.muted }}
                    data-testid={`${dataTestid}-cap`}
                >
                    {hasBudget ? fmtUsd(budget) : "not set"}
                </span>
                {currency && (
                    <span
                        className="text-[10px] font-mono uppercase tracking-wider"
                        style={{ color: C.muted }}
                    >
                        {currency}
                    </span>
                )}
                {hasBudget && hasSpent && (
                    <span
                        className="ml-auto text-[12px] font-mono tabular-nums"
                        style={{ color: statusColor }}
                        data-testid={`${dataTestid}-pct`}
                    >
                        {fmtPct(ratio)}
                    </span>
                )}
            </div>

            {/* Meter bar */}
            <MeterBar
                ratio={ratio}
                projectedRatio={projectedRatio}
                warnAt={warnAt}
                dangerAt={dangerAt}
                hasBudget={hasBudget}
            />

            {/* Status + projection caption */}
            <div
                className="flex items-center gap-2 flex-wrap"
                style={{ marginTop: 10, fontSize: 11 }}
            >
                <span
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-medium"
                    style={{
                        background: `${statusColor}1f`,
                        color: statusColor,
                        border: `1px solid ${statusColor}40`,
                    }}
                    data-testid={`${dataTestid}-status`}
                >
                    <StatusIcon className="w-3 h-3" />
                    {status.label}
                </span>
                {projected != null && (
                    <span style={{ color: C.muted }} data-testid={`${dataTestid}-projection-label`}>
                        projected {fmtUsd(projected)}
                        {hasBudget && projectedRatio != null && (
                            <>
                                {" "}
                                <span style={{ color: "var(--mc-accent-2)" }}>
                                    ({fmtPct(projectedRatio)} of cap)
                                </span>
                            </>
                        )}
                    </span>
                )}
                <span style={{ color: C.muted, marginLeft: "auto" }}>{status.sub}</span>
            </div>

            {/* Error / loading overlay */}
            {error && (
                <div
                    className="mt-2 text-[11px] font-mono"
                    style={{ color: "var(--mc-err, #f87171)" }}
                    data-testid={`${dataTestid}-error`}
                >
                    ⚠ {error}
                </div>
            )}
            {loading && !error && (
                <div
                    className="mt-2 text-[11px]"
                    style={{ color: C.muted }}
                    data-testid={`${dataTestid}-loading`}
                >
                    Loading budget…
                </div>
            )}
        </div>
    );
}

export default BudgetMeter;
