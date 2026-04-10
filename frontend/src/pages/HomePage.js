import React, { useState, useEffect, useRef, useCallback } from "react";
import { useLocation } from "react-router-dom";
import { Trash2, Terminal, Square } from "lucide-react";
import { C } from "@/lib/constants";
import { useGateway, initGateway, sendMessage } from "@/lib/useGateway";
import { BinaryRain, Markdown, MessageRow } from "@/components/shared";
import { InputBar } from "@/components/InputBar";

export default function HomePage() {
  const { messages, streamingMessage, status, clearMessages } = useGateway();
  const [fillPrompt, setFillPrompt] = useState(null);
  const bottomRef = useRef(null);
  const location = useLocation();
  const hasMessages = messages.length > 0 || !!streamingMessage;

  useEffect(() => { initGateway(); }, []);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages.length, streamingMessage?.content]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const prompt = params.get("prompt");
    if (prompt) {
      setFillPrompt(decodeURIComponent(prompt));
      window.history.replaceState({}, "", "/");
    }
  }, [location]);

  const doSend = useCallback(async (text) => { if (!text.trim()) return; await sendMessage(text); }, []);

  if (!hasMessages) {
    return (
      <div className="relative h-full flex flex-col" style={{ background: C.bg }}>
        <div className="absolute inset-0 overflow-hidden pointer-events-none"><BinaryRain /></div>
        <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-6">
          <div className="w-full" style={{ maxWidth: 680 }}>
            <div className="text-center mb-10"><h1 className="text-4xl font-bold mb-1 tracking-tight" style={{ color: C.text }}>OpenClaw <span>&#129438;</span></h1><p className="text-sm tracking-widest uppercase" style={{ color: C.muted }}>Mission Control</p></div>
            <div className="w-full mb-5"><InputBar onSend={doSend} disabled={status !== "connected"} fillPrompt={fillPrompt} onFillConsumed={() => setFillPrompt(null)} /></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-full flex flex-col" style={{ background: C.bg }}>
      <div className="absolute inset-0 overflow-hidden pointer-events-none"><BinaryRain /></div>
      <div className="relative z-10 flex items-center justify-between px-4 py-2 shrink-0" style={{ borderBottom: `1px solid ${C.surface2}`, background: "rgba(10,10,10,0.85)" }}>
        <button onClick={clearMessages} className="flex items-center gap-1.5 text-[11px] transition-colors" style={{ color: "#666" }}><Trash2 className="w-3 h-3" /> Clear chat</button>
        <button className="flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-full transition-colors" style={{ border: `1px solid ${C.border}`, color: "#666" }}><Terminal className="w-3 h-3" />Events</button>
      </div>
      <div className="relative z-10 flex-1 overflow-y-auto py-4">
        {messages.map(msg => <MessageRow key={msg.id} msg={msg} />)}
        {streamingMessage && (
          <div className="flex gap-3 py-2 px-4">
            <div className="w-7 h-7 rounded-full flex items-center justify-center text-sm shrink-0 mt-0.5" style={{ background: "rgba(29,140,248,0.1)", border: "1px solid rgba(29,140,248,0.2)" }}>&#129438;</div>
            <div className="flex-1 min-w-0">
              <div className="rounded-2xl rounded-tl-sm px-4 py-2.5 text-sm relative" style={{ background: C.surface, border: "1px solid rgba(29,140,248,0.2)" }}>
                {streamingMessage.content ? <Markdown content={streamingMessage.content} /> : <div className="flex gap-1 items-center py-0.5">{[0, 150, 300].map(d => <span key={d} className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: C.accent, opacity: 0.6, animationDelay: `${d}ms` }} />)}</div>}
                <span className="absolute bottom-2 right-3 w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: C.accent }} />
              </div>
              <div className="text-[10px] mt-1" style={{ color: C.accent, opacity: 0.6 }}>typing...</div>
            </div>
          </div>
        )}
        {streamingMessage && (
          <div className="flex justify-center py-2">
            <button onClick={() => useGateway.getState().stopGenerating()} className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full transition-colors hover:bg-white/5"
              style={{ background: C.surface, border: `1px solid ${C.border}`, color: C.muted }}
              data-testid="stop-generating-btn">
              <Square className="w-3 h-3" /> Stop generating
            </button>
          </div>
        )}
        <div ref={bottomRef} />
      </div>
      <div className="relative z-10 px-4 pb-4 pt-2 shrink-0"><InputBar onSend={doSend} disabled={status !== "connected"} placeholder="Message Claw..." /></div>
    </div>
  );
}
