/**
 * Sprint 8 — Quota Gauge (shell)
 *
 *   <QuotaGauge
 *     provider="venice"
 *     kind="capped"         // fixed | flat-with-overage | capped | pay-per-call | unavailable
 *     used={1234}
 *     limit={10000}
 *     unit="requests"
 *     resetAt={Date.now() + 86400000}
 *   />
 *
 * Real-time quota visibility per MASTER_PLAN.md Sprint 8. Shell renders
 * the gauge chrome (ring + numeric readout + reset countdown + status
 * pill) from props. mc-fe-wiring will later swap in
 *   GET /api/v2/quota
 * and a WS push. No fetches, no mock data, no side effects.
 *
 * Theme: locked Mietorè tokens — gold #D9A24C accent, cyan #22D3DB
 * sub-accent, semantic ok/warn/err for quota state. Glassmorphism
 * backdrop and hairline gold border.
 */
import React from "react";
import { Gauge, Infinity as InfinityIcon, AlertTriangle, CircleSlash, CreditCard } from "lucide-react";

const KIND_META = {
  "fixed":              { label: "Fixed",              Icon: Gauge,         tone: "info" },
  "flat-with-overage":  { label: "Flat + overage",     Icon: CreditCard,    tone: "warn" },
  "capped":             { label: "Capped",             Icon: Gauge,         tone: "info" },
  "pay-per-call":       { label: "Pay per call",       Icon: CreditCard,    tone: "warn" },
  "unavailable":        { label: "Unavailable",        Icon: CircleSlash,   tone: "err"  },
  "unlimited":          { label: "Unlimited",          Icon: InfinityIcon,  tone: "ok"   },
};

const TONE_FG = {
  ok:      "var(--mc-ok)",
  warn:    "var(--mc-warn)",
  err:     "var(--mc-err)",
  info:    "var(--mc-info)",
  neutral: "var(--mc-fg-2)",
};

function fmtN(v) {
  if (v == null) return "—";
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)}K`;
  return String(v);
}

function fmtCountdown(ts) {
  if (!ts) return null;
  const diff = ts - Date.now();
  if (diff <= 0) return "resetting…";
  const s = Math.floor(diff / 1000);
  const d = Math.floor(s / 86400);
  if (d >= 1) return `resets in ${d}d`;
  const h = Math.floor(s / 3600);
  if (h >= 1) return `resets in ${h}h`;
  const m = Math.floor(s / 60);
  return `resets in ${m}m`;
}

/* Circular SVG gauge — gold accent stroke. Empty when no limit known. */
function Ring({ pct, tone }) {
  const radius = 28;
  const stroke = 5;
  const c = 2 * Math.PI * radius;
  const safePct = Math.max(0, Math.min(100, pct ?? 0));
  const dash = (safePct / 100) * c;
  const fg = TONE_FG[tone] || "var(--mc-accent)";
  return (
    <svg
      width={72}
      height={72}
      viewBox="0 0 72 72"
      aria-hidden="true"
      style={{ display: "block" }}
    >
      <circle
        cx={36}
        cy={36}
        r={radius}
        stroke="var(--mc-line)"
        strokeWidth={stroke}
        fill="none"
      />
      {pct != null && (
        <circle
          cx={36}
          cy={36}
          r={radius}
          stroke={fg}
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${dash} ${c}`}
          transform="rotate(-90 36 36)"
          style={{
            filter: `drop-shadow(0 0 4px ${fg})`,
            transition: "stroke-dasharray var(--mc-dur-base, 200ms) var(--mc-ease-out, ease)",
          }}
        />
      )}
      <text
        x="50%"
        y="50%"
        textAnchor="middle"
        dominantBaseline="central"
        style={{
          fill: "var(--mc-fg)",
          fontSize: 14,
          fontWeight: 700,
          fontFamily: "var(--mc-font-mono, inherit)",
        }}
      >
        {pct == null ? "—" : `${Math.round(pct)}%`}
      </text>
    </svg>
  );
}

export function QuotaGauge({
  provider,
  kind = "fixed",
  used,
  limit,
  unit = "requests",
  resetAt,
  loading = false,
  error,
  dataTestid = "quota-gauge",
  compact = false,
}) {
  const meta = KIND_META[kind] || KIND_META.fixed;
  const Icon = meta.Icon;
  const pct =
    typeof used === "number" && typeof limit === "number" && limit > 0
      ? (used / limit) * 100
      : null;

  const escalated =
    pct == null
      ? meta.tone
      : pct >= 95
        ? "err"
        : pct >= 75
          ? "warn"
          : pct >= 0
            ? "ok"
            : meta.tone;

  const countdown = fmtCountdown(resetAt);
  const fg = TONE_FG[escalated];

  return (
    <div
      data-testid={dataTestid}
      style={{
        display: "inline-flex",
        gap: compact ? 10 : 14,
        alignItems: "center",
        padding: compact ? "10px 12px" : "14px 16px",
        background: "var(--mc-bg-1)",
        border: "1px solid var(--mc-line)",
        borderRadius: "var(--mc-radius-md, 10px)",
        backdropFilter: "blur(10px)",
        WebkitBackdropFilter: "blur(10px)",
        minWidth: compact ? 200 : 240,
      }}
    >
      <Ring pct={pct} tone={escalated} />
      <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0, flex: 1 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            fontSize: 10,
            letterSpacing: "var(--mc-tracking-wide, 0.04em)",
            textTransform: "uppercase",
            color: "var(--mc-fg-2)",
            fontWeight: 700,
          }}
        >
          <Icon size={11} style={{ color: fg }} />
          <span style={{ color: "var(--mc-fg-1)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {provider || "—"}
          </span>
        </div>

        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--mc-fg)", fontFamily: "var(--mc-font-mono, inherit)" }}>
          {loading ? (
            <span style={{ color: "var(--mc-fg-3)" }}>loading…</span>
          ) : error ? (
            <span style={{ color: "var(--mc-err)", display: "inline-flex", alignItems: "center", gap: 4 }}>
              <AlertTriangle size={11} /> error
            </span>
          ) : limit == null ? (
            <span style={{ color: fg }}>{meta.label}</span>
          ) : (
            <>
              <span>{fmtN(used)}</span>
              <span style={{ color: "var(--mc-fg-3)" }}> / {fmtN(limit)}</span>
              <span style={{ color: "var(--mc-fg-3)", fontWeight: 400, fontSize: 11 }}> {unit}</span>
            </>
          )}
        </div>

        <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              padding: "1px 6px",
              fontSize: 9,
              fontWeight: 600,
              letterSpacing: "var(--mc-tracking-wide, 0.04em)",
              textTransform: "uppercase",
              color: fg,
              background: "var(--mc-bg-2)",
              border: "1px solid var(--mc-line)",
              borderRadius: "var(--mc-radius-full, 999px)",
            }}
          >
            {meta.label}
          </span>
          {countdown && (
            <span style={{ fontSize: 10, color: "var(--mc-fg-3)" }}>{countdown}</span>
          )}
        </div>
      </div>
    </div>
  );
}

export default QuotaGauge;
