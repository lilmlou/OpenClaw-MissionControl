/**
 * Phase 0.2 — MC-themed custom widgets for RJSF
 *
 * Maps JSON Schema type hints → MC Design System widgets.
 * All colours via C.* tokens — zero hardcoded hex.
 *
 *  boolean                       → Toggle (MC switch, not checkbox)
 *  number + minimum + maximum    → Slider + number input
 *  string + enum ≤4              → Pill group
 *  string + enum >4              → Searchable Dropdown
 *  format: color                 → Colour picker
 *  format: duration              → Duration input
 *  format: cron                  → Cron builder
 *  secret: true                  → SecretInput
 *  type: array + items.format:tag→ TagInput
 *  additionalProperties: true    → KeyValueEditor
 */
import React, { useState, useRef, useEffect, useCallback } from "react";
import { Check, Pencil, AlertCircle, RotateCcw, Plus, X, Eye, EyeOff, ChevronDown, Clock } from "lucide-react";
import { C } from "@/lib/constants";

// ─── Save State Indicator ─────────────────────────────────────────────────────
export function SaveIndicator({ saveState }) {
  if (saveState === "idle") return null;

  const map = {
    editing: { icon: <Pencil className="w-3 h-3" />, color: C.muted, label: null },
    saving:  { icon: <span className="mc-spinner" style={{ borderColor: C.accent, borderRightColor: "transparent" }} />, color: C.muted, label: "saving…" },
    saved:   { icon: <Check className="w-3 h-3" />, color: C.green, label: null },
    failed:  { icon: <AlertCircle className="w-3 h-3" />, color: C.red, label: "failed" },
    conflict:{ icon: <AlertCircle className="w-3 h-3" />, color: C.yellow, label: "conflict" },
  };

  const item = map[saveState];
  if (!item) return null;

  return (
    <span className="inline-flex items-center gap-1 text-[11px]" style={{ color: item.color }}>
      {item.icon}{item.label}
    </span>
  );
}

// ─── MC Toggle (boolean widget) ───────────────────────────────────────────────
export function MCToggleWidget({ id, value, onChange, disabled, readonly, uiSchema = {} }) {
  const on = Boolean(value);
  return (
    <button
      type="button"
      id={id}
      role="switch"
      aria-checked={on}
      disabled={disabled || readonly}
      onClick={() => onChange(!on)}
      className="w-9 h-5 rounded-full relative transition-colors shrink-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
      style={{
        background: on ? C.accent : C.surface2,
        outlineColor: C.accent,
        opacity: (disabled || readonly) ? 0.5 : 1,
      }}
      data-testid={uiSchema["ui:testid"] || `toggle-${id}`}
    >
      <div
        className="absolute top-[3px] w-[14px] h-[14px] rounded-full transition-all"
        style={{ background: "#fff", left: on ? 19 : 3 }}
      />
    </button>
  );
}

// ─── MC Slider (number + min/max widget) ─────────────────────────────────────
export function MCSliderWidget({ id, value, onChange, schema, disabled, readonly, uiSchema = {} }) {
  const min = schema.minimum ?? 0;
  const max = schema.maximum ?? 100;
  const step = schema.multipleOf ?? 1;
  const v = value ?? min;

  return (
    <div className="flex items-center gap-3" data-testid={uiSchema["ui:testid"] || `slider-${id}`}>
      <span className="text-[11px] w-8 text-right" style={{ color: C.muted }}>{min}</span>
      <input
        type="range"
        id={id}
        min={min}
        max={max}
        step={step}
        value={v}
        disabled={disabled || readonly}
        onChange={e => onChange(Number(e.target.value))}
        className="flex-1 accent-[var(--mc-accent)]"
        style={{ cursor: (disabled || readonly) ? "not-allowed" : "pointer" }}
      />
      <span className="text-[11px] w-8" style={{ color: C.muted }}>{max}</span>
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        value={v}
        disabled={disabled || readonly}
        onChange={e => onChange(Number(e.target.value))}
        className="w-16 px-2 py-1 rounded text-[12px] text-center"
        style={{ background: C.surface2, border: `1px solid ${C.border}`, color: C.text, outline: "none" }}
      />
    </div>
  );
}

