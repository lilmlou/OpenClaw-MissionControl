/**
 * Phase 0.2 — WS-sync race helpers
 *
 * Pure utilities used by <SchemaForm> to merge a remote WebSocket push
 * (config.set from another tab) into the local form state without
 * clobbering fields the user is currently typing into.
 *
 * These are split out of SchemaForm.js so they can be unit-tested
 * without pulling in the @rjsf/core ESM module under Jest.
 */

// Compute the dot-paths that differ between two values. Used so we can record
// exactly which fields the user is currently editing, then merge remote pushes
// into local state without clobbering them.
//
//   diffPaths({a:1, b:2}, {a:1, b:3})       → ["b"]
//   diffPaths({a:{b:1}}, {a:{b:2}})         → ["a.b"]
//   diffPaths(1, 2)                         → [""]    (root primitive change)
//
export function diffPaths(prev, next, prefix = "") {
  const out = [];
  if (prev === next) return out;
  const aIsObj = prev && typeof prev === "object" && !Array.isArray(prev);
  const bIsObj = next && typeof next === "object" && !Array.isArray(next);
  if (!aIsObj || !bIsObj) {
    // Primitive (or array) change at this level — record this path.
    if (prefix) out.push(prefix);
    else out.push("");
    return out;
  }
  const keys = new Set([...Object.keys(prev || {}), ...Object.keys(next || {})]);
  for (const k of keys) {
    const path = prefix ? `${prefix}.${k}` : k;
    if (prev?.[k] !== next?.[k]) {
      out.push(...diffPaths(prev?.[k], next?.[k], path));
    }
  }
  return out;
}

// Merge a remote value into the local form data, but skip every dirty path.
// dirtyPaths is a Set of dot-paths the user is mid-edit on.
//
//   local  = { a: "typing", b: 1 }
//   remote = { a: "remote", b: 99 }
//   dirty  = Set(["a"])
//   →        { a: "typing", b: 99 }
//
export function mergeRemoteIntoLocal(local, remote, dirtyPaths) {
  if (!dirtyPaths || dirtyPaths.size === 0) return remote;
  // If any dirty path is the empty string, the entire root is being edited.
  if (dirtyPaths.has("")) return local;
  const aIsObj = local && typeof local === "object" && !Array.isArray(local);
  const bIsObj = remote && typeof remote === "object" && !Array.isArray(remote);
  if (!aIsObj || !bIsObj) {
    // Primitive at root, no dirty top-level path — accept remote.
    return remote;
  }
  const out = { ...remote };
  // For each dirty path, walk down and pin the local subtree at that key.
  for (const path of dirtyPaths) {
    const parts = path.split(".");
    let localCursor = local;
    let outCursor = out;
    for (let i = 0; i < parts.length; i++) {
      const k = parts[i];
      if (i === parts.length - 1) {
        outCursor[k] = localCursor?.[k];
      } else {
        if (!outCursor[k] || typeof outCursor[k] !== "object") outCursor[k] = { ...(outCursor[k] || {}) };
        else outCursor[k] = { ...outCursor[k] };
        outCursor = outCursor[k];
        localCursor = localCursor?.[k];
        if (!localCursor) break;
      }
    }
  }
  return out;
}
