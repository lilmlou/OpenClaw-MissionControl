// MC-CLAW kit — Card / HeroCard / Panel
import React from "react";
import { cn } from "./utils";

const cardBase = [
    "border bg-[color:var(--mc-bg-1)] border-[color:var(--mc-line)]",
    "transition-colors",
].join(" ");

export const Card = React.forwardRef(function Card(
    { padded = true, hoverable = false, selected = false, className, children, ...rest },
    ref,
) {
    return (
        <div
            ref={ref}
            className={cn(
                cardBase,
                "rounded-[var(--mc-radius-md)]",
                padded && "p-[var(--mc-space-5)]",
                hoverable && "hover:bg-[color:var(--mc-bg-2)] cursor-pointer",
                selected && "border-[color:var(--mc-accent)] bg-[color:var(--mc-bg-2)]",
                className,
            )}
            style={{ transitionDuration: "var(--mc-dur-base)" }}
            {...rest}
        >
            {children}
        </div>
    );
});

export const HeroCard = React.forwardRef(function HeroCard(
    { className, children, ...rest },
    ref,
) {
    return (
        <div
            ref={ref}
            className={cn(
                cardBase,
                "rounded-[var(--mc-radius-lg)] p-[var(--mc-space-6)]",
                className,
            )}
            {...rest}
        >
            {children}
        </div>
    );
});

export function CardHeader({ title, subtitle, actions, className }) {
    return (
        <div
            className={cn(
                "flex items-start justify-between gap-[var(--mc-space-4)] mb-[var(--mc-space-4)]",
                className,
            )}
        >
            <div className="min-w-0 flex-1">
                {title && (
                    <h3
                        className="m-0 truncate"
                        style={{
                            fontSize: "var(--mc-text-md)",
                            fontWeight: 600,
                            lineHeight: "var(--mc-leading-tight)",
                            letterSpacing: "var(--mc-tracking-normal)",
                            color: "var(--mc-fg)",
                        }}
                    >
                        {title}
                    </h3>
                )}
                {subtitle && (
                    <p
                        className="m-0 mt-[var(--mc-space-1)]"
                        style={{
                            fontSize: "var(--mc-text-sm)",
                            color: "var(--mc-fg-2)",
                            lineHeight: "var(--mc-leading-normal)",
                        }}
                    >
                        {subtitle}
                    </p>
                )}
            </div>
            {actions && <div className="flex items-center gap-[var(--mc-space-2)]">{actions}</div>}
        </div>
    );
}

export const Panel = Card;
export default Card;
