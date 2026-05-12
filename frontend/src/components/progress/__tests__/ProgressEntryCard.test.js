// VM-D2 Progress Pulse — ProgressEntryCard tests
//
// Mocks BindAction so we don't pull live actions registry; asserts the
// card renders the right status pill, Fix buttons for deceptive/claims_done,
// and that body_md is ONLY inside an opt-in <details> drawer (Phase 0 §4).

jest.mock("@/components/bind/BindAction", () => ({
    __esModule: true,
    BindAction: (props) => {
        const React = require("react");
        return React.createElement(
            "button",
            {
                "data-testid": props.dataTestid || `bind-action-${props.to}`,
                "data-bind-to": props.to,
                "data-bind-args": JSON.stringify(props.args || {}),
                type: "button",
            },
            props.label || props.to,
        );
    },
}));

const { render, screen } = require("@testing-library/react");
const React = require("react");
const { ProgressEntryCard } = require("../ProgressEntryCard");

const baseEntry = {
    id: "abc123",
    name: "VM-D2 Progress Pulse — Frontend",
    status: "verified",
    date_str: "2026-05-12",
    date_ts: 1746921600000,
    repo_path: "/Volumes/MC/MissionControl",
    cron_run_id: "deadbeef",
    seen: false,
    body_md: "## detail body\nshould not be primary surface",
    suggested_actions: [],
};

const el = (props) => React.createElement(ProgressEntryCard, props);

describe("<ProgressEntryCard>", () => {
    test("renders status pill, name, date and seen control for verified entry", () => {
        render(el({ entry: baseEntry }));
        expect(screen.getByTestId("progress-entry-abc123")).toBeInTheDocument();
        expect(screen.getByTestId("progress-status-pill-verified")).toHaveTextContent("VERIFIED");
        expect(screen.getByText(/VM-D2 Progress Pulse/)).toBeInTheDocument();
        expect(screen.getByTestId("progress-mark-seen-abc123")).toBeInTheDocument();
    });

    test("seen=true dims card (opacity 0.6) and hides mark-seen button", () => {
        const entry = { ...baseEntry, seen: true };
        render(el({ entry }));
        const card = screen.getByTestId("progress-entry-abc123");
        expect(card.style.opacity).toBe("0.6");
        expect(screen.queryByTestId("progress-mark-seen-abc123")).toBeNull();
    });

    test("deceptive entry renders Fix buttons from suggested_actions", () => {
        const entry = {
            ...baseEntry,
            id: "dec1",
            status: "deceptive",
            suggested_actions: [
                { label: "Open PROGRESS.md", action: "files.open", args: { path: "/p" } },
                { label: "Re-run planner",   action: "cron.run_now",  args: { id: "x" } },
            ],
        };
        render(el({ entry }));
        expect(screen.getByTestId("progress-status-pill-deceptive")).toBeInTheDocument();
        expect(screen.getByTestId("progress-fix-dec1-0")).toHaveAttribute("data-bind-to", "files.open");
        expect(screen.getByTestId("progress-fix-dec1-1")).toHaveAttribute("data-bind-to", "cron.run_now");
    });

    test("deceptive entry with NO suggested_actions falls back to Re-dispatch button", () => {
        const entry = { ...baseEntry, id: "dec2", status: "deceptive", suggested_actions: [] };
        render(el({ entry }));
        const redispatch = screen.getByTestId("progress-redispatch-dec2");
        expect(redispatch).toHaveAttribute("data-bind-to", "agents.redispatch");
    });

    test("claims_done renders Fix buttons when actions are present", () => {
        const entry = {
            ...baseEntry,
            id: "cd1",
            status: "claims_done",
            suggested_actions: [{ label: "Mark verified", action: "progress.verify", args: { id: "cd1" } }],
        };
        render(el({ entry }));
        expect(screen.getByTestId("progress-fix-cd1-0")).toHaveAttribute("data-bind-to", "progress.verify");
    });

    test("body_md only appears inside opt-in <details> drawer (not primary UI)", () => {
        render(el({ entry: baseEntry }));
        const details = screen.getByTestId("progress-body-details-abc123");
        expect(details.tagName.toLowerCase()).toBe("details");
        // The <details> element is collapsed by default — verify body
        // text is reachable but the wrapper is a details, not raw <p>.
        expect(details.querySelector("pre")).not.toBeNull();
        expect(details.open).toBe(false);
    });

    test("never renders banned literal 'DONE' as status label", () => {
        const entry = { ...baseEntry, status: "done" };
        render(el({ entry }));
        expect(screen.queryByText(/^DONE$/)).toBeNull();
        expect(screen.getByTestId("progress-status-pill-done")).toHaveTextContent("UNKNOWN");
    });

    test("returns null for malformed entry", () => {
        const { container } = render(el({ entry: { name: "no id" } }));
        expect(container.firstChild).toBeNull();
    });
});
