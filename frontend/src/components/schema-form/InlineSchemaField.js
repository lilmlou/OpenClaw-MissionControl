/**
 * Phase 0.2 — <InlineSchemaField>
 *
 * Single-key config field embed for any existing card.
 * Fetches schema + value from the bus, autoSaves on change.
 *
 * Usage:
 *   <InlineSchemaField configKey="models.cost_cap_per_day_usd" />
 */
import React, { useCallback } from "react";
import { C } from "@/lib/constants";
import { useConfigSchema, useConfigValue } from "@/hooks/useConfigBus";
import SchemaForm from "./SchemaForm";

export function InlineSchemaField({ configKey, label, readOnly = false, dataTestid }) {
  const { schema, loading: schemaLoading, error: schemaError } = useConfigSchema(configKey);
  const { value, set, loading: valueLoading, error: valueError, version, reload } = useConfigValue(configKey);

  const handleSubmit = useCallback(async (newValue) => {
    await set(newValue);
  }, [set]);

  const effectiveLabel = label || schema?.title || configKey;

  if (schemaError || valueError) {
    return (
      <div className="p-3 rounded-[var(--mc-radius-md)]" style={{ background: C.errSoft, border: `1px solid ${C.red}30`, color: C.red }}>
        <span className="text-[12px]">⚠ {schemaError || valueError}</span>
      </div>
    );
  }

  if (schemaLoading || valueLoading) {
    return <div className="h-8 rounded-[var(--mc-radius-md)] mc-skeleton" style={{ width: "100%" }} />;
  }

  return (
    <div data-testid={dataTestid || `inline-field-${configKey}`} className="flex items-center justify-between gap-4">
      <div className="flex-1 min-w-0">
        {effectiveLabel && effectiveLabel !== configKey && (
          <label className="block text-[13px] mb-1" style={{ color: C.text }}>{effectiveLabel}</label>
        )}
        {schema?.description && (
          <p className="text-[11px] mb-1.5" style={{ color: C.muted }}>{schema.description}</p>
        )}
        <SchemaForm
          schema={schema ? { ...schema, title: undefined, description: undefined } : null}
          value={value}
          onSubmit={handleSubmit}
          onReload={reload}
          autoSave={{ debounceMs: 500 }}
          readOnly={readOnly}
          dataTestid={`${dataTestid || `inline-field-${configKey}`}-form`}
        />
      </div>
    </div>
  );
}

export default InlineSchemaField;
