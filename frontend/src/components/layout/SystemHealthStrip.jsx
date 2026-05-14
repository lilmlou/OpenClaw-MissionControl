/**
 * SystemHealthStrip — SHELL (mc-fe-builder)
 *
 * A slim, always-mounted strip rendered above the page content showing
 * the live health of the runtime's canonical ports + critical services
 * at a glance, replacing the "run `lsof -nP -iTCP:8765`" + "tail
 * /tmp/mc_fastapi_8765.log" workflow described in PRODUCT_MISSION.md.
 *
 * STATUS: shell only. Reads from existing `systemServices` slice if it
 * happens to be populated (no new fetch here — wiring lane owns that).
 * Renders nothing until at least one canonical service has a known
 * status, so it never adds chrome on an empty page.
 *
 * Non-coder test (PRODUCT_MISSION.md):
 *   - Meg sees green/red dots for Gateway / FastAPI / WS / Tailscale
 *     without opening a terminal.
 *   - Click → opens /system page already wired by the runtime, so the
 *     strip itself does not need to fetch.
 *
 * Theme: locked Mietorè tokens
 *   --mc-bg-2, --mc-line, --mc-gold-soft, --mc-cyan-400, --mc-ok,
 *   --mc-err, --mc-fg-3. Glassmorphism via .mc-glass class on the bar.
 *
 * Wiring follow-up (mc-fe-wiring):
 *   1. Subscribe to `system.*` and `service.*` frames on the shared
 *      config bus so dots flip in real time.
 *   2. Map canonical ports (8765 FastAPI, 7801 Express Gateway,
 *      /api/ws/brain, Tailscale) to status colours via a new selector
 *      `selectSystemHealthStrip(state)`.
 *   3. Hide automatically on `/system` to avoid duplication (parallel
 *      to StatusBar's current behaviour).
 */
import React, { useMemo } from "react";
import { Link, useLocation } from "react-router-dom";
import { Server, Activity, Wifi, Database, Loader2 } from "lucide-react";
import { useGateway } from "@/lib/useGateway";

// Canonical services Meg needs to see at a glance. Names must match the
// keys the runtime emits in `systemServices` once wiring lands.
const CANONICAL = [
  { key: "fastapi",   label: "FastAPI",  port: 8765, Icon: Server },
  { key: "gateway",   label: "Gateway",  port: 7801, Icon: Database },
  { key: "ws_brain",  label: "WS Brain", port: 7801, Icon: Activity },
  { key: "tailscale", label: "Tailscale", port: null, Icon: Wifi   },
];

function pickStatus(services, key) {
  if (!services || typeof services !== "object") return null;
  // Tolerate both list and dict shapes from backend.
  if (Array.isArray(services)) {
    const hit = services.find((s) => s && (s.id === key || s.name === key || s.key === key));
    return hit ? hit.status || hit.state || null : null;
  }
  const entry = services[key];
  if (!entry) return null;
  if (typeof entry === "string") return entry;
  return entry.status || entry.state || null;
}

function toneFor(status) {
  switch (status) {
    case "connected":
    case "online":
    case "healthy":
    case "running":
      return { color: "var(--mc-ok, #6BCF94)", pulse: false };
    case "rate_limited":
    case "warning":
    case "stalled":
      return { color: "var(--mc-gold-400, #D9A24C)", pulse: true };
    case "auth_failed":
    case "disconnected":
    case "offline":
    case "error":
    case "failed":
      return { color: "var(--mc-err, #E55C5C)", pulse: false };
    case "loading":
    case "starting":
      return { color: "var(--mc-cyan-400, #22D3DB)", pulse: true };
    default:
      return { color: "var(--mc-fg-3, #6B6560)", pulse: false };
  }
}

export function SystemHealthStrip() {
  const location = useLocation();
  const systemServices = useGateway((s) => s.systemServices);

  // Don't double up on /system page — full cards already render there.
  const hideOnSystem = location.pathname === "/system";

  const rows = useMemo(() => {
    return CANONICAL.map((svc) => {
      const status = pickStatus(systemServices, svc.key);
      return { ...svc, status, tone: toneFor(status) };
    });
  }, [systemServices]);

  // Shell behaviour: render nothing until at least one service has
  // a *known* (non-null) status. Avoids fake "all loading" chrome.
  const knownCount = rows.filter((r) => r.status != null).length;
  if (knownCount === 0) return null;
  if (hideOnSystem) return null;

  return (
    <Link
      to="/system"
      data-testid="system-health-strip"
      aria-label="Open System page"
      className="mc-glass w-full flex items-center gap-4 px-4 hover:opacity-95 transition-opacity"
      style={{
        height: 28,
        background: "var(--mc-glass-bg, rgba(28,24,18,0.55))",
        backdropFilter: "blur(20px) saturate(140%)",
        WebkitBackdropFilter: "blur(20px) saturate(140%)",
        borderBottom: "1px solid var(--mc-line, rgba(212,162,76,0.10))",
        color: "var(--mc-fg-1, #E5DDD0)",
        fontSize: 11,
        letterSpacing: 0.6,
        textTransform: "uppercase",
        fontFamily: "var(--mc-font-mono, ui-monospace, monospace)",
        textDecoration: "none",
      }}
    >
      <span
        style={{
          color: "var(--mc-fg-3, #6B6560)",
          letterSpacing: "0.15em",
          fontSize: 10,
        }}
      >
        SYSTEM
      </span>
      <div className="flex items-center gap-4 flex-1">
        {rows.map(({ key, label, Icon, status, tone }) => (
          <div
            key={key}
            data-testid={`system-health-strip-${key}`}
            className="flex items-center gap-1.5"
            title={status ? `${label} — ${status}` : `${label} — unknown`}
          >
            <span
              aria-hidden="true"
              className="inline-block rounded-full"
              style={{
                width: 7,
                height: 7,
                background: tone.color,
                boxShadow: `0 0 8px ${tone.color}`,
                animation: tone.pulse
                  ? "mc-pulse 1.6s ease-in-out infinite"
                  : "none",
              }}
            />
            <Icon size={11} aria-hidden="true" style={{ opacity: 0.7 }} />
            <span style={{ fontSize: 10 }}>{label}</span>
          </div>
        ))}
        {/* Loading sentinel when slice exists but no concrete statuses yet. */}
        {knownCount < CANONICAL.length && (
          <Loader2
            size={11}
            className="animate-spin"
            aria-hidden="true"
            style={{
              color: "var(--mc-cyan-400, #22D3DB)",
              opacity: 0.5,
              marginLeft: "auto",
            }}
          />
        )}
      </div>
      <span
        style={{
          color: "var(--mc-fg-3, #6B6560)",
          fontSize: 10,
          letterSpacing: "0.12em",
        }}
      >
        OPEN /SYSTEM →
      </span>
    </Link>
  );
}

export default SystemHealthStrip;
