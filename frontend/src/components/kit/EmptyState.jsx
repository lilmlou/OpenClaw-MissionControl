// MC-CLAW kit — EmptyState
// Icon + title + description + optional CTA. Required by §6.3.
import React from "react";
import { Inbox } from "lucide-react";
import { cn } from "./utils";

export function EmptyState({
    icon = <Inbox size={32} strokeWidth={1.5} />,
    title,
    description,
    action,
    className,
}) {
    return (
        <div
            className={cn(
                "flex flex-col items-center justify-center text-center",
                "p-[var(--mc-space-7)] gap-[var(--mc-space-3)]",
                className,
            )}
        >
            <div
                className="flex items-center justify-center rounded-full"
                style={{
                    width: 56,
                    height: 56,
                    background: "var(--mc-bg-2)",
                    color: "var(--mc-fg-2)",
                }}
            >
                {icon}
            </div>
            {title && (
                <h3
                    className="m-0"
                    style={{
                        fontSize: "var(--mc-text-md)",
                        fontWeight: 600,
                        color: "var(--mc-fg)",
                        lineHeight: "var(--mc-leading-tight)",
                    }}
                >
                    {title}
                </h3>
            )}
            {description && (
                <p
                    className="m-0 max-w-sm"
                    style={{
                        fontSize: "var(--mc-text-sm)",
                        color: "var(--mc-fg-2)",
                        lineHeight: "var(--mc-leading-normal)",
                    }}
                >
                    {description}
                </p>
            )}
            {action && <div className="mt-[var(--mc-space-3)]">{action}</div>}
        </div>
    );
}

export default EmptyState;
