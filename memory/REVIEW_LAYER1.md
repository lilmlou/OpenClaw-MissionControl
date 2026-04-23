# Layer 1 Architect Review

**Reviewer:** Architect (authored `SAFETY_ARCHITECTURE.md`)
**Under review:** Executor's Layer 1 implementation (`layer1_output.ts.rtf`)
**Missing input:** The Supervisor's security audit was NOT present in the uploaded bundle — this review is against the architecture spec only. Cross-check against the audit when it's supplied.

**Bottom line:** Layer 1 is NOT ready to support Layers 2–3. There are multiple CRITICAL security bypasses where mode allow-rules skip path validation, an install-time root allowlist that was specified but never implemented, a runtime TypeError (`fs.statSync` on the `fs/promises` namespace) that would crash any file-size check in production, a return-type contract mismatch that will break Layer 2 integration, and violations of the purity invariant that the whole test strategy depends on. Blocks MUST be cleared before Layer 2 work begins.

---

## 1. Spec compliance gaps

Listed against the R-numbered requirements in `SAFETY_ARCHITECTURE.md §9`.

**R1 — `canUseTool` must be pure / no I/O. VIOLATED.**
`canUseTool` calls `validatePath` which calls `fs.realpath` and `fs.lstat`. This makes the decision engine non-deterministic (filesystem state changes between calls) and un-testable as a pure function, which is the entire point of the 95% coverage gate in R7. Path resolution must happen upstream, in the session manager, producing a pre-resolved `ToolIntent`; Layer 1 receives already-resolved paths and is pure.

**R2 — Fast paths in exact order. VIOLATED (partially).**
Order is mostly right: `allowedTools` → `ruleCache` → mode bypass. But the "mode bypass" step blends two different things: modes that short-circuit (`plan`, `dontAsk`, `bypassPermissions`) and modes that do partial evaluation (`auto` handles fs.read/fs.delete inline then falls through). `auto` should be treated as "full evaluation with preset rules," not a fast path. As written, the `auto` fs.read allow happens BEFORE path validation — see §5 security gaps.

**R3 — `ruleCache` lookup O(log n), matchers indexed by toolName. VIOLATED.**
`findMatchingRule` re-sorts the entire rules array on every call: `[...rules].sort(...)` is O(n log n) per lookup. The spec requires a pre-built index. Also, `findMatchingRule` takes `Rule[]` as input and sorts locally — there's no persistent index owned by `ruleCache`.

**R4 — Symlink reject; path-consent kind. VIOLATED.**
`validatePath` throws `Error("Path contains symlinks")`; `canUseTool`'s catch block returns `"ask"`. That's backwards on two counts:
- Symlink rejection should be a firm **deny**, not an ask. Symlinks are a known escape mechanism.
- Failures from arbitrary causes (nonexistent path, permission error, etc.) all collapse into `"ask"` — a bot could probe filesystem state by watching which errors trigger prompts.

Also, the `"ask"` return carries no `kind` — Layer 2/3 have no way to distinguish "needs path_consent dialog" from "ordinary tool prompt."

**R5 — Blocked extensions + 50 MB size. VIOLATED.**
Two bugs here.
- Blocked extensions list contains globs like `.ssh/id_*` and `Keychains/*`, but the matcher is `lowerFilePath.endsWith(ext.toLowerCase())`. `endsWith` cannot match a glob with `*`. The blocklist **silently fails** — `~/.ssh/id_rsa` is NOT blocked.
- `isWithinFileSizeLimit` uses `fs.statSync(filePath)` but the module imports `import * as fs from "fs/promises"` — `statSync` does not exist on the promises namespace. **Guaranteed runtime TypeError** the first time any file size check runs. The fallback (`return true` on error) also means size-limit failures default to permissive, which is the wrong direction for a safety layer.

