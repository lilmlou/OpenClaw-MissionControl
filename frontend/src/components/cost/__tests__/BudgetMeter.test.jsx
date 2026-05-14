import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { BudgetMeter } from "../BudgetMeter";

describe("BudgetMeter (Phase F1 shell)", () => {
    test("renders unset state when no budget provided", () => {
        render(<BudgetMeter spent={12.34} />);
        const root = screen.getByTestId("budget-meter");
        expect(root).toBeInTheDocument();
        expect(root).toHaveAttribute("data-state", "unset");
        expect(root).toHaveAttribute("data-status", "neutral");
        expect(screen.getByTestId("budget-meter-cap").textContent).toMatch(/not set/i);
        expect(screen.getByTestId("budget-meter-status").textContent).toMatch(/no budget/i);
    });

    test("renders ok state when spend is well under budget", () => {
        render(<BudgetMeter period="month" spent={10} budget={100} />);
        const root = screen.getByTestId("budget-meter");
        expect(root).toHaveAttribute("data-state", "configured");
        expect(root).toHaveAttribute("data-status", "ok");
        expect(screen.getByTestId("budget-meter-pct").textContent).toMatch(/10/);
        expect(screen.getByTestId("budget-meter-status").textContent).toMatch(/within budget/i);
    });

    test("renders warn state when spend is past warnAt threshold", () => {
        render(<BudgetMeter spent={85} budget={100} warnAt={0.8} />);
        const root = screen.getByTestId("budget-meter");
        expect(root).toHaveAttribute("data-status", "warn");
        expect(screen.getByTestId("budget-meter-status").textContent).toMatch(
            /approaching limit/i,
        );
    });

    test("renders err state when spend exceeds dangerAt threshold", () => {
        render(<BudgetMeter spent={120} budget={100} />);
        const root = screen.getByTestId("budget-meter");
        expect(root).toHaveAttribute("data-status", "err");
        expect(screen.getByTestId("budget-meter-status").textContent).toMatch(/over budget/i);
    });

    test("renders projected-over warn state when projection exceeds budget", () => {
        render(<BudgetMeter spent={50} budget={100} projected={140} />);
        const root = screen.getByTestId("budget-meter");
        expect(root).toHaveAttribute("data-status", "warn");
        expect(screen.getByTestId("budget-meter-status").textContent).toMatch(/projected over/i);
        expect(screen.getByTestId("budget-meter-projection-label").textContent).toMatch(/140/);
    });

    test("shows projection tick when projected provided alongside budget", () => {
        render(<BudgetMeter spent={20} budget={100} projected={60} />);
        expect(screen.getByTestId("budget-meter-projection")).toBeInTheDocument();
    });

    test("edit button reflects enabled/disabled based on onEdit prop", () => {
        const { rerender } = render(<BudgetMeter spent={1} budget={10} />);
        expect(screen.getByTestId("budget-meter-edit")).toBeDisabled();
        rerender(<BudgetMeter spent={1} budget={10} onEdit={() => {}} />);
        expect(screen.getByTestId("budget-meter-edit")).not.toBeDisabled();
    });

    test("displays error string when error prop provided", () => {
        render(<BudgetMeter spent={1} budget={10} error="USAGE_UNAVAILABLE" />);
        expect(screen.getByTestId("budget-meter-error").textContent).toMatch(
            /USAGE_UNAVAILABLE/,
        );
    });
});
