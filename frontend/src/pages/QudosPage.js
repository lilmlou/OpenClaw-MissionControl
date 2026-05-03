import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Activity, AlertTriangle, ArrowRight, Briefcase, Camera, Check, ChevronDown,
  ChevronRight, Eye, EyeOff, Hand, Layers, Loader2, Lock, Mic, MicOff, Monitor,
  MonitorPlay, Pause, Play, Plus, Power, ShieldAlert, ShieldCheck, Sparkles,
  Square, Wrench, X,
} from "lucide-react";
import { C, DESKTOP_APP_GROUPS } from "@/lib/constants";
import { useGateway } from "@/lib/useGateway";
import { Toggle } from "@/components/shared";

/**
 * QudosPage
 * ---------------------------------------------------------------------------
 * Co-pilot control surface. Six sections from the Cowork specification:
 *   1. Active Workspace (focused app + permissions + session controls)
 *   2. App Connectors Grid (Adobe / Microsoft / Google / Other)
 *   3. Active Sessions (links to Jobs + Events)
 *   4. Floating Overlay Settings
 *   5. Suggestions Feed
 *   6. Permissions / Privacy
 *
 * UI is wired to the qudos* slice in useGateway. Every session/suggestion
 * also pushes into `jobs` and emits `events`, so /jobs and /events surface
 * the same activity. Backend bridges (screen capture, accessibility) are
 * marked TODO; swap the local handlers for fetch() calls when ready.
 */

const PERMISSION_ROWS = [
  { key: "screenRecording", label: "Screen Recording", required: true,  hint: "Required for watching the active app window." },
  { key: "accessibility",   label: "Accessibility",   required: true,  hint: "Required for moving the mouse, typing, or running menu items." },
  { key: "microphone",      label: "Microphone",      required: false, hint: "Optional — used for voice-driven sessions." },
  { key: "camera",          label: "Camera",          required: false, hint: "Optional — reserved for future video tasks." },
];

const CAPABILITY_DEFS = [
  { key: "watch",   label: "Watch",       Icon: Eye,         hint: "Periodic screenshots of the active window for context." },
  { key: "suggest", label: "Suggest",     Icon: Sparkles,    hint: "Surface suggestions in the floating overlay." },
  { key: "act",     label: "Act",         Icon: Hand,        hint: "Click, type, run menu items via Accessibility API. Approval-gated." },
  { key: "launch",  label: "Launch",      Icon: MonitorPlay, hint: "Bring the assistant into the same window when you tap the overlay." },
];

const POSITIONS = [
  { value: "top-left",     label: "Top Left" },
  { value: "top-right",    label: "Top Right" },
  { value: "bottom-left",  label: "Bottom Left" },
  { value: "bottom-right", label: "Bottom Right" },
];
const RETENTIONS = [
  { value: "none", label: "Don't store" },
  { value: "24h",  label: "24 hours" },
  { value: "7d",   label: "7 days" },
  { value: "30d",  label: "30 days" },
];

function fmtAge(ts) {
  if (!ts) return "—";
  const diff = Date.now() - ts;
  if (diff < 60_000) return `${Math.max(1, Math.floor(diff / 1000))}s ago`;
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  return `${Math.floor(diff / 3_600_000)}h ago`;
}

function flattenApps() {
  return DESKTOP_APP_GROUPS.flatMap((g) =>
    g.apps.map((a) => ({ ...a, group: g.id, groupName: g.name, color: g.color }))
  );
}

function PermissionPill({ label, granted, missing, onClick }) {
  const color = missing ? "#ef4444" : granted ? "#22c55e" : "#94a3b8";
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-1.5 px-2 py-1 rounded-full text-[11px] font-medium transition-colors"
      style={{ background: `${color}1a`, color, border: `1px solid ${color}40` }}
    >
      {missing ? <ShieldAlert className="w-3 h-3" /> : granted ? <ShieldCheck className="w-3 h-3" /> : <ShieldAlert className="w-3 h-3" />}
      {label}: {granted ? "ON" : "OFF"}
    </button>
  );
}

