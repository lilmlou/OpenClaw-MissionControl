// UsageBadge — Sprint 5 visible surface.
//
// Renders an inline cost-per-message badge under each assistant chat bubble:
//   "1,240 in · 312 out · $0.0042"
//
// Pure presentational shell built by mc-fe-builder. The wiring agent
// (mc-fe-wiring) will pass `tokens_in`, `tokens_out`, `cost_estimate_usd`
// from the `chat.usage` WS event / `model_choices` row.
//
// When `usage` is missing (pre-stream-end), renders a muted "usage pending"
// fallback instead of raw null / JSON. Never reaches for a network fetch
// itself — the badge is a leaf renderer only.
//
// Theme: applies Mietorè glassmorphism tokens via the existing kit `Pill`
// primitive (warm-black bg, gold hairline border, cyan accent via tone).

import React from "react";
import { Coins } from "lucide-react";
import { Pill } from "@/components/kit";

function formatTokens(n) {
  if (n == null || Number.isNaN(Number(n))) return null;
  return Number(n).toLocaleString();
}

function formatCost(usd) {
  if (usd == null || Number.isNaN(Number(usd))) return null;
  const v = Number(usd);
  if (v === 0) return "free";
  if (v < 0.0001) return "<$0.0001";
  if (v < 1) return `$${v.toFixed(4)}`;
  return `$${v.toFixed(2)}`;
}

/**
 * Props (all optional — render gracefully when absent):
 *   tokens_in           number | null
 *   tokens_out          number | null
 *   cost_estimate_usd   number | null
 *   model               string | null   (e.g. "claude-opus-4-7")
 *   provider            string | null   (e.g. "venice", "ollama-cloud")
 *   pending             boolean         (force "usage pending" muted state)
 *   className           string
 */
export function UsageBadge({
  tokens_in,
  tokens_out,
  cost_estimate_usd,
  model,
  provider,
  pending = false,
  className,
}) {
  const tIn = formatTokens(tokens_in);
  const tOut = formatTokens(tokens_out);
  const cost = formatCost(cost_estimate_usd);

  // No usage yet — show muted placeholder (never raw null / JSON).
  if (pending || (tIn == null && tOut == null && cost == null)) {
    return (
      <span
        data-testid="usage-badge"
        data-state="pending"
        className={className}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          fontFamily: "var(--mc-font-mono, ui-monospace, monospace)",
          fontSize: "var(--mc-text-xs, 11px)",
          color: "var(--mc-fg-2, rgba(255,255,255,0.55))",
          letterSpacing: "var(--mc-tracking-wide, 0.02em)",
          opacity: 0.7,
        }}
        title={
          model
            ? `usage pending · ${provider ? `${provider}/` : ""}${model}`
            : "usage pending"
        }
      >
        <Coins size={11} strokeWidth={1.6} aria-hidden />
        <span>usage pending</span>
      </span>
    );
  }

  // Tooltip carries model/provider context for the curious.
  const tooltip = [
    provider && model ? `${provider}/${model}` : model || provider || null,
    tIn != null ? `${tIn} prompt tokens` : null,
    tOut != null ? `${tOut} completion tokens` : null,
    cost != null ? `cost ${cost}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <Pill
      tone="neutral"
      size="sm"
      icon={<Coins size={11} strokeWidth={1.7} aria-hidden />}
      data-testid="usage-badge"
      data-state="ready"
      className={className}
      title={tooltip}
      style={{
        fontFamily: "var(--mc-font-mono, ui-monospace, monospace)",
        // Hairline gold border per Mietorè theme — overrides default
        // Pill neutral border so the cost badge reads as a brand element.
        borderColor: "var(--mc-accent-soft, rgba(217,162,76,0.35))",
        background: "var(--mc-bg-1, rgba(10,8,7,0.55))",
        backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
      }}
    >
      <span
        style={{ color: "var(--mc-fg, rgba(255,255,255,0.92))" }}
        data-testid="usage-badge-in"
      >
        {tIn ?? "—"} in
      </span>
      <span aria-hidden style={{ opacity: 0.5 }}>·</span>
      <span
        style={{ color: "var(--mc-fg, rgba(255,255,255,0.92))" }}
        data-testid="usage-badge-out"
      >
        {tOut ?? "—"} out
      </span>
      <span aria-hidden style={{ opacity: 0.5 }}>·</span>
      <span
        style={{ color: "var(--mc-accent, #D9A24C)" }}
        data-testid="usage-badge-cost"
      >
        {cost ?? "—"}
      </span>
    </Pill>
  );
}

export default UsageBadge;
