/**
 * Phase 0.2 — SchemaForm WS-sync race helpers (unit tests)
 *
 * These tests cover the pure logic that prevents a remote WebSocket push
 * from clobbering a field the user is currently typing into. The helpers
 * are exported from SchemaForm.js so we can exercise them directly without
 * needing the @rjsf/core ESM module under Jest.
 *
 * Acceptance §6 (handoff) covered here:
 *   - "WS `config.set` from another tab → form re-syncs without losing
 *      in-flight unsaved edits in other fields"
 *
 * The full <SchemaForm> render-level behaviour (debounce timing,
 * additionalProperties UI, validation) is verified live against the
 * running backend via the /dev/schema-form-demo page (existing demo
 * route) and via `npm run build` succeeding.
 */

// Import the pure helpers — no @rjsf/core path is hit because we never
// instantiate the SchemaForm component here.
const { diffPaths, mergeRemoteIntoLocal } =
  require("../wsRaceHelpers");

// ─── diffPaths ────────────────────────────────────────────────────────────────
describe("diffPaths", () => {
  test("returns [] for identical primitives", () => {
    expect(diffPaths(1, 1)).toEqual([]);
    expect(diffPaths("a", "a")).toEqual([]);
    expect(diffPaths(null, null)).toEqual([]);
  });

  test("returns [''] for primitive root change", () => {
    expect(diffPaths(1, 2)).toEqual([""]);
    expect(diffPaths("a", "b")).toEqual([""]);
  });

  test("returns dot-paths for object changes", () => {
    expect(diffPaths({ a: 1, b: 2 }, { a: 1, b: 3 })).toEqual(["b"]);
  });

  test("returns nested dot-paths", () => {
    expect(diffPaths({ a: { b: { c: 1 } } }, { a: { b: { c: 2 } } }))
      .toEqual(["a.b.c"]);
  });

  test("captures added keys", () => {
    expect(diffPaths({ a: 1 }, { a: 1, b: 2 })).toEqual(["b"]);
  });

  test("captures removed keys", () => {
    expect(diffPaths({ a: 1, b: 2 }, { a: 1 })).toEqual(["b"]);
  });

  test("does not duplicate paths for unchanged subtrees", () => {
    const paths = diffPaths(
      { unchanged: { x: 1 }, changed: { y: 1 } },
      { unchanged: { x: 1 }, changed: { y: 2 } }
    );
    expect(paths).toEqual(["changed.y"]);
  });
});

// ─── mergeRemoteIntoLocal ─────────────────────────────────────────────────────
describe("mergeRemoteIntoLocal", () => {
  test("returns remote when no dirty paths", () => {
    expect(mergeRemoteIntoLocal({ a: 1 }, { a: 2 }, new Set())).toEqual({ a: 2 });
  });

  test("preserves local for a dirty top-level key, accepts remote for clean keys", () => {
    const local = { a: "local-edit", b: 1 };
    const remote = { a: "remote-value", b: 99 };
    const result = mergeRemoteIntoLocal(local, remote, new Set(["a"]));
    expect(result).toEqual({ a: "local-edit", b: 99 });
  });

  test("preserves local for a nested dirty path", () => {
    const local = { user: { name: "Meg-typing", email: "old@x" }, theme: "dark" };
    const remote = { user: { name: "remote-name", email: "new@x" }, theme: "light" };
    const result = mergeRemoteIntoLocal(local, remote, new Set(["user.name"]));
    expect(result.user.name).toBe("Meg-typing");
    expect(result.user.email).toBe("new@x"); // not dirty → remote wins
    expect(result.theme).toBe("light");      // not dirty → remote wins
  });

  test("entire root dirty pins local", () => {
    expect(mergeRemoteIntoLocal("typing", "remote", new Set([""]))).toBe("typing");
  });

  test("primitive remote with no top-level dirty path is accepted", () => {
    expect(mergeRemoteIntoLocal(5, 10, new Set(["other.path"]))).toBe(10);
  });

  test("multiple dirty paths each pin their local subtree", () => {
    const local = { a: "A-local", b: { c: "C-local", d: "D-local" }, e: 1 };
    const remote = { a: "A-remote", b: { c: "C-remote", d: "D-remote" }, e: 99 };
    const result = mergeRemoteIntoLocal(local, remote, new Set(["a", "b.c"]));
    expect(result.a).toBe("A-local");
    expect(result.b.c).toBe("C-local");
    expect(result.b.d).toBe("D-remote"); // clean — remote wins
    expect(result.e).toBe(99);            // clean — remote wins
  });

  test("dirty path in a key the remote does not have removes it from output", () => {
    const local = { a: "still-typing" };
    const remote = {}; // remote does not have this key (e.g. user is creating it)
    const result = mergeRemoteIntoLocal(local, remote, new Set(["a"]));
    expect(result.a).toBe("still-typing");
  });
});
