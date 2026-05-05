import React, { useState, useEffect, useRef, useCallback } from "react";
import { useLocation } from "react-router-dom";
import { Trash2, Terminal } from "lucide-react";
import { getSpaceIcon, getRuntimeTheme, getRuntimeMeta } from "@/lib/constants";
import { useGateway, initGateway, sendMessage } from "@/lib/useGateway";
import { RuntimeBackdrop, Markdown, MessageRow } from "@/components/shared";
import { InputBar } from "@/components/InputBar";

export default function HomePage() {
  const { messages, streamingMessage, status, clearMessages, activeThreadId, threads, spaces, activeRuntime, getRuntimeForActiveThread } = useGateway();
  const [fillPrompt, setFillPrompt] = useState(null);
  const bottomRef = useRef(null);
  const location = useLocation();
  const resolvedRuntime = activeThreadId ? getRuntimeForActiveThread() : activeRuntime;
  const runtimeTheme = getRuntimeTheme(resolvedRuntime);
  const runtimeMeta = getRuntimeMeta(resolvedRuntime);

  // Only show streaming for the active thread
  const activeStreaming = streamingMessage?.threadId === activeThreadId ? streamingMessage : null;
  const hasMessages = messages.length > 0 || !!activeStreaming;
  // Do not lock the chat box during streaming — the user should be able to queue the next prompt.
  // The send button morphs into a Stop button while streaming (see InputBar). Only disable during
  // initial connect; error/disconnected remain retryable because sendMessage reconnects on demand.
  const inputDisabled = status === "connecting";
  const inputPlaceholder = status === "connecting"
    ? "Connecting to gateway..."
    : activeStreaming
      ? "Type next message…  (current response is streaming)"
      : runtimeMeta.placeholder;

  useEffect(() => { initGateway(); }, []);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages.length, activeStreaming?.content]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const prompt = params.get("prompt");
    if (prompt) {
      setFillPrompt(decodeURIComponent(prompt));
      window.history.replaceState({}, "", "/");
    }
  }, [location]);

  const doSend = useCallback(async (text) => { if (!text.trim()) return; await sendMessage(text); }, []);

  // Resolve active thread's space
  const activeThread = activeThreadId ? threads.find(t => t.id === activeThreadId) : null;
  const threadSpace = activeThread?.spaceId ? spaces.find(s => s.id === activeThread.spaceId) : null;
  const SpaceIcon = threadSpace ? getSpaceIcon(threadSpace.icon) : null;

  if (!hasMessages) {
    return (
      <div className="relative h-full flex flex-col" style={{ background: runtimeTheme.bg }}>
        <RuntimeBackdrop runtime={resolvedRuntime} />
        <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-6">
          <div className="w-full" style={{ maxWidth: 680 }}>
            <div className="text-center mb-10">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full mb-5 text-[11px] uppercase tracking-[0.28em]"
                style={{ background: `${runtimeTheme.surface2}`, border: `1px solid ${runtimeTheme.border}`, color: runtimeTheme.muted }}>
                <span className="w-2 h-2 rounded-full" style={{ background: runtimeTheme.accent, boxShadow: `0 0 18px ${runtimeTheme.accent}` }} />
                Mission control mode
              </div>
              <h1 className="text-4xl md:text-5xl font-semibold mb-3 tracking-tight" style={{ color: runtimeTheme.text }}>
                {runtimeMeta.assistantName} <span>🦞</span>
              </h1>
              <p className="text-sm tracking-widest uppercase" style={{ color: runtimeTheme.muted }}>{runtimeMeta.title}</p>
            </div>
            <div className="w-full mb-5"><InputBar onSend={doSend} disabled={inputDisabled} fillPrompt={fillPrompt} onFillConsumed={() => setFillPrompt(null)} placeholder={inputPlaceholder} runtimeTheme={runtimeTheme} /></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-full flex flex-col" style={{ background: runtimeTheme.bg }}>
      <RuntimeBackdrop runtime={resolvedRuntime} />
      <div className="relative z-10 flex items-center justify-between px-4 py-3 shrink-0 backdrop-blur-xl" style={{ borderBottom: `1px solid ${runtimeTheme.border}`, background: "rgba(10,10,10,0.85)" }}>
        <button onClick={clearMessages} className="flex items-center gap-1.5 text-[11px] transition-colors" style={{ color: runtimeTheme.muted }}><Trash2 className="w-3 h-3" /> Clear chat</button>
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-full transition-colors" style={{ border: `1px solid ${runtimeTheme.border}`, color: runtimeTheme.muted, background: runtimeTheme.surface2 }}><Terminal className="w-3 h-3" />Events</button>
        </div>
      </div>
      <div className="relative z-10 flex-1 overflow-y-auto py-4">
        {threadSpace && SpaceIcon && (
          <div className="flex items-center gap-2 mx-4 mb-3 px-3 py-2 rounded-lg backdrop-blur-md" style={{ background: `${threadSpace.color}10`, border: `1px solid ${threadSpace.color}25` }} data-testid="chat-space-banner">
            <SpaceIcon className="w-4 h-4" style={{ color: threadSpace.color }} />
            <span className="text-[12px] font-medium" style={{ color: threadSpace.color }}>{threadSpace.name}</span>
            <span className="text-[10px]" style={{ color: `${threadSpace.color}88` }}>space</span>
          </div>
        )}
        {messages.map(msg => <MessageRow key={msg.id} msg={msg} runtime={resolvedRuntime} />)}
        {activeStreaming && (
          <div className="flex gap-3 py-2 px-4">
            <div className="w-7 h-7 rounded-full flex items-center justify-center text-sm shrink-0 mt-0.5" style={{ background: `${runtimeTheme.accent}22`, border: `1px solid ${runtimeTheme.border}` }}>&#129438;</div>
            <div className="flex-1 min-w-0">
              <div className="rounded-2xl rounded-tl-sm px-4 py-2.5 text-sm relative backdrop-blur-xl" style={{ background: runtimeTheme.surface, border: `1px solid ${runtimeTheme.border}` }}>
                {activeStreaming.content ? <Markdown content={activeStreaming.content} theme={runtimeTheme} /> : <div className="flex gap-1 items-center py-0.5">{[0, 150, 300].map(d => <span key={d} className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: runtimeTheme.accent, opacity: 0.7, animationDelay: `${d}ms` }} />)}</div>}
                <span className="absolute bottom-2 right-3 w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: runtimeTheme.accent }} />
              </div>
              <div className="text-[10px] mt-1" style={{ color: runtimeTheme.accent, opacity: 0.7 }}>typing...</div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>
      <div className="relative z-10 px-4 pb-4 pt-2 shrink-0"><InputBar onSend={doSend} disabled={inputDisabled} placeholder={inputPlaceholder} runtimeTheme={runtimeTheme} /></div>
    </div>
  );
}
