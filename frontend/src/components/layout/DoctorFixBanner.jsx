/**
 * F3 — Doctor Fix Banner (SHELL)
 *
 * Persistent top-of-layout banner showing count of detected system issues
 * that have one-click fixes available. Built by MC FE Builder as a shell
 * surface — live wiring of `/api/v2/system/doctor`, WS `doctor.*` frames,
 * and `/api/v2/system/doctor/fix` action invocation is the responsibility
 * of MC FE Wiring in a follow-up.
 *
 * Non-coder test (PRODUCT_MISSION.md):
 *   Replaces tailing `/tmp/mc_fastapi_8765.log`, running `lsof`, and the
 *   "edit a markdown doc to see what's broken" loop. Meg sees a Doctor
 *   pill, clicks it, sees a list of issues, and clicks Fix on each.
 *
 * Theme: locked Mietorè tokens — warm-black #0A0807, gold #D9A24C,
 * cyan #22D3DB, hairline gold borders, glassmorphism backdrop.
 *
 * Phase 0 compliance:
 *   - visual-first (cyan stethoscope pill + count + "scanning…" state)
 *   - real-time (subscribes to the SHARED config WS singleton)
 *   - no localStorage; session-only dismiss
 *   - no mock data — count 0 → null until wired
 */
import React, { Suspense, useCallback, useEffect, useState } from "react";
import { Stethoscope, X, Loader2 } from "lucide-react";
import { Pill } from "@/components/kit";
import { apiUrl } from "@/lib/useGateway";
import { subscribeConfigWs } from "@/hooks/useConfigBus";

const DoctorFixDrawer = React.lazy(() => import("./DoctorFixDrawer"));

export function DoctorFixBanner() {
  const [countOpen, setCountOpen] = useState(0);
  const [scanning, setScanning] = useState(false);
  const [dismissedThisSession, setDismissedThisSession] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Initial scan-summary fetch — wired later by FE Wiring against
  // `/api/v2/system/doctor`. Shell tolerates 404/missing endpoint
  // by simply rendering nothing (count 0).
  useEffect(() => {
    let cancelled = false;
    fetch(apiUrl("/api/v2/system/doctor"))
      .then((r) => (r.ok ? r.json() : null))
      .then((body) => {
        if (cancelled) return;
        const d = (body && body.data) || {};
        const c =
          typeof d.count_fixable === "number"
            ? d.count_fixable
            : Array.isArray(d.issues)
            ? d.issues.filter((i) => i && i.fixable !== false).length
            : 0;
        setCountOpen(c);
      })
      .catch(() => {
        if (!cancelled) setCountOpen(0);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // WS subscription — SHARED config bus singleton (Phase 0.1).
  useEffect(() => {
    const unsub = subscribeConfigWs((frame) => {
      if (!frame || typeof frame.type !== "string") return;
      const t = frame.type;
      if (!t.startsWith("doctor")) return;
      const data = frame.data || {};
      if (t === "doctor.scan.started") {
        setScanning(true);
        return;
      }
      if (t === "doctor.scan.completed" || t === "doctor.replay") {
        setScanning(false);
        if (typeof data.count_fixable === "number") {
          setCountOpen(data.count_fixable);
        } else if (Array.isArray(data.issues)) {
          setCountOpen(
            data.issues.filter((i) => i && i.fixable !== false).length
          );
        }
        return;
      }
      if (t === "doctor.issue.opened") {
        setCountOpen((c) => c + 1);
      } else if (t === "doctor.issue.fixed" || t === "doctor.issue.closed") {
        setCountOpen((prev) => Math.max(0, prev - 1));
      }
    });
    return () => {
      if (typeof unsub === "function") unsub();
    };
  }, []);

  const handleOpenDrawer = useCallback(() => setDrawerOpen(true), []);
  const handleCloseDrawer = useCallback(() => setDrawerOpen(false), []);
  const handleSessionDismiss = useCallback((e) => {
    e.stopPropagation();
    setDismissedThisSession(true);
  }, []);

  // Banner only shows when there are fixable issues. Scanning alone
  // does NOT take screen real estate — that surfaces in SystemHealthStrip.
  if (countOpen <= 0) return null;
  if (dismissedThisSession) return null;

  return (
    <>
      <div
        data-testid="doctor-fix-banner"
        role="button"
        tabIndex={0}
        onClick={handleOpenDrawer}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            handleOpenDrawer();
          }
        }}
        className="w-full flex items-center justify-between gap-3 px-4 cursor-pointer select-none"
        style={{
          height: 36,
          // Cyan-tinted hairline strip — distinct from red blockers banner.
          background: "var(--mc-info-soft)",
          color: "var(--mc-accent-2)",
          borderBottom:
            "1px solid color-mix(in srgb, var(--mc-accent-2) 32%, transparent)",
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
          fontSize: "var(--mc-text-sm)",
        }}
      >
        <div className="flex items-center gap-2 min-w-0">
          {scanning ? (
            <Loader2
              size={16}
              aria-hidden="true"
              className="animate-spin"
              style={{ opacity: 0.85 }}
            />
          ) : (
            <Stethoscope size={16} aria-hidden="true" />
          )}
          <Pill tone="info" size="sm" data-testid="doctor-fix-banner-count">
            {countOpen}
          </Pill>
          <span className="truncate">
            {countOpen === 1
              ? "fixable issue detected"
              : "fixable issues detected"}{" "}
            — click to scan &amp; fix
          </span>
        </div>
        <button
          type="button"
          aria-label="Hide banner for this session"
          data-testid="doctor-fix-banner-dismiss"
          onClick={handleSessionDismiss}
          className="inline-flex items-center justify-center rounded-sm hover:opacity-80"
          style={{
            width: 20,
            height: 20,
            background: "transparent",
            color: "var(--mc-accent-2)",
            border: 0,
            cursor: "pointer",
          }}
        >
          <X size={14} strokeWidth={2} />
        </button>
      </div>
      {drawerOpen && (
        <Suspense fallback={null}>
          <DoctorFixDrawer open={drawerOpen} onClose={handleCloseDrawer} />
        </Suspense>
      )}
    </>
  );
}

export default DoctorFixBanner;
