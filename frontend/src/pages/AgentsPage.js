import React from "react";
import { Bot, HeartPulse, Laptop, ShieldCheck } from "lucide-react";
import { C } from "@/lib/constants";
import { useGateway, switchModel } from "@/lib/useGateway";
import { ModelSelector } from "@/components/ModelSelector";

const AGENT_CARDS = [
  { id: "main", model: "anthropic/claude-sonnet-4-6", status: "online", workspace: "~/.openclaw/workspace", sessionCount: 3, heartbeat: "30m", default: true },
  { id: "coder", model: "anthropic/claude-opus-4-7", status: "idle", workspace: "~/.openclaw/workspace-coder", sessionCount: 1, heartbeat: "0m", default: false },
];

const PAIRED_NODES = [
  { id: "node-macbook", name: "Meg's MacBook", platform: "macOS", lastSeen: "2m ago", capabilities: ["canvas", "screen.record"] },
];

export default function AgentsPage() {
  const { models, providers, activeModel, enabledSkills } = useGateway();

  return (
    <div className="p-6 space-y-4" style={{ color: C.text }}>
      <div>
        <h1 className="text-5xl font-bold tracking-tight">Agents</h1>
        <p className="text-lg" style={{ color: C.muted }}>Multi-agent configuration, workspaces, and paired nodes.</p>
      </div>

      <div className="p-4 rounded-xl" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-sm font-medium">Agent Mode</div>
            <div className="text-xs" style={{ color: C.muted }}>Default model and active capability context for agent runs.</div>
          </div>
          <ModelSelector models={models} providers={providers} activeModel={activeModel} onSelect={switchModel} />
        </div>
        <div className="mt-3 text-[11px]" style={{ color: C.muted }}>
          Enabled skills: {enabledSkills.length}
        </div>
      </div>

      <div className="space-y-3">
        {AGENT_CARDS.map((agent) => (
          <div key={agent.id} className="p-5 rounded-xl" style={{ background: C.surface, border: `1px solid ${agent.default ? `${C.accent}66` : C.border}` }}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: agent.default ? "rgba(29,140,248,0.18)" : C.surface2, border: `1px solid ${agent.default ? "rgba(29,140,248,0.4)" : C.border}` }}>
                <Bot className="w-4 h-4" style={{ color: agent.default ? C.accent : C.muted }} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-4xl leading-none font-semibold">{agent.id}</span>
                  {agent.default && <span className="text-[12px] px-2 py-1 rounded-md" style={{ background: "rgba(29,140,248,0.16)", color: C.accent }}>default</span>}
                </div>
                <div className="text-[12px] font-mono" style={{ color: C.muted }}>{agent.model}</div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[12px]">
              <div className="p-3 rounded-lg" style={{ background: C.surface2 }}>
                <div className="text-[10px] uppercase tracking-wider mb-1" style={{ color: C.muted }}>Workspace</div>
                <div className="font-mono" style={{ color: C.text }}>{agent.workspace}</div>
              </div>
              <div className="p-3 rounded-lg" style={{ background: C.surface2 }}>
                <div className="text-[10px] uppercase tracking-wider mb-1" style={{ color: C.muted }}>Active Sessions</div>
                <div style={{ color: C.text }}>{agent.sessionCount}</div>
              </div>
              <div className="p-3 rounded-lg" style={{ background: C.surface2 }}>
                <div className="text-[10px] uppercase tracking-wider mb-1" style={{ color: C.muted }}>Heartbeat</div>
                <div className="flex items-center gap-1.5">
                  {agent.heartbeat !== "0m" ? (
                    <><HeartPulse className="w-3.5 h-3.5" style={{ color: C.green }} /><span style={{ color: C.green }}>every {agent.heartbeat}</span></>
                  ) : (
                    <span style={{ color: C.muted }}>disabled</span>
                  )}
                </div>
              </div>
              <div className="p-3 rounded-lg" style={{ background: C.surface2 }}>
                <div className="text-[10px] uppercase tracking-wider mb-1" style={{ color: C.muted }}>Bootstrap Files</div>
                <div className="flex flex-wrap gap-1">
                  {["AGENTS.md", "SOUL.md", "USER.md", "TOOLS.md", "MEMORY.md", "HEARTBEAT.md"].map((f) => (
                    <span key={f} className="text-[9px] px-1.5 py-0.5 rounded font-mono" style={{ background: C.surface, color: C.muted }}>{f}</span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="p-4 rounded-xl" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
        <div className="flex items-center gap-2 mb-3">
          <Laptop className="w-4 h-4" style={{ color: C.accent }} />
          <span className="text-[13px] font-semibold">Paired Nodes</span>
        </div>
        {PAIRED_NODES.map((node) => (
          <div key={node.id} className="flex items-center gap-3 p-3 rounded-lg" style={{ background: C.surface2 }}>
            <span className="w-2 h-2 rounded-full" style={{ background: C.green }} />
            <div className="flex-1">
              <div className="text-[13px] font-medium">{node.name}</div>
              <div className="text-[12px]" style={{ color: C.muted }}>{node.platform} · Last seen: {node.lastSeen}</div>
            </div>
            <div className="flex gap-1">
              {node.capabilities.map((cap) => (
                <span key={cap} className="text-[10px] px-2 py-1 rounded-md" style={{ background: C.surface, color: cap === "screen.record" ? C.yellow : C.muted }}>
                  {cap}
                </span>
              ))}
            </div>
            <button className="px-2 py-1 rounded-md text-[10px]" style={{ background: "rgba(239,68,68,0.15)", color: C.red, border: "1px solid rgba(239,68,68,0.25)" }}>
              Revoke
            </button>
          </div>
        ))}
      </div>

      <div className="p-3 rounded-xl inline-flex items-center gap-2 text-xs" style={{ background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.2)", color: C.yellow }}>
        <ShieldCheck className="w-3.5 h-3.5" /> Approval-gated desktop actions remain enforced separately.
      </div>
    </div>
  );
}
