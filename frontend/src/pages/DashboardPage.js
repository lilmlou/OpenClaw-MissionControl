// DashboardPage — retrofitted to Design System v2 kit
// See docs/handoffs/DESIGN_SYSTEM_V2.md
import React from "react";
import {
    Activity,
    AlertTriangle,
    Briefcase,
    Laptop,
    Lock,
    MessageSquareText,
    ShieldAlert,
    Terminal,
} from "lucide-react";
import { useGateway } from "@/lib/useGateway";
import { ActivityFeedPane } from "@/components/ActivityFeedPane";
import {
    PageShell,
    PageHeader,
    PageContent,
    PageMeta,
    PageError,
    PageLoading,
    Card,
    HeroCard,
    CardHeader,
    Pill,
    Indicator,
} from "@/components/kit";

function eventText(evt) {
    if (evt.text) return evt.text;
    if (evt.payload?.content) return evt.payload.content;
    if (evt.payload?.command) return `Command: ${evt.payload.command}`;
    return "Runtime event";
}

function StatTile({ label, value, sub, icon: Icon, tone = "neutral", glow = false }) {
    const toneVar = {
        ok: "var(--mc-ok)",
        warn: "var(--mc-warn)",
        err: "var(--mc-err)",
        info: "var(--mc-info)",
        accent: "var(--mc-accent)",
        neutral: "var(--mc-fg-1)",
    }[tone];

    return (
        <div
            className="relative rounded-[var(--mc-radius-lg)] p-[var(--mc-space-5)] border bg-[color:var(--mc-bg-1)] overflow-hidden"
            style={{
                borderColor: "var(--mc-line)",
                boxShadow: glow ? "var(--mc-shadow-glow)" : "var(--mc-shadow-1)",
            }}
        >
            {/* hairline accent on top */}
            <div
                aria-hidden
                className="absolute top-0 left-3 right-3 h-px"
                style={{
                    background: `linear-gradient(90deg, transparent 0%, ${toneVar} 50%, transparent 100%)`,
                    opacity: 0.6,
                }}
            />
            <div className="flex items-start gap-[var(--mc-space-3)]">
                <div
                    className="flex items-center justify-center rounded-[var(--mc-radius-md)] shrink-0"
                    style={{
                        width: 38,
                        height: 38,
                        background: `${toneVar}1f`,
                        color: toneVar,
                    }}
                >
                    {Icon && <Icon size={18} strokeWidth={1.75} />}
                </div>
                <div className="min-w-0 flex-1">
                    <div
                        className="mc-tabular mc-display"
                        style={{
                            fontSize: "var(--mc-text-xl)",
                            color: "var(--mc-fg)",
                            lineHeight: "var(--mc-leading-tight)",
                        }}
                    >
                        {String(value)}
                    </div>
                    <div
                        className="mt-1"
                        style={{
                            fontSize: "var(--mc-text-xs)",
                            letterSpacing: "var(--mc-tracking-wide)",
                            textTransform: "uppercase",
                            color: "var(--mc-fg-2)",
                        }}
                    >
                        {label}
                    </div>
                    {sub && (
                        <div
                            className="mt-1 truncate"
                            style={{
                                fontSize: "var(--mc-text-xs)",
                                color: "var(--mc-fg-2)",
                            }}
                        >
                            {sub}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

function DashboardInner() {
    const { status, jobs, events, threads, approvals, connectors } = useGateway();

    const pendingApprovals = approvals.filter((a) => a.status === "pending").length;
    const runningJobs = jobs.filter((j) => j.status === "running").length;
    const activeNodes = connectors.mac || connectors.desktop ? 1 : 0;
    const execPolicy = { security: "allowlist", askMode: "on-miss", fallback: "deny" };

    const isOnline = String(status || "").toLowerCase().includes("connected") || status === "online";

    const tiles = [
        {
            label: "Gateway",
            value: status || "—",
            icon: Activity,
            sub: "v847",
            tone: isOnline ? "ok" : "err",
            glow: isOnline,
        },
        {
            label: "Pending Approvals",
            value: pendingApprovals,
            icon: ShieldAlert,
            sub: pendingApprovals > 0 ? "Action required" : "All clear",
            tone: pendingApprovals > 0 ? "err" : "ok",
            glow: pendingApprovals > 0,
        },
        {
            label: "Active Jobs",
            value: runningJobs,
            icon: Briefcase,
            sub: `${jobs.length} total`,
            tone: runningJobs > 0 ? "accent" : "neutral",
        },
        {
            label: "Sessions",
            value: threads.length,
            icon: MessageSquareText,
            sub: "state active",
            tone: "accent",
        },
        {
            label: "Events",
            value: events.length,
            icon: Terminal,
            sub: "in-memory",
            tone: "neutral",
        },
        {
            label: "Nodes",
            value: activeNodes,
            icon: Laptop,
            sub: activeNodes > 0 ? "paired" : "none",
            tone: activeNodes > 0 ? "ok" : "neutral",
        },
    ];

    const policyTones = {
        allowlist: "warn",
        "on-miss": "ok",
        deny: "ok",
    };

    return (
        <>
            <PageHeader
                title="Mission Control"
                subtitle="Real-time operational view of your OpenClaw runtime."
                actions={
                    <Pill
                        tone={isOnline ? "ok" : "err"}
                        icon={<Indicator tone={isOnline ? "ok" : "err"} size="sm" pulse />}
                    >
                        {isOnline ? "ONLINE" : "OFFLINE"}
                    </Pill>
                }
            />

            <PageContent className="flex flex-col gap-[var(--mc-space-6)]">
                {/* Hero stat grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-[var(--mc-space-4)]">
                    {tiles.map((t) => (
                        <StatTile key={t.label} {...t} />
                    ))}
                </div>

                {/* Exec Policy hero */}
                <HeroCard>
                    <CardHeader
                        title={
                            <span className="inline-flex items-center gap-2">
                                <Lock size={14} style={{ color: "var(--mc-accent)" }} />
                                Exec Policy
                            </span>
                        }
                        subtitle="Tool-call safety + fallthrough behaviour"
                    />
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-[var(--mc-space-4)]">
                        {[
                            { label: "Security", val: execPolicy.security },
                            { label: "Ask Mode", val: execPolicy.askMode },
                            { label: "Fallback", val: execPolicy.fallback },
                        ].map((p) => (
                            <div
                                key={p.label}
                                className="rounded-[var(--mc-radius-md)] p-[var(--mc-space-4)] border"
                                style={{
                                    background: "var(--mc-bg-2)",
                                    borderColor: "var(--mc-line)",
                                }}
                            >
                                <div
                                    style={{
                                        fontSize: "var(--mc-text-xs)",
                                        letterSpacing: "var(--mc-tracking-wide)",
                                        textTransform: "uppercase",
                                        color: "var(--mc-fg-2)",
                                        marginBottom: 4,
                                    }}
                                >
                                    {p.label}
                                </div>
                                <div
                                    className="mc-display mc-tabular"
                                    style={{
                                        fontSize: "var(--mc-text-lg)",
                                        color: "var(--mc-fg)",
                                        fontFamily: "var(--mc-font-mono)",
                                        lineHeight: "var(--mc-leading-tight)",
                                    }}
                                >
                                    {p.val}
                                </div>
                                <div className="mt-2">
                                    <Pill tone={policyTones[p.val] || "neutral"} size="sm">
                                        {(policyTones[p.val] || "info").toUpperCase()}
                                    </Pill>
                                </div>
                            </div>
                        ))}
                    </div>
                </HeroCard>

                {/* Live activity */}
                <Card>
                    <CardHeader
                        title="Live Activity"
                        actions={
                            <Pill tone="ok" size="sm" icon={<Indicator tone="ok" pulse size="sm" />}>
                                STREAMING
                            </Pill>
                        }
                    />
                    <div
                        className="flex flex-col gap-1 max-h-60 overflow-y-auto"
                        style={{ scrollbarGutter: "stable" }}
                    >
                        {[...events]
                            .reverse()
                            .slice(0, 12)
                            .map((evt) => {
                                const t = String(evt.type || "");
                                const tone = t.includes("error")
                                    ? "err"
                                    : t.includes("warn")
                                      ? "warn"
                                      : "neutral";
                                const dotTone = tone === "neutral" ? "info" : tone;
                                return (
                                    <div
                                        key={evt.id}
                                        className="flex items-center gap-3 py-1.5 px-2 rounded-[var(--mc-radius-sm)] hover:bg-[color:var(--mc-bg-2)]"
                                        style={{ transition: "background var(--mc-dur-fast)" }}
                                    >
                                        <Indicator tone={dotTone} size="sm" />
                                        <span
                                            className="mc-tabular shrink-0"
                                            style={{
                                                fontSize: "var(--mc-text-xs)",
                                                fontFamily: "var(--mc-font-mono)",
                                                color: "var(--mc-fg-2)",
                                                minWidth: 76,
                                            }}
                                        >
                                            {new Date(evt.ts).toLocaleTimeString([], {
                                                hour: "2-digit",
                                                minute: "2-digit",
                                                second: "2-digit",
                                            })}
                                        </span>
                                        <Pill tone="neutral" size="sm">
                                            {evt.type || "event"}
                                        </Pill>
                                        <span
                                            className="flex-1 truncate"
                                            style={{
                                                fontSize: "var(--mc-text-sm)",
                                                color:
                                                    tone === "err"
                                                        ? "var(--mc-err)"
                                                        : tone === "warn"
                                                          ? "var(--mc-warn)"
                                                          : "var(--mc-fg-1)",
                                            }}
                                        >
                                            {eventText(evt)}
                                        </span>
                                    </div>
                                );
                            })}
                        {events.length === 0 && (
                            <div
                                className="rounded-[var(--mc-radius-md)] p-[var(--mc-space-4)]"
                                style={{
                                    color: "var(--mc-fg-2)",
                                    background: "var(--mc-bg-2)",
                                    fontSize: "var(--mc-text-sm)",
                                }}
                            >
                                No events yet.
                            </div>
                        )}
                    </div>
                    {pendingApprovals > 0 && (
                        <div
                            className="mt-[var(--mc-space-4)] flex items-center gap-[var(--mc-space-2)] p-[var(--mc-space-3)] rounded-[var(--mc-radius-md)] border"
                            style={{
                                background: "var(--mc-err-soft)",
                                borderColor: "var(--mc-err)",
                                boxShadow: "var(--mc-shadow-glow-err)",
                            }}
                        >
                            <AlertTriangle size={14} style={{ color: "var(--mc-err)" }} />
                            <span
                                style={{
                                    fontSize: "var(--mc-text-sm)",
                                    color: "var(--mc-err)",
                                }}
                            >
                                Pending approvals require review.
                            </span>
                        </div>
                    )}
                </Card>

                {/* 5-minute agent activity feed — wired to /api/v2/agents/tasks?since= */}
                <ActivityFeedPane />
            </PageContent>

            <PageMeta lastUpdated={Date.now()} dataSource="useGateway" />
        </>
    );
}

export default function DashboardPage() {
    return (
        <PageShell>
            <PageError>
                <PageLoading loading={false}>
                    <DashboardInner />
                </PageLoading>
            </PageError>
        </PageShell>
    );
}