// ─── Pill Group (string enum ≤4) ─────────────────────────────────────────────
export function MCPillGroupWidget({ id, value, onChange, schema, disabled, readonly, uiSchema = {} }) {
  const options = schema.enum || [];
  return (
    <div className="flex flex-wrap gap-1.5" data-testid={uiSchema["ui:testid"] || `pills-${id}`}>
      {options.map(opt => {
        const active = value === opt;
        return (
          <button
            key={opt}
            type="button"
            disabled={disabled || readonly}
            onClick={() => onChange(opt)}
            className="px-3 py-1 rounded-full text-[12px] font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1"
            style={{
              background: active ? C.accent : C.surface2,
              color: active ? "#fff" : C.muted,
              border: `1px solid ${active ? C.accent : C.border}`,
              outlineColor: C.accent,
              opacity: (disabled || readonly) ? 0.5 : 1,
            }}
          >
            {String(opt)}
          </button>
        );
      })}
    </div>
  );
}

// ─── Searchable Dropdown (string enum >4) ────────────────────────────────────
export function MCDropdownWidget({ id, value, onChange, schema, disabled, readonly, placeholder, uiSchema = {} }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef(null);
  const options = schema.enum || [];
  const filtered = options.filter(o => String(o).toLowerCase().includes(query.toLowerCase()));

  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div className="relative" ref={ref} data-testid={uiSchema["ui:testid"] || `dropdown-${id}`}>
      <button
        type="button"
        id={id}
        disabled={disabled || readonly}
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-3 py-2 rounded-[var(--mc-radius-md)] text-[13px] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1"
        style={{ background: C.surface2, border: `1px solid ${C.border}`, color: value ? C.text : C.muted, outlineColor: C.accent }}
      >
        <span>{value !== undefined && value !== null ? String(value) : (placeholder || "Select…")}</span>
        <ChevronDown className="w-3.5 h-3.5 shrink-0" style={{ color: C.muted }} />
      </button>
      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-[var(--mc-radius-md)] overflow-hidden" style={{ background: C.surface, border: `1px solid ${C.border}`, boxShadow: "var(--mc-shadow-2)" }}>
          <div className="p-2">
            <input
              autoFocus
              type="text"
              placeholder="Search…"
              value={query}
              onChange={e => setQuery(e.target.value)}
              className="w-full px-2 py-1.5 rounded text-[12px]"
              style={{ background: C.surface2, border: `1px solid ${C.border}`, color: C.text, outline: "none" }}
            />
          </div>
          <div className="max-h-48 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="px-3 py-2 text-[12px]" style={{ color: C.muted }}>No options</div>
            ) : filtered.map(opt => (
              <button
                key={opt}
                type="button"
                onClick={() => { onChange(opt); setOpen(false); setQuery(""); }}
                className="w-full text-left px-3 py-2 text-[13px] transition-colors"
                style={{ background: value === opt ? C.accentSoft : "transparent", color: value === opt ? C.accent : C.text }}
                onMouseEnter={e => { if (value !== opt) e.currentTarget.style.background = C.surface2; }}
                onMouseLeave={e => { if (value !== opt) e.currentTarget.style.background = "transparent"; }}
              >
                {String(opt)}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Duration Input ────────────────────────────────────────────────────────────
const DURATION_UNITS = [
  { label: "s",  multiplier: 1,       placeholder: "30s" },
  { label: "m",  multiplier: 60,      placeholder: "5m" },
  { label: "h",  multiplier: 3600,    placeholder: "1h" },
  { label: "d",  multiplier: 86400,   placeholder: "1d" },
];

function parseDuration(str) {
  if (!str) return null;
  const m = String(str).match(/^(\d+(?:\.\d+)?)\s*([smhd]?)$/i);
  if (!m) return null;
  const n = parseFloat(m[1]);
  const u = (m[2] || "s").toLowerCase();
  const mult = DURATION_UNITS.find(d => d.label === u)?.multiplier || 1;
  return n * mult;
}

function formatDuration(seconds) {
  if (seconds === null || seconds === undefined) return "";
  if (seconds % 86400 === 0) return `${seconds / 86400}d`;
  if (seconds % 3600 === 0) return `${seconds / 3600}h`;
  if (seconds % 60 === 0) return `${seconds / 60}m`;
  return `${seconds}s`;
}

export function MCDurationWidget({ id, value, onChange, disabled, readonly, uiSchema = {} }) {
  const [raw, setRaw] = useState(formatDuration(value));
  const [error, setError] = useState(null);

  const commit = useCallback(() => {
    const parsed = parseDuration(raw);
    if (raw && parsed === null) { setError("Use: 30s, 5m, 1h, 1d"); return; }
    setError(null);
    onChange(parsed);
  }, [raw, onChange]);

  return (
    <div data-testid={uiSchema["ui:testid"] || `duration-${id}`}>
      <input
        id={id}
        type="text"
        value={raw}
        disabled={disabled || readonly}
        onChange={e => { setRaw(e.target.value); setError(null); }}
        onBlur={commit}
        onKeyDown={e => e.key === "Enter" && commit()}
        placeholder="e.g. 30s, 5m, 1h"
        className="w-full px-3 py-2 rounded-[var(--mc-radius-md)] text-[13px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1"
        style={{ background: C.surface2, border: `1px solid ${error ? C.red : C.border}`, color: C.text, outline: "none", outlineColor: C.accent }}
      />
      {error && <p className="mt-1 text-[11px]" style={{ color: C.red }}>{error}</p>}
    </div>
  );
}

// ─── Cron Builder ─────────────────────────────────────────────────────────────
function humanCron(expr) {
  if (!expr) return "";
  try {
    const parts = expr.trim().split(/\s+/);
    if (parts.length !== 5) return expr;
    const [min, hour, dom, month, dow] = parts;
    if (expr === "* * * * *") return "Every minute";
    if (min === "0" && hour === "*" && dom === "*" && month === "*" && dow === "*") return "Every hour";
    if (min !== "*" && hour !== "*" && dom === "*" && month === "*" && dow === "*") return `Every day at ${hour}:${min.padStart(2,"0")}`;
    if (min !== "*" && hour !== "*" && dom === "*" && month === "*" && dow !== "*") {
      const days = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
      const dayLabel = dow.split(",").map(d => days[parseInt(d)] || d).join(", ");
      return `Every ${dayLabel} at ${hour}:${min.padStart(2,"0")}`;
    }
    return expr;
  } catch { return expr; }
}

export function MCCronWidget({ id, value, onChange, disabled, readonly, uiSchema = {} }) {
  const [raw, setRaw] = useState(value || "");

  const commit = useCallback((v) => {
    setRaw(v);
    onChange(v);
  }, [onChange]);

  const preview = humanCron(raw);

  return (
    <div data-testid={uiSchema["ui:testid"] || `cron-${id}`}>
      <input
        id={id}
        type="text"
        value={raw}
        disabled={disabled || readonly}
        onChange={e => commit(e.target.value)}
        placeholder="* * * * *"
        className="w-full px-3 py-2 rounded-[var(--mc-radius-md)] text-[13px] font-mono focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1"
        style={{ background: C.surface2, border: `1px solid ${C.border}`, color: C.text, outline: "none", outlineColor: C.accent }}
      />
      {preview && (
        <p className="mt-1 flex items-center gap-1 text-[11px]" style={{ color: C.muted }}>
          <Clock className="w-3 h-3" />{preview}
        </p>
      )}
    </div>
  );
}

// ─── Secret Input ─────────────────────────────────────────────────────────────
export function MCSecretWidget({ id, value, onChange, disabled, readonly, uiSchema = {} }) {
  const [revealed, setRevealed] = useState(false);
  const [replacing, setReplacing] = useState(false);
  const [draft, setDraft] = useState("");
  const isSet = value && value !== "";

  const handleReplace = () => {
    onChange(draft);
    setReplacing(false);
    setDraft("");
    setRevealed(false);
  };

  return (
    <div className="space-y-2" data-testid={uiSchema["ui:testid"] || `secret-${id}`}>
      {!replacing ? (
        <div className="flex items-center gap-2">
          <div className="flex-1 px-3 py-2 rounded-[var(--mc-radius-md)] text-[13px] font-mono select-none"
            style={{ background: C.surface2, border: `1px solid ${C.border}`, color: C.muted }}>
            {revealed && isSet ? (value) : (isSet ? "•".repeat(16) : <span className="italic" style={{ color: C.muted }}>not set</span>)}
          </div>
          {isSet && (
            <button type="button" onClick={() => setRevealed(r => !r)} title={revealed ? "Hide" : "Reveal"}
              className="p-2 rounded-[var(--mc-radius-sm)] transition-colors"
              style={{ background: C.surface2, color: C.muted }}>
              {revealed ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            </button>
          )}
          {!readonly && !disabled && (
            <button type="button" onClick={() => { setReplacing(true); setRevealed(false); }}
              className="px-3 py-2 rounded-[var(--mc-radius-sm)] text-[12px] transition-colors"
              style={{ background: C.surface2, color: C.muted, border: `1px solid ${C.border}` }}>
              {isSet ? "Replace" : "Set"}
            </button>
          )}
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <input
            autoFocus
            type="password"
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") handleReplace(); if (e.key === "Escape") { setReplacing(false); setDraft(""); } }}
            placeholder="Enter new value…"
            className="flex-1 px-3 py-2 rounded-[var(--mc-radius-md)] text-[13px]"
            style={{ background: C.surface2, border: `1px solid ${C.accent}`, color: C.text, outline: "none" }}
          />
          <button type="button" onClick={handleReplace}
            className="px-3 py-2 rounded-[var(--mc-radius-sm)] text-[12px]"
            style={{ background: C.accent, color: "#fff" }}>Save</button>
          <button type="button" onClick={() => { setReplacing(false); setDraft(""); }}
            className="px-3 py-2 rounded-[var(--mc-radius-sm)] text-[12px]"
            style={{ background: C.surface2, color: C.muted }}>Cancel</button>
        </div>
      )}
    </div>
  );
}

// ─── Tag Input ────────────────────────────────────────────────────────────────
export function MCTagInputWidget({ id, value, onChange, disabled, readonly, uiSchema = {} }) {
  const rawTags = Array.isArray(value) ? value : [];
  const [input, setInput] = useState("");
  // stable reference to avoid exhaustive-deps warning
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const tags = rawTags;

  const addTag = useCallback((v) => {
    const trimmed = v.trim();
    if (!trimmed || tags.includes(trimmed)) return;
    onChange([...tags, trimmed]);
  }, [tags, onChange]);

  const removeTag = useCallback((tag) => {
    onChange(tags.filter(t => t !== tag));
  }, [tags, onChange]);

  const handleKey = (e) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addTag(input);
      setInput("");
    }
    if (e.key === "Backspace" && !input && tags.length) {
      removeTag(tags[tags.length - 1]);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5 p-2 rounded-[var(--mc-radius-md)] min-h-[38px]"
      style={{ background: C.surface2, border: `1px solid ${C.border}` }}
      data-testid={uiSchema["ui:testid"] || `tags-${id}`}>
      {tags.map(tag => (
        <span key={tag} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px]"
          style={{ background: C.accentSoft, color: C.accent, border: `1px solid ${C.accent}33` }}>
          {tag}
          {!readonly && !disabled && (
            <button type="button" onClick={() => removeTag(tag)} className="ml-0.5 hover:opacity-75">
              <X className="w-2.5 h-2.5" />
            </button>
          )}
        </span>
      ))}
      {!readonly && !disabled && (
        <input
          id={id}
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKey}
          onBlur={() => { if (input.trim()) { addTag(input); setInput(""); } }}
          placeholder={tags.length ? "" : "Add tags…"}
          className="flex-1 min-w-[80px] bg-transparent text-[12px] outline-none"
          style={{ color: C.text }}
        />
      )}
    </div>
  );
}

