# Phase 0.3 — UI-to-Backend Binding Layer

**Audience:** combined backend + frontend agents
**Owner:** Meg
**Priority:** P0 — wires Phase 0.1 (bus) + Phase 0.2 (forms) into a single one-line API
**Sister docs:** `PHASE_0_1_HOT_RELOAD_CONFIG_BUS.md`, `PHASE_0_2_SCHEMA_DRIVEN_FORMS.md`

---

## 0. TL;DR

After 0.1 ships the bus and 0.2 ships the form renderer, this phase makes wiring them trivial. Every UI element with a backend setting becomes one line:

```jsx
<Bind to="models.default.provider" />
```

That's the goal. No fetch hooks, no save handlers, no WS subscriptions in user code. The binding component does it all.

---

## 0.5 Phase 0 Compliance

- [x] **Visual-first** — bindings render as visual widgets via 0.2's renderer
- [x] **Live config** — every binding is a live two-way subscription to the bus
- [x] **No-text-editing** — bindings never expose raw config files
- [x] **Self-healing** — backend rejection bubbles to UI as inline error with retry/reset
- [x] **In-UI extensibility** — `<Bind to="my.new.key" defaultSchema={...} />` registers a new key on first save
- [x] **Real-time** — every binding is a WS subscriber
- [x] **Visible** — every save activity event surfaces via existing feed

---

## 1. The mental model

A "binding" is a contract:

> *"This UI element reflects the current value of backend config key X, and any change to it writes back to X."*

Bindings come in two shapes:
- **Atomic binding** — one widget ↔ one config key
- **Composite binding** — a group of widgets ↔ a category or a sub-tree of keys

---

## 2. The `<Bind>` component

### 2.1 Atomic

```jsx
<Bind to="models.default.provider" />
```

Behaviour:
1. On mount: `GET /api/v2/config/models.default.provider` (returns value + schema)
2. Render via `<SchemaForm>` from Phase 0.2 with `autoSave: true`
3. Subscribe to WS for `config.set` matching this key
4. On user change: debounced `PUT`
5. On WS update from another actor: re-render

Optional props:
```ts
interface BindProps {
  to: string;                    // config key
  label?: string;                // override schema.title
  description?: string;          // override schema.description
  widget?: WidgetName;           // force widget choice
  uiSchema?: UiSchema;           // RJSF UI schema overrides
  readOnly?: boolean;
  className?: string;
  defaultSchema?: JSONSchema;    // register if key doesn't exist yet
  onChange?: (v) => void;        // observer hook (binding still saves)
}
```

### 2.2 Composite — by category

```jsx
<BindCategory category="cron" title="Cron schedules" />
```

Renders all keys in the `cron` category as a single section.

### 2.3 Composite — by prefix

```jsx
<BindGroup prefix="ui.appearance." />
```

Renders all keys under a dotted prefix.

### 2.4 Composite — explicit set

```jsx
<BindSet keys={["models.default.provider", "models.default.id", "models.cost_cap_per_day_usd"]} />
```

For when you want a hand-picked group on a non-settings page (e.g. embed three model controls inside a model picker dropdown).

---

## 3. Action bindings (not just settings)

Some UI elements run actions, not edit values. Same pattern:

```jsx
<BindAction to="agents.kill_all" label="Kill all agents" variant="danger" confirm />
```

This calls `POST /api/v2/actions/agents.kill_all` and shows the result. Actions are registered on the backend much like config keys:

```python
from app.actions import actions

@actions.register(
  key="agents.kill_all",
  schema={"type": "null"},   # or schema for input args
  result_schema={"type": "object", "properties": {"killed": {"type": "integer"}}},
  category="agents",
  destructive=True,
)
async def kill_all(args, actor):
    n = await agent_manager.kill_all()
    return {"killed": n}
```

Endpoint:
```
GET  /api/v2/actions                    list actions (with schema, category, destructive flag)
POST /api/v2/actions/:key               run action (body: input args)
```

Bindings to destructive actions render with a confirm modal and red colour by default.

---

## 4. Widgets that are NOT plain settings

Some bindings render visual things that aren't form widgets:

| Component | Binds to | Renders |
|---|---|---|
| `<BindStatus to="services.gateway.status" />` | string | coloured pill (Online/Offline/Degraded) |
| `<BindMetric to="metrics.tokens.today" />` | number | big-number card with optional sparkline |
| `<BindSparkline to="metrics.cpu.history" />` | array | inline sparkline |
| `<BindFeed topic="agent.events" />` | WS topic | live event list |
| `<BindLog file="logs/server.log" tail={100} />` | file | live log tail (read-only) |
| `<BindIndicator to="connections.tailscale" />` | boolean | dot indicator |

