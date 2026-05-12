// VM-D2 Progress Pulse — Top-level dashboard surface
// Fetches /api/v2/progress + /counts on mount, subscribes to existing
// /api/ws/config singleton for progress.* frames, and renders a filter
// chip strip + status counts + ordered <ProgressEntryCard> list.
//
// Phase 0 §1 (visual-first), §3 (live-config: WS, no reload), §4
// (no raw bodies), §6 (real-time), §7 (visible — mark-seen emits
// activity via BindAction → registered action).
//
// NO mock data. NO setTimeout fakery. NO window.location.reload().
// NO second WS connection (uses subscribeConfigWs singleton).
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Activity, RefreshCw, Filter } from "lucide-react";
import { Card, CardHeader, Pill, EmptyState, ErrorState, IconButton, Button } from "@/components/kit";
import { apiUrl } from "@/lib/useGateway";
import { subscribeConfigWs, useConfigValue } from "@/hooks/useConfigBus";
import { ProgressEntryCard } from "./ProgressEntryCard";

const STATUSES = ["verified", "claims_done", "deceptive", "in_flight"];
const FILTERS = [
    { id: "all", label: "All" },
    { id: "verified", label: "Verified" },
    { id: "claims_done", label: "Claims Done" },
    { id: "deceptive", label: "Deceptive" },
    { id: "in_flight", label: "In Flight" },
];
const FILTER_TONE = {
    all: "neutral",
    verified: "ok",
    claims_done: "warn",
    deceptive: "err",
    in_flight: "info",
};

function sortEntries(items) {
    // newest first by date_ts; preserve order if missing
    return [...items].sort((a, b) => (b.date_ts || 0) - (a.date_ts || 0));
}

function mergeAdded(existing, incoming) {
    const id = incoming?.id;
    if (!id) return existing;
    const without = existing.filter((e) => e.id !== id);
    return sortEntries([incoming, ...without]);
}

function mergeChanged(existing, incoming) {
    const id = incoming?.id;
    if (!id) return existing;
    let touched = false;
    const next = existing.map((e) => {
        if (e.id === id) {
            touched = true;
            return { ...e, ...incoming };
        }
        return e;
    });
    return touched ? next : mergeAdded(existing, incoming);
}