// ─── Key/Value Editor (additionalProperties) ─────────────────────────────────
export function MCKeyValueWidget({ id, value, onChange, disabled, readonly, uiSchema = {} }) {
  const obj = (value && typeof value === "object" && !Array.isArray(value)) ? value : {};
  const entries = Object.entries(obj);
  const [newKey, setNewKey] = useState("");
  const [newVal, setNewVal] = useState("");

  const update = (key, val) => onChange({ ...obj, [key]: val });
  const remove = (key) => {
    const next = { ...obj };
    delete next[key];
    onChange(next);
  };
  const add = () => {
    if (!newKey.trim()) return;
    onChange({ ...obj, [newKey.trim()]: newVal });
    setNewKey("");
    setNewVal("");
  };

  return (
    <div className="space-y-2" data-testid={uiSchema["ui:testid"] || `kv-${id}`}>
      {entries.map(([k, v]) => (
        <div key={k} className="flex items-center gap-2">
          <input readOnly value={k} className="w-36 px-2 py-1.5 rounded-[var(--mc-radius-sm)] text-[12px] font-mono"
            style={{ background: C.surface2, border: `1px solid ${C.border}`, color: C.muted }} />
          <span style={{ color: C.muted }}>=</span>
          <input
            value={String(v)}
            disabled={disabled || readonly}
            onChange={e => update(k, e.target.value)}
            className="flex-1 px-2 py-1.5 rounded-[var(--mc-radius-sm)] text-[12px]"
            style={{ background: C.surface2, border: `1px solid ${C.border}`, color: C.text, outline: "none" }}
          />
          {!readonly && !disabled && (
            <button type="button" onClick={() => remove(k)} className="p-1.5 rounded transition-colors"
              style={{ color: C.red }} title="Remove">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      ))}
      {!readonly && !disabled && (
        <div className="flex items-center gap-2 pt-1">
          <input value={newKey} onChange={e => setNewKey(e.target.value)} placeholder="key"
            onKeyDown={e => e.key === "Enter" && add()}
            className="w-36 px-2 py-1.5 rounded-[var(--mc-radius-sm)] text-[12px] font-mono"
            style={{ background: C.surface2, border: `1px solid ${C.border}`, color: C.text, outline: "none" }} />
          <span style={{ color: C.muted }}>=</span>
          <input value={newVal} onChange={e => setNewVal(e.target.value)} placeholder="value"
            onKeyDown={e => e.key === "Enter" && add()}
            className="flex-1 px-2 py-1.5 rounded-[var(--mc-radius-sm)] text-[12px]"
            style={{ background: C.surface2, border: `1px solid ${C.border}`, color: C.text, outline: "none" }} />
          <button type="button" onClick={add}
            className="flex items-center gap-1 px-2 py-1.5 rounded-[var(--mc-radius-sm)] text-[12px] transition-colors"
            style={{ background: C.accentSoft, color: C.accent }}>
            <Plus className="w-3 h-3" />Add
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Text Input widget ────────────────────────────────────────────────────────
export function MCTextWidget({ id, value, onChange, disabled, readonly, placeholder, schema, uiSchema = {} }) {
  return (
    <input
      id={id}
      type={schema?.format === "email" ? "email" : schema?.format === "uri" ? "url" : "text"}
      value={value || ""}
      disabled={disabled || readonly}
      onChange={e => onChange(e.target.value || undefined)}
      placeholder={placeholder || schema?.examples?.[0] || ""}
      className="w-full px-3 py-2 rounded-[var(--mc-radius-md)] text-[13px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1"
      style={{ background: C.surface2, border: `1px solid ${C.border}`, color: C.text, outline: "none", outlineColor: C.accent }}
      data-testid={uiSchema["ui:testid"] || `text-${id}`}
    />
  );
}

// ─── Number Input widget ──────────────────────────────────────────────────────
export function MCNumberWidget({ id, value, onChange, disabled, readonly, schema, uiSchema = {} }) {
  return (
    <input
      id={id}
      type="number"
      value={value ?? ""}
      min={schema?.minimum}
      max={schema?.maximum}
      step={schema?.multipleOf || 1}
      disabled={disabled || readonly}
      onChange={e => onChange(e.target.value === "" ? undefined : Number(e.target.value))}
      className="w-full px-3 py-2 rounded-[var(--mc-radius-md)] text-[13px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1"
      style={{ background: C.surface2, border: `1px solid ${C.border}`, color: C.text, outline: "none", outlineColor: C.accent }}
      data-testid={uiSchema["ui:testid"] || `number-${id}`}
    />
  );
}

// ─── Textarea widget ──────────────────────────────────────────────────────────
export function MCTextareaWidget({ id, value, onChange, disabled, readonly, placeholder, uiSchema = {} }) {
  return (
    <textarea
      id={id}
      value={value || ""}
      disabled={disabled || readonly}
      onChange={e => onChange(e.target.value || undefined)}
      placeholder={placeholder || ""}
      rows={4}
      className="w-full px-3 py-2 rounded-[var(--mc-radius-md)] text-[13px] resize-y focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1"
      style={{ background: C.surface2, border: `1px solid ${C.border}`, color: C.text, outline: "none", outlineColor: C.accent, minHeight: 80 }}
      data-testid={uiSchema["ui:testid"] || `textarea-${id}`}
    />
  );
}

// ─── FieldTemplate override ───────────────────────────────────────────────────
export function MCFieldTemplate({ id, classNames, label, help, required, errors, children, schema, uiSchema, rawErrors }) {
  const hasErrors = rawErrors && rawErrors.length > 0;
  const hidden = uiSchema?.["ui:widget"] === "hidden" || schema?.type === "null";
  if (hidden) return null;

  return (
    <div className={`space-y-1.5 ${classNames || ""}`}>
      {label && schema?.type !== "boolean" && (
        <label htmlFor={id} className="block text-[13px] font-medium" style={{ color: C.text }}>
          {label}
          {required && <span className="ml-0.5" style={{ color: C.red }}>*</span>}
        </label>
      )}
      {children}
      {hasErrors && (
        <div className="space-y-0.5">
          {rawErrors.map((err, i) => (
            <p key={i} className="text-[11px] flex items-center gap-1" style={{ color: C.red }}>
              <AlertCircle className="w-3 h-3 shrink-0" />{err}
            </p>
          ))}
        </div>
      )}
      {help && <p className="text-[11px]" style={{ color: C.muted }}>{help}</p>}
    </div>
  );
}

// ─── Object Field Template ─────────────────────────────────────────────────────
export function MCObjectFieldTemplate({ title, description, properties, uiSchema }) {
  return (
    <div className="space-y-4">
      {(title || description) && (
        <div>
          {title && <h3 className="text-[13px] font-semibold mb-0.5" style={{ color: C.fg1 }}>{title}</h3>}
          {description && <p className="text-[12px]" style={{ color: C.muted }}>{description}</p>}
        </div>
      )}
      {properties.map(p => (
        <div key={p.name} className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">{p.content}</div>
        </div>
      ))}
    </div>
  );
}

// ─── Colour Picker (format: color) ───────────────────────────────────────────
// Design System V2 §3.2 — palette chips from chart tokens + hex input fallback.
const PALETTE_TOKENS = [
  { label: "Accent",  value: "var(--mc-accent)",  hex: "#5EE2C9" },
  { label: "Blue",    value: "var(--mc-info)",     hex: "#6EA8FE" },
  { label: "Purple",  value: "var(--mc-chart-3)",  hex: "#C99CFF" },
  { label: "Yellow",  value: "var(--mc-warn)",     hex: "#F5C451" },
  { label: "Orange",  value: "var(--mc-chart-5)",  hex: "#FF8E72" },
  { label: "Green",   value: "var(--mc-ok)",       hex: "#4ADE80" },
  { label: "Red",     value: "var(--mc-err)",      hex: "#FF6478" },
];

export function MCColorWidget({ id, value, onChange, disabled, readonly, uiSchema = {} }) {
  const [hex, setHex] = useState(value || "");
  const [err, setErr] = useState(null);

  const commit = useCallback((v) => {
    const clean = v.trim();
    if (clean && !/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(clean)) {
      setErr("Use #RGB or #RRGGBB");
      return;
    }
    setErr(null);
    setHex(clean);
    onChange(clean || undefined);
  }, [onChange]);

  return (
    <div className="space-y-2" data-testid={uiSchema["ui:testid"] || `color-${id}`}>
      {/* Palette chips */}
      <div className="flex flex-wrap gap-1.5">
        {PALETTE_TOKENS.map(tok => (
          <button
            key={tok.hex}
            type="button"
            disabled={disabled || readonly}
            title={tok.label}
            onClick={() => { setHex(tok.hex); commit(tok.hex); }}
            className="w-6 h-6 rounded-full border-2 transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1"
            style={{
              background: tok.hex,
              borderColor: (value === tok.hex || value === tok.value) ? C.accent : "transparent",
              outlineColor: C.accent,
              opacity: (disabled || readonly) ? 0.5 : 1,
            }}
          />
        ))}
      </div>
      {/* Hex input */}
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-[var(--mc-radius-sm)] border shrink-0"
          style={{ background: hex || C.surface2, borderColor: C.border }} />
        <input
          id={id}
          type="text"
          value={hex}
          disabled={disabled || readonly}
          onChange={e => { setHex(e.target.value); setErr(null); }}
          onBlur={e => commit(e.target.value)}
          onKeyDown={e => e.key === "Enter" && commit(hex)}
          placeholder="#RRGGBB"
          className="flex-1 px-2 py-1.5 rounded-[var(--mc-radius-md)] text-[12px] font-mono focus-visible:outline focus-visible:outline-2"
          style={{ background: C.surface2, border: `1px solid ${err ? C.red : C.border}`, color: C.text, outline: "none", outlineColor: C.accent }}
        />
      </div>
      {err && <p className="text-[11px]" style={{ color: C.red }}>{err}</p>}
    </div>
  );
}

// ─── File Picker (format: file-path) ─────────────────────────────────────────
// Displays current path + text input for manual entry. Full E1 Files browser
// is injected when available (Phase E1 ships it). Falls back gracefully.
export function MCFilePickerWidget({ id, value, onChange, disabled, readonly, uiSchema = {} }) {
  const [draft, setDraft] = useState(value || "");
  const [editing, setEditing] = useState(!value);

  const commit = useCallback(() => {
    onChange(draft || undefined);
    setEditing(false);
  }, [draft, onChange]);

  return (
    <div className="space-y-1" data-testid={uiSchema["ui:testid"] || `file-${id}`}>
      {!editing ? (
        <div className="flex items-center gap-2">
          <div className="flex-1 px-3 py-2 rounded-[var(--mc-radius-md)] text-[12px] font-mono truncate"
            style={{ background: C.surface2, border: `1px solid ${C.border}`, color: C.text }}>
            {value || <span style={{ color: C.muted }}>no path set</span>}
          </div>
          {!readonly && !disabled && (
            <button type="button" onClick={() => setEditing(true)}
              className="px-3 py-2 rounded-[var(--mc-radius-sm)] text-[12px] transition-colors"
              style={{ background: C.surface2, color: C.muted, border: `1px solid ${C.border}` }}>
              Change
            </button>
          )}
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <input
            autoFocus
            id={id}
            type="text"
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") commit(); if (e.key === "Escape") { setDraft(value || ""); setEditing(false); } }}
            placeholder="/path/to/file"
            className="flex-1 px-3 py-2 rounded-[var(--mc-radius-md)] text-[12px] font-mono focus-visible:outline focus-visible:outline-2"
            style={{ background: C.surface2, border: `1px solid ${C.accent}`, color: C.text, outline: "none", outlineColor: C.accent }}
          />
          <button type="button" onClick={commit}
            className="px-3 py-2 rounded-[var(--mc-radius-sm)] text-[12px]"
            style={{ background: C.accent, color: "#fff" }}>Set</button>
          <button type="button" onClick={() => { setDraft(value || ""); setEditing(false); }}
            className="px-3 py-2 rounded-[var(--mc-radius-sm)] text-[12px]"
            style={{ background: C.surface2, color: C.muted }}>Cancel</button>
        </div>
      )}
    </div>
  );
}

// ─── Model ID picker (format: model-id) ──────────────────────────────────────
// Uses existing provider registry endpoint if available; falls back to plain
// text input so the widget is never broken if the endpoint 404s.
export function MCModelPickerWidget({ id, value, onChange, disabled, readonly, uiSchema = {} }) {
  const [models, setModels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    fetch("/api/v2/models").then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data && Array.isArray(data.models || data)) {
          setModels((data.models || data).map(m => ({ id: m.id || m, label: m.name || m.id || m })));
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!open) return;
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);

  const filtered = models.filter(m =>
    !query || m.label.toLowerCase().includes(query.toLowerCase()) || m.id.toLowerCase().includes(query.toLowerCase())
  );

  // Fallback: no models loaded → plain text input
  if (!loading && models.length === 0) {
    return (
      <input
        id={id}
        type="text"
        value={value || ""}
        disabled={disabled || readonly}
        onChange={e => onChange(e.target.value || undefined)}
        placeholder="model-id"
        className="w-full px-3 py-2 rounded-[var(--mc-radius-md)] text-[12px] font-mono focus-visible:outline focus-visible:outline-2"
        style={{ background: C.surface2, border: `1px solid ${C.border}`, color: C.text, outline: "none", outlineColor: C.accent }}
        data-testid={uiSchema["ui:testid"] || `model-${id}`}
      />
    );
  }

  return (
    <div className="relative" ref={ref} data-testid={uiSchema["ui:testid"] || `model-${id}`}>
      <button
        type="button"
        id={id}
        disabled={disabled || readonly || loading}
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-3 py-2 rounded-[var(--mc-radius-md)] text-[13px] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1"
        style={{ background: C.surface2, border: `1px solid ${C.border}`, color: value ? C.text : C.muted, outlineColor: C.accent }}
      >
        <span className="truncate">{loading ? "Loading models…" : (value || "Select model…")}</span>
        <ChevronDown className="w-3.5 h-3.5 shrink-0" style={{ color: C.muted }} />
      </button>
      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-[var(--mc-radius-md)] overflow-hidden"
          style={{ background: C.surface, border: `1px solid ${C.border}`, boxShadow: "var(--mc-shadow-2)" }}>
          <div className="p-2">
            <input
              autoFocus
              type="text"
              placeholder="Search models…"
              value={query}
              onChange={e => setQuery(e.target.value)}
              className="w-full px-2 py-1.5 rounded text-[12px]"
              style={{ background: C.surface2, border: `1px solid ${C.border}`, color: C.text, outline: "none" }}
            />
          </div>
          <div className="max-h-52 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="px-3 py-2 text-[12px]" style={{ color: C.muted }}>No models found</div>
            ) : filtered.map(m => (
              <button
                key={m.id}
                type="button"
                onClick={() => { onChange(m.id); setOpen(false); setQuery(""); }}
                className="w-full text-left px-3 py-2 text-[12px] transition-colors"
                style={{ background: value === m.id ? C.accentSoft : "transparent", color: value === m.id ? C.accent : C.text }}
                onMouseEnter={e => { if (value !== m.id) e.currentTarget.style.background = C.surface2; }}
                onMouseLeave={e => { if (value !== m.id) e.currentTarget.style.background = "transparent"; }}
              >
                <span className="font-mono">{m.id}</span>
                {m.label !== m.id && <span className="ml-2 text-[11px]" style={{ color: C.muted }}>{m.label}</span>}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Context menu button (Reset / Copy / View schema) ─────────────────────────
// §6.2 — per-field context menu. Schema viewer renders inline modal; no
// alert() / window.* mutation. Pure component state, dismisses on overlay click.
export function FieldContextMenu({ onReset, onCopy, value, schema, configKey, dataTestid }) {
  const [open, setOpen] = useState(false);
  const [schemaOpen, setSchemaOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);

  const handleCopy = () => {
    const payload = typeof value === "string" ? value : JSON.stringify(value);
    if (onCopy) onCopy(value);
    else navigator.clipboard?.writeText(payload);
    setOpen(false);
  };

  return (
    <>
      <div className="relative" ref={ref}>
        <button type="button" onClick={() => setOpen(o => !o)}
          className="p-1 rounded transition-colors text-[11px]"
          style={{ color: C.muted }}
          title="Field options"
          data-testid={dataTestid || (configKey ? `field-menu-${configKey}` : "field-menu")}>
          <span className="text-[14px] leading-none">⋯</span>
        </button>
        {open && (
          <div className="absolute right-0 top-full z-50 mt-1 rounded-[var(--mc-radius-md)] overflow-hidden min-w-[160px]"
            style={{ background: C.surface, border: `1px solid ${C.border}`, boxShadow: "var(--mc-shadow-2)" }}>
            {onReset && (
              <button type="button" onClick={() => { onReset?.(); setOpen(false); }}
                className="w-full flex items-center gap-2 px-3 py-2 text-[12px] transition-colors"
                style={{ color: C.text }}
                onMouseEnter={e => e.currentTarget.style.background = C.surface2}
                onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                data-testid={configKey ? `field-menu-reset-${configKey}` : undefined}>
                <RotateCcw className="w-3 h-3" />Reset to default
              </button>
            )}
            <button type="button" onClick={handleCopy}
              className="w-full flex items-center gap-2 px-3 py-2 text-[12px] transition-colors"
              style={{ color: C.text }}
              onMouseEnter={e => e.currentTarget.style.background = C.surface2}
              onMouseLeave={e => e.currentTarget.style.background = "transparent"}
              data-testid={configKey ? `field-menu-copy-${configKey}` : undefined}>
              Copy value
            </button>
            <button type="button" onClick={() => { setSchemaOpen(true); setOpen(false); }}
              className="w-full flex items-center gap-2 px-3 py-2 text-[12px] transition-colors"
              style={{ color: C.text }}
              onMouseEnter={e => e.currentTarget.style.background = C.surface2}
              onMouseLeave={e => e.currentTarget.style.background = "transparent"}
              data-testid={configKey ? `field-menu-view-schema-${configKey}` : undefined}>
              View schema
            </button>
          </div>
        )}
      </div>

      {schemaOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.6)" }}
          onClick={() => setSchemaOpen(false)}
          data-testid={configKey ? `schema-viewer-${configKey}` : "schema-viewer"}
        >
          <div
            className="max-w-2xl w-full max-h-[80vh] rounded-[var(--mc-radius-lg)] overflow-hidden flex flex-col"
            style={{ background: C.surface, border: `1px solid ${C.border}`, boxShadow: "var(--mc-shadow-2)" }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3"
              style={{ borderBottom: `1px solid ${C.border}` }}>
              <div className="text-[13px] font-medium" style={{ color: C.text }}>
                {schema?.title || configKey || "Schema"}
              </div>
              <button type="button" onClick={() => setSchemaOpen(false)}
                className="p-1 rounded transition-colors"
                style={{ color: C.muted }}
                data-testid={configKey ? `schema-viewer-close-${configKey}` : "schema-viewer-close"}>
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <pre
              className="flex-1 overflow-auto px-4 py-3 text-[11px] font-mono whitespace-pre-wrap"
              style={{ color: C.text, background: C.surface2 }}
            >
{JSON.stringify(schema || {}, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </>
  );
}
