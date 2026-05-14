/**
 * Phase F4 — Audit Trail (shell)
 *
 * Route: /audit
 * Non-coder visible: every config change, every approval decision, every
 * destructive action, with who/what/when. Replaces "tail the audit log
 * file" with an in-app surface.
 *
 * Wiring targets (when FE Wiring lands):
 *   GET /api/v2/audit/events?since=&until=&category=
 *   GET /api/v2/audit/event/:id
 *   WS  audit.event broadcast
 *
 * This is SHELL ONLY — filter chrome, empty state, theme. No fetch wired
 * yet. Filters render but do not query until FE Wiring hooks them up.
 *
 * Theme: locked Mietorè tokens.
 */

import React, { useState } from "react";
import {
  Shield, Search, Filter, Download, Settings, ShieldAlert,
  CheckCircle2, AlertTriangle, FileEdit, Trash2, KeyRound, Clock,
} from "lucide-react";

const CATEGORIES = [
  { id: "all",       label: "All",         Icon: Filter,       color: "var(--mc-fg-1)" },
  { id: "config",    label: "Config",      Icon: Settings,     color: "var(--mc-accent)" },
  { id: "approval",  label: "Approvals",   Icon: ShieldAlert,  color: "var(--mc-accent-2)" },
  { id: "edit",      label: "Edits",       Icon: FileEdit,     color: "var(--mc-info)" },
  { id: "delete",    label: "Deletions",   Icon: Trash2,       color: "var(--mc-err)" },
  { id: "auth",      label: "Auth",        Icon: KeyRound,     color: "var(--mc-warn)" },
  { id: "system",    label: "System",      Icon: AlertTriangle,color: "var(--mc-fg-2)" },
];

const RANGES = [
  { id: "today", label: "Today" },
  { id: "7d",    label: "7 days" },
  { id: "30d",   label: "30 days" },
  { id: "all",   label: "All time" },
];

function CategoryChip({ cat, active, onClick }) {
  const Icon = cat.Icon;
  return (
    <button
      type="button"
      onClick={onClick}
      data-testid={`audit-cat-${cat.id}`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "6px 12px",
        borderRadius: 999,
        background: active ? "var(--mc-accent-soft)" : "var(--mc-bg-1)",
        border: `1px solid ${active ? "var(--mc-line-strong)" : "var(--mc-line)"}`,
        color: active ? cat.color : "var(--mc-fg-2)",
        fontSize: 11,
        fontWeight: active ? 700 : 500,
        letterSpacing: 0.3,
        cursor: "pointer",
        transition: "all 0.15s ease",
      }}
    >
      <Icon size={12} /> {cat.label}
    </button>
  );
}

