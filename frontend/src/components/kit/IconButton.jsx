// MC-CLAW kit — IconButton
// 32px square (sm 28, lg 40) with tooltip-friendly aria-label
import React from "react";
import { cn } from "./utils";

const base = [
    "inline-flex items-center justify-center",
    "border border-transparent",
    "transition-colors",
    "text-[color:var(--mc-fg-1)] hover:text-[color:var(--mc-fg)]",
    "hover:bg-[color:var(--mc-bg-2)]",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--mc-accent)]",
    "disabled:opacity-50 disabled:cursor-not-allowed",
].join(" ");

const sizes = {
    sm: "h-7 w-7 rounded-[var(--mc-radius-sm)]",
    md: "h-8 w-8 rounded-[var(--mc-radius-md)]",
    lg: "h-10 w-10 rounded-[var(--mc-radius-md)]",
};

const tones = {
    default: "",
    accent:
        "text-[color:var(--mc-accent)] hover:text-[color:var(--mc-accent-hover)]",
    danger: "text-[color:var(--mc-err)] hover:bg-[color:var(--mc-err-soft)]",
    active:
        "text-[color:var(--mc-accent)] bg-[color:var(--mc-accent-soft)] hover:bg-[color:var(--mc-accent-soft)]",
};

export const IconButton = React.forwardRef(function IconButton(
    {
        size = "md",
        tone = "default",
        icon,
        label,
        className,
        type = "button",
        ...rest
    },
    ref,
) {
    return (
        <button
            ref={ref}
            type={type}
            aria-label={label}
            title={label}
            className={cn(base, sizes[size], tones[tone], className)}
            style={{ transitionDuration: "var(--mc-dur-fast)" }}
            {...rest}
        >
            {icon}
        </button>
    );
});

export default IconButton;
