/**
 * Phase 0.3 — <BindFeed>
 *
 *   <BindFeed topic="agent.events" max={50} />
 *   <BindFeed topic="*" />        // every WS message
 *
 * Subscribes to the SHARED config WS singleton (Phase 0.1) — never opens a
 * second socket — and renders a rolling list of the most recent events
 * matching `topic`. Filtering matches `msg.type` startsWith `topic`, or
 * `topic === "*"` (everything).
 *
 * Auto-cleans the subscription on unmount via the unsubscribe function
 * returned from `subscribeConfigWs`.
 */
import React, { useEffect, useState } from "react";
import { Activity } from "lucide-react";
import { C } from "@/lib/constants";
import { EmptyState } from "@/components/kit";
import { subscribeConfigWs } from "@/hooks/useConfigBus";

function fmtTime(ts) {
  if (!ts) return "—";
  const d = new Date(typeof ts === "number" ? ts : Date.parse(ts));
  if (isNaN(d.getTime())) return String(ts);
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function summarise(msg) {
  if (!msg || typeof msg !== "object") return JSON.stringify(msg);
  if (msg.summary) return msg.summary;
  if (msg.type === "config.set" && msg.key) {
    const v = JSON.stringify(msg.value);
    return `${msg.key} = ${v?.length > 60 ? v.slice(0, 60) + "…" : v}`;
  }
  if (msg.type === "config.deleted" && msg.key) return `deleted ${msg.key}`;
  if (msg.type === "action.invoked") return `${msg.key || "?"} invoked${msg.actor ? ` by ${msg.actor}` : ""}`;
  return msg.type || "(event)";
}

export function BindFeed({
  topic = "*",
  max = 50,
  dataTestid,
  title,
  className,
  height = 240,
}) {
  const [events, setEvents] = useState([]);

  useEffect(() => {
    const unsubscribe = subscribeConfigWs((msg) => {
      if (!msg || typeof msg !== "object") return;
      const t = String(msg.type || "");
      const matches = topic === "*" || t === topic || t.startsWith(`${topic}.`) || t.startsWith(topic);
      if (!matches) return;
      const ts = msg.ts || Date.now();
      setEvents((prev) => {
        const next = [{ ts, msg, _id: `${ts}-${Math.random().toString(36).slice(2, 8)}` }, ...prev];
        if (next.length > max) next.length = max;
        return next;
      });
    });
    return () => {
      // Critical: unsubscribe on unmount to honour Phase 0.3 §7
      // "All bindings unmount cleanly (no leaked WS subscriptions)"
      try { unsubscribe(); } catch { /* noop */ }
    };
  }, [topic, max]);

  const testid = dataTestid || `bind-feed-${topic}`;

  return (
    <div
      data-testid={testid}
      className={className}
      style={{
        background: C.surface,
        border: `1px solid ${C.border}`,
        borderRadius: "var(--mc-radius-md)",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        className="flex items-center gap-2 px-3 py-2"
        style={{ borderBottom: `1px solid ${C.border}` }}
      >
        <Activity size={12} style={{ color: C.accent }} />
        <span className="text-[12px] font-semibold" style={{ color: C.text }}>
          {title || `Live feed: ${topic}`}
        </span>
        <span className="text-[10px] ml-auto" style={{ color: C.muted }}>
          {events.length} event{events.length === 1 ? "" : "s"}
        </span>
      </div>

      <div
        className="overflow-auto"
        style={{ maxHeight: height }}
        data-testid={`${testid}-list`}
      >
        {events.length === 0 ? (
          <EmptyState
            title="Waiting for events"
            description={`No events received yet on topic "${topic}".`}
          />
        ) : (
          events.map((e) => (
            <div
              key={e._id}
              className="flex items-start gap-2 px-3 py-1.5"
              style={{ borderBottom: `1px solid ${C.border}` }}
              data-testid={`${testid}-row`}
            >
              <span
                className="text-[10px] font-mono shrink-0"
                style={{ color: C.muted, minWidth: 64 }}
              >
                {fmtTime(e.ts)}
              </span>
              <span
                className="text-[10px] font-mono shrink-0 px-1.5 py-0.5 rounded"
                style={{
                  background: C.surface2,
                  color: C.accent,
                  letterSpacing: "var(--mc-tracking-wide)",
                }}
              >
                {e.msg.type || "?"}
              </span>
              <span
                className="text-[11px] flex-1 min-w-0 truncate"
                style={{ color: C.text }}
                title={JSON.stringify(e.msg)}
              >
                {summarise(e.msg)}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default BindFeed;
