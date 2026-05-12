// VM-D2 Progress Pulse — ProgressPulse container tests
//
// We mock useConfigBus (config value + WS subscribe) and BindAction to
// keep tests deterministic. The mocked subscribeConfigWs returns an
// unsubscribe fn we assert is called on unmount (Phase 0 single-socket
// hygiene). We also assert exactly ONE subscription per mount and that
// progress.* WS frames mutate state without polling.

let wsHandlers = [];
const mockUnsub = jest.fn();
const mockSubscribe = jest.fn((fn) => {
    wsHandlers.push(fn);
    return mockUnsub;
});

jest.mock("@/hooks/useConfigBus", () => ({
    __esModule: true,
    subscribeConfigWs: (fn) => mockSubscribe(fn),
    useConfigValue: () => ({ value: 20, version: 1, loading: false, error: null, set: jest.fn(), reload: jest.fn() }),
}));

jest.mock("@/components/bind/BindAction", () => ({
    __esModule: true,
    BindAction: (props) => {
        const React = require("react");
        return React.createElement(
            "button",
            {
                "data-testid": props.dataTestid || `bind-action-${props.to}`,
                "data-bind-to": props.to,
                type: "button",
            },
            props.label || props.to,
        );
    },
}));

const { render, screen, waitFor, act, fireEvent } = require("@testing-library/react");
const React = require("react");
const { ProgressPulse } = require("../ProgressPulse");

function jsonRes(body, ok = true, status = 200) {
    return Promise.resolve({
        ok,
        status,
        json: () => Promise.resolve(body),
        headers: { get: () => "application/json" },
    });
}

const sampleEntries = [
    {
        id: "v1",
        name: "Verified item",
        status: "verified",
        date_str: "2026-05-12",
        date_ts: 1746921600000,
        seen: false,
        body_md: "ok",
        suggested_actions: [],
    },
    {
        id: "d1",
        name: "Deceptive item",
        status: "deceptive",
        date_str: "2026-05-11",
        date_ts: 1746835200000,
        seen: false,
        body_md: "bad",
        suggested_actions: [{ label: "Re-run", action: "cron.run_now", args: { id: "x" } }],
    },
];

const sampleCounts = { verified: 3, claims_done: 2, deceptive: 1, in_flight: 0, unseen_total: 4 };

function mountWithFetch() {
    global.fetch = jest.fn((url) => {
        if (typeof url !== "string") url = String(url);
        if (url.includes("/api/v2/progress/counts")) {
            return jsonRes({ ok: true, data: sampleCounts });
        }
        if (url.includes("/api/v2/progress?limit=") || (url.includes("/api/v2/progress") && !url.includes("/seen"))) {
            return jsonRes({ ok: true, data: { items: sampleEntries, counts: sampleCounts, total: 2 } });
        }
        if (url.includes("/seen")) {
            const id = url.split("/").slice(-2)[0];
            return jsonRes({ ok: true, data: { ...sampleEntries.find((e) => e.id === id), seen: true } });
        }
        return jsonRes({ ok: false }, false, 404);
    });
    return render(React.createElement(ProgressPulse));
}

beforeEach(() => {
    wsHandlers = [];
    mockUnsub.mockClear();
    mockSubscribe.mockClear();
    // Re-arm subscribe implementation in case a prior reset wiped it.
    mockSubscribe.mockImplementation((fn) => {
        wsHandlers.push(fn);
        return mockUnsub;
    });
});

afterEach(() => {
    if (global.fetch && global.fetch.mockClear) global.fetch.mockClear();
});

