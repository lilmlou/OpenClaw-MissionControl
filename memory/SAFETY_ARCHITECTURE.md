# OpenClaw Mission Control — Safety & Control Layer Architecture

**Status:** Design spec — ready for Executor implementation.
**Audience:** Implementation agent building the session manager, approval shell, and gateway transport.
**Scope:** Defines the three-layer Approval Shell that sits between the React UI and two un-sandboxed, autonomous AI systems — OpenClaw and Hermes Agent.

**Governing pattern:** Claude Agent SDK `canUseTool` approval shell. The approval logic is the core; transport is a bridge, not a policy engine.

**Sequencing rule:** Approval Shell must be stable before any gateway transport work begins. Build in order: Layer 1 (Decision Engine) → Layer 2 (Event + Response Loop) → Layer 3 (Notification Bridge) → Gateway transport.

---

## 1. Analysis of Existing Shell

The frontend (`frontend/src/lib/useGateway.js`) is already partially aligned with the `canUseTool` pattern. The session manager must honor the contracts the shell already speaks.

**Connection topology the shell expects.**
- Chat WebSocket: `/api/ws/chat` — streams `chat.chunk`, `chat.complete`, `chat.error`, and `tool.permission_request` frames.
- Approvals WebSocket: `/api/ws/approvals` — pushes live approval state changes; UI subscribes with `{"type":"subscribe"}`.
- REST approval surface:
  - `GET /api/v2/approvals/pending`
  - `GET /api/v2/approvals/history?limit=&offset=`
  - `POST /api/v2/approvals/{id}/respond`  ← this is where `respondToToolPermission` surfaces
  - `GET /api/v2/approvals/sessions/{sessionId}/state`
  - `POST /api/v2/approvals/sessions/{sessionId}/mode`
  - Legacy: `GET /api/approvals`, `PUT /api/approvals/{id}/approve|reject`

**Permission modes already referenced in the shell.**
The frontend has `APPROVAL_MODES = ["default", "acceptEdits", "bypassPermissions", "plan", "auto"]`. The full SDK set we must support is **`default → acceptEdits → bypassPermissions → plan → dontAsk → delegate → auto`**. The frontend needs to be widened to include `dontAsk` and `delegate` — tracked as a follow-up in §9.

**Runtime toggle (OpenClaw / Hermes) is first-class.**
- `DEFAULT_RUNTIME = "openclaw"`; every `chat.message` carries a `runtime` field.
- Runtime is stored per-thread with a global fallback; resolved on every send.

**What doesn't exist yet.**
- No session manager, no `canUseTool`, no rule cache, no approval promise bridge.
- No `backend/` directory. `backend_test.py` points at an external preview URL; it's not the in-repo backend.
- No MCP reconciliation, no file/sandbox boundary enforcement.

**Shell protection.**
- UI process and session-manager process are separated. Bots never share a process with the UI.
- UI holds no API keys; all secrets live in the session manager's encrypted keystore (macOS Keychain via `keytar`).
- Session manager binds to `127.0.0.1` only; UI↔manager link is HMAC-authenticated.

---

## 2. Three-Layer Approval Shell

