/**
 * Phase 6.D — Memory (shell)
 *
 * Route: /memory
 * Non-coder visible: every long-term memory fact that Mietorè holds — global,
 * per-project, per-thread, per-skill — listed, scoped, filterable, and (once
 * FE Wiring lands the writeable endpoints) editable from the UI.
 *
 * Replaces "edit MEMORY.md in a text editor". From the PRODUCT_MISSION
 * non-coder test (mandatory dispatch gate):
 *
 *     ❌ "Edit `MEMORY.md` to add a fact"
 *     ✅ "Memory is editable in the Memory page UI"
 *
 * Wiring targets (when FE Wiring lands):
 *   GET  /api/v2/memory/scopes                       �� ["global","project:<id>","thread:<id>","skill:<id>"]
 *   GET  /api/v2/memory/list?scope=&q=&since=&until=  → rolling list of facts
 *   POST /api/v2/memory/add        body: { scope, text, tags? }
 *   PUT  /api/v2/memory/:id        body: { text?, tags?, pinned? }
 *   DEL  /api/v2/memory/:id
 *   WS   memory.changed            → broadcast on any add/edit/delete
 *
 * This is SHELL ONLY — scope chrome, search bar, empty states, theme,
 * placeholder list rows, and a disabled "Add fact" composer that mc-fe-wiring
 * will hook up. No fetch wired, no mock fact data injected. Every row is
 * sourced from `[]` and the empty state advertises the wiring target.
 *
 * Theme: locked Mietorè tokens — warm-black (#0A0807) surface, hairline gold
 * (#D9A24C) borders, cyan (#22D3DB) accent-2 for the "live" indicators,
 * glassmorphism with backdrop-filter blur, gold→cyan gradient header.
 *
 * Phase 6.D (cross-session memory) is ✅ on the backend — the Memory page
 * gives it a non-coder face for the first time. Until FE Wiring lands the
 * endpoints above, every scope still renders the explicit empty state so it
 * is honest about its un-wired status. No mock rows. No `JSON.stringify`.
 */

import React, { useState } from "react";
import {
  Brain, Search, Plus, Globe, Folder, MessageSquare, Sparkles,
  Pin, Tag, Clock, Pencil, Trash2, ChevronRight, AlertCircle,
} from "lucide-react";

// Scope chrome — every scope ships disabled+empty until /api/v2/memory/list
// is reachable. FE Wiring will populate `count` from /api/v2/memory/scopes.
const SCOPES = [
  { id: "global",  label: "Global",   Icon: Globe,         hint: "Facts true across every project, every thread." },
  { id: "project", label: "Projects", Icon: Folder,        hint: "Per-project facts — pulled when that space is active." },
  { id: "thread",  label: "Threads",  Icon: MessageSquare, hint: "Per-thread facts — local to a single conversation." },
  { id: "skill",   label: "Skills",   Icon: Sparkles,      hint: "Facts attached to a skill (e.g. /deep-research)." },
];

const RANGES = [
  { id: "today", label: "Today" },
  { id: "7d",    label: "7 days" },
  { id: "30d",   label: "30 days" },
  { id: "all",   label: "All time" },
];

function ScopeChip({ scope, active, onClick }) {
  const Icon = scope.Icon;
  return (
    <button
      type="button"
      onClick={onClick}
      data-testid={`memory-scope-${scope.id}`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 7,
        padding: "7px 13px",
        borderRadius: 999,
        background: active ? "var(--mc-accent-soft)" : "var(--mc-bg-1)",
        border: `1px solid ${active ? "var(--mc-line-strong)" : "var(--mc-line)"}`,
        color: active ? "var(--mc-accent)" : "var(--mc-fg-2)",
        fontSize: 11,
        fontWeight: active ? 700 : 500,
        letterSpacing: 0.3,
        cursor: "pointer",
        transition: "all 0.15s ease",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
      }}
    >
      <Icon size={12} strokeWidth={2} /> {scope.label}
    </button>
  );
}

function StatPill({ label, value, accent }) {
  return (
    <div
      style={{
        flex: 1,
        minWidth: 140,
        padding: "14px 16px",
        background: "var(--mc-bg-1)",
        border: "1px solid var(--mc-line)",
        borderRadius: "var(--mc-radius-md, 10px)",
        backdropFilter: "blur(10px)",
        WebkitBackdropFilter: "blur(10px)",
      }}
    >
      <div
        style={{
          fontSize: 10,
          letterSpacing: 1.4,
          textTransform: "uppercase",
          color: "var(--mc-fg-2)",
          fontWeight: 600,
          marginBottom: 6,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: "var(--mc-font-display, inherit)",
          fontSize: 24,
          fontWeight: 700,
          color: accent || "var(--mc-fg)",
        }}
      >
        {value}
      </div>
    </div>
  );
}

