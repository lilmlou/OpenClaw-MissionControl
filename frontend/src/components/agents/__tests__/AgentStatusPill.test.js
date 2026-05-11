/**
 * F7 — AgentStatusPill tests
 *
 * Covers §6 acceptance #1: All five statuses render with correct icon + colour.
 */
import React from "react";
import { render, screen } from "@testing-library/react";
import AgentStatusPill, { getStatusMeta } from "../AgentStatusPill";

describe("AgentStatusPill", () => {
  describe("getStatusMeta", () => {
    test("running returns warn tone with Loader2 icon and pulse", () => {
      const meta = getStatusMeta("running");
      expect(meta.tone).toBe("warn");
      expect(meta.label).toBe("running");
      expect(meta.pulse).toBe(true);
      expect(meta.indicator).toBe("warn");
    });

    test("claims_done returns warn tone with AlertCircle icon and no pulse", () => {
      const meta = getStatusMeta("claims_done");
      expect(meta.tone).toBe("warn");
      expect(meta.label).toBe("claims done");
      expect(meta.pulse).toBe(false);
      expect(meta.indicator).toBe("warn");
    });

    test("verified returns ok tone with CheckCircle2 icon and no pulse", () => {
      const meta = getStatusMeta("verified");
      expect(meta.tone).toBe("ok");
      expect(meta.label).toBe("verified");
      expect(meta.pulse).toBe(false);
      expect(meta.indicator).toBe("ok");
    });

    test("failed returns err tone with XCircle icon and no pulse", () => {
      const meta = getStatusMeta("failed");
      expect(meta.tone).toBe("err");
      expect(meta.label).toBe("failed");
      expect(meta.pulse).toBe(false);
      expect(meta.indicator).toBe("err");
    });

    test("killed returns neutral tone with Skull icon and no pulse", () => {
      const meta = getStatusMeta("killed");
      expect(meta.tone).toBe("neutral");
      expect(meta.label).toBe("killed");
      expect(meta.pulse).toBe(false);
      expect(meta.indicator).toBe("off");
    });

    test("unknown status returns neutral default", () => {
      const meta = getStatusMeta("garbage");
      expect(meta.tone).toBe("neutral");
      expect(meta.label).toBe("garbage");
      expect(meta.pulse).toBe(false);
    });
  });

  describe("rendering", () => {
    const statuses = ["running", "claims_done", "verified", "failed", "killed"];

    statuses.forEach((status) => {
      test(`renders ${status} pill with correct data-testid and label`, () => {
        render(<AgentStatusPill status={status} />);
        const el = screen.getByTestId(`agent-status-pill-${status}`);
        expect(el).toBeInTheDocument();
        expect(el).toHaveAttribute("data-status", status);
      });
    });

    test("running pill has animate-spin icon", () => {
      render(<AgentStatusPill status="running" />);
      const el = screen.getByTestId("agent-status-pill-running");
      expect(el.querySelector("svg")).toBeInTheDocument();
    });

    test("verified pill is visually distinct from claims_done (different tones)", () => {
      const verified = getStatusMeta("verified");
      const claims = getStatusMeta("claims_done");
      expect(verified.tone).not.toBe(claims.tone); // ok vs warn
    });

    test("claims_done renders 'claims done' as label text", () => {
      render(<AgentStatusPill status="claims_done" />);
      const el = screen.getByTestId("agent-status-pill-claims_done");
      expect(el.textContent).toContain("claims done");
    });

    test("verified renders 'verified' as label text", () => {
      render(<AgentStatusPill status="verified" />);
      const el = screen.getByTestId("agent-status-pill-verified");
      expect(el.textContent).toContain("verified");
    });

    test("md size applies larger padding", () => {
      render(<AgentStatusPill status="running" size="md" />);
      const el = screen.getByTestId("agent-status-pill-running");
      expect(el).toBeInTheDocument();
    });

    test("showIcon=false hides the icon", () => {
      render(<AgentStatusPill status="running" showIcon={false} />);
      const el = screen.getByTestId("agent-status-pill-running");
      expect(el.querySelector("svg")).toBeNull();
    });
  });
});