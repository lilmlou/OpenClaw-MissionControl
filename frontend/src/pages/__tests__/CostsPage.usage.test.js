/**
 * CostsPage — Token Usage Today card (Sprint 5)
 *
 * Verifies the card renders with all 4 stats when tokenUsageToday is populated.
 *
 * NOTE: Must use named function in jest.mock factory (not arrow function)
 * due to Babel CJS transform behaviour with Zustand stores.
 */
import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

jest.mock("@/lib/useGateway", () => {
  function mockUseGateway() {
    return {
      usage: {
        totals: null,
        projections: null,
        byAgent: [],
        byModel: [],
        loading: false,
        error: null,
        lastUpdated: null,
      },
      tokenUsageToday: {
        messages: 42,
        tokens_in: 12000,
        tokens_out: 5000,
        cost_estimate_usd: 0.0372,
        loading: false,
        error: null,
        // Use a fixed recent timestamp so the "Live" indicator renders.
        lastUpdated: Date.now(),
      },
      setUsageTimeRange: function() {},
      refreshAllUsage: function() { return Promise.resolve(null); },
    };
  }
  mockUseGateway.getState = function() { return mockUseGateway(); };
  return {
    useGateway: mockUseGateway,
    apiUrl: function(p) { return "http://localhost:7801" + p; },
  };
});

// recharts — stub so it renders children without sizing.
jest.mock("recharts", () => {
  const React = require("react");
  return {
    ResponsiveContainer: function({ children }) {
      return React.createElement("div", { "data-testid": "recharts-container" }, children);
    },
    BarChart: function({ children }) { return React.createElement("div", null, children); },
    Bar: function() { return null; },
    XAxis: function() { return null; },
    YAxis: function() { return null; },
    Tooltip: function() { return null; },
    Cell: function() { return null; },
  };
});

import CostsPage from "../CostsPage";

describe("CostsPage — Token Usage Today card", () => {
  test("renders the Token Usage Today card as first card", () => {
    render(<CostsPage />);
    expect(screen.getByTestId("token-usage-today-card")).toBeInTheDocument();
    expect(screen.getByText(/token usage today/i)).toBeInTheDocument();
  });

  test("renders Messages stat with value from tokenUsageToday", () => {
    render(<CostsPage />);
    const cell = screen.getByTestId("token-usage-today-messages");
    expect(cell).toBeInTheDocument();
    expect(cell.textContent).toContain("42");
  });

  test("renders Tokens In stat", () => {
    render(<CostsPage />);
    const cell = screen.getByTestId("token-usage-today-tokens-in");
    expect(cell).toBeInTheDocument();
    // 12000 formats as "12.0K"
    expect(cell.textContent).toMatch(/12/);
  });

  test("renders Tokens Out stat", () => {
    render(<CostsPage />);
    const cell = screen.getByTestId("token-usage-today-tokens-out");
    expect(cell).toBeInTheDocument();
    expect(cell.textContent).toMatch(/5/);
  });

  test("renders Cost (USD) stat", () => {
    render(<CostsPage />);
    const cell = screen.getByTestId("token-usage-today-cost");
    expect(cell).toBeInTheDocument();
    // 0.0372 renders as "$0.0372"
    expect(cell.textContent).toMatch(/\$0\.0372/);
  });

  test("shows Live indicator when lastUpdated is recent (< 60s)", () => {
    render(<CostsPage />);
    expect(screen.getByTestId("token-usage-today-live")).toBeInTheDocument();
  });
});
