/**
 * Phase 0.3 — <BindSparkline>
 *
 *   <BindSparkline to="metrics.cpu.history" />
 *
 * Subscribes to a config key whose value is either:
 *   - an array of numbers, e.g. [12, 15, 22, 18, …]
 *   - an array of {ts, v} objects, e.g. [{ts: ..., v: 12}, …]
 *
 * Renders a minimal recharts <LineChart>. No axes, no tooltip by default.
 * Empty / loading / error states are visually consistent with the rest
 * of the kit (Skeleton + EmptyState).
 */
import React, { useMemo } from "react";
import {
  ResponsiveContainer, LineChart, Line, Tooltip, YAxis,
} from "recharts";
import { C } from "@/lib/constants";
import { Skeleton, EmptyState } from "@/components/kit";
import { useConfigValue } from "@/hooks/useConfigBus";

const TONE_STROKE = {
  accent: C.accent,
  info: C.info,
  ok: C.green,
  warn: C.yellow,
  err: C.red,
};

function normaliseSeries(value) {
  if (!Array.isArray(value)) return [];
  return value.map((p, i) => {
    if (typeof p === "number") return { i, v: p };
    if (p && typeof p === "object") return { i, v: Number(p.v ?? p.value ?? 0), ts: p.ts };
    return { i, v: 0 };
  });
}

export function BindSparkline({
  to,
  height = 32,
  width = "100%",
  tone = "accent",
  showTooltip = false,
  dataTestid,
  className,
}) {
  const { value, loading, error } = useConfigValue(to);
  const data = useMemo(() => normaliseSeries(value), [value]);
  const testid = dataTestid || `bind-sparkline-${to}`;
  const stroke = TONE_STROKE[tone] || C.accent;

  if (loading && (value === undefined)) {
    return (
      <span data-testid={testid} className={className}>
        <Skeleton height={height} width={typeof width === "number" ? width : "100%"} />
      </span>
    );
  }

  if (error && (value === undefined)) {
    return (
      <span
        data-testid={testid}
        className={className}
        style={{ color: C.red, fontSize: 11, display: "inline-block", height }}
      >
        ⚠ {error}
      </span>
    );
  }

  if (!data.length) {
    return (
      <div data-testid={testid} className={className}>
        <EmptyState title="No data" description="No samples to display yet." />
      </div>
    );
  }

  return (
    <div
      data-testid={testid}
      className={className}
      style={{ width, height }}
    >
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
          <YAxis hide domain={["auto", "auto"]} />
          {showTooltip && (
            <Tooltip
              cursor={false}
              contentStyle={{
                background: C.surface,
                border: `1px solid ${C.border}`,
                fontSize: 11,
                borderRadius: 6,
                color: C.text,
              }}
              labelStyle={{ display: "none" }}
            />
          )}
          <Line
            type="monotone"
            dataKey="v"
            stroke={stroke}
            strokeWidth={1.5}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export default BindSparkline;
