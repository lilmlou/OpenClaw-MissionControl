/**
 * Phase 0.3 — <BindSet>
 *
 *   <BindSet keys={["models.default.provider", "models.default.id"]} title="…" />
 *
 * For when you want a hand-picked group of bindings on a non-settings page.
 */
import React from "react";
import { C } from "@/lib/constants";
import { Bind } from "./Bind";

export function BindSet({ keys = [], title, description, dataTestid, className }) {
  const testid = dataTestid || `bind-set-${(keys[0] || "empty")}`;
  return (
    <div data-testid={testid} className={className}>
      {(title || description) && (
        <div className="mb-3">
          {title && (
            <h3 className="text-[13px] font-semibold" style={{ color: C.text }}>
              {title}
            </h3>
          )}
          {description && (
            <p className="text-[11px] mt-0.5" style={{ color: C.muted }}>
              {description}
            </p>
          )}
        </div>
      )}
      <div className="space-y-3">
        {keys.map((k) => <Bind key={k} to={k} />)}
      </div>
    </div>
  );
}

export default BindSet;
