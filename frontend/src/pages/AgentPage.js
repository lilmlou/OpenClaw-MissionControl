import React, { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { Sparkles, Image, Paintbrush, Code2, Globe, AlertCircle, ChevronRight } from "lucide-react";
import { C } from "@/lib/constants";
import { useGateway, switchModel } from "@/lib/useGateway";
import { ModelSelector } from "@/components/ModelSelector";

export default function AgentPage() {
  const { models, providers, activeModel, connectors } = useGateway();
  const [agentInput, setAgentInput] = useState("");
  const [capabilities, setCapabilities] = useState({ imageGen: false, design: false, codeExec: true, webBrowse: false });
  const [agentMessages, setAgentMessages] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [agentMessages, isProcessing]);

  const toggleCap = (key) => setCapabilities(prev => ({ ...prev, [key]: !prev[key] }));

  const handleSend = () => {
    if (!agentInput.trim()) return;
    const activeCaps = Object.entries(capabilities).filter(([, v]) => v).map(([k]) => k);
    setAgentMessages(prev => [...prev, { id: crypto.randomUUID(), role: "user", content: agentInput.trim(), caps: activeCaps }]);
    setAgentInput("");
    setIsProcessing(true);
    setTimeout(() => {
      setAgentMessages(prev => [...prev, { id: crypto.randomUUID(), role: "agent", content: `Working with ${activeCaps.length} active capabilities. Processing your request...`, caps: activeCaps }]);
      setIsProcessing(false);
    }, 2000);
  };

  const capButtons = [
    { key: "imageGen", label: "Image Generation", icon: Image, desc: "Generate images and visuals" },
    { key: "design", label: "Design Creation", icon: Paintbrush, desc: "Create UI/UX designs and layouts" },
    { key: "codeExec", label: "Code Execution", icon: Code2, desc: "Run and test code in sandbox" },
    { key: "webBrowse", label: "Web Browsing", icon: Globe, desc: "Browse and research the web" },
  ];

  const connectedCount = Object.values(connectors).filter(Boolean).length;

  return (
    <div className="h-full flex flex-col" style={{ color: C.text }}>
      {agentMessages.length === 0 ? (
        <div className="flex-1 flex items-center justify-center px-6">
          <div className="w-full max-w-lg">
            <div className="text-center mb-8">
              <div className="w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center" style={{ background: "linear-gradient(135deg, #ec4899, #8b5cf6)", border: "2px solid #333" }}>
                <Sparkles className="w-7 h-7 text-white" />
              </div>
              <h1 className="text-2xl font-bold mb-1">Agent Mode</h1>
              <p className="text-sm" style={{ color: C.muted }}>Creative builder workspace with tool access</p>
            </div>
            <div className="grid grid-cols-2 gap-3 mb-6">
              {capButtons.map(cap => {
                const Icon = cap.icon;
                const on = capabilities[cap.key];
                return (
                  <button key={cap.key} onClick={() => toggleCap(cap.key)}
                    className="p-3 rounded-xl text-left transition-all"
                    style={{ background: on ? `${cap.key === "imageGen" ? "#ec4899" : cap.key === "design" ? "#8b5cf6" : cap.key === "codeExec" ? "#22c55e" : "#3b82f6"}12` : C.surface,
                      border: `1px solid ${on ? (cap.key === "imageGen" ? "#ec4899" : cap.key === "design" ? "#8b5cf6" : cap.key === "codeExec" ? "#22c55e" : "#3b82f6") + "40" : C.border}` }}
                    data-testid={`agent-cap-${cap.key}`}>
                    <div className="flex items-center gap-2 mb-1">
                      <Icon className="w-4 h-4" style={{ color: on ? (cap.key === "imageGen" ? "#ec4899" : cap.key === "design" ? "#8b5cf6" : cap.key === "codeExec" ? "#22c55e" : "#3b82f6") : C.muted }} />
                      <span className="text-sm font-medium" style={{ color: on ? C.text : C.muted }}>{cap.label}</span>
                    </div>
                    <div className="text-[11px]" style={{ color: "#555" }}>{cap.desc}</div>
                  </button>
                );
              })}
            </div>
            {connectedCount === 0 && (
              <Link to="/settings?tab=apps" className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm mb-4" style={{ background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.2)", color: C.yellow }}>
                <AlertCircle className="w-4 h-4" /> Connect apps in Settings for full agent capabilities <ChevronRight className="w-3.5 h-3.5 ml-auto" />
              </Link>
            )}
            <div className="rounded-2xl" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
              <textarea value={agentInput} onChange={e => setAgentInput(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                placeholder="Describe what you want to build or create..." rows={2}
                className="w-full focus:outline-none resize-none text-sm" style={{ background: "transparent", border: "none", color: C.text, padding: "14px 16px 8px" }}
                data-testid="agent-input" />
              <div className="flex items-center justify-between px-3 pb-3">
                <div className="flex items-center gap-1.5">
                  {Object.entries(capabilities).filter(([, v]) => v).map(([k]) => {
                    const cap = capButtons.find(c => c.key === k);
                    if (!cap) return null;
                    const Icon = cap.icon;
                    return <span key={k} className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: C.surface2, color: C.muted }}><Icon className="w-3 h-3" />{cap.label.split(" ")[0]}</span>;
                  })}
                </div>
                <div className="flex items-center gap-2">
                  <ModelSelector models={models} providers={providers} activeModel={activeModel} onSelect={switchModel} />
                  <button onClick={handleSend} disabled={!agentInput.trim()} className="h-8 px-4 rounded-lg text-sm font-medium" style={{ background: agentInput.trim() ? C.accent : C.surface2, color: agentInput.trim() ? "#fff" : "#555" }}
                    data-testid="agent-send-btn">Build</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <>
          <div className="flex-1 overflow-auto px-4 py-6">
            <div className="max-w-2xl mx-auto space-y-4">
              {agentMessages.map(msg => (
                <div key={msg.id} className="flex gap-3">
                  <div className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] shrink-0 mt-0.5"
                    style={{ background: msg.role === "user" ? C.surface2 : "linear-gradient(135deg, #ec4899, #8b5cf6)", border: `1px solid ${msg.role === "user" ? C.border : "#8b5cf640"}` }}>
                    {msg.role === "user" ? "M" : <Sparkles className="w-3.5 h-3.5 text-white" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm leading-relaxed" style={{ color: C.text }}>{msg.content}</div>
                    {msg.caps?.length > 0 && <div className="flex gap-1 mt-1">{msg.caps.map(c => <span key={c} className="text-[9px] px-1.5 py-0.5 rounded" style={{ background: C.surface2, color: C.muted }}>{c}</span>)}</div>}
                  </div>
                </div>
              ))}
              {isProcessing && (
                <div className="flex gap-3"><div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5" style={{ background: "linear-gradient(135deg, #ec4899, #8b5cf6)" }}><Sparkles className="w-3.5 h-3.5 text-white" /></div>
                  <div className="flex items-center gap-2 text-sm"><span className="w-2 h-2 rounded-full animate-pulse" style={{ background: "#8b5cf6" }} /><span style={{ color: C.muted }}>Building...</span></div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>
          </div>
          <div className="px-4 pb-4 pt-2 shrink-0">
            <div className="max-w-2xl mx-auto">
              <div className="rounded-2xl" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
                <textarea value={agentInput} onChange={e => setAgentInput(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                  placeholder="Continue building..." rows={1} className="w-full focus:outline-none resize-none text-sm" style={{ background: "transparent", border: "none", color: C.text, padding: "12px 16px 8px" }} />
                <div className="flex items-center justify-end gap-2 px-3 pb-3">
                  <ModelSelector models={models} providers={providers} activeModel={activeModel} onSelect={switchModel} />
                  <button onClick={handleSend} disabled={!agentInput.trim()} className="h-7 px-3 rounded-lg text-xs font-medium" style={{ background: agentInput.trim() ? C.accent : C.surface2, color: agentInput.trim() ? "#fff" : "#555" }}>Send</button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
