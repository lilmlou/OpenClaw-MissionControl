/**
 * Phase 0.3 — BindList tests
 *
 * BindList fetches a gateway endpoint, unwraps the Phase 0.1 `{ok,data,ts}`
 * envelope, runs the optional `transform`, and renders items via `renderItem`.
 * Covers: loading, empty, error, 404 "not yet wired", and the envelope unwrap.
 */

import React from "react";
import { render, screen, waitFor, act } from "@testing-library/react";

const mockFetch = jest.fn();
global.fetch = mockFetch;

jest.mock("@/lib/useGateway", () => ({
  apiUrl: (url) => (url.startsWith("http") ? url : `http://localhost:8000${url}`),
}));

jest.mock("@/components/kit", () => ({
  EmptyState: ({ title, description, icon }) =>
    require("react").createElement(
      "div",
      { "data-testid": "empty-state", "data-title": title },
      [
        require("react").createElement("span", { key: "t" }, title),
        require("react").createElement("span", { key: "d" }, description),
      ]
    ),
  Skeleton: ({ height }) =>
    require("react").createElement("div", {
      "data-testid": "skeleton",
      style: { height },
    }),
}));

jest.mock("@/lib/constants", () => ({
  C: {
    surface: "#000", surface2: "#111", border: "#222", text: "#fff",
    muted: "#888", accent: "#0f0",
  },
}));

const { BindList } = require("../BindList");

beforeEach(() => {
  mockFetch.mockReset();
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

function jsonResponse(body, status = 200) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  });
}

describe("<BindList>", () => {
  test("unwraps Phase 0.1 envelope and renders items via default transform", async () => {
    mockFetch.mockImplementation(() =>
      jsonResponse({ ok: true, data: [{ id: "a", title: "Alpha" }, { id: "b", title: "Beta" }], ts: 1 })
    );

    render(<BindList resource="/api/v2/threads" pollMs={0} />);

    await waitFor(() => {
      expect(screen.getByText("Alpha")).toBeInTheDocument();
    });
    expect(screen.getByText("Beta")).toBeInTheDocument();
  });

  test("transform receives unwrapped `data` (not the full envelope)", async () => {
    const transform = jest.fn(({ items }) => items);
    mockFetch.mockImplementation(() =>
      jsonResponse({ ok: true, data: { items: [{ id: "x", name: "X" }] }, ts: 2 })
    );

    render(<BindList resource="/api/v2/foo" transform={transform} pollMs={0} />);

    await waitFor(() => {
      expect(transform).toHaveBeenCalledWith({ items: [{ id: "x", name: "X" }] });
    });
    expect(screen.getByText("X")).toBeInTheDocument();
  });

  test("renders empty state when transform yields []", async () => {
    mockFetch.mockImplementation(() => jsonResponse({ ok: true, data: [], ts: 3 }));
    render(<BindList resource="/api/v2/empty" pollMs={0} />);
    await waitFor(() => {
      expect(screen.getByTestId("empty-state")).toHaveAttribute("data-title", "Nothing to show");
    });
  });

  test("404 renders 'not yet wired' placeholder, never fake rows", async () => {
    mockFetch.mockImplementation(() => jsonResponse({}, 404));
    render(<BindList resource="/api/v2/missing" pollMs={0} />);
    await waitFor(() => {
      expect(screen.getByTestId("empty-state")).toHaveAttribute("data-title", "List not yet wired");
    });
  });

  test("renders error state on non-OK response", async () => {
    mockFetch.mockImplementation(() => jsonResponse({ ok: false, error: "boom" }, 500));
    render(<BindList resource="/api/v2/broken" pollMs={0} />);
    await waitFor(() => {
      expect(screen.getByTestId("empty-state")).toHaveAttribute("data-title", "Failed to load");
    });
  });

  test("ok:false envelope is treated as an error", async () => {
    mockFetch.mockImplementation(() => jsonResponse({ ok: false, error: "nope" }, 200));
    render(<BindList resource="/api/v2/refused" pollMs={0} />);
    await waitFor(() => {
      expect(screen.getByTestId("empty-state")).toHaveAttribute("data-title", "Failed to load");
    });
  });

  test("renderItem override controls row output", async () => {
    mockFetch.mockImplementation(() =>
      jsonResponse({ ok: true, data: [{ id: "1" }, { id: "2" }], ts: 0 })
    );
    const renderItem = (item) => (
      <li key={item.id} data-testid={`row-${item.id}`}>row {item.id}</li>
    );
    render(<BindList resource="/api/v2/rows" renderItem={renderItem} pollMs={0} />);
    await waitFor(() => expect(screen.getByTestId("row-1")).toBeInTheDocument());
    expect(screen.getByTestId("row-2")).toBeInTheDocument();
  });
});
