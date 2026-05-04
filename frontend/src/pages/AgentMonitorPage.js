/**
 * AgentMonitorPage — lightweight monitor page.
 *
 * NOTE: This page is NOT routed in App.js. It exists as a buildable component
 * for future use. Real agent monitoring lives at /agents (AgentsPage).
 *
 * Wires to:
 *   GET /api/v2/agents/tasks   (polled every 10s)
 *   WS  /api/ws/agents         (real-time push — not yet connected)
 */
import React, { useEffect } from "react";
import { Activity, RefreshCw } from "lucide-react";
import { C } from "@/lib/constants";
import { useGateway } from "@/lib/useGateway";
import { AgentActivityFeed } from "@/components/AgentActivityFeed";

export default function AgentMonitorPage() {
  const { agentTasks, agentTasksLoading, agentTasksError, fetchAgentTasks } = useGateway();

  useEffect(() => {
    fetchAgentTasks();
    const interval = setInterval(() => fetchAgentTasks({ silent: true }), 10_000);
    return () => clearInterval(interval);
  }, [fetchAgentTasks]);

  return (
    <div className="h-full flex flex-col" style={{ color: C.text }}>
      <div className="flex-1 overflow-y-auto">
        <div className="p-6 max-w-4xl mx-auto space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="w-5 h-5" style={{ color: C.accent }} />
              <h1 className="text-2xl font-bold">Agent Monitor</h1>
            </div>
            <button
              onClick={() => fetchAgentTasks()}
              disabled={agentTasksLoading}
              className="px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 disabled:opacity-50"
              style={{ background: C.surface2, border: `1px solid ${C.border}`, color: C.text }}
            >
              <RefreshCw className={`w-3 h-3 ${agentTasksLoading ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>

          {agentTasksError && (
            <div
              className="p-3 rounded-lg text-xs"
              style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", color: "#f87171" }}
            >
              {agentTasksError}
            </div>
          )}

          <AgentActivityFeed tasks={agentTasks} filter="all" maxItems={50} />
        </div>
      </div>
    </div>
  );
}
