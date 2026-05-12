// VM-D2 Progress Pulse — ProgressStatusPill tests
const { render, screen } = require("@testing-library/react");
const React = require("react");
const { ProgressStatusPill, PROGRESS_STATUS_TONE } = require("../ProgressStatusPill");

const el = (props) => React.createElement(ProgressStatusPill, props);

describe("<ProgressStatusPill>", () => {
    test.each([
        ["verified",    "ok",      "VERIFIED"],
        ["claims_done", "warn",    "CLAIMS DONE"],
        ["deceptive",   "err",     "DECEPTIVE"],
        ["in_flight",   "info",    "IN FLIGHT"],
        ["unknown",     "neutral", "UNKNOWN"],
    ])("renders %s as %s pill with label %s", (status, tone, label) => {
        render(el({ status }));
        const pill = screen.getByTestId(`progress-status-pill-${status}`);
        expect(pill).toBeInTheDocument();
        expect(pill).toHaveTextContent(label);
        expect(PROGRESS_STATUS_TONE[status]).toBe(tone);
    });

    test("falls back to unknown for unrecognised status (including banned 'done')", () => {
        render(el({ status: "done" }));
        // banned literal must NOT render
        expect(screen.queryByText(/^DONE$/)).toBeNull();
        expect(screen.getByTestId("progress-status-pill-done")).toHaveTextContent("UNKNOWN");
    });

    test("missing status renders unknown pill", () => {
        render(el({}));
        expect(screen.getByTestId("progress-status-pill-unknown")).toBeInTheDocument();
    });
});
