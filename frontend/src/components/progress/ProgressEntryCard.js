// VM-D2 Progress Pulse — Single entry card
// Renders one PROGRESS.md entry as a kit <Card> with status border, pill,
// optional Fix buttons (<ErrorState> for deceptive/claims_done with
// suggested_actions), an opt-in <details> drawer for body_md, and a
// <BindAction to="progress.mark_seen"> button. body_md is NEVER primary UI.
import React, { useState } from "react";
import { Card } from "@/components/kit";
import { BindAction } from "@/components/bind/BindAction";
import { ProgressStatusPill, PROGRESS_STATUS_TONE } from "./ProgressStatusPill";

function formatDate(entry) {
    if (entry.date_str) return entry.date_str;
    if (entry.date_ts) {
        try {
            return new Date(entry.date_ts).toISOString().slice(0, 10);
        } catch {
            return "";
        }
    }
    return "";
}

function borderColour(status) {
    const tone = PROGRESS_STATUS_TONE[status] || "neutral";
    switch (tone) {
        case "ok":   return "var(--mc-ok)";
        case "warn": return "var(--mc-warn)";
        case "err":  return "var(--mc-err)";
        case "info": return "var(--mc-info)";
        default:     return "var(--mc-line)";
    }
}

export function ProgressEntryCard({ entry }) {
    const [expanded, setExpanded] = useState(false);
    if (!entry || !entry.id) return null;

    const status = entry.status || "unknown";
    const seen = !!entry.seen;
    const repoName = (entry.repo_path || "").split("/").filter(Boolean).slice(-2).join("/");
    const fixActions = Array.isArray(entry.suggested_actions) ? entry.suggested_actions : [];
    const isDeceptive = status === "deceptive";
    const isClaims    = status === "claims_done";
    const showFix     = isDeceptive || isClaims;

    return (
        <Card
            data-testid={`progress-entry-${entry.id}`}
            data-progress-status={status}
            data-progress-seen={seen ? "true" : "false"}
            className="flex flex-col gap-[var(--mc-space-3)]"
            style={{
                borderColor: borderColour(status),
                opacity: seen ? 0.6 : 1,
                transition: "opacity var(--mc-dur-base)",
            }}
        >
            <div className="flex items-start justify-between gap-[var(--mc-space-3)]">
                <div className="flex flex-col gap-[var(--mc-space-1)] min-w-0">
                    <div className="flex items-center gap-[var(--mc-space-2)] flex-wrap">
                        <ProgressStatusPill status={status} />
                        <span
                            className="truncate"
                            style={{
                                fontSize: "var(--mc-text-md)",
                                color: "var(--mc-fg)",
                                fontWeight: 600,
                                lineHeight: "var(--mc-leading-tight)",
                            }}
                            title={entry.name}
                        >
                            {entry.name || "(unnamed entry)"}
                        </span>
                    </div>
                    <div
                        className="flex items-center gap-[var(--mc-space-2)] flex-wrap"
                        style={{
                            fontSize: "var(--mc-text-xs)",
                            color: "var(--mc-fg-2)",
                            letterSpacing: "var(--mc-tracking-wide)",
                        }}
                    >
                        {formatDate(entry) && <span>{formatDate(entry)}</span>}
                        {repoName && <span>· {repoName}</span>}
                        {entry.cron_run_id && (
                            <span style={{ fontFamily: "var(--mc-font-mono)" }}>
                                · {entry.cron_run_id}
                            </span>
                        )}
                    </div>
                </div>
                {!seen && (
                    <BindAction
                        to="progress.mark_seen"
                        args={{ id: entry.id }}
                        label="Mark seen"
                        size="sm"
                        dataTestid={`progress-mark-seen-${entry.id}`}
                    />
                )}
            </div>

            {showFix && (
                <div
                    className="flex flex-wrap gap-[var(--mc-space-2)] p-[var(--mc-space-3)] rounded-[var(--mc-radius-md)]"
                    style={{
                        background: isDeceptive ? "var(--mc-err-soft)" : "var(--mc-warn-soft)",
                    }}
                >
                    {fixActions.length > 0 ? (
                        fixActions.map((fx, i) => (
                            <BindAction
                                key={`${entry.id}-fix-${i}`}
                                to={fx.action}
                                args={fx.args || {}}
                                label={fx.label || fx.action}
                                size="sm"
                                dataTestid={`progress-fix-${entry.id}-${i}`}
                            />
                        ))
                    ) : isDeceptive ? (
                        <BindAction
                            to="agents.redispatch"
                            args={{ entry_id: entry.id }}
                            label="Re-dispatch"
                            variant="primary"
                            size="sm"
                            dataTestid={`progress-redispatch-${entry.id}`}
                        />
                    ) : (
                        <span
                            style={{
                                fontSize: "var(--mc-text-xs)",
                                color: "var(--mc-fg-2)",
                            }}
                        >
                            No suggested actions provided.
                        </span>
                    )}
                </div>
            )}

            {entry.body_md && (
                <details
                    onToggle={(e) => setExpanded(e.target.open)}
                    data-testid={`progress-body-details-${entry.id}`}
                >
                    <summary
                        className="cursor-pointer select-none"
                        style={{
                            fontSize: "var(--mc-text-xs)",
                            color: "var(--mc-fg-2)",
                            letterSpacing: "var(--mc-tracking-wide)",
                        }}
                    >
                        {expanded ? "Hide details" : "Show details"}
                    </summary>
                    <pre
                        className="mt-2 whitespace-pre-wrap"
                        style={{
                            fontSize: "var(--mc-text-xs)",
                            fontFamily: "var(--mc-font-mono)",
                            color: "var(--mc-fg-1)",
                            background: "var(--mc-bg-2)",
                            padding: "var(--mc-space-3)",
                            borderRadius: "var(--mc-radius-sm)",
                            maxHeight: 320,
                            overflow: "auto",
                        }}
                    >
                        {entry.body_md}
                    </pre>
                </details>
            )}
        </Card>
    );
}

export default ProgressEntryCard;