export function ProgressPulse() {
    const { value: maxRaw } = useConfigValue("progress.pulse.max_entries");
    const limit = useMemo(() => {
        const n = Number(maxRaw);
        return Number.isFinite(n) && n > 0 ? Math.min(n, 100) : 20;
    }, [maxRaw]);

    const [entries, setEntries] = useState([]);
    const [counts, setCounts] = useState(null);
    const [filter, setFilter] = useState("all");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [wsConnected, setWsConnected] = useState(false);
    const wsLastMsgRef = useRef(0);

    const fetchAll = useCallback(async (signal) => {
        setLoading(true);
        setError(null);
        try {
            const [cRes, lRes] = await Promise.all([
                fetch(apiUrl("/api/v2/progress/counts"), { signal }),
                fetch(apiUrl(`/api/v2/progress?limit=${limit}`), { signal }),
            ]);
            if (!cRes.ok) throw new Error(`counts HTTP ${cRes.status}`);
            if (!lRes.ok) throw new Error(`list HTTP ${lRes.status}`);
            const cJson = await cRes.json();
            const lJson = await lRes.json();
            const cData = cJson?.data || cJson || {};
            const lData = lJson?.data || lJson || {};
            const items = Array.isArray(lData.items) ? lData.items : [];
            setCounts({
                verified: cData.verified ?? 0,
                claims_done: cData.claims_done ?? 0,
                deceptive: cData.deceptive ?? 0,
                in_flight: cData.in_flight ?? 0,
                unseen_total: cData.unseen_total ?? 0,
            });
            setEntries(sortEntries(items));
            setLoading(false);
        } catch (err) {
            if (err.name === "AbortError") return;
            setError(err.message || String(err));
            setLoading(false);
        }
    }, [limit]);

    // Initial fetch + refetch when limit changes.
    useEffect(() => {
        const ctl = new AbortController();
        fetchAll(ctl.signal);
        return () => ctl.abort();
    }, [fetchAll]);

    // WS subscription: progress.* frames on the shared config bus.
    useEffect(() => {
        const unsub = subscribeConfigWs((msg) => {
            if (!msg || typeof msg.type !== "string") return;
            if (!msg.type.startsWith("progress.")) return;
            wsLastMsgRef.current = Date.now();
            setWsConnected(true);
            const data = msg.data || {};
            if (msg.type === "progress.entry.added") {
                setEntries((prev) => mergeAdded(prev, data));
            } else if (msg.type === "progress.entry.changed") {
                setEntries((prev) => mergeChanged(prev, data));
            } else if (msg.type === "progress.scan") {
                if (data.counts) {
                    setCounts((prev) => ({ ...(prev || {}), ...data.counts }));
                }
            } else if (msg.type === "progress.replay") {
                if (Array.isArray(data.items)) {
                    setEntries(sortEntries(data.items));
                }
                if (data.counts) {
                    setCounts((prev) => ({ ...(prev || {}), ...data.counts }));
                }
            }
        });
        return () => { unsub(); };
    }, []);

    const filtered = useMemo(() => {
        if (filter === "all") return entries;
        return entries.filter((e) => e.status === filter);
    }, [entries, filter]);

    const handleMarkAllSeen = useCallback(async () => {
        const unseen = entries.filter((e) => !e.seen);
        if (unseen.length === 0) return;
        // Fire and forget per entry; WS will reconcile dimmed state via
        // progress.entry.changed. We optimistically update on success.
        await Promise.all(unseen.map(async (e) => {
            try {
                const res = await fetch(
                    apiUrl(`/api/v2/progress/${encodeURIComponent(e.id)}/seen`),
                    { method: "POST" },
                );
                if (!res.ok) return;
                const j = await res.json().catch(() => null);
                const updated = j?.data || { ...e, seen: true };
                setEntries((prev) => mergeChanged(prev, updated));
            } catch {
                /* ignore — WS replay will reconcile */
            }
        }));
    }, [entries]);

    const totalCount = counts
        ? STATUSES.reduce((sum, s) => sum + (counts[s] || 0), 0)
        : entries.length;

    return (
        <Card data-testid="progress-pulse" className="flex flex-col gap-[var(--mc-space-4)]">
            <CardHeader
                title={
                    <span className="inline-flex items-center gap-2">
                        <Activity size={14} style={{ color: "var(--mc-accent)" }} />
                        Progress Pulse
                    </span>
                }
                subtitle="Live PROGRESS.md mirror — verified, claims_done, deceptive, in_flight."
                actions={
                    <div className="flex items-center gap-[var(--mc-space-2)]">
                        <Pill
                            tone={wsConnected ? "ok" : "neutral"}
                            size="sm"
                            data-testid="progress-pulse-ws"
                        >
                            {wsConnected ? "LIVE" : "POLLING"}
                        </Pill>
                        <IconButton
                            aria-label="Refresh progress"
                            onClick={() => fetchAll()}
                            disabled={loading}
                        >
                            <RefreshCw size={14} />
                        </IconButton>
                        <Button
                            size="sm"
                            variant="secondary"
                            onClick={handleMarkAllSeen}
                            data-testid="progress-mark-all-seen"
                            disabled={!entries.some((e) => !e.seen)}
                        >
                            Mark all seen
                        </Button>
                    </div>
                }
            />

            {/* Filter strip + counts */}
            <div className="flex items-center justify-between gap-[var(--mc-space-3)] flex-wrap">
                <div className="flex items-center gap-[var(--mc-space-2)] flex-wrap">
                    <Filter size={12} style={{ color: "var(--mc-fg-2)" }} />
                    {FILTERS.map((f) => {
                        const active = filter === f.id;
                        return (
                            <button
                                key={f.id}
                                type="button"
                                onClick={() => setFilter(f.id)}
                                data-testid={`progress-filter-${f.id}`}
                                aria-pressed={active}
                                className="cursor-pointer"
                                style={{ background: "none", border: "none", padding: 0 }}
                            >
                                <Pill
                                    tone={active ? FILTER_TONE[f.id] : "neutral"}
                                    size="sm"
                                >
                                    {f.label}
                                </Pill>
                            </button>
                        );
                    })}
                </div>
                {counts && (
                    <div
                        className="flex items-center gap-[var(--mc-space-2)] flex-wrap"
                        data-testid="progress-counts"
                        style={{ fontSize: "var(--mc-text-xs)", color: "var(--mc-fg-2)" }}
                    >
                        <Pill tone="ok"      size="sm">✓ {counts.verified ?? 0}</Pill>
                        <Pill tone="warn"    size="sm">⏳ {counts.claims_done ?? 0}</Pill>
                        <Pill tone="err"     size="sm">✗ {counts.deceptive ?? 0}</Pill>
                        <Pill tone="info"    size="sm">⟳ {counts.in_flight ?? 0}</Pill>
                        <span style={{ marginLeft: 4 }}>· {totalCount} total</span>
                    </div>
                )}
            </div>

            {/* Body */}
            {error ? (
                <ErrorState
                    title="Progress mirror unavailable"
                    description={`Could not load PROGRESS.md entries from the backend (${error}). The mirror service may be down on :8765.`}
                    fix={[{ label: "Retry", onClick: () => fetchAll() }]}
                />
            ) : loading && entries.length === 0 ? (
                <div
                    className="p-[var(--mc-space-4)]"
                    style={{ fontSize: "var(--mc-text-sm)", color: "var(--mc-fg-2)" }}
                    data-testid="progress-loading"
                >
                    Loading progress entries…
                </div>
            ) : filtered.length === 0 ? (
                <EmptyState
                    title={filter === "all" ? "No progress entries yet" : `No ${filter.replace("_", " ")} entries`}
                    description={
                        filter === "all"
                            ? "Dispatch a task — PROGRESS.md entries appear here within seconds."
                            : "Try a different filter or wait for the next planner run."
                    }
                />
            ) : (
                <div
                    className="flex flex-col gap-[var(--mc-space-3)]"
                    data-testid="progress-list"
                >
                    {filtered.map((entry) => (
                        <ProgressEntryCard key={entry.id} entry={entry} />
                    ))}
                </div>
            )}
        </Card>
    );
}

export default ProgressPulse;
