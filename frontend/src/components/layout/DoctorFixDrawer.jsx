/**
 * F3 — Doctor Fix Drawer (SHELL)
 *
 * Right-side overlay listing detected system issues (ports, services,
 * config drift, missing files, stale processes) with one-click Fix
 * actions per issue.
 *
 * Shell only — fetch is `GET /api/v2/system/doctor` and renders the
 * `data.issues[]` shape live wiring is expected to provide. If the
 * endpoint is missing/404, the drawer shows an EmptyState — never mock
 * data.
 *
 * Theme: locked Mietorè tokens. Glassmorphism panel, hairline gold
 * border, warm-black backdrop. Fix buttons are cyan (live action).
 *
 * Non-coder test: this is what replaces "open a terminal and run
 * lsof / kill -9 / yarn build". Meg taps Fix; the action invokes via
 * `POST /api/v2/system/doctor/fix` (wired later).
 */
import React, { useCallback, useEffect, useState } from "react";
import { X, Stethoscope, Wrench, RefreshCw, AlertOctagon, AlertTriangle, Info } from "lucide-react";
import { Button, EmptyState, ErrorState, Pill } from "@/components/kit";
import { apiUrl } from "@/lib/useGateway";

function severityToTone(sev) {
  if (sev === "high" || sev === "critical") return "err";
  if (sev === "medium" || sev === "warn") return "warn";
  if (sev === "info") return "info";
  return "neutral";
}

function severityIcon(sev) {
  if (sev === "high" || sev === "critical") return AlertOctagon;
  if (sev === "medium" || sev === "warn") return AlertTriangle;
  return Info;
}

