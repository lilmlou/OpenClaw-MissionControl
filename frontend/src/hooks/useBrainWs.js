/**
 * P0-A FE-1 — Brain WS hook
 *
 * Subscribes to /api/ws/brain on :7801 for real-time brain lifecycle events.
 * On connect: fetches GET /api/v1/brain/log for initial backfill, then streams live.
 * Debounces brain.stream.chunk renders to 50 ms.
 * On brain.error: toasts all fix[] items as action buttons.
 * Ring-buffer of last N events (default 500 from config bus).
 *
 * NO MOCK DATA. Real WS + HTTP against AgentRuntime gateway.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { toast } from "@/hooks/use-toast";
import { getApiBase } from "@/lib/useGateway";

const GATEWAY_BASE = getApiBase() || "http://127.0.0.1:7801";
const DEBOUNCE_MS = 50;
const DEFAULT_RING_SIZE = 500;

function brainWsUrl() {
  const base = getApiBase();
  if (base) {
    const wsBase = base.startsWith("https://")
      ? base.replace("https://", "wss://")
      : base.replace("http://", "ws://");
    return `${wsBase}/api/ws/brain`;
  }
  const wsProto = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${wsProto}//${window.location.hostname}:7801/api/ws/brain`;
}

let brainWs = null;
let brainWsListeners = new Set();
let brainWsReconnectTimer = null;
let eventRing = [];
let ringSize = DEFAULT_RING_SIZE;

function pushRing(event) {
  eventRing.push(event);
  if (eventRing.length > ringSize) {
    eventRing = eventRing.slice(eventRing.length - ringSize);
  }
  return eventRing;
}

function ensureBrainWs() {
  if (brainWs && (brainWs.readyState === WebSocket.OPEN || brainWs.readyState === WebSocket.CONNECTING)) {
    return;
  }
  clearTimeout(brainWsReconnectTimer);
  try {
    brainWs = new WebSocket(brainWsUrl());
    brainWs.onopen = () => {
      // Backfill on connect
      fetch(`${GATEWAY_BASE}/api/v1/brain/log?limit=50`, { cache: "no-store" })
        .then(r => r.json())
        .then(payload => {
          const data = payload?.data || payload;
          const events = data?.events || [];
          events.reverse().forEach(e => pushRing(e));
          brainWsListeners.forEach(fn => { try { fn({ type: "brain.backfill", events: [...eventRing] }); } catch {} });
        })
        .catch(() => {});
    };
    brainWs.onclose = () => {
      brainWs = null;
      brainWsReconnectTimer = setTimeout(ensureBrainWs, 3000);
    };
    brainWs.onerror = () => {};
    brainWs.onmessage = (ev) => {
      let msg;
      try { msg = JSON.parse(ev.data); } catch { return; }
      pushRing(msg);
      brainWsListeners.forEach(fn => { try { fn(msg); } catch {} });
    };
  } catch {
    brainWsReconnectTimer = setTimeout(ensureBrainWs, 5000);
  }
}

export function useBrainWs() {
  const [events, setEvents] = useState([...eventRing]);
  const [connected, setConnected] = useState(false);
  const [lastError, setLastError] = useState(null);
  const chunkBuf = useRef("");
  const chunkTimer = useRef(null);
  const ringSizeRef = useRef(ringSize);

  // Fetch ring size from config bus on mount
  useEffect(() => {
    const cfgUrl = getApiBase()
      ? `${getApiBase().replace(/7801$/, "8765")}/api/v2/config/brain.log.retention_events`
      : "http://127.0.0.1:8765/api/v2/config/brain.log.retention_events";
    fetch(cfgUrl, { cache: "no-store" })
      .then(r => r.json())
      .then(payload => {
        const val = payload?.data?.value;
        if (typeof val === "number" && val > 0) {
          ringSize = val;
          ringSizeRef.current = val;
        }
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const listener = (msg) => {
      if (msg.type === "brain.backfill") {
        setEvents(msg.events);
        setConnected(true);
        return;
      }

      // brain.stream.chunk — debounce to 50ms
      if (msg.type === "brain.stream.chunk") {
        chunkBuf.current += (msg.payload?.chunk || "");
        if (!chunkTimer.current) {
          chunkTimer.current = setTimeout(() => {
            setEvents([...eventRing]);
            chunkBuf.current = "";
            chunkTimer.current = null;
          }, DEBOUNCE_MS);
        }
        return;
      }

      // brain.error — toast with fix[] actions
      if (msg.type === "brain.error") {
        setLastError(msg.payload?.error_human || msg.payload?.error_code || "Brain error");
        const fixes = msg.fix || [];
        if (fixes.length > 0) {
          toast({
            title: msg.payload?.error_human || "Brain Error",
            description: msg.payload?.error_code || "",
            variant: "destructive",
            action: fixes.map((f, i) => ({
              label: f.label,
              onClick: () => {
                // Route fix actions
                if (f.action === "nav" && f.args?.path) {
                  window.location.hash = `#${f.args.path}`;
                }
              },
            })),
          });
        } else {
          toast({
            title: msg.payload?.error_human || "Brain Error",
            description: msg.payload?.error_code || "",
            variant: "destructive",
          });
        }
      }

      // For all other events, push immediately
      if (msg.type !== "brain.backfill") {
        setEvents([...eventRing]);
      }
    };

    brainWsListeners.add(listener);
    ensureBrainWs();

    // Check connected state
    const interval = setInterval(() => {
      setConnected(brainWs?.readyState === WebSocket.OPEN);
    }, 1000);

    return () => {
      brainWsListeners.delete(listener);
      clearInterval(interval);
      clearTimeout(chunkTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { events, connected, lastError };
}

// For testing
export function closeBrainWs() {
  clearTimeout(brainWsReconnectTimer);
  if (brainWs) { brainWs.close(); brainWs = null; }
  brainWsListeners.clear();
  eventRing = [];
}