All of these are read-only consumers of the bus / activity feed / file streams. They follow the same WS subscription pattern as `<Bind>` but render different visuals.

---

## 5. Backend additions for actions

Module: `backend/app/actions/`
- `registry.py` — singleton, `register(key, schema, result_schema, ...)`
- `routes.py` — `GET /api/v2/actions`, `POST /api/v2/actions/:key`
- `events.py` — every action invocation logged to activity feed with actor + args + result
- `permissions.py` — actions can declare `requires_confirm: bool`, `destructive: bool`, future `requires_role`

Endpoint shapes:
```
GET /api/v2/actions
{
  "actions": [
    { "key": "agents.kill_all", "title": "Kill all agents", "category": "agents",
      "destructive": true, "input_schema": {...}, "result_schema": {...} }
  ]
}

POST /api/v2/actions/agents.kill_all
body: {}
response: { "ok": true, "result": { "killed": 3 }, "ts": ... }
```

WS broadcast on every action:
```json
{
  "type": "action.invoked",
  "key": "agents.kill_all",
  "actor": "user:meg",
  "result": { ... },
  "ts": ...
}
```

---

## 6. Use cases this enables

After 0.1 + 0.2 + 0.3, real-world wiring looks like:

### 6.1 Theme switcher (Phase O)

```jsx
<Bind to="ui.theme.default" />          // dropdown auto-rendered from enum schema
<Bind to="ui.appearance.font_scale" />  // slider auto-rendered from min/max
<Bind to="ui.wallpaper.url" />          // file picker auto-rendered from format: file-path
```

All three live, persisted, propagating across tabs. Zero custom React.

### 6.2 Cron page

```jsx
<Bind to="cron.watcher.interval_seconds" />
<Bind to="cron.auditor.interval_seconds" />
<BindAction to="cron.run_now" args={{ job_id }} />
```

### 6.3 Costs page

```jsx
<BindMetric to="metrics.tokens.today" />
<BindMetric to="metrics.cost.today_usd" />
<Bind to="models.cost_cap_per_day_usd" />   // slider
<BindSparkline to="metrics.cost.history.30d" />
```

### 6.4 Customise — desktop apps list (E3)

```jsx
<BindList collection="custom_skills" itemSchema={...} addButton />
```

`<BindList>` is a special composite that handles add/remove/reorder of array-of-objects collections. Internally it talks to `/api/skills/custom` etc.

---

## 7. Acceptance

- [ ] `<Bind to="models.default.provider" />` renders a working dropdown without any other code
- [ ] Two browser tabs with the same `<Bind>` stay in sync within 1s
- [ ] `<BindAction to="agents.kill_all" confirm />` shows confirm modal, runs action on confirm, displays result
- [ ] `<BindStatus to="services.gateway.status" />` updates pill colour live as service flaps
- [ ] `<BindMetric>` shows latest value + 30-point sparkline drawn from rolling buffer
- [ ] `<BindFeed topic="agent.events" />` shows new events as they arrive without reload
- [ ] `<BindList>` add/remove operations propagate to all open tabs
- [ ] Network failure: `<Bind>` shows error state with retry button; previous value retained
- [ ] No `<Bind>` triggers a page reload on change
- [ ] All bindings unmount cleanly (no leaked WS subscriptions)
- [ ] Dev tools show one WS connection (gateway), not one per binding

---

## 8. Out of scope

- Form-level conditional logic ("if X then show Y") beyond what RJSF gives natively
- Multi-step wizards (handled via separate workflow primitive, future phase)
- Drag-to-reorder for `<BindList>` complex collections (basic up/down arrows only for now)
- Cross-key validation ("X must be < Y") — handled in backend on save, surfaced as error
- Optimistic chained mutations across multiple keys

---

## 9. Acceptance: the dogfooding test

After 0.1 + 0.2 + 0.3 ship, the facilitator must be able to add a brand-new toggle to the platform in **under 5 minutes** with no code beyond:

1. Backend (one block): `bus.register_default("feature.flags.my_new_thing", False, schema={...})`
2. Frontend (one line): `<Bind to="feature.flags.my_new_thing" />`

If this test passes, Phase 0 is done. If it doesn't, Phase 0 is incomplete regardless of what individual sub-phases claim.

---

End of Phase 0.3 handoff.
