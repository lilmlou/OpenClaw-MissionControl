import React, { useState, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { Trash2, Terminal, Lock, Unlock, Monitor, Cloud, ArrowRight, Mic, Copy, Check, ChevronDown, ChevronRight, X } from "lucide-react";
import { C } from "@/lib/constants";
import { useGateway, executeCommand, switchModel } from "@/lib/useGateway";
import { ModelSelector } from "@/components/ModelSelector";
import { Button } from "@/components/ui/button";

export default function CodePage() {
  const { terminalOutput, clearTerminal, models, providers, activeModel } = useGateway();
  const [cmd, setCmd] = useState("");
  const [bypassPermissions, setBypassPermissions] = useState(false);
  const [isLocal, setIsLocal] = useState(true);
  const [showAliasSetup, setShowAliasSetup] = useState(false);
  const [copied, setCopied] = useState(null);
  const terminalRef = useRef(null);
  const inputRef = useRef(null);
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => { terminalRef.current?.scrollTo(0, terminalRef.current.scrollHeight); }, [terminalOutput]);

  // Handle URL param commands (terminal alias bridge)
  useEffect(() => {
    const urlCmd = searchParams.get("cmd");
    if (urlCmd) {
      executeCommand(decodeURIComponent(urlCmd));
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  // Auto-focus input
  useEffect(() => { inputRef.current?.focus(); }, []);

  const handleCommand = async () => {
    if (!cmd.trim()) return;
    await executeCommand(cmd);
    setCmd("");
  };

  const handleCopy = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const aliasSnippet = `alias claw='open "${window.location.origin}/code?cmd="'`;
  const curlSnippet = `curl -s "${window.location.origin}/code?cmd=\$(echo \$@ | jq -sRr @uri)"`;
  const bashFnSnippet = `claw() {\n  open "${window.location.origin}/code?cmd=$(printf '%s' "$*" | jq -sRr @uri)"\n}`;

  return (
    <div className="h-full flex flex-col" style={{ color: C.text }}>
      <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: `1px solid ${C.border}`, background: "#0d0d0d" }}>
        <div className="flex items-center gap-3">
          <div className="text-lg font-semibold">Terminal</div>
          <span className="text-xs px-2 py-0.5 rounded" style={{ background: C.surface2, color: C.muted }}>OpenClaw Sandbox</span>
          {isLocal ? (
            <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: "rgba(34,197,94,0.1)", color: C.green }}>Local</span>
          ) : (
            <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: "rgba(29,140,248,0.1)", color: C.accent }}>Remote</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => setShowAliasSetup(!showAliasSetup)}
            style={{ color: showAliasSetup ? C.accent : C.muted }} data-testid="alias-setup-btn">
            <Terminal className="w-4 h-4 mr-1" /> Alias
          </Button>
          <Button variant="ghost" size="sm" onClick={clearTerminal} style={{ color: C.muted }}>
            <Trash2 className="w-4 h-4 mr-1" /> Clear
          </Button>
        </div>
      </div>

      {showAliasSetup && (
        <div className="px-4 py-3 space-y-3" style={{ background: "#0c0c0c", borderBottom: `1px solid ${C.border}` }}>
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold" style={{ color: C.text }}>Terminal Alias Bridge</h3>
            <button onClick={() => setShowAliasSetup(false)} className="p-1 rounded hover:bg-white/5"><X className="w-3.5 h-3.5" style={{ color: C.muted }} /></button>
          </div>
          <p className="text-xs" style={{ color: C.muted }}>Run OpenClaw commands from any terminal. Add one of these to your shell config:</p>

          {[
            { id: "alias", label: "Quick alias (opens browser)", code: aliasSnippet },
            { id: "bash", label: "Bash function", code: bashFnSnippet },
          ].map(item => (
            <div key={item.id} className="rounded-lg overflow-hidden" style={{ border: `1px solid ${C.border}` }}>
              <div className="flex items-center justify-between px-3 py-1.5" style={{ background: C.surface2 }}>
                <span className="text-[11px] font-medium" style={{ color: C.muted }}>{item.label}</span>
                <button onClick={() => handleCopy(item.code, item.id)} className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded hover:bg-white/5 transition-colors"
                  style={{ color: copied === item.id ? C.green : C.muted }} data-testid={`copy-${item.id}`}>
                  {copied === item.id ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  {copied === item.id ? "Copied" : "Copy"}
                </button>
              </div>
              <pre className="px-3 py-2 text-xs font-mono overflow-x-auto" style={{ background: "#000", color: C.green }}>{item.code}</pre>
            </div>
          ))}

          <p className="text-[11px]" style={{ color: "#444" }}>
            Then use: <code className="px-1 rounded" style={{ background: C.surface2, color: C.muted }}>claw ls -la</code> from any terminal window.
            Commands are dispatched to this OpenClaw sandbox via URL.
          </p>
        </div>
      )}

      <div ref={terminalRef} className="flex-1 p-6 font-mono text-sm overflow-auto" style={{ background: "#000" }}>
        {terminalOutput.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="text-6xl mb-6">&#129438;</div>
            <h2 className="text-xl font-bold mb-2">OpenClaw Terminal</h2>
            <p className="text-sm mb-4" style={{ color: C.muted }}>Execute commands in the sandboxed environment</p>
            <p className="text-xs mb-6" style={{ color: "#444" }}>Works on desktop, mobile, and anywhere you can access OpenClaw</p>
            <button onClick={() => setShowAliasSetup(true)} className="text-xs px-3 py-1.5 rounded-lg transition-colors hover:bg-white/5"
              style={{ border: `1px solid ${C.border}`, color: C.muted }} data-testid="setup-alias-cta">
              <Terminal className="w-3.5 h-3.5 inline mr-1.5" />Set up terminal alias
            </button>
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
            <input ref={inputRef} type="text" value={cmd} onChange={e => setCmd(e.target.value)} onKeyDown={e => e.key === "Enter" && handleCommand()}
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
