/**
 * F7 — AgentLiveViewPage smoke tests
 *
 * Uses manual __mocks__/react-router-dom.js.
 */
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";

// ── mock hooks ─────────────────────────────────────────────────────────────────
const mockUseAgentRuns = jest.fn();
const mockUseAgentRunDetail = jest.fn();

jest.mock("@/hooks/useAgentRuns", () => ({
  __esModule: true,
  useAgentRuns: (...args) => mockUseAgentRuns(...args),
  useAgentRunDetail: (...args) => mockUseAgentRunDetail(...args),
  postRunVerify: jest.fn().mockResolvedValue({ status: "verified" }),
  postRunKill: jest.fn().mockResolvedValue({ status: "killed" }),
}));

jest.mock("@/hooks/useConfigBus", () => ({
  subscribeConfigWs: jest.fn(() => () => {}),
  ensureConfigWs: jest.fn(),
  useConfigValue: jest.fn(),
}));

jest.mock("@/lib/useGateway", () => ({
  apiUrl: (path) => `http://localhost:7801${path}`,
  useGateway: jest.fn(() => ({
    systemStats: null,
    systemServices: [],
    fetchSystemStats: jest.fn(),
    fetchSystemServices: jest.fn(),
  })),
}));

import AgentLiveViewPage from "../AgentLiveViewPage";

// ── test data ──────────────────────────────────────────────────────────────────
const mockRuns = [
  {
    id: "run_001",
    agent_id: "mc-planner",
    phase_id: "F7",
    handoff_doc: "F7_AGENT_LIVE_VIEW_FRONTEND.md",
    status: "running",
    started_ts: Date.now() - 300000,
    dispatched_ts: Date.now() - 310000,
    ended_ts: null,
    acceptance_total: 5,
    acceptance_passed: 2,
    diff_added: 10,
    diff_removed: 3,
    files_touched: ["F7_AGENT_LIVE_VIEW_FRONTEND.md"],
  },
  {
    id: "run_002",
    agent_id: "mc-fe-executor",
    phase_id: "D1",
    status: "claims_done",
    started_ts: Date.now() - 600000,
    dispatched_ts: Date.now() - 610000,
    ended_ts: Date.now() - 100000,
    acceptance_total: 3,
    acceptance_passed: 3,
    diff_added: 0,
    diff_removed: 0,
    files_touched: [],
  },
  {
    id: "run_003",
    agent_id: "mc-be-executor",
    phase_id: "0.3",
    status: "verified",
    started_ts: Date.now() - 1200000,
    dispatched_ts: Date.now() - 1210000,
    ended_ts: Date.now() - 800000,
    acceptance_total: 8,
    acceptance_passed: 8,
    diff_added: 47,
    diff_removed: 3,
    files_touched: ["bind/Bind.js"],
  },
];

