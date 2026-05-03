import React, { useMemo, useState } from "react";
import { C } from "@/lib/constants";
import { useGateway } from "@/lib/useGateway";

function levelFor(evt) {
  const txt = `${evt.type || ""} ${evt.text || ""}`.toLowerCase();
  if (txt.includes("error") || txt.includes("blocked") || txt.includes("deny")) return "error";
  if (txt.includes("warn") || txt.includes("pending")) return "warn";
  return "info";
}

function eventText(evt) {
  if (evt.text) return evt.text;
  if (evt.payload?.content) return evt.payload.content;
  if (evt.payload?.model) return `Model switched to ${evt.payload.model}`;
  if (evt.payload?.command) return `Executed ${evt.payload.command}`;
  return "Runtime event";
}

export default function EventsPage() {
  const { events } = useGateway();
  const [typeFilter, setTypeFilter] = useState("all");

  const types = useMemo(() => ["all", ...new Set(events.map((e) => e.type || "event"))], [events]);
  const filtered = typeFilter === "all" ? events : events.filter((e) => (e.type || "event") === typeFilter);

  return (
    <div className="h-full flex flex-col" style={{ color: C.text }}>
      <div className="flex-1 overflow-y-auto">
        <div className="p-6 space-y-5 max-w-5xl mx-auto">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-5xl font-bold tracking-tight">Event Stream</h1>
          <p className="text-lg" style={{ color: C.muted }}>Live Gateway events — rolling in-memory buffer, not persisted.</p>
        </div>
        <span className="text-[12px] px-3 py-1.5 rounded-lg" style={{ background: "rgba(34,197,94,0.1)", color: C.green, border: "1px solid rgba(34,197,94,0.2)" }}>subscribed</span>
      </div>

      <div className="flex gap-1 flex-wrap">
        {types.map((t) => (
          <button key={t} onClick={() => setTypeFilter(t)} className="px-3 py-1.5 rounded-md text-[12px] capitalize transition-colors"
            style={{ background: typeFilter === t ? C.surface2 : "transparent", color: typeFilter === t ? C.text : C.muted, border: `1px solid ${typeFilter === t ? C.border : "transparent"}` }}>
            {t}
          </button>
        ))}
      </div>

      <div className="rounded-xl overflow-hidden" style={{ background: "#000", border: `1px solid ${C.border}` }}>
        <div className="p-4 font-mono text-[12px] space-y-1 max-h-[70vh] overflow-y-auto">
          {filtered.length === 0 && (
            <div className="py-1" style={{ color: C.muted }}>
              No events yet.
            </div>
          )}
          {filtered.slice().reverse().map((evt) => {
            const level = levelFor(evt);
            const levelColor = level === "error" ? C.red : level === "warn" ? C.yellow : C.muted;
            return (
            <div key={evt.id} className="flex items-start gap-3 py-1">
              <span className="shrink-0" style={{ minWidth: 14 }}>{evt.autonomous ? "🔄" : "💬"}</span>
              <span className="shrink-0" style={{ color: C.muted, minWidth: 70 }}>
                {new Date(evt.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
              </span>
              <span className="shrink-0 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase"
                style={{ minWidth: 48, textAlign: "center", background: `${levelColor}22`, color: levelColor }}>
                {level}
              </span>
              <span className="shrink-0 px-1.5 py-0.5 rounded text-[9px] capitalize" style={{ background: C.surface2, color: C.muted, minWidth: 72, textAlign: "center" }}>
                {evt.type || "event"}
              </span>
              <span style={{ color: levelColor }}>{eventText(evt)}</span>
            </div>
          );})}
        </div>
      </div>
        </div>
      </div>
    </div>
  );
}
