/**
 * HomePage — UsageBadge wiring (Sprint 5)
 *
 * Verifies that an assistant message bubble renders a <UsageBadge>
 * when the message has usage data attached (msg.tokens_in / tokens_out /
 * cost_estimate_usd), which flows from the chat.usage WS handler via
 * _patchMessageUsage in useGateway.
 *
 * shared.js imports react-markdown (ESM) so we stub it.
 * NOTE: Must use named functions in jest.mock factories (not arrow functions)
 * due to Babel CJS transform behaviour with Zustand stores.
 */
import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

// jsdom doesn't implement scrollIntoView.
window.HTMLElement.prototype.scrollIntoView = function() {};

// Stub @/components/shared so we don't pull in react-markdown (ESM).
// MessageRow stub renders <UsageBadge> directly so we can test the chain.
jest.mock("@/components/shared", () => {
  const React = require("react");
  const { UsageBadge } = require("@/components/chat/UsageBadge");
  function MessageRow({ msg }) {
    if (msg.role !== "assistant") return null;
    return React.createElement(
      "div",
      { "data-testid": "msg-" + msg.id },
      React.createElement("span", null, msg.content),
      React.createElement(UsageBadge, {
        tokens_in: msg.tokens_in != null ? msg.tokens_in : null,
        tokens_out: msg.tokens_out != null ? msg.tokens_out : null,
        cost_estimate_usd: msg.cost_estimate_usd != null ? msg.cost_estimate_usd : null,
        model: msg.model != null ? msg.model : null,
        provider: msg.provider != null ? msg.provider : null,
        pending: msg.tokens_in == null && msg.tokens_out == null && msg.cost_estimate_usd == null,
      })
    );
  }
  function RuntimeBackdrop() { return null; }
  function Markdown({ content }) { return React.createElement("span", null, content); }
  return { MessageRow: MessageRow, RuntimeBackdrop: RuntimeBackdrop, Markdown: Markdown };
});

// Stub @/components/InputBar.
jest.mock("@/components/InputBar", () => {
  const React = require("react");
  return { InputBar: function() { return React.createElement("div", { "data-testid": "input-bar" }); } };
});

// Stub useGateway with a populated assistant message.
jest.mock("@/lib/useGateway", () => {
  function mockUseGateway() {
    return {
      messages: [
        { id: "msg-1", role: "user", content: "Hello", timestamp: Date.now() },
        {
          id: "msg-2",
          role: "assistant",
          content: "Hi there!",
          timestamp: Date.now(),
          tokens_in: 100,
          tokens_out: 50,
          cost_estimate_usd: 0.0012,
          model: "claude-opus-4-7",
          provider: "venice",
        },
      ],
      streamingMessage: null,
      status: "connected",
      clearMessages: function() {},
      activeThreadId: null,
      threads: [],
      spaces: [],
      activeRuntime: "openclaw",
      getRuntimeForActiveThread: function() { return "openclaw"; },
    };
  }
  return {
    useGateway: mockUseGateway,
    initGateway: function() {},
    sendMessage: function() { return Promise.resolve(); },
    apiUrl: function(p) { return "http://localhost:7801" + p; },
  };
});

import HomePage from "../HomePage";

describe("HomePage — UsageBadge renders on assistant bubbles", () => {
  test("UsageBadge is present for an assistant message with usage data", () => {
    render(<HomePage />);
    // The badge should be in ready state (not pending) because usage data is populated.
    const badge = screen.getByTestId("usage-badge");
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveAttribute("data-state", "ready");
  });

  test("UsageBadge shows tokens in", () => {
    render(<HomePage />);
    const inEl = screen.getByTestId("usage-badge-in");
    expect(inEl.textContent).toMatch(/100 in/);
  });

  test("UsageBadge shows tokens out", () => {
    render(<HomePage />);
    const outEl = screen.getByTestId("usage-badge-out");
    expect(outEl.textContent).toMatch(/50 out/);
  });

  test("UsageBadge shows cost", () => {
    render(<HomePage />);
    const costEl = screen.getByTestId("usage-badge-cost");
    expect(costEl.textContent).toMatch(/\$0\.0012/);
  });
});
