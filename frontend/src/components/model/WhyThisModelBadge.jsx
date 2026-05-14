/**
 * Sprint 7 — Why This Model Badge (shell)
 *
 *   <WhyThisModelBadge model="claude-opus-4" reason="long-context" />
 *
 * The inline "why this model" chip rendered next to each assistant
 * message header in chat once Sprint 7's `POST /api/v2/models/classify`
 * lands. Shell ships:
 *   - a compact gold-bordered pill showing the chosen model
 *   - hover/click expands a glassmorphism tooltip listing the reason
 *     (context, tokens, quota, latency, override, …) and confidence
 *   - empty-state caption when no reason is available yet
 *
 * Wired by mc-fe-wiring later — this shell renders from props only;
 * no fetches, no WS, no mock data. Endpoint contract:
 *   { model_id, provider, reason, confidence, classifier, alternatives[] }
 *
 * Theme: locked Mietorè tokens — gold accent, cyan sub-accent, warm
 * black surface, hairline gold border, glassmorphism backdrop.
 */
import React, { useState, useRef, useEffect } from "react";
import { Sparkles, ChevronDown, X, Info } from "lucide-react";

const REASON_LABEL = {
  "long-context":   "Long context window required",
  "vision":         "Vision input detected",
  "code":           "Code-heavy context",
  "fast":           "Latency-sensitive request",
  "cheap":          "Cost optimisation",
  "quota":          "Quota / subscription coverage",
  "override":       "Manual override",
  "fallback":       "Fallback after retry",
  "default":        "Default for this agent",
};

function tone(confidence) {
  if (confidence == null) return "neutral";
  if (confidence >= 0.8) return "ok";
  if (confidence >= 0.5) return "info";
  return "warn";
}

const TONE_COLOR = {
  ok:      { fg: "var(--mc-ok)",     bg: "var(--mc-ok-soft)" },
  info:    { fg: "var(--mc-info)",   bg: "var(--mc-info-soft)" },
  warn:    { fg: "var(--mc-warn)",   bg: "var(--mc-warn-soft)" },
  neutral: { fg: "var(--mc-fg-2)",   bg: "var(--mc-bg-2)" },
};

export function WhyThisModelBadge({
  model,
  provider,
  reason,
  confidence,
  classifier,
  alternatives = [],
  dataTestid = "why-this-model-badge",
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!model) {
    return (
      <span
        data-testid={`${dataTestid}-empty`}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 4,
          padding: "2px 8px",
          fontSize: 10,
          color: "var(--mc-fg-3)",
          background: "var(--mc-bg-2)",
          border: "1px dashed var(--mc-line)",
          borderRadius: "var(--mc-radius-full, 999px)",
        }}
        title="Classifier not yet wired"
      >
        <Info size={10} /> model
      </span>
    );
  }

  const t = TONE_COLOR[tone(confidence)];
  const reasonLabel = REASON_LABEL[reason] || reason || "—";
  const pct =
    typeof confidence === "number"
      ? `${Math.round(confidence * 100)}%`
      : null;

  return (
    <span
      ref={wrapRef}
      data-testid={dataTestid}
      style={{ position: "relative", display: "inline-block" }}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        data-testid={`${dataTestid}-button`}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 5,
          padding: "2px 8px",
          fontSize: 10,
          fontWeight: 600,
          letterSpacing: "var(--mc-tracking-wide, 0.04em)",
          background: "var(--mc-bg-1)",
          color: "var(--mc-accent)",
          border: "1px solid var(--mc-line)",
          borderRadius: "var(--mc-radius-full, 999px)",
          cursor: "pointer",
          backdropFilter: "blur(6px)",
          WebkitBackdropFilter: "blur(6px)",
          whiteSpace: "nowrap",
        }}
        title={reasonLabel}
      >
        <Sparkles size={10} style={{ color: "var(--mc-accent)" }} />
        <span style={{ color: "var(--mc-fg-1)", textTransform: "none", fontWeight: 600 }}>
          {model}
        </span>
        {pct && (
          <span
            style={{
              padding: "0 5px",
              borderRadius: "var(--mc-radius-full, 999px)",
              background: t.bg,
              color: t.fg,
              fontSize: 9,
            }}
          >
            {pct}
          </span>
        )}
        <ChevronDown
          size={10}
          style={{
            transition: "transform 160ms",
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
            color: "var(--mc-fg-3)",
          }}
        />
      </button>

      {open && (
        <div
          data-testid={`${dataTestid}-tooltip`}
          role="tooltip"
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            left: 0,
            zIndex: 60,
            minWidth: 240,
            padding: 12,
            background: "var(--mc-bg-1)",
            border: "1px solid var(--mc-accent-soft)",
            borderRadius: "var(--mc-radius-md, 10px)",
            boxShadow:
              "0 8px 24px rgba(0,0,0,0.45), 0 0 0 1px var(--mc-accent-soft)",
            backdropFilter: "blur(14px)",
            WebkitBackdropFilter: "blur(14px)",
            color: "var(--mc-fg)",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 8,
              marginBottom: 8,
            }}
          >
            <span
              style={{
                fontSize: 9,
                letterSpacing: "var(--mc-tracking-wide, 0.04em)",
                textTransform: "uppercase",
                color: "var(--mc-fg-2)",
                fontWeight: 700,
              }}
            >
              Why this model
            </span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close"
              style={{
                background: "transparent",
                border: "none",
                color: "var(--mc-fg-3)",
                cursor: "pointer",
                padding: 2,
                display: "inline-flex",
              }}
            >
              <X size={11} />
            </button>
          </div>

          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--mc-fg)", marginBottom: 2 }}>
            {model}
          </div>
          {provider && (
            <div style={{ fontSize: 10, color: "var(--mc-fg-3)", marginBottom: 8 }}>
              {provider}
            </div>
          )}

          <div
            style={{
              padding: "8px 10px",
              borderRadius: 6,
              background: "var(--mc-bg-2)",
              border: "1px solid var(--mc-line)",
              fontSize: 11,
              color: "var(--mc-fg-1)",
              marginBottom: 8,
            }}
          >
            {reasonLabel}
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 6,
              fontSize: 10,
              marginBottom: alternatives.length ? 8 : 0,
            }}
          >
            <div>
              <div style={{ color: "var(--mc-fg-3)" }}>Confidence</div>
              <div style={{ color: t.fg, fontWeight: 600 }}>{pct || "—"}</div>
            </div>
            <div>
              <div style={{ color: "var(--mc-fg-3)" }}>Classifier</div>
              <div style={{ color: "var(--mc-fg-1)" }}>{classifier || "—"}</div>
            </div>
          </div>

          {alternatives.length > 0 && (
            <div>
              <div
                style={{
                  fontSize: 9,
                  letterSpacing: "var(--mc-tracking-wide, 0.04em)",
                  textTransform: "uppercase",
                  color: "var(--mc-fg-2)",
                  fontWeight: 700,
                  marginBottom: 4,
                }}
              >
                Considered
              </div>
              <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
                {alternatives.slice(0, 5).map((alt, i) => (
                  <li
                    key={`${alt.model_id || alt.model}-${i}`}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 8,
                      fontSize: 10,
                      padding: "2px 0",
                      color: "var(--mc-fg-2)",
                    }}
                  >
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {alt.model_id || alt.model}
                    </span>
                    <span style={{ color: "var(--mc-fg-3)" }}>
                      {typeof alt.score === "number"
                        ? `${Math.round(alt.score * 100)}%`
                        : "—"}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </span>
  );
}

export default WhyThisModelBadge;
