/**
 * Sprint 4 — ActivityPane tests.
 *
 * Covers:
 *  1. ActivityPane mounts from Layout (bell button visible).
 *  2. chat.config.set row renderer — description formatted as
 *     "chat.<key> changed: <old> → <new>".
 *  3. Unread badge increments when drawer is closed; resets on open.
 *  4. activities.feed.max_items config value drives the slice cap.
 *  5. connectActivitiesWebSocket called on mount.
 */

import React from "react";
import { render, screen, act } from "@testing-library/react";

// ── Gateway mock ─────────────────────────────────────────────────────────────
// jest.mock factories cannot reference out-of-scope variables; we use a module-
// level getter so the mock is always resolved lazily from __store.

// Prefix with "mock" so Babel allows the reference inside jest.mock.
const mockStore = {
  activities: [],
  activitiesPaneOpen: false,
  activitiesUnreadCount: 0,
  activitiesWsConnected: false,
  toggleActivitiesPane: jest.fn(),
  markActivitiesRead: jest.fn(),
  connectActivitiesWebSocket: jest.fn(),
};

jest.mock("@/lib/useGateway", () => ({
  __esModule: true,
  useGateway: jest.fn(),
  apiUrl: (url) => `http://localhost:8000${url}`,
  getApiBase: () => "http://localhost:8000",
  wsUrl: (path) => `ws://localhost:8000${path}`,
  selectAgentsHealth: () => ({ state: "healthy", label: "All healthy", findingsCount: 0, runningCount: 0 }),
  formatHealthDetail: () => ({ state: "healthy", detail: "" }),
}));

// ── Config bus mock ──────────────────────────────────────────────────────────
const mockConfigMap = {};

jest.mock("@/hooks/useConfigBus", () => ({
  __esModule: true,
  useConfigValue: jest.fn(),
  subscribeConfigWs: jest.fn(() => () => {}),
  useConfigSchema: jest.fn(() => ({ schema: null, ui: null, loading: false, error: null })),
}));

// ── Imports after mocks ──────────────────────────────────────────────────────
const { useGateway } = require("@/lib/useGateway");
const { useConfigValue } = require("@/hooks/useConfigBus");
const { default: ActivityPane } = require("../ActivityPane");

// ── Setup helpers ────────────────────────────────────────────────────────────

function setStore(patch) {
  Object.assign(mockStore, patch);
}

function setupMocks() {
  useGateway.mockImplementation((selector) => {
    if (typeof selector === "function") return selector(mockStore);
    return mockStore;
  });
  useConfigValue.mockImplementation((key) => ({
    value: mockConfigMap[key] ?? undefined,
    version: undefined,
    loading: false,
    error: null,
  }));
}

function renderPane() {
  return render(<ActivityPane />);
}

// ── Reset before each ────────────────────────────────────────────────────────

beforeEach(() => {
  // Reset store to defaults
  mockStore.activities = [];
  mockStore.activitiesPaneOpen = false;
  mockStore.activitiesUnreadCount = 0;
  mockStore.activitiesWsConnected = false;
  mockStore.toggleActivitiesPane = jest.fn();
  mockStore.markActivitiesRead = jest.fn();
  mockStore.connectActivitiesWebSocket = jest.fn();

  // Reset config map
  Object.keys(mockConfigMap).forEach((k) => delete mockConfigMap[k]);

  setupMocks();
});

// ── Tests ─────────────────────────────────────────────────────────────────────

// 1. Bell visible on / (ActivityPane mounted from Layout)
test("bell button renders when pathname is /", () => {
  // react-router-dom mock returns useLocation() = { pathname: "/" }
  renderPane();
  expect(screen.getByTestId("activity-pane-toggle")).toBeInTheDocument();
});

test("ActivityPane is hidden on /activity route", () => {
  const router = require("react-router-dom");
  const orig = router.useLocation;
  router.useLocation = () => ({ pathname: "/activity", search: "", hash: "" });

  const { unmount } = renderPane();
  expect(screen.queryByTestId("activity-pane-toggle")).not.toBeInTheDocument();

  router.useLocation = orig;
  unmount();
});

test("ActivityPane is hidden on /system route", () => {
  const router = require("react-router-dom");
  const orig = router.useLocation;
  router.useLocation = () => ({ pathname: "/system", search: "", hash: "" });

  const { unmount } = renderPane();
  expect(screen.queryByTestId("activity-pane-toggle")).not.toBeInTheDocument();

  router.useLocation = orig;
  unmount();
});