```
┌─────────────────────────────────────────────────────────────────────┐
│                        React UI (shell)                             │
│  ApprovalsPage / tool_permission_request card  (deny|once|always)   │
└────────────┬────────────────────────────────────────────────────────┘
             │                                  ▲
             │ respondToToolPermission(id,...)  │ tool_permission_request
             ▼                                  │ (debounced ~300ms)
┌─────────────────────────────────────────────────────────────────────┐
│                LAYER 3 — Notification Bridge                        │
│  - 300ms debounce                                                   │
│  - suppress if UI already focused on the session                    │
│  - native notification / dock bounce / inline card                  │
└────────────┬────────────────────────────────────────────────────────┘
             ▲
             │ emits tool_permission_request events
             │
┌────────────┴────────────────────────────────────────────────────────┐
│                LAYER 2 — Event + Response Loop                      │
│  request registry (UUID → Promise resolver)                         │
│  respondToToolPermission(id, "once"|"always"|"deny")                │
│    once    → resolve(allow) for this request only                   │
│    always  → persist rule into session.ruleCache, resolve(allow)    │
│    deny    → resolve(deny); optional persist per-design             │
└────────────┬────────────────────────────────────────────────────────┘
             ▲ resolves Promise back to Layer 1
             │
┌────────────┴────────────────────────────────────────────────────────┐
│                LAYER 1 — Decision Engine                            │
│                                                                     │
│  async canUseTool(toolName, input) → "allow" | "deny" | "ask"       │
│                                                                     │
│  Fast paths (checked in order, short-circuit):                      │
│    1. allowedTools list       (static, boot-time config)            │
│    2. session.ruleCache       (from previous "always" responses)    │
│    3. permissionMode bypass   (bypassPermissions / dontAsk / plan)  │
│                                                                     │
│  Full evaluation:                                                   │
│    • permission mode (default, acceptEdits, bypassPermissions,      │
│                       plan, dontAsk, delegate, auto)                │
│    • per-tool rules  (allow/deny/ask + glob patterns)               │
│    • trusted folders / path boundaries for fs tools                 │
│    • blocked extensions + file size guardrails                      │
│                                                                     │
│  Output: single decision. If "ask", Layer 2 creates a request,      │
│  Layer 3 surfaces it, and the Promise awaits the user's response.   │
└─────────────────────────────────────────────────────────────────────┘
             ▲
             │ every tool call from the bot
             │
┌────────────┴────────────────────────────────────────────────────────┐
│  Session Manager Core                                               │
│    - per-session state (mode, ruleCache, activeMcpServers,          │
│      enabledMcpTools, trustedPaths, runtime)                        │
│    - hosts Layer 1/2/3                                              │
│    - exposes canUseTool as the single gate before tool execution    │
└────────────┬────────────────────────────────────────────────────────┘
             ▲
             │ bot emits tool_use
             │
┌────────────┴────────────────────────────────────────────────────────┐
│  Bot Adapters (OpenClaw, Hermes)                                    │
│  - own their API key + transport                                    │
│  - DO NOT import fs/child_process/net                               │
│  - every tool_use goes through session.canUseTool first             │
└─────────────────────────────────────────────────────────────────────┘
```

### 2.1 Layer 1 — Decision Engine

**Signature:**
```ts
async function canUseTool(
  ctx: SessionContext,
  toolName: string,
  input: Record<string, unknown>
): Promise<Decision>
```

`Decision = "allow" | "deny" | "ask"`. If the function returns `"ask"`, the caller (session manager) creates a request via Layer 2 and awaits the user's response — the **final** resolved value is `"allow"` or `"deny"` only.

**Fast paths (short-circuit in this order):**
1. **allowedTools list.** Static boot-time config of tools that are always permitted (e.g. pure read-only introspection). Keeps the hot path fast.
2. **session.ruleCache.** Rules persisted from prior `"always"` responses, keyed by tool + matcher pattern (path glob, command prefix, URL host). Matching rules short-circuit to `allow` or `deny`.
3. **permissionMode bypass.** `bypassPermissions` → allow; `dontAsk` → honor rules but never prompt (unmatched = allow); `plan` → deny all execution; `auto` → allow reads and prompt on writes.

**Full evaluation (if no fast path matched):**
- Apply the permission-mode rule table (see §4) combined with per-tool allow/deny patterns.
- For file-system tools: path must resolve (via `realpath`, symlinks-rejected) inside `session.trustedPaths`; extension must not be on the blocked list; size must be ≤ `fileSizeLimit` (default 50 MB).
- For shell tools: parse `argv`, match each token against deny patterns separately.
- For MCP tools: tool must be in `session.enabledMcpTools`.

**Output contract.**
- `"allow"` → Layer 1 returns immediately; caller proceeds to execute.
- `"deny"` → Layer 1 returns immediately; caller aborts, reports structured error to bot.
- `"ask"` → caller passes the decision to Layer 2, which returns a final `"allow" | "deny"`.

Layer 1 is **pure** — same inputs always produce the same output for a given session state. No I/O, no event emission. This makes it unit-testable in isolation and is the stability target for the "approval shell must be stable first" sequencing rule.

### 2.2 Layer 2 — Event + Response Loop

**The request registry.** A `Map<string, { resolve, reject, createdAt, toolName, input, sessionId }>` keyed by request UUID. An `"ask"` outcome from Layer 1 creates an entry and returns the pending Promise.

