/**
 * Phase 0.3 — <BindCategory>
 *
 *   <BindCategory category="cron" title="Cron schedules" />
 *
 * Renders all keys in a config category as a single section. Internally
 * just delegates to <SchemaPage> from Phase 0.2 and tags the testid with
 * the bind-* convention.
 */
import React from "react";
import { SchemaPage } from "@/components/schema-form";

export function BindCategory({ category, title, description, dataTestid }) {
  return (
    <div data-testid={dataTestid || `bind-category-${category}`}>
      {description && (
        <p
          className="text-[12px] mb-3"
          style={{ color: "var(--mc-fg-2)" }}
          data-testid={`bind-category-${category}-description`}
        >
          {description}
        </p>
      )}
      <SchemaPage
        category={category}
        title={title}
        dataTestid={`bind-category-${category}-page`}
      />
    </div>
  );
}

export default BindCategory;
