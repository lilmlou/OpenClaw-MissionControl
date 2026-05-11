/**
 * Phase 0.3 — <BindMetric>
 *
 *   <BindMetric to="metrics.tokens.today" label="Tokens today" historyKey="metrics.tokens.history" />
 *
 * Renders a small card with a large number, a label, and an optional inline
 * sparkline if `historyKey` is provided. Subscribes to both keys via the
 * config bus (live updates through WS).
 */
import React, { useMemo } from "react";
import { C } from "@/lib/constants";
import { Skeleton } from "@/components/kit";
import { useConfigValue } from "@/hooks/useConfigBus";
import { BindSparkline } from "./BindSparkline";

const FORMATTERS = {
  number: (n) => Number(n).toLocaleString(),
  currency: (n) => `$${Number(n).toLocaleString(undefined, { maximumFractionDigits: 2 })}`,
  percent: (n) => `${(Number(n) * 100).toFixed(1)}%`,
  bytes: (n) => {
    const v = Number(n);
    if (!isFinite(v)) return String(n);
    const units = ["B", "KB", "MB", "GB", "TB"];
    let i = 0;
    let x = v;
    while (x >= 1024 && i < units.length - 1) { x /= 1024; i++; }
    return `${x.toFixed(x >= 100 || i === 0 ? 0 : 1)} ${units[i]}`;
  },
};

function formatValue(v, format) {
  if (v === undefined || v === null) return "—";
  if (typeof format === "function") {
    try { return format(v); } catch { return String(v); }
  }
  if (typeof format === "string" && FORMATTERS[format]) {
    return FORMATTERS[format](v);
  }
  if (typeof v === "number") return FORMATTERS.number(v);
  return String(v);
}

export function BindMetric({
  to,
  label,
  format,
  historyKey,
  tone = "accent",
  dataTestid,
  className,
}) {
  const { value, loading, error } = useConfigValue(to);
  const testid = dataTestid || `bind-metric-${to}`;

  const display = useMemo(() => formatValue(value, format), [value, format]);

  return (
    <div
      data-testid={testid}
      className={className}
      style={{
        background: C.surface,
        border: `1px solid ${C.border}`,
        borderRadius: "var(--mc-radius-md)",
        padding: "var(--mc-space-4)",
        minWidth: 0,
      }}
    >
      <div className="flex items-baseline justify-between gap-2">
        <div className="min-w-0 flex-1">
          {loading && value === undefined ? (
            <Skeleton height={28} width="60%" />
          ) : error && value === undefined ? (
            <span
              className="text-[14px]"
              style={{ color: C.red }}
              data-testid={`${testid}-error`}
            >
              ⚠ {error}
            </span>
          ) : (
            <span
              className="font-semibold tracking-tight"
              style={{
                fontSize: "var(--mc-text-xl, 22px)",
                color: C.text,
                fontFamily: "var(--mc-font-display, var(--mc-font-sans))",
                letterSpacing: "var(--mc-tracking-tight)",
                lineHeight: 1.1,
              }}
              data-testid={`${testid}-value`}
            >
              {display}
            </span>
          )}
        </div>
      </div>
      {label && (
        <div
          className="mt-1 text-[11px] truncate"
          style={{ color: C.muted, letterSpacing: "var(--mc-tracking-wide)" }}
          data-testid={`${testid}-label`}
        >
          {label}
        </div>
      )}
      {historyKey && (
        <div className="mt-2" style={{ height: 28 }}>
          <BindSparkline
            to={historyKey}
            height={28}
            tone={tone}
            dataTestid={`${testid}-sparkline`}
          />
        </div>
      )}
    </div>
  );
}

export default BindMetric;