describe("<ProgressPulse>", () => {
    test("mounts, fetches counts + entries, and subscribes WS exactly once", async () => {
        mountWithFetch();
        await waitFor(() => expect(screen.getByTestId("progress-list")).toBeInTheDocument());
        expect(mockSubscribe).toHaveBeenCalledTimes(1);
        expect(screen.getByTestId("progress-entry-v1")).toBeInTheDocument();
        expect(screen.getByTestId("progress-entry-d1")).toBeInTheDocument();
        expect(screen.getByTestId("progress-counts")).toHaveTextContent("3");
    });

    test("unsubscribes WS on unmount (no socket leak)", async () => {
        const { unmount } = mountWithFetch();
        await waitFor(() => expect(mockSubscribe).toHaveBeenCalled());
        unmount();
        expect(mockUnsub).toHaveBeenCalledTimes(1);
    });

    test("progress.entry.added prepends entry without page reload", async () => {
        mountWithFetch();
        await waitFor(() => expect(screen.getByTestId("progress-entry-v1")).toBeInTheDocument());
        act(() => {
            wsHandlers[0]({
                type: "progress.entry.added",
                data: {
                    id: "new1",
                    name: "Fresh entry",
                    status: "in_flight",
                    date_str: "2026-05-13",
                    date_ts: 1747008000000,
                    seen: false,
                    suggested_actions: [],
                },
            });
        });
        expect(screen.getByTestId("progress-entry-new1")).toBeInTheDocument();
    });

    test("progress.entry.changed updates seen flag in place", async () => {
        mountWithFetch();
        await waitFor(() => expect(screen.getByTestId("progress-entry-v1")).toBeInTheDocument());
        act(() => {
            wsHandlers[0]({
                type: "progress.entry.changed",
                data: { ...sampleEntries[0], seen: true },
            });
        });
        const card = screen.getByTestId("progress-entry-v1");
        expect(card.getAttribute("data-progress-seen")).toBe("true");
    });

    test("progress.replay replaces list and counts", async () => {
        mountWithFetch();
        await waitFor(() => expect(screen.getByTestId("progress-entry-v1")).toBeInTheDocument());
        act(() => {
            wsHandlers[0]({
                type: "progress.replay",
                data: {
                    items: [{
                        id: "r1", name: "Replayed", status: "claims_done",
                        date_str: "2026-05-12", date_ts: 1746921600000, seen: false,
                        suggested_actions: [],
                    }],
                    counts: { verified: 0, claims_done: 1, deceptive: 0, in_flight: 0 },
                },
            });
        });
        expect(screen.queryByTestId("progress-entry-v1")).toBeNull();
        expect(screen.getByTestId("progress-entry-r1")).toBeInTheDocument();
    });

    test("filter chips narrow visible entries (no page reload)", async () => {
        mountWithFetch();
        await waitFor(() => expect(screen.getByTestId("progress-entry-v1")).toBeInTheDocument());
        fireEvent.click(screen.getByTestId("progress-filter-deceptive"));
        expect(screen.queryByTestId("progress-entry-v1")).toBeNull();
        expect(screen.getByTestId("progress-entry-d1")).toBeInTheDocument();
        fireEvent.click(screen.getByTestId("progress-filter-all"));
        expect(screen.getByTestId("progress-entry-v1")).toBeInTheDocument();
    });

    test("fetch error renders ErrorState with Retry — no silent mock fallback", async () => {
        global.fetch = jest.fn(() => jsonRes({}, false, 500));
        render(React.createElement(ProgressPulse));
        await waitFor(() => expect(screen.getByText(/Progress mirror unavailable/i)).toBeInTheDocument());
        expect(screen.getByRole("button", { name: /Retry/i })).toBeInTheDocument();
    });

    test("Mark all seen POSTs /seen for each unseen entry", async () => {
        mountWithFetch();
        // wait for entries to actually populate so the button is enabled
        await waitFor(() => expect(screen.getByTestId("progress-entry-v1")).toBeInTheDocument());
        const btn = screen.getByTestId("progress-mark-all-seen");
        await waitFor(() => expect(btn).not.toBeDisabled());
        await act(async () => {
            fireEvent.click(btn);
            // allow microtasks (Promise.all) to resolve
            await Promise.resolve();
            await Promise.resolve();
        });
        const calls = global.fetch.mock.calls.map((c) => String(c[0]));
        expect(calls.some((u) => /\/api\/v2\/progress\/v1\/seen$/.test(u))).toBe(true);
        expect(calls.some((u) => /\/api\/v2\/progress\/d1\/seen$/.test(u))).toBe(true);
    });
});