function EmptyState({ scope }) {
  const Icon = scope.Icon;
  return (
    <div
      data-testid="memory-empty-state"
      style={{
        padding: "44px 24px",
        textAlign: "center",
        background: "var(--mc-bg-1)",
        border: "1px dashed var(--mc-line-strong)",
        borderRadius: "var(--mc-radius-lg, 14px)",
        color: "var(--mc-fg-2)",
        backdropFilter: "blur(10px)",
        WebkitBackdropFilter: "blur(10px)",
      }}
    >
      <Icon
        size={28}
        strokeWidth={1.5}
        style={{ color: "var(--mc-accent)", opacity: 0.65, marginBottom: 10 }}
      />
      <div
        style={{
          fontFamily: "var(--mc-font-display, inherit)",
          fontSize: 15,
          fontWeight: 600,
          color: "var(--mc-fg)",
          marginBottom: 5,
        }}
      >
        No {scope.label.toLowerCase()} memory yet
      </div>
      <div style={{ fontSize: 12, lineHeight: 1.55, maxWidth: 460, margin: "0 auto" }}>
        {scope.hint}
        <br />
        Add the first fact below — or wait for Mietorè to learn one across
        a thread and surface it here automatically.
      </div>
      <div
        style={{
          marginTop: 14,
          fontFamily: "var(--mc-font-mono, monospace)",
          fontSize: 10,
          color: "var(--mc-fg-3)",
          letterSpacing: 0.3,
        }}
      >
        wiring: GET /api/v2/memory/list?scope={scope.id}
      </div>
    </div>
  );
}

function FactRowSkeleton() {
  // Pure presentational hint — never rendered with mock data. Kept here so
  // FE Wiring drops its real row component into the same shape (avatar, body,
  // tag-row, ts, actions) once /api/v2/memory/list returns rows. Until then
  // we render the EmptyState above instead.
  return null;
}

function PlaceholderComposer() {
  return (
    <div
      data-testid="memory-composer"
      style={{
        padding: 14,
        background: "var(--mc-bg-1)",
        border: "1px solid var(--mc-line)",
        borderRadius: "var(--mc-radius-md, 10px)",
        backdropFilter: "blur(10px)",
        WebkitBackdropFilter: "blur(10px)",
      }}
    >
      <div
        style={{
          fontSize: 10,
          letterSpacing: 1.2,
          textTransform: "uppercase",
          color: "var(--mc-fg-2)",
          fontWeight: 600,
          marginBottom: 8,
        }}
      >
        Add a fact
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr auto",
          gap: 10,
          alignItems: "center",
        }}
      >
        <input
          type="text"
          disabled
          placeholder="e.g. Meg's primary editor is VS Code  ·  Mietorè prefers Inter font  ·  …"
          style={{
            width: "100%",
            padding: "9px 12px",
            background: "var(--mc-bg-2)",
            border: "1px solid var(--mc-line)",
            borderRadius: 8,
            color: "var(--mc-fg-2)",
            fontSize: 12,
            outline: "none",
          }}
        />
        <button
          type="button"
          disabled
          data-testid="memory-add-btn"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "9px 14px",
            background: "var(--mc-accent-soft)",
            border: "1px solid var(--mc-line-strong)",
            borderRadius: 8,
            color: "var(--mc-accent)",
            fontSize: 12,
            fontWeight: 600,
            cursor: "not-allowed",
            opacity: 0.7,
          }}
        >
          <Plus size={13} strokeWidth={2} /> Add
        </button>
      </div>
      <div
        style={{
          marginTop: 8,
          fontSize: 10,
          letterSpacing: 0.2,
          color: "var(--mc-fg-3)",
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
        }}
      >
        <AlertCircle size={11} strokeWidth={2} />
        Wiring pending — mc-fe-wiring will hook this to POST /api/v2/memory/add.
      </div>
    </div>
  );
}

