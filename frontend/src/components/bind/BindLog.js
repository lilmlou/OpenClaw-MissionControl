/**
 * Phase 0.3 — <BindLog>
 *
 *   <BindLog file="logs/server.log" tail={100} />
 *
 * Read-only live tail of a log file. Tries GET /api/v2/logs/tail?file=…&n=…
 * on mount; if the endpoint doesn't exist (404), renders a placeholder
 * EmptyState. When wired, polls every 3s and autoscrolls to bottom.
 *
 * Note: a streaming log endpoint is out of scope for Phase 0.3 — the spec
 * only requires that the binding renders today and surfaces the right
 * placeholder when its backend isn't yet available.
 */
import React, { useCallback, useEffect, useRef, useState } from "react";
import { FileText } from "lucide-react";
import { C } from "@/lib/constants";
import { EmptyState, Skeleton } from "@/components/kit";
import { apiUrl } from "@/lib/useGateway";

export function BindLog({
  file,
  tail = 100,
  pollMs = 3000,
  height = 320,
  dataTestid,
  className,
}) {
  const [text, setText] = useState("");
  const [available, setAvailable] = useState(null); // null=checking, true/false
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const preRef = useRef(null);
  const mountedRef = useRef(true);

  const fetchTail = useCallback(async () => {
    try {
      const url = apiUrl(`/api/v2/logs/tail?file=${encodeURIComponent(file)}&n=${tail}`);
      const res = await fetch(url);
      if (res.status === 404) {
        if (mountedRef.current) {
          setAvailable(false);
          setLoading(false);
        }
        return;
      }
      if (!res.ok) {
        throw new Error(`Log tail failed: ${res.status}`);
      }
      const ct = res.headers.get("content-type") || "";
      let body;
      if (ct.includes("application/json")) {
        const data = await res.json();
        body = data?.lines
          ? (Array.isArray(data.lines) ? data.lines.join("\n") : String(data.lines))
          : (data?.text || JSON.stringify(data, null, 2));
      } else {
        body = await res.text();
      }
      if (mountedRef.current) {
        setText(body || "");
        setAvailable(true);
        setError(null);
        setLoading(false);
      }
    } catch (e) {
      if (mountedRef.current) {
        setError(e.message);
        setLoading(false);
      }
    }
  }, [file, tail]);

  useEffect(() => {
    mountedRef.current = true;
    fetchTail();
    const id = setInterval(() => {
      if (available !== false) fetchTail();
    }, pollMs);
    return () => {
      mountedRef.current = false;
      clearInterval(id);
    };
  }, [fetchTail, pollMs, available]);

  // Autoscroll to bottom on update
  useEffect(() => {
    if (preRef.current) {
      preRef.current.scrollTop = preRef.current.scrollHeight;
    }
  }, [text]);

  const testid = dataTestid || `bind-log-${file}`;

  if (available === false) {
    return (
      <div
        data-testid={testid}
        className={className}
        style={{
          background: C.surface,
          border: `1px solid ${C.border}`,
          borderRadius: "var(--mc-radius-md)",
        }}
      >
        <EmptyState
          icon={<FileText size={32} strokeWidth={1.5} />}
          title="Log tailing not yet wired"
          description={`No /api/v2/logs/tail endpoint available for "${file}". This binding will render live once the backend ships it.`}
        />
      </div>
    );
  }

  return (
    <div
      data-testid={testid}
      className={className}
      style={{
        background: C.surface,
        border: `1px solid ${C.border}`,
        borderRadius: "var(--mc-radius-md)",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        className="flex items-center gap-2 px-3 py-2"
        style={{ borderBottom: `1px solid ${C.border}` }}
      >
        <FileText size={12} style={{ color: C.accent }} />
        <span className="text-[12px] font-semibold" style={{ color: C.text }}>
          {file}
        </span>
        <span className="text-[10px] ml-auto" style={{ color: C.muted }}>
          tail {tail}
        </span>
      </div>
      {loading && !text ? (
        <div className="p-3">
          <Skeleton height={height - 50} width="100%" />
        </div>
      ) : error ? (
        <div
          className="px-3 py-2 text-[12px]"
          style={{ background: C.errSoft, color: C.red }}
          data-testid={`${testid}-error`}
        >
          {error}
        </div>
      ) : (
        <pre
          ref={preRef}
          className="overflow-auto p-3 m-0"
          style={{
            maxHeight: height,
            background: C.surface,
            color: C.text,
            fontFamily: "var(--mc-font-mono)",
            fontSize: 11,
            lineHeight: 1.5,
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
          }}
          data-testid={`${testid}-content`}
        >
          {text || "(empty)"}
        </pre>
      )}
    </div>
  );
}

export default BindLog;
