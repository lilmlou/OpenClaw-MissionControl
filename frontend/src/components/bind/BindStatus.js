/**
 * Phase 0.3 — <BindStatus>
 *
 *   <BindStatus to="services.gateway.status" />
 *
 * Subscribes to a config key and renders a kit Pill with a tone derived
 * from the value. Updates live via the WS push.
 *
 * Default mappings:
 *   - boolean: true → ok "Online", false → err "Offline"
 *   - string: "online"|"connected" → ok, "degraded"|"warn" → warn,
 *            "offline"|"down"|"error" → err, otherwise → neutral
 *   - undefined / loading → neutral skeleton
 *
 * Pass `mapping={ value: { tone, label } }` to override.
 */
import React from "react";
import { Pill, Skeleton } from "@/components/kit";
import { useConfigValue } from "@/hooks/useConfigBus";

const DEFAULT_STRING_MAP = {
  online: { tone: "ok", label: "Online" },
  connected: { tone: "ok", label: "Connected" },
  ok: { tone: "ok", label: "OK" },
  ready: { tone: "ok", label: "Ready" },
  degraded: { tone: "warn", label: "Degraded" },
  warn: { tone: "warn", label: "Warn" },
  warning: { tone: "warn", label: "Warning" },
  pending: { tone: "warn", label: "Pending" },
  offline: { tone: "err", label: "Offline" },
  down: { tone: "err", label: "Down" },
  error: { tone: "err", label: "Error" },
  failed: { tone: "err", label: "Failed" },
};

export function resolveStatus(value, mapping) {
  if (mapping && Object.prototype.hasOwnProperty.call(mapping, value)) {
    const m = mapping[value];
    return { tone: m.tone || "neutral", label: m.label ?? String(value) };
  }
  if (typeof value === "boolean") {
    return value
      ? { tone: "ok", label: "Online" }
      : { tone: "err", label: "Offline" };
  }
  if (typeof value === "string") {
    const k = value.toLowerCase();
    if (DEFAULT_STRING_MAP[k]) return DEFAULT_STRING_MAP[k];
    return { tone: "neutral", label: value };
  }
  if (value === null || value === undefined) {
    return { tone: "neutral", label: "—" };
  }
  return { tone: "neutral", label: String(value) };
}

export function BindStatus({ to, mapping, dataTestid, size = "md", className }) {
  const { value, loading, error } = useConfigValue(to);
  const testid = dataTestid || `bind-status-${to}`;

  if (loading && value === undefined) {
    return (
      <span data-testid={testid} className={className}>
        <Skeleton height={20} width={64} />
      </span>
    );
  }

  if (error && value === undefined) {
    return (
      <Pill tone="err" size={size} data-testid={testid} className={className}>
        Error
      </Pill>
    );
  }

  const { tone, label } = resolveStatus(value, mapping);
  return (
    <Pill tone={tone} size={size} data-testid={testid} className={className}>
      {label}
    </Pill>
  );
}

export default BindStatus;
