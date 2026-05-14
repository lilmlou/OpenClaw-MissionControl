import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { UsageBadge } from "../UsageBadge";

describe("UsageBadge", () => {
  test("renders pending state when no usage data provided", () => {
    render(<UsageBadge />);
    const badge = screen.getByTestId("usage-badge");
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveAttribute("data-state", "pending");
    expect(badge.textContent).toMatch(/usage pending/i);
  });

  test("renders pending state when explicitly pending=true", () => {
    render(
      <UsageBadge
        tokens_in={100}
        tokens_out={50}
        cost_estimate_usd={0.001}
        pending
      />,
    );
    expect(screen.getByTestId("usage-badge")).toHaveAttribute(
      "data-state",
      "pending",
    );
  });

  test("renders tokens in/out + cost when provided", () => {
    render(
      <UsageBadge
        tokens_in={1240}
        tokens_out={312}
        cost_estimate_usd={0.0042}
        model="claude-opus-4-7"
        provider="venice"
      />,
    );
    const badge = screen.getByTestId("usage-badge");
    expect(badge).toHaveAttribute("data-state", "ready");
    expect(screen.getByTestId("usage-badge-in").textContent).toMatch(
      /1,240 in/,
    );
    expect(screen.getByTestId("usage-badge-out").textContent).toMatch(
      /312 out/,
    );
    expect(screen.getByTestId("usage-badge-cost").textContent).toMatch(
      /\$0\.0042/,
    );
  });

  test("formats free cost as 'free'", () => {
    render(
      <UsageBadge tokens_in={10} tokens_out={5} cost_estimate_usd={0} />,
    );
    expect(screen.getByTestId("usage-badge-cost").textContent).toMatch(/free/);
  });

  test("formats tiny cost with <$0.0001 floor", () => {
    render(
      <UsageBadge
        tokens_in={1}
        tokens_out={1}
        cost_estimate_usd={0.00000123}
      />,
    );
    expect(screen.getByTestId("usage-badge-cost").textContent).toMatch(
      /<\$0\.0001/,
    );
  });

  test("locale-formats large token counts with commas", () => {
    render(
      <UsageBadge
        tokens_in={1234567}
        tokens_out={9876}
        cost_estimate_usd={1.23}
      />,
    );
    expect(screen.getByTestId("usage-badge-in").textContent).toMatch(
      /1,234,567 in/,
    );
    expect(screen.getByTestId("usage-badge-out").textContent).toMatch(
      /9,876 out/,
    );
    expect(screen.getByTestId("usage-badge-cost").textContent).toMatch(
      /\$1\.23/,
    );
  });

  test("renders ready when only cost is missing (still shows tokens)", () => {
    render(<UsageBadge tokens_in={100} tokens_out={50} />);
    const badge = screen.getByTestId("usage-badge");
    expect(badge).toHaveAttribute("data-state", "ready");
  });
});
