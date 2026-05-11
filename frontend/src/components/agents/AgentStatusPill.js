/**
 * F7 — AgentStatusPill
 *
 * Shared component for rendering agent run status with icon + colour + label.
 * Used by /agents/live, /agents task list, activity feed, footer toasts, and
 * anywhere an agent status badge is rendered.
 *
 * Status vocabulary (LOCKED per F7 §2.5):
 *   running · claims_done · verified · failed · killed
 *
 * The string "done" is BANNED from any user-facing copy or component prop.
 * No hex codes — uses design tokens from index.css.
 */
import React from "react";
import {
  Loader2, AlertCircle, CheckCircle2, XCircle, Skull, Clock,
} from "lucide-react";

const STATUS_MAP = {
  running: {
    icon: Loader2,
    tone: "warn",
    label: "running",
    pulse: true,
    indicator: "warn",
  },
  claims_done: {
    icon: AlertCircle,
    tone: "warn",
    label: "claims done",
    pulse: false,
    indicator: "warn",
  },
  verified: {
    icon: CheckCircle2,
    tone: "ok",
    label: "verified",
    pulse: false,
    indicator: "ok",
  },
  failed: {
    icon: XCircle,
    tone: "err",
    label: "failed",
    pulse: false,
    indicator: "err",
  },
  killed: {
    icon: Skull,
    tone: "neutral",
    label: "killed",
    pulse: false,
    indicator: "off",
  },
};

const DEFAULT_META = {
  icon: Clock,
  tone: "neutral",
  label: "",
  pulse: false,
  indicator: "off",
};

export function getStatusMeta(status) {
  return STATUS_MAP[status] || { ...DEFAULT_META, label: status || "—" };
}

/**
 * AgentStatusPill — renders a status pill for an agent run.
 *
 * @param {string}  status   — one of running|claims_done|verified|failed|killed
 * @param {"sm"|"md"} size   — pill size (default "sm")
 * @param {boolean}  showIcon — show the status icon (default true)
 */
export default function AgentStatusPill({ status, size = "sm", showIcon = true }) {
  const meta = getStatusMeta(status);
  const Icon = meta.icon;
  const iconSize = size === "md" ? 12 : 10;

  // Map tones to design-token colours
  const toneColors = {
    ok: { bg: "var(--mc-ok)", bgSoft: "var(--mc-ok-soft)" },
    warn: { bg: "var(--mc-warn)", bgSoft: "var(--mc-warn-soft)" },
    err: { bg: "var(--mc-err)", bgSoft: "var(--mc-err-soft)" },
    info: { bg: "var(--mc-info)", bgSoft: "var(--mc-info-soft)" },
    neutral: { bg: "var(--mc-fg-2)", bgSoft: "rgba(156,163,175,0.14)" },
  };
  const colors = toneColors[meta.tone] || toneColors.neutral;

  return (
    <span
      data-testid={`agent-status-pill-${status}`}
      data-status={status}
      className="inline-flex items-center gap-1 rounded-full font-medium whitespace-nowrap"
      style={{
        padding: size === "md" ? "2px 10px" : "1px 8px",
        fontSize: size === "md" ? "var(--mc-text-sm)" : "var(--mc-text-xs)",
        lineHeight: 1.4,
        background: colors.bgSoft,
        color: colors.bg,
        border: `1px solid ${colors.bgSoft}`,
      }}
    >
      {showIcon && (
        <Icon
          size={iconSize}
          className={meta.pulse ? "animate-spin" : ""}
          style={{ flexShrink: 0 }}
        />
      )}
      {meta.label}
    </span>
  );
}