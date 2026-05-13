/**
 * P0-A FE-4 — Brain Config Panel
 *
 * Slide-over panel triggered by ⚙ button on BrainLogPage.
 * Fetches GET :8765/api/v2/config?prefix=brain. on open.
 * Renders each key as schema-driven field via useConfigBus.
 * On change: PUT :8765/api/v2/config/:key.
 * WS-driven updates via /api/ws/config for cross-tab live sync.
 *
 * ZERO .env references. Schema-driven — no hardcoded field list.
 */

import React, { useEffect, useState, useCallback } from "react";
import { X, Save, RotateCcw } from "lucide-react";
import { subscribeConfigWs, ensureConfigWs } from "@/hooks/useConfigBus";
import { getApiBase } from "@/lib/useGateway";

const FASTAPI_BASE = (getApiBase() || "http://127.0.0.1:7801").replace(/:7801$/, ":8765");

export default function BrainConfigPanel({ open, onClose }) {
  const [keys, setKeys] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [dirty, setDirty] = useState({});
  const [saving, setSaving] = useState({});

  const fetchConfig = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${FASTAPI_BASE}/api/v2/config?prefix=brain.`, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const payload = await res.json();
      const items = payload?.data?.items || payload?.items || [];
      setKeys(items.map(item => ({
        key: item._id || item.key,
        value: item.value,
        type: item.type || (item.schema?.type || "string"),
        schema: item.schema || {},
      })));
    } catch (err) {
      setError(err.message || String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      fetchConfig();
      ensureConfigWs();
    }
  }, [open, fetchConfig]);

  // WS-driven cross-tab updates
  useEffect(() => {
    if (!open) return;
    return subscribeConfigWs((msg) => {
      if ((msg.type === "config.set" || msg.type === "config.bulk") && msg.key) {
        const k = msg.key;
        if (k.startsWith("brain.")) {
          setKeys(prev => prev.map(item =>
            item.key === k ? { ...item, value: msg.value } : item
          ));
          setDirty(prev => {
            const next = { ...prev };
            delete next[k];
            return next;
          });
        }
      }
    });
  }, [open]);

  const handleChange = useCallback((key, newValue) => {
    setKeys(prev => prev.map(item =>
      item.key === key ? { ...item, value: newValue } : item
    ));
    setDirty(prev => ({ ...prev, [key]: newValue }));
  }, []);

  const handleSave = useCallback(async (key) => {
    const newValue = dirty[key];
    if (newValue === undefined) return;
    setSaving(prev => ({ ...prev, [key]: true }));
    try {
      let value = newValue;
      // Parse if numeric/boolean needed based on type
      const item = keys.find(k => k.key === key);
      if (item) {
        if (item.type === "integer" || item.type === "number") {
          value = item.type === "integer" ? parseInt(newValue, 10) : parseFloat(newValue);
          if (isNaN(value)) throw new Error("Invalid number");
        } else if (item.type === "boolean") {
          value = newValue === true || newValue === "true";
        }
      }

      const res = await fetch(`${FASTAPI_BASE}/api/v2/config/${encodeURIComponent(key)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || `PUT failed: ${res.status}`);
      }
      setDirty(prev => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    } catch (err) {
      setError(err.message || String(err));
    } finally {
      setSaving(prev => ({ ...prev, [key]: false }));
    }
  }, [dirty, keys]);

  if (!open) return null;

  // Render schema-driven field
  const renderField = (item) => {
    const { key, value, type, schema } = item;
    const currentValue = dirty[key] !== undefined ? dirty[key] : value;
    const isSaving = saving[key];
    const title = schema.title || key.replace(/^brain\./, "").replace(/\./g, " ");

    if (type === "boolean") {
      return (
        <label key={key} style={fieldRowStyle}>
          <span style={labelStyle}>{title}</span>
          <input
            type="checkbox"
            checked={!!currentValue}
            onChange={e => handleChange(key, e.target.checked)}
            style={checkboxStyle}
          />
        </label>
      );
    }

    if (type === "integer" || type === "number") {
      return (
        <div key={key} style={fieldRowStyle}>
          <span style={labelStyle}>{title}</span>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input
              type="range"
              min={schema.minimum ?? (type === "integer" ? 0 : 0)}
              max={schema.maximum ?? (type === "integer" ? 100000 : 1)}
              step={type === "integer" ? 1 : 0.01}
              value={currentValue}
              onChange={e => handleChange(key, e.target.value)}
              style={{ flex: 1, accentColor: "var(--mc-accent)" }}
            />
            <input
              type="number"
              min={schema.minimum ?? 0}
              max={schema.maximum ?? 100000}
              step={type === "integer" ? 1 : 0.01}
              value={currentValue}
              onChange={e => handleChange(key, e.target.value)}
              style={numberInputStyle}
            />
            {isDirty(key) && (
              <button onClick={() => handleSave(key)} disabled={isSaving} style={saveBtnStyle}>
                <Save size={12} />
              </button>
            )}
          </div>
        </div>
      );
    }

    if (type === "array") {
      const arr = Array.isArray(currentValue) ? currentValue : [];
      return (
        <div key={key} style={fieldRowStyle}>
          <span style={labelStyle}>{title}</span>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
            {arr.map((v, i) => (
              <span key={i} style={tagStyle}>{String(v)}</span>
            ))}
            {arr.length === 0 && <span style={{ color: "var(--mc-fg-3)", fontSize: 12 }}>empty</span>}
          </div>
        </div>
      );
    }

    // string / enum
    const isEnum = schema?.enum && Array.isArray(schema.enum);
    return (
      <div key={key} style={fieldRowStyle}>
        <span style={labelStyle}>{title}</span>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {isEnum ? (
            <select
              value={currentValue || ""}
              onChange={e => handleChange(key, e.target.value)}
              style={selectStyle}
            >
              {schema.enum.map(opt => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          ) : (
            <input
              type="text"
              value={currentValue || ""}
              onChange={e => handleChange(key, e.target.value)}
              style={textInputStyle}
            />
          )}
          {isDirty(key) && (
            <button onClick={() => handleSave(key)} disabled={isSaving} style={saveBtnStyle}>
              <Save size={12} />
            </button>
          )}
        </div>
      </div>
    );
  };

  const isDirty = (key) => dirty[key] !== undefined;

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={panelStyle} onClick={e => e.stopPropagation()}>
        <div style={headerStyle}>
          <h3 style={{ margin: 0, fontFamily: "var(--mc-font-display)", fontSize: 14, fontWeight: 700, color: "var(--mc-fg)" }}>
            ⚙ Brain Config
          </h3>
          <button onClick={onClose} style={closeBtnStyle}>
            <X size={16} />
          </button>
        </div>

        <div style={bodyStyle}>
          {loading && <div style={{ padding: 20, textAlign: "center", color: "var(--mc-fg-2)" }}>Loading…</div>}
          {error && (
            <div style={{ padding: 12, background: "var(--mc-err-soft)", borderRadius: 8, color: "var(--mc-err)", fontSize: 12, marginBottom: 12 }}>
              {error}
              <button onClick={fetchConfig} style={{ marginLeft: 8, cursor: "pointer", color: "var(--mc-accent)", background: "none", border: "none", fontSize: 12 }}>
                <RotateCcw size={12} />
              </button>
            </div>
          )}
          {!loading && keys.length === 0 && !error && (
            <div style={{ padding: 20, textAlign: "center", color: "var(--mc-fg-2)" }}>No brain config keys found</div>
          )}
          {keys.map(renderField)}
        </div>

        <div style={footerStyle}>
          <span style={{ fontSize: 10, color: "var(--mc-fg-3)" }}>{keys.length} brain config keys</span>
        </div>
      </div>
    </div>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────
const overlayStyle = {
  position: "fixed", inset: 0, zIndex: 100,
  background: "rgba(0,0,0,0.5)", display: "flex", justifyContent: "flex-end",
};

const panelStyle = {
  width: 380, maxWidth: "90vw", height: "100%",
  background: "var(--mc-bg-1)", borderLeft: "1px solid var(--mc-line)",
  display: "flex", flexDirection: "column", overflow: "hidden",
  boxShadow: "-4px 0 24px rgba(0,0,0,0.3)",
};

const headerStyle = {
  display: "flex", alignItems: "center", justifyContent: "space-between",
  padding: "16px 20px", borderBottom: "1px solid var(--mc-line)",
};

const bodyStyle = {
  flex: 1, overflowY: "auto", padding: "12px 16px",
};

const footerStyle = {
  padding: "10px 20px", borderTop: "1px solid var(--mc-line)",
};

const fieldRowStyle = {
  display: "flex", flexDirection: "column", gap: 6,
  padding: "10px 0", borderBottom: "1px solid var(--mc-line)",
};

const labelStyle = {
  fontSize: 11, fontWeight: 600, color: "var(--mc-fg-2)",
  textTransform: "uppercase", letterSpacing: 0.8,
};

const numberInputStyle = {
  width: 80, padding: "4px 8px", borderRadius: 6,
  border: "1px solid var(--mc-line-strong)", background: "var(--mc-bg-2)",
  color: "var(--mc-fg)", fontSize: 12, fontFamily: "var(--mc-font-mono)",
};

const textInputStyle = {
  flex: 1, padding: "5px 8px", borderRadius: 6,
  border: "1px solid var(--mc-line-strong)", background: "var(--mc-bg-2)",
  color: "var(--mc-fg)", fontSize: 12,
};

const selectStyle = {
  flex: 1, padding: "5px 8px", borderRadius: 6,
  border: "1px solid var(--mc-line-strong)", background: "var(--mc-bg-2)",
  color: "var(--mc-fg)", fontSize: 12,
};

const checkboxStyle = {
  width: 18, height: 18, accentColor: "var(--mc-accent)",
  cursor: "pointer",
};

const saveBtnStyle = {
  padding: "4px 8px", borderRadius: 6, border: "none", cursor: "pointer",
  background: "var(--mc-accent)", color: "var(--mc-accent-fg)",
  display: "flex", alignItems: "center", justifyContent: "center",
};

const closeBtnStyle = {
  background: "none", border: "none", cursor: "pointer",
  color: "var(--mc-fg-2)", padding: 4, borderRadius: 4,
};

const tagStyle = {
  padding: "2px 8px", borderRadius: 999, fontSize: 10,
  background: "var(--mc-bg-2)", color: "var(--mc-fg-1)",
  border: "1px solid var(--mc-line-strong)", fontFamily: "var(--mc-font-mono)",
};