**Public API:**
```ts
// called by session core when Layer 1 returns "ask"
function requestPermission(
  sessionId: string,
  toolName: string,
  input: unknown,
  preview: PermissionPreview
): Promise<"allow" | "deny">;

// called by the UI via POST /api/v2/approvals/{id}/respond
function respondToToolPermission(
  id: string,
  action: "once" | "always" | "deny"
): void;
```

**Response semantics:**
- **`once`** → one-shot. Resolve Promise with `"allow"`. No rule persisted. The next identical call will prompt again.
- **`always`** → persist a rule into `session.ruleCache` BEFORE resolving (so the cache is authoritative for any racing concurrent call). Rule scope is the tool + a matcher derived from `input` (path glob for fs, argv[0] for shell, host for net). Then resolve with `"allow"`.
- **`deny`** → resolve with `"deny"`. Optional: if the UI control exposes "deny-and-remember", persist a deny rule with the same matcher shape. Default is no persistence on deny.

**Emission.** When a request is created, Layer 2 emits a `tool_permission_request` event. This event is consumed by Layer 3 only — Layer 2 knows nothing about WebSockets or notifications.

**Cancellation.** If the bot's run is cancelled (UI `chat.cancel`), the session core calls a `cancelPending(runId)` that rejects all Promises tied to that runId with a typed `CancelledError`.

**TTL.** Pending requests older than 5 min are auto-resolved with `"deny"` and marked `"expired"` in the persisted record.

### 2.3 Layer 3 — Notification Bridge

Pure bridge. Takes events from Layer 2 and surfaces them to the user. Never makes policy decisions.

**Responsibilities:**
- **300 ms debounce.** When a request is emitted, wait 300 ms before surfacing. If the user responds within that window via an already-visible card (e.g. from a prior request's dialog still in focus), suppress the notification. Avoids noisy transient prompts when the bot fires a burst of tool calls.
- **Focus-aware suppression.** If the UI reports the user is actively focused on this session's view, skip desktop notifications and only show the inline card.
- **Channel fan-out.** Push over `/api/ws/approvals` for the ApprovalsPage subscriber; push `tool_permission_request` over `/api/ws/chat` for inline chat cards; fire a macOS `UNUserNotification` if configured and not suppressed.

Transport (WebSocket, REST, native) is implemented inside Layer 3 only. This is the one place the transport bridge lives — by design, to keep the decision engine and event loop pure.

---

## 3. The Toggle — bot selection

Bot selection is orthogonal to approvals and runs in the session manager above Layer 1. Precedence on every `chat.message`:

1. `frame.runtime` (authoritative for this send)
2. `session.runtime` (stored per-thread)
3. `DEFAULT_RUNTIME = "openclaw"`

If the resolved runtime has no healthy adapter, emit `chat.error { code: "ADAPTER_DOWN" }`. Never silently fall through to the other bot.

---

## 4. Permission Modes

Seven modes, evaluated inside Layer 1 after the fast-path checks:

| Mode | Behavior |
|---|---|
| `default` | Prompt for every tool that isn't on `allowedTools` or matched by a rule. Safest default. |
| `acceptEdits` | Auto-allow writes inside `trustedPaths`; prompt for shell/net; honor `global_deny` always. |
| `bypassPermissions` | **REJECTED SERVER-SIDE** in this phase. The policy parser must not accept this value; any attempt to set it via `POST /api/v2/approvals/sessions/{id}/mode` returns `400 { code: "unsupported_mode" }`. Re-enabling requires a separate hardened feature gate with a sandbox prerequisite — explicitly out of scope now. |
| `plan` | Deny all execution. Bot can reason and produce proposed actions but cannot run tools. |
| `dontAsk` | Honor allow/deny rules; for unmatched tools, allow without prompting. Stronger than bypass-on-unmatched because rules still apply. |
| `delegate` | Route every tool call to the other runtime's adapter for approval (OpenClaw approves Hermes's tools and vice versa). Specialized; off by default. |
| `auto` | Allow reads and safe introspection; prompt on writes; deny destructive (`fs.delete`). |

