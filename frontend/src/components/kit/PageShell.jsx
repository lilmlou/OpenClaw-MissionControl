// MC-CLAW kit — PageShell
// Standard page wrapper enforcing Phase 0 principles:
//   - PageError (Principle 1.4 self-healing — Fix buttons, never bare error)
//   - PageLoading (skeleton, never bare spinner)
//   - PageMeta (data freshness — Principle 1.7 visible)
import React from "react";
import { cn } from "./utils";
import { ErrorState } from "./ErrorState";

export function PageShell({ children, className, maxWidth = "1200px" }) {
    return (
        <div
            className={cn("flex flex-col h-full w-full overflow-hidden", className)}
            style={{
                fontFamily: "var(--mc-font-sans)",
                color: "var(--mc-fg)",
                background: "var(--mc-bg)",
            }}
        >
            <div className="flex-1 min-h-0 overflow-y-auto">
                <div
                    className="flex flex-col gap-[var(--mc-space-6)] p-[var(--mc-space-6)] mx-auto w-full"
                    style={{ maxWidth }}
                >
                    {children}
                </div>
            </div>
        </div>
    );
}

export function PageHeader({ title, subtitle, actions, breadcrumb, className }) {
    return (
        <header
            className={cn(
                "flex items-start justify-between gap-[var(--mc-space-4)]",
                className,
            )}
        >
            <div className="min-w-0 flex-1">
                {breadcrumb && (
                    <div
                        className="mb-[var(--mc-space-2)]"
                        style={{
                            fontSize: "var(--mc-text-xs)",
                            color: "var(--mc-fg-2)",
                            letterSpacing: "var(--mc-tracking-wide)",
                        }}
                    >
                        {breadcrumb}
                    </div>
                )}
                {title && (
                    <h1
                        className="m-0"
                        style={{
                            fontSize: "var(--mc-text-xl)",
                            fontWeight: 600,
                            lineHeight: "var(--mc-leading-tight)",
                            letterSpacing: "var(--mc-tracking-tight)",
                            fontFamily: "var(--mc-font-display)",
                            color: "var(--mc-fg)",
                        }}
                    >
                        {title}
                    </h1>
                )}
                {subtitle && (
                    <p
                        className="m-0 mt-[var(--mc-space-2)]"
                        style={{
                            fontSize: "var(--mc-text-sm)",
                            color: "var(--mc-fg-1)",
                            lineHeight: "var(--mc-leading-normal)",
                        }}
                    >
                        {subtitle}
                    </p>
                )}
            </div>
            {actions && (
                <div className="flex items-center gap-[var(--mc-space-2)]">
                    {actions}
                </div>
            )}
        </header>
    );
}

export function PageContent({ children, className }) {
    return <main className={cn("flex-1 min-w-0", className)}>{children}</main>;
}

export function PageMeta({ lastUpdated, dataSource, extra, className }) {
    return (
        <footer
            className={cn(
                "flex items-center gap-[var(--mc-space-4)] mt-[var(--mc-space-4)]",
                className,
            )}
            style={{
                fontSize: "var(--mc-text-xs)",
                color: "var(--mc-fg-2)",
                letterSpacing: "var(--mc-tracking-wide)",
            }}
        >
            {dataSource && <span>source: {dataSource}</span>}
            {lastUpdated && (
                <span>
                    updated:{" "}
                    {typeof lastUpdated === "number"
                        ? new Date(lastUpdated).toLocaleTimeString()
                        : lastUpdated}
                </span>
            )}
            {extra}
        </footer>
    );
}

/**
 * PageError — boundary that renders ErrorState with Fix buttons on caught errors.
 */
export class PageError extends React.Component {
    constructor(props) {
        super(props);
        this.state = { error: null };
    }
    static getDerivedStateFromError(error) {
        return { error };
    }
    componentDidCatch(error, info) {
        // eslint-disable-next-line no-console
        console.error("[PageError]", error, info);
    }
    reset = () => this.setState({ error: null });
    render() {
        if (this.state.error) {
            const fb = this.props.fallback;
            if (typeof fb === "function") return fb({ error: this.state.error, reset: this.reset });
            if (fb) return fb;
            return (
                <ErrorState
                    title="Page failed to render"
                    description={String(this.state.error?.message || this.state.error)}
                    fix={[
                        { label: "Retry", onClick: this.reset, variant: "primary" },
                        { label: "Reload", onClick: () => window.location.reload() },
                    ]}
                    detail={this.state.error?.stack}
                />
            );
        }
        return this.props.children;
    }
}

/**
 * PageLoading — render skeleton while loading=true, otherwise children.
 */
export function PageLoading({ loading, skeleton, children }) {
    if (loading) return skeleton || <DefaultPageSkeleton />;
    return children;
}

function DefaultPageSkeleton() {
    return (
        <div className="flex flex-col gap-[var(--mc-space-5)]">
            <div className="mc-skeleton" style={{ height: 32, width: "30%" }} />
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-[var(--mc-space-5)]">
                {Array.from({ length: 4 }).map((_, i) => (
                    <div
                        key={i}
                        className="mc-skeleton"
                        style={{ height: 96 }}
                    />
                ))}
            </div>
        </div>
    );
}

export default PageShell;
