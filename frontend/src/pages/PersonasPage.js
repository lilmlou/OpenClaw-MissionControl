/**
 * Phase I — Persona System (SHELL ONLY)
 *
 * Route: /personas
 * Non-coder visible: switching between Dev / Personal / Research personas
 * happens with a tap from inside the app — no editing config files, no
 * markdown, no terminal. This is the surface Meg uses to:
 *   - see which persona is active
 *   - browse, preview, and pick a persona for a given Space / Thread
 *   - create / edit / delete personas
 *   - see per-persona model defaults, memory scopes, skill enables
 *
 * Wiring targets (when Phase I backend lands — FE Wiring's job, NOT this PR):
 *   GET  /api/v2/personas              → list
 *   GET  /api/v2/personas/active       → currently bound persona for active space/thread
 *   POST /api/v2/personas              → create
 *   PUT  /api/v2/personas/:id          → update
 *   DELETE /api/v2/personas/:id        → delete
 *   POST /api/v2/personas/:id/activate → bind to active space/thread
 *   WS   personas.changed              → live broadcast
 *
 * This file is SHELL ONLY:
 *   - placeholder personas (Dev / Personal / Research) hard-coded for layout
 *   - no fetches, no mutations, no useGateway calls — FE Wiring plugs that in
 *   - all interactive controls render but no-op (console.log for now)
 *   - empty / error / loading states defined so wiring can drop in cleanly
 *
 * Theme: locked Mietorè tokens only — warm-black surface, hairline gold
 * borders, gold accent, cyan for live indicators, glassmorphism for the
 * preview panel. NO raw hex colors — every color goes through var(--mc-*).
 */

import React, { useMemo, useState } from "react";
import {
  Users, Plus, Search, Check, Settings, Trash2, ChevronRight,
  Code2, Heart, FlaskConical, Sparkles, Brain, Wrench, Shield, Layers,
} from "lucide-react";

// ── Placeholder data — three default personas the backend will eventually own.
// Hard-coded here so the page renders before FE Wiring lands. Do NOT use this
// data in any test as "real" — it is layout fodder only.
const PLACEHOLDER_PERSONAS = [
  {
    id: "persona-dev",
    name: "Dev",
    tagline: "Engineering, code, ship-it mode",
    Icon: Code2,
    accent: "var(--mc-accent)",
    active: true,
    defaults: {
      model: "Auto · code-class",
      temperature: 0.2,
      memoryScope: "Project + Global",
      skills: ["repo.read", "repo.write", "shell.exec", "tests.run"],
      personality: "Terse. Diff-first. No prose padding.",
    },
  },
  {
    id: "persona-personal",
    name: "Personal",
    tagline: "Day-to-day, journal, life admin",
    Icon: Heart,
    accent: "var(--mc-accent-2)",
    active: false,
    defaults: {
      model: "Auto · conversational",
      temperature: 0.7,
      memoryScope: "Personal only",
      skills: ["calendar.read", "notes.write", "qudos.observe"],
      personality: "Warm. Curious. Asks before acting.",
    },
  },
  {
    id: "persona-research",
    name: "Research",
    tagline: "Long-context, citations, deep dives",
    Icon: FlaskConical,
    accent: "var(--mc-accent)",
    active: false,
    defaults: {
      model: "Auto · long-context",
      temperature: 0.4,
      memoryScope: "Project + Web cache",
      skills: ["web.search", "web.scrape", "pdf.read", "cite.build"],
      personality: "Source-cited. Hedged when uncertain.",
    },
  },
];

// ── Sub-components ────────────────────────────────────────────────────────

