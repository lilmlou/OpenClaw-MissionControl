/**
 * Phase 0.2 — <SchemaForm>
 *
 * MC-themed RJSF wrapper. Consumes the config bus via props (schema + value).
 * Supports autoSave (debounced PUT), inline validation, save-state indicator,
 * "Reset to default" context menu on each field, and additionalProperties
 * key/value editor.
 *
 * Usage:
 *   <SchemaForm
 *     schema={schema}
 *     value={value}
 *     onSubmit={async (v) => { await save(v); }}
 *     autoSave={{ debounceMs: 500 }}
 *   />
 */
import React, { useCallback, useEffect, useRef, useState } from "react";
import Form from "@rjsf/core";
import validator from "@rjsf/validator-ajv8";
import { Check, AlertCircle, Pencil, ChevronDown } from "lucide-react";
import { C } from "@/lib/constants";
import {
  MCToggleWidget,
  MCSliderWidget,
  MCPillGroupWidget,
  MCDropdownWidget,
  MCDurationWidget,
  MCCronWidget,
  MCSecretWidget,
  MCTagInputWidget,
  MCKeyValueWidget,
  MCColorWidget,
  MCFilePickerWidget,
  MCModelPickerWidget,
  MCTextWidget,
  MCNumberWidget,
  MCTextareaWidget,
  MCFieldTemplate,
  MCObjectFieldTemplate,
  SaveIndicator,
} from "./Widgets";

// ─── Widget registry ─────────────────────────────────────────────────────────
function resolveWidget(schema, uiSchema = {}) {
  const uiWidget = uiSchema?.["ui:widget"];
  if (uiWidget) return uiWidget;

  const { type, format, enum: enumVals, additionalProperties } = schema;

  if (uiSchema?.["ui:secret"] || schema?.secret) return "secret";
  if (type === "boolean") return "toggle";
  if (type === "number" || type === "integer") {
    if (schema.minimum !== undefined && schema.maximum !== undefined) return "slider";
    return "number";
  }
  if (type === "string") {
    if (format === "duration") return "duration";
    if (format === "cron") return "cron";
    if (format === "color") return "color";
    if (format === "file-path") return "filepath";
    if (format === "model-id") return "modelid";
    if (enumVals) return enumVals.length <= 4 ? "pills" : "dropdown";
    if (schema.maxLength && schema.maxLength > 200) return "textarea";
    return "text";
  }
  if (type === "array" && schema.items?.format === "tag") return "tags";
  if (type === "object" && additionalProperties) return "keyvalue";
  return null;
}

const WIDGETS = {
  toggle:   MCToggleWidget,
  slider:   MCSliderWidget,
  pills:    MCPillGroupWidget,
  dropdown: MCDropdownWidget,
  duration: MCDurationWidget,
  cron:     MCCronWidget,
  secret:   MCSecretWidget,
  tags:     MCTagInputWidget,
  keyvalue: MCKeyValueWidget,
  color:    MCColorWidget,
  filepath: MCFilePickerWidget,
  modelid:  MCModelPickerWidget,
  text:     MCTextWidget,
  number:   MCNumberWidget,
  textarea: MCTextareaWidget,
};

// ─── Build uiSchema from JSON Schema hints ────────────────────────────────────
function buildUiSchema(schema) {
  if (!schema || typeof schema !== "object") return {};
  const ui = {};
  const w = resolveWidget(schema);
  if (w) ui["ui:widget"] = w;
  if (schema.description) ui["ui:description"] = schema.description;
  if (schema.properties) {
    for (const [k, sub] of Object.entries(schema.properties)) {
      ui[k] = buildUiSchema(sub);
    }
  }
  return ui;
}

// ─── Diff / merge helpers for WS-sync race handling ──────────────────────────
// Re-exported from wsRaceHelpers so they're importable from this module's
// public API while remaining unit-testable without the @rjsf/core ESM module.
import { diffPaths, mergeRemoteIntoLocal } from "./wsRaceHelpers";
export { diffPaths, mergeRemoteIntoLocal };