Modes are per-session. Set via `POST /api/v2/approvals/sessions/{sessionId}/mode`.

---

## 5. MCP Server Hot-Swap

Separate concern from approvals, but lives in the session manager because the enabled-tool list feeds Layer 1.

**Tracked per session:**
- `activeMcpServers: Map<serverId, ServerHandle>`
- `enabledMcpTools: Map<toolName, serverId>`

**Reconciliation.** When MCP server config changes (user adds/removes a server in Settings), call `reconcileServers(desired)`:

```
current  = session.activeMcpServers
desired  = newConfig.servers

for each id in (current - desired):   shutdown(id)      // removed
for each id in (desired - current):   start(id)         // added
for each id in (current ∩ desired):
  if config differs: restart(id)                        // changed
  else:              no-op                              // stable
```

Goal: minimize full restarts. Only touch what changed.

After reconcile, rebuild `enabledMcpTools` from live server introspection. Layer 1 reads this map on every decision, so new tools are immediately gated by the approval shell.

---

## 6. File / Sandbox Boundaries

Enforced inside Layer 1's full-evaluation step for any filesystem tool.

**Two-tier path model.**
- **Install-time root allowlist (hard boundary, system-level).** Set once at install, editable only via a dedicated Settings flow with explicit user consent. Example default: `~/OpenClaw-Workspace`. Every `session.trustedPaths` entry MUST be a descendant of at least one root in this allowlist. No exceptions. This prevents per-session UI declarations from escaping to `/System`, `/etc`, `$HOME` broadly, or other user data.
- **Per-session `trustedPaths` (soft boundary, UI-declared).** The UI declares what the session can reach within the install-time roots. Populated at session start and extended via `path_consent` approvals.

**Path validation.** Every path argument is:
1. Resolved via `realpath` to absolute form.
2. Rejected if any component in the chain is a symlink (do not follow — reject).
3. Required to be prefix-match of at least one entry in `session.trustedPaths`.
4. `session.trustedPaths` itself is validated at session creation: every entry must descend from the install-time root allowlist, or session creation fails.

**Blocked extensions.** A denylist (default: `.ssh/id_*`, `.env`, `.gpg`, `.pem`, `.key`, `.keychain`, `Keychains/*`, `.bash_history`, `.zsh_history`) is matched against the resolved path. Hit = deny.

**File size guardrails.** Default write/read limit = **50 MB**. Configurable per session. Writes that would exceed the limit are denied before execution; reads above the limit are truncated with a `truncated: true` flag in the returned output.

**New-path consent.** If a tool references a path outside `trustedPaths`, Layer 1 emits a special `"ask"` decision with `kind: "path_consent"`. The UI shows a distinct consent dialog ("OpenClaw wants access to `/Users/meg/Documents/Taxes` — Allow once / Always / Deny"). On `"always"`, the path is appended to `session.trustedPaths`.

---

## 7. Directory Structure

