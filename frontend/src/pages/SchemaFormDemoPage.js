/**
 * Phase 0.2 — /dev/schema-form-demo
 *
 * Live demonstration page proving the schema-driven form layer:
 *   - useConfigSchema + useConfigValue against the real backend
 *   - <SchemaForm> autoSave debounce → PUT /api/v2/config/{key}
 *   - WS /api/ws/config push → re-renders without losing focus elsewhere
 *
 * Acceptance §6 (handoff):
 *   "Demo page at /dev/schema-form-demo proves: edit `ui.theme.default` and
 *    `agents.kill_after_minutes` live; open second tab, change in tab A
 *    reflects in tab B within 1s"
 *
 * Visual rules honoured:
 *   - Only existing C.* design tokens (no new hex)
 *   - Reuses existing schema-form components (no new visual idioms)
 *   - All interactive elements expose data-testid for the dogfood agent
 */
import React from "react";
import { Sliders, Activity, Link2 } from "lucide-react";
import { C } from "@/lib/constants";
import { InlineSchemaField } from "@/components/schema-form/InlineSchemaField";
import { useConfigValue } from "@/hooks/useConfigBus";
import { Bind, BindStatus, BindAction } from "@/components/bind";

// ─── Live value mirror — proves WS push without form focus loss ──────────────
function LiveValueMirror({ configKey }) {
  const { value, version, loading, error } = useConfigValue(configKey);
  return (
    <div
      className="flex items-center justify-between p-3 rounded-[var(--mc-radius-md)]"
      style={{ background: C.surface2, border: `1px solid ${C.border}` }}
      data-testid={`live-mirror-${configKey}`}
    >
      <div className="flex items-center gap-2">
        <Activity className="w-3.5 h-3.5" style={{ color: C.accent }} />
        <code className="text-[11px]" style={{ color: C.muted }}>{configKey}</code>
      </div>
      <div className="flex items-center gap-3">
        {loading && <span className="text-[11px]" style={{ color: C.muted }}>loading…</span>}
        {error && <span className="text-[11px]" style={{ color: C.red }}>{error}</span>}
        {!loading && !error && (
          <>
            <span
              className="text-[12px] px-2 py-0.5 rounded"
              style={{ background: C.surface, color: C.text, border: `1px solid ${C.border}` }}
              data-testid={`live-mirror-${configKey}-value`}
            >
              {JSON.stringify(value)}
            </span>
            <span
              className="text-[10px] px-1.5 py-0.5 rounded"
              style={{ background: C.surface, color: C.muted }}
              data-testid={`live-mirror-${configKey}-version`}
            >
              v{version ?? "?"}
            </span>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Demo page ────────────────────────────────────────────────────────────────
export default function SchemaFormDemoPage() {
  return (
    <div
      className="h-full overflow-auto p-6"
      style={{ color: C.text }}
      data-testid="schema-form-demo-page"
    >
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-start gap-3">
          <div
            className="p-2 rounded-[var(--mc-radius-md)] shrink-0"
            style={{ background: C.accentSoft }}
          >
            <Sliders className="w-5 h-5" style={{ color: C.accent }} />
          </div>
          <div>
            <h1 className="text-[18px] font-semibold">Schema Form Demo</h1>
            <p className="text-[12px] mt-0.5" style={{ color: C.muted }}>
              Phase 0.2 — schema-driven forms wired to the live config bus.
              Edit a field below, then open this page in a second tab — changes
              in tab A appear in tab B within 1 second via the WS push.
            </p>
          </div>
        </div>

        {/* Demo 1: theme (string + enum → pill group) */}
        <section
          className="p-4 rounded-[var(--mc-radius-md)] space-y-3"
          style={{ background: C.surface, border: `1px solid ${C.border}` }}
          data-testid="demo-section-theme"
        >
          <div>
            <h2 className="text-[13px] font-medium">UI Theme</h2>
            <p className="text-[11px] mt-0.5" style={{ color: C.muted }}>
              <code style={{ color: C.fg1 }}>ui.theme.default</code> — pill group widget (string enum).
            </p>
          </div>
          <InlineSchemaField
            configKey="ui.theme.default"
            dataTestid="demo-field-theme"
          />
          <LiveValueMirror configKey="ui.theme.default" />
        </section>

        {/* Demo 2: kill_after_minutes (number + min/max → slider) */}
        <section
          className="p-4 rounded-[var(--mc-radius-md)] space-y-3"
          style={{ background: C.surface, border: `1px solid ${C.border}` }}
          data-testid="demo-section-kill-after"
        >
          <div>
            <h2 className="text-[13px] font-medium">Agent kill-after-minutes</h2>
            <p className="text-[11px] mt-0.5" style={{ color: C.muted }}>
              <code style={{ color: C.fg1 }}>agents.kill_after_minutes</code> — slider widget (number with min/max).
            </p>
          </div>
          <InlineSchemaField
            configKey="agents.kill_after_minutes"
            dataTestid="demo-field-kill-after"
          />
          <LiveValueMirror configKey="agents.kill_after_minutes" />
        </section>

        {/* Demo 3: Phase 0.3 Binding Layer dogfood */}
        <section
          className="p-4 rounded-[var(--mc-radius-md)] space-y-4"
          style={{ background: C.surface, border: `1px solid ${C.border}` }}
          data-testid="demo-section-binding-dogfood"
        >
          <div className="flex items-start gap-2">
            <Link2 className="w-4 h-4 mt-0.5 shrink-0" style={{ color: C.accent }} />
            <div>
              <h2 className="text-[13px] font-medium">Binding Layer Dogfood</h2>
              <p className="text-[11px] mt-0.5" style={{ color: C.muted }}>
                Phase 0.3 — one-line bindings: <code style={{ color: C.fg1 }}>&lt;Bind&gt;</code>,{" "}
                <code style={{ color: C.fg1 }}>&lt;BindStatus&gt;</code>,{" "}
                <code style={{ color: C.fg1 }}>&lt;BindAction&gt;</code>. Same config bus, no per-binding sockets.
              </p>
            </div>
          </div>

          {/* Existing key — Bind renders schema-driven editor, autoSave PUTs */}
          <div className="space-y-1">
            <p className="text-[11px]" style={{ color: C.muted }}>
              <code style={{ color: C.fg1 }}>&lt;Bind to="ui.theme.default" /&gt;</code>
            </p>
            <Bind to="ui.theme.default" dataTestid="dogfood-bind-theme" />
          </div>

          {/* Schema-less key with defaultSchema — first save registers it (Principle 1.5) */}
          <div className="space-y-1">
            <p className="text-[11px]" style={{ color: C.muted }}>
              <code style={{ color: C.fg1 }}>&lt;Bind to="feature.flags.test_dogfood" defaultSchema=&#123;…&#125; /&gt;</code> — first save registers the key.
            </p>
            <Bind
              to="feature.flags.test_dogfood"
              defaultSchema={{ type: "boolean", title: "Test Dogfood Flag", category: "feature" }}
              dataTestid="dogfood-bind-flag"
            />
          </div>

          {/* BindStatus — pill bound to a config key (live) */}
          <div className="flex items-center gap-3 flex-wrap">
            <p className="text-[11px]" style={{ color: C.muted }}>
              <code style={{ color: C.fg1 }}>&lt;BindStatus to="feature.flags.qudos_enabled" /&gt;</code>
            </p>
            <BindStatus to="feature.flags.qudos_enabled" dataTestid="dogfood-status-qudos" />
          </div>

          {/* BindAction — invokable buttons; destructive shows confirm */}
          <div className="flex items-start gap-3 flex-wrap">
            <BindAction to="health.ping" label="Ping" dataTestid="dogfood-action-ping" />
            <BindAction
              to="config.reset_all"
              label="Reset all config"
              dataTestid="dogfood-action-reset"
            />
          </div>
          <p className="text-[11px]" style={{ color: C.muted }}>
            <code style={{ color: C.fg1 }}>config.reset_all</code> is destructive — backend marks it{" "}
            <code style={{ color: C.fg1 }}>requires_confirm</code>, so an inline confirm panel appears before invocation.
          </p>
        </section>

        {/* How-to-verify card (visible, no hidden state) */}
        <section
          className="p-4 rounded-[var(--mc-radius-md)] text-[12px] space-y-2"
          style={{ background: C.infoSoft || C.surface, border: `1px solid ${C.border}`, color: C.muted }}
          data-testid="demo-howto"
        >
          <p style={{ color: C.text, fontWeight: 500 }}>How to verify (manual)</p>
          <ol className="list-decimal pl-5 space-y-1">
            <li>Toggle theme between <code>light</code> / <code>dark</code> / <code>auto</code> — save indicator should flip from editing → saving → saved within 500–800ms.</li>
            <li>Drag the kill-after-minutes slider — value persists on release.</li>
            <li>Open this page in a second browser tab. Change a value in tab A — tab B's mirror updates in &lt; 1s without page reload.</li>
            <li>Stop the backend, edit a field — failed indicator (red ⚠) appears; previous value retained, no <code>window.location.reload()</code>.</li>
          </ol>
        </section>
      </div>
    </div>
  );
}
