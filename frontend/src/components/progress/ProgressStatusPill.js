// VM-D2 Progress Pulse — Status pill
// Maps PROGRESS.md entry.status to a coloured kit <Pill> + lucide icon.
// Allowed statuses (per VM_D2_PROGRESS_PULSE_*.md §3): verified,
// claims_done, deceptive, in_flight, unknown. The literal "done" is BANNED
// as a status label here (Phase 0 §3 — no shipped status string drift).
import React from "react";
import { CheckCircle, Clock, XCircle, Loader2, HelpCircle } from "lucide-react";
import { Pill } from "@/components/kit";

const STATUS_MAP = {
    verified:    { tone: "ok",      label: "VERIFIED",    Icon: CheckCircle },
    claims_done: { tone: "warn",    label: "CLAIMS DONE", Icon: Clock },
    deceptive:   { tone: "err",     label: "DECEPTIVE",   Icon: XCircle },
    in_flight:   { tone: "info",    label: "IN FLIGHT",   Icon: Loader2 },
    unknown:     { tone: "neutral", label: "UNKNOWN",     Icon: HelpCircle },
};

export function ProgressStatusPill({ status, size = "sm", className }) {
    const meta = STATUS_MAP[status] || STATUS_MAP.unknown;
    const { Icon } = meta;
    return (
        <Pill
            tone={meta.tone}
            size={size}
            icon={<Icon size={12} strokeWidth={2} />}
            className={className}
            data-testid={`progress-status-pill-${status || "unknown"}`}
        >
            {meta.label}
        </Pill>
    );
}

export const PROGRESS_STATUS_TONE = Object.fromEntries(
    Object.entries(STATUS_MAP).map(([k, v]) => [k, v.tone]),
);

export default ProgressStatusPill;