function relativeAge(ts) {
  if (!ts || typeof ts !== "number") return "";
  const diff = Date.now() - ts;
  if (diff < 0) return "just now";
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

export function DoctorFixDrawer({ open, onClose }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const reload = useCallback(() => {
    setLoading(true);
    setError(null);
    fetch(apiUrl("/api/v2/system/doctor"))
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((body) => {
        const d = (body && body.data) || {};
        const list = Array.isArray(d.issues) ? d.issues : [];
        setItems(list);
        setLoading(false);
      })
      .catch((e) => {
        setError(e && e.message ? e.message : "Failed to load doctor report");
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    if (!open) return;
    reload();
  }, [open, reload]);

  // ESC closes
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") onClose && onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const runScan = useCallback(() => {
    setScanning(true);
    fetch(apiUrl("/api/v2/system/doctor/scan"), { method: "POST" })
      .catch(() => null)
      .finally(() => {
        // FE Wiring will replace this with a WS doctor.scan.completed
        // listener; for the shell we just reload after a beat.
        setTimeout(() => {
          setScanning(false);
          reload();
        }, 600);
      });
  }, [reload]);

  const runFix = useCallback(
    (issue) => {
      if (!issue || !issue.id) return;
      setBusyId(issue.id);
      fetch(apiUrl("/api/v2/system/doctor/fix"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: issue.id }),
      })
        .catch(() => null)
        .finally(() => {
          setBusyId(null);
          reload();
        });
    },
    [reload]
  );

  if (!open) return null;

  return (
    <div
      data-testid="doctor-fix-drawer"
      style={{ position: "fixed", inset: 0, zIndex: 60 }}
    >
      {/* backdrop — warm-black, glassmorphism */}
      <div
        onClick={onClose}
        style={{
          position: "absolute",
          inset: 0,
          background: "var(--mc-bg-overlay)",
          backdropFilter: "blur(6px)",
          WebkitBackdropFilter: "blur(6px)",
        }}
      />
      {/* panel */}
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="System doctor — fixable issues"
        style={{
          position: "absolute",
          top: 0,
          right: 0,
          bottom: 0,
          width: "min(560px, 94vw)",
          background: "var(--mc-bg-1)",
          color: "var(--mc-fg)",
          borderLeft: "1px solid var(--mc-line-strong)",
          boxShadow:
            "var(--mc-shadow-lg, 0 10px 30px rgba(0,0,0,0.45)), -1px 0 0 var(--mc-accent-soft)",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <header
          className="flex items-center justify-between gap-2 px-4 py-3"
          style={{ borderBottom: "1px solid var(--mc-line)" }}
        >
          <div className="flex items-center gap-2 min-w-0">
            <Stethoscope
              size={18}
              style={{ color: "var(--mc-accent-2)" }}
              aria-hidden="true"
            />
            <h2
              className="m-0"
              style={{
                fontSize: "var(--mc-text-md)",
                fontWeight: 600,
                letterSpacing: "var(--mc-tracking-wide)",
              }}
            >
              Doctor
            </h2>
            <span style={{ color: "var(--mc-fg-2)", fontWeight: 400 }}>
              ({items.length})
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={runScan}
              disabled={scanning || loading}
              data-testid="doctor-fix-drawer-scan"
            >
              <RefreshCw
                size={12}
                className={scanning ? "animate-spin" : ""}
                style={{ marginRight: 6 }}
              />
              {scanning ? "Scanning…" : "Scan now"}
            </Button>
            <button
              type="button"
              aria-label="Close drawer"
              onClick={onClose}
              data-testid="doctor-fix-drawer-close"
              style={{
                width: 28,
                height: 28,
                background: "transparent",
                color: "var(--mc-fg-1)",
                border: 0,
                borderRadius: 4,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <X size={16} />
            </button>
          </div>
        </header>

        <div
          style={{ flex: 1, overflowY: "auto", padding: "var(--mc-space-3)" }}
        >
          {loading && (
            <p
              style={{
                color: "var(--mc-fg-2)",
                fontSize: "var(--mc-text-sm)",
                padding: "var(--mc-space-4)",
                textAlign: "center",
              }}
            >
              Loading doctor report…
            </p>
          )}
          {error && !loading && (
            <ErrorState
              title="Doctor endpoint not reachable"
              description={error}
              fix={[{ label: "Retry", onClick: reload }]}
            />
          )}
          {!loading && !error && items.length === 0 && (
            <EmptyState
              title="All clear"
              description="No fixable issues detected. Mietorè is healthy."
            />
          )}
          {!loading && !error && items.length > 0 && (
            <ul
              style={{
                listStyle: "none",
                padding: 0,
                margin: 0,
                display: "flex",
                flexDirection: "column",
                gap: "var(--mc-space-3)",
              }}
            >
              {items.map((it) => {
                const Sev = severityIcon(it.severity);
                const tone = severityToTone(it.severity);
                const isBusy = busyId === it.id;
                const fixable = it.fixable !== false;
                return (
                  <li
                    key={it.id || it.title}
                    data-testid={`doctor-issue-card-${it.id || ""}`}
                    style={{
                      background: "var(--mc-bg-2)",
                      border: "1px solid var(--mc-line)",
                      borderRadius: "var(--mc-radius-md)",
                      padding: "var(--mc-space-3)",
                    }}
                  >
                    <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Sev
                          size={14}
                          style={{
                            color: `var(--mc-${tone === "neutral" ? "fg-2" : tone})`,
                          }}
                          aria-hidden="true"
                        />
                        <Pill tone={tone} size="sm">
                          {it.severity || "info"}
                        </Pill>
                        {it.category && (
                          <Pill tone="neutral" size="sm">
                            {it.category}
                          </Pill>
                        )}
                        <span
                          style={{
                            color: "var(--mc-fg-2)",
                            fontSize: "var(--mc-text-xs)",
                          }}
                        >
                          {relativeAge(it.detected_ts)}
                        </span>
                      </div>
                    </div>
                    <div
                      style={{
                        color: "var(--mc-fg)",
                        fontSize: "var(--mc-text-sm)",
                        fontWeight: 600,
                        marginBottom: 4,
                      }}
                    >
                      {it.title || "Untitled issue"}
                    </div>
                    {it.detail && (
                      <div
                        style={{
                          color: "var(--mc-fg-2)",
                          fontSize: "var(--mc-text-xs)",
                          marginBottom: "var(--mc-space-2)",
                          lineHeight: 1.45,
                        }}
                      >
                        {it.detail}
                      </div>
                    )}
                    {fixable && (
                      <div className="mt-2 flex justify-end">
                        <Button
                          size="sm"
                          variant="primary"
                          onClick={() => runFix(it)}
                          disabled={isBusy}
                          data-testid={`doctor-fix-${it.id || ""}`}
                        >
                          <Wrench size={12} style={{ marginRight: 6 }} />
                          {isBusy ? "Fixing…" : it.fix_label || "Fix"}
                        </Button>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </aside>
    </div>
  );
}

export default DoctorFixDrawer;
