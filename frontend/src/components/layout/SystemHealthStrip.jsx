/**
 * SystemHealthStrip — Mietorè system health surface (SHELL)
 *
 * P1 visual-mirror surface from MASTER_PLAN.md. This is the structural
 * shell ONLY — built by MC FE Builder. Live data wiring (WS frames,
 * /api/v2/system/health endpoints, port probes, fix[] actions) is the
 * responsibility of MC FE Wiring in a follow-up.
 *
 * Non-coder test: replaces `lsof -nP -iTCP:8765` and tailing log files.
 * Meg sees port + service state visually, without a terminal.
 *
 * Theme: locked Mietorè tokens — warm-black #0A0807, gold #D9A24C,
 * cyan #22D3DB, hairline gold borders, glassmorphism backdrop.
 *
 * No localStorage. No mock data — empty/unknown state is rendered
 * explicitly so the wiring layer can drop real probes in.
 */
import React, { useMemo } from "react";
import {
  Activity,
  CheckCircle2,
  AlertOctagon,
  AlertTriangle,
  Loader2,
  Cpu,
  Plug,
  Radio,
  ServerCog,
} from "lucide-react";
import { useGateway } from "@/lib/useGateway";

const STATE_STYLE = {
  ok:      { color: "var(--mc-ok)",   bg: "var(--mc-ok-soft)",   Icon: CheckCircle2 },
  warn:    { color: "var(--mc-warn)", bg: "var(--mc-warn-soft)", Icon: AlertTriangle },
  err:     { color: "var(--mc-err)",  bg: "var(--mc-err-soft)",  Icon: AlertOctagon },
  loading: { color: "var(--mc-fg-2)", bg: "transparent",         Icon: Loader2 },
  unknown: { color: "var(--mc-fg-2)", bg: "transparent",         Icon: Activity },
};

function pickGatewayState(status) {
  if (status === "connected") return "ok";
  if (status === "connecting" || status === "reconnecting") return "loading";
  if (status === "error" || status === "disconnected") return "err";
  return "unknown";
}

function HealthPill({ label, state, detail, Glyph }) {
  const style = STATE_STYLE[state] || STATE_STYLE.unknown;
  const Icon = Glyph || style.Icon;
  return (
    <div
      data-testid={`system-health-pill-${label.toLowerCase().replace(/\s+/g, "-")}`}
      className="flex items-center gap-1.5 rounded-full"
      style={{
        padding: "4px 10px",
        background: style.bg,
        border: `1px solid color-mix(in srgb, ${style.color} 28%, transparent)`,
        fontSize: 11,
        color: style.color,
        letterSpacing: 0.2,
        whiteSpace: "nowrap",
      }}
      title={detail || label}
    >
      <Icon
        size={12}
        strokeWidth={2}
        className={state === "loading" ? "animate-spin" : ""}
        aria-hidden="true"
      />
      <span style={{ fontWeight: 600 }}>{label}</span>
      {detail && (
        <span style={{ color: "var(--mc-fg-2)", fontWeight: 400 }}>· {detail}</span>
      )}
    </div>
  );
}

/**
 * SystemHealthStrip
 *
 * Slim horizontal strip (28px tall) suitable for header/footer placement.
 * Renders four service pills:
 *   - Gateway WS    (already in-store via useGateway().status)
 *   - FastAPI :8765 (placeholder — wiring populates from /api/v2/system/health)
 *   - Express :7801 (placeholder — wiring populates from brain/router probe)
 *   - Brain Router  (placeholder — wiring populates from router insights)
 *
 * Props:
 *   compact     boolean — denser variant for nested headers
 *   className   string  — additional class hooks for layout consumers
 */
export function SystemHealthStrip({ compact = false, className = "" }) {
  const status = useGateway((s) => s.status);

  const services = useMemo(
    () => [
      {
        key: "gateway",
        label: "Gateway",
        state: pickGatewayState(status),
        detail: status || "unknown",
        Glyph: Radio,
      },
      {
        key: "fastapi",
        label: "API :8765",
        state: "unknown",
        detail: "awaiting probe",
        Glyph: ServerCog,
      },
      {
        key: "express",
        label: "Brain :7801",
        state: "unknown",
        detail: "awaiting probe",
        Glyph: Cpu,
      },
      {
        key: "router",
        label: "Router",
        state: "unknown",
        detail: "awaiting probe",
        Glyph: Plug,
      },
    ],
    [status]
  );

  return (
    <div
      data-testid="system-health-strip"
      className={`flex items-center gap-2 ${className}`}
      style={{
        height: compact ? 26 : 32,
        padding: compact ? "0 8px" : "0 14px",
        background: "var(--mc-bg-overlay)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        borderTop: "1px solid var(--mc-line)",
        borderBottom: "1px solid var(--mc-line)",
        fontFamily: "var(--mc-font-sans)",
        overflowX: "auto",
      }}
      aria-label="System health strip"
    >
      <span
        style={{
          fontSize: 9,
          letterSpacing: 1.4,
          textTransform: "uppercase",
          color: "var(--mc-fg-3)",
          marginRight: 4,
          flexShrink: 0,
        }}
      >
        System
      </span>
      {services.map((svc) => (
        <HealthPill
          key={svc.key}
          label={svc.label}
          state={svc.state}
          detail={svc.detail}
          Glyph={svc.Glyph}
        />
      ))}
    </div>
  );
}

export default SystemHealthStrip;
