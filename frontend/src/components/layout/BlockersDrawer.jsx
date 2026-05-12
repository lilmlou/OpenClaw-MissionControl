/**
 * VM-D1 — Blockers Drawer
 *
 * Right-side overlay panel listing open (or all) blockers.
 * - Lazy-fetches /api/v2/blockers?status=open|all on open.
 * - Each item renders as <ErrorState> with Fix buttons from suggested_actions,
 *   severity Pill, age, and BindAction dismiss.
 * - ESC + backdrop close. Uses design tokens (var(--mc-*)) only.
 */
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import {
  Button,
  EmptyState,
  ErrorState,
  Pill,
} from "@/components/kit";
import { BindAction } from "@/components/bind/BindAction";
import { apiUrl } from "@/lib/useGateway";

function stripMarkdown(s) {
  if (!s || typeof s !== "string") return "";
  let out = s;
  // links [text](url) → text
  out = out.replace(/\[([^\]]+)\]\([^)]*\)/g, "$1");
  // images ![alt](url) → alt
  out = out.replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1");
  // code fences and inline code
  out = out.replace(/```[\s\S]*?```/g, " ");
  out = out.replace(/`([^`]*)`/g, "$1");
  // headings, emphasis, list bullets
  out = out.replace(/^[#>\-*+]+\s*/gm, "");
  out = out.replace(/[*_~]+/g, "");
  // collapse whitespace
  out = out.replace(/\s+/g, " ").trim();
  return out;
}

function firstN(s, n) {
  if (!s) return "";
  if (s.length <= n) return s;
  return s.slice(0, n).trimEnd() + "…";
}

function severityToTone(sev) {
  if (sev === "high") return "err";
  if (sev === "medium") return "warn";
  return "neutral";
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

export function BlockersDrawer({ open, onClose }) {
  const [showAll, setShowAll] = useState(false);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const reload = useCallback(() => {
    setLoading(true);
    setError(null);
    const status = showAll ? "all" : "open";
    fetch(apiUrl(`/api/v2/blockers?status=${status}`))
      .then((r) => r.json())
      .then((body) => {
        const list =
          body && body.data && Array.isArray(body.data.items)
            ? body.data.items
            : [];
        setItems(list);
        setLoading(false);
      })
      .catch((e) => {
        setError(e && e.message ? e.message : "Failed to load blockers");
        setLoading(false);
      });
  }, [showAll]);

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

  const handleAction = useCallback((action, args) => {
    fetch(apiUrl(`/api/v2/actions/${encodeURIComponent(action)}`), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ args: args || {} }),
    }).catch(() => {
      /* surfaced via activity feed */
    });
  }, []);

  const openCount = useMemo(
    () => items.filter((b) => b.status === "open").length,
    [items]
  );

  if (!open) return null;

  return (
    <div
      data-testid="blockers-drawer"
      style={{ position: "fixed", inset: 0, zIndex: 60 }}
    >
      {/* backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "absolute",
          inset: 0,
          background: "rgba(0,0,0,0.4)",
        }}
      />
      {/* panel */}
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Open blockers"
        style={{
          position: "absolute",
          top: 0,
          right: 0,
          bottom: 0,
          width: "min(520px, 92vw)",
          background: "var(--mc-bg-1)",
          color: "var(--mc-fg)",
          borderLeft: "1px solid var(--mc-line)",
          boxShadow: "var(--mc-shadow-lg, 0 10px 30px rgba(0,0,0,0.35))",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <header
          className="flex items-center justify-between gap-2 px-4 py-3"
          style={{ borderBottom: "1px solid var(--mc-line)" }}
        >
          <h2
            className="m-0"
            style={{
              fontSize: "var(--mc-text-md)",
              fontWeight: 600,
            }}
          >
            {showAll ? "All blockers" : "Open blockers"}{" "}
            <span style={{ color: "var(--mc-fg-2)", fontWeight: 400 }}>
              ({showAll ? items.length : openCount})
            </span>
          </h2>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant={showAll ? "primary" : "secondary"}
              onClick={() => setShowAll((v) => !v)}
              data-testid="blockers-drawer-toggle"
            >
              {showAll ? "Show open" : "Show all"}
            </Button>
            <button
              type="button"
              aria-label="Close drawer"
              onClick={onClose}
              data-testid="blockers-drawer-close"
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
              Loading blockers…
            </p>
          )}
          {error && !loading && (
            <ErrorState
              title="Failed to load blockers"
              description={error}
              fix={[{ label: "Retry", onClick: reload }]}
            />
          )}
          {!loading && !error && items.length === 0 && (
            <EmptyState title="No open blockers" />
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
              {items.map((b) => {
                const fix = Array.isArray(b.suggested_actions)
                  ? b.suggested_actions.map((a) => ({
                      label: a.label,
                      action: a.action,
                      args: a.args,
                    }))
                  : [];
                const desc = firstN(stripMarkdown(b.body_md || ""), 200);
                const title =
                  (b.title || "").length > 80
                    ? b.title.slice(0, 80) + "…"
                    : b.title || "Untitled blocker";
                return (
                  <li
                    key={b.id}
                    data-testid={`blocker-card-${b.id}`}
                    style={{
                      background: "var(--mc-bg-2)",
                      border: "1px solid var(--mc-line)",
                      borderRadius: "var(--mc-radius-md)",
                      padding: "var(--mc-space-3)",
                    }}
                  >
                    <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Pill tone={severityToTone(b.severity)} size="sm">
                          {b.severity || "low"}
                        </Pill>
                        {b.status && b.status !== "open" && (
                          <Pill tone="neutral" size="sm">
                            {b.status}
                          </Pill>
                        )}
                        <span
                          style={{
                            color: "var(--mc-fg-2)",
                            fontSize: "var(--mc-text-xs)",
                          }}
                        >
                          {relativeAge(b.opened_ts)}
                        </span>
                      </div>
                    </div>
                    <ErrorState
                      title={title}
                      description={desc}
                      fix={fix}
                      onAction={handleAction}
                    />
                    {b.status === "open" && (
                      <div className="mt-2 flex justify-end">
                        <BindAction
                          to="blockers.dismiss"
                          args={{ id: b.id }}
                          label="Dismiss"
                          size="sm"
                          onResult={reload}
                          dataTestid={`blockers-dismiss-${b.id}`}
                        />
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

export default BlockersDrawer;
