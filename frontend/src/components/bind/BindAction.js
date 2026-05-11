/**
 * Phase 0.3 — <BindAction>
 *
 *   <BindAction to="agents.kill_all" label="Kill all agents" confirm />
 *   <BindAction to="cron.run_now" args={{ job_id: "123" }} />
 *
 * Renders a button that POSTs to /api/v2/actions/{to}. Destructive actions
 * (per backend metadata) auto-render as `danger` variant with a confirm
 * dialog. Result is shown inline on success; ErrorState-style on failure.
 *
 * Activity feed entries are emitted server-side via the actions registry.
 */
import React, { useCallback, useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { C } from "@/lib/constants";
import { Button } from "@/components/kit";
import { apiUrl } from "@/lib/useGateway";

async function fetchActionMeta(key) {
  const res = await fetch(apiUrl(`/api/v2/actions/${encodeURIComponent(key)}`));
  if (!res.ok) throw new Error(`Action lookup failed: ${res.status}`);
  const data = await res.json();
  return data?.data || data;
}

async function invokeAction(key, args, actor) {
  const res = await fetch(apiUrl(`/api/v2/actions/${encodeURIComponent(key)}`), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ args: args || {}, actor: actor || "user:meg" }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data?.detail || data?.error || `Action failed: ${res.status}`);
    err.status = res.status;
    err.detail = data;
    throw err;
  }
  return data;
}

export function BindAction({
  to,
  label,
  description,
  variant = "default",
  confirm: confirmProp = false,
  args,
  actor,
  onResult,
  dataTestid,
  size = "md",
  className,
}) {
  const [meta, setMeta] = useState(null);
  const [metaError, setMetaError] = useState(null);
  const [confirming, setConfirming] = useState(false);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    fetchActionMeta(to)
      .then((m) => { if (!cancelled) setMeta(m); })
      .catch((e) => { if (!cancelled) setMetaError(e.message); });
    return () => { cancelled = true; };
  }, [to]);

  const destructive = !!(meta?.destructive) || variant === "danger";
  const requiresConfirm = !!(confirmProp || destructive || meta?.requires_confirm);
  const buttonVariant = destructive ? "danger" : (variant === "primary" ? "primary" : "secondary");
  const displayLabel = label || meta?.title || to;

  const testid = dataTestid || `bind-action-${to}`;

  const doInvoke = useCallback(async () => {
    setRunning(true);
    setError(null);
    setResult(null);
    try {
      const res = await invokeAction(to, args, actor);
      setResult(res);
      onResult?.(res);
    } catch (e) {
      setError(e.message);
    } finally {
      setRunning(false);
      setConfirming(false);
    }
  }, [to, args, actor, onResult]);

  const onClick = useCallback(() => {
    if (requiresConfirm) {
      setConfirming(true);
    } else {
      doInvoke();
    }
  }, [requiresConfirm, doInvoke]);

  return (
    <div data-testid={testid} className={className}>
      <div className="flex items-start gap-3 flex-wrap">
        <Button
          type="button"
          variant={buttonVariant}
          size={size}
          loading={running}
          onClick={onClick}
          leftIcon={destructive ? <AlertTriangle size={14} /> : null}
          data-testid={`${testid}-button`}
          disabled={!!metaError && !meta}
        >
          {displayLabel}
        </Button>
        {description && (
          <p className="text-[11px] flex-1 min-w-0" style={{ color: C.muted }}>
            {description}
          </p>
        )}
      </div>

      {metaError && !meta && (
        <p className="mt-1 text-[11px]" style={{ color: C.red }}>
          Couldn't load action metadata: {metaError}
        </p>
      )}

      {/* Confirm dialog (inline, MC-style) */}
      {confirming && (
        <div
          className="mt-2 p-3 rounded-[var(--mc-radius-md)] space-y-2"
          style={{
            background: destructive ? C.errSoft : C.warnSoft,
            border: `1px solid ${destructive ? C.red : C.yellow}40`,
          }}
          role="alertdialog"
          data-testid={`${testid}-confirm-panel`}
        >
          <div className="flex items-start gap-2">
            <AlertTriangle
              size={14}
              style={{ color: destructive ? C.red : C.yellow }}
              className="shrink-0 mt-0.5"
            />
            <p className="text-[12px] flex-1" style={{ color: C.text }}>
              {destructive
                ? `This is a destructive action. Are you sure you want to run "${displayLabel}"?`
                : `Run "${displayLabel}"?`}
            </p>
          </div>
          <div className="flex items-center gap-2 justify-end">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setConfirming(false)}
              data-testid={`${testid}-cancel`}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant={destructive ? "danger" : "primary"}
              size="sm"
              loading={running}
              onClick={doInvoke}
              data-testid={`${testid}-confirm`}
            >
              {destructive ? "Yes, run it" : "Confirm"}
            </Button>
          </div>
        </div>
      )}

      {/* Inline result */}
      {result && !error && (
        <div
          className="mt-2 p-2.5 rounded-[var(--mc-radius-sm)] flex items-start gap-2 text-[12px]"
          style={{ background: C.okSoft, color: C.green }}
          data-testid={`${testid}-result`}
        >
          <CheckCircle2 size={14} className="shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <span style={{ color: C.text }}>Done.</span>
            {result?.result !== undefined && result?.result !== null && (
              <details className="mt-1">
                <summary
                  className="cursor-pointer text-[11px]"
                  style={{ color: C.muted }}
                  data-testid={`${testid}-result-details-toggle`}
                >
                  Details
                </summary>
                <pre
                  className="mt-1 p-2 rounded text-[11px] overflow-auto"
                  style={{
                    background: C.surface2,
                    color: C.text,
                    maxHeight: 200,
                    fontFamily: "var(--mc-font-mono)",
                  }}
                  data-testid={`${testid}-result-json`}
                >
                  {JSON.stringify(result.result, null, 2)}
                </pre>
              </details>
            )}
          </div>
        </div>
      )}

      {/* Inline error */}
      {error && (
        <div
          className="mt-2 p-2.5 rounded-[var(--mc-radius-sm)] flex items-center gap-2 text-[12px]"
          style={{ background: C.errSoft, color: C.red }}
          data-testid={`${testid}-error`}
        >
          <AlertTriangle size={14} className="shrink-0" />
          <span className="flex-1">{error}</span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={doInvoke}
            data-testid={`${testid}-retry`}
          >
            Retry
          </Button>
        </div>
      )}
    </div>
  );
}

export default BindAction;
