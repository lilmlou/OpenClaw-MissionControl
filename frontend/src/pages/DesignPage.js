import React, { useEffect, useRef, useState } from "react";
import {
  Sparkles, Image as ImageIcon, MessageSquare,
  PanelRightClose, PanelRightOpen,
  Heart, Share2, RefreshCw, Download, Upload, MoreHorizontal,
  Send, Paperclip, Video, Camera, Dices,
} from "lucide-react";
import { C } from "@/lib/constants";
import { useGateway } from "@/lib/useGateway";

// /design — Image Studio.
//
// Phase 1 (d9495a8): rename + mode toggle shell + state slice.
// Phase 2 (this commit): Studio mode wires VariationStrip + Canvas +
//   ActionRail + ComposerBar + Inspector Settings tab. Generation is
//   still mocked in useGateway.generateDesign — see TODO comments
//   for backend swap points (Phase C Part 6).
// Phase 3+: Gallery, Edit & Chat, History/References tabs, polish.

const MODES = [
  { id: "studio",  label: "Studio",       icon: Sparkles      },
  { id: "gallery", label: "Gallery",      icon: ImageIcon     },
  { id: "chat",    label: "Edit & Chat",  icon: MessageSquare },
];

// Aspect ratios surfaced in Inspector + composer dropdown.
const ASPECT_RATIOS = [
  { id: "1:1",  label: "1:1",  w: 1,  h: 1  },
  { id: "4:5",  label: "4:5",  w: 4,  h: 5  },
  { id: "9:16", label: "9:16", w: 9,  h: 16 },
  { id: "16:9", label: "16:9", w: 16, h: 9  },
  { id: "3:2",  label: "3:2",  w: 3,  h: 2  },
  { id: "2:3",  label: "2:3",  w: 2,  h: 3  },
];

const QUALITY_LEVELS = [
  { id: "speed",    label: "Speed",    desc: "Faster, cheaper" },
  { id: "balanced", label: "Balanced", desc: "Default"          },
  { id: "quality",  label: "Quality",  desc: "Slower, higher fidelity" },
];

const NUM_VARIATIONS = [1, 2, 4, 6, 8];

// Empty-state suggestion chips. Merged from the parallel AgentPage.js
// rebuild — clickable prompt examples are a real UX win on first load.
const SUGGESTIONS = [
  "A cyberpunk street scene at night with neon reflections on wet pavement",
  "Minimalist logo for a coffee brand, warm earth tones",
  "Portrait of a wise old robot reading a book in a sunlit library",
  "Isometric 3D room with plants, a desk, and warm ambient lighting",
  "Fantasy landscape with floating islands and waterfalls made of light",
  "Abstract geometric pattern in deep purple and teal gradients",
];

// ── Mode toggle ─────────────────────────────────────────────────────
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

// ── Variation strip (left rail in Studio) ───────────────────────────
function VariationStrip({ generation, activeIndex, onSelect }) {
  if (!generation || !Array.isArray(generation.variations) || generation.variations.length === 0) {
    // Empty placeholder strip — 4 slots so the rail width is consistent.
    return (
      <div className="shrink-0 flex flex-col gap-1.5 p-2">
        {Array.from({ length: 4 }, (_, i) => (
          <div
            key={i}
            className="rounded-md"
            style={{
              width: 48, height: 48,
              background: C.surface2,
              border: `1px dashed ${C.border}`,
              opacity: 0.4,
            }}
          />
        ))}
      </div>
    );
  }
  return (
    <div className="shrink-0 flex flex-col gap-1.5 p-2 overflow-y-auto">
      {generation.variations.map((v, i) => {
        const active = i === activeIndex;
        return (
          <button
            key={v.id}
            type="button"
            onClick={() => onSelect(i)}
            className="rounded-md overflow-hidden transition-all shrink-0"
            style={{
              width: 48, height: 48,
              border: `${active ? 2 : 1}px solid ${active ? C.accent : C.border}`,
              boxShadow: active ? `0 0 0 1px ${C.accent}33, 0 0 12px ${C.accent}33` : "none",
            }}
            data-testid={`design-variation-${i}`}
            title={`Variation ${i + 1}${v.seed != null ? ` · seed ${v.seed}` : ""}`}
          >
            <img
              src={v.url}
              alt={`Variation ${i + 1}`}
              className="w-full h-full object-cover"
              loading="lazy"
              draggable={false}
            />
          </button>
        );
      })}
    </div>
  );
}

