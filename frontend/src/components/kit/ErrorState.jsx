// MC-CLAW kit — ErrorState
// Implements Principle 1.4 self-healing: errors ship with Fix buttons.
import React from "react";
import { AlertTriangle } from "lucide-react";
import { cn } from "./utils";
import { Button } from "./Button";

/**
 * @param {Object} props
 * @param {string} props.title
 * @param {string} props.description
 * @param {Array<{label: string, onClick?: () => void, action?: string, args?: object, variant?: string}>} props.fix
 *   Fix actions. Either `onClick` or `action` (registered backend action key).
 * @param {Function} [props.onAction]  Called with (action, args) when a fix with `action` is clicked.
 * @param {Object} [props.detail]  Optional error detail shown collapsed.
 */
export function ErrorState({
    title = "Something went wrong",
    description,
    fix = [],
    onAction,
    detail,
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
                    background: "var(--mc-err-soft)",
                    color: "var(--mc-err)",
                }}
            >
                <AlertTriangle size={28} strokeWidth={1.5} />
            </div>
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
            {description && (
                <p
                    className="m-0 max-w-md"
                    style={{
                        fontSize: "var(--mc-text-sm)",
                        color: "var(--mc-fg-1)",
                        lineHeight: "var(--mc-leading-normal)",
                    }}
                >
                    {description}
                </p>
            )}
            {fix.length > 0 && (
                <div className="flex flex-wrap gap-[var(--mc-space-2)] justify-center mt-[var(--mc-space-3)]">
                    {fix.map((f, i) => (
                        <Button
                            key={i}
                            variant={f.variant || (i === 0 ? "primary" : "secondary")}
                            size="md"
                            onClick={() => {
                                if (f.onClick) f.onClick();
                                else if (f.action && onAction) onAction(f.action, f.args || {});
                            }}
                        >
                            {f.label}
                        </Button>
                    ))}
                </div>
            )}
            {detail && (
                <details
                    className="mt-[var(--mc-space-4)] w-full max-w-md text-left"
                    style={{ color: "var(--mc-fg-2)" }}
                >
                    <summary
                        className="cursor-pointer"
                        style={{ fontSize: "var(--mc-text-xs)" }}
                    >
                        Details
                    </summary>
                    <pre
                        className="mt-[var(--mc-space-2)] overflow-auto rounded-[var(--mc-radius-sm)] p-[var(--mc-space-3)]"
                        style={{
                            background: "var(--mc-bg-2)",
                            fontFamily: "var(--mc-font-mono)",
                            fontSize: "var(--mc-text-xs)",
                            color: "var(--mc-fg-1)",
                        }}
                    >
                        {typeof detail === "string"
                            ? detail
                            : JSON.stringify(detail, null, 2)}
                    </pre>
                </details>
            )}
        </div>
    );
}

export default ErrorState;
