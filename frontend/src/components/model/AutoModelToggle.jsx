/**
 * Sprint 9 — Auto Model Toggle (shell)
 *
 *   <AutoModelToggle value={auto} onChange={setAuto} />
 *
 * The "Auto" header switch from MASTER_PLAN.md Sprint 9. When ON, the
 * model picker delegates to the Sprint 7 classifier; when OFF, Meg's
 * manual <ModelSelector> selection wins. Wired up by mc-fe-wiring later
 * — this shell only renders the visual chrome (toggle + caption + state
 * dot), exposes `value` / `onChange`, and emits no side effects.
 *
 * Theme: locked Mietorè tokens only — gold #D9A24C accent (via
 * --mc-accent), cyan #22D3DB sub-accent (--mc-accent-2), warm black
 * (--mc-bg), hairline gold borders, glassmorphism backdrop blur.
 */
import React from "react";
import { Sparkles, Hand } from "lucide-react";
import { Toggle } from "@/components/kit";

export function AutoModelToggle({
  value = false,
  onChange,
  disabled = false,
  dataTestid = "auto-model-toggle",
}) {
  const handleChange = (next) => {
    if (disabled) return;
    if (typeof onChange === "function") onChange(next);
  };

  return (
    <div
      data-testid={dataTestid}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "6px 10px",
        background: "var(--mc-bg-1)",
        border: "1px solid var(--mc-line)",
        borderRadius: "var(--mc-radius-full, 999px)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        boxShadow: value
          ? "0 0 0 1px var(--mc-accent-soft), 0 2px 8px var(--mc-accent-glow)"
          : "none",
        transition: "box-shadow var(--mc-dur-base, 160ms) var(--mc-ease-out, ease)",
      }}
    >
      <span
        aria-hidden="true"
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: 18,
          height: 18,
          borderRadius: "50%",
          background: value ? "var(--mc-accent-soft)" : "var(--mc-bg-2)",
          color: value ? "var(--mc-accent)" : "var(--mc-fg-3)",
        }}
      >
        {value ? <Sparkles size={11} /> : <Hand size={11} />}
      </span>
      <span
        style={{
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: "var(--mc-tracking-wide, 0.04em)",
          textTransform: "uppercase",
          color: value ? "var(--mc-accent)" : "var(--mc-fg-2)",
        }}
      >
        {value ? "Auto" : "Manual"}
      </span>
      <Toggle
        checked={value}
        onChange={handleChange}
        disabled={disabled}
        size="sm"
        aria-label="Auto model picking"
        data-testid={`${dataTestid}-switch`}
      />
    </div>
  );
}

export default AutoModelToggle;
