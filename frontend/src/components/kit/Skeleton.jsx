// MC-CLAW kit — Skeleton (shimmer loader)
import React from "react";
import { cn } from "./utils";

export function Skeleton({ className, width, height, circle = false, ...rest }) {
    return (
        <span
            className={cn("mc-skeleton inline-block", circle && "rounded-full", className)}
            style={{
                width,
                height,
                borderRadius: circle ? "999px" : undefined,
            }}
            aria-hidden
            {...rest}
        />
    );
}

export function SkeletonText({ lines = 3, lastWidth = "60%", className }) {
    return (
        <div className={cn("flex flex-col gap-[var(--mc-space-2)]", className)}>
            {Array.from({ length: lines }).map((_, i) => (
                <Skeleton
                    key={i}
                    height={12}
                    width={i === lines - 1 ? lastWidth : "100%"}
                />
            ))}
        </div>
    );
}

export function SkeletonCard({ className }) {
    return (
        <div
            className={cn(
                "p-[var(--mc-space-5)] rounded-[var(--mc-radius-md)] border border-[color:var(--mc-line)] bg-[color:var(--mc-bg-1)]",
                className,
            )}
        >
            <Skeleton height={16} width="40%" className="mb-[var(--mc-space-3)]" />
            <Skeleton height={32} width="60%" className="mb-[var(--mc-space-3)]" />
            <Skeleton height={4} width="100%" />
        </div>
    );
}

export default Skeleton;