```
backend/
├── package.json
├── tsconfig.json
├── .env.example
├── src/
│   ├── index.ts                       # process entrypoint (minimal — wires Core to Transport)
│   ├── config/
│   │   ├── keystore.ts                # macOS Keychain via keytar
│   │   ├── allowedTools.json          # boot-time fast-path list
│   │   └── defaults.json              # permission mode defaults, size limit, blocked ext
│   ├── core/                          # THE APPROVAL SHELL — build this first
│   │   ├── sessionManager.ts          # owns sessions; hosts canUseTool
│   │   ├── sessionContext.ts          # per-session state (mode, ruleCache, paths, runtime)
│   │   ├── layer1_decisionEngine.ts   # canUseTool + fast paths + mode evaluator
│   │   ├── layer2_eventLoop.ts        # request registry, respondToToolPermission
│   │   ├── layer3_notifications.ts    # debounce + focus suppress + fan-out
│   │   ├── ruleCache.ts               # persisted "always" rules per session
│   │   ├── pathBoundary.ts            # trustedPaths, realpath, symlink reject, ext+size
│   │   └── permissionModes.ts         # 7-mode rule tables
│   ├── mcp/
│   │   ├── reconcile.ts               # reconcileServers diff
│   │   └── registry.ts                # activeMcpServers, enabledMcpTools
│   ├── adapters/
│   │   ├── base.ts                    # BotAdapter interface (no fs/child_process allowed)
│   │   ├── openclaw.ts
│   │   └── hermes.ts
│   ├── execution/
│   │   ├── toolExecutor.ts            # ONLY module allowed to touch fs/child_process
│   │   ├── sandboxedFs.ts
│   │   └── processRunner.ts
│   ├── transport/                     # Gateway — BUILD LAST, after approval shell stable
│   │   ├── chatSocket.ts              # /api/ws/chat
│   │   ├── approvalsSocket.ts         # /api/ws/approvals (driven by Layer 3)
│   │   ├── restApprovals.ts           # /api/v2/approvals/*  → calls Layer 2
│   │   ├── auth.ts                    # HMAC handshake, loopback guard
│   │   └── envelope.ts                # zod frame schemas
│   ├── audit/
│   │   ├── wal.ts                     # append-only JSONL, fsync per record
│   │   └── redactor.ts
│   ├── types/
│   │   ├── decisions.ts               # Decision, SessionContext, Rule
│   │   ├── frames.ts                  # UI ↔ gateway wire types
│   │   └── approval.ts                # ApprovalRecord
│   └── lib/
│       ├── logger.ts
│       ├── ids.ts
│       └── errors.ts
├── tests/
│   ├── unit/core/                     # Layer 1 pure-function tests — PRIMARY COVERAGE
│   ├── unit/ruleCache/
│   ├── unit/pathBoundary/
│   ├── integration/approvalFlow/      # ask → respond(once|always|deny) → rule cache
│   └── contract/frontend/             # frame shapes match useGateway.js
└── scripts/
    ├── genKey.ts
    └── migrateWal.ts
```

---

## 8. Interface Contracts

### 8.1 Decision Engine (Layer 1)

```ts
// src/types/decisions.ts

export type Runtime = "openclaw" | "hermes";

export type PermissionMode =
  | "default" | "acceptEdits" | "bypassPermissions"
  | "plan"    | "dontAsk"     | "delegate" | "auto";

export type Decision = "allow" | "deny" | "ask";

export interface Rule {
  id: string;
  toolName: string;              // "fs.write" | "shell.exec" | "net.get" | ...
  matcher: RuleMatcher;
  effect: "allow" | "deny";
  source: "static" | "ruleCache" | "mode";
  createdAt: string;
}

export type RuleMatcher =
  | { kind: "path_glob";    pattern: string }
  | { kind: "argv_prefix";  tokens: string[] }
  | { kind: "url_host";     host: string }
  | { kind: "any" };

export interface SessionContext {
  sessionId: string;
  threadId: string;
  runtime: Runtime;
  mode: PermissionMode;
  ruleCache: Rule[];
  trustedPaths: string[];
  blockedExtensions: string[];
  fileSizeLimit: number;         // bytes; default 50 * 1024 * 1024
  enabledMcpTools: Set<string>;
  allowedTools: Set<string>;     // static fast-path list
}

export interface CanUseTool {
  (ctx: SessionContext, toolName: string, input: Record<string, unknown>): Promise<"allow" | "deny">;
  // Note: "ask" is handled internally — the public promise always resolves to a terminal decision.
}
```

### 8.2 Event + Response Loop (Layer 2)

```ts
// src/core/layer2_eventLoop.ts

export interface PermissionPreview {
  kind: "fs.write" | "fs.read" | "fs.delete" | "shell" | "net" | "path_consent" | "other";
  summary: string;
  diff?: string;
  paths?: string[];
  command?: { argv: string[]; cwd: string };
  url?: string;
  sizeBytes?: number;
}

export function requestPermission(
  sessionId: string,
  toolName: string,
  input: unknown,
  preview: PermissionPreview
): Promise<"allow" | "deny">;

export function respondToToolPermission(
  id: string,
  action: "once" | "always" | "deny"
): void;

export function cancelPending(runId: string): void;

export type PermissionEvent =
  | { type: "tool_permission_request"; id: string; sessionId: string;
      toolName: string; preview: PermissionPreview; createdAt: string }
  | { type: "tool_permission_resolved"; id: string; action: "once" | "always" | "deny" }
  | { type: "tool_permission_expired"; id: string };
```

### 8.3 Notification Bridge (Layer 3)

