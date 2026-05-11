/**
 * Phase 0.3 — <BindIndicator>
 *
 *   <BindIndicator to="connections.tailscale" label="Tailscale" />
 *
 * Renders a kit Indicator dot bound to a boolean (or truthy) config value.
 * Live via WS.
 */
import React from "react";
import { Indicator, Skeleton } from "@/components/kit";
import { useConfigValue } from "@/hooks/useConfigBus";

const DEFAULT_BOOL_MAP = {
  true: { tone: "ok", pulse: true },
  false: { tone: "off", pulse: false },
};

export function resolveIndicatorTone(value, mapping) {
  if (mapping && Object.prototype.hasOwnProperty.call(mapping, String(value))) {
    return mapping[String(value)];
  }
  if (mapping && Object.prototype.hasOwnProperty.call(mapping, value)) {
    return mapping[value];
  }
  if (typeof value === "boolean") return DEFAULT_BOOL_MAP[String(value)];
  if (value === null || value === undefined) return { tone: "off", pulse: false };
  // Truthy string handling
  if (typeof value === "string") {
    const k = value.toLowerCase();
    if (["online", "connected", "ok", "ready", "true"].includes(k)) {
      return { tone: "ok", pulse: true };
    }
    if (["degraded", "warn", "warning", "pending"].includes(k)) {
      return { tone: "warn", pulse: false };
    }
    if (["offline", "down", "error", "failed", "false"].includes(k)) {
      return { tone: "err", pulse: false };
    }
  }
  return value ? { tone: "ok", pulse: true } : { tone: "off", pulse: false };
}

export function BindIndicator({ to, label, mapping, size = "md", dataTestid, className }) {
  const { value, loading, error } = useConfigValue(to);
  const testid = dataTestid || `bind-indicator-${to}`;

  if (loading && value === undefined) {
    return (
      <span data-testid={testid} className={className}>
        <Skeleton height={10} width={10} circle />
      </span>
    );
  }

  if (error && value === undefined) {
    return (
      <Indicator tone="err" size={size} label={label || "Error"}
        className={className}
        // expose data-testid via wrapper since Indicator has none
      />
    );
  }

  const { tone, pulse } = resolveIndicatorTone(value, mapping);
  return (
    <span data-testid={testid} className={className}>
      <Indicator tone={tone} size={size} pulse={pulse} label={label} />
    </span>
  );
}

export default BindIndicator;
