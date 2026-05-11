/**
 * Phase 0.3 — Bind atomic binding tests
 *
 * We mock @/hooks/useConfigBus and @/components/schema-form to avoid
 * pulling @rjsf/core (ESM under Jest) and to assert exactly what the
 * binding hands down.
 */

jest.mock("@/components/schema-form", () => ({
  __esModule: true,
  SchemaForm: (props) => {
    const React = require("react");
    return React.createElement(
      "div",
      {
        "data-testid": props.dataTestid || "mock-schema-form",
        "data-schema-title": props.schema?.title,
        "data-ui-widget": props.uiSchema?.["ui:widget"],
        "data-readonly": String(!!props.readOnly),
      },
      "MOCK_FORM"
    );
  },
}));

jest.mock("@/hooks/useConfigBus", () => ({
  useConfigSchema: jest.fn(),
  useConfigValue: jest.fn(),
}));

const { render, screen } = require("@testing-library/react");
const React = require("react");
const { Bind } = require("../Bind");
const { useConfigSchema, useConfigValue } = require("@/hooks/useConfigBus");

beforeEach(() => {
  useConfigSchema.mockReset();
  useConfigValue.mockReset();
});

describe("<Bind>", () => {
  test("renders skeleton while loading", () => {
    useConfigSchema.mockReturnValue({ schema: null, ui: null, loading: true, error: null });
    useConfigValue.mockReturnValue({ value: undefined, loading: true, error: null, set: jest.fn(), reload: jest.fn() });
    render(<Bind to="ui.theme.default" />);
    expect(screen.getByTestId("bind-ui.theme.default")).toBeInTheDocument();
  });

  test("renders schema form once schema and value resolve", () => {
    useConfigSchema.mockReturnValue({
      schema: { type: "string", title: "Theme" },
      ui: null, loading: false, error: null,
    });
    useConfigValue.mockReturnValue({
      value: "dark", version: 1, loading: false, error: null,
      set: jest.fn(), reload: jest.fn(),
    });
    render(<Bind to="ui.theme.default" />);
    const form = screen.getByTestId("bind-ui.theme.default-form");
    expect(form).toBeInTheDocument();
    expect(form).toHaveAttribute("data-schema-title", "Theme");
  });

  test("widget prop overrides ui:widget on uiSchema", () => {
    useConfigSchema.mockReturnValue({
      schema: { type: "string", title: "Theme" },
      ui: null, loading: false, error: null,
    });
    useConfigValue.mockReturnValue({
      value: "dark", loading: false, error: null,
      set: jest.fn(), reload: jest.fn(),
    });
    render(<Bind to="ui.theme.default" widget="pills" />);
    const form = screen.getByTestId("bind-ui.theme.default-form");
    expect(form).toHaveAttribute("data-ui-widget", "pills");
  });

  test("falls back to defaultSchema when backend returns no schema (Principle 1.5)", () => {
    useConfigSchema.mockReturnValue({ schema: null, ui: null, loading: false, error: null });
    useConfigValue.mockReturnValue({
      value: undefined, loading: false, error: null,
      set: jest.fn(), reload: jest.fn(),
    });
    render(
      <Bind
        to="feature.flags.test_dogfood"
        defaultSchema={{ type: "boolean", title: "Test Dogfood" }}
      />
    );
    const form = screen.getByTestId("bind-feature.flags.test_dogfood-form");
    expect(form).toHaveAttribute("data-schema-title", "Test Dogfood");
  });

  test("uses custom dataTestid when provided", () => {
    useConfigSchema.mockReturnValue({ schema: { type: "boolean" }, ui: null, loading: false, error: null });
    useConfigValue.mockReturnValue({ value: false, loading: false, error: null, set: jest.fn(), reload: jest.fn() });
    render(<Bind to="x.y" dataTestid="custom-bind-id" />);
    expect(screen.getByTestId("custom-bind-id")).toBeInTheDocument();
    expect(screen.getByTestId("custom-bind-id-form")).toBeInTheDocument();
  });

  test("renders error state with retry when both schema and value fail", () => {
    useConfigSchema.mockReturnValue({ schema: null, ui: null, loading: false, error: "boom" });
    useConfigValue.mockReturnValue({
      value: undefined, loading: false, error: "boom",
      set: jest.fn(), reload: jest.fn(),
    });
    render(<Bind to="missing.key" />);
    expect(screen.getByTestId("bind-missing.key")).toBeInTheDocument();
    expect(screen.getByText("Retry")).toBeInTheDocument();
  });

  test("readOnly prop is passed to SchemaForm", () => {
    useConfigSchema.mockReturnValue({ schema: { type: "string" }, ui: null, loading: false, error: null });
    useConfigValue.mockReturnValue({ value: "x", loading: false, error: null, set: jest.fn(), reload: jest.fn() });
    render(<Bind to="some.key" readOnly />);
    const form = screen.getByTestId("bind-some.key-form");
    expect(form).toHaveAttribute("data-readonly", "true");
  });
});