```ts
// src/core/layer3_notifications.ts

export interface NotificationBridge {
  attach(layer2Events: EventEmitter<PermissionEvent>): void;

  /** UI informs the bridge which session is currently focused */
  setFocus(sessionId: string | null): void;

  /** called by bridge — fan-out paths */
  protected surfaceToChat(evt: PermissionEvent): void;        // /api/ws/chat
  protected surfaceToApprovalsSocket(evt: PermissionEvent): void; // /api/ws/approvals
  protected surfaceDesktop(evt: PermissionEvent): void;       // macOS UN
}

// Config
export const DEBOUNCE_MS = 300;
```

### 8.4 Bot Adapter contract (unchanged from original, tightened)

```ts
export interface BotAdapter {
  readonly runtime: Runtime;
  readonly isReady: boolean;
  connect(): Promise<void>;
  disconnect(): Promise<void>;

  /** Yields chunks; emits tool_intent for every tool_use.
   *  Adapter MUST NOT execute tools — it waits on session.canUseTool via the session core. */
  send(params: {
    runId: string; threadId: string; sessionId: string;
    model: string; content: string; signal: AbortSignal;
  }): AsyncIterable<AdapterEvent>;

  returnToolResult(params: {
    runId: string; toolCallId: string; result: ToolResult;
  }): Promise<void>;
}
```

### 8.5 UI ↔ Gateway wire frames (unchanged, referenced for completeness)

See `src/types/frames.ts` — frame shapes are defined by `useGateway.js` and the Executor matches them. Key types: `ChatMessageFrame`, `ChunkFrame`, `CompleteFrame`, `ErrorFrame`, `PermissionRequestFrame`. No changes from prior spec.

---

## 9. Technical Requirements — Build Checklist

Grouped by layer, in build order.

### 9.1 Layer 1 — Decision Engine (build first)
- R1. `canUseTool` is a pure async function; same `(ctx, toolName, input)` always returns the same decision.
- R2. Fast paths are evaluated in exactly this order: `allowedTools` → `ruleCache` → mode bypass. First match wins; short-circuit.
- R3. `ruleCache` lookup is O(log n) or better; matchers are indexed by `toolName`.
- R4. Path resolution: `realpath` + symlink-reject. Any path outside `trustedPaths` after resolution triggers an `"ask"` with `kind: "path_consent"`.
- R5. Blocked extensions and 50 MB size limit enforced inline; size limit configurable.
- R6. Six modes implemented with explicit rule tables: `default, acceptEdits, plan, dontAsk, delegate, auto`. The value `bypassPermissions` is parsed, recognized, and rejected — Layer 1 never sees it. Re-enabling is explicitly out of scope for this phase.
- R6a. Install-time root allowlist loaded from `~/.openclaw/roots.json`. Every session's `trustedPaths` is validated against this allowlist at session creation; mismatches fail session creation with a typed `RootBoundaryError`.
- R7. Unit test coverage ≥ 95% on Layer 1. This is the stability target — do not proceed to Layer 2 until green.

### 9.2 Layer 2 — Event + Response Loop
- R8. Request registry uses UUIDv4. Entries carry `{ resolve, reject, sessionId, toolName, input, createdAt, runId }`.
- R9. `requestPermission` returns a Promise; `respondToToolPermission(id, action)` resolves it.
- R10. `"always"` persists the rule into `session.ruleCache` BEFORE resolving the Promise — atomic w.r.t. concurrent decisions.
- R11. TTL: 5 min default. Expired requests resolve `"deny"` and emit `tool_permission_expired`.
- R12. `cancelPending(runId)` rejects matching Promises with typed `CancelledError`; tested against `chat.cancel`.
- R13. Layer 2 emits events only — no direct WS/REST calls from this module.

### 9.3 Layer 3 — Notification Bridge
- R14. 300 ms debounce before surfacing. Correctness tested: if user responds inside the window via an already-visible card, no redundant notification.
- R15. Focus-aware suppression. UI reports focus via `setFocus(sessionId)`; desktop notifications suppressed when focused session matches.
- R16. Fan-out to all three channels: `/api/ws/chat`, `/api/ws/approvals`, macOS UN. Each channel is independent — a failure in one does not block the others.
- R17. Layer 3 never mutates `ruleCache` or calls `canUseTool` — strictly a bridge.

