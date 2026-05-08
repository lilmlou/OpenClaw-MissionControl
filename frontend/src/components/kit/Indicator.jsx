// MC-CLAW kit — Indicator (status dot)
import React from "react";
import { cn } from "./utils";

const tones = {
    ok: "bg-[color:var(--mc-ok)]",
    warn: "bg-[color:var(--mc-warn)]",
    err: "bg-[color:var(--mc-err)]",
    info: "bg-[color:var(--mc-info)]",
    accent: "bg-[color:var(--mc-accent)]",
    off: "bg-[color:var(--mc-fg-3)]",
};

const sizes = {
    sm: "h-1.5 w-1.5",
    md: "h-2 w-2",
    lg: "h-2.5 w-2.5",
};

export function Indicator({ tone = "off", size = "md", pulse = false, label, className }) {
    return (
        <span
            className={cn("inline-flex items-center gap-2", className)}
            aria-label={label}
        >
            <span
                className={cn("inline-block rounded-full", tones[tone], sizes[size])}
                style={
                    pulse
                        ? { animation: "mc-pulse 1.6s ease-in-out infinite" }
                        : undefined
                }
            />
            {label && (
                <span
                    style={{
                        fontSize: "var(--mc-text-xs)",
                        color: "var(--mc-fg-1)",
                        letterSpacing: "var(--mc-tracking-wide)",
                    }}
                >
                    {label}
                </span>
            )}
        </span>
    );
}

export default Indicator;
