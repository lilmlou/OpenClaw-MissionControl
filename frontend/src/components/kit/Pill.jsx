// MC-CLAW kit — Pill / Tag
// Pill: status indicator. Tag: removable filter chip.
import React from "react";
import { X } from "lucide-react";
import { cn } from "./utils";

const tones = {
    neutral: "text-[color:var(--mc-fg-1)] bg-[color:var(--mc-bg-2)] border-[color:var(--mc-line)]",
    accent: "text-[color:var(--mc-accent)] bg-[color:var(--mc-accent-soft)] border-transparent",
    ok: "text-[color:var(--mc-ok)] bg-[color:var(--mc-ok-soft)] border-transparent",
    warn: "text-[color:var(--mc-warn)] bg-[color:var(--mc-warn-soft)] border-transparent",
    err: "text-[color:var(--mc-err)] bg-[color:var(--mc-err-soft)] border-transparent",
    info: "text-[color:var(--mc-info)] bg-[color:var(--mc-info-soft)] border-transparent",
};

const sizes = {
    sm: "h-5 px-2 text-[length:var(--mc-text-xs)]",
    md: "h-6 px-2.5 text-[length:var(--mc-text-xs)]",
    lg: "h-7 px-3 text-[length:var(--mc-text-sm)]",
};

export function Pill({
    tone = "neutral",
    size = "md",
    icon,
    children,
    className,
    ...rest
}) {
    return (
        <span
            className={cn(
                "inline-flex items-center gap-1 border whitespace-nowrap leading-none font-medium",
                "rounded-[var(--mc-radius-full)]",
                tones[tone],
                sizes[size],
                className,
            )}
            style={{
                fontFamily: "var(--mc-font-sans)",
                letterSpacing: "var(--mc-tracking-wide)",
            }}
            {...rest}
        >
            {icon && <span className="inline-flex">{icon}</span>}
            {children}
        </span>
    );
}

export function Tag({ children, onRemove, tone = "neutral", className, ...rest }) {
    return (
        <span
            className={cn(
                "inline-flex items-center gap-1 border whitespace-nowrap leading-none",
                "rounded-[var(--mc-radius-full)] h-6 pl-2.5 pr-1 text-[length:var(--mc-text-xs)]",
                tones[tone],
                "group",
                className,
            )}
            {...rest}
        >
            <span>{children}</span>
            {onRemove && (
                <button
                    type="button"
                    onClick={onRemove}
                    aria-label="Remove"
                    className="inline-flex items-center justify-center h-4 w-4 rounded-full hover:bg-black/20"
                >
                    <X size={10} strokeWidth={2} />
                </button>
            )}
        </span>
    );
}

export default Pill;