### 9.4 Session Manager core
- R18. Owns `SessionContext` per session. Snapshotted to disk every 30 s for crash recovery.
- R19. Provides a single `executeToolCall(sessionId, toolName, input)` that: calls `canUseTool` → awaits Promise → on `"allow"` calls `toolExecutor` → returns result to adapter → WAL-logs every step.
- R20. The `executeToolCall` path is the ONLY way a bot's tool call reaches `toolExecutor`. Enforced with module boundaries (adapters cannot import executor directly).

### 9.5 MCP hot-swap
- R21. `reconcileServers(desired)` implements the diff algorithm from §5. No full-restart when a single server changes.
- R22. `enabledMcpTools` rebuilt from live introspection after every reconcile.
- R23. Layer 1 reads `enabledMcpTools` on every call — new tools are gated immediately, removed tools are rejected immediately.

### 9.6 Tool executor
- R24. ONLY module that imports `fs`, `child_process`, or does network writes. Enforced via `eslint-plugin-import` no-restricted-paths rule at the adapter boundary.
- R25. `sandboxedFs` refuses paths outside the resolved `trustedPaths`; `processRunner` spawns with `shell: false`, minimized env, ulimit, 60 s timeout, no TTY.
- R26. Output truncation at 256 KB with `truncated: true` flag.

### 9.7 Gateway transport (build last)
- R27. Binds to `127.0.0.1` only; refuses non-loopback bind without `ALLOW_REMOTE=1`.
- R28. HMAC handshake on both WebSockets; token generated by `scripts/genKey.ts` at install time.
- R29. Every inbound frame validated via zod schema from `envelope.ts`. Invalid frames produce typed `chat.error` and are logged.
- R30. `/api/v2/approvals/{id}/respond` is the REST surface that calls `respondToToolPermission`. Maps `{approved:true}` → `"once"`, `{approved:true, remember:true}` → `"always"`, `{approved:false}` → `"deny"`. For this phase `{approved:false, remember:true}` is NOT accepted — see §9.10 deny-remember policy.
- R30a. `POST /api/v2/approvals/sessions/{id}/mode` rejects `bypassPermissions` with `400 { code: "unsupported_mode", detail: "bypassPermissions is not permitted in this release" }`. Same rejection applies if the value arrives in any session-creation frame.
- R31. Transport contains ZERO policy logic. If a transport handler needs to make a decision, that's a bug — route it through the session core.

### 9.8 Audit log
- R32. Append-only JSONL at `~/.openclaw/audit/YYYY-MM-DD.jsonl`. `fsync` per record.
- R33. Records in this order: `frame.received`, `canUseTool.evaluated`, `permission.requested` (if ask), `permission.resolved`, `tool.executed`, `tool.result`, `frame.sent`.
- R34. Secrets redacted before write via `src/audit/redactor.ts`.

### 9.9 Test matrix
- R35. Layer 1: property-based tests for mode × tool × path combinations.
- R36. Layer 2: concurrency test — two `"ask"` requests for the same rule matcher; `"always"` on the first must resolve the second without surfacing.
- R37. Layer 3: debounce test — burst of 10 requests in < 50 ms produces at most 1 desktop notification when focused elsewhere.
- R38. MCP reconcile: adding one server to a config of 5 triggers 1 start, 0 restarts.
- R39. Integration: full path-consent flow — bot reads a path outside `trustedPaths` but inside the install-time root allowlist; Layer 1 returns `path_consent` ask; user responds `always`; `trustedPaths` updated; next read short-circuits in the fast path.
- R40. Root-boundary test: attempting to add a `trustedPath` outside the install-time root allowlist fails session creation with `RootBoundaryError` AND is never reachable via any REST or WS surface.
- R41. `bypassPermissions` rejection: every endpoint that could accept a mode value (session create, `POST /mode`, connect frame) returns `400 unsupported_mode`. Verified across all three surfaces.

