/**
 * MemoryPage shell tests — confirms the route renders the locked-theme chrome,
 * default scope is "global", and the empty state advertises its wiring target
 * so FE Wiring has a stable anchor. No mock fact rows are injected by the
 * shell — that is intentional and asserted below.
 */

import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import MemoryPage from "../MemoryPage";

describe("<MemoryPage> — Phase 6.D shell", () => {
  test("renders page title", () => {
    render(<MemoryPage />);
    expect(screen.getByRole("heading", { name: /memory/i })).toBeInTheDocument();
  });

  test("renders all four scope chips", () => {
    render(<MemoryPage />);
    expect(screen.getByTestId("memory-scope-global")).toBeInTheDocument();
    expect(screen.getByTestId("memory-scope-project")).toBeInTheDocument();
    expect(screen.getByTestId("memory-scope-thread")).toBeInTheDocument();
    expect(screen.getByTestId("memory-scope-skill")).toBeInTheDocument();
  });

  test("default scope is global and shows empty state", () => {
    render(<MemoryPage />);
    const empty = screen.getByTestId("memory-empty-state");
    expect(empty).toBeInTheDocument();
    expect(empty).toHaveTextContent(/global/i);
  });

  test("switching scope updates the empty state copy", () => {
    render(<MemoryPage />);
    fireEvent.click(screen.getByTestId("memory-scope-skill"));
    expect(screen.getByTestId("memory-empty-state")).toHaveTextContent(/skill/i);
  });

  test("composer is disabled until wiring", () => {
    render(<MemoryPage />);
    expect(screen.getByTestId("memory-composer")).toBeInTheDocument();
    expect(screen.getByTestId("memory-add-btn")).toBeDisabled();
  });

  test("search input is rendered", () => {
    render(<MemoryPage />);
    expect(screen.getByTestId("memory-search")).toBeInTheDocument();
  });
});