// ── Action rail (right side of canvas) ──────────────────────────────
function ActionRail({ generation, activeVariation }) {
  // Every action logs a TODO + the context the backend will need when wired.
  const fav = !!activeVariation?.favorited;
  const handle = (action) => () => {
    // eslint-disable-next-line no-console
    console.log(`[design/action] ${action}`, {
      todo: "Wire to backend Phase C Part 6",
      generation_id: generation?.id || null,
      variation_id: activeVariation?.id || null,
    });
  };
  const buttons = [
    { id: "favorite",  Icon: Heart,           label: fav ? "Unfavourite" : "Favourite",
      todo: "TODO: PATCH /api/v2/design/variations/:id { favorited }" },
    { id: "share",     Icon: Share2,          label: "Share",
      todo: "TODO: backend export/share endpoint TBD" },
    { id: "regen",     Icon: RefreshCw,       label: "Regenerate",
      todo: "TODO: POST /api/v2/design/generate { seed_from: variation_id }" },
    { id: "download",  Icon: Download,        label: "Download",
      todo: "Frontend-only: fetch + save the image URL once CORS allows" },
    { id: "upload",    Icon: Upload,          label: "Upload reference",
      todo: "TODO: POST /api/v2/files/upload (multipart)" },
    { id: "more",      Icon: MoreHorizontal,  label: "More",
      todo: "Future: rename, delete, reuse seed, send to chat, etc." },
  ];
  return (
    <div className="shrink-0 flex flex-col gap-2 p-2">
      {buttons.map((b) => (
        <button
          key={b.id}
          type="button"
          onClick={handle(b.id)}
          title={b.label}
          className="w-9 h-9 rounded-full flex items-center justify-center transition-colors"
          style={{
            background: b.id === "favorite" && fav ? `${C.red}22` : "rgba(26,26,26,0.7)",
            color: b.id === "favorite" && fav ? C.red : C.text,
            border: `1px solid ${C.border}`,
            backdropFilter: "blur(8px)",
            WebkitBackdropFilter: "blur(8px)",
          }}
          data-testid={`design-action-${b.id}`}
        >
          <b.Icon className="w-4 h-4" />
        </button>
      ))}
    </div>
  );
}

// ── Canvas ──────────────────────────────────────────────────────────
function SuggestionChips({ onPick }) {
  return (
    <div className="flex flex-wrap justify-center gap-2 mt-4 px-4">
      {SUGGESTIONS.map((s) => (
        <button
          key={s.slice(0, 24)}
          type="button"
          onClick={() => onPick(s)}
          className="max-w-[220px] truncate px-3 py-1.5 rounded-full text-[11px] transition-colors"
          style={{ background: C.surface2, color: C.muted, border: `1px solid ${C.border}` }}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = `${C.accent}40`; e.currentTarget.style.color = C.text; }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.muted; }}
          data-testid="design-suggestion"
        >
          {s}
        </button>
      ))}
    </div>
  );
}

