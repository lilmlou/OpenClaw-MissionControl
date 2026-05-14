/**
 * /dev/inspector — preview page for the Phase F6 Inspector Drawer shell.
 *
 * The InspectorDrawer was already built (see
 * `src/components/layout/InspectorDrawer.jsx`) and unit-tested, but no
 * production page mounts it yet — so Meg has no in-app way to see the
 * shell that Phase F6 will use across every task row. This preview
 * fixes the visible-mirror gap: it gives the Reviewer a real URL
 * (`/dev/inspector`) where the drawer can be opened against several
 * task fixtures with different statuses and initial tabs, matching the
 * `/dev/model-chrome` preview pattern.
 *
 *   - Replays per-task fixtures (verified / running / claims_done / failed / killed)
 *   - Each opens the drawer with a different initialTab to exercise all 6 tabs
 *   - No fetches, no WS — local state only, prop-driven, no mock data injected
 *     inside the drawer (its empty states already advertise the wiring targets).
 *
 * Non-coder test: from this page Meg can SEE what every future task row's
 * Inspector will look like — Activity / Artifacts / Files / Memory / Skills / Logs —
 * without opening a terminal, tailing a log, or reading a markdown doc.
 *
 * Theme: locked Mietorè tokens — warm-black (#0A0807) surface, hairline gold
 * (#D9A24C) borders, gold→cyan (#22D3DB) gradient title, glassmorphism cards.
 */
import React, { useMemo, useState } from "react";
import { LayoutPanelLeft, Eye, Hash } from "lucide-react";
import InspectorDrawer from "@/components/layout/InspectorDrawer";
import { Pill } from "@/components/kit";

const TASK_FIXTURES = [
  {
    taskId: "task-7a2b9c",
    taskLabel: "Build /insights dashboard shell",
    status: "running",
    initialTab: "activity",
    note: "Live task — opens on Activity tab to mirror per-task WS stream.",
  },
  {
    taskId: "task-3f81d4",
    taskLabel: "Sprint 5 — token tracking instrumentation",
    status: "claims_done",
    initialTab: "artifacts",
    note: "Claims-done task — opens on Artifacts to surface generated diffs.",
  },
  {
    taskId: "task-c512ee",
    taskLabel: "Memory orchestration — slice ranker",
    status: "verified",
    initialTab: "memory",
    note: "Verified task — opens on Memory to show the slice that was used.",
  },
  {
    taskId: "task-9d40a1",
    taskLabel: "Doctor scan — port 8765 drift",
    status: "failed",
    initialTab: "logs",
    note: "Failed task — opens on Logs so failure context is one tap away.",
  },
  {
    taskId: "task-bb77f0",
    taskLabel: "Cron rebuild — agenda view",
    status: "killed",
    initialTab: "skills",
    note: "Killed task — opens on Skills to show which calls executed.",
  },
  {
    taskId: "task-1ee2a8",
    taskLabel: "Files browser (E1) — allowlist tree",
    status: "running",
    initialTab: "files",
    note: "Live task — opens on Files to surface every touched path.",
  },
];

function statusTone(status) {
  switch ((status || "").toLowerCase()) {
    case "verified":
      return "ok";
    case "failed":
      return "err";
    case "killed":
      return "neutral";
    case "running":
    case "claims_done":
      return "warn";
    default:
      return "neutral";
  }
}

function TaskRow({ task, onOpen }) {
  return (
    <button
      type="button"
      onClick={() => onOpen(task)}
      data-testid={`inspector-preview-row-${task.taskId}`}
      className="w-full text-left"
      style={{
        display: "grid",
        gridTemplateColumns: "auto 1fr auto",
        alignItems: "center",
        gap: 14,
        padding: "14px 16px",
        background: "var(--mc-bg-1)",
        border: "1px solid var(--mc-line)",
        borderRadius: "var(--mc-radius-md, 10px)",
        cursor: "pointer",
        transition: "all 140ms ease",
        color: "var(--mc-fg)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = "var(--mc-line-strong)";
        e.currentTarget.style.background = "var(--mc-bg-2)";
        e.currentTarget.style.boxShadow =
          "0 0 0 1px var(--mc-line), 0 0 24px rgba(217, 162, 76, 0.10)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = "var(--mc-line)";
        e.currentTarget.style.background = "var(--mc-bg-1)";
        e.currentTarget.style.boxShadow = "none";
      }}
    >
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: 26,
          height: 26,
          borderRadius: 7,
          background: "var(--mc-accent-soft)",
          color: "var(--mc-accent)",
          border: "1px solid var(--mc-line)",
        }}
      >
        <Hash size={12} strokeWidth={2} />
      </span>
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            fontFamily: "var(--mc-font-display, inherit)",
            fontSize: 14,
            fontWeight: 600,
            letterSpacing: "-0.01em",
            color: "var(--mc-fg)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {task.taskLabel}
        </div>
        <div
          style={{
            marginTop: 3,
            display: "flex",
            alignItems: "center",
            gap: 8,
            fontSize: 11,
            color: "var(--mc-fg-3)",
          }}
        >
          <span
            style={{
              fontFamily: "var(--mc-font-mono)",
              color: "var(--mc-fg-2)",
            }}
          >
            {task.taskId}
          </span>
          <span aria-hidden="true">·</span>
          <span>opens on “{task.initialTab}”</span>
        </div>
        <div
          style={{
            marginTop: 6,
            fontSize: 11,
            color: "var(--mc-fg-3)",
            lineHeight: 1.4,
          }}
        >
          {task.note}
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <Pill tone={statusTone(task.status)} size="sm">
          {String(task.status).replace(/_/g, " ")}
        </Pill>
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            fontSize: 11,
            color: "var(--mc-fg-2)",
            padding: "4px 8px",
            borderRadius: 999,
            border: "1px solid var(--mc-line)",
            background: "var(--mc-bg-overlay)",
          }}
        >
          <Eye size={11} strokeWidth={2} />
          Inspect
        </span>
      </div>
    </button>
  );
}

