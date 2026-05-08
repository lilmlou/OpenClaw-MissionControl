// MC-CLAW Design System v2 — kit utilities
// See docs/handoffs/DESIGN_SYSTEM_V2.md

/**
 * Concatenate class names, filtering out falsy values.
 * Lightweight alternative to clsx/classnames — no dependency.
 *
 * @param {...(string|null|undefined|false)} args
 * @returns {string}
 */
export function cn(...args) {
    return args.filter(Boolean).join(" ");
}

/**
 * Prefix all kit data-testids consistently so tests can find them.
 */
export const tid = (name) => ({ "data-testid": `kit-${name}` });
