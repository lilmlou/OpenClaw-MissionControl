/**
 * Phase 0.3 — BindStatus tests
 *
 * Mocks @/hooks/useConfigBus to control the live config value, then asserts
 * the resolved Pill tone and label for each input shape.
 */

jest.mock("@/hooks/useConfigBus", () => ({
  useConfigValue: jest.fn(),
}));

const { render, screen } = require("@testing-library/react");
const React = require("react");
const { BindStatus, resolveStatus } = require("../BindStatus");
const { useConfigValue } = require("@/hooks/useConfigBus");

beforeEach(() => {
  useConfigValue.mockReset();
});

function mockValue(value, extra = {}) {
  useConfigValue.mockReturnValue({
    value,
    loading: false,
    error: null,
    set: jest.fn(),
    reload: jest.fn(),
    ...extra,
  });
}

describe("resolveStatus()", () => {
  test("boolean true → ok / Online", () => {
    expect(resolveStatus(true)).toEqual({ tone: "ok", label: "Online" });
  });
  test("boolean false → err / Offline", () => {
    expect(resolveStatus(false)).toEqual({ tone: "err", label: "Offline" });
  });
  test("string 'online' → ok", () => {
    expect(resolveStatus("online").tone).toBe("ok");
  });
  test("string 'offline' → err", () => {
    expect(resolveStatus("offline").tone).toBe("err");
  });
  test("string 'degraded' → warn", () => {
    expect(resolveStatus("degraded").tone).toBe("warn");
  });
  test("unknown string → neutral with original label", () => {
    expect(resolveStatus("frobnicating")).toEqual({
      tone: "neutral",
      label: "frobnicating",
    });
  });
  test("null/undefined → neutral em-dash", () => {
    expect(resolveStatus(null).tone).toBe("neutral");
    expect(resolveStatus(undefined).tone).toBe("neutral");
  });
  test("custom mapping wins over defaults", () => {
    expect(
      resolveStatus("foo", { foo: { tone: "warn", label: "Foo!" } })
    ).toEqual({ tone: "warn", label: "Foo!" });
  });
});

describe("<BindStatus>", () => {
  test("renders Online pill for boolean true", () => {
    mockValue(true);
    render(<BindStatus to="services.gateway.up" />);
    const el = screen.getByTestId("bind-status-services.gateway.up");
    expect(el).toBeInTheDocument();
    expect(el.textContent).toBe("Online");
    // ok tone uses var(--mc-ok) class fragment
    expect(el.className).toMatch(/mc-ok/);
  });

  test("renders Offline pill for boolean false", () => {
    mockValue(false);
    render(<BindStatus to="services.gateway.up" />);
    const el = screen.getByTestId("bind-status-services.gateway.up");
    expect(el.textContent).toBe("Offline");
    expect(el.className).toMatch(/mc-err/);
  });

  test("string 'online' → ok tone", () => {
    mockValue("online");
    render(<BindStatus to="services.gateway.status" />);
    const el = screen.getByTestId("bind-status-services.gateway.status");
    expect(el.textContent).toBe("Online");
    expect(el.className).toMatch(/mc-ok/);
  });

  test("string 'degraded' → warn tone", () => {
    mockValue("degraded");
    render(<BindStatus to="services.gateway.status" />);
    const el = screen.getByTestId("bind-status-services.gateway.status");
    expect(el.textContent).toBe("Degraded");
    expect(el.className).toMatch(/mc-warn/);
  });

  test("string 'offline' → err tone", () => {
    mockValue("offline");
    render(<BindStatus to="services.gateway.status" />);
    const el = screen.getByTestId("bind-status-services.gateway.status");
    expect(el.textContent).toBe("Offline");
    expect(el.className).toMatch(/mc-err/);
  });

  test("unknown value → neutral pill", () => {
    mockValue("weird-state");
    render(<BindStatus to="x.y" />);
    const el = screen.getByTestId("bind-status-x.y");
    expect(el.textContent).toBe("weird-state");
    // neutral uses bg-2/line tokens
    expect(el.className).toMatch(/mc-fg-1|mc-bg-2|mc-line/);
  });

  test("loading state with no value renders skeleton wrapper", () => {
    useConfigValue.mockReturnValue({
      value: undefined,
      loading: true,
      error: null,
      set: jest.fn(),
      reload: jest.fn(),
    });
    render(<BindStatus to="x.y" />);
    expect(screen.getByTestId("bind-status-x.y")).toBeInTheDocument();
  });

  test("custom dataTestid is honoured", () => {
    mockValue(true);
    render(<BindStatus to="x.y" dataTestid="my-pill" />);
    expect(screen.getByTestId("my-pill")).toBeInTheDocument();
  });
});