function Canvas({ generation, activeVariationIndex, isGenerating, progress, aspect, onPickSuggestion }) {
  const ratio = ASPECT_RATIOS.find((r) => r.id === aspect) || ASPECT_RATIOS[0];
  const aspectStyle = { aspectRatio: `${ratio.w} / ${ratio.h}` };

  if (isGenerating) {
    return (
      <div className="relative rounded-xl overflow-hidden flex items-center justify-center"
           style={{ ...aspectStyle, background: C.surface2, border: `1px solid ${C.border}`, maxHeight: "70vh" }}>
        {/* Shimmer */}
        <div
          className="absolute inset-0"
          style={{
            background: `linear-gradient(110deg, transparent 0%, ${C.accent}10 50%, transparent 100%)`,
            backgroundSize: "200% 100%",
            animation: "design-shimmer 1.6s linear infinite",
          }}
        />
        {/* Progress text */}
        <div className="relative z-10 text-center px-6">
          <Sparkles className="w-8 h-8 mx-auto mb-3" style={{ color: C.accent }} />
          <div className="text-sm" style={{ color: C.text }}>Generating…</div>
          <div className="text-[11px] font-mono mt-1" style={{ color: C.muted }}>{progress}%</div>
          <div className="text-[10px] mt-2 max-w-[280px] mx-auto" style={{ color: "#555" }}>
            Backend image generation not yet connected — showing stub placeholder.
          </div>
        </div>
        {/* Progress bar at the bottom */}
        <div className="absolute bottom-0 left-0 right-0 h-1" style={{ background: C.surface2 }}>
          <div
            className="h-full transition-all"
            style={{ width: `${progress}%`, background: C.accent, boxShadow: `0 0 10px ${C.accent}88` }}
          />
        </div>
      </div>
    );
  }

  if (!generation || !generation.variations?.length) {
    return (
      <div className="relative rounded-xl flex flex-col items-center justify-center text-center px-8 py-8"
           style={{ ...aspectStyle, background: C.surface2, border: `1px dashed ${C.border}`, maxHeight: "70vh", minHeight: 320 }}>
        <div
          className="w-14 h-14 rounded-2xl mx-auto mb-3 flex items-center justify-center"
          style={{ background: `${C.accent}15`, border: `1px solid ${C.accent}40` }}
        >
          <Sparkles className="w-7 h-7" style={{ color: C.accent }} />
        </div>
        <div className="text-sm font-medium mb-1" style={{ color: C.text }}>Describe what you want to create</div>
        <div className="text-[12px]" style={{ color: C.muted }}>
          Type a prompt below — variations appear here.
        </div>
        {onPickSuggestion && <SuggestionChips onPick={onPickSuggestion} />}
      </div>
    );
  }

  const v = generation.variations[activeVariationIndex] || generation.variations[0];
  return (
    <div className="relative rounded-xl overflow-hidden"
         style={{ ...aspectStyle, background: C.surface2, border: `1px solid ${C.border}`, maxHeight: "70vh" }}>
      <img
        src={v.url}
        alt={generation.prompt}
        className="w-full h-full object-contain"
        draggable={false}
      />
      {/* Make Video pill, bottom-right */}
      <button
        type="button"
        disabled
        title="Coming soon — video generation lands with Phase C Part 6 backend"
        className="absolute bottom-3 right-3 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-medium opacity-60 cursor-not-allowed"
        style={{
          background: "rgba(26,26,26,0.8)",
          color: C.text,
          border: `1px solid ${C.border}`,
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
        }}
        data-testid="design-make-video"
      >
        <Camera className="w-3.5 h-3.5" />
        Make video
      </button>
    </div>
  );
}

