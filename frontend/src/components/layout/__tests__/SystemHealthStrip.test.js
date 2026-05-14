/**
 * SystemHealthStrip — shell-level smoke tests (mc-fe-builder).
 *
 * Confirms structural shell behaviour:
 *   - renders null when no canonical service has a known status
 *   - renders strip with one dot per canonical service when status is present
 *   - hidden on /system to avoid duplication
 *   - links to /system
 *
 * Live wiring tests (WS frame subscription, port poll) are FE Wiring's lane.
 *
 * NOTE: The global __mocks__/react-router-dom.js hard-codes useLocation to
 * return pathname "/". This file overrides that mock per-test using
 * jest.spyOn so the "hidden on /system" behaviour can be verified.
 */
import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

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

// Import the react-router-dom mock (global __mocks__ or auto-mock) THEN spy on useLocation.
const rrdom = require("react-router-dom");
const { useGateway } = require("@/lib/useGateway");
const { SystemHealthStrip } = require("../SystemHealthStrip");

describe("<SystemHealthStrip> (shell)", () => {
  let locationSpy;

  beforeEach(() => {
    useGateway.__setState({ systemServices: null });
    // Reset useLocation to the default (pathname "/") before each test.
    locationSpy = jest
      .spyOn(rrdom, "useLocation")
      .mockReturnValue({ pathname: "/", search: "", hash: "", state: null, key: "default" });
  });

  afterEach(() => {
    locationSpy.mockRestore();
  });

  test("renders nothing when no service status is known", () => {
    const { container } = render(<SystemHealthStrip />);
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
    render(<SystemHealthStrip />);
    expect(screen.getByTestId("system-health-strip")).toBeInTheDocument();
    expect(screen.getByTestId("system-health-strip-fastapi")).toBeInTheDocument();
    expect(screen.getByTestId("system-health-strip-gateway")).toBeInTheDocument();
    expect(screen.getByTestId("system-health-strip-ws_brain")).toBeInTheDocument();
    expect(screen.getByTestId("system-health-strip-tailscale")).toBeInTheDocument();
  });

  test("hidden on /system to avoid duplication", () => {
    // Override useLocation to return /system for this specific test.
    locationSpy.mockReturnValue({ pathname: "/system", search: "", hash: "", state: null, key: "system" });
    useGateway.__setState({
      systemServices: { fastapi: "connected" },
    });
    const { container } = render(<SystemHealthStrip />);
    expect(
      container.querySelector('[data-testid="system-health-strip"]'),
    ).toBeNull();
  });

  test("links to /system when rendered", () => {
    useGateway.__setState({
      systemServices: { fastapi: "connected" },
    });
    render(<SystemHealthStrip />);
    const link = screen.getByTestId("system-health-strip");
    expect(link.getAttribute("href")).toBe("/system");
  });
});