**R6 — Six modes; `bypassPermissions` rejected before Layer 1. VIOLATED.**
`PermissionMode` type still includes `"bypassPermissions"`. Layer 1 "handles" it by returning `"deny"` — defense-in-depth is fine, but the *type* admits a value the spec says can't exist at this layer. Fix by narrowing the type (e.g. `Exclude<PermissionMode, "bypassPermissions">`) at the Layer 1 boundary.

**R6a — Install-time root allowlist. NOT IMPLEMENTED.**
`validateTrustedPaths(trustedPaths, rootAllowlist)` is defined in `pathBoundary.ts` but **never called** anywhere. There is no loader for `~/.openclaw/roots.json`. There is no session-creation validation. The hard boundary from §6 of the spec does not exist.

**R7 — ≥95% unit test coverage. NOT IMPLEMENTED.**
No tests at all. This is the spec's stability gate before Layer 2 work begins; it is unmet.

---

## 2. Mode implementations — per mode

| Mode | Spec intent | Implementation | Verdict |
|---|---|---|---|
| `default` | Prompt for every tool not on `allowedTools` or matched by a rule | Has rules for `shell.exec`, `net.*`, `fs.delete` = ask; unmatched tools fall through to final `"ask"` return | OK for non-fs tools; BROKEN for fs.write/fs.read when path validation is bypassed by a mode-allow in another mode (not default's fault, but the mode-rule architecture is faulty) |
| `acceptEdits` | Auto-allow writes **inside trustedPaths**; prompt for shell/net; honor global_deny | Rule: `fs.write` + matcher `{kind: "any"}` → `"allow"`. **No trustedPaths check anywhere.** The rule matches regardless of path. | **CRITICAL BUG** — writes to `/etc/hosts` are allowed in acceptEdits mode |
| `plan` | Deny all execution | Rule: `*` → `"deny"`; also the mode-bypass fast path returns `"deny"` | OK — fast path catches it first |
| `dontAsk` | Honor allow/deny rules; unmatched → allow without prompting | Fast-path `return "allow"` after ruleCache check | OK in practice. `getDontAskModeRules` returns `[]` so mode-rule-deny can't exist — if future changes add deny rules to dontAsk, they'd be silently bypassed. Reorder to check mode deny rules first. |
| `delegate` | Route tool call to the **other runtime's adapter** for approval | Rule: `*` → `"ask"` | **WRONG** — Layer 1 returns an undifferentiated `"ask"`. The session manager has no way to know this is a delegate-ask vs user-ask. Needs a `kind: "delegate"` marker on the return, plus a `delegateTo` runtime field. Spec was under-specified here; the executor guessed and guessed wrong. |
| `auto` | Allow reads + safe introspection; prompt on writes; deny destructive | Fast-path allows fs.read, denies fs.delete, falls through for fs.write/shell/net | **CRITICAL BUG** — `fs.read` is allowed with NO path validation. Bot in auto mode can read `~/.ssh/id_rsa`, `~/Library/Keychains/*`, `/etc/passwd`. |
| `bypassPermissions` | Rejected server-side; Layer 1 never sees it | Typed as valid PermissionMode; Layer 1 returns `"deny"` if seen | Type is wrong (see R6). Returning deny is reasonable belt-and-suspenders, but the architecture says the transport layer should reject with `400 unsupported_mode` before this code runs. |

**Missing behavior common to acceptEdits and auto:** the critical spec invariant is that path boundary, blocked extensions, and size limits are HARD — they must apply regardless of what the mode says. The implementation treats them as soft, conditional on the mode rule not returning "allow" first. This inverts the security model.

---

## 3. Flow correctness

Spec flow (condensed): `allowedTools → ruleCache → mode bypass → full mode eval → path/ext/size (hard) → mcp check → default`.

Code flow: `allowedTools → ruleCache → mode bypass (includes auto short-circuits) → mode rules (allow/deny returns immediately) → path/ext/size (only if not already short-circuited) → mcp check → default`.

**The divergence is architecturally serious:** path/ext/size validation in the code is AFTER the mode-rule allow/deny. That means a mode that says "allow fs.write" skips the path check entirely. In a safety layer for un-sandboxed bots, path boundary must be an unconditional post-condition on every fs tool, checked regardless of what any allow-rule said. It should sit on an earlier rail — conceptually: "even if mode says allow, verify the path is inside trustedPaths, not blocked, not oversized, before returning allow."

**Proposed flow correction:**
```
1. allowedTools         (short-circuit allow)
2. ruleCache            (cached decision)
3. bypassPermissions    (short-circuit DENY — defense-in-depth)
4. plan                 (short-circuit deny)
5. normalize input      (already done upstream — use ctx.resolvedArgs)
6. hard preconditions   (trustedPaths, blocked ext, size, mcp enabled)
                        - failure → deny (symlink, outside trust, blocked ext, oversize)
                        - new-path-consent case → "ask" with kind: "path_consent"
7. mode rules           (allow/deny/ask)
8. dontAsk fallback     (unmatched → allow)
9. default              (unmatched → "ask")
```

This keeps hard boundaries unconditional and keeps the mode rules purely about policy.

---

## 4. Architecture alignment with Layers 2 & 3

Several blockers for Layer 2/3 integration:

1. **Return type mismatch.** `CanUseTool` interface says `Promise<"allow" | "deny">`; implementation returns `"allow" | "deny" | "ask"`. Layer 2 will call this as a terminal oracle and will get surprised by `"ask"`. The intent of the interface (per spec §2.1: public Promise always resolves to terminal) requires internal looping — Layer 1 calls `requestPermission` itself when it would otherwise return `"ask"`, and awaits. The Executor didn't implement that seam. Either the interface or the implementation is wrong.

2. **No `kind` on ask.** Layer 3's UI needs to know whether to show a path-consent dialog, an ordinary prompt, or a delegate-to-other-runtime confirmation. Current implementation returns a bare `"ask"` string. Need to return a richer value, e.g.:
   ```ts
   type AskReason =
     | { kind: "prompt"; reason: "mode_default" | "mode_rule" }
     | { kind: "path_consent"; path: string }
     | { kind: "delegate"; delegateTo: Runtime };
   ```
   Without this, Layer 2 cannot construct a correct `PermissionPreview`.

3. **No rule trace / explanation.** `findMatchingRule` returns a `Rule`, but `canUseTool` throws away everything except `rule.effect`. Layer 3 explainability UI (the prerequisite for "Deny always" in phase 2) needs to show "this was allowed because rule XYZ matched." The decision must carry the matching rule's ID forward.

4. **`delegate` routing info is missing.** Layer 2 can't tell it to route to OpenClaw when Hermes is the requester. Needs to be surfaced on the return value (see #2).

5. **`SessionContext` mutability.** Passed by reference with no readonly markers. Layer 2 can mutate `ctx.mode` mid-decision concurrently. Make the shape `Readonly<SessionContext>` at the Layer 1 boundary and model mutations via session-manager commands.

6. **No `PermissionPreview` construction.** Spec §8.2 defines a `PermissionPreview` type that Layer 2 emits. Someone has to build that preview from the tool intent. The natural place is at the Layer 1 / session-manager boundary, but the Executor produced nothing toward this.

7. **Duplicated `extractPathFromInput`.** Lives in both `layer1_decisionEngine.ts` and `ruleCache.ts`. Drift risk — if one is updated to handle a new path field shape, the other silently misses it. Extract to a single `toolInputShape.ts` or move to the upstream normalizer.

---

## 5. Security gaps (architectural — likely beyond supervisor's scope)

Even without seeing the audit, here are issues that code-level security reviews often miss because they require the architectural context from the spec. Treat this as a superset; cross out what the supervisor already flagged once you have that document.

1. **Mode-allow skips path boundary (critical, see §3).** acceptEdits / auto → any-path write/read.
2. **Prefix match without boundary:** `resolvedPath.startsWith(trustedPath)` will treat `/Users/meg/Workspace_evil` as inside `/Users/meg/Workspace`. Classic prefix escape. Fix with `path.relative(trustedPath, resolvedPath)` + `!relative.startsWith('..')` + `!path.isAbsolute(relative)`, or enforce trailing separator.
3. **Symlink check is racy (TOCTOU).** `validatePath` walks the path with `lstat` per component — an attacker can replace a directory with a symlink between the decision and the execution. The resolved path from Layer 1 must be handed to the executor which opens by file descriptor, or the executor must re-verify. Right now there's no handoff.
4. **`realpath` on an attacker-controlled path leaks information** via error timing and error messages. "Path contains symlinks" tells the bot the path exists and has symlinks; "no such file" tells it the path doesn't exist. Unified generic errors only.
5. **Install-time roots not enforced.** Sessions can declare `/` as a trustedPath with no friction. §6 of the spec is currently decorative.
6. **Blocked-extension globs silently fail (critical, see R5).** `.ssh/id_*` is not a suffix. `~/.ssh/id_rsa` passes.
7. **`fs.statSync` is a runtime crash (critical, see R5).** Will blow up the first time any size check runs in production.
8. **Size-check catch-all is permissive.** `catch { return true }` means "cannot determine size → assume OK." Must be the opposite in a safety layer.
9. **Mode `delegate` doesn't actually delegate.** Returns `"ask"` to the caller. If the caller surfaces this to the *user* instead of to the other runtime, the UX and security model are both wrong — the whole point of delegate is that the human isn't the final gate.
10. **No global_deny composite matchers.** Spec had compound rules like `fs.*:/etc/**`. The matcher types are either tool-name OR path-glob OR argv-prefix, never a tool-scoped path. Rewrite as compound matchers, or enforce global_deny via a dedicated pre-mode check list.
11. **TOCTOU across Layer 1 and tool execution.** Same as #3 but broader: between `canUseTool` returning `"allow"` and `toolExecutor` running, the target path can change. The resolved, fd-handle-able path must be captured at decision time and used verbatim at execution.
12. **Rule timestamps refreshed on every call.** `getAcceptEditsModeRules()` (and peers) calls `new Date().toISOString()` on every invocation. This (a) makes `createdAt` meaningless, (b) causes GC pressure on every decision. Build mode rule tables once at module load.
13. **`allowedTools.json` is a static import.** Spec said policies reload on SIGHUP. Changes to the fast-path list require a process restart.
14. **No `toolName` input validation.** Tool names starting with `../` or containing path separators aren't normalized. Worth adding a strict `[a-z][a-z0-9.]*` regex at the Layer 1 entry.
15. **Minimatch options unspecified.** `minimatch(path, pattern)` without options defaults to `dot: false`, which means patterns do not match hidden files (`.ssh`, `.env`). If the intent is for rules to cover dotfiles, this is wrong. Must pass `{ dot: true, nocase: process.platform === 'darwin' }` at minimum.
16. **`PermissionMode` type includes `bypassPermissions` — spec says it shouldn't.** Type-level enforcement is part of the safety model; this dilutes it.
17. **`Rule.effect` type `"allow" | "deny"` plus a separate mode-rule effect of `"ask"` is silently handled via string comparison.** `modeRule.effect === "ask"` appears in the decision engine, but the `Rule` type doesn't permit `"ask"` — only `"allow" | "deny"`. The mode-rules files set `effect: "ask"` everywhere, which is a TYPE ERROR against `Rule.effect`. Either broaden the type or split mode rules into their own shape. The implementation relies on TypeScript not catching this, which likely means `strict` isn't enabled or types aren't consistent between files.
18. **No defensive cap on ruleCache size.** An attacker who can get "always" approved for a patterned matcher could grow the ruleCache unboundedly. Needs a per-session cap and LRU eviction.

---

## 6. Priority order

### P0 — SECURITY CRITICAL (block Layer 2 until fixed)

1. **Reorder flow so hard preconditions (trustedPaths, blocked ext, size, symlink-reject) run BEFORE mode allow-rules.** Mode cannot bypass path boundary. This one fix closes gaps #1, #9 (most of it), parts of #6/#7/#8.
2. **Replace `fs.statSync` with async `fs.stat` (and fix the namespace).** Runtime crash otherwise. Flip the catch-all from permissive to deny.
3. **Fix blocked-extensions matching: use glob semantics (minimatch with `{dot:true}`), not `endsWith`.** Otherwise `~/.ssh/id_rsa` is NOT blocked despite the config.
4. **Fix trustedPaths prefix-match escape.** Use `path.relative` with a `..`-check, not `startsWith`.
5. **Symlink encountered → firm `"deny"`, not `"ask"`.** And unify error messages so bots can't probe filesystem state through error shapes.
6. **Load and enforce install-time root allowlist (R6a).** Validate `trustedPaths` descend from allowlist at session creation; fail with `RootBoundaryError` otherwise. Wire `validateTrustedPaths` into the session creation path it's currently orphaned from.
7. **acceptEdits fs.write rule must be `{kind: "path_glob", pattern: "<trustedPaths>/**"}` not `{kind: "any"}`.** Auto mode fs.read likewise cannot be unconditional.

### P1 — ARCHITECTURAL INTEGRITY (block Layer 2; not immediately exploitable but contract-breaking)

8. **Make `canUseTool` pure.** Move `realpath`/`lstat` upstream into a pre-Layer-1 normalizer. Path resolution result is passed in via `ctx.resolvedArgs` (or similar). Without this, R1 and R7 (testability) cannot be met.
9. **Reconcile return type vs interface.** Either (a) interface returns `"allow" | "deny" | { ask: AskReason }` and Layer 1 surfaces asks to the caller, or (b) Layer 1 internally calls `requestPermission` and the Promise resolves to terminal. Pick one and commit — spec prefers (b). Either way, the `AskReason` shape (kind: prompt | path_consent | delegate) must exist.
10. **Attach matching rule ID to the decision return value.** Needed for Layer 3 explainability (and the phase-2 deny-remember gate).
11. **Fix the `Rule.effect` vs mode-rule `effect: "ask"` type mismatch.** Broaden `Rule.effect` to `"allow" | "deny" | "ask"` OR split into a separate `ModeRule` type. Enable strict TypeScript.
12. **Narrow `PermissionMode` at Layer 1 to exclude `bypassPermissions`.**
13. **Build rule-cache index instead of sorting per call.** `Map<toolName, Rule[]>` plus a separate list for wildcard rules. Pre-built at session creation; updated atomically by `"always"` responses.

### P2 — DEFENSE IN DEPTH & HYGIENE

14. **Capture resolved path + open by fd at execution time** to close the TOCTOU gap between Layer 1 decision and `toolExecutor` call.
15. **Cap `ruleCache` size per session; LRU eviction.**
16. **Mark `SessionContext` as `Readonly` at the Layer 1 entry point.**
17. **Deduplicate `extractPathFromInput`; centralize tool-input shape helpers.**
18. **Build mode rule tables at module-load, not per call.** Removes GC churn and makes `createdAt` meaningful.
19. **Configure minimatch with `{ dot: true }` (and macOS case-insensitivity).**
20. **Validate `toolName` shape with a strict regex at entry.**
21. **Add hot-reload via SIGHUP for `allowedTools.json`, `defaults.json`, and roots allowlist.**

### P3 — SPEC ALIGNMENT & POLISH

22. **Model `global_deny` as compound `{tool, pathPattern}` matchers**, not scattered across mode rule tables.
23. **Resolve `delegate` semantics with spec update.** Spec §2.1 / §4 is underspecified — Executor guessed wrong. Either flesh out delegate (what frame does the peer runtime see, how is their response propagated back, what's the timeout) or remove the mode from phase 1.
24. **Write the Layer 1 test suite** — property tests per spec R35, plus the negative tests for each P0 above.

---

## 7. Recommended sequence for the Executor

1. First, deliver ONLY the P0 fixes as a single correction PR. Specifically: flow reorder (#1), stat namespace fix (#2), extension glob fix (#3), prefix escape fix (#4), symlink=deny (#5), install-time roots wired (#6), mode-rule matchers tightened (#7). This closes the exploitable security gaps.
2. Then P1 as a second PR: purity refactor (#8), return-type reconciliation (#9), rule-trace on return (#10), type consistency (#11), mode narrowing (#12), ruleCache index (#13). This unblocks Layers 2/3.
3. P0 + P1 must be green before any Layer 2 work starts (per the stability rule in the spec).
4. P2/P3 can land in parallel with Layer 2.

---

## 8. Open follow-ups for the Architect (me)

- The `delegate` mode is genuinely under-specified in my spec. Either I write a concrete delegate protocol (peer-runtime frame shape, timeout behavior, failure semantics) or we pull delegate from phase 1.
- The spec should explicitly forbid mode rules from having effect `"allow"` when a path boundary is in play, OR it should define precedence unambiguously. Right now two reasonable readers could disagree, and the Executor picked the wrong one.
- ~~Supplying the Supervisor's security audit would let me consolidate findings rather than issuing parallel lists.~~ **Resolved — audits supplied; consolidation below in §9.**

---

## 9. Consolidation with Supervisor audits (1st Review + 2nd Review)

The Supervisor delivered two audits. §9.1 maps their findings onto the review above; §9.2 records issues they found that extend mine; §9.3 flags a regression signal between the two audits.

### 9.1 Overlap — where Supervisor and I agree

| Supervisor finding | My review cross-ref | Severity alignment |
|---|---|---|
| Path Traversal (CRITICAL) | §5 #2 prefix-match escape; P0 #4 | Agree — CRITICAL |
| Incomplete Symlink Detection (CRITICAL) | §5 #3 TOCTOU + §5 #11; P0 #5 | Agree — CRITICAL |
| TOCTOU in File Size Check (HIGH) | §5 #11 + R5 stat bug in §1; P0 #2 | Agree — and my review additionally flags `fs.statSync` as a runtime TypeError, strictly worse than TOCTOU alone |
| Insecure Blocked Extensions Check (HIGH) | R5 in §1 + §5 #6 + §5 #15 minimatch options; P0 #3 | Agree — HIGH |
| Wildcard Tool Matching Bypass (HIGH) | §2 acceptEdits/auto rows + §5 #1; P0 #7 | Agree — the mode-rule `{kind:"any"}` is the same root cause |
| Missing Input Sanitization (MEDIUM) | §5 #14 toolName regex | Agree — MEDIUM |
| Session Context Mutability (MEDIUM) | §4 #5; P2 #16 | Agree — MEDIUM |
| Mode Field Manipulation Risk (MEDIUM) | R6 in §1 + §5 #16; P1 #12 | Agree — narrow the type at Layer 1 boundary |
| Missing root allowlist (2nd Review) | R6a in §1; P0 #6 | Agree — CRITICAL in my framing; architectural-hard-boundary violation |
| O(n) linear rule cache (2nd Review) | R3 in §1; P1 #13 | Agree — ARCHITECTURAL |
| Missing `realpath()` usage (2nd Review) | §5 #3, #4; P0 #5 | Agree — part of the symlink-deny + info-leak fix |
| Missing `auto` mode restrictions (2nd Review) | §2 auto row; P0 #1 + P0 #7 | Agree — CRITICAL |

**Net:** every Supervisor finding is already tracked in this review, typically with equal or higher severity and broader root-cause framing. The Supervisor audits are confirmatory; they do not alter the P0 list.

### 9.2 Extensions beyond the Supervisor audits

The following are tracked in this review and do NOT appear in the Supervisor's two reports. They are load-bearing and must not be dropped from the fix PR just because the Supervisor didn't flag them:

- **`fs.statSync` called on `fs/promises` namespace** — guaranteed runtime `TypeError`. The Supervisor framed this only as TOCTOU; in fact the code crashes before TOCTOU even becomes relevant. (§1 R5, P0 #2.)
- **Size-check catch block returns `true`** — permissive-on-failure, wrong direction for a safety layer. (§5 #8, P0 #2 second sentence.)
- **`canUseTool` is not pure** — does `fs.realpath`/`fs.lstat` inline. Violates R1; makes R7 testability unreachable. The Supervisor's checklist didn't raise purity. (§1 R1, P1 #8.)
- **Return-type contract mismatch** — `Promise<"allow"|"deny">` in the interface vs `"allow"|"deny"|"ask"` in the impl. Layer 2 integration blocker. (§4 #1, P1 #9.)
- **No `AskReason` on `ask` returns** — Layer 3 can't pick between prompt / path_consent / delegate dialogs. (§4 #2, P1 #9.)
- **No rule trace on the decision return** — blocks explainability UI and the phase-2 "Deny always" gate. (§4 #3, P1 #10.)
- **`delegate` returns bare `"ask"`** — routing information to the peer runtime is missing entirely, so the mode doesn't actually delegate. (§2 delegate row + §5 #9, P3 #23.)
- **`Rule.effect` type `"allow"|"deny"` contradicts mode-rule files that set `effect: "ask"`** — silent type-error; strict TS is likely off. (§5 #17, P1 #11.)
- **Rule timestamps rebuilt per call** — GC churn + meaningless `createdAt`. (§5 #12, P2 #18.)
- **Minimatch options not set** — `{dot: true}` and macOS case-insensitivity missing; dotfile rules silently don't match. (§5 #15, P2 #19.)
- **No ruleCache size cap** — unbounded growth if "always" approvals are achievable on patterned matchers. (§5 #18, P2 #15.)
- **Duplicated `extractPathFromInput`** across two files — drift risk. (§4 #7, P2 #17.)
- **No hot-reload of `allowedTools.json`/`defaults.json`/roots** — spec called for SIGHUP. (§5 #13, P2 #21.)
- **No `global_deny` compound matcher** — `fs.*:/etc/**` must be expressible as a single rule, not scattered. (§5 #10, P3 #22.)
- **No Layer 1 test suite** — R7 gate unmet, blocks Layer 2 entry. (§1 R7, P3 #24.)

### 9.3 Regression signal between 1st and 2nd audit

The 2nd Review reports that `plan` and `acceptEdits` modes are **missing entirely** from the code under review. In the version I reviewed (`layer1_output.ts.rtf`), both modes were present (plan as a short-circuit deny, acceptEdits as a broken `{kind:"any"}` allow). This mismatch means one of:

1. The Executor submitted a newer revision between the two audits and lost both modes in the rewrite — a regression worse than the original bugs. **Most likely.**
2. The 2nd audit was run against a different file (e.g. the config JSON, not the decision engine).
3. Something else I can't see from here.

**Action for the Executor:** before starting the P0 fix PR, confirm which Layer 1 revision is current. If plan/acceptEdits regressed, restore them first (as rules, not as fast-paths bypassing validation — the P0 #1 flow reorder still applies) before applying the P0 list. Do not apply P0 fixes on top of a regressed base.

**Action for the Supervisor:** pin the commit hash or file version each audit was run against. Audits against moving targets are confusing to consolidate.

### 9.4 Net effect on priority order

The priority order in §6 stands unchanged. The Supervisor audits **confirm** P0 #1–#7 and **add no new P0 items**. The 2nd audit's "missing plan/acceptEdits" is a regression, not a new requirement — handled by the regression-check step above. P1 and P2 items that the Supervisor didn't flag are not downgraded; the Executor must treat §6 as the canonical list.
