/**
 * Phase 0.2 — <SchemaPage>
 *
 * Auto-generated settings page for a config category.
 * Renders all keys in the category as vertical sections with live counts.
 *
 * Usage:
 *   <SchemaPage category="models" title="Models" />
 */
import React, { useCallback, useState } from "react";
import { AlertCircle, RefreshCw } from "lucide-react";
import { C } from "@/lib/constants";
import { useConfigCategory } from "@/hooks/useConfigBus";
import { useConfigValue } from "@/hooks/useConfigBus";
import SchemaForm from "./SchemaForm";
import { FieldContextMenu } from "./Widgets";

// ─── Single key section ───────────────────────────────────────────────────────
export function ConfigKeySection({ configKey, schema, initialValue }) {
  const { value, set, loading, error, reset, reload } = useConfigValue(configKey);
  const displayValue = value !== undefined ? value : initialValue;

  const handleSubmit = useCallback(async (newValue) => {
    await set(newValue);
  }, [set]);

  const title = schema?.title || configKey;
  const description = schema?.description;

  return (
    <div
      className="p-4 rounded-[var(--mc-radius-md)] space-y-3"
      style={{ background: C.surface, border: `1px solid ${C.border}` }}
      data-testid={`config-section-${configKey}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <h3 className="text-[13px] font-medium truncate" style={{ color: C.text }}>{title}</h3>
          {description && (
            <p className="text-[11px] mt-0.5" style={{ color: C.muted }}>{description}</p>
          )}
        </div>
        {reset && (
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={reset}
              className="text-[11px] px-2 py-0.5 rounded transition-colors"
              style={{ background: C.surface2, color: C.muted }}
              title="Reset to default"
              data-testid={`reset-${configKey}`}
            >
              Reset
            </button>
            <FieldContextMenu
              configKey={configKey}
              schema={schema}
              value={displayValue}
              onReset={reset}
            />
          </div>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-1.5 p-2 rounded text-[12px]"
          style={{ background: C.errSoft, color: C.red }}>
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />{error}
          <button
            type="button"
            onClick={reset}
            className="ml-auto flex items-center gap-1 text-[11px] px-2 py-0.5 rounded transition-colors"
            style={{ background: C.surface2, color: C.muted }}
            data-testid={`retry-${configKey}`}
          >
            <RefreshCw className="w-2.5 h-2.5" />Retry
          </button>
        </div>
      )}

      {loading && displayValue === undefined ? (
        <div className="h-9 rounded-[var(--mc-radius-md)] mc-skeleton" />
      ) : (
        <SchemaForm
          schema={schema ? { ...schema, title: undefined, description: undefined } : null}
          value={displayValue}
          onSubmit={handleSubmit}
          onReload={reload}
          autoSave={{ debounceMs: 500 }}
          dataTestid={`schema-form-${configKey}`}
        />
      )}
    </div>
  );
}

// ─── SchemaPage ───────────────────────────────────────────────────────────────
export function SchemaPage({ category, title, dataTestid }) {
  const { keys, schemas, values, loading, error } = useConfigCategory(category);

  if (error) {
    return (
      <div className="flex items-center gap-2 p-4 rounded-[var(--mc-radius-md)]"
        style={{ background: C.errSoft, border: `1px solid ${C.red}30`, color: C.red }}
        data-testid={dataTestid || `schema-page-${category}`}>
        <AlertCircle className="w-4 h-4 shrink-0" />
        <div>
          <p className="text-[13px] font-medium">Failed to load {title || category}</p>
          <p className="text-[11px]">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div data-testid={dataTestid || `schema-page-${category}`} className="space-y-4">
      {title && (
        <h2 className="text-[16px] font-semibold" style={{ color: C.text }}>{title}</h2>
      )}

      {loading && keys.length === 0 ? (
        <div className="space-y-3">
          {[1,2,3].map(i => (
            <div key={i} className="h-20 rounded-[var(--mc-radius-md)] mc-skeleton" />
          ))}
        </div>
      ) : keys.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <p className="text-[14px]" style={{ color: C.muted }}>No settings in this category</p>
        </div>
      ) : (
        <div className="space-y-3">
          {keys.map(key => (
            <ConfigKeySection
              key={key}
              configKey={key}
              schema={schemas[key]}
              initialValue={values[key]}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default SchemaPage;
