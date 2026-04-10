import React, { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Check, Copy } from "lucide-react";
import { C } from "@/lib/constants";

export function BinaryRain() {
  const ref = useRef(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let raf;
    const resize = () => { canvas.width = canvas.offsetWidth; canvas.height = canvas.offsetHeight; };
    resize();
    const cols = Math.floor(canvas.width / 16);
    const drops = Array.from({ length: cols }, () => Math.random() * -60);
    const draw = () => {
      ctx.fillStyle = "rgba(10,10,10,0.07)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.font = "13px monospace";
      for (let i = 0; i < drops.length; i++) {
        const c = Math.random() > 0.5 ? "1" : "0";
        ctx.fillStyle = `rgba(29,140,248,${Math.random() * 0.35 + 0.04})`;
        ctx.fillText(c, i * 16, drops[i] * 16);
        if (drops[i] * 16 > canvas.height && Math.random() > 0.975) drops[i] = 0;
        drops[i] += 0.35;
      }
      raf = requestAnimationFrame(draw);
    };
    draw();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, []);
  return <canvas ref={ref} className="absolute inset-0 w-full h-full pointer-events-none" style={{ opacity: 0.15 }} />;
}

export function Toggle({ on, onToggle }) {
  return (
    <button type="button" onClick={onToggle} className="w-8 h-[18px] rounded-full relative transition-colors shrink-0" style={{ background: on ? C.accent : "#333" }}>
      <div className="absolute top-[2px] w-[14px] h-[14px] rounded-full transition-all" style={{ background: "#fff", left: on ? 14 : 2 }} />
    </button>
  );
}

export function Markdown({ content }) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={{
      p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
      ul: ({ children }) => <ul className="list-disc ml-4 mb-2 space-y-0.5">{children}</ul>,
      ol: ({ children }) => <ol className="list-decimal ml-4 mb-2 space-y-0.5">{children}</ol>,
      li: ({ children }) => <li className="text-sm">{children}</li>,
      strong: ({ children }) => <strong className="font-semibold" style={{ color: C.text }}>{children}</strong>,
      code: ({ children, className }) => className
        ? <code className="block text-[11px] rounded p-2 my-1.5 overflow-auto font-mono whitespace-pre-wrap" style={{ background: C.surface2, border: `1px solid ${C.border}` }}>{children}</code>
        : <code className="text-[11px] rounded px-1 py-0.5 font-mono" style={{ background: C.surface2, border: `1px solid ${C.border}` }}>{children}</code>,
      pre: ({ children }) => <>{children}</>,
      a: ({ href, children }) => <a href={href} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:opacity-80" style={{ color: C.accent }}>{children}</a>,
    }}>{content}</ReactMarkdown>
  );
}

export function CapabilityIcons({ caps, size = 14, gap = 6 }) {
  const { CAP_DEFS } = require("@/lib/constants");
  return (
    <div className="flex items-center" style={{ gap }}>
      {CAP_DEFS.map(({ key, Icon, label }) => {
        const val = caps?.[key];
        const isOn = val === true || val === "partial";
        return (
          <Icon key={key} title={label} className="shrink-0"
            style={{ width: size, height: size, color: isOn ? "#22c55e" : "#333", strokeWidth: isOn ? 2.2 : 1.5 }} />
        );
      })}
    </div>
  );
}

export function CostBadge({ tier }) {
  if (!tier) return null;
  const colors = {
    Free: { bg: "#064e3b", color: "#34d399", border: "#065f46" },
    "$": { bg: "#1e3a5f", color: "#60a5fa", border: "#1e40af" },
    "$$": { bg: "#4a3728", color: "#fbbf24", border: "#78350f" },
    "$$$": { bg: "#4a2c2a", color: "#f87171", border: "#7f1d1d" },
  };
  const style = colors[tier] || colors["$"];
  return <span className="text-[9px] px-1.5 py-0.5 rounded font-medium" style={{ background: style.bg, color: style.color, border: `1px solid ${style.border}` }}>{tier}</span>;
}

export function MessageRow({ msg }) {
  const [copied, setCopied] = useState(false);
  const fmtTime = (ts) => new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const handleCopy = () => { navigator.clipboard.writeText(msg.content); setCopied(true); setTimeout(() => setCopied(false), 1500); };
  if (msg.role === "user") {
    return (
      <div className="flex justify-end py-2 px-4 group">
        <div className="max-w-[75%]">
          <div className="rounded-2xl rounded-tr-sm px-4 py-2.5 text-sm whitespace-pre-wrap break-words" style={{ background: "rgba(29,140,248,0.15)", border: "1px solid rgba(29,140,248,0.2)", color: C.text }}>{msg.content}</div>
          <div className="flex items-center justify-end gap-2 mt-1">
            <button onClick={handleCopy} className="opacity-0 group-hover:opacity-60 transition-opacity" data-testid={`copy-msg-${msg.id}`}>
              {copied ? <Check className="w-3 h-3" style={{ color: C.green }} /> : <Copy className="w-3 h-3" style={{ color: "#555" }} />}
            </button>
            <span className="text-[10px]" style={{ color: "#555" }}>{fmtTime(msg.timestamp)}</span>
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="flex gap-3 py-2 px-4 group">
      <div className="w-7 h-7 rounded-full flex items-center justify-center text-sm shrink-0 mt-0.5" style={{ background: "rgba(29,140,248,0.1)", border: "1px solid rgba(29,140,248,0.2)" }}>&#129438;</div>
      <div className="flex-1 min-w-0">
        <div className="rounded-2xl rounded-tl-sm px-4 py-2.5 text-sm" style={{ background: C.surface, border: `1px solid ${C.border}` }}><Markdown content={msg.content} /></div>
        <div className="flex items-center gap-2 mt-1">
          <button onClick={handleCopy} className="opacity-0 group-hover:opacity-60 transition-opacity" data-testid={`copy-msg-${msg.id}`}>
            {copied ? <Check className="w-3 h-3" style={{ color: C.green }} /> : <Copy className="w-3 h-3" style={{ color: "#555" }} />}
          </button>
          <span className="text-[10px]" style={{ color: "#555" }}>{fmtTime(msg.timestamp)}</span>
        </div>
      </div>
    </div>
  );
}