export default function AuditPage() {
  const [cat, setCat] = useState("all");
  const [range, setRange] = useState("7d");
  const [query, setQuery] = useState("");

  return (
    <div
      style={{
        padding: "28px 36px 64px",
        maxWidth: 1200,
        margin: "0 auto",
        overflowY: "auto",
        height: "100%",
        color: "var(--mc-fg)",
      }}
    >
      {/* Header */}
      <div
        style={{
          marginBottom: 22,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <div>
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
              Audit Trail
            </span>
            <Shield size={22} style={{ color: "var(--mc-accent)" }} />
          </h1>
          <p style={{ color: "var(--mc-fg-2)", fontSize: 13, marginTop: 6 }}>
            Every config change, approval, edit, and destructive action — with who, what, when.
          </p>
        </div>
        <button
          type="button"
          disabled
          title="Export wired in FE Wiring"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "8px 14px",
            borderRadius: 8,
            background: "var(--mc-bg-1)",
            border: "1px solid var(--mc-line-strong)",
            color: "var(--mc-fg-2)",
            fontSize: 12,
            fontWeight: 600,
            cursor: "not-allowed",
            opacity: 0.7,
          }}
        >
          <Download size={12} /> Export
        </button>
      </div>

      {/* Filter bar */}
      <div
        style={{
          background: "var(--mc-bg-1)",
          border: "1px solid var(--mc-line)",
          borderRadius: "var(--mc-radius-lg, 14px)",
          padding: 16,
          marginBottom: 16,
          backdropFilter: "blur(10px)",
          WebkitBackdropFilter: "blur(10px)",
        }}
      >
        {/* Search + range */}
        <div style={{ display: "flex", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
          <div
            style={{
              flex: 1,
              minWidth: 220,
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "8px 12px",
              borderRadius: 8,
              background: "var(--mc-bg-2)",
              border: "1px solid var(--mc-line)",
            }}
          >
            <Search size={14} style={{ color: "var(--mc-fg-3)" }} />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by actor, target, or message…"
              style={{
                flex: 1,
                background: "transparent",
                border: "none",
                outline: "none",
                color: "var(--mc-fg)",
                fontSize: 12,
              }}
              data-testid="audit-search"
            />
          </div>
          <div style={{ display: "flex", gap: 4 }}>
            {RANGES.map((r) => {
              const active = range === r.id;
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setRange(r.id)}
                  data-testid={`audit-range-${r.id}`}
                  style={{
                    padding: "8px 12px",
                    borderRadius: 8,
                    background: active ? "var(--mc-accent-soft)" : "var(--mc-bg-2)",
                    border: `1px solid ${active ? "var(--mc-line-strong)" : "var(--mc-line)"}`,
                    color: active ? "var(--mc-accent)" : "var(--mc-fg-2)",
                    fontSize: 11,
                    fontWeight: active ? 700 : 500,
                    cursor: "pointer",
                  }}
                >
                  {r.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Category chips */}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {CATEGORIES.map((c) => (
            <CategoryChip
              key={c.id}
              cat={c}
              active={cat === c.id}
              onClick={() => setCat(c.id)}
            />
          ))}
        </div>
      </div>

      {/* Empty state */}
      <div
        style={{
          background: "var(--mc-bg-1)",
          border: "1px solid var(--mc-line)",
          borderRadius: "var(--mc-radius-lg, 14px)",
          padding: "48px 24px",
          textAlign: "center",
          backdropFilter: "blur(10px)",
          WebkitBackdropFilter: "blur(10px)",
        }}
      >
        <Shield
          size={42}
          style={{ color: "var(--mc-accent)", opacity: 0.7, marginBottom: 12 }}
        />
        <div
          style={{
            fontSize: 15,
            fontWeight: 600,
            color: "var(--mc-fg-1)",
            marginBottom: 6,
          }}
        >
          No audit events to show yet
        </div>
        <div style={{ fontSize: 12, color: "var(--mc-fg-2)", maxWidth: 460, margin: "0 auto" }}>
          Once the F4 backend endpoint ships, every configuration toggle,
          approval decision, file edit, and system action will stream here
          in real time. No log files to tail.
        </div>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            marginTop: 18,
            fontSize: 11,
            color: "var(--mc-fg-3)",
            fontFamily: "var(--mc-font-mono, monospace)",
          }}
        >
          <Clock size={11} /> awaiting GET /api/v2/audit/events
        </div>
      </div>

      {/* Legend */}
      <div
        style={{
          marginTop: 18,
          padding: "12px 16px",
          background: "var(--mc-bg-1)",
          border: "1px dashed var(--mc-line-strong)",
          borderRadius: "var(--mc-radius-md, 10px)",
          fontSize: 11,
          color: "var(--mc-fg-2)",
          display: "flex",
          alignItems: "center",
          gap: 14,
          flexWrap: "wrap",
        }}
      >
        <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
          <CheckCircle2 size={11} style={{ color: "var(--mc-ok)" }} /> approved
        </span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
          <AlertTriangle size={11} style={{ color: "var(--mc-warn)" }} /> reverted
        </span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
          <Trash2 size={11} style={{ color: "var(--mc-err)" }} /> destructive
        </span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
          <Settings size={11} style={{ color: "var(--mc-accent)" }} /> config
        </span>
      </div>
    </div>
  );
}