export default function InspectorPreviewPage() {
  const [active, setActive] = useState(null);

  const handleOpen = (task) => setActive(task);
  const handleClose = () => setActive(null);

  const tabsSummary = useMemo(
    () => [
      "Activity",
      "Artifacts",
      "Files",
      "Memory",
      "Skills",
      "Logs",
    ],
    [],
  );

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
            Inspector
          </span>
          <LayoutPanelLeft size={20} style={{ color: "var(--mc-accent)" }} />
        </h1>
        <p
          style={{
            marginTop: 6,
            fontSize: 13,
            color: "var(--mc-fg-2)",
            maxWidth: 760,
          }}
        >
          Preview of the Phase F6 per-task Inspector drawer. Every task row in
          the app will open this 6-tab drawer — replacing terminal tails,
          markdown digs, and log-greps. Click any fixture below to slide the
          drawer in and exercise a different initial tab.
        </p>
        <div
          style={{
            marginTop: 12,
            display: "flex",
            flexWrap: "wrap",
            gap: 6,
          }}
        >
          {tabsSummary.map((label) => (
            <span
              key={label}
              style={{
                fontSize: 10,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: "var(--mc-fg-2)",
                padding: "4px 9px",
                borderRadius: 999,
                border: "1px solid var(--mc-line)",
                background: "var(--mc-bg-overlay)",
                fontWeight: 600,
              }}
            >
              {label}
            </span>
          ))}
        </div>
      </header>

      <section
        style={{
          padding: 20,
          background: "var(--mc-bg-1)",
          border: "1px solid var(--mc-line)",
          borderRadius: "var(--mc-radius-lg, 14px)",
          backdropFilter: "blur(10px)",
          WebkitBackdropFilter: "blur(10px)",
          marginBottom: 22,
        }}
      >
        <header style={{ marginBottom: 14 }}>
          <div
            style={{
              fontFamily: "var(--mc-font-display, inherit)",
              fontSize: 16,
              fontWeight: 700,
              color: "var(--mc-fg)",
              letterSpacing: -0.2,
            }}
          >
            Task fixtures
          </div>
          <div
            style={{
              fontSize: 10,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              color: "var(--mc-fg-3)",
              fontWeight: 600,
              marginTop: 2,
            }}
          >
            Phase F6 — Inspector Drawer
          </div>
        </header>
        <div style={{ display: "grid", gap: 10 }}>
          {TASK_FIXTURES.map((task) => (
            <TaskRow key={task.taskId} task={task} onOpen={handleOpen} />
          ))}
        </div>
      </section>

      <footer
        style={{
          padding: "14px 16px",
          background: "var(--mc-bg-1)",
          border: "1px dashed var(--mc-line-strong)",
          borderRadius: "var(--mc-radius-md, 10px)",
          fontSize: 11,
          color: "var(--mc-fg-3)",
          lineHeight: 1.5,
        }}
      >
        Shell only — every tab renders an explicit empty state advertising its
        wiring target (`/api/v2/tasks/&lt;id&gt;/activity` &amp; `artifacts`,
        `files`, `memory`, `skills`, `logs`; WS `activities?task=&lt;id&gt;`).
        mc-fe-wiring binds the per-task subscriptions and renders rows; this
        page never has to change.
      </footer>

      <InspectorDrawer
        open={active !== null}
        onClose={handleClose}
        taskId={active?.taskId}
        taskLabel={active?.taskLabel}
        status={active?.status}
        initialTab={active?.initialTab || "activity"}
      />
    </div>
  );
}