// ── Composer bar ────────────────────────────────────────────────────
function ComposerBar({ value, onChange, onSubmit, disabled, placeholder }) {
  const ref = useRef(null);
  const handleKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!disabled && value.trim()) onSubmit();
    }
  };
  return (
    <div
      className="flex items-center gap-2 px-3 py-2 rounded-full"
      style={{ background: C.surface, border: `1px solid ${C.border}` }}
    >
      <button
        type="button"
        title="Upload reference"
        // TODO: hook into addDesignReference once the inspector References
        // tab UI lands in Phase 5.
        onClick={() => { /* eslint-disable-next-line no-console */ console.log("[design/composer] paperclip — Phase 5 will open References tab"); }}
        className="w-9 h-9 shrink-0 rounded-full flex items-center justify-center transition-colors"
        style={{ color: C.muted }}
        data-testid="design-composer-upload"
      >
        <Paperclip className="w-4 h-4" />
      </button>
      <input
        ref={ref}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKey}
        placeholder={placeholder || "Describe your edit, @ to reference…"}
        className="flex-1 bg-transparent outline-none text-[13px]"
        style={{ color: C.text }}
        data-testid="design-composer-input"
      />
      <button
        type="button"
        title="Toggle video output (coming soon)"
        disabled
        className="w-9 h-9 shrink-0 rounded-full flex items-center justify-center opacity-50 cursor-not-allowed"
        style={{ color: C.muted }}
      >
        <Video className="w-4 h-4" />
      </button>
      <button
        type="button"
        onClick={onSubmit}
        disabled={disabled || !value.trim()}
        className="w-9 h-9 shrink-0 rounded-full flex items-center justify-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        style={{
          background: !disabled && value.trim() ? C.accent : C.surface2,
          color: !disabled && value.trim() ? "#fff" : C.muted,
        }}
        data-testid="design-composer-send"
      >
        <Send className="w-4 h-4" />
      </button>
    </div>
  );
}