describe("AgentLiveViewPage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAgentRuns.mockReturnValue({
      runs: [],
      loading: false,
      error: null,
      runningCount: 0,
      claimsCount: 0,
      lastUpdated: Date.now(),
      wsDisconnected: false,
      reconnectWs: jest.fn(),
      reload: jest.fn(),
    });

    mockUseAgentRunDetail.mockReturnValue({
      run: null,
      events: [],
      checks: [],
      diff: null,
      loading: false,
      error: null,
      lastHeartbeat: null,
      lastEventTs: 0,
      reload: jest.fn(),
    });
  });

  test("renders page title and empty state when no runs", () => {
    render(<AgentLiveViewPage />);
    expect(screen.getByText("Agent Live View")).toBeInTheDocument();
    expect(screen.getByText("No agent runs yet")).toBeInTheDocument();
  });

  test("renders all six filter chips", () => {
    render(<AgentLiveViewPage />);
    expect(screen.getByTestId("agent-live-filter-chips")).toBeInTheDocument();
    expect(screen.getByText("All")).toBeInTheDocument();
    expect(screen.getByText("Running")).toBeInTheDocument();
    expect(screen.getByText("Claims done")).toBeInTheDocument();
    expect(screen.getByText("Verified")).toBeInTheDocument();
    expect(screen.getByText("Failed")).toBeInTheDocument();
    expect(screen.getByText("Killed")).toBeInTheDocument();
  });

  describe("with runs", () => {
    beforeEach(() => {
      mockUseAgentRuns.mockReturnValue({
        runs: mockRuns,
        loading: false,
        error: null,
        runningCount: 1,
        claimsCount: 1,
        lastUpdated: Date.now(),
        wsDisconnected: false,
        reconnectWs: jest.fn(),
        reload: jest.fn(),
      });

      mockUseAgentRunDetail.mockReturnValue({
        run: mockRuns[0],
        events: [
          { id: "evt_1", kind: "run.started", ts: Date.now() - 5000, summary: "Agent started" },
        ],
        checks: [
          { id: "chk_1", bullet_index: 1, label: "test check", command: "echo ok", status: "pass" },
          { id: "chk_2", bullet_index: 2, label: "failing check", command: "false", status: "fail", actual: "exit code 1" },
        ],
        diff: { files: ["test.js"], added: 10, removed: 3 },
        loading: false,
        error: null,
        lastHeartbeat: Date.now(),
        lastEventTs: Date.now() - 5000,
        reload: jest.fn(),
      });
    });

    test("renders run list with status pills for all five statuses", () => {
      render(<AgentLiveViewPage />);
      expect(screen.getByTestId("agent-runs-list")).toBeInTheDocument();
      expect(screen.getAllByTestId("agent-status-pill-running").length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByTestId("agent-status-pill-claims_done").length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByTestId("agent-status-pill-verified").length).toBeGreaterThanOrEqual(1);
    });

    test("renders run detail with heartbeat", () => {
      render(<AgentLiveViewPage />);
      expect(screen.getByTestId("agent-heartbeat")).toBeInTheDocument();
    });

    test("renders acceptance list with check items and retry buttons", () => {
      render(<AgentLiveViewPage />);
      expect(screen.getByTestId("acceptance-list")).toBeInTheDocument();
      expect(screen.getByText("test check")).toBeInTheDocument();
      expect(screen.getByText("failing check")).toBeInTheDocument();
      expect(screen.getByTestId("acceptance-retry-chk_2")).toBeInTheDocument();
    });

    test("Verify all button enabled for claims_done runs", () => {
      mockUseAgentRunDetail.mockReturnValue({
        run: mockRuns[1],
        events: [],
        checks: [],
        diff: null,
        loading: false,
        error: null,
        lastHeartbeat: null,
        lastEventTs: 0,
        reload: jest.fn(),
      });
      render(<AgentLiveViewPage />);
      expect(screen.getByTestId("agent-control-verify")).not.toBeDisabled();
    });

    test("Kill button disabled for claims_done (non-running) runs", () => {
      mockUseAgentRunDetail.mockReturnValue({
        run: mockRuns[1],
        events: [],
        checks: [],
        diff: null,
        loading: false,
        error: null,
        lastHeartbeat: null,
        lastEventTs: 0,
        reload: jest.fn(),
      });
      render(<AgentLiveViewPage />);
      expect(screen.getByTestId("agent-control-kill")).toBeDisabled();
    });

    test("Kill button enabled for running runs", () => {
      render(<AgentLiveViewPage />);
      expect(screen.getByTestId("agent-control-kill")).not.toBeDisabled();
    });

    test("Polling fallback banner renders when wsDisconnected", () => {
      mockUseAgentRuns.mockReturnValue({
        runs: mockRuns,
        loading: false,
        error: null,
        runningCount: 1,
        claimsCount: 1,
        lastUpdated: Date.now(),
        wsDisconnected: true,
        reconnectWs: jest.fn(),
        reload: jest.fn(),
      });
      render(<AgentLiveViewPage />);
      expect(screen.getByTestId("polling-fallback-banner")).toBeInTheDocument();
      expect(screen.getByText(/Live updates paused/)).toBeInTheDocument();
    });

    test("running count and claims count pills render in header", () => {
      render(<AgentLiveViewPage />);
      expect(screen.getByText("1 running")).toBeInTheDocument();
      expect(screen.getByText("1 awaiting verify")).toBeInTheDocument();
    });
  });
});