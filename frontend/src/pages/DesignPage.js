import React from "react";
import { Sparkles, Image as ImageIcon, MessageSquare, PanelRightClose, PanelRightOpen } from "lucide-react";
import { C } from "@/lib/constants";
import { useGateway } from "@/lib/useGateway";

// /design — Image Studio shell.
//
// Phase 1 of the rebuild (DESIGN_PAGE_REBUILD spec):
//   - rename AgentPage.js → DesignPage.js
//   - three-mode toggle: Studio / Gallery / Chat
//   - inspector slot on the right (toggleable)
//   - empty body per mode — Phase 2 fills Studio
//
// Backend Phase C Part 6 endpoints (POST /api/v2/design/generate, etc.)
// are not yet shipped. All generation flows are mocked in useGateway.js
// (generateDesign action). Every TODO in this tree maps 1:1 to a real
// endpoint when backend lands.

const MODES = [
  { id: "studio",  label: "Studio",  icon: Sparkles    },
  { id: "gallery", label: "Gallery", icon: ImageIcon   },
  { id: "chat",    label: "Edit & Chat", icon: MessageSquare },
];

function ModeToggle({ mode, onChange }) {
  return (
    <div
      className="inline-flex items-center gap-1 p-1 rounded-lg"
      style={{ background: C.surface, border: `1px solid ${C.border}` }}
    >
      {MODES.map((m) => {
        const active = mode === m.id;
        const Icon = m.icon;
        return (
          <button
            key={m.id}
            type="button"
            onClick={() => onChange(m.id)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] font-medium transition-colors"
            style={{
              background: active ? `${C.accent}22` : "transparent",
              color: active ? C.text : C.muted,
              border: `1px solid ${active ? `${C.accent}44` : "transparent"}`,
            }}
            data-testid={`design-mode-${m.id}`}
          >
            <Icon className="w-3.5 h-3.5" />
            {m.label}
          </button>
        );
      })}
    </div>
  );
}

// Phase 2 will replace this stub with VariationStrip + Canvas + ActionRail + Composer.
function StudioMode() {
  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="text-center max-w-md">
        <div
          className="w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center"
          style={{ background: `${C.accent}15`, border: `1px solid ${C.accent}40` }}
        >
          <Sparkles className="w-7 h-7" style={{ color: C.accent }} />
        </div>
        <h2 className="text-xl font-semibold mb-2" style={{ color: C.text }}>Image Studio</h2>
        <p className="text-sm" style={{ color: C.muted }}>
          Studio mode shell — Phase 2 will wire the variation strip, canvas, action rail,
          and composer here. Backend image generation lands when Phase C Part 6 ships
          (see <code className="text-[11px]">BACKEND_REQUESTS.md</code>).
        </p>
      </div>
    </div>
  );
}

function GalleryMode() {
  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="text-center max-w-md">
        <div
          className="w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center"
          style={{ background: `${C.muted}15`, border: `1px solid ${C.border}` }}
        >
          <ImageIcon className="w-7 h-7" style={{ color: C.muted }} />
        </div>
        <h2 className="text-xl font-semibold mb-2" style={{ color: C.text }}>Gallery</h2>
        <p className="text-sm" style={{ color: C.muted }}>
          Saved generations grid — Phase 3. Filter pills, density toggle, and
          card-grid render here once Studio mode is wired.
        </p>
      </div>
    </div>
  );
}

function ChatMode() {
  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="text-center max-w-md">
        <div
          className="w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center"
          style={{ background: `${C.muted}15`, border: `1px solid ${C.border}` }}
        >
          <MessageSquare className="w-7 h-7" style={{ color: C.muted }} />
        </div>
        <h2 className="text-xl font-semibold mb-2" style={{ color: C.text }}>Edit & Chat</h2>
        <p className="text-sm" style={{ color: C.muted }}>
          Two-pane canvas + conversation thread — Phase 4. Generated images appear
          inline in chat and load into the canvas on click.
        </p>
      </div>
    </div>
  );
}

function InspectorPanel() {
  const { design, toggleDesignInspector } = useGateway();
  if (!design.inspector.open) return null;
  return (
    <aside
      className="shrink-0 flex flex-col overflow-hidden"
      style={{ width: 320, borderLeft: `1px solid ${C.border}`, background: C.surface }}
    >
      <div className="flex items-center justify-between px-4 py-3"
           style={{ borderBottom: `1px solid ${C.border}` }}>
        <span className="text-[12px] font-semibold uppercase tracking-wider" style={{ color: C.muted }}>
          Inspector
        </span>
        <button
          type="button"
          onClick={toggleDesignInspector}
          className="p-1 rounded-md hover:opacity-80 transition-opacity"
          style={{ color: C.muted }}
          data-testid="design-inspector-close"
          title="Hide inspector"
        >
          <PanelRightClose className="w-4 h-4" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        <div className="text-[11px] leading-relaxed" style={{ color: C.muted }}>
          Inspector tabs (Settings / History / References) wire up in Phase 2 + Phase 5.
          Settings will hold the model picker, aspect ratio, quality, seed,
          number of variations, and negative prompt.
        </div>
      </div>
    </aside>
  );
}

export default function DesignPage() {
  const { design, setDesignMode, toggleDesignInspector } = useGateway();
  const { mode, inspector } = design;

  return (
    <div className="h-full flex flex-col" style={{ color: C.text }}>
      {/* Page header */}
      <div
        className="shrink-0 flex items-center justify-between px-6 py-3"
        style={{ borderBottom: `1px solid ${C.border}`, background: C.bg }}
      >
        <div className="flex items-center gap-4">
          <h1 className="text-lg font-semibold" style={{ color: C.text }}>Design</h1>
          <ModeToggle mode={mode} onChange={setDesignMode} />
        </div>
        <div className="flex items-center gap-2">
          {!inspector.open && (
            <button
              type="button"
              onClick={toggleDesignInspector}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors"
              style={{ background: C.surface, color: C.muted, border: `1px solid ${C.border}` }}
              data-testid="design-inspector-open"
              title="Show inspector"
            >
              <PanelRightOpen className="w-3.5 h-3.5" />
              Inspector
            </button>
          )}
        </div>
      </div>

      {/* Body: main content + inspector */}
      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 flex flex-col overflow-hidden">
          {mode === "studio"  && <StudioMode  />}
          {mode === "gallery" && <GalleryMode />}
          {mode === "chat"    && <ChatMode    />}
        </div>
        <InspectorPanel />
      </div>
    </div>
  );
}