// ── Studio mode ─────────────────────────────────────────────────────
function StudioMode() {
  const {
    design,
    setDesignActiveVariation,
    setDesignComposerInput,
    generateDesign,
  } = useGateway();
  const { activeGeneration, activeVariationIndex, isGenerating, generationProgress, composer, settings } = design;
  const activeVariation = activeGeneration?.variations?.[activeVariationIndex] || null;

  const handleSubmit = async () => {
    const prompt = (composer.input || "").trim();
    if (!prompt || isGenerating) return;
    await generateDesign(prompt);
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Canvas row: variation strip + canvas + action rail */}
      <div className="flex-1 flex items-stretch overflow-hidden p-4 gap-2">
        <VariationStrip
          generation={activeGeneration}
          activeIndex={activeVariationIndex}
          onSelect={setDesignActiveVariation}
        />
        <div className="flex-1 flex items-center justify-center min-w-0">
          <div className="w-full max-w-3xl">
            <Canvas
              generation={activeGeneration}
              activeVariationIndex={activeVariationIndex}
              isGenerating={isGenerating}
              progress={generationProgress}
              aspect={settings.aspect_ratio}
              onPickSuggestion={(s) => setDesignComposerInput(s)}
            />
          </div>
        </div>
        <ActionRail generation={activeGeneration} activeVariation={activeVariation} />
      </div>

      {/* Composer */}
      <div className="shrink-0 px-4 pb-4">
        <div className="max-w-3xl mx-auto">
          <ComposerBar
            value={composer.input}
            onChange={setDesignComposerInput}
            onSubmit={handleSubmit}
            disabled={isGenerating}
            placeholder={
              isGenerating ? "Generating — please wait…"
              : activeGeneration ? "Describe your edit, @ to reference…"
              : "Describe what you want to create…"
            }
          />
          {activeGeneration && !isGenerating && (
            <div className="text-[10px] mt-2 px-3 truncate" style={{ color: C.muted }}>
              Last prompt: <span style={{ color: C.text, opacity: 0.85 }}>{activeGeneration.prompt}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Gallery / Chat stubs (Phase 3 + Phase 4) ────────────────────────
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
          card-grid render here.
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

// ── Inspector ───────────────────────────────────────────────────────
function InspectorTabs({ tab, onChange }) {
  const TABS = [
    { id: "settings",   label: "Settings"   },
    { id: "history",    label: "History"    },
    { id: "references", label: "References" },
  ];
  return (
    <div className="flex items-center gap-1 px-2 py-2"
         style={{ borderBottom: `1px solid ${C.border}` }}>
      {TABS.map((t) => {
        const active = tab === t.id;
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => onChange(t.id)}
            className="flex-1 px-2 py-1.5 rounded-md text-[11px] font-medium transition-colors"
            style={{
              background: active ? `${C.accent}22` : "transparent",
              color: active ? C.text : C.muted,
              border: `1px solid ${active ? `${C.accent}44` : "transparent"}`,
            }}
            data-testid={`design-inspector-tab-${t.id}`}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

function SettingsTab() {
  const { design, updateDesignSettings } = useGateway();
  const { settings } = design;

  const Section = ({ label, children }) => (
    <div className="mb-5">
      <div className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: C.muted }}>
        {label}
      </div>
      {children}
    </div>
  );

  return (
    <div className="p-4 overflow-y-auto">
      {/* Aspect ratio */}
      <Section label="Aspect ratio">
        <div className="grid grid-cols-3 gap-1.5">
          {ASPECT_RATIOS.map((r) => {
            const active = settings.aspect_ratio === r.id;
            return (
              <button
                key={r.id}
                type="button"
                onClick={() => updateDesignSettings({ aspect_ratio: r.id })}
                className="px-2 py-2 rounded-md text-[11px] font-medium transition-colors flex flex-col items-center gap-1"
                style={{
                  background: active ? `${C.accent}22` : C.surface2,
                  color: active ? C.text : C.muted,
                  border: `1px solid ${active ? `${C.accent}44` : C.border}`,
                }}
                data-testid={`design-aspect-${r.id}`}
              >
                <div
                  className="rounded-sm"
                  style={{
                    width: 22,
                    height: 22 * (r.h / r.w),
                    background: active ? C.accent : C.muted,
                    opacity: 0.7,
                  }}
                />
                <span>{r.label}</span>
              </button>
            );
          })}
        </div>
      </Section>

      {/* Quality */}
      <Section label="Quality">
        <div className="flex gap-1">
          {QUALITY_LEVELS.map((q) => {
            const active = settings.quality === q.id;
            return (
              <button
                key={q.id}
                type="button"
                onClick={() => updateDesignSettings({ quality: q.id })}
                className="flex-1 px-2 py-1.5 rounded-md text-[11px] font-medium transition-colors"
                style={{
                  background: active ? `${C.accent}22` : C.surface2,
                  color: active ? C.text : C.muted,
                  border: `1px solid ${active ? `${C.accent}44` : C.border}`,
                }}
                title={q.desc}
                data-testid={`design-quality-${q.id}`}
              >
                {q.label}
              </button>
            );
          })}
        </div>
      </Section>

      {/* Number of variations */}
      <Section label="Variations">
        <div className="flex gap-1">
          {NUM_VARIATIONS.map((n) => {
            const active = settings.num_variations === n;
            return (
              <button
                key={n}
                type="button"
                onClick={() => updateDesignSettings({ num_variations: n })}
                className="flex-1 px-2 py-1.5 rounded-md text-[11px] font-mono transition-colors"
                style={{
                  background: active ? `${C.accent}22` : C.surface2,
                  color: active ? C.text : C.muted,
                  border: `1px solid ${active ? `${C.accent}44` : C.border}`,
                }}
                data-testid={`design-num-${n}`}
              >
                {n}
              </button>
            );
          })}
        </div>
      </Section>

      {/* Seed */}
      <Section label="Seed">
        <div className="flex gap-1.5">
          <input
            type="number"
            value={settings.seed ?? ""}
            onChange={(e) => updateDesignSettings({ seed: e.target.value === "" ? null : Number(e.target.value) })}
            placeholder="random"
            className="flex-1 px-2 py-1.5 rounded-md text-[12px] font-mono bg-transparent outline-none"
            style={{ background: C.surface2, border: `1px solid ${C.border}`, color: C.text }}
            data-testid="design-seed-input"
          />
          <button
            type="button"
            onClick={() => updateDesignSettings({ seed: Math.floor(Math.random() * 1e6) })}
            title="Randomise seed"
            className="px-2.5 rounded-md flex items-center justify-center"
            style={{ background: C.surface2, color: C.muted, border: `1px solid ${C.border}` }}
            data-testid="design-seed-random"
          >
            <Dices className="w-3.5 h-3.5" />
          </button>
        </div>
      </Section>

      {/* Negative prompt */}
      <Section label="Negative prompt">
        <textarea
          value={settings.negative_prompt}
          onChange={(e) => updateDesignSettings({ negative_prompt: e.target.value })}
          placeholder="Things to avoid in the image…"
          rows={3}
          className="w-full px-2 py-1.5 rounded-md text-[12px] outline-none resize-none"
          style={{ background: C.surface2, border: `1px solid ${C.border}`, color: C.text }}
          data-testid="design-negative-prompt"
        />
      </Section>

      {/* Model — placeholder until image-capable model picker is built */}
      <Section label="Model">
        <div className="text-[11px] px-2 py-2 rounded-md font-mono"
             style={{ background: C.surface2, color: C.muted, border: `1px solid ${C.border}` }}>
          {/* TODO: filter ModelSelector to vision/image-capable models when
              backend exposes that capability flag in /api/v2/models/groups */}
          {settings.model || "auto-pick (not yet wired)"}
        </div>
      </Section>
    </div>
  );
}

function HistoryTab() {
  const { design, setDesignActiveGeneration } = useGateway();
  const { history, activeGeneration } = design;
  if (history.length === 0) {
    return (
      <div className="p-4 text-[12px] text-center" style={{ color: C.muted }}>
        No generations yet. Type a prompt in Studio mode to start.
      </div>
    );
  }
  return (
    <div className="p-2 overflow-y-auto">
      {history.map((g) => {
        const active = activeGeneration?.id === g.id;
        const thumb = g.variations?.[0]?.url;
        return (
          <button
            key={g.id}
            type="button"
            onClick={() => setDesignActiveGeneration(g)}
            className="w-full flex items-center gap-2 p-2 rounded-md mb-1 text-left transition-colors"
            style={{
              background: active ? `${C.accent}18` : "transparent",
              border: `1px solid ${active ? `${C.accent}44` : "transparent"}`,
            }}
            data-testid={`design-history-${g.id}`}
          >
            <div className="w-10 h-10 shrink-0 rounded-md overflow-hidden"
                 style={{ background: C.surface2, border: `1px solid ${C.border}` }}>
              {thumb && <img src={thumb} alt="" className="w-full h-full object-cover" loading="lazy" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[12px] truncate" style={{ color: C.text }}>{g.prompt}</div>
              <div className="text-[10px] font-mono" style={{ color: C.muted }}>
                {g.aspect_ratio} · {g.variations?.length || 0} variations
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

function ReferencesTab() {
  return (
    <div className="p-4 text-[12px] text-center" style={{ color: C.muted }}>
      References tab — Phase 5. Drag-and-drop reference upload + @-mention picker
      land here once the composer mention flow is built.
    </div>
  );
}

function InspectorPanel() {
  const { design, toggleDesignInspector, setDesignInspectorTab } = useGateway();
  if (!design.inspector.open) return null;
  const { tab } = design.inspector;
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
      <InspectorTabs tab={tab} onChange={setDesignInspectorTab} />
      <div className="flex-1 overflow-hidden">
        {tab === "settings"   && <SettingsTab   />}
        {tab === "history"    && <HistoryTab    />}
        {tab === "references" && <ReferencesTab />}
      </div>
    </aside>
  );
}

// ── Page ────────────────────────────────────────────────────────────
// Inject the shimmer keyframes once at module load — keyframes can't live
// in inline styles. Re-running the same string is a no-op for the browser.
function ensureShimmerKeyframes() {
  if (typeof document === "undefined") return;
  if (document.getElementById("design-shimmer-keyframes")) return;
  const style = document.createElement("style");
  style.id = "design-shimmer-keyframes";
  style.textContent = `@keyframes design-shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }`;
  document.head.appendChild(style);
}

export default function DesignPage() {
  const { design, setDesignMode, toggleDesignInspector } = useGateway();
  const { mode, inspector } = design;

  useEffect(() => { ensureShimmerKeyframes(); }, []);

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