function PersonaCard({ persona, selected, onSelect, onActivate }) {
  const Icon = persona.Icon || Users;
  const isActive = persona.active;
  const isSelected = selected;
  return (
    <button
      type="button"
      onClick={onSelect}
      data-testid={`persona-card-${persona.id}`}
      style={{
        textAlign: "left",
        width: "100%",
        padding: "16px",
        borderRadius: "var(--mc-radius-lg)",
        background: isSelected
          ? "var(--mc-bg-3, var(--mc-bg-2))"
          : "var(--mc-bg-2)",
        border: `1px solid ${isSelected ? "var(--mc-line-strong)" : "var(--mc-line)"}`,
        boxShadow: isSelected
          ? "0 0 0 1px var(--mc-line-strong), 0 12px 36px rgba(0,0,0,0.45)"
          : "none",
        cursor: "pointer",
        transition: "border-color 140ms ease, box-shadow 140ms ease, background 140ms ease",
        display: "flex",
        flexDirection: "column",
        gap: 10,
        position: "relative",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span
          style={{
            width: 36,
            height: 36,
            borderRadius: "var(--mc-radius-md)",
            background: "var(--mc-bg-1)",
            border: "1px solid var(--mc-line)",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            color: persona.accent || "var(--mc-accent)",
            boxShadow: "inset 0 1px 0 rgba(252, 230, 184, 0.06)",
          }}
        >
          <Icon size={18} strokeWidth={1.75} />
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontFamily: "var(--mc-font-display, serif)",
              fontSize: 17,
              color: "var(--mc-fg)",
              letterSpacing: "-0.01em",
            }}
          >
            {persona.name}
          </div>
          <div
            style={{
              fontSize: 11,
              color: "var(--mc-fg-2)",
              marginTop: 2,
              letterSpacing: 0.2,
            }}
          >
            {persona.tagline}
          </div>
        </div>
        {isActive && (
          <span
            data-testid={`persona-active-pill-${persona.id}`}
            style={{
              fontSize: 9,
              fontWeight: 700,
              letterSpacing: "0.15em",
              textTransform: "uppercase",
              padding: "3px 8px",
              borderRadius: "var(--mc-radius-full)",
              background: "var(--mc-accent-2-soft, rgba(34,211,219,0.12))",
              color: "var(--mc-accent-2)",
              border: "1px solid var(--mc-accent-2)",
              boxShadow: "0 0 12px rgba(34, 211, 219, 0.25)",
            }}
          >
            Active
          </span>
        )}
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "auto 1fr",
          rowGap: 4,
          columnGap: 10,
          fontSize: 11,
          color: "var(--mc-fg-2)",
        }}
      >
        <span style={{ color: "var(--mc-fg-3)" }}>Model</span>
        <span style={{ fontFamily: "var(--mc-font-mono, monospace)", color: "var(--mc-fg-1)" }}>
          {persona.defaults.model}
        </span>
        <span style={{ color: "var(--mc-fg-3)" }}>Memory</span>
        <span style={{ color: "var(--mc-fg-1)" }}>{persona.defaults.memoryScope}</span>
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginTop: 4,
        }}
      >
        <span style={{ fontSize: 10, color: "var(--mc-fg-3)" }}>
          {persona.defaults.skills.length} skills enabled
        </span>
        {!isActive && (
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => {
              e.stopPropagation();
              onActivate && onActivate(persona);
            }}
            data-testid={`persona-activate-${persona.id}`}
            style={{
              fontSize: 10,
              fontWeight: 600,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "var(--mc-accent)",
              padding: "4px 10px",
              borderRadius: "var(--mc-radius-full)",
              border: "1px solid var(--mc-line-strong)",
              background: "var(--mc-accent-soft, rgba(217,162,76,0.10))",
              cursor: "pointer",
            }}
          >
            Activate
          </span>
        )}
      </div>
    </button>
  );
}

function DetailRow({ label, value, mono }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "120px 1fr",
        gap: 12,
        padding: "10px 0",
        borderBottom: "1px solid var(--mc-line-divide, var(--mc-line))",
      }}
    >
      <div
        style={{
          fontSize: 10,
          textTransform: "uppercase",
          letterSpacing: "0.15em",
          color: "var(--mc-fg-3)",
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 13,
          color: "var(--mc-fg-1)",
          fontFamily: mono ? "var(--mc-font-mono, monospace)" : "inherit",
          fontVariantNumeric: mono ? "tabular-nums" : "normal",
        }}
      >
        {value}
      </div>
    </div>
  );
}