### 9.10 Deny-and-remember policy (phase 1)
- R42. `deny` is **one-shot only** for this release. No "Deny always" control in the ApprovalsPage, no `{approved:false, remember:true}` handling in the REST endpoint.
- R43. Adding "Deny always" is explicitly gated on two prerequisites shipping first:
  - rule **explainability** — the UI must be able to show which rule matched a given decision and why;
  - rule **revoke UI** — a one-click "remove this rule" affordance on every persisted rule.
- R44. Until those prerequisites land, the ruleCache holds `allow` rules only. The type `Rule.effect` remains `"allow" | "deny"` in the schema for forward compatibility, but `"deny"` entries are never written in this phase.

### 9.11 Hermes adapter — BLOCKED until spec supplied
**Do not implement `src/adapters/hermes.ts` in this phase.** The repository does not define Hermes's wire protocol, and building from inference will produce a wrong adapter.

- R45. Ship `src/adapters/openclaw.ts` only. Leave `hermes.ts` as a stub that throws `HermesProtocolUnspecifiedError` on instantiation.
- R46. The `runtime` toggle path must still handle `"hermes"` cleanly — the router returns `chat.error { code: "ADAPTER_DOWN", detail: "Hermes protocol not specified" }` rather than crashing.
- R47. Before the Hermes adapter is implemented, Meg supplies ONE of:
  - a written protocol spec, or
  - a reference client/server implementation

  covering: transport (WS vs HTTP streaming/SSE), endpoint URL/path/versioning, auth (header name, bearer format, refresh/reconnect), handshake (init message, capabilities, session/conversation IDs), message schema (event types, required fields, correlation IDs), streaming (chunk/event ordering, completion/error frames), tool use (assistant tool-call frame, tool-result frame, partials, failure handling), heartbeats/reconnect (ping/pong, resume semantics), error model (auth, validation, rate limit, server failure), and one example transcript: prompt → streamed response → tool call → tool result → final answer.

### 9.12 Frontend synchronization (same PR as backend)
- R48. The Executor IS authorized to update `frontend/src/lib/useGateway.js` in the same PR. The mode list is a protocol contract and backend + frontend must land together.
- R49. Update `APPROVAL_MODES` from `["default", "acceptEdits", "bypassPermissions", "plan", "auto"]` to `["default", "acceptEdits", "plan", "dontAsk", "delegate", "auto"]`. Six modes. `bypassPermissions` is removed from the constant entirely — not present in any UI selector.
- R50. Any existing localStorage-persisted session mode of `"bypassPermissions"` is migrated to `"default"` on Zustand rehydrate (bump persist version to v4 with a migration step).

---

## 10. Resolved decisions (phase 1 lock-in)

All six prior open questions are now resolved. This section is authoritative; the sections above have been updated to match.

1. **Frontend mode set.** Executor updates `useGateway.js` `APPROVAL_MODES` in the same PR. Mode list is a protocol contract — backend and frontend land together. See R48–R50.
2. **`bypassPermissions`.** Rejected server-side, always, in this phase. No runtime flag. Gateway policy parser ignores the value and returns `400 unsupported_mode`. Any re-enable is a separate hardened feature gate with a sandbox prerequisite — explicitly out of scope. See R6, R30a, R41.
3. **`delegate` mode.** The delegated bot receives a **structured, redacted tool intent** — tool name, normalized args, risk, resolved paths/command preview, calling runtime and session context. An optional NL summary can accompany it for UI readability, but decisioning uses the structured payload. (Hermes's redacted-intent wire shape is blocked on §9.11.)
4. **Workspace root.** Per-session `trustedPaths` declared by the UI, constrained by a mandatory install-time root allowlist (hard boundary). Every `trustedPath` must descend from a root in the allowlist; mismatches fail session creation. Organized-workspace posture preferred over a single permanently trusted root. See §6 "Two-tier path model" and R6a, R40.
5. **Hermes wire protocol.** Implementation of the Hermes adapter is **BLOCKED** until Meg supplies a spec or reference client covering transport, auth, handshake, schema, streaming, tool use, heartbeats, error model, and an example transcript. See §9.11 R45–R47. OpenClaw adapter proceeds unblocked.
6. **"Deny-and-remember" UX.** Ship deny as **one-shot only** in phase 1. Adding "Deny always" is gated on rule explainability UI and easy revoke UI shipping first — avoids sticky accidental lockouts. See §9.10 R42–R44.
