import React, { useEffect, useMemo, useState } from "react";
import {
  Activity, AlertCircle, Cpu, HardDrive, Network, Server,
  MemoryStick, Search, Package, AppWindow, RefreshCw,
} from "lucide-react";
import { C } from "@/lib/constants";
import { useGateway } from "@/lib/useGateway";

// ── helpers ──────────────────────────────────────────────────────────
function relativeTime(ts) {
  if (!ts) return "—";
  const secs = Math.max(0, Math.round((Date.now() - ts) / 1000));
  if (secs < 5) return "just now";
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  return `${Math.round(mins / 60)}h ago`;
}

function fmtUptime(seconds) {
  if (!seconds && seconds !== 0) return "—";
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function fmtBytes(bytes) {
  if (bytes == null) return "—";
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let v = bytes / 1024, i = 0;
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(v >= 100 ? 0 : 1)} ${units[i]}`;
}

function fmtBytesPerSec(bps) {
  if (bps == null) return "—";  // null means "no data yet" — never render 0
  return `${fmtBytes(bps)}/s`;
}

// Map backend service status enum → existing C palette colour.
function statusColor(status) {
  switch (status) {
    case "connected":    return C.green;
    case "disconnected": return C.red;
    case "rate_limited": return C.yellow;
    case "auth_failed":  return C.orange;
    case "corrupted":    return C.red;
    case "locked":       return C.yellow;
    default:             return C.muted;
  }
}

// Normalise the stats payload — the backend currently emits the
// API_CONTRACT.md shape { cpu, memory, disk, network, uptime, takenAt }.
// BACKEND_REQUESTS.md proposed a flatter shape; if backend ever ships that,
// these accessors fall back gracefully.
function normaliseStats(s) {
  if (!s) return null;
  const cpuPct =
    typeof s?.cpu?.utilisation1m === "number" ? s.cpu.utilisation1m * 100
    : typeof s?.cpu?.pct === "number" ? s.cpu.pct
    : null;
  const cores = s?.cpu?.cores ?? null;
  const load = s?.cpu?.loadAvg
    ? [s.cpu.loadAvg["1"], s.cpu.loadAvg["5"], s.cpu.loadAvg["15"]]
    : [s?.cpu?.load1, s?.cpu?.load5, s?.cpu?.load15];
  const ramUsedBytes = s?.memory?.usedBytes ?? null;
  const ramTotalBytes = s?.memory?.totalBytes ?? null;
  const ramPct = s?.memory?.usedPercent ?? (
    ramUsedBytes && ramTotalBytes ? (ramUsedBytes / ramTotalBytes) * 100 : null
  );
  const ramUsedGB = s?.ram?.usedGB ?? (ramUsedBytes != null ? ramUsedBytes / 1e9 : null);
  const ramTotalGB = s?.ram?.totalGB ?? (ramTotalBytes != null ? ramTotalBytes / 1e9 : null);

  const diskUsedBytes = s?.disk?.usedBytes ?? null;
  const diskTotalBytes = s?.disk?.totalBytes ?? null;
  const diskPct = s?.disk?.usedPercent ?? (
    diskUsedBytes && diskTotalBytes ? (diskUsedBytes / diskTotalBytes) * 100 : null
  );
  const diskUsedGB = s?.disk?.usedGB ?? (diskUsedBytes != null ? diskUsedBytes / 1e9 : null);
  const diskTotalGB = s?.disk?.totalGB ?? (diskTotalBytes != null ? diskTotalBytes / 1e9 : null);
  const diskNull = s?.disk === null || (diskUsedBytes == null && diskTotalBytes == null && s?.disk?.usedGB == null);

  // Pick the primary external interface (en0 first, else first non-loopback).
  let primaryIface = null;
  const ifaces = Array.isArray(s?.network?.interfaces) ? s.network.interfaces : [];
  if (ifaces.length) {
    primaryIface =
      ifaces.find(i => i.name === "en0")
      || ifaces.find(i => i.name && !i.name.startsWith("lo"))
      || ifaces[0];
  }
  const rxBps = s?.network?.rxMBps != null ? s.network.rxMBps * 1e6 : primaryIface?.rxBytesPerSec ?? null;
  const txBps = s?.network?.txMBps != null ? s.network.txMBps * 1e6 : primaryIface?.txBytesPerSec ?? null;

  return {
    cpuPct, cores, load,
    ramUsedBytes, ramTotalBytes, ramPct, ramUsedGB, ramTotalGB,
    diskUsedBytes, diskTotalBytes, diskPct, diskUsedGB, diskTotalGB, diskNull,
    rxBps, txBps,
    ifaceName: primaryIface?.name ?? null,
    uptime: s?.uptime ?? s?.uptime_seconds ?? null,
  };
}

// Hide installer/uninstaller and helper apps in the Apps tab — these
// pollute the catalog with Adobe junk. Kept in state but skipped at render.
function isAppHidden(app) {
  const path = app?.path || "";
  const name = app?.name || "";
  if (/\/Adobe\/Uninstall/i.test(path)) return true;
  if (/\/Adobe\/.*Installer/i.test(path)) return true;
  if (/Helper(\s|\.)/i.test(name)) return true;
  if (/Helper\.app$/i.test(path)) return true;
  return false;
}

// ── progress bar ────────────────────────────────────────────────────
function Bar({ pct, color, height = 6 }) {
  const v = Math.max(0, Math.min(100, pct ?? 0));
  return (
    <div className="rounded-full overflow-hidden" style={{ height, background: C.surface2 }}>
      <div className="h-full transition-all"
           style={{ width: `${v}%`, background: color, boxShadow: `0 0 8px ${color}55` }} />
    </div>
  );
}

// ── Hardware tab ──────────────────────────────────────────────────���──
function HardwareTab() {
  const { systemStats, systemStatsLoading, systemStatsError,
          systemStatsLastUpdated, fetchSystemStats } = useGateway();

  // 3s poll, paused on hidden, per BACKEND_REQUESTS.md.
  useEffect(() => {
    let cancelled = false;
    const tick = (silent) => {
      if (cancelled) return;
      if (document.visibilityState !== "visible") return;
      fetchSystemStats({ silent }).catch(() => null);
    };
    tick(false);
    const id = setInterval(() => tick(true), 3000);
    const onVis = () => { if (document.visibilityState === "visible") tick(true); };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      cancelled = true;
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [fetchSystemStats]);

  const s = useMemo(() => normaliseStats(systemStats), [systemStats]);

  const meta = systemStatsError
    ? <span style={{ color: C.red }}>error · {systemStatsError}</span>
    : systemStatsLoading && !systemStats
      ? "loading…"
      : `updated ${relativeTime(systemStatsLastUpdated)}`;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between text-[11px]" style={{ color: C.muted }}>
        <span>Real-time monitoring of host resources. 3s poll, paused when tab hidden.</span>
        <span>{meta}</span>
      </div>

      {!s && !systemStatsError && (
        <div className="text-[12px] p-3 rounded-lg" style={{ color: C.muted, background: C.surface2 }}>
          Loading host stats…
        </div>
      )}

      {s && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* CPU */}
          <div className="p-4 rounded-xl" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2">
                <Cpu className="w-4 h-4" style={{ color: C.accent }} />
                <div>
                  <div className="text-[13px] font-semibold">CPU</div>
                  <div className="text-[11px]" style={{ color: C.muted }}>{s.cores ?? "—"} cores</div>
                </div>
              </div>
              <div className="text-2xl font-semibold tabular-nums"
                   style={{ color: s.cpuPct != null && s.cpuPct > 80 ? C.red : C.text }}>
                {s.cpuPct != null ? `${s.cpuPct.toFixed(0)}%` : "—"}
              </div>
            </div>
            <Bar pct={s.cpuPct} color={s.cpuPct != null && s.cpuPct > 80 ? C.red : C.green} />
            <div className="flex justify-between text-[11px] mt-2" style={{ color: C.muted }}>
              <span>Load Average</span>
              <span className="font-mono tabular-nums">
                {s.load.map(v => v != null ? v.toFixed(2) : "—").join(" / ")}
              </span>
            </div>
          </div>

          {/* RAM */}
          <div className="p-4 rounded-xl" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2">
                <MemoryStick className="w-4 h-4" style={{ color: C.accent }} />
                <div>
                  <div className="text-[13px] font-semibold">RAM</div>
                  <div className="text-[11px]" style={{ color: C.muted }}>
                    {s.ramUsedGB != null && s.ramTotalGB != null
                      ? `${s.ramUsedGB.toFixed(1)}GB / ${s.ramTotalGB.toFixed(1)}GB`
                      : "—"}
                  </div>
                </div>
              </div>
              <div className="text-2xl font-semibold tabular-nums"
                   style={{ color: s.ramPct != null && s.ramPct > 85 ? C.red : C.text }}>
                {s.ramPct != null ? `${s.ramPct.toFixed(0)}%` : "—"}
              </div>
            </div>
            <Bar pct={s.ramPct} color={s.ramPct != null && s.ramPct > 85 ? C.red : C.green} />
            <div className="flex justify-between text-[11px] mt-2" style={{ color: C.muted }}>
              <span>Uptime</span>
              <span className="font-mono">{fmtUptime(s.uptime)}</span>
            </div>
          </div>

          {/* Disk */}
          <div className="p-4 rounded-xl" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2">
                <HardDrive className="w-4 h-4" style={{ color: C.accent }} />
                <div>
                  <div className="text-[13px] font-semibold">Disk</div>
                  <div className="text-[11px]" style={{ color: C.muted }}>
                    {s.diskNull
                      ? "df unavailable"
                      : s.diskUsedGB != null && s.diskTotalGB != null
                        ? `${s.diskUsedGB.toFixed(0)}GB / ${s.diskTotalGB.toFixed(0)}GB`
                        : "—"}
                  </div>
                </div>
              </div>
              <div className="text-2xl font-semibold tabular-nums"
                   style={{ color: s.diskPct != null && s.diskPct > 90 ? C.red : C.text }}>
                {s.diskNull || s.diskPct == null ? "—" : `${s.diskPct.toFixed(0)}%`}
              </div>
            </div>
            <Bar pct={s.diskNull ? 0 : s.diskPct} color={s.diskPct != null && s.diskPct > 90 ? C.red : C.green} />
            {s.diskNull && (
              <div className="text-[11px] mt-2" style={{ color: C.muted }}>
                Disk usage unavailable (df probe failed or timed out).
              </div>
            )}
          </div>

          {/* Network */}
          <div className="p-4 rounded-xl" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2">
                <Network className="w-4 h-4" style={{ color: C.accent }} />
                <div>
                  <div className="text-[13px] font-semibold">Network</div>
                  <div className="text-[11px]" style={{ color: C.muted }}>
                    {s.ifaceName ? `Live I/O · ${s.ifaceName}` : "Live I/O"}
                  </div>
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[12px]" style={{ color: C.muted }}>↓ RX (in)</span>
                <span className="text-[13px] font-mono tabular-nums" style={{ color: C.text }}>
                  {fmtBytesPerSec(s.rxBps)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[12px]" style={{ color: C.muted }}>↑ TX (out)</span>
                <span className="text-[13px] font-mono tabular-nums" style={{ color: C.text }}>
                  {fmtBytesPerSec(s.txBps)}
                </span>
              </div>
              {(s.rxBps == null && s.txBps == null) && (
                <div className="text-[11px] pt-1" style={{ color: C.muted }}>
                  No baseline yet — rates appear on next poll.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Services tab ────────────────────────────────────��────────────────
function ServicesTab() {
  const { systemServices, systemServicesLoading, systemServicesError,
          systemServicesLastUpdated, fetchSystemServices } = useGateway();

  // 5s poll (BACKEND_REQUESTS.md: server cache 5s, FE 8s on dashboard,
  // tighter 5s here since this tab is the focus). Visibility-paused.
  useEffect(() => {
    let cancelled = false;
    const tick = (silent) => {
      if (cancelled) return;
      if (document.visibilityState !== "visible") return;
      fetchSystemServices({ silent }).catch(() => null);
    };
    tick(false);
    const id = setInterval(() => tick(true), 5000);
    const onVis = () => { if (document.visibilityState === "visible") tick(true); };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      cancelled = true;
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [fetchSystemServices]);

  const meta = systemServicesError
    ? <span style={{ color: C.red }}>error · {systemServicesError}</span>
    : systemServicesLoading && systemServices.length === 0
      ? "loading…"
      : `updated ${relativeTime(systemServicesLastUpdated)}`;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between text-[11px]" style={{ color: C.muted }}>
        <span>Backend service health. 5s poll, paused when tab hidden.</span>
        <span>{meta}</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {systemServices.length === 0 && !systemServicesLoading && !systemServicesError && (
          <div className="md:col-span-2 text-[12px] p-3 rounded-lg" style={{ color: C.muted, background: C.surface2 }}>
            No services reported.
          </div>
        )}
        {systemServices.map((svc) => {
          const color = statusColor(svc.status);
          const corrupted = svc.status === "corrupted";
          const detail = svc.detail || svc.url || "";
          return (
            <div key={svc.name} className="p-3 rounded-xl"
                 style={{ background: C.surface, border: `1px solid ${C.border}` }}>
              <div className="flex items-center gap-3 mb-1">
                <span className="shrink-0 rounded-full" style={{ width: 8, height: 8, background: color }} />
                <span className="text-[13px] font-semibold capitalize" style={{ color: C.text }}>
                  {svc.name}
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-md uppercase tracking-wide ml-auto inline-flex items-center gap-1"
                      style={{ background: `${color}20`, color, border: `1px solid ${color}33` }}>
                  {corrupted && <AlertCircle className="w-3 h-3" />}
                  {svc.status || "unknown"}
                </span>
              </div>
              <div className="text-[11px] truncate" style={{ color: C.muted }} title={detail}>
                {detail || <span style={{ opacity: 0.6 }}>—</span>}
              </div>
              <div className="flex items-center justify-between text-[10px] font-mono mt-2" style={{ color: C.muted }}>
                <span>{svc.url || ""}</span>
                <span>checked {relativeTime(svc.lastCheck)}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Apps tab ─────────────────────────────────────────────────────────
function AppsTab() {
  const { systemApps, systemAppsCount, systemAppsLoading, systemAppsError,
          systemAppsLastUpdated, fetchSystemApps } = useGateway();
  const [query, setQuery] = useState("");

  // Fetch once on mount; user can refresh manually.
  // Backend caches 5min so re-fetches are cheap.
  useEffect(() => {
    fetchSystemApps({ silent: false }).catch(() => null);
  }, [fetchSystemApps]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (systemApps || []).filter((app) => {
      if (isAppHidden(app)) return false;
      if (!q) return true;
      return (app.name || "").toLowerCase().includes(q)
          || (app.path || "").toLowerCase().includes(q);
    });
  }, [systemApps, query]);

  const grouped = useMemo(() => {
    const buckets = {};
    for (const app of visible) {
      const cat = app.category || "Other";
      (buckets[cat] = buckets[cat] || []).push(app);
    }
    // Stable category order, matching backend's first-match list.
    const order = ["Browser", "Communication", "Creative", "Developer", "Productivity", "System", "Other"];
    return order
      .filter(cat => buckets[cat]?.length)
      .map(cat => [cat, buckets[cat]]);
  }, [visible]);

  const hiddenCount = (systemApps || []).filter(isAppHidden).length;
  const meta = systemAppsError
    ? <span style={{ color: C.red }}>error · {systemAppsError}</span>
    : systemAppsLoading && systemApps.length === 0
      ? "loading…"
      : `${visible.length} of ${systemAppsCount} shown · updated ${relativeTime(systemAppsLastUpdated)}`;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-1 max-w-md px-3 py-2 rounded-lg"
             style={{ background: C.surface, border: `1px solid ${C.border}` }}>
          <Search className="w-3.5 h-3.5 shrink-0" style={{ color: C.muted }} />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search apps by name or path…"
            className="bg-transparent outline-none text-[13px] flex-1"
            style={{ color: C.text }}
            data-testid="system-apps-search"
          />
        </div>
        <button
          onClick={() => fetchSystemApps({ silent: false }).catch(() => null)}
          disabled={systemAppsLoading}
          className="flex items-center gap-1.5 text-[11px] px-3 py-2 rounded-lg transition-colors"
          style={{ background: C.surface, border: `1px solid ${C.border}`, color: C.muted, opacity: systemAppsLoading ? 0.5 : 1 }}
          data-testid="system-apps-refresh">
          <RefreshCw className={`w-3 h-3 ${systemAppsLoading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      <div className="text-[11px] flex items-center justify-between" style={{ color: C.muted }}>
        <span>
          Mac · {hiddenCount > 0 && <span>{hiddenCount} helpers/installers hidden · </span>}
          backend cache 5 min
        </span>
        <span>{meta}</span>
      </div>

      {systemAppsLoading && systemApps.length === 0 && (
        <div className="text-[12px] p-3 rounded-lg" style={{ color: C.muted, background: C.surface2 }}>
          Loading installed apps (cold cache ~2s)…
        </div>
      )}

      {grouped.length === 0 && !systemAppsLoading && !systemAppsError && (
        <div className="text-[12px] p-3 rounded-lg" style={{ color: C.muted, background: C.surface2 }}>
          {query ? "No apps match that search." : "No apps reported."}
        </div>
      )}

      <div className="space-y-5">
        {grouped.map(([category, apps]) => (
          <div key={category}>
            <div className="flex items-center justify-between mb-2 px-1">
              <div className="text-[11px] uppercase tracking-[0.18em] font-semibold" style={{ color: C.muted }}>
                {category}
              </div>
              <div className="text-[11px]" style={{ color: C.muted }}>
                {apps.length}
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {apps.map((app) => (
                <div key={`${category}-${app.path || app.name}`}
                     className="px-3 py-2 rounded-lg flex items-center gap-2.5"
                     style={{ background: C.surface, border: `1px solid ${C.border}` }}
                     title={app.path}>
                  <AppWindow className="w-3.5 h-3.5 shrink-0" style={{ color: C.muted }} />
                  <div className="flex-1 min-w-0">
                    <div className="text-[12px] truncate" style={{ color: C.text }}>{app.name}</div>
                    <div className="text-[10px] truncate font-mono" style={{ color: C.muted }}>
                      {app.version ? `v${app.version}` : ""}
                      {app.version && app.path ? " · " : ""}
                      {app.path ? app.path.replace(/^.*\/Applications\//, "/Applications/") : ""}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Page shell ───────────────────────────────────────────────────────
const TABS = [
  { id: "hardware", label: "Hardware", icon: Activity },
  { id: "services", label: "Services", icon: Server },
  { id: "apps",     label: "Apps",     icon: Package  },
];

export default function SystemPage() {
  const [tab, setTab] = useState("hardware");

  return (
    <div className="h-full flex flex-col" style={{ color: C.text }}>
      <div className="flex-1 overflow-y-auto">
        <div className="p-6 space-y-5 max-w-6xl mx-auto">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">System Monitor</h1>
            <p className="text-sm" style={{ color: C.muted }}>
              Real-time host telemetry, backend service health, and the installed-app catalog.
            </p>
          </div>

          {/* Tab strip */}
          <div className="inline-flex items-center gap-1 p-1 rounded-lg"
               style={{ background: C.surface, border: `1px solid ${C.border}` }}>
            {TABS.map((t) => {
              const active = tab === t.id;
              const Icon = t.icon;
              return (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-md text-[12px] font-medium transition-colors"
                  style={{
                    background: active ? C.accent + "22" : "transparent",
                    color: active ? C.text : C.muted,
                    border: `1px solid ${active ? C.accent + "44" : "transparent"}`,
                  }}
                  data-testid={`system-tab-${t.id}`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {t.label}
                </button>
              );
            })}
          </div>

          {tab === "hardware" && <HardwareTab />}
          {tab === "services" && <ServicesTab />}
          {tab === "apps"     && <AppsTab     />}
        </div>
      </div>
    </div>
  );
}
