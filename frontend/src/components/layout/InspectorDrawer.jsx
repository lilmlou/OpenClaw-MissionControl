/**
 * InspectorDrawer — Mietorè per-task Inspector (SHELL)
 *
 * Phase F6 from MASTER_PLAN.md — 6 tabs per task surface:
 *   Activity / Artifacts / Files / Memory / Skills / Logs
 *
 * This is the STRUCTURAL SHELL built by MC FE Builder. Live data wiring
 * (per-task WS subscriptions, /api/v2/tasks/<id>/{activity,artifacts,...}
 * endpoints, action buttons) is the responsibility of MC FE Wiring in a
 * follow-up sweep.
 *
 * Non-coder test: replaces "tail /tmp/mc_<task>.log + grep + scroll".
 * Meg taps a task row anywhere in the app, the Inspector slides in from
 * the right, every tab is visible — no terminal, no markdown doc.
 *
 * Theme: locked Mietorè tokens — warm-black surface, hairline gold border,
 * gold accent header, cyan-edge for the LIVE tab, glassmorphism backdrop.
 *
 * Empty/unknown state is rendered explicitly (no mock data) so the wiring
 * layer can drop real subscriptions in without touching layout.
 */
import React, { useCallback, useEffect, useState } from "react";
import {
    X,
    Activity as ActivityIcon,
    Package,
    FileText,
    Brain,
    Wrench,
    Terminal as TerminalIcon,
    Hash,
} from "lucide-react";
import { Pill, EmptyState, Tabs } from "@/components/kit";

const TABS = [
    { value: "activity", label: "Activity", icon: <ActivityIcon size={14} strokeWidth={1.75} /> },
    { value: "artifacts", label: "Artifacts", icon: <Package size={14} strokeWidth={1.75} /> },
    { value: "files", label: "Files", icon: <FileText size={14} strokeWidth={1.75} /> },
    { value: "memory", label: "Memory", icon: <Brain size={14} strokeWidth={1.75} /> },
    { value: "skills", label: "Skills", icon: <Wrench size={14} strokeWidth={1.75} /> },
    { value: "logs", label: "Logs", icon: <TerminalIcon size={14} strokeWidth={1.75} /> },
];

const EMPTY_COPY = {
    activity: {
        title: "No activity yet",
        body: "Per-task activity frames will stream here once FE Wiring binds /api/ws/activities?task=<id>.",
    },
    artifacts: {
        title: "No artifacts produced",
        body: "Generated files, diffs, screenshots and exports will appear here as the task produces them.",
    },
    files: {
        title: "No files touched",
        body: "Every file the task read, wrote, or proposed will be listed here with diff previews.",
    },
    memory: {
        title: "No memory loaded",
        body: "The slice of global / project / thread memory the task actually used will be shown here.",
    },
    skills: {
        title: "No skills invoked",
        body: "Skills, plugins, and connectors the task called — with inputs, outputs, and timings.",
    },
    logs: {
        title: "No logs captured",
        body: "Stdout / stderr / structured log lines will stream here, replacing terminal tails.",
    },
};

/**
 * InspectorDrawer
 *
 * Props:
 *   open       boolean   — controls visibility; parent owns state
 *   onClose    () => void
 *   taskId     string    — task identifier (shown in header, used by wiring)
 *   taskLabel  string    — human-readable task title
 *   status     string    — agent status (running | claims_done | verified | failed | killed)
 *   initialTab string    — default active tab (default "activity")
 *   width      number    — drawer width in px (default 560)
 */
