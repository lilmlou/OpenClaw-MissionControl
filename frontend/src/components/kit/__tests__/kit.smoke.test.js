// MC-CLAW kit — smoke tests
// Verifies every kit export renders without throwing.
import React from "react";
import { render } from "@testing-library/react";

import {
    Button,
    IconButton,
    Card,
    HeroCard,
    CardHeader,
    Pill,
    Tag,
    Indicator,
    Skeleton,
    SkeletonText,
    SkeletonCard,
    EmptyState,
    ErrorState,
    Toggle,
    Tabs,
    Segmented,
    PageShell,
    PageHeader,
    PageContent,
    PageMeta,
    PageError,
    PageLoading,
    cn,
} from "../index";

test("cn merges class names", () => {
    expect(cn("a", false && "b", "c")).toBe("a c");
});

test("Button renders all variants", () => {
    ["primary", "secondary", "ghost", "danger"].forEach((variant) => {
        const { unmount } = render(<Button variant={variant}>{variant}</Button>);
        unmount();
    });
});

test("IconButton renders with label", () => {
    render(<IconButton label="Close" icon={<span>x</span>} />);
});

test("Card variants render", () => {
    render(
        <>
            <Card>card</Card>
            <HeroCard>hero</HeroCard>
            <Card>
                <CardHeader title="t" subtitle="s" />
            </Card>
        </>,
    );
});

test("Pill tones render", () => {
    ["neutral", "accent", "ok", "warn", "err", "info"].forEach((tone) => {
        const { unmount } = render(<Pill tone={tone}>{tone}</Pill>);
        unmount();
    });
});

test("Tag with onRemove", () => {
    render(<Tag onRemove={() => {}}>tag</Tag>);
});

test("Indicator renders with pulse + label", () => {
    render(<Indicator tone="ok" pulse label="Online" />);
});

test("Skeleton primitives render", () => {
    render(
        <>
            <Skeleton width={100} height={20} />
            <SkeletonText lines={2} />
            <SkeletonCard />
        </>,
    );
});

test("EmptyState renders with action", () => {
    render(<EmptyState title="Nothing here" description="No data" action={<Button>Add</Button>} />);
});

test("ErrorState renders with fix buttons", () => {
    render(
        <ErrorState
            title="Boom"
            description="Server unreachable"
            fix={[{ label: "Retry", onClick: () => {} }]}
        />,
    );
});

test("Toggle renders both states", () => {
    render(
        <>
            <Toggle checked={false} />
            <Toggle checked={true} label="On" description="hello" />
        </>,
    );
});

test("Tabs and Segmented render", () => {
    render(
        <>
            <Tabs
                value="a"
                onChange={() => {}}
                items={[
                    { value: "a", label: "A" },
                    { value: "b", label: "B", badge: 3 },
                ]}
            />
            <Segmented
                value="x"
                onChange={() => {}}
                items={[
                    { value: "x", label: "X" },
                    { value: "y", label: "Y" },
                ]}
            />
        </>,
    );
});

test("PageShell composition renders", () => {
    render(
        <PageShell>
            <PageHeader title="Test" subtitle="sub" />
            <PageError>
                <PageLoading loading={false}>
                    <PageContent>
                        <Card>body</Card>
                    </PageContent>
                </PageLoading>
            </PageError>
            <PageMeta lastUpdated={Date.now()} dataSource="test" />
        </PageShell>,
    );
});

test("PageError catches thrown errors and renders fallback", () => {
    const Boom = () => {
        throw new Error("boom");
    };
    // suppress error log noise
    const orig = console.error;
    console.error = () => {};
    render(
        <PageError>
            <Boom />
        </PageError>,
    );
    console.error = orig;
});