// ─── SchemaForm ───────────────────────────────────────────────────────────────
export function SchemaForm({
  schema,
  uiSchema: propsUiSchema,
  value,
  onChange,
  onSubmit,
  onReload,
  autoSave = false,
  readOnly = false,
  errors: backendErrors,
  dataTestid,
}) {
  const [formData, setFormData] = useState(value);
  const [saveState, setSaveState] = useState("idle"); // idle | editing | saving | saved | failed | conflict
  const debounceRef = useRef(null);
  const saveTimerRef = useRef(null);
  // Track in-flight edits per field path so a WS push from another tab cannot
  // clobber a key the user is currently typing into. Keys are dot-paths
  // (e.g. "a.b.c") collected from RJSF onChange diffs.
  const dirtyPathsRef = useRef(new Set());
  const lastSavedRef = useRef(value);

  const debounceMs = autoSave === true ? 500 : (autoSave?.debounceMs ?? 500);
  const isAutoSave = !!autoSave;

  // Sync external value changes (e.g. WS push from another tab) — but never
  // clobber a field that has unsaved local edits. For object values we merge
  // remote into local at the field level; for primitives we only accept the
  // remote value when no edit is in flight.
  useEffect(() => {
    if (saveState === "editing" || saveState === "saving") {
      // Local edits in flight: merge remote keys that are NOT dirty.
      setFormData(prev => mergeRemoteIntoLocal(prev, value, dirtyPathsRef.current));
      lastSavedRef.current = value;
      return;
    }
    setFormData(value);
    lastSavedRef.current = value;
    dirtyPathsRef.current.clear();
  }, [value, saveState]);

  // Clear "saved" indicator after 1s
  useEffect(() => {
    if (saveState === "saved") {
      saveTimerRef.current = setTimeout(() => setSaveState("idle"), 1000);
      return () => clearTimeout(saveTimerRef.current);
    }
  }, [saveState]);

  const doSave = useCallback(async (data) => {
    if (!onSubmit) return;
    setSaveState("saving");
    try {
      await onSubmit(data);
      setSaveState("saved");
      // Save succeeded — these paths are no longer "dirty".
      dirtyPathsRef.current.clear();
      lastSavedRef.current = data;
    } catch (err) {
      if (err?.status === 409) {
        setSaveState("conflict");
      } else {
        setSaveState("failed");
      }
    }
  }, [onSubmit]);

  const handleChange = useCallback(({ formData: newData }) => {
    // Record which paths the user just edited so a concurrent WS push from
    // another tab cannot clobber them. Diff against the last saved value
    // (not the previous formData) so we accumulate every edit since last save.
    const changedPaths = diffPaths(lastSavedRef.current, newData);
    changedPaths.forEach(p => dirtyPathsRef.current.add(p));
    setFormData(newData);
    onChange?.(newData);
    if (!isAutoSave) return;
    setSaveState("editing");
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSave(newData), debounceMs);
  }, [isAutoSave, debounceMs, doSave, onChange]);

  const handleSubmit = useCallback(({ formData: newData }) => {
    doSave(newData);
  }, [doSave]);

  // Merge uiSchema: props override auto-derived
  const derivedUiSchema = buildUiSchema(schema || {});
  const uiSchema = { ...derivedUiSchema, ...(propsUiSchema || {}) };

  // Transform backend errors into RJSF extraErrors shape
  const extraErrors = {};
  if (backendErrors) {
    backendErrors.forEach(e => {
      if (e.field) extraErrors[e.field] = { __errors: [e.message] };
    });
  }

  if (!schema) {
    return (
      <div className="flex items-center gap-2 p-4 rounded-[var(--mc-radius-md)]"
        style={{ background: C.surface, border: `1px solid ${C.border}`, color: C.muted }}>
        <span className="mc-spinner" />
        <span className="text-[13px]">Loading schema…</span>
      </div>
    );
  }

  return (
    <div data-testid={dataTestid || "schema-form"} className="schema-form-mc">
      {/* Save state indicator (top-right, inline) */}
      {isAutoSave && saveState !== "idle" && (
        <div className="flex justify-end mb-2">
          <SaveIndicator saveState={saveState} />
          {saveState === "conflict" && (
            <button
              type="button"
              className="ml-2 text-[11px] px-2 py-0.5 rounded"
              style={{ background: C.warnSoft, color: C.yellow }}
              data-testid={`${dataTestid || "schema-form"}-reload`}
              onClick={async () => {
                try {
                  if (onReload) await onReload();
                } finally {
                  setSaveState("idle");
                }
              }}
            >
              Reload
            </button>
          )}
        </div>
      )}

      <Form
        schema={schema}
        uiSchema={uiSchema}
        formData={formData}
        validator={validator}
        widgets={WIDGETS}
        templates={{ FieldTemplate: MCFieldTemplate, ObjectFieldTemplate: MCObjectFieldTemplate }}
        onChange={handleChange}
        onSubmit={handleSubmit}
        extraErrors={extraErrors}
        disabled={readOnly}
        showErrorList={false}
        omitExtraData={false}
      >
        {/* Custom submit button (only shown if not autoSave) */}
        {!isAutoSave && (
          <div className="flex items-center gap-3 pt-4">
            <button
              type="submit"
              className="px-4 py-2 rounded-[var(--mc-radius-md)] text-[13px] font-medium transition-colors"
              style={{ background: C.accent, color: "#fff" }}
            >
              Save
            </button>
            <SaveIndicator saveState={saveState} />
            {saveState === "conflict" && (
              <button type="button"
                onClick={async () => { try { if (onReload) await onReload(); } finally { setSaveState("idle"); } }}
                className="text-[12px] px-2 py-1 rounded"
                style={{ background: C.warnSoft, color: C.yellow }}>
                Reload
              </button>
            )}
          </div>
        )}
      </Form>
    </div>
  );
}

export default SchemaForm;
