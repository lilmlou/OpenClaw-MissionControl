import React from "react";
import { useNavigate } from "react-router-dom";
import { Activity, Archive, RotateCcw } from "lucide-react";
import { C, getSpaceIcon } from "@/lib/constants";
import { useGateway } from "@/lib/useGateway";

function getStatus(ts) {
  return Date.now() - ts <= 5 * 60 * 1000 ? "active" : "idle";
}

function inferChannel(thread) {
  const src = `${thread.title || ""} ${thread.id || ""}`.toLowerCase();
  if (src.includes("telegram")) return "telegram";
  if (src.includes("signal")) return "signal";
  if (src.includes("whatsapp")) return "whatsapp";
  return "webchat";
}

function estimateContextUsage(messages) {
  const safe = Array.isArray(messages) ? messages : [];
  const chars = safe.reduce((sum, m) => sum + (m?.content?.length || 0), 0);
  const maxChars = 24000;
  const pct = Math.max(0.06, Math.min(0.96, chars / maxChars));
  return pct;
}

export default function SessionsPage() {
  const navigate = useNavigate();
  const { threads, spaces, activeThreadId, setActiveThread } = useGateway();

  return (
    <div className="p-3 space-y-2" style={{ color: C.text }}>
      <div>
        <h1 className="text-lg font-bold tracking-tight">Sessions</h1>
        <p className="text-[11px]" style={{ color: C.muted }}>Active agent sessions — state owned by Gateway, reflected here.</p>
      </div>

      <div className="space-y-1.5">
        {threads.map((thread) => {
          const messages = Array.isArray(thread.messages) ? thread.messages : [];
          const lastActivity = thread.updatedAt || thread.createdAt || Date.now();
          const status = getStatus(lastActivity);
          const label = thread.title?.trim() ? thread.title : thread.id;
          const threadSpace = thread.spaceId ? spaces.find((s) => s.id === thread.spaceId) : null;
          const SpaceIcon = threadSpace ? getSpaceIcon(threadSpace.icon) : Activity;
          const model = thread.modelId?.split("/").pop() || "not set";
          const channel = inferChannel(thread);
          const isActive = thread.id === activeThreadId;
          const borderLeft = threadSpace ? `3px solid ${threadSpace.color}` : "3px solid transparent";
          const bgTint = threadSpace && !isActive ? `${threadSpace.color}08` : "transparent";
          const scopeLabel = threadSpace ? threadSpace.name.toLowerCase() : "global";

          return (
            <button
              key={thread.id}
              onClick={() => {
                setActiveThread(thread.id);
                navigate("/");
              }}
              className="w-full text-left p-1 rounded-lg transition-colors hover:bg-white/5"
              style={{ background: bgTint || C.surface, border: `1px solid ${C.border}`, borderLeft }}
              data-testid={`session-row-${thread.id}`}
            >
              <div className="flex items-center gap-1.5 mb-0.5">
                <div className="w-5 h-5 rounded-md flex items-center justify-center shrink-0" style={{ background: "rgba(29,140,248,0.14)" }}>
                  <SpaceIcon className="w-2.5 h-2.5" style={{ color: threadSpace?.color || C.accent }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[12px] leading-none font-semibold truncate" style={{ maxWidth: "40vw" }}>{label}</span>
                    <span className="text-[9px] px-1 py-0.5 rounded-md" style={{ background: C.surface2, color: C.muted }}>per-channel-peer</span>
                    <span className="text-[9px] px-1 py-0.5 rounded-md capitalize" style={{ background: threadSpace ? `${threadSpace.color}18` : C.surface2, color: threadSpace?.color || C.muted }}>{scopeLabel}</span>
                  </div>
                  <div className="text-[9px]" style={{ color: C.muted }}>{status}</div>
                </div>
                <div className="flex items-center gap-1.5" style={{ color: C.muted }}>
                  <span className="text-[9px] px-1.5 py-0.5 rounded-md" style={{ background: C.surface2, border: `1px solid ${C.border}` }}>Open</span>
                  <RotateCcw className="w-2.5 h-2.5" />
                  <Archive className="w-2.5 h-2.5" />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-1">
                <div className="p-1.5 rounded-md" style={{ background: C.surface2 }}>
                  <div className="text-[9px] uppercase tracking-wider mb-0.5" style={{ color: C.muted }}>Model</div>
                  <div className="text-[11px] leading-none font-mono" style={{ color: C.text }}>{model}</div>
                </div>
                <div className="p-1.5 rounded-md" style={{ background: C.surface2 }}>
                  <div className="text-[9px] uppercase tracking-wider mb-0.5" style={{ color: C.muted }}>Messages</div>
                  <div className="text-[11px] leading-none font-semibold" style={{ color: C.text }}>{messages.length}</div>
                </div>
                <div className="p-1.5 rounded-md" style={{ background: C.surface2 }}>
                  <div className="text-[9px] uppercase tracking-wider mb-0.5" style={{ color: C.muted }}>Channel</div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: C.green }} />
                    <span className="text-[11px] leading-none" style={{ color: C.text }}>{channel}</span>
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