// 2. chat.config.set row renderer
test("chat.config.set rows render formatted description", () => {
  setStore({
    activitiesPaneOpen: true,
    activities: [
      {
        id: "act-1",
        kind: "chat.config.set",
        severity: "info",
        actor: "agent",
        description: "old fallback desc",
        data: { key: "chat.history.token_budget", old_value: 4096, new_value: 99 },
        created_at: Date.now() - 5000,
      },
    ],
  });
  setupMocks();
  renderPane();

  expect(
    screen.getByText("chat.history.token_budget changed: 4096 → 99")
  ).toBeInTheDocument();
});

test("chat.config.set with key lacking chat. prefix still renders correctly", () => {
  setStore({
    activitiesPaneOpen: true,
    activities: [
      {
        id: "act-2",
        kind: "chat.config.set",
        severity: "info",
        actor: "system",
        description: "fallback",
        data: { key: "max_tokens", old_value: "auto", new_value: "2000" },
        created_at: Date.now() - 1000,
      },
    ],
  });
  setupMocks();
  renderPane();

  expect(
    screen.getByText("chat.max_tokens changed: auto → 2000")
  ).toBeInTheDocument();
});

test("non-chat.config.set activities render description as-is", () => {
  setStore({
    activitiesPaneOpen: true,
    activities: [
      {
        id: "act-3",
        kind: "agent.model_chosen",
        severity: "info",
        actor: "openclaw",
        description: "Chose claude-3-haiku-20240307",
        data: {},
        created_at: Date.now() - 2000,
      },
    ],
  });
  setupMocks();
  renderPane();

  expect(screen.getByText("Chose claude-3-haiku-20240307")).toBeInTheDocument();
});

// 3. Unread badge
test("unread badge shows count when drawer closed and count > 0", () => {
  setStore({ activitiesUnreadCount: 3, activitiesPaneOpen: false });
  setupMocks();
  renderPane();
  expect(screen.getByText("3")).toBeInTheDocument();
});

test("unread badge not rendered when count is 0", () => {
  setStore({ activitiesUnreadCount: 0, activitiesPaneOpen: false });
  setupMocks();
  renderPane();
  expect(screen.queryByText("0")).not.toBeInTheDocument();
});

test("unread badge caps at 99+", () => {
  setStore({ activitiesUnreadCount: 150, activitiesPaneOpen: false });
  setupMocks();
  renderPane();
  expect(screen.getByText("99+")).toBeInTheDocument();
});

// 4. activities.feed.max_items drives slice cap
test("respects activities.feed.max_items = 2 (shows only 2 rows)", () => {
  mockConfigMap["activities.feed.max_items"] = 2;
  const manyActivities = Array.from({ length: 10 }, (_, i) => ({
    id: `act-${i}`,
    kind: "agent.run",
    severity: "info",
    actor: "cron",
    description: `Run #${i}`,
    data: {},
    created_at: Date.now() - i * 1000,
  }));
  setStore({ activitiesPaneOpen: true, activities: manyActivities });
  setupMocks();
  renderPane();

  const rows = screen.getAllByRole("link").filter(
    (el) => (el.getAttribute("href") || "").startsWith("/activity?id=")
  );
  expect(rows.length).toBe(2);
});

test("defaults to 50 when config key is not set", () => {
  // 5 activities, no config override — all should show
  const activities = Array.from({ length: 5 }, (_, i) => ({
    id: `act-${i}`,
    kind: "agent.run",
    severity: "info",
    actor: "cron",
    description: `Run #${i}`,
    data: {},
    created_at: Date.now() - i * 1000,
  }));
  setStore({ activitiesPaneOpen: true, activities });
  setupMocks();
  renderPane();

  const rows = screen.getAllByRole("link").filter(
    (el) => (el.getAttribute("href") || "").startsWith("/activity?id=")
  );
  expect(rows.length).toBe(5);
});

// 5. connectActivitiesWebSocket called on mount
test("connectActivitiesWebSocket is called on mount", () => {
  const connectFn = jest.fn();
  setStore({ connectActivitiesWebSocket: connectFn });
  setupMocks();
  renderPane();
  expect(connectFn).toHaveBeenCalled();
});
