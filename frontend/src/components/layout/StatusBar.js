import React, { useEffect, useMemo } from "react";
import { useLocation } from "react-router-dom";
import { Cpu, MemoryStick, HardDrive, Activity, Clock, Server } from "lucide-react";
import { C } from "@/lib/constants";
import { useGateway } from "@/lib/useGateway";

// Footer status bar — mounted by Layout, visible on every page.
//
// Reuses the same systemStats / systemServices slices that /system polls.
// On /system the page polls fast (3s/5s); the footer here polls slowly
// (10s for stats, 15s for services). Both write to the same store, so
// the *more frequent* poller wins — this footer becomes free when /system
// is open, and keeps things ambient-fresh elsewhere.
//
// Hidden on /system (the same data is rendered above in card form there —
// duplication adds noise without information).

function fmtPct(v) { return v == null ? "—" : `${Math.round(v)}%`; }
function fmtUptime(seconds) {
  if (!seconds && seconds !== 0) return "—";
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function pickCpuPct(stats) {
  if (!stats) return null;
  if (typeof stats?.cpu?.utilisation1m === "number") return stats.cpu.utilisation1m * 100;
  if (typeof stats?.cpu?.pct === "number") return stats.cpu.pct;
  return null;
}
function pickRamPct(stats) {
  if (!stats) return null;
  if (typeof stats?.memory?.usedPercent === "number") return stats.memory.usedPercent;
  const used = stats?.memory?.usedBytes;
  const total = stats?.memory?.totalBytes;
  if (used != null && total) return (used / total) * 100;
  if (stats?.ram?.usedGB != null && stats?.ram?.totalGB) {
    return (stats.ram.usedGB / stats.ram.totalGB) * 100;
  }
  return null;
}
function pickRamLabel(stats) {
  const used = stats?.ram?.usedGB ?? (stats?.memory?.usedBytes != null ? stats.memory.usedBytes / 1e9 : null);
  const total = stats?.ram?.totalGB ?? (stats?.memory?.totalBytes != null ? stats.memory.totalBytes / 1e9 : null);
  if (used == null || total == null) return null;
  return `${used.toFixed(1)}/${total.toFixed(1)}GB`;
}
function pickDiskPct(stats) {
  if (!stats) return null;
  if (stats?.disk === null) return null;
  if (typeof stats?.disk?.usedPercent === "number") return stats.disk.usedPercent;
  const used = stats?.disk?.usedBytes;
  const total = stats?.disk?.totalBytes;
  if (used != null && total) return (used / total) * 100;
  if (stats?.disk?.usedGB != null && stats?.disk?.totalGB) {
    return (stats.disk.usedGB / stats.disk.totalGB) * 100;
  }
  return null;
}
function pickUptime(stats) {
  return stats?.uptime ?? stats?.uptime_seconds ?? null;
}

function statusColor(s) {
  switch (s) {
    case "connected":    return C.green;
    case "rate_limited": return C.yellow;
    case "auth_failed":  return C.orange;
    case "locked":       return C.yellow;
    case "corrupted":    return C.red;
    case "disconnected": return C.red;
    default:             return C.muted;
  }
}

function Pill({ icon: Icon, label, value, color, danger }) {
  const tone = danger ? C.red : color || C.muted;
  return (
    <div className="flex items-center gap-1.5 shrink-0" title={label}>
      <Icon className="w-3 h-3" style={{ color: tone }} />
      <span className="text-[10px] uppercase tracking-wide" style={{ color: C.muted }}>
        {label}
      </span>
      <span className="text-[11px] font-mono tabular-nums" style={{ color: danger ? C.red : C.text }}>
        {value}
      </span>
    </div>
  );
}

export default function StatusBar() {
  const location = useLocation();

  const {
    systemStats, fetchSystemStats,
    systemServices, fetchSystemServices,
  } = useGateway();

  // Slow poll — only ambient. /system page polls faster and writes to the
  // same slice, so when it's open the footer rides those updates for free.
  useEffect(() => {
    let cancelled = false;
    const tickStats    = () => { if (!cancelled && document.visibilityState === "visible") fetchSystemStats({ silent: true }).catch(() => null); };
    const tickServices = () => { if (!cancelled && document.visibilityState === "visible") fetchSystemServices({ silent: true }).catch(() => null); };
    // Initial fetch only if nothing else has loaded yet — avoids a duplicate
    // request when /system is the landing page.
    if (!systemStats) tickStats();
    if (!systemServices.length) tickServices();
    const idStats = setInterval(tickStats, 10000);
    const idSvc   = setInterval(tickServices, 15000);
    return () => {
      cancelled = true;
      clearInterval(idStats);
      clearInterval(idSvc);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Hide on /system — redundant.
  if (location.pathname === "/system") return null;

  const cpuPct  = pickCpuPct(systemStats);
  const ramPct  = pickRamPct(systemStats);
  const ramLbl  = pickRamLabel(systemStats);
  const diskPct = pickDiskPct(systemStats);
  const uptime  = pickUptime(systemStats);

  // Service summary
  const total     = systemServices.length;
  const connected = systemServices.filter(s => s.status === "connected").length;
  const tailscale = systemServices.find(s => s.name === "tailscale");
  const tsColor   = statusColor(tailscale?.status);
  const tsActive  = tailscale?.status === "connected";

  // Worst-status colour for the SVC pill
  const svcDanger = total > 0 && connected < total;

  return (
    <div
      className="shrink-0 flex items-center gap-4 px-4 py-1.5 text-[11px] overflow-x-auto"
      style={{
        borderTop: `1px solid ${C.border}`,
        background: "rgba(10,10,10,0.85)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
      }}
      data-testid="status-bar"
    >
      <Pill
        icon={Cpu}
        label="CPU"
        value={fmtPct(cpuPct)}
        danger={cpuPct != null && cpuPct > 80}
      />
      <Pill
        icon={MemoryStick}
        label="RAM"
        value={ramLbl ? `${ramLbl} (${fmtPct(ramPct)})` : fmtPct(ramPct)}
        danger={ramPct != null && ramPct > 85}
      />
      <Pill
        icon={HardDrive}
        label="DISK"
        value={fmtPct(diskPct)}
        danger={diskPct != null && diskPct > 90}
      />

      {/* Tailscale */}
      <div className="flex items-center gap-1.5 shrink-0" title={`Tailscale ${tailscale?.status || "unknown"}`}>
        <span className="rounded-full" style={{ width: 6, height: 6, background: tsColor, opacity: tsActive ? 1 : 0.6 }} />
        <span className="text-[10px] uppercase tracking-wide" style={{ color: C.muted }}>TS</span>
      </div>

      {/* Service count */}
      <div className="flex items-center gap-1.5 shrink-0" title="Connected backend services">
        <Server className="w-3 h-3" style={{ color: svcDanger ? C.yellow : C.green }} />
        <span className="text-[10px] uppercase tracking-wide" style={{ color: C.muted }}>SVC</span>
        <span className="text-[11px] font-mono tabular-nums"
              style={{ color: svcDanger ? C.yellow : C.text }}>
          {total > 0 ? `${connected}/${total}` : "—"}
        </span>
      </div>

      <div className="flex-1" />

      <Pill icon={Clock} label="Uptime" value={fmtUptime(uptime)} />
    </div>
  );
}
