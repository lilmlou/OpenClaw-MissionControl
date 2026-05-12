/**
 * VM-D1 — Blockers Banner
 *
 * Persistent top-of-layout banner showing count of open blockers.
 * - GET /api/v2/blockers/count on mount for initial count.
 * - Subscribes via subscribeConfigWs (SHARED singleton — no new WS).
 * - Renders null when count is 0 or user has session-dismissed [×].
 * - Click → opens <BlockersDrawer>.
 *
 * Phase 0 compliance: visual-first (red badge + ShieldAlert icon + Pill);
 * real-time (WS frames); no reload; no localStorage; no "done" status.
 */
import React, { Suspense, useCallback, useEffect, useState } from "react";
import { ShieldAlert, X } from "lucide-react";
import { Pill } from "@/components/kit";
import { apiUrl } from "@/lib/useGateway";
import { subscribeConfigWs } from "@/hooks/useConfigBus";

const BlockersDrawer = React.lazy(() => import("./BlockersDrawer"));

export function BlockersBanner() {
  const [countOpen, setCountOpen] = useState(0);
  const [dismissedThisSession, setDismissedThisSession] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Initial count fetch
  useEffect(() => {
    let cancelled = false;
    fetch(apiUrl("/api/v2/blockers/count"))
      .then((r) => r.json())
      .then((body) => {
        if (cancelled) return;
        const c = body && body.data && typeof body.data.count_open === "number"
          ? body.data.count_open
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

  // WS subscription — shared config bus singleton
  useEffect(() => {
    const unsub = subscribeConfigWs((frame) => {
      if (!frame || typeof frame.type !== "string") return;
      const t = frame.type;
      const isBlockerFrame =
        t.startsWith("blocker") ||
        t === "blockers.replay" ||
        t === "blockers.scan";
      if (!isBlockerFrame) return;
      const data = frame.data || {};
      if (t === "blockers.replay" || t === "blockers.scan") {
        if (typeof data.count_open === "number") {
          setCountOpen(data.count_open);
        }
      } else if (t === "blocker.opened") {
        setCountOpen((c) => c + 1);
      } else if (t === "blocker.closed") {
        setCountOpen((prev) => Math.max(0, prev - 1));
      } else if (t === "blocker.changed") {
        if (data.status === "closed") {
          setCountOpen((prev) => Math.max(0, prev - 1));
        }
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

  if (countOpen <= 0) return null;
  if (dismissedThisSession) return null;

  return (
    <>
      <div
        data-testid="blockers-banner"
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
          background: "var(--mc-err-soft)",
          color: "var(--mc-err)",
          borderBottom: "1px solid color-mix(in srgb, var(--mc-err) 40%, transparent)",
          fontSize: "var(--mc-text-sm)",
        }}
      >
        <div className="flex items-center gap-2 min-w-0">
          <ShieldAlert size={16} aria-hidden="true" />
          <Pill tone="err" size="sm" data-testid="blockers-banner-count">
            {countOpen}
          </Pill>
          <span className="truncate">
            {countOpen === 1 ? "open blocker" : "open blockers"} — click to view
          </span>
        </div>
        <button
          type="button"
          aria-label="Hide banner for this session"
          data-testid="blockers-banner-dismiss"
          onClick={handleSessionDismiss}
          className="inline-flex items-center justify-center rounded-sm hover:opacity-80"
          style={{
            width: 20,
            height: 20,
            background: "transparent",
            color: "var(--mc-err)",
            border: 0,
            cursor: "pointer",
          }}
        >
          <X size={14} strokeWidth={2} />
        </button>
      </div>
      {drawerOpen && (
        <Suspense fallback={null}>
          <BlockersDrawer open={drawerOpen} onClose={handleCloseDrawer} />
        </Suspense>
      )}
    </>
  );
}

export default BlockersBanner;
