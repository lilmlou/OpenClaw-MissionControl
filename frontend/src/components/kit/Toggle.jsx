// MC-CLAW kit — Toggle (boolean switch, NOT a checkbox)
import React from "react";
import { cn } from "./utils";

export const Toggle = React.forwardRef(function Toggle(
    {
        checked = false,
        onChange,
        disabled = false,
        size = "md",
        label,
        description,
        className,
        ...rest
    },
    ref,
) {
    const sizes = {
        sm: { track: "w-7 h-4", thumb: "h-3 w-3", translate: "translate-x-3" },
        md: { track: "w-9 h-5", thumb: "h-4 w-4", translate: "translate-x-4" },
        lg: { track: "w-11 h-6", thumb: "h-5 w-5", translate: "translate-x-5" },
    };
    const s = sizes[size];

    const node = (
        <button
            ref={ref}
            type="button"
            role="switch"
            aria-checked={checked}
            disabled={disabled}
            onClick={() => !disabled && onChange?.(!checked)}
            className={cn(
                "relative inline-flex shrink-0 cursor-pointer rounded-full border border-transparent",
                "transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--mc-accent)]",
                disabled && "opacity-50 cursor-not-allowed",
                s.track,
            )}
            style={{
                background: checked ? "var(--mc-accent)" : "var(--mc-bg-3)",
                transitionDuration: "var(--mc-dur-base)",
                transitionTimingFunction: "var(--mc-ease-out)",
            }}
            {...rest}
        >
            <span
                className={cn(
                    "pointer-events-none inline-block rounded-full shadow-sm transform transition-transform",
                    s.thumb,
                    checked ? s.translate : "translate-x-0.5",
                )}
                style={{
                    background: checked ? "var(--mc-accent-fg)" : "var(--mc-fg-1)",
                    transitionDuration: "var(--mc-dur-base)",
                    transitionTimingFunction: "var(--mc-ease-out)",
                    marginTop: 1,
                }}
            />
        </button>
    );

    if (!label && !description) return <span className={className}>{node}</span>;

    return (
        <label
            className={cn(
                "inline-flex items-start gap-[var(--mc-space-3)] cursor-pointer",
                disabled && "cursor-not-allowed",
                className,
            )}
        >
            {node}
            <span className="flex flex-col leading-tight">
                {label && (
                    <span
                        style={{
                            fontSize: "var(--mc-text-sm)",
                            color: "var(--mc-fg)",
                            fontWeight: 500,
                        }}
                    >
                        {label}
                    </span>
                )}
                {description && (
                    <span
                        style={{
                            fontSize: "var(--mc-text-xs)",
                            color: "var(--mc-fg-2)",
                            marginTop: 2,
                        }}
                    >
                        {description}
                    </span>
                )}
            </span>
        </label>
    );
});

export default Toggle;
