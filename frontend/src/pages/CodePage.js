import React, { useState, useEffect, useRef } from "react";
import { Trash2, Terminal, Lock, Unlock, Monitor, Cloud, ArrowRight, Mic } from "lucide-react";
import { C } from "@/lib/constants";
import { useGateway, executeCommand, switchModel } from "@/lib/useGateway";
import { ModelSelector } from "@/components/ModelSelector";
import { Button } from "@/components/ui/button";

export default function CodePage() {
  const { terminalOutput, clearTerminal, models, providers, activeModel } = useGateway();
  const [cmd, setCmd] = useState("");
  const [bypassPermissions, setBypassPermissions] = useState(false);
  const [isLocal, setIsLocal] = useState(true);
  const terminalRef = useRef(null);

  useEffect(() => { terminalRef.current?.scrollTo(0, terminalRef.current.scrollHeight); }, [terminalOutput]);

  const handleCommand = async () => {
    if (!cmd.trim()) return;
    await executeCommand(cmd);
    setCmd("");
  };

  return (
    <div className="h-full flex flex-col" style={{ color: C.text }}>
      <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: `1px solid ${C.border}`, background: "#0d0d0d" }}>
        <div className="flex items-center gap-3">
          <div className="text-lg font-semibold">Terminal</div>
          <span className="text-xs px-2 py-0.5 rounded" style={{ background: C.surface2, color: C.muted }}>OpenClaw Sandbox</span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={clearTerminal} style={{ color: C.muted }}>
            <Trash2 className="w-4 h-4 mr-1" /> Clear
          </Button>
        </div>
      </div>

      <div ref={terminalRef} className="flex-1 p-6 font-mono text-sm overflow-auto" style={{ background: "#000" }}>
        {terminalOutput.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="text-6xl mb-6">&#129438;</div>
            <h2 className="text-xl font-bold mb-2">OpenClaw Terminal</h2>
            <p className="text-sm mb-4" style={{ color: C.muted }}>Execute commands in the sandboxed environment</p>
            <p className="text-xs" style={{ color: "#444" }}>Works on desktop, mobile, and anywhere you can access OpenClaw</p>
          </div>
        ) : (
          terminalOutput.map(line => (
            <div key={line.id} className="whitespace-pre-wrap" style={{ color: line.content.startsWith("$") ? C.green : C.text }}>{line.content}</div>
          ))
        )}
      </div>

      <div className="p-3 md:p-4" style={{ borderTop: `1px solid ${C.border}`, background: "#0a0a0a" }}>
        <div className="max-w-3xl mx-auto space-y-2 md:space-y-3">
          <div className="flex items-center gap-2 p-2 md:p-3 rounded-xl" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
            <span style={{ color: C.green }}>$</span>
            <input type="text" value={cmd} onChange={e => setCmd(e.target.value)} onKeyDown={e => e.key === "Enter" && handleCommand()}
              placeholder="Enter command or describe what you want to do..."
              className="flex-1 bg-transparent border-none outline-none text-sm" style={{ color: C.text }} data-testid="terminal-input" />
            <Button size="sm" onClick={handleCommand} disabled={!cmd.trim()} style={{ background: cmd.trim() ? C.accent : C.surface2 }}>
              <ArrowRight className="w-4 h-4" />
            </Button>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <button onClick={() => setBypassPermissions(!bypassPermissions)}
                className="flex items-center gap-1.5 text-xs px-2 md:px-3 py-1.5 rounded-lg transition-colors"
                style={{ background: bypassPermissions ? "rgba(239,68,68,0.1)" : C.surface2, color: bypassPermissions ? C.red : C.muted, border: `1px solid ${bypassPermissions ? "rgba(239,68,68,0.3)" : C.border}` }}
                data-testid="bypass-permissions-toggle">
                {bypassPermissions ? <Unlock className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                <span className="hidden sm:inline">{bypassPermissions ? "Permissions bypassed" : "Bypass permissions"}</span>
              </button>
            </div>
            <div className="flex items-center gap-2">
              <ModelSelector models={models} providers={providers} activeModel={activeModel} onSelect={switchModel} />
              <Mic className="w-4 h-4 cursor-pointer shrink-0" style={{ color: C.muted }} />
              <button onClick={() => setIsLocal(!isLocal)}
                className="flex items-center gap-1.5 text-xs px-2 md:px-3 py-1.5 rounded-lg"
                style={{ background: C.surface2, color: C.muted, border: `1px solid ${C.border}` }}
                data-testid="local-remote-toggle">
                {isLocal ? <Monitor className="w-3.5 h-3.5" /> : <Cloud className="w-3.5 h-3.5" />}
                {isLocal ? "Local" : "Remote"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
