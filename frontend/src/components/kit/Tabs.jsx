// MC-CLAW kit — Tabs (underline) + Segmented (pill-group)
import React from "react";
import { cn } from "./utils";

/**
 * Tabs — underline-active style for sub-navigation.
 * @param {Array<{value: string, label: string, icon?: ReactNode, badge?: ReactNode}>} items
 */
export function Tabs({ items = [], value, onChange, className }) {
    return (
        <div
            className={cn(
                "flex items-center gap-[var(--mc-space-5)] border-b border-[color:var(--mc-line)]",
                className,
            )}
            role="tablist"
        >
            {items.map((it) => {
                const active = it.value === value;
                return (
                    <button
                        key={it.value}
                        type="button"
                        role="tab"
                        aria-selected={active}
                        onClick={() => onChange?.(it.value)}
                        className={cn(
                            "relative inline-flex items-center gap-[var(--mc-space-2)]",
                            "py-[var(--mc-space-3)] -mb-px border-b-2",
                            "transition-colors",
                            active
                                ? "border-[color:var(--mc-accent)]"
                                : "border-transparent",
                        )}
                        style={{
                            color: active ? "var(--mc-fg)" : "var(--mc-fg-2)",
                            fontSize: "var(--mc-text-sm)",
                            fontWeight: active ? 600 : 500,
                            transitionDuration: "var(--mc-dur-fast)",
                        }}
                    >
                        {it.icon}
                        <span>{it.label}</span>
                        {it.badge != null && (
                            <span
                                className="ml-1 inline-flex items-center justify-center rounded-full px-1.5"
                                style={{
                                    fontSize: "var(--mc-text-xs)",
                                    background: active
                                        ? "var(--mc-accent-soft)"
                                        : "var(--mc-bg-2)",
                                    color: active ? "var(--mc-accent)" : "var(--mc-fg-2)",
                                    minHeight: 18,
                                }}
                            >
                                {it.badge}
                            </span>
                        )}
                    </button>
                );
            })}
        </div>
    );
}

/**
 * Segmented — exclusive choice as a pill-group with sliding bg.
 */
export function Segmented({ items = [], value, onChange, size = "md", className }) {
    const sizes = {
        sm: "h-7 text-[length:var(--mc-text-xs)]",
        md: "h-8 text-[length:var(--mc-text-sm)]",
        lg: "h-10 text-[length:var(--mc-text-base)]",
    };
    return (
        <div
            className={cn(
                "inline-flex items-center rounded-[var(--mc-radius-md)] border border-[color:var(--mc-line)] p-0.5",
                "bg-[color:var(--mc-bg-1)]",
                className,
            )}
            role="tablist"
        >
            {items.map((it) => {
                const active = it.value === value;
                return (
                    <button
                        key={it.value}
                        type="button"
                        role="tab"
                        aria-selected={active}
                        onClick={() => onChange?.(it.value)}
                        className={cn(
                            "inline-flex items-center justify-center gap-1.5 px-3 rounded-[var(--mc-radius-sm)]",
                            "transition-colors",
                            sizes[size],
                        )}
                        style={{
                            background: active ? "var(--mc-bg-3)" : "transparent",
                            color: active ? "var(--mc-fg)" : "var(--mc-fg-2)",
                            fontWeight: active ? 600 : 500,
                            transitionDuration: "var(--mc-dur-fast)",
                        }}
                    >
                        {it.icon}
                        {it.label}
                    </button>
                );
            })}
        </div>
    );
}

export default Tabs;