function SectionHeader({ icon: Icon, title, subtitle, right }) {
  return (
    <div className="flex items-end justify-between gap-3 mb-2">
      <div className="flex items-center gap-2 min-w-0">
        {Icon && <Icon className="w-4 h-4 shrink-0" style={{ color: C.accent }} />}
        <div className="min-w-0">
          <div className="text-sm font-semibold truncate">{title}</div>
          {subtitle && <div className="text-[11px] truncate" style={{ color: C.muted }}>{subtitle}</div>}
        </div>
      </div>
      {right}
    </div>
  );
}

function AppConnectorCard({ app, enabled, capabilities, onToggle, onCapToggle, excluded, onExclude, onLaunch }) {
  const Icon = app.icon;
  return (
    <div
      className="p-3 rounded-xl flex flex-col gap-2"
      style={{
        background: C.surface,
        border: `1px solid ${enabled ? `${app.color}55` : C.border}`,
        opacity: excluded ? 0.55 : 1,
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: `${app.color}1f`, border: `1px solid ${app.color}40` }}
          >
            <Icon className="w-4 h-4" style={{ color: app.color }} />
          </div>
          <div className="min-w-0">
            <div className="text-[12px] font-semibold truncate">{app.label}</div>
            <div className="text-[10px] truncate" style={{ color: C.muted }}>{app.groupName}</div>
          </div>
        </div>
        <Toggle on={enabled} onToggle={onToggle} />
      </div>

      <div className="flex flex-wrap gap-1">
        {CAPABILITY_DEFS.map((cap) => {
          const Cap = cap.Icon;
          const on = !!capabilities?.[cap.key];
          return (
            <button
              key={cap.key}
              type="button"
              disabled={!enabled || excluded}
              onClick={() => onCapToggle(cap.key, !on)}
              className="flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-medium transition-colors disabled:opacity-40"
              style={{
                background: on ? `${app.color}1f` : C.surface2,
                color: on ? app.color : C.muted,
                border: `1px solid ${on ? `${app.color}50` : C.border}`,
              }}
              title={cap.hint}
            >
              <Cap className="w-3 h-3" /> {cap.label}
            </button>
          );
        })}
      </div>

      <div className="flex items-center justify-between gap-2 mt-1">
        <button
          type="button"
          onClick={onExclude}
          className="text-[10px] inline-flex items-center gap-1"
          style={{ color: excluded ? "#ef4444" : C.muted }}
          title={excluded ? "Allow Qudos to watch this app" : "Never let Qudos watch this app"}
        >
          {excluded ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
          {excluded ? "Excluded" : "Watchable"}
        </button>
        <button
          type="button"
          disabled={!enabled || excluded}
          onClick={onLaunch}
          className="px-2 py-1 rounded-md text-[10px] font-medium flex items-center gap-1 disabled:opacity-40"
          style={{ background: app.color, color: "#fff" }}
        >
          <Play className="w-3 h-3" /> Start session
        </button>
      </div>
    </div>
  );
}

export default function QudosPage() {
  const navigate = useNavigate();
  const {
    qudosEnabledApps,
    qudosCapabilitiesByApp,
    qudosActiveAppId,
    qudosPermissions,
    qudosOverlay,
    qudosPrivacy,
    qudosSessions,
    qudosSuggestions,
    toggleQudosApp,
    setQudosCapability,
    setQudosPermission,
    setQudosActiveApp,
    updateQudosOverlay,
    updateQudosPrivacy,
    excludeQudosApp,
    pauseQudos,
    startQudosSession,
    pauseQudosSession,
    stopQudosSession,
    addQudosSuggestion,
    resolveQudosSuggestion,
    events,
    jobs,
  } = useGateway();

  const apps = useMemo(flattenApps, []);
  const [groupFilter, setGroupFilter] = useState("all");
  const [showAllSessions, setShowAllSessions] = useState(false);

  // Auto-pick a default active app once on mount if none set.
  useEffect(() => {
    if (!qudosActiveAppId && apps[0]) setQudosActiveApp(apps[0].id);
  }, [qudosActiveAppId, apps, setQudosActiveApp]);

  const activeApp = apps.find((a) => a.id === qudosActiveAppId) || apps[0];
  const ActiveAppIcon = activeApp?.icon || Monitor;

  const enabledCount = Object.keys(qudosEnabledApps || {}).length;
  const sessionsActive = qudosSessions.filter((s) => s.status === "running").length;
  const sessionsToShow = showAllSessions ? qudosSessions : qudosSessions.slice(0, 4);
  const visibleApps = groupFilter === "all" ? apps : apps.filter((a) => a.group === groupFilter);

  const recentEvents = useMemo(() => {
    if (!Array.isArray(events)) return [];
    return events.filter((e) => String(e.type || "").startsWith("qudos.")).slice(-8).reverse();
  }, [events]);

  const handleStart = (app) => {
    if (qudosPrivacy.paused) return;
    if (qudosPrivacy.excludeApps.includes(app.id)) return;
    const { sessionId, jobId } = startQudosSession(app.id, `Cowork in ${app.label}`, {});
    setQudosActiveApp(app.id);
    if (!qudosEnabledApps[app.id]) toggleQudosApp(app.id);
    // Drop a placeholder suggestion so the feed isn't empty on first start.
    addQudosSuggestion({
      sessionId,
      appId: app.id,
      text: `Qudos is now watching ${app.label}. Tap the overlay button to ask for help.`,
      severity: "info",
    });
    return jobId;
  };

  const handleAddSuggestion = () => {
    if (!activeApp) return;
    addQudosSuggestion({
      appId: activeApp.id,
      text: `Tip drafted while watching ${activeApp.label}.`,
      severity: "info",
    });
  };

  const renderActiveWorkspace = () => (
    <div className="p-4 rounded-xl" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
      <SectionHeader
        icon={Monitor}
        title="Active Workspace"
        subtitle={qudosPrivacy.paused ? "Qudos is paused — no app is being watched." : `Currently watching: ${activeApp?.label || "—"}`}
        right={(
          <button
            type="button"
            onClick={() => pauseQudos(!qudosPrivacy.paused)}
            className="px-2 py-1 rounded-md text-[11px] font-medium flex items-center gap-1"
            style={{
              background: qudosPrivacy.paused ? "rgba(239,68,68,0.14)" : "rgba(34,197,94,0.14)",
              color: qudosPrivacy.paused ? "#ef4444" : "#22c55e",
              border: `1px solid ${qudosPrivacy.paused ? "rgba(239,68,68,0.4)" : "rgba(34,197,94,0.4)"}`,
            }}
          >
            <Power className="w-3 h-3" /> {qudosPrivacy.paused ? "Resume Qudos" : "Pause Qudos"}
          </button>
        )}
      />

      <div className="grid grid-cols-1 md:grid-cols-[160px_minmax(0,1fr)] gap-3 mt-2">
        <div
          className="rounded-lg flex flex-col items-center justify-center gap-1 p-3"
          style={{ background: C.surface2, border: `1px solid ${C.border}`, minHeight: 110 }}
        >
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center"
            style={{ background: `${activeApp?.color || C.accent}1f`, border: `1px solid ${activeApp?.color || C.accent}40` }}
          >
            <ActiveAppIcon className="w-6 h-6" style={{ color: activeApp?.color || C.accent }} />
          </div>
          <div className="text-[11px] font-medium truncate">{activeApp?.label || "Choose an app"}</div>
          <div className="text-[10px]" style={{ color: C.muted }}>
            Screenshot preview: <span className="opacity-70">offline (bridge pending)</span>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            {PERMISSION_ROWS.map((row) => (
              <PermissionPill
                key={row.key}
                label={row.label}
                granted={!!qudosPermissions[row.key]}
                missing={row.required && !qudosPermissions[row.key]}
                onClick={() => setQudosPermission(row.key, !qudosPermissions[row.key])}
              />
            ))}
          </div>
          <div className="text-[11px]" style={{ color: C.muted }}>
            Toggle each pill to mark the macOS permission as granted on your device. The backend bridge will replace this with a real
            <code className="px-1 rounded mx-1" style={{ background: C.surface2 }}>tccutil</code>-style probe.
          </div>
          <div className="flex flex-wrap gap-2 pt-1">
            <button
              type="button"
              disabled={!activeApp || qudosPrivacy.paused}
              onClick={() => activeApp && handleStart(activeApp)}
              className="px-3 py-1.5 rounded-md text-[12px] font-medium flex items-center gap-1.5 disabled:opacity-40"
              style={{ background: C.accent, color: "#fff" }}
            >
              <Play className="w-3 h-3" /> Start session in {activeApp?.label || "app"}
            </button>
            <button
              type="button"
              onClick={handleAddSuggestion}
              className="px-3 py-1.5 rounded-md text-[12px] font-medium flex items-center gap-1.5"
              style={{ background: C.surface2, color: C.text, border: `1px solid ${C.border}` }}
            >
              <Sparkles className="w-3 h-3" /> Drop a test suggestion
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  const renderConnectorsGrid = () => (
    <div className="p-4 rounded-xl" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
      <SectionHeader
        icon={Layers}
        title="App Connectors"
        subtitle={`${enabledCount} enabled · ${apps.length} total`}
        right={(
          <select
            value={groupFilter}
            onChange={(e) => setGroupFilter(e.target.value)}
            className="rounded-md px-2 py-1 text-[11px] focus:outline-none"
            style={{ background: C.surface2, color: C.text, border: `1px solid ${C.border}` }}
          >
            <option value="all">All groups</option>
            {DESKTOP_APP_GROUPS.map((g) => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </select>
        )}
      />

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5 mt-2">
        {visibleApps.map((app) => (
          <AppConnectorCard
            key={app.id}
            app={app}
            enabled={!!qudosEnabledApps[app.id]}
            capabilities={qudosCapabilitiesByApp[app.id]}
            excluded={qudosPrivacy.excludeApps.includes(app.id)}
            onToggle={() => toggleQudosApp(app.id)}
            onCapToggle={(key, on) => setQudosCapability(app.id, key, on)}
            onExclude={() => excludeQudosApp(app.id)}
            onLaunch={() => handleStart(app)}
          />
        ))}
      </div>

      <div className="mt-3 text-[11px]" style={{ color: C.muted }}>
        Custom apps come from <Link to="/customize?tab=connectors" className="underline" style={{ color: C.accent }}>Customise → Connectors</Link>. Backend bridge will replace each toggle with a real launch/AX probe per app.
      </div>
    </div>
  );

  const renderSessions = () => (
    <div className="p-4 rounded-xl" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
      <SectionHeader
        icon={Briefcase}
        title="Active Sessions"
        subtitle={sessionsActive > 0 ? `${sessionsActive} running` : "No active sessions yet"}
        right={(
          <Link
            to="/jobs"
            className="text-[11px] flex items-center gap-1"
            style={{ color: C.accent }}
          >
            View on Jobs <ArrowRight className="w-3 h-3" />
          </Link>
        )}
      />

      {qudosSessions.length === 0 ? (
        <div className="text-[12px] py-4 text-center rounded-lg" style={{ color: C.muted, background: C.surface2 }}>
          Start a session from any app card above. Each session also creates a Job (visible on /jobs) and emits Events (visible on /events).
        </div>
      ) : (
        <div className="space-y-2">
          {sessionsToShow.map((session) => {
            const app = apps.find((a) => a.id === session.appId);
            const Icon = app?.icon || Sparkles;
            const statusColor = session.status === "running" ? "#fbbf24" : session.status === "paused" ? "#94a3b8" : "#22c55e";
            return (
              <div key={session.id} className="p-3 rounded-lg" style={{ background: C.surface2, border: `1px solid ${C.border}` }}>
                <div className="flex items-center gap-3">
                  <div
                    className="w-8 h-8 rounded-md flex items-center justify-center shrink-0"
                    style={{ background: `${app?.color || C.accent}1f`, border: `1px solid ${app?.color || C.accent}40` }}
                  >
                    <Icon className="w-4 h-4" style={{ color: app?.color || C.accent }} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[12px] font-semibold truncate">{session.task}</span>
                      <span
                        className="px-1.5 py-0.5 text-[9px] font-mono rounded uppercase tracking-wider"
                        style={{ background: `${statusColor}22`, color: statusColor, border: `1px solid ${statusColor}55` }}
                      >
                        {session.status}
                      </span>
                    </div>
                    <div className="text-[11px] truncate" style={{ color: C.muted }}>
                      {app?.label || session.appId || "—"} · {session.agent} · started {fmtAge(session.createdAt)}
                      {session.jobId && (
                        <>
                          {" · "}
                          <Link to="/jobs" className="underline" style={{ color: C.muted }}>job {session.jobId.slice(0, 6)}</Link>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {session.status !== "completed" && (
                      <button
                        type="button"
                        onClick={() => pauseQudosSession(session.id)}
                        className="w-7 h-7 rounded-md flex items-center justify-center"
                        style={{ background: C.surface, color: C.muted, border: `1px solid ${C.border}` }}
                        title={session.status === "paused" ? "Resume" : "Pause"}
                      >
                        {session.status === "paused" ? <Play className="w-3 h-3" /> : <Pause className="w-3 h-3" />}
                      </button>
                    )}
                    {session.status !== "completed" && (
                      <button
                        type="button"
                        onClick={() => stopQudosSession(session.id)}
                        className="w-7 h-7 rounded-md flex items-center justify-center"
                        style={{ background: "rgba(239,68,68,0.12)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.3)" }}
                        title="Stop session"
                      >
                        <Square className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
          {qudosSessions.length > 4 && (
            <button
              type="button"
              onClick={() => setShowAllSessions((v) => !v)}
              className="w-full text-[11px] py-1 rounded-md"
              style={{ background: C.surface2, color: C.muted, border: `1px solid ${C.border}` }}
            >
              {showAllSessions ? "Show fewer" : `Show all ${qudosSessions.length} sessions`}
            </button>
          )}
        </div>
      )}
    </div>
  );

  const renderOverlaySettings = () => (
    <div className="p-4 rounded-xl" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
      <SectionHeader
        icon={MonitorPlay}
        title="Floating Overlay"
        subtitle="Settings for the always-on Qudos button on the desktop."
        right={<Toggle on={qudosOverlay.enabled} onToggle={() => updateQudosOverlay({ enabled: !qudosOverlay.enabled })} />}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
        <div>
          <div className="text-[11px] font-medium mb-1" style={{ color: C.muted }}>Position</div>
          <div className="grid grid-cols-2 gap-1">
            {POSITIONS.map((p) => (
              <button
                key={p.value}
                type="button"
                onClick={() => updateQudosOverlay({ position: p.value })}
                disabled={!qudosOverlay.enabled}
                className="px-2 py-1 rounded-md text-[11px] disabled:opacity-40"
                style={{
                  background: qudosOverlay.position === p.value ? `${C.accent}22` : C.surface2,
                  color: qudosOverlay.position === p.value ? C.accent : C.muted,
                  border: `1px solid ${qudosOverlay.position === p.value ? `${C.accent}66` : C.border}`,
                }}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="text-[11px] font-medium mb-1" style={{ color: C.muted }}>Hotkey</div>
          <input
            value={qudosOverlay.hotkey}
            onChange={(e) => updateQudosOverlay({ hotkey: e.target.value })}
            disabled={!qudosOverlay.enabled}
            className="w-full px-2 py-1 rounded-md text-[12px] focus:outline-none disabled:opacity-40"
            style={{ background: C.surface2, color: C.text, border: `1px solid ${C.border}` }}
            placeholder="Option+Space"
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-medium" style={{ color: C.muted }}>Auto-hide (s)</span>
            <span className="text-[11px] font-mono">{(qudosOverlay.autoHideMs / 1000).toFixed(0)}s</span>
          </div>
          <input
            type="range"
            min={0}
            max={30}
            step={1}
            value={Math.round(qudosOverlay.autoHideMs / 1000)}
            disabled={!qudosOverlay.enabled}
            onChange={(e) => updateQudosOverlay({ autoHideMs: Number(e.target.value) * 1000 })}
            className="w-full disabled:opacity-40"
            style={{ accentColor: C.accent }}
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-medium" style={{ color: C.muted }}>Opacity</span>
            <span className="text-[11px] font-mono">{Math.round(qudosOverlay.opacity * 100)}%</span>
          </div>
          <input
            type="range"
            min={0.4}
            max={1}
            step={0.05}
            value={qudosOverlay.opacity}
            disabled={!qudosOverlay.enabled}
            onChange={(e) => updateQudosOverlay({ opacity: Number(e.target.value) })}
            className="w-full disabled:opacity-40"
            style={{ accentColor: C.accent }}
          />
        </div>
      </div>

      <div className="mt-3 text-[11px]" style={{ color: C.muted }}>
        The actual floating button is rendered by the macOS bridge (pending). Until then these settings are persisted locally so they apply the moment the bridge ships.
      </div>
    </div>
  );

  const renderSuggestions = () => (
    <div className="p-4 rounded-xl" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
      <SectionHeader
        icon={Sparkles}
        title="Suggestions Feed"
        subtitle={qudosSuggestions.length === 0 ? "Suggestions surface here when Qudos detects something useful." : `${qudosSuggestions.filter((s) => s.status === "pending").length} pending`}
        right={(
          <Link to="/events" className="text-[11px] flex items-center gap-1" style={{ color: C.accent }}>
            View on Events <ArrowRight className="w-3 h-3" />
          </Link>
        )}
      />

      {qudosSuggestions.length === 0 ? (
        <div className="text-[12px] py-4 text-center rounded-lg" style={{ color: C.muted, background: C.surface2 }}>
          Start a session from any app to see suggestions here.
        </div>
      ) : (
        <div className="space-y-2 max-h-[260px] overflow-auto pr-1">
          {qudosSuggestions.map((s) => {
            const app = apps.find((a) => a.id === s.appId);
            const isPending = s.status === "pending";
            return (
              <div key={s.id} className="p-2.5 rounded-lg flex items-start gap-3" style={{ background: C.surface2, border: `1px solid ${C.border}` }}>
                <Sparkles className="w-3.5 h-3.5 mt-0.5 shrink-0" style={{ color: app?.color || C.accent }} />
                <div className="min-w-0 flex-1">
                  <div className="text-[12px] truncate">{s.text}</div>
                  <div className="text-[10px] mt-0.5" style={{ color: C.muted }}>
                    {app?.label || "Qudos"} · {fmtAge(s.createdAt)} · {s.status}
                  </div>
                </div>
                {isPending ? (
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => resolveQudosSuggestion(s.id, "approved")}
                      className="px-2 py-0.5 rounded-md text-[10px] font-medium"
                      style={{ background: "rgba(34,197,94,0.14)", color: "#22c55e", border: "1px solid rgba(34,197,94,0.3)" }}
                    >
                      <Check className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => resolveQudosSuggestion(s.id, "dismissed")}
                      className="px-2 py-0.5 rounded-md text-[10px] font-medium"
                      style={{ background: C.surface, color: C.muted, border: `1px solid ${C.border}` }}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ) : (
                  <span
                    className="text-[9px] px-1.5 py-0.5 rounded uppercase tracking-wider shrink-0"
                    style={{
                      background: s.status === "approved" ? "rgba(34,197,94,0.14)" : "rgba(148,163,184,0.14)",
                      color: s.status === "approved" ? "#22c55e" : "#94a3b8",
                      border: `1px solid ${s.status === "approved" ? "rgba(34,197,94,0.35)" : "rgba(148,163,184,0.35)"}`,
                    }}
                  >
                    {s.status}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  const renderPrivacy = () => (
    <div className="p-4 rounded-xl" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
      <SectionHeader
        icon={Lock}
        title="Permissions & Privacy"
        subtitle="Decide what Qudos can see, save, and act on."
      />

      <div className="space-y-2 mt-2">
        <div>
          <div className="text-[11px] font-medium mb-1" style={{ color: C.muted }}>Screenshot retention</div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1">
            {RETENTIONS.map((r) => (
              <button
                key={r.value}
                type="button"
                onClick={() => updateQudosPrivacy({ retention: r.value })}
                className="px-2 py-1 rounded-md text-[11px]"
                style={{
                  background: qudosPrivacy.retention === r.value ? `${C.accent}22` : C.surface2,
                  color: qudosPrivacy.retention === r.value ? C.accent : C.muted,
                  border: `1px solid ${qudosPrivacy.retention === r.value ? `${C.accent}66` : C.border}`,
                }}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="text-[11px] font-medium mb-1" style={{ color: C.muted }}>Excluded apps ({qudosPrivacy.excludeApps.length})</div>
          {qudosPrivacy.excludeApps.length === 0 ? (
            <div className="text-[11px]" style={{ color: C.muted }}>No exclusions yet — Qudos can watch any enabled app.</div>
          ) : (
            <div className="flex flex-wrap gap-1">
              {qudosPrivacy.excludeApps.map((id) => {
                const app = apps.find((a) => a.id === id);
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => excludeQudosApp(id)}
                    className="text-[10px] px-2 py-0.5 rounded-full inline-flex items-center gap-1"
                    style={{ background: "rgba(239,68,68,0.14)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.35)" }}
                  >
                    <EyeOff className="w-3 h-3" /> {app?.label || id} <X className="w-3 h-3 opacity-70" />
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="text-[11px]" style={{ color: C.muted }}>
          Sensitive tags: {qudosPrivacy.sensitiveTags.join(", ")}. Backend bridge will refuse to capture any window whose bundle id matches these tags.
        </div>
      </div>
    </div>
  );

  const renderRecentEvents = () => (
    <div className="p-4 rounded-xl" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
      <SectionHeader
        icon={Activity}
        title="Recent Qudos Events"
        subtitle="Same data the Events page sees — useful as a quick verification that Jobs/Events are wired."
        right={(
          <Link to="/events" className="text-[11px] flex items-center gap-1" style={{ color: C.accent }}>
            Open Events <ArrowRight className="w-3 h-3" />
          </Link>
        )}
      />
      {recentEvents.length === 0 ? (
        <div className="text-[11px] py-3 text-center rounded-lg" style={{ color: C.muted, background: C.surface2 }}>
          No Qudos events yet. Start a session above and they'll appear here, on /events, and as Job entries on /jobs.
        </div>
      ) : (
        <div className="space-y-1 font-mono text-[11px] max-h-[180px] overflow-auto">
          {recentEvents.map((e) => (
            <div key={e.id} className="flex items-center gap-2 px-2 py-1 rounded" style={{ background: C.surface2 }}>
              <span style={{ color: C.muted }}>{new Date(e.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span>
              <span className="px-1 rounded" style={{ background: C.surface, color: C.accent }}>{e.type}</span>
              <span className="truncate" style={{ color: C.muted }}>
                {e.payload?.text || e.payload?.label || e.payload?.taskTitle || JSON.stringify(e.payload)?.slice(0, 60)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div className="h-full flex flex-col" style={{ color: C.text }}>
      <div className="flex-1 overflow-y-auto">
        <div className="p-6 space-y-4 max-w-6xl mx-auto">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Qudos</h1>
            <p className="text-sm" style={{ color: C.muted }}>
              AI co-pilot inside your desktop apps. Watch, suggest, and act with approval — wired to Agents, Jobs, and Events.
            </p>
          </div>

          {qudosPrivacy.paused && (
            <div className="p-3 rounded-lg flex items-center gap-2 text-[12px]" style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", color: "#ef4444" }}>
              <AlertTriangle className="w-3.5 h-3.5" />
              Qudos is paused. No watching, no suggestions, no actions.
              <button type="button" onClick={() => pauseQudos(false)} className="ml-auto text-[11px] underline">Resume</button>
            </div>
          )}

          {renderActiveWorkspace()}
          {renderConnectorsGrid()}
          {renderSessions()}
          {renderOverlaySettings()}
          {renderSuggestions()}
          {renderPrivacy()}
          {renderRecentEvents()}

          <div className="text-[10px] pt-2" style={{ color: C.muted }}>
            Backend bridges pending: <code className="px-1 rounded" style={{ background: C.surface2 }}>POST /api/v2/qudos/sessions</code>, <code className="px-1 rounded" style={{ background: C.surface2 }}>WS /api/ws/qudos/events</code>, macOS Screen Recording + Accessibility probes. UI/state ready to swap in.
          </div>
        </div>
      </div>
    </div>
  );
}
