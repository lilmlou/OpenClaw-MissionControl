/**
 * VM-D1 — BlockersBanner tests.
 */

import React from "react";
import { render, screen, waitFor, act, fireEvent } from "@testing-library/react";

// ── Mock apiUrl/getApiBase ────────────────────────────────────────────────
jest.mock("@/lib/useGateway", () => ({
  apiUrl: (url) => (url && url.startsWith("http") ? url : `http://localhost:8000${url}`),
  getApiBase: () => "http://localhost:8000",
}));

// ── Mock useConfigBus with self-contained handler registry ────────────────
// We expose __getHandlers / __resetHandlers on the mock module itself so the
// test scope can fire frames without depending on globalThis hoist ordering.
jest.mock("@/hooks/useConfigBus", () => {
  const handlers = new Set();
  return {
    __esModule: true,
    subscribeConfigWs: jest.fn((fn) => {
      handlers.add(fn);
      return () => handlers.delete(fn);
    }),
    ensureConfigWs: jest.fn(),
    __getHandlers: () => handlers,
    __resetHandlers: () => handlers.clear(),
  };
});

// ── Mock BlockersDrawer (lazy import) ─────────────────────────────────────
jest.mock("../BlockersDrawer", () => {
  const ReactLocal = require("react");
  return {
    __esModule: true,
    default: ({ open, onClose }) =>
      open
        ? ReactLocal.createElement(
            "div",
            { "data-testid": "blockers-drawer" },
            ReactLocal.createElement(
              "button",
              { "data-testid": "blockers-drawer-close", onClick: onClose },
              "close"
            )
          )
        : null,
  };
});

// Import AFTER mocks
// eslint-disable-next-line global-require
const cfgBus = require("@/hooks/useConfigBus");
// eslint-disable-next-line global-require
const { default: BlockersBanner } = require("../BlockersBanner");

function jsonRes(body, ok = true, status = 200) {
  return Promise.resolve({
    ok,
    status,
    json: () => Promise.resolve(body),
    headers: { get: () => "application/json" },
  });
}

function mockCountFetch(count_open) {
  global.fetch = jest.fn(() =>
    jsonRes({ ok: true, data: { count_open }, ts: Date.now() })
  );
}

function fireFrame(frame) {
  act(() => {
    // Pull handlers from the mock's call args directly — this is robust even
    // when StrictMode mounts/unmounts effects and the internal Set churns.
    const calls = cfgBus.subscribeConfigWs.mock.calls;
    calls.forEach(([handler]) => {
      if (typeof handler === "function") handler(frame);
    });
  });
}

beforeEach(() => {
  cfgBus.__resetHandlers();
  cfgBus.subscribeConfigWs.mockClear();
});

afterEach(() => {
  delete global.fetch;
});

describe("<BlockersBanner>", () => {
  test("renders null when count_open is 0", async () => {
    mockCountFetch(0);
    const { container } = render(<BlockersBanner />);
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
    expect(screen.queryByTestId("blockers-banner")).toBeNull();
    expect(container.firstChild).toBeNull();
  });

  test("renders banner with count when count_open is 3", async () => {
    mockCountFetch(3);
    render(<BlockersBanner />);
    await waitFor(() =>
      expect(screen.getByTestId("blockers-banner")).toBeInTheDocument()
    );
    expect(screen.getByTestId("blockers-banner-count")).toHaveTextContent("3");
  });

  test("clicking [×] hides banner locally (session-only dismiss)", async () => {
    mockCountFetch(2);
    render(<BlockersBanner />);
    await waitFor(() =>
      expect(screen.getByTestId("blockers-banner")).toBeInTheDocument()
    );
    fireEvent.click(screen.getByTestId("blockers-banner-dismiss"));
    expect(screen.queryByTestId("blockers-banner")).toBeNull();
  });

  test("blockers.replay frame updates count to data.count_open", async () => {
    mockCountFetch(1);
    render(<BlockersBanner />);
    await waitFor(() =>
      expect(screen.getByTestId("blockers-banner")).toBeInTheDocument()
    );
    await waitFor(() =>
      expect(cfgBus.subscribeConfigWs).toHaveBeenCalled()
    );
    fireFrame({ type: "blockers.replay", data: { count_open: 7, items: [] } });
    await waitFor(() =>
      expect(screen.getByTestId("blockers-banner-count")).toHaveTextContent("7")
    );
  });

  test("blocker.opened increments count", async () => {
    mockCountFetch(2);
    render(<BlockersBanner />);
    await waitFor(() =>
      expect(screen.getByTestId("blockers-banner-count")).toHaveTextContent("2")
    );
    await waitFor(() =>
      expect(cfgBus.subscribeConfigWs).toHaveBeenCalled()
    );
    fireFrame({ type: "blocker.opened", data: { id: "abc", status: "open" } });
    await waitFor(() =>
      expect(screen.getByTestId("blockers-banner-count")).toHaveTextContent("3")
    );
  });

  test("blocker.closed (status:closed) decrements count", async () => {
    mockCountFetch(3);
    render(<BlockersBanner />);
    await waitFor(() =>
      expect(screen.getByTestId("blockers-banner-count")).toHaveTextContent("3")
    );
    await waitFor(() =>
      expect(cfgBus.subscribeConfigWs).toHaveBeenCalled()
    );
    fireFrame({ type: "blocker.closed", data: { id: "abc", status: "closed" } });
    await waitFor(() =>
      expect(screen.getByTestId("blockers-banner-count")).toHaveTextContent("2")
    );
  });

  test("drawer opens on banner click", async () => {
    mockCountFetch(1);
    render(<BlockersBanner />);
    await waitFor(() =>
      expect(screen.getByTestId("blockers-banner")).toBeInTheDocument()
    );
    expect(screen.queryByTestId("blockers-drawer")).toBeNull();
    fireEvent.click(screen.getByTestId("blockers-banner"));
    await waitFor(() =>
      expect(screen.getByTestId("blockers-drawer")).toBeInTheDocument()
    );
  });
});
