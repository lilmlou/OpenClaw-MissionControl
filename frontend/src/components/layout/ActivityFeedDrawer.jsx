/**
 * ActivityFeedDrawer — Mietorè BindFeed-backed activity drawer (SHELL)
 *
 * P1 visual-mirror surface from MASTER_PLAN.md. Differs from the existing
 * ActivityPane (right-side bell pane consuming the legacy `activities[]`
 * store slice): this drawer is a *visible consumer of <BindFeed>*, i.e.
 * the new shared config WS singleton path. Phase 0.3 binding-layer surface.
 *
 * Built by MC FE Builder as a structural shell. Live wiring (topic filter
 * controls, severity grouping, ack/dismiss actions) is for FE Wiring.
 *
 * Non-coder test: replaces tailing /tmp/mc_fastapi_8765.log. Meg sees
 * every WS frame as a live event row, without opening a terminal.
 *
 * Theme: locked Mietorè tokens — warm-black panel, hairline gold border,
 * gold accent header, glassmorphism backdrop.
 */
import React, { useCallback, useEffect } from "react";
import { X, Activity as ActivityIcon } from "lucide-react";
import { BindFeed } from "@/components/bind";

/**
 * ActivityFeedDrawer
 *
 * Slide-in drawer (right edge) rendering a live BindFeed.
 *
 * Props:
 *   open        boolean   — controls visibility; parent owns state
 *   onClose     () => void
 *   topic       string    — BindFeed topic filter (default "*")
 *   max         number    — max events held (default 100)
 *   width       number    — drawer width in px (default 420)
 */
export function ActivityFeedDrawer({
  open,
  onClose,
  topic = "*",
  max = 100,
  width = 420,
}) {
  const handleKey = useCallback(
    (e) => {
      if (e.key === "Escape" && typeof onClose === "function") onClose();
    },
    [onClose]
  );

  useEffect(() => {
    if (!open) return undefined;
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, handleKey]);

  if (!open) return null;

  return (
    <>
      {/* Scrim */}
      <div
        data-testid="activity-feed-drawer-scrim"
        onClick={onClose}
        className="fixed inset-0 z-40"
        style={{
          background: "rgba(10, 8, 7, 0.6)",
          backdropFilter: "blur(2px)",
          WebkitBackdropFilter: "blur(2px)",
        }}
        aria-hidden="true"
      />
      {/* Panel */}
      <aside
        data-testid="activity-feed-drawer"
        role="dialog"
        aria-label="Activity feed"
        className="fixed top-0 right-0 z-50 flex flex-col h-screen"
        style={{
          width,
          maxWidth: "100vw",
          background: "var(--mc-bg-1)",
          borderLeft: "1px solid var(--mc-line-strong)",
          boxShadow: "0 0 60px rgba(0, 0, 0, 0.6), 0 0 0 1px var(--mc-line)",
          fontFamily: "var(--mc-font-sans)",
          color: "var(--mc-fg)",
        }}
      >
        <header
          className="flex items-center justify-between shrink-0"
          style={{
            height: 48,
            padding: "0 16px",
            borderBottom: "1px solid var(--mc-line)",
            background: "var(--mc-bg-overlay)",
            backdropFilter: "blur(14px)",
            WebkitBackdropFilter: "blur(14px)",
          }}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <ActivityIcon
              size={16}
              strokeWidth={1.75}
              style={{ color: "var(--mc-accent)" }}
              aria-hidden="true"
            />
            <span
              style={{
                fontFamily: "var(--mc-font-display)",
                fontSize: 14,
                fontWeight: 600,
                letterSpacing: -0.1,
                color: "var(--mc-fg)",
              }}
            >
              Activity Feed
            </span>
            <span
              style={{
                fontSize: 9,
                letterSpacing: 1.4,
                textTransform: "uppercase",
                color: "var(--mc-fg-3)",
                padding: "2px 6px",
                border: "1px solid var(--mc-line)",
                borderRadius: 4,
              }}
            >
              {topic === "*" ? "all" : topic}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close activity feed"
            data-testid="activity-feed-drawer-close"
            className="inline-flex items-center justify-center rounded-md"
            style={{
              width: 28,
              height: 28,
              background: "transparent",
              color: "var(--mc-fg-2)",
              border: "1px solid transparent",
              cursor: "pointer",
              transition: "all 120ms ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "var(--mc-bg-2)";
              e.currentTarget.style.color = "var(--mc-fg)";
              e.currentTarget.style.borderColor = "var(--mc-line)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
              e.currentTarget.style.color = "var(--mc-fg-2)";
              e.currentTarget.style.borderColor = "transparent";
            }}
          >
            <X size={16} strokeWidth={1.75} />
          </button>
        </header>

        <div className="flex-1 overflow-hidden" style={{ padding: 12 }}>
          <BindFeed
            topic={topic}
            max={max}
            title=""
            dataTestid="activity-feed-drawer-bindfeed"
            height="100%"
            className="h-full"
          />
        </div>

        <footer
          className="shrink-0"
          style={{
            padding: "8px 16px",
            borderTop: "1px solid var(--mc-line)",
            fontSize: 10,
            color: "var(--mc-fg-3)",
            letterSpacing: 0.4,
            background: "var(--mc-bg-overlay)",
          }}
        >
          Live · shared config WS · esc to close
        </footer>
      </aside>
    </>
  );
}

export default ActivityFeedDrawer;
