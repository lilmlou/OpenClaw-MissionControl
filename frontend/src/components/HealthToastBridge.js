import { useEffect, useRef } from "react";
import { useGateway, selectAgentsHealth } from "@/lib/useGateway";
import { useToast } from "@/hooks/use-toast";
import { useShallow } from "zustand/react/shallow";

/**
 * HealthToastBridge — invisible component that translates store changes into toasts.
 *
 * Triggers:
 *   - Agents health transitions into "warning", "stalled", or "error"
 *   - Any new failed agent task (id we haven't seen before)
 *   - gateway.timeout / gateway.error events emitted by the chat WS
 *
 * Healthy → noisy state changes only show one toast per transition (deduped by state).
 */
export function HealthToastBridge() {
  const { toast } = useToast();
  const health = useGateway(useShallow(selectAgentsHealth));
  const events = useGateway((s) => s.events);
  const agentTasks = useGateway((s) => s.agentTasks);

  const lastHealthState = useRef(null);
  const seenFailedIds = useRef(new Set());
  const failedSeedDone = useRef(false);
  const lastEventId = useRef(null);

  // Health state transitions
  useEffect(() => {
    if (!health || health.state === lastHealthState.current) return;
    const prev = lastHealthState.current;
    lastHealthState.current = health.state;

    // Don't toast on first render or transitions to/from "loading"
    if (prev === null || health.state === "loading") return;

    if (health.state === "healthy" && (prev === "error" || prev === "stalled" || prev === "warning")) {
      toast({ title: "Agents recovered", description: "Watcher and runtime are healthy again." });
      return;
    }
    if (health.state === "warning") {
      toast({
        title: "Watcher: environment warnings",
        description: health.staticDetail || "Some environment checks failed.",
        variant: "default",
      });
    } else if (health.state === "stalled") {
      toast({
        title: "Watcher stalled",
        description: health.staticDetail || "No watcher tick in 2+ minutes.",
        variant: "destructive",
      });
    } else if (health.state === "error") {
      toast({
        title: health.label || "Agents error",
        description: health.staticDetail || "Backend agent runtime is reporting errors.",
        variant: "destructive",
      });
    }
  }, [health, toast]);

  // Newly failed agent tasks. On first mount, seed the "seen" set with every
  // historical failure so we only toast for tasks that fail after page load —
  // otherwise the entire backlog (sometimes hundreds) toasts at once.
  useEffect(() => {
    if (!Array.isArray(agentTasks)) return;

    if (!failedSeedDone.current) {
      for (const t of agentTasks) {
        if (t?.status === "failed" && t.id) seenFailedIds.current.add(t.id);
      }
      failedSeedDone.current = true;
      return; // skip toasting on the seed pass
    }

    for (const t of agentTasks) {
      if (t?.status === "failed" && t.id && !seenFailedIds.current.has(t.id)) {
        seenFailedIds.current.add(t.id);
        // Only toast for failures within the last 5 minutes — anything older
        // is backlog the user has already moved past.
        const age = Date.now() - (t.createdAt || 0);
        if (age > 5 * 60 * 1000) continue;
        toast({
          title: `${t.agent || "Agent"} failed`,
          description: (t.result || "").slice(0, 160) || "No details.",
          variant: "destructive",
        });
      }
    }
  }, [agentTasks, toast]);

  // Gateway timeout / chat error events
  useEffect(() => {
    if (!Array.isArray(events) || events.length === 0) return;
    const newest = events[events.length - 1];
    if (!newest || newest.id === lastEventId.current) return;
    lastEventId.current = newest.id;
    if (newest.type === "gateway.timeout") {
      toast({
        title: "Response timed out",
        description: "Backend stopped streaming. Try again or switch model.",
        variant: "destructive",
      });
    } else if (newest.type === "gateway.error" && newest.payload?.error) {
      toast({
        title: "Gateway error",
        description: String(newest.payload.error).slice(0, 200),
        variant: "destructive",
      });
    } else if (newest.type === "model.not_routable" && newest.payload?.reason) {
      toast({
        title: "Model not routable",
        description: String(newest.payload.reason).slice(0, 200),
      });
    }
  }, [events, toast]);

  return null;
}
