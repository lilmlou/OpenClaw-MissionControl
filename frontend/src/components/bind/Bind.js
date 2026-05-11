/**
 * Phase 0.3 — <Bind>
 *
 * Atomic binding: one widget ↔ one config key.
 *
 *   <Bind to="ui.theme.default" />
 *
 * Behaviour:
 *   - Fetches schema + value from the config bus (Phase 0.1)
 *   - Renders via <SchemaForm> (Phase 0.2) with autoSave debounced PUT
 *   - Subscribes to /api/ws/config so changes from other tabs/agents
 *     re-render within 1s
 *   - Loading → MC Skeleton matching final shape
 *   - Error → MC ErrorState with Retry calling reload
 *
 * Principle 1.5 — In-UI extensibility:
 *   If `defaultSchema` is provided and the backend has no schema for `to` yet,
 *   we render against the default and the first save registers the key.
 */
import React, { useCallback, useEffect, useRef } from "react";
import { C } from "@/lib/constants";
import { Skeleton } from "@/components/kit";
import { ErrorState } from "@/components/kit";
import { SchemaForm } from "@/components/schema-form";
import { useConfigSchema, useConfigValue } from "@/hooks/useConfigBus";

export function Bind({
  to,
  label,
  description,
  widget,
  uiSchema: propsUiSchema,
  readOnly = false,
  className,
  defaultSchema,
  onChange,
  dataTestid,
}) {
  const { schema, loading: schemaLoading, error: schemaError } =
    useConfigSchema(to);
  const { value, set, version, loading: valueLoading, error: valueError, reload, reset } =
    useConfigValue(to);

  // Track whether we've registered the defaultSchema for this key yet.
  const registeredRef = useRef(false);

  // Effective schema: real schema wins; otherwise fall back to defaultSchema.
  let effectiveSchema = schema;
  if (!effectiveSchema && defaultSchema) {
    effectiveSchema = defaultSchema;
  }

  // Apply title/description overrides
  if (effectiveSchema && (label || description)) {
    effectiveSchema = {
      ...effectiveSchema,
      ...(label !== undefined ? { title: label } : {}),
      ...(description !== undefined ? { description } : {}),
    };
  }

  // Merge uiSchema: caller-supplied + widget override
  const mergedUi = { ...(propsUiSchema || {}) };
  if (widget) mergedUi["ui:widget"] = widget;

  const handleSubmit = useCallback(async (newValue) => {
    onChange?.(newValue);
    await set(newValue);
    if (defaultSchema && !schema && !registeredRef.current) {
      // Schema-less key — first PUT registers it. Mark so we don't loop.
      registeredRef.current = true;
    }
  }, [set, onChange, defaultSchema, schema]);

  const testid = dataTestid || `bind-${to}`;
  const loading = schemaLoading || (valueLoading && value === undefined);

  // Loading state — Skeleton matched to final shape
  if (loading && !effectiveSchema) {
    return (
      <div
        data-testid={testid}
        className={className}
      >
        <div
          className="p-4 rounded-[var(--mc-radius-md)] space-y-2"
          style={{ background: C.surface, border: `1px solid ${C.border}` }}
        >
          <Skeleton height={14} width="40%" />
          <Skeleton height={32} width="100%" />
        </div>
      </div>
    );
  }

  // Error state — schema or value fetch failed; offer retry
  const err = schemaError || valueError;
  if (err && !effectiveSchema) {
    return (
      <div
        data-testid={testid}
        className={className}
      >
        <ErrorState
          title={`Couldn't load ${label || to}`}
          description={err}
          fix={[{ label: "Retry", onClick: reload }]}
          detail={{ key: to, error: err }}
        />
      </div>
    );
  }

  return (
    <div
      data-testid={testid}
      className={className}
      data-bind-to={to}
      data-bind-version={version}
    >
      <SchemaForm
        schema={effectiveSchema}
        uiSchema={mergedUi}
        value={value}
        onSubmit={handleSubmit}
        onReload={reload}
        autoSave={{ debounceMs: 500 }}
        readOnly={readOnly}
        dataTestid={`${testid}-form`}
      />
      {valueError && effectiveSchema && (
        <div
          className="mt-2 flex items-center gap-2 px-3 py-2 rounded-[var(--mc-radius-sm)] text-[12px]"
          style={{ background: C.errSoft, color: C.red }}
          data-testid={`${testid}-error`}
        >
          <span className="flex-1 truncate">{valueError}</span>
          <button
            type="button"
            onClick={reload}
            className="px-2 py-0.5 rounded text-[11px]"
            style={{ background: C.surface2, color: C.muted }}
            data-testid={`${testid}-retry`}
          >
            Retry
          </button>
        </div>
      )}
    </div>
  );
}

export default Bind;