export default function MemoryPage() {
  const [scope, setScope] = useState("global");
  const [range, setRange] = useState("all");
  const [query, setQuery] = useState("");

  const activeScope = SCOPES.find((s) => s.id === scope) || SCOPES[0];

  // Until /api/v2/memory/list is wired, every list is empty. We do not inject
  // mock rows — the empty-state pattern is the honest surface.
  const rows = [];

  return (
    <div
      style={{
        padding: "28px 36px 64px",
        maxWidth: 1080,
        margin: "0 auto",
        overflowY: "auto",
        height: "100%",
        color: "var(--mc-fg)",
      }}
    >
      {/* Header */}
      <header style={{ marginBottom: 22 }}>
        <h1
          style={{
            margin: 0,
            fontFamily: "var(--mc-font-display, inherit)",
            fontSize: 28,
            fontWeight: 700,
            letterSpacing: -0.5,
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
        >
          <span
            style={{
              background:
                "linear-gradient(135deg, var(--mc-accent) 0%, var(--mc-accent-2) 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            Memory
          </span>
          <Brain size={20} style={{ color: "var(--mc-accent)" }} />
        </h1>
        <p
          style={{
            marginTop: 6,
            fontSize: 13,
            color: "var(--mc-fg-2)",
            maxWidth: 760,
          }}
        >
          Every fact Mietorè holds about Meg, her projects, her threads, and her
          skills — visible, scoped, searchable, and (soon) editable in-app.
          Replaces opening <code style={{ fontFamily: "var(--mc-font-mono, monospace)", fontSize: 12, color: "var(--mc-accent-2)" }}>MEMORY.md</code> in
          a text editor.
        </p>
      </header>

      {/* Stat strip — totals come from /api/v2/memory/list when wired. */}
      <section
        style={{
          display: "flex",
          gap: 12,
          flexWrap: "wrap",
          marginBottom: 18,
        }}
      >
        <StatPill label="Total facts"    value="—" />
        <StatPill label="Pinned"         value="—" accent="var(--mc-accent)" />
        <StatPill label="Added (7d)"     value="—" accent="var(--mc-accent-2)" />
        <StatPill label="Active scopes"  value={SCOPES.length} />
      </section>

      {/* Scope row */}
      <section
        style={{
          padding: 16,
          background: "var(--mc-bg-1)",
          border: "1px solid var(--mc-line)",
          borderRadius: "var(--mc-radius-lg, 14px)",
          backdropFilter: "blur(10px)",
          WebkitBackdropFilter: "blur(10px)",
          marginBottom: 16,
        }}
      >
        <div
          style={{
            fontSize: 10,
            letterSpacing: 1.2,
            textTransform: "uppercase",
            color: "var(--mc-fg-3)",
            fontWeight: 600,
            marginBottom: 10,
          }}
        >
          Scope
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {SCOPES.map((s) => (
            <ScopeChip
              key={s.id}
              scope={s}
              active={scope === s.id}
              onClick={() => setScope(s.id)}
            />
          ))}
        </div>

        {/* Search + range row */}
        <div
          style={{
            marginTop: 14,
            display: "grid",
            gridTemplateColumns: "1fr auto",
            gap: 10,
            alignItems: "center",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "8px 12px",
              background: "var(--mc-bg-2)",
              border: "1px solid var(--mc-line)",
              borderRadius: 8,
            }}
          >
            <Search size={13} strokeWidth={2} style={{ color: "var(--mc-fg-3)" }} />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={`Search ${activeScope.label.toLowerCase()} memory…`}
              data-testid="memory-search"
              style={{
                flex: 1,
                background: "transparent",
                border: "none",
                outline: "none",
                color: "var(--mc-fg)",
                fontSize: 12,
              }}
            />
          </div>
          <div style={{ display: "inline-flex", gap: 5 }}>
            {RANGES.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => setRange(r.id)}
                data-testid={`memory-range-${r.id}`}
                style={{
                  padding: "6px 11px",
                  borderRadius: 999,
                  background:
                    range === r.id ? "var(--mc-accent-soft)" : "var(--mc-bg-2)",
                  border: `1px solid ${
                    range === r.id ? "var(--mc-line-strong)" : "var(--mc-line)"
                  }`,
                  color: range === r.id ? "var(--mc-accent)" : "var(--mc-fg-2)",
                  fontSize: 10,
                  fontWeight: range === r.id ? 700 : 500,
                  letterSpacing: 0.3,
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                }}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Composer (disabled until wiring) */}
      <section style={{ marginBottom: 18 }}>
        <PlaceholderComposer />
      </section>

      {/* Active scope header */}
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 10,
        }}
      >
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            fontFamily: "var(--mc-font-display, inherit)",
            fontSize: 14,
            fontWeight: 700,
            color: "var(--mc-fg)",
            letterSpacing: -0.2,
          }}
        >
          <activeScope.Icon size={14} style={{ color: "var(--mc-accent)" }} />
          {activeScope.label}
          <ChevronRight size={12} style={{ color: "var(--mc-fg-3)" }} />
          <span
            style={{
              fontFamily: "var(--mc-font-mono, monospace)",
              fontSize: 11,
              color: "var(--mc-fg-2)",
              fontWeight: 500,
            }}
          >
            {rows.length} fact{rows.length === 1 ? "" : "s"}
          </span>
        </div>
        <div
          style={{
            fontSize: 10,
            letterSpacing: 0.3,
            color: "var(--mc-fg-3)",
            display: "inline-flex",
            alignItems: "center",
            gap: 5,
          }}
        >
          <Clock size={11} />
          range: {range}
        </div>
      </header>

      {/* List body */}
      <section data-testid="memory-list">
        {rows.length === 0 ? (
          <EmptyState scope={activeScope} />
        ) : (
          rows.map((r) => <FactRowSkeleton key={r.id} row={r} />)
        )}
      </section>

      {/* Wiring footer */}
      <footer
        style={{
          marginTop: 22,
          padding: "12px 16px",
          background: "var(--mc-bg-1)",
          border: "1px dashed var(--mc-line)",
          borderRadius: "var(--mc-radius-md, 10px)",
          fontSize: 11,
          color: "var(--mc-fg-3)",
          lineHeight: 1.5,
          fontFamily: "var(--mc-font-mono, monospace)",
        }}
      >
        Shell only — mc-fe-wiring binds GET /api/v2/memory/list, POST
        /api/v2/memory/add, PUT&nbsp;/api/v2/memory/:id, DEL&nbsp;/api/v2/memory/:id,
        and WS topic <code style={{ color: "var(--mc-accent-2)" }}>memory.changed</code>.
        This page never has to change once the contract lands.
      </footer>
    </div>
  );
}
