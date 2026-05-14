/**
 * Phase F5 — Daily Standup (shell)
 *
 * Route: /standup
 * Self-aware surface: Mietorè writes its own daily standup. This is the
 * SHELL ONLY — placeholder copy and structure ready for FE Wiring to
 * point at the real backend endpoints once they ship.
 *
 * Wiring targets (when ready):
 *   GET /api/v2/standup/today        → today's summary
 *   GET /api/v2/standup/history      → previous days
 *   WS  standup.update               → live push when standup re-runs
 *
 * Tabs (per visionedit Phase F5): Activity / Artifacts / Files /
 * Memory / Skills / Logs — six tabs per task. This shell ships the
 * tab chrome + empty-state copy; tab bodies are placeholders.
 *
 * Theme: locked Mietorè tokens (warm-black, gold, cyan, glassmorphism,
 * hairline gold borders). Do NOT inline raw hex — always use var(--mc-*).
 */

import React, { useState } from "react";
import {
  Sun, Activity, Package, FileText, Brain, Sparkles, Terminal,
  RefreshCw, ChevronRight,
} from "lucide-react";

const TABS = [
  { id: "activity",  label: "Activity",  Icon: Activity, desc: "What ran today — jobs, agents, decisions." },
  { id: "artifacts", label: "Artifacts", Icon: Package,  desc: "Files, builds, deploys produced today." },
  { id: "files",     label: "Files",     Icon: FileText, desc: "Files touched and by whom." },
  { id: "memory",    label: "Memory",    Icon: Brain,    desc: "Memory entries added, edited, retrieved." },
  { id: "skills",    label: "Skills",    Icon: Sparkles, desc: "Skills loaded and how often invoked." },
  { id: "logs",      label: "Logs",      Icon: Terminal, desc: "System logs, errors, warnings." },
];

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

function EmptyTab({ tab }) {
  const Icon = tab.Icon;
  return (
    <div
      style={{
        padding: "48px 24px",
        textAlign: "center",
        color: "var(--mc-fg-2)",
        background: "var(--mc-bg-1)",
        border: "1px solid var(--mc-line)",
        borderRadius: "var(--mc-radius-lg, 14px)",
      }}
    >
      <Icon size={36} style={{ color: "var(--mc-accent)", opacity: 0.7, marginBottom: 12 }} />
      <div style={{ fontSize: 15, fontWeight: 600, color: "var(--mc-fg-1)", marginBottom: 6 }}>
        {tab.label}
      </div>
      <div style={{ fontSize: 12 }}>{tab.desc}</div>
      <div style={{ fontSize: 11, marginTop: 14, color: "var(--mc-fg-3)" }}>
        Waiting for live data — Mietorè will fill this in on the next standup run.
      </div>
    </div>
  );
}

export default function StandupPage() {
  const [activeTab, setActiveTab] = useState("activity");
  const today = new Date().toLocaleDateString(undefined, {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });

  return (
    <div
      style={{
        padding: "28px 36px 64px",
        maxWidth: 1100,
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
              Standup
            </span>
            <Sun size={22} style={{ color: "var(--mc-accent)" }} />
          </h1>
          <p style={{ color: "var(--mc-fg-2)", fontSize: 13, marginTop: 6 }}>
            Mietorè writes its own daily report. {today}.
          </p>
        </div>
        <button
          type="button"
          disabled
          title="Hook up to /api/v2/standup/today (FE Wiring)"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "8px 14px",
            borderRadius: 8,
            background: "var(--mc-accent-soft)",
            border: "1px solid var(--mc-line-strong)",
            color: "var(--mc-accent)",
            fontSize: 12,
            fontWeight: 600,
            cursor: "not-allowed",
            opacity: 0.7,
          }}
        >
          <RefreshCw size={12} /> Regenerate
        </button>
      </div>

      {/* Stats strip */}
      <div style={{ display: "flex", gap: 12, marginBottom: 22, flexWrap: "wrap" }}>
        <StatPill label="Jobs run"      value="—" />
        <StatPill label="Tasks closed"  value="—" accent="var(--mc-ok)" />
        <StatPill label="Open blockers" value="—" accent="var(--mc-err)" />
        <StatPill label="Tokens used"   value="—" accent="var(--mc-accent-2)" />
      </div>

      {/* Summary placeholder */}
      <div
        style={{
          background: "var(--mc-bg-1)",
          border: "1px solid var(--mc-line)",
          borderRadius: "var(--mc-radius-lg, 14px)",
          padding: 22,
          marginBottom: 22,
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
            fontWeight: 700,
            marginBottom: 10,
          }}
        >
          Today's Summary
        </div>
        <p style={{ margin: 0, fontSize: 13, lineHeight: 1.7, color: "var(--mc-fg-1)" }}>
          Mietorè hasn't recorded today's standup yet. Once the F5 backend
          endpoint ships, the auto-generated narrative will appear here —
          what shipped, what regressed, what got closer, and what to focus
          on next. No markdown to read; this page is the standup.
        </p>
      </div>

      {/* Tabs */}
      <div
        style={{
          display: "flex",
          gap: 4,
          marginBottom: 16,
          borderBottom: "1px solid var(--mc-line)",
          overflowX: "auto",
        }}
      >
        {TABS.map((t) => {
          const active = activeTab === t.id;
          const Icon = t.Icon;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveTab(t.id)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "10px 14px",
                background: "transparent",
                border: "none",
                borderBottom: active
                  ? "2px solid var(--mc-accent)"
                  : "2px solid transparent",
                color: active ? "var(--mc-accent)" : "var(--mc-fg-2)",
                fontSize: 12,
                fontWeight: active ? 700 : 500,
                letterSpacing: 0.4,
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
              data-testid={`standup-tab-${t.id}`}
            >
              <Icon size={13} /> {t.label}
            </button>
          );
        })}
      </div>

      {/* Active tab body */}
      <EmptyTab tab={TABS.find((t) => t.id === activeTab) || TABS[0]} />

      {/* History link */}
      <div
        style={{
          marginTop: 22,
          padding: "14px 16px",
          background: "var(--mc-bg-1)",
          border: "1px dashed var(--mc-line-strong)",
          borderRadius: "var(--mc-radius-md, 10px)",
          fontSize: 12,
          color: "var(--mc-fg-2)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <span>Previous standups will list here once history accumulates.</span>
        <ChevronRight size={14} style={{ color: "var(--mc-fg-3)" }} />
      </div>
    </div>
  );
}
