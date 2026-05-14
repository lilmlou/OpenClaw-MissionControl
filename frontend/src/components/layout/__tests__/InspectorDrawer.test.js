/**
 * InspectorDrawer — shell-level smoke tests (F6).
 *
 * Built by MC FE Builder. Confirms structural shell renders:
 *   - hidden when open=false
 *   - all 6 tabs (Activity / Artifacts / Files / Memory / Skills / Logs)
 *   - body shows the EmptyState for the active tab
 *   - clicking close calls onClose
 *
 * Wiring/data tests are FE Wiring's lane.
 */
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { InspectorDrawer } from "../InspectorDrawer";

describe("InspectorDrawer (F6 shell)", () => {
  test("renders nothing when open=false", () => {
    const { container } = render(
      <InspectorDrawer open={false} onClose={() => {}} taskId="t-1" taskLabel="x" />,
    );
    expect(container.querySelector('[data-testid="inspector-drawer"]')).toBeNull();
  });

  test("renders header + all 6 tabs when open", () => {
    render(
      <InspectorDrawer
        open
        onClose={() => {}}
        taskId="t-42"
        taskLabel="Sample task"
        status="running"
      />,
    );
    expect(screen.getByTestId("inspector-drawer")).toBeInTheDocument();
    expect(screen.getByText(/Sample task/)).toBeInTheDocument();
    expect(screen.getByText(/t-42/)).toBeInTheDocument();

    ["Activity", "Artifacts", "Files", "Memory", "Skills", "Logs"].forEach((label) => {
      expect(screen.getByRole("tab", { name: new RegExp(label) })).toBeInTheDocument();
    });
  });

  test("switching tabs swaps the empty-state panel", () => {
    render(
      <InspectorDrawer open onClose={() => {}} taskId="t-1" taskLabel="x" />,
    );
    expect(screen.getByTestId("inspector-drawer-panel-activity")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: /Logs/ }));
    expect(screen.getByTestId("inspector-drawer-panel-logs")).toBeInTheDocument();
  });

  test("close button fires onClose", () => {
    const onClose = jest.fn();
    render(
      <InspectorDrawer open onClose={onClose} taskId="t-1" taskLabel="x" />,
    );
    fireEvent.click(screen.getByTestId("inspector-drawer-close"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