export function InspectorDrawer({
    open,
    onClose,
    taskId,
    taskLabel,
    status,
    initialTab = "activity",
    width = 560,
}) {
    const [activeTab, setActiveTab] = useState(initialTab);

    useEffect(() => {
        if (open) setActiveTab(initialTab || "activity");
    }, [open, initialTab, taskId]);

    const handleKey = useCallback(
        (e) => {
            if (e.key === "Escape" && typeof onClose === "function") onClose();
        },
        [onClose],
    );

    useEffect(() => {
        if (!open) return undefined;
        window.addEventListener("keydown", handleKey);
        return () => window.removeEventListener("keydown", handleKey);
    }, [open, handleKey]);

    if (!open) return null;

    const empty = EMPTY_COPY[activeTab] || EMPTY_COPY.activity;
    const statusTone = statusToTone(status);

    return (
        <>
            {/* Scrim */}
            <div
                data-testid="inspector-drawer-scrim"
                onClick={onClose}
                className="fixed inset-0 z-40"
                style={{
                    background: "rgba(10, 8, 7, 0.62)",
                    backdropFilter: "blur(2px)",
                    WebkitBackdropFilter: "blur(2px)",
                }}
                aria-hidden="true"
            />
            {/* Panel */}
            <aside
                data-testid="inspector-drawer"
                role="dialog"
                aria-label={taskLabel ? `Inspector: ${taskLabel}` : "Inspector"}
                className="fixed top-0 right-0 z-50 flex flex-col h-screen"
                style={{
                    width,
                    maxWidth: "100vw",
                    background: "var(--mc-bg-1)",
                    borderLeft: "1px solid var(--mc-line-strong)",
                    boxShadow:
                        "0 0 80px rgba(0, 0, 0, 0.65), 0 0 0 1px var(--mc-line), 0 0 40px rgba(217, 162, 76, 0.06)",
                    fontFamily: "var(--mc-font-sans)",
                    color: "var(--mc-fg)",
                }}
            >
                {/* Header */}
                <header
                    className="shrink-0"
                    style={{
                        padding: "14px 18px 10px 18px",
                        borderBottom: "1px solid var(--mc-line)",
                        background: "var(--mc-bg-overlay)",
                        backdropFilter: "blur(14px)",
                        WebkitBackdropFilter: "blur(14px)",
                    }}
                >
                    <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                            <div
                                className="flex items-center gap-2"
                                style={{
                                    fontSize: 10,
                                    letterSpacing: "0.15em",
                                    textTransform: "uppercase",
                                    color: "var(--mc-fg-3)",
                                }}
                            >
                                <Hash size={11} strokeWidth={2} />
                                <span>Inspector</span>
                                {taskId ? (
                                    <span
                                        style={{
                                            fontFamily: "var(--mc-font-mono)",
                                            color: "var(--mc-fg-2)",
                                            letterSpacing: 0,
                                            textTransform: "none",
                                        }}
                                    >
                                        {taskId}
                                    </span>
                                ) : null}
                            </div>
                            <div
                                className="mt-1 truncate"
                                style={{
                                    fontFamily: "var(--mc-font-display)",
                                    fontSize: 18,
                                    fontWeight: 500,
                                    color: "var(--mc-fg)",
                                    letterSpacing: "-0.01em",
                                }}
                            >
                                {taskLabel || "Unnamed task"}
                            </div>
                            {status ? (
                                <div className="mt-2">
                                    <Pill tone={statusTone} size="sm">
                                        {String(status).replace(/_/g, " ")}
                                    </Pill>
                                </div>
                            ) : null}
                        </div>
                        <button
                            type="button"
                            onClick={onClose}
                            aria-label="Close inspector"
                            data-testid="inspector-drawer-close"
                            className="inline-flex items-center justify-center rounded-md shrink-0"
                            style={{
                                width: 30,
                                height: 30,
                                background: "transparent",
                                color: "var(--mc-fg-2)",
                                border: "1px solid transparent",
                                cursor: "pointer",
                                transition: "all 120ms ease",
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.background = "var(--mc-bg-2)";
                                e.currentTarget.style.color = "var(--mc-fg)";
                                e.currentTarget.style.borderColor = "var(--mc-line)";
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.background = "transparent";
                                e.currentTarget.style.color = "var(--mc-fg-2)";
                                e.currentTarget.style.borderColor = "transparent";
                            }}
                        >
                            <X size={16} strokeWidth={1.75} />
                        </button>
                    </div>
                </header>

                {/* Tabs */}
                <div
                    className="shrink-0"
                    style={{
                        padding: "0 18px",
                        background: "var(--mc-bg-1)",
                    }}
                >
                    <Tabs
                        items={TABS}
                        value={activeTab}
                        onChange={setActiveTab}
                        className="overflow-x-auto"
                    />
                </div>

                {/* Body */}
                <div
                    data-testid={`inspector-drawer-panel-${activeTab}`}
                    className="flex-1 overflow-y-auto"
                    style={{
                        padding: "20px 18px",
                        background: "var(--mc-bg-1)",
                    }}
                >
                    <EmptyState
                        title={empty.title}
                        description={empty.body}
                        data-testid={`inspector-drawer-empty-${activeTab}`}
                    />
                </div>

                {/* Footer */}
                <footer
                    className="shrink-0 flex items-center justify-between"
                    style={{
                        padding: "8px 18px",
                        borderTop: "1px solid var(--mc-line)",
                        fontSize: 10,
                        color: "var(--mc-fg-3)",
                        letterSpacing: 0.4,
                        background: "var(--mc-bg-overlay)",
                    }}
                >
                    <span>Live · per-task WS · esc to close</span>
                    <span style={{ fontFamily: "var(--mc-font-mono)" }}>
                        F6 · shell
                    </span>
                </footer>
            </aside>
        </>
    );
}

function statusToTone(status) {
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

export default InspectorDrawer;
