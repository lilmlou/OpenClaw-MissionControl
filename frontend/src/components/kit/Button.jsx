// MC-CLAW kit — Button
// Variants: primary | secondary | ghost | danger
// Sizes: sm | md | lg
import React from "react";
import { cn } from "./utils";

const base = [
    "inline-flex items-center justify-center gap-2",
    "font-medium leading-none whitespace-nowrap select-none",
    "border transition-colors",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
    "disabled:opacity-50 disabled:cursor-not-allowed",
].join(" ");

const variants = {
    primary:
        "bg-[color:var(--mc-accent)] text-[color:var(--mc-accent-fg)] border-[color:var(--mc-accent)] hover:bg-[color:var(--mc-accent-hover)]",
    secondary:
        "bg-[color:var(--mc-bg-2)] text-[color:var(--mc-fg)] border-[color:var(--mc-line-strong)] hover:bg-[color:var(--mc-bg-3)]",
    ghost:
        "bg-transparent text-[color:var(--mc-fg-1)] border-transparent hover:bg-[color:var(--mc-bg-2)] hover:text-[color:var(--mc-fg)]",
    danger:
        "bg-[color:var(--mc-err-soft)] text-[color:var(--mc-err)] border-[color:var(--mc-err-soft)] hover:bg-[color:var(--mc-err)] hover:text-white",
};

const sizes = {
    sm: "h-7 px-3 text-[length:var(--mc-text-xs)] rounded-[var(--mc-radius-sm)]",
    md: "h-9 px-4 text-[length:var(--mc-text-sm)] rounded-[var(--mc-radius-md)]",
    lg: "h-11 px-5 text-[length:var(--mc-text-base)] rounded-[var(--mc-radius-md)]",
};

export const Button = React.forwardRef(function Button(
    {
        variant = "secondary",
        size = "md",
        type = "button",
        leftIcon,
        rightIcon,
        loading = false,
        className,
        children,
        ...rest
    },
    ref,
) {
    return (
        <button
            ref={ref}
            type={type}
            data-variant={variant}
            data-size={size}
            disabled={loading || rest.disabled}
            className={cn(base, variants[variant], sizes[size], className)}
            style={{
                fontFamily: "var(--mc-font-sans)",
                transitionDuration: "var(--mc-dur-fast)",
                transitionTimingFunction: "var(--mc-ease-out)",
            }}
            {...rest}
        >
            {loading ? <span className="mc-spinner" aria-hidden /> : leftIcon}
            {children}
            {!loading && rightIcon}
        </button>
    );
});

export default Button;
