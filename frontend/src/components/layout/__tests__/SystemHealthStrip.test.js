/**
 * SystemHealthStrip — shell-level smoke tests (mc-fe-builder).
 *
 * Confirms structural shell behaviour:
 *   - renders null when no canonical service has a known status
 *   - renders strip with one dot per canonical service when status is present
 *   - links to /system
 *
 * Live wiring tests (WS frame subscription, port poll) are FE Wiring's lane.
 */
import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

// Mock the gateway store BEFORE importing the component.
jest.mock("@/lib/useGateway", () => {
  let mockState = { systemServices: null };
  const useGateway = (selector) =>
    typeof selector === "function" ? selector(mockState) : mockState;
  useGateway.__setState = (next) => {
    mockState = { ...mockState, ...next };
  };
  return { useGateway };
});

const { useGateway } = require("@/lib/useGateway");
const { SystemHealthStrip } = require("../SystemHealthStrip");

function renderAt(path = "/") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <SystemHealthStrip />
    </MemoryRouter>,
  );
}

describe("<SystemHealthStrip> (shell)", () => {
  beforeEach(() => {
    useGateway.__setState({ systemServices: null });
  });

  test("renders nothing when no service status is known", () => {
    const { container } = renderAt("/");
    expect(
      container.querySelector('[data-testid="system-health-strip"]'),
    ).toBeNull();
  });

  test("renders strip with at least one canonical row once a status is known", () => {
    useGateway.__setState({
      systemServices: {
        fastapi: { status: "connected" },
        gateway: { status: "connected" },
        ws_brain: { status: "loading" },
        tailscale: { status: "online" },
      },
    });
    renderAt("/");
    expect(screen.getByTestId("system-health-strip")).toBeInTheDocument();
    expect(screen.getByTestId("system-health-strip-fastapi")).toBeInTheDocument();
    expect(screen.getByTestId("system-health-strip-gateway")).toBeInTheDocument();
    expect(screen.getByTestId("system-health-strip-ws_brain")).toBeInTheDocument();
    expect(screen.getByTestId("system-health-strip-tailscale")).toBeInTheDocument();
  });

  test("hidden on /system to avoid duplication", () => {
    useGateway.__setState({
      systemServices: { fastapi: "connected" },
    });
    const { container } = renderAt("/system");
    expect(
      container.querySelector('[data-testid="system-health-strip"]'),
    ).toBeNull();
  });

  test("links to /system when rendered", () => {
    useGateway.__setState({
      systemServices: { fastapi: "connected" },
    });
    renderAt("/");
    const link = screen.getByTestId("system-health-strip");
    expect(link.getAttribute("href")).toBe("/system");
  });
});
