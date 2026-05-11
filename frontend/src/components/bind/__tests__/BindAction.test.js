/**
 * Phase 0.3 — BindAction tests
 *
 * Mocks global.fetch to assert:
 *   - GET /api/v2/actions/{key} on mount (metadata fetch)
 *   - POST /api/v2/actions/{key} on click for non-destructive actions
 *   - Confirm dialog for destructive actions; only POSTs after confirm click
 */

const { render, screen, waitFor, fireEvent } = require("@testing-library/react");
const React = require("react");
const { BindAction } = require("../BindAction");

function mockFetchSequence(handler) {
  global.fetch = jest.fn(handler);
}

function jsonRes(body, ok = true, status = 200) {
  return Promise.resolve({
    ok,
    status,
    json: () => Promise.resolve(body),
    headers: { get: () => "application/json" },
  });
}

beforeEach(() => {
  jest.resetAllMocks();
});

afterEach(() => {
  delete global.fetch;
});

describe("<BindAction>", () => {
  test("fetches metadata on mount", async () => {
    mockFetchSequence((url) => {
      if (url.includes("/api/v2/actions/")) {
        return jsonRes({
          ok: true,
          data: { key: "health.ping", title: "Health Ping", destructive: false },
        });
      }
      return jsonRes({});
    });
    render(<BindAction to="health.ping" label="Ping" />);
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled();
    });
    const call = global.fetch.mock.calls[0];
    expect(call[0]).toContain("/api/v2/actions/health.ping");
    // GET — no method (or method GET)
    const init = call[1];
    if (init && init.method) expect(init.method).not.toBe("POST");
  });

  test("non-destructive action POSTs immediately on click", async () => {
    mockFetchSequence((url, init) => {
      if (init && init.method === "POST") {
        return jsonRes({ ok: true, result: "pong" });
      }
      // metadata GET
      return jsonRes({
        ok: true,
        data: { key: "health.ping", title: "Health Ping", destructive: false },
      });
    });
    render(<BindAction to="health.ping" label="Ping" />);
    // wait for metadata
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());

    const btn = screen.getByTestId("bind-action-health.ping-button");
    fireEvent.click(btn);

    await waitFor(() => {
      const calls = global.fetch.mock.calls;
      const post = calls.find(
        ([, opts]) => opts && opts.method === "POST"
      );
      expect(post).toBeTruthy();
      expect(post[0]).toContain("/api/v2/actions/health.ping");
    });

    // No confirm panel rendered
    expect(
      screen.queryByTestId("bind-action-health.ping-confirm-panel")
    ).toBeNull();
  });

  test("destructive action shows confirm panel before POST", async () => {
    mockFetchSequence((url, init) => {
      if (init && init.method === "POST") {
        return jsonRes({ ok: true, result: { reset: true } });
      }
      return jsonRes({
        ok: true,
        data: {
          key: "config.reset_all",
          title: "Reset all config",
          destructive: true,
          requires_confirm: true,
        },
      });
    });
    render(<BindAction to="config.reset_all" label="Reset all config" />);
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());

    // first click — should NOT POST yet, should show confirm panel
    fireEvent.click(screen.getByTestId("bind-action-config.reset_all-button"));

    await waitFor(() => {
      expect(
        screen.getByTestId("bind-action-config.reset_all-confirm-panel")
      ).toBeInTheDocument();
    });

    // No POST has happened yet
    const postBefore = global.fetch.mock.calls.find(
      ([, opts]) => opts && opts.method === "POST"
    );
    expect(postBefore).toBeFalsy();

    // Click confirm
    fireEvent.click(screen.getByTestId("bind-action-config.reset_all-confirm"));

    await waitFor(() => {
      const post = global.fetch.mock.calls.find(
        ([, opts]) => opts && opts.method === "POST"
      );
      expect(post).toBeTruthy();
      expect(post[0]).toContain("/api/v2/actions/config.reset_all");
      // body has args + actor
      const body = JSON.parse(post[1].body);
      expect(body).toHaveProperty("args");
      expect(body).toHaveProperty("actor");
    });
  });

  test("cancel button dismisses confirm panel without POST", async () => {
    mockFetchSequence((url, init) => {
      if (init && init.method === "POST") {
        return jsonRes({ ok: true });
      }
      return jsonRes({
        ok: true,
        data: { key: "x.y", title: "X", destructive: true },
      });
    });
    render(<BindAction to="x.y" label="Run" />);
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
    fireEvent.click(screen.getByTestId("bind-action-x.y-button"));
    await waitFor(() => {
      expect(screen.getByTestId("bind-action-x.y-confirm-panel")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId("bind-action-x.y-cancel"));
    await waitFor(() => {
      expect(screen.queryByTestId("bind-action-x.y-confirm-panel")).toBeNull();
    });
    // Still no POST
    const post = global.fetch.mock.calls.find(
      ([, opts]) => opts && opts.method === "POST"
    );
    expect(post).toBeFalsy();
  });

  test("explicit confirm prop forces confirm even when not destructive", async () => {
    mockFetchSequence((url, init) => {
      if (init && init.method === "POST") return jsonRes({ ok: true });
      return jsonRes({
        ok: true,
        data: { key: "z.z", title: "Z", destructive: false },
      });
    });
    render(<BindAction to="z.z" label="Z" confirm />);
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
    fireEvent.click(screen.getByTestId("bind-action-z.z-button"));
    await waitFor(() => {
      expect(screen.getByTestId("bind-action-z.z-confirm-panel")).toBeInTheDocument();
    });
  });
});