function PersonaDetailPanel({ persona, onEdit, onDelete, onActivate }) {
  if (!persona) {
    return (
      <div
        data-testid="persona-detail-empty"
        style={{
          padding: 32,
          textAlign: "center",
          color: "var(--mc-fg-3)",
          fontSize: 13,
          borderRadius: "var(--mc-radius-lg)",
          background: "var(--mc-bg-2)",
          border: "1px solid var(--mc-line)",
        }}
      >
        Select a persona on the left to preview its defaults.
      </div>
    );
  }
  const Icon = persona.Icon || Users;
  return (
    <div
      data-testid={`persona-detail-${persona.id}`}
      style={{
        padding: 20,
        borderRadius: "var(--mc-radius-lg)",
        background: "var(--mc-glass-bg, rgba(28,24,18,0.55))",
        backdropFilter: "blur(20px) saturate(140%)",
        WebkitBackdropFilter: "blur(20px) saturate(140%)",
        border: "1px solid var(--mc-line-strong)",
        boxShadow: "inset 0 1px 0 rgba(252, 230, 184, 0.08), 0 20px 60px rgba(0,0,0,0.55)",
        display: "flex",
        flexDirection: "column",
        gap: 16,
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
        <span
          style={{
            width: 48,
            height: 48,
            borderRadius: "var(--mc-radius-md)",
            background: "var(--mc-bg-1)",
            border: "1px solid var(--mc-line-strong)",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            color: persona.accent || "var(--mc-accent)",
            boxShadow: "0 0 24px rgba(217, 162, 76, 0.18)",
          }}
        >
          <Icon size={22} strokeWidth={1.6} />
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontFamily: "var(--mc-font-display, serif)",
              fontSize: 22,
              color: "var(--mc-fg-gold, var(--mc-accent))",
              letterSpacing: "-0.01em",
            }}
          >
            {persona.name}
          </div>
          <div style={{ fontSize: 12, color: "var(--mc-fg-2)", marginTop: 4 }}>
            {persona.tagline}
          </div>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {!persona.active && (
            <button
              type="button"
              onClick={() => onActivate && onActivate(persona)}
              data-testid={`persona-detail-activate-${persona.id}`}
              style={{
                fontSize: 11,
                fontWeight: 600,
                padding: "6px 12px",
                borderRadius: "var(--mc-radius-md)",
                background: "var(--mc-accent)",
                color: "var(--mc-accent-fg, #0A0807)",
                border: "1px solid var(--mc-accent)",
                cursor: "pointer",
              }}
            >
              Activate
            </button>
          )}
          <button
            type="button"
            onClick={() => onEdit && onEdit(persona)}
            data-testid={`persona-detail-edit-${persona.id}`}
            aria-label="Edit persona"
            style={{
              padding: "6px 8px",
              borderRadius: "var(--mc-radius-md)",
              background: "transparent",
              color: "var(--mc-fg-2)",
              border: "1px solid var(--mc-line)",
              cursor: "pointer",
            }}
          >
            <Settings size={14} />
          </button>
          <button
            type="button"
            onClick={() => onDelete && onDelete(persona)}
            data-testid={`persona-detail-delete-${persona.id}`}
            aria-label="Delete persona"
            style={{
              padding: "6px 8px",
              borderRadius: "var(--mc-radius-md)",
              background: "transparent",
              color: "var(--mc-fg-2)",
              border: "1px solid var(--mc-line)",
              cursor: "pointer",
            }}
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      <div>
        <DetailRow label="Model" value={persona.defaults.model} mono />
        <DetailRow label="Temperature" value={persona.defaults.temperature} mono />
        <DetailRow label="Memory" value={persona.defaults.memoryScope} />
        <DetailRow
          label="Skills"
          value={
            <span style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {persona.defaults.skills.map((s) => (
                <span
                  key={s}
                  style={{
                    fontSize: 10,
                    fontFamily: "var(--mc-font-mono, monospace)",
                    padding: "3px 8px",
                    borderRadius: "var(--mc-radius-full)",
                    background: "var(--mc-bg-1)",
                    color: "var(--mc-fg-1)",
                    border: "1px solid var(--mc-line)",
                  }}
                >
                  {s}
                </span>
              ))}
            </span>
          }
        />
        <DetailRow label="Voice" value={persona.defaults.personality} />
      </div>

      <div
        style={{
          fontSize: 10,
          color: "var(--mc-fg-3)",
          fontStyle: "italic",
          paddingTop: 4,
        }}
        data-testid="persona-shell-note"
      >
        Shell preview — live persona data lands when Phase I backend ships
        (<code style={{ fontFamily: "var(--mc-font-mono, monospace)" }}>
          GET /api/v2/personas
        </code>).
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────

export default function PersonasPage() {
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState(PLACEHOLDER_PERSONAS[0].id);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return PLACEHOLDER_PERSONAS;
    return PLACEHOLDER_PERSONAS.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.tagline.toLowerCase().includes(q),
    );
  }, [search]);

  const selected = useMemo(
    () => PLACEHOLDER_PERSONAS.find((p) => p.id === selectedId) || filtered[0] || null,
    [selectedId, filtered],
  );

  // No-op handlers — FE Wiring will replace with real mutations.
  const noop = (label) => (p) => {
    // eslint-disable-next-line no-console
    console.info(`[PersonasPage shell] ${label}`, p?.id || p);
  };

  return (
    <div
      data-testid="personas-page"
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        color: "var(--mc-fg)",
        fontFamily: "var(--mc-font-sans, system-ui)",
        background: "var(--mc-bg-1)",
      }}
    >
      {/* Header */}
      <header
        style={{
          padding: "20px 24px 14px",
          borderBottom: "1px solid var(--mc-line)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
          flexWrap: "wrap",
          background: "var(--mc-bg-1)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span
            style={{
              width: 36,
              height: 36,
              borderRadius: "var(--mc-radius-md)",
              background: "var(--mc-accent-soft, rgba(217,162,76,0.10))",
              border: "1px solid var(--mc-line-strong)",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--mc-accent)",
            }}
          >
            <Users size={18} strokeWidth={1.75} />
          </span>
          <div>
            <h1
              style={{
                fontFamily: "var(--mc-font-display, serif)",
                fontSize: 22,
                fontWeight: 500,
                color: "var(--mc-fg)",
                letterSpacing: "-0.01em",
                margin: 0,
              }}
            >
              Personas
            </h1>
            <p
              style={{
                fontSize: 11,
                color: "var(--mc-fg-3)",
                margin: "4px 0 0",
                letterSpacing: "0.04em",
              }}
            >
              Dev / Personal / Research — pick a persona, Mietorè behaves accordingly.
            </p>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <label
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "6px 10px",
              borderRadius: "var(--mc-radius-md)",
              background: "var(--mc-bg-2)",
              border: "1px solid var(--mc-line)",
              minWidth: 240,
            }}
          >
            <Search size={13} color="var(--mc-fg-3)" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search personas…"
              data-testid="personas-search"
              style={{
                flex: 1,
                background: "transparent",
                outline: "none",
                border: "none",
                color: "var(--mc-fg)",
                fontSize: 12,
              }}
            />
          </label>
          <button
            type="button"
            onClick={noop("create")}
            data-testid="personas-new"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "7px 12px",
              borderRadius: "var(--mc-radius-md)",
              background: "var(--mc-accent)",
              color: "var(--mc-accent-fg, #0A0807)",
              border: "1px solid var(--mc-accent)",
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
              boxShadow: "0 0 16px rgba(217, 162, 76, 0.25)",
            }}
          >
            <Plus size={13} />
            New Persona
          </button>
        </div>
      </header>

      {/* Body — list + detail */}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: "grid",
          gridTemplateColumns: "minmax(280px, 360px) 1fr",
          gap: 18,
          padding: "20px 24px",
          overflow: "auto",
        }}
      >
        {/* List column */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {filtered.length === 0 ? (
            <div
              data-testid="personas-empty"
              style={{
                padding: 24,
                textAlign: "center",
                color: "var(--mc-fg-3)",
                fontSize: 12,
                borderRadius: "var(--mc-radius-lg)",
                background: "var(--mc-bg-2)",
                border: "1px solid var(--mc-line)",
              }}
            >
              No personas match “{search}”.
            </div>
          ) : (
            filtered.map((p) => (
              <PersonaCard
                key={p.id}
                persona={p}
                selected={p.id === selectedId}
                onSelect={() => setSelectedId(p.id)}
                onActivate={noop("activate")}
              />
            ))
          )}

          {/* Shell affordance — hints at "create from template" */}
          <button
            type="button"
            onClick={noop("create-from-template")}
            data-testid="personas-create-template"
            style={{
              marginTop: 4,
              padding: "12px 14px",
              borderRadius: "var(--mc-radius-lg)",
              background: "transparent",
              border: "1px dashed var(--mc-line-strong)",
              color: "var(--mc-fg-2)",
              fontSize: 12,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              cursor: "pointer",
            }}
          >
            <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
              <Sparkles size={13} color="var(--mc-accent-2)" />
              Create from template…
            </span>
            <ChevronRight size={13} />
          </button>
        </div>

        {/* Detail column */}
        <div style={{ display: "flex", flexDirection: "column", gap: 18, minWidth: 0 }}>
          <PersonaDetailPanel
            persona={selected}
            onEdit={noop("edit")}
            onDelete={noop("delete")}
            onActivate={noop("activate")}
          />

          {/* Sub-cards — preview, memory, skills shells */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 12,
            }}
          >
            <ShellSubCard
              Icon={Brain}
              label="Memory Scope"
              hint="Per-persona memory partitioning lands with Phase I + 6.D extension."
              testid="personas-shell-memory"
            />
            <ShellSubCard
              Icon={Wrench}
              label="Skill Enablement"
              hint="Skills toggled here override /customize defaults for this persona."
              testid="personas-shell-skills"
            />
            <ShellSubCard
              Icon={Layers}
              label="Model Routing"
              hint="Per-persona model preferences feed Sprint 7 router context."
              testid="personas-shell-routing"
            />
            <ShellSubCard
              Icon={Shield}
              label="Approval Policy"
              hint="Stricter approvals for Research; relaxed for Dev. Configurable here."
              testid="personas-shell-approvals"
            />
          </div>

          {/* Bottom note — explicit shell marker so reviewers know what's real */}
          <div
            data-testid="personas-shell-banner"
            style={{
              padding: "10px 14px",
              borderRadius: "var(--mc-radius-md)",
              background: "var(--mc-bg-2)",
              border: "1px dashed var(--mc-line-strong)",
              color: "var(--mc-fg-2)",
              fontSize: 11,
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <Check size={12} color="var(--mc-accent-2)" />
            Phase I shell — layout + theme tokens locked. FE Wiring will
            connect /api/v2/personas when Phase I backend ships.
          </div>
        </div>
      </div>
    </div>
  );
}

function ShellSubCard({ Icon, label, hint, testid }) {
  return (
    <div
      data-testid={testid}
      style={{
        padding: 14,
        borderRadius: "var(--mc-radius-lg)",
        background: "var(--mc-bg-2)",
        border: "1px solid var(--mc-line)",
        display: "flex",
        flexDirection: "column",
        gap: 6,
      }}
    >
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          fontSize: 10,
          textTransform: "uppercase",
          letterSpacing: "0.15em",
          color: "var(--mc-fg-3)",
        }}
      >
        <Icon size={12} color="var(--mc-accent)" />
        {label}
      </span>
      <span style={{ fontSize: 12, color: "var(--mc-fg-1)", lineHeight: 1.45 }}>
        {hint}
      </span>
    </div>
  );
